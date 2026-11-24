import { describe, expect, it } from 'vitest';
import { normalizePlayer, normalizeRoom } from '../data/schema';
import type { KeyValueStore } from '../data/browser-storage';
import { randomCode, randomId } from './ids';
import {
  createState,
  eventLine,
  isHost,
  me,
  nameOf,
  newPlayer,
  pendChips,
  playerList,
  playerPath,
  roomPath,
  standings,
} from './state';

function storage(init: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    get: k => (k in data ? data[k] : null),
    set: (k, v) => void (data[k] = v),
    del: k => void delete data[k],
  };
}

function table() {
  const S = createState(storage({ 'chips.pid': 'p_me', 'chips.name': 'סמי' }), () => 'p_new');
  S.code = 'ABCD';
  S.room = normalizeRoom({ code: 'ABCD', hostId: 'p_me', hostName: 'סמי' });
  S.players = {
    p_b: normalizePlayer({ name: 'דנה', joinedAt: 2, stack: 700 }),
    p_me: normalizePlayer({ name: 'סמי', joinedAt: 1, stack: 1200 }),
    p_c: normalizePlayer({ name: 'יוסי', joinedAt: 3, stack: 700 }),
  };
  return S;
}

describe('createState', () => {
  it('keeps the phone’s player id, name and avatar', () => {
    const ls = storage({ 'chips.pid': 'p_kept', 'chips.name': 'דנה', 'chips.avatar': '{"k":"set","v":"tex"}' });
    let made = 0;
    const S = createState(ls, () => (made++, 'p_new'));
    expect([S.myId, S.name, S.avatar, made]).toEqual(['p_kept', 'דנה', { k: 'set', v: 'tex' }, 0]);
  });

  it('makes and saves a player id only when there is none', () => {
    const ls = storage();
    const S = createState(ls, () => 'p_new');
    expect(S.myId).toBe('p_new');
    expect(ls.data['chips.pid']).toBe('p_new');
  });

  it('drops a damaged or unknown saved avatar', () => {
    expect(createState(storage({ 'chips.avatar': '{oops' }), () => 'p').avatar).toBeNull();
    expect(createState(storage({ 'chips.avatar': '{"k":"set","v":"toString"}' }), () => 'p').avatar).toBeNull();
  });

  it('starts on home with the new-table form filled in', () => {
    const S = createState(storage(), () => 'p');
    expect([S.mode, S.code, S.room, S.sheet, S.pending]).toEqual(['pending', null, null, null, 0]);
    expect(S.create).toEqual({
      game: 'holdem',
      stack: '1000',
      sb: '5',
      bb: '10',
      minBet: '10',
      maxBet: '500',
      play: true,
    });
  });
});

describe('questions about the state', () => {
  it('lists the players in the order they sat down, with their ids', () => {
    expect(playerList(table()).map(p => p.pid)).toEqual(['p_me', 'p_b', 'p_c']);
  });

  it('knows this phone’s player and whether it is the dealer', () => {
    const S = table();
    expect(me(S)).toMatchObject({ pid: 'p_me', name: 'סמי', stack: 1200 });
    expect(isHost(S)).toBe(true);
    S.myId = 'p_b';
    expect(isHost(S)).toBe(false);
    S.myId = 'p_gone';
    expect(me(S)).toBeNull();
  });

  it('names a player, the dealer who doesn’t sit, or anyone else', () => {
    const S = table();
    delete S.players.p_me;
    expect([nameOf(S, 'p_b'), nameOf(S, 'p_me'), nameOf(S, 'p_x')]).toEqual(['דנה', 'סמי', 'שחקן']);
  });

  it('ranks the standings by stack, ties in seat order', () => {
    expect(standings(table())).toEqual([
      { pid: 'p_me', name: 'סמי', stack: 1200 },
      { pid: 'p_b', name: 'דנה', stack: 700 },
      { pid: 'p_c', name: 'יוסי', stack: 700 },
    ]);
  });

  it('keeps the chips in hand while they add up, and makes them up when they don’t', () => {
    const S = table();
    S.pending = 30;
    S.pendChips = [5, 25];
    expect(pendChips(S)).toEqual([5, 25]);
    S.pending = 60;
    expect(pendChips(S)).toEqual([50, 10]);
  });

  it('writes a new player with its name cut to 20 letters and the phone’s avatar', () => {
    const S = table();
    S.name = '  ' + 'א'.repeat(25) + ' ';
    S.avatar = { k: 'set', v: 'tex' };
    const d = newPlayer(S, 500, 99);
    expect(d).toMatchObject({ name: 'א'.repeat(20), stack: 500, joinedAt: 99, ts: 99, avatar: { k: 'set', v: 'tex' } });
    expect(d).toMatchObject({ handId: 0, bjRound: null, hands: [], lastAction: null, folded: false });
    S.name = ' ';
    expect(newPlayer(S, 0, 1).name).toBe('שחקן');
  });

  it('builds the document paths and the event line', () => {
    const S = table();
    expect([roomPath(S), playerPath(S), playerPath(S, 'p_b')]).toEqual([
      'rooms/ABCD',
      'rooms/ABCD/players/p_me',
      'rooms/ABCD/players/p_b',
    ]);
    expect(eventLine('היד התחילה', 5)).toEqual({ lastEvent: { t: 'היד התחילה', ts: 5 }, updatedAt: 5 });
  });
});

describe('ids', () => {
  it('makes player ids and table codes from the allowed characters', () => {
    expect(randomId(10)).toMatch(/^[a-km-np-z2-9]{10}$/);
    expect(randomCode()).toMatch(/^[A-HJ-NP-Z]{4}$/);
  });
});
