import { describe, expect, it } from 'vitest';
import { normalizePlayer, normalizeRoom } from '../../../data/schema';
import { blackjackEligible, isCurrent } from '../../../domain/blackjack/rules';
import type { Override } from '../../../fx/layer';
import type { SeatView, Session } from '../../session';
import { blackjackDockProps, blackjackHostProps, blackjackTableProps, seatView } from './select';

// A session over plain documents, with the effects layer's answers given per test.
function session(
  room: Record<string, unknown>,
  players: Record<string, Record<string, unknown>>,
  { myId = 'a', mode = 'cloud', ov = {} as Record<string, Override>, ghost = [] as number[], pending = 0 } = {},
): Session {
  const r = normalizeRoom({
    code: 'ABCD',
    game: 'blackjack',
    hostId: 'h',
    hostName: 'דנה',
    roundId: 3,
    minBet: 10,
    ...room,
  });
  const ps: SeatView[] = Object.entries(players).map(([pid, d]) => ({ pid, ...normalizePlayer({ name: pid, ...d }) }));
  const state = { myId, mode, room: r, players: {}, pending } as unknown as Session['state'];
  return {
    state,
    fx: {
      ov: pid => ov[pid] || null,
      shownStack: p => (ov[p.pid] && ov[p.pid].stack != null ? (ov[p.pid].stack as number) : (p.stack as number)),
      ghost: () => ghost,
      signDrop: () => false,
    },
    denoms: () => [5, 10, 25],
    players: () => ps,
    me: () => ps.find(p => p.pid === myId) || null,
    bjCurrent: p => isCurrent(p, r),
    bjEligible: p => blackjackEligible(p, r),
    looksClosed: () => false,
  } as Session;
}
const hand = (bet: number, more = {}) => ({ bet, ...more });
const seat = (s: Session, pid: string) => seatView(s, s.players().find(p => p.pid === pid) as SeatView);

describe('Blackjack table: what each seat shows', () => {
  it("shows this round's hands and insurance", () => {
    const s = session({}, { a: { bjRound: 3, hands: [hand(20), hand(20)], insurance: 10, stack: 100 } });
    expect(seat(s, 'a')).toMatchObject({ hands: [{ bet: 20 }, { bet: 20 }], ins: 10, stack: 100, result: null });
  });
  it("keeps last round's hands on the felt while any is still being paid, and clears them after", () => {
    const paying = session({}, { a: { bjRound: 2, hands: [hand(20, { result: 'win' }), hand(20)], insurance: 5 } });
    expect(seat(paying, 'a')).toMatchObject({ hands: [{ bet: 20 }, { bet: 20 }], ins: 5 });
    const done = session({}, { a: { bjRound: 2, hands: [hand(20, { result: 'win' })], insurance: 5 } });
    expect(seat(done, 'a')).toMatchObject({ hands: [], ins: 0 });
    const old = session({}, { a: { bjRound: 1, hands: [hand(20)] } });
    expect(seat(old, 'a').hands).toEqual([]);
  });
  it("draws an override's hands, insurance and stack while chips fly", () => {
    const s = session(
      {},
      { a: { bjRound: 3, hands: [hand(40)], insurance: 0, stack: 60 } },
      {
        ov: { a: { hands: [{ bet: 20 }], ins: 0, stack: 80 } },
      },
    );
    expect(seat(s, 'a')).toMatchObject({ hands: [{ bet: 20 }], ins: 0, stack: 80 });
  });
  it("shows last round's result once paid, not while hidden for the payout, not in a new bet", () => {
    const paid = { bjRound: 2, hands: [hand(20, { result: 'win' })], lastAction: { k: 'bjres', amt: 20 } };
    expect(seat(session({}, { a: paid }), 'a').result).toBe(20);
    expect(seat(session({}, { a: { ...paid, lastAction: { k: 'bjpay', amt: 30 } } }), 'a').result).toBe(30);
    expect(seat(session({}, { a: { ...paid, lastAction: { k: 'bjres' } } }), 'a').result).toBe(0);
    expect(seat(session({}, { a: paid }, { ov: { a: { hideRes: true } } }), 'a').result).toBeNull();
    expect(seat(session({}, { a: { ...paid, lastAction: { k: 'refund', amt: 20 } } }), 'a').result).toBeNull();
    expect(seat(session({}, { a: { ...paid, bjRound: 1 } }), 'a').result).toBeNull();
    expect(seat(session({}, { a: { ...paid, bjRound: 3, hands: [hand(10)] } }), 'a').result).toBeNull();
  });
  it('lets you tap another seat to play as them on one phone, your own for your picture, nothing on a shared table', () => {
    const docs = { a: {}, b: {} };
    expect(seat(session({}, docs, { mode: 'local' }), 'b').tap).toBe('claim');
    expect(seat(session({}, docs, { mode: 'local' }), 'a').tap).toBe('avatar');
    expect(seat(session({}, docs), 'a').tap).toBe('avatar');
    expect(seat(session({}, docs), 'b').tap).toBeNull();
  });
  it('puts your chips in hand on your own spot while bets are open', () => {
    const docs = { a: {}, b: {} };
    expect(seat(session({}, docs, { ghost: [5, 5] }), 'a')).toMatchObject({ ghost: [5, 5], betting: true });
    expect(seat(session({}, docs, { ghost: [5] }), 'b').ghost).toBeNull();
    expect(seat(session({ phase: 'playing' }, docs, { ghost: [5] }), 'a').ghost).toBeNull();
  });
  it('greys out a seat without a bet once the cards are dealt', () => {
    const docs = { a: { bjRound: 3, hands: [hand(10)] }, b: {} };
    expect(seat(session({ phase: 'playing' }, docs), 'a').out).toBe(false);
    expect(seat(session({ phase: 'playing' }, docs), 'b').out).toBe(true);
    expect(seat(session({}, docs), 'b').out).toBe(false);
  });
});

describe('Blackjack table, dock and dealer controls', () => {
  const docs = {
    a: { bjRound: 3, hands: [hand(20), hand(20, { doubled: true })], insurance: 10, stack: 70 },
    b: { bjRound: 3, hands: [hand(15)] },
    c: { bjRound: 2, hands: [hand(50)] },
  };
  it('counts the bettors and the chips on the felt (bets and insurance)', () => {
    const t = blackjackTableProps(session({ phase: 'playing', house: -40 }, docs));
    expect(t).toMatchObject({
      bettors: 2,
      onFelt: 65,
      house: -40,
      betting: false,
      hostName: 'דנה',
      denoms: [5, 10, 25],
    });
    expect(t.seats.map(x => x.pid)).toEqual(['a', 'b', 'c']);
    expect(blackjackTableProps(session({ hostName: '' }, {})).hostName).toBe('הדילר');
  });
  it('gives the dock your hands only when you bet this round', () => {
    expect(blackjackDockProps(session({ phase: 'playing' }, docs))).toMatchObject({
      hands: [{ bet: 20 }, { bet: 20 }],
      insurance: 10,
      realStack: 70,
      betting: false,
    });
    expect(blackjackDockProps(session({}, docs, { myId: 'c', pending: 25 }))).toMatchObject({
      hands: [],
      pending: 25,
      minBet: 10,
      betting: true,
    });
  });
  it('offers the dealer a blackjack payment only when someone is eligible', () => {
    expect(blackjackHostProps(session({ phase: 'playing' }, docs))).toEqual({
      betting: false,
      bettors: 2,
      canPayNow: true,
    });
    expect(blackjackHostProps(session({}, { c: docs.c })).canPayNow).toBe(false);
  });
});
