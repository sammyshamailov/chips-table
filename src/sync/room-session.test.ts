import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalStore, memoryStorage } from '../data/local-store';
import type { Store, StoreError } from '../data/store';
import type { DomainEvent } from './domain-events';
import { createEventBus } from './events';
import { createRoomSession, type SessionState } from './room-session';

const HOUR = 60 * 60 * 1000;
const NOW = 1_000_000_000;

/** Single-device mode's store with listeners told only when `flush()` is called. */
function setup() {
  const queue: (() => void)[] = [];
  const flush = () => {
    while (queue.length) (queue.shift() as () => void)();
  };
  const store = createLocalStore(memoryStorage(), f => queue.push(f));
  const S: SessionState = {
    myId: 'p_me',
    db: store,
    code: null,
    room: null,
    roomLoaded: false,
    players: {},
    rooms: [],
    unsubs: [],
  };
  const bus = createEventBus<DomainEvent>();
  const calls = { render: 0, paint: 0, toasts: [] as string[], reenter: [] as string[] };
  const session = createRoomSession({
    S,
    bus,
    render: () => calls.render++,
    paint: () => calls.paint++,
    toast: t => calls.toasts.push(t),
    now: () => NOW,
    reenter: code => calls.reenter.push(code),
  });
  return { store, S, bus, calls, session, flush };
}

const room = { code: 'ABCD', game: 'blackjack', hostId: 'p_me', phase: 'betting', roundId: 1, updatedAt: NOW };

describe('the room session', () => {
  afterEach(() => vi.useRealTimers());

  it('reads the room and its players, normalised, and renders', async () => {
    const { store, S, calls, session, flush } = setup();
    await store.doc('rooms/ABCD').set(room);
    await store.doc('rooms/ABCD/players/p_me').set({ name: 'סמי', stack: 500, joinedAt: 1 });
    flush(); // the writes' own notices, before anyone listens
    session.listen('ABCD');
    expect([S.code, S.room, S.roomLoaded, S.synced, S.pSynced]).toEqual(['ABCD', null, false, false, false]);
    flush();
    expect(S.room).toMatchObject({ code: 'ABCD', stage: 'idle', closed: false, final: null });
    expect([S.roomLoaded, S.synced, S.pSynced]).toEqual([true, true, true]);
    expect(S.players.p_me).toMatchObject({ name: 'סמי', stack: 500, hands: [], lastAction: null });
    expect(calls.render).toBe(2);
  });

  it('marks a missing table as loaded with no room', () => {
    const { S, session, flush } = setup();
    session.listen('ZZZZ');
    flush();
    expect([S.room, S.roomLoaded]).toEqual([null, true]);
  });

  it('runs the effects around the change: before sees the old players, after the new ones', async () => {
    const { store, S, bus, session, flush } = setup();
    await store.doc('rooms/ABCD').set(room);
    await store.doc('rooms/ABCD/players/p_b').set({ name: 'דנה', stack: 500, ts: 1 });
    session.listen('ABCD');
    flush();
    const seen: string[] = [];
    bus.on('BetPlaced', {
      before: e => seen.push(`before ${e.pid} ${e.amount} stack ${S.players.p_b.stack}`),
      after: () => seen.push(`after stack ${S.players.p_b.stack}`),
    });
    const bet = { stack: 450, bjRound: 1, hands: [{ bet: 50 }], lastAction: { k: 'bet', amt: 50 }, ts: 2 };
    await store.doc('rooms/ABCD/players/p_b').update(bet);
    flush();
    expect(seen).toEqual(['before p_b 50 stack 500', 'after stack 450']);
  });

  it('ignores snapshots of a table it has left, and stops listening', async () => {
    const { store, S, calls, session, flush } = setup();
    await store.doc('rooms/ABCD').set(room);
    session.listen('ABCD');
    S.code = 'EFGH';
    flush();
    expect([S.room, calls.render]).toEqual([null, 0]);
    S.code = 'ABCD';
    S.unsubs.push(() => {
      throw new Error('already gone');
    });
    session.leave();
    expect(S.unsubs).toEqual([]);
    await store.doc('rooms/ABCD').update({ handId: 3 });
    flush();
    expect([S.room, calls.render]).toEqual([null, 0]);
  });

  it('lists the open tables of the last two days, and redraws only on home', async () => {
    const { store, S, calls, session, flush } = setup();
    await store.doc('rooms/AAAA').set({ ...room, code: 'AAAA' });
    await store.doc('rooms/BBBB').set({ ...room, code: 'BBBB', closed: true });
    await store.doc('rooms/CCCC').set({ ...room, code: 'CCCC', updatedAt: NOW - 49 * HOUR });
    flush();
    session.listRooms();
    flush();
    expect(S.rooms.map(r => r.code)).toEqual(['AAAA']);
    expect(calls.paint).toBe(1);
    S.code = 'AAAA';
    await store.doc('rooms/DDDD').set({ ...room, code: 'DDDD', updatedAt: NOW + 1 });
    flush();
    expect(S.rooms.map(r => r.code)).toEqual(['DDDD', 'AAAA']);
    expect(calls.paint).toBe(1);
  });

  it('shows a listener error, and listens again after a lost connection', () => {
    vi.useFakeTimers();
    const errors: ((e: StoreError) => void)[] = [];
    const failing = {
      doc: () => ({ onSnapshot: (_: unknown, err: (e: StoreError) => void) => (errors.push(err), () => {}) }),
      collection: () => ({ onSnapshot: (_: unknown, err: (e: StoreError) => void) => (errors.push(err), () => {}) }),
    } as unknown as Store;
    const { S, calls, session } = setup();
    S.db = failing;
    session.listen('ABCD');
    errors[0]({ code: 'permission-denied' });
    expect([S.syncErr, calls.toasts, calls.render]).toEqual([
      'permission-denied',
      ['שגיאת סנכרון: permission-denied'],
      1,
    ]);
    vi.advanceTimersByTime(5000);
    expect(calls.reenter).toEqual([]);
    errors[1]({ code: 'unavailable' });
    vi.advanceTimersByTime(2500);
    expect(calls.reenter).toEqual(['ABCD']);
    S.code = null;
    errors[1]({ code: 'internal' });
    expect(S.syncErr).toBe('unavailable');
  });
});
