// diffPlayers / diffRoom: old and new documents → the events the effects play. Every branch the old fxBJ, fxHold and
// fxRoom handled, plus the cases that must stay silent.
import { describe, expect, it } from 'vitest';
import type { BjHand, PlayerDoc, RoomDoc } from '../domain/types';
import { diffPlayers, diffRoom } from './diff';

const ME = 'p_me',
  YOU = 'p_you';
const BJ_ROOM: RoomDoc = { code: 'ABCD', game: 'blackjack', roundId: 3, phase: 'playing', handId: 0, stage: 'idle' };
const HOLD_ROOM: RoomDoc = { code: 'ABCD', game: 'holdem', handId: 7, stage: 'flop', roundId: 1, phase: 'betting' };

const player = (o: PlayerDoc = {}): PlayerDoc => ({ name: 'x', stack: 1000, ts: 1, lastAction: null, hands: [], ...o });
/** One player's change: `before` → `after` (the new one gets ts 2). */
function change(before: PlayerDoc, after: PlayerDoc, room: RoomDoc = BJ_ROOM, pid = YOU, myId = ME) {
  return diffPlayers({ [pid]: player(before) }, { [pid]: player({ ...after, ts: 2 }) }, room, { myId });
}
const hand = (bet: number, o: Partial<BjHand> = {}): BjHand => ({ bet, ...o });

describe('diffPlayers: when nothing is sent', () => {
  it('without a room, or for a table this build does not play', () => {
    const a = { [YOU]: player() },
      b = { [YOU]: player({ ts: 2, lastAction: { k: 'check' } }) };
    expect(diffPlayers(a, b, null, { myId: ME })).toEqual([]);
    expect(diffPlayers(a, b, { ...HOLD_ROOM, appMin: 99 }, { myId: ME })).toEqual([]);
    expect(diffPlayers(a, b, { ...HOLD_ROOM, mode: 'cards' }, { myId: ME })).toEqual([]);
    expect(diffPlayers(a, b, HOLD_ROOM, { myId: ME })).toHaveLength(1);
  });
  it('for a phone that has just joined (no old copy: no replay) or a player who just sat down', () => {
    const b = { [YOU]: player({ ts: 2, lastAction: { k: 'check' } }) };
    expect(diffPlayers({}, b, HOLD_ROOM, { myId: ME })).toEqual([]);
  });
  it('when ts did not change, or there is no lastAction', () => {
    const p = player({ lastAction: { k: 'check' } });
    expect(diffPlayers({ [YOU]: p }, { [YOU]: { ...p, stack: 5 } }, HOLD_ROOM, { myId: ME })).toEqual([]);
    expect(diffPlayers({ [YOU]: player() }, { [YOU]: player({ ts: 2 }) }, HOLD_ROOM, { myId: ME })).toEqual([]);
    expect(
      diffPlayers({ [YOU]: { stack: 5 } }, { [YOU]: { stack: 5, lastAction: { k: 'check' } } }, HOLD_ROOM, {
        myId: ME,
      }),
    ).toEqual([]); // ts missing on both = same
  });
  it('for an action this build does not know', () => {
    expect(change({}, { lastAction: { k: 'dance' } }, HOLD_ROOM)).toEqual([]);
    expect(change({}, { lastAction: { k: 'dance' } }, BJ_ROOM)).toEqual([]);
  });
  it('a player who left is not an event', () => {
    expect(diffPlayers({ [YOU]: player() }, {}, HOLD_ROOM, { myId: ME })).toEqual([]);
  });
});

describe('diffPlayers: several players', () => {
  it('one event per changed player, in document order, mine marked', () => {
    const old = { [YOU]: player(), [ME]: player(), p_c: player() };
    const nw = {
      [YOU]: player({ ts: 2, lastAction: { k: 'fold' } }),
      [ME]: player({ ts: 3, lastAction: { k: 'check' } }),
      p_c: player(),
    };
    expect(diffPlayers(old, nw, HOLD_ROOM, { myId: ME })).toEqual([
      { type: 'Folded', pid: YOU, mine: false },
      { type: 'Checked', pid: ME, mine: true },
    ]);
  });
});

describe("diffPlayers: Hold'em", () => {
  it('blind, call, bet and raise move the stack difference into the pot, with the exact chips when they add up', () => {
    for (const [k, type] of [
      ['blind', 'BlindPosted'],
      ['call', 'Called'],
      ['bet', 'BetMade'],
      ['raise', 'Raised'],
    ] as const) {
      expect(change({ stack: 100 }, { stack: 70, lastAction: { k, amt: 30, chips: [25, 5] } }, HOLD_ROOM)).toEqual([
        { type, pid: YOU, mine: false, amount: 30, chips: [25, 5] },
      ]);
      expect(change({ stack: 100 }, { stack: 70, lastAction: { k, amt: 30, chips: [25] } }, HOLD_ROOM)).toEqual([
        { type, pid: YOU, mine: false, amount: 30, chips: 30 },
      ]);
      expect(change({ stack: 100 }, { stack: 100, lastAction: { k, amt: 0 } }, HOLD_ROOM)).toEqual([]);
    }
  });
  it('all-in is always sent (the narration), with the hand and what moved', () => {
    expect(change({ stack: 40 }, { stack: 0, lastAction: { k: 'allin', amt: 40 } }, HOLD_ROOM, YOU, YOU)).toEqual([
      { type: 'WentAllIn', pid: YOU, mine: true, amount: 40, chips: 40, handId: 7 },
    ]);
    expect(change({ stack: 0 }, { stack: 0, lastAction: { k: 'allin', amt: 0 } }, HOLD_ROOM)).toEqual([
      { type: 'WentAllIn', pid: YOU, mine: false, amount: 0, chips: 0, handId: 7 },
    ]);
    expect(change({}, { stack: 0, lastAction: { k: 'allin' } }, { ...HOLD_ROOM, handId: undefined })[0]).toMatchObject({
      handId: 0,
      amount: 1000,
    });
  });
  it('won and refund bring chips back from the pot, only when the stack grew', () => {
    expect(change({ stack: 10 }, { stack: 130, lastAction: { k: 'won', amt: 120 } }, HOLD_ROOM)).toEqual([
      { type: 'PotWon', pid: YOU, mine: false, amount: 120, stackBefore: 10 },
    ]);
    expect(change({ stack: 10 }, { stack: 25, lastAction: { k: 'refund', amt: 15 } }, HOLD_ROOM)).toEqual([
      { type: 'HandRefunded', pid: YOU, mine: false, amount: 15, stackBefore: 10 },
    ]);
    expect(change({ stack: 10 }, { stack: 5, lastAction: { k: 'refund', amt: -5 } }, HOLD_ROOM)).toEqual([]);
  });
  it('check and fold', () => {
    expect(change({}, { lastAction: { k: 'check' } }, HOLD_ROOM)).toEqual([{ type: 'Checked', pid: YOU, mine: false }]);
    expect(change({}, { lastAction: { k: 'fold' } }, HOLD_ROOM)).toEqual([{ type: 'Folded', pid: YOU, mine: false }]);
  });
  it('does not mistake inherited names for actions', () => {
    expect(change({}, { lastAction: { k: 'toString' } }, HOLD_ROOM)).toEqual([]);
  });
});

describe('diffPlayers: Blackjack bets', () => {
  it('a first bet in the round: the chips added, the spots before empty', () => {
    const ev = change(
      { bjRound: 2, hands: [hand(50, { result: 'win' })] },
      { bjRound: 3, hands: [hand(30, { chips: [25, 5] })], lastAction: { k: 'bet', amt: 30 } },
    );
    expect(ev).toEqual([{ type: 'BetPlaced', pid: YOU, mine: false, amount: 30, prevHands: [], added: [25, 5] }]);
  });
  it('adding to a bet: only the new chips, when the new stack starts with the old one', () => {
    const before = [hand(30, { chips: [25, 5] })];
    expect(
      change(
        { bjRound: 3, hands: before },
        { bjRound: 3, hands: [hand(40, { chips: [25, 5, 10] })], lastAction: { k: 'bet' } },
      ),
    ).toEqual([{ type: 'BetPlaced', pid: YOU, mine: false, amount: 10, prevHands: before, added: [10] }]);
    // the stack was rebuilt (different order): the amount instead
    expect(
      change(
        { bjRound: 3, hands: before },
        { bjRound: 3, hands: [hand(40, { chips: [10, 25, 5] })], lastAction: { k: 'bet' } },
      )[0],
    ).toMatchObject({ added: 10 });
    // stacks stored as amounts only: the amount
    expect(
      change({ bjRound: 3, hands: [hand(30)] }, { bjRound: 3, hands: [hand(40)], lastAction: { k: 'bet' } })[0],
    ).toMatchObject({ added: 10 });
  });
  it('my own bet is marked mine; a bet that did not grow is nothing', () => {
    expect(change({}, { bjRound: 3, hands: [hand(10)], lastAction: { k: 'bet' } }, BJ_ROOM, YOU, YOU)[0]).toMatchObject(
      {
        mine: true,
        added: 10, // no stored chips: the amount
      },
    );
    expect(
      change({ bjRound: 3, hands: [hand(10)] }, { bjRound: 3, hands: [hand(10)], lastAction: { k: 'bet' } }),
    ).toEqual([]);
  });
  it('clear: the bet back to the stack (exact chips for one spot)', () => {
    expect(
      change({ stack: 970, hands: [hand(30, { chips: [25, 5] })] }, { hands: [], lastAction: { k: 'clear' } }),
    ).toEqual([{ type: 'BetCleared', pid: YOU, mine: false, amount: 30, chips: [25, 5], stackBefore: 970 }]);
    expect(change({ hands: [hand(30), hand(20)] }, { hands: [], lastAction: { k: 'clear' } })[0]).toMatchObject({
      chips: 50,
    });
    expect(change({ hands: [] }, { hands: [], lastAction: { k: 'clear' } })).toEqual([]);
  });
});

describe('diffPlayers: Blackjack plays', () => {
  it('double: the spot that became doubled, with its halves', () => {
    const B = [hand(10), hand(20, { doubled: true, chips: [5, 5, 5, 5] })];
    expect(
      change({ hands: [hand(10), hand(10, { chips: [5, 5] })] }, { hands: B, lastAction: { k: 'double' } }),
    ).toEqual([
      {
        type: 'HandDoubled',
        pid: YOU,
        mine: false,
        index: 1,
        hands: B,
        halves: [
          [5, 5],
          [5, 5],
        ],
      },
    ]);
    expect(change({ hands: B }, { hands: B, lastAction: { k: 'double' } })).toEqual([]);
  });
  it('split: the spot that split, and the chips of the two halves', () => {
    const B = [hand(10, { split: true }), hand(10, { split: true, chips: [5, 5] })];
    expect(change({ hands: [hand(10)] }, { hands: B, lastAction: { k: 'split' } })).toEqual([
      { type: 'HandSplit', pid: YOU, mine: false, index: 0, hands: B, chips: [10, [5, 5]] },
    ]);
    // splitting the second of two spots
    const B2 = [hand(5), hand(10, { split: true }), hand(10, { split: true })];
    expect(change({ hands: [hand(5), hand(10)] }, { hands: B2, lastAction: { k: 'split' } })[0]).toMatchObject({
      index: 1,
    });
    // a re-split of an already split hand: the spot before the first difference
    const A3 = [hand(10, { split: true }), hand(10, { split: true })],
      B3 = [hand(10, { split: true }), hand(10, { split: true }), hand(10, { split: true })];
    expect(change({ hands: A3 }, { hands: B3, lastAction: { k: 'split' } })[0]).toMatchObject({ index: 1 });
    expect(change({ hands: B }, { hands: B, lastAction: { k: 'split' } })).toEqual([]);
  });
  it('split from nothing (a damaged document) does not throw', () => {
    expect(change({ hands: [] }, { hands: [hand(10)], lastAction: { k: 'split' } })[0]).toMatchObject({
      index: 0,
      chips: [10, 0],
    });
  });
  it('insurance', () => {
    expect(change({}, { insurance: 5, lastAction: { k: 'ins' } })).toEqual([
      { type: 'InsuranceTaken', pid: YOU, mine: false, amount: 5 },
    ]);
    expect(change({}, { insurance: 0, lastAction: { k: 'ins' } })).toEqual([]);
  });
  it('surrender: half back, rounded down; nothing when that is 0 or there is no spot', () => {
    expect(
      change({ stack: 900 }, { hands: [hand(25, { result: 'surrender' })], lastAction: { k: 'surrender' } }),
    ).toEqual([{ type: 'Surrendered', pid: YOU, mine: false, returned: 12, stackBefore: 900 }]);
    expect(change({}, { hands: [hand(1)], lastAction: { k: 'surrender' } })).toEqual([]);
    expect(change({}, { hands: [], lastAction: { k: 'surrender' } })).toEqual([]);
  });
  it('a blackjack paid mid-round: always sent, with the spot as it was', () => {
    expect(
      change(
        { stack: 970, hands: [hand(30, { chips: [25, 5] })] },
        { hands: [hand(30, { paid: true })], lastAction: { k: 'bjpay', amt: 45 } },
      ),
    ).toEqual([
      {
        type: 'BlackjackPaid',
        pid: YOU,
        mine: false,
        hand: hand(30, { chips: [25, 5] }),
        chips: [25, 5],
        win: 45,
        stackBefore: 970,
      },
    ]);
    expect(change({ hands: [] }, { lastAction: { k: 'bjpay' } })).toEqual([
      { type: 'BlackjackPaid', pid: YOU, mine: false, hand: null, chips: 0, win: 0, stackBefore: 1000 },
    ]);
  });
});

describe('diffPlayers: the end of a Blackjack round', () => {
  it('settled: each unpaid spot with its result and pay, the totals, and whether chips come back', () => {
    const A = [hand(10, { chips: [5, 5] }), hand(20), hand(30), hand(40), hand(25), hand(10, { paid: true })];
    const B = [
      hand(10, { result: 'win' }),
      hand(20, { result: 'lose' }),
      hand(30, { result: 'bj' }),
      hand(40, { result: 'push' }),
      hand(25, { result: 'surrender' }),
      hand(10, { paid: true, result: 'bj' }),
    ];
    const [ev] = change(
      { stack: 800, insurance: 5, hands: A },
      { hands: B, lastAction: { k: 'bjres', amt: 7 } },
      BJ_ROOM,
      YOU,
      YOU,
    );
    expect(ev).toEqual({
      type: 'HandsSettled',
      pid: YOU,
      mine: true,
      handsBefore: A,
      settled: [
        { index: 0, result: 'win', chips: [5, 5], pay: 10 },
        { index: 1, result: 'lose', chips: 20, pay: 0 },
        { index: 2, result: 'bj', chips: 30, pay: 45 },
        { index: 3, result: 'push', chips: 40, pay: 0 },
        { index: 4, result: 'surrender', chips: 25, pay: 0 },
      ],
      handsNet: 10 - 20 + 45 - 13,
      anyBlackjack: true,
      insurance: 5,
      insuranceWon: false,
      net: 7,
      chipsReturn: true,
      stackBefore: 800,
    });
  });
  it('insurance that pays, a spot without a result, a spot the old copy did not have', () => {
    const [ev] = change(
      { insurance: 5, hands: [hand(10)] },
      { hands: [hand(10, { result: 'lose' }), hand(5)], lastAction: { k: 'bjres', amt: 0 } },
    );
    expect(ev).toMatchObject({
      settled: [
        { index: 0, result: 'lose', chips: 10, pay: 0 },
        { index: 1, result: null, chips: 5, pay: 0 },
      ],
      handsNet: -10,
      insuranceWon: true,
      chipsReturn: true,
      anyBlackjack: false,
    });
  });
  it('all lost: the final count does not wait', () => {
    const [ev] = change(
      { hands: [hand(10)] },
      { hands: [hand(10, { result: 'lose' })], lastAction: { k: 'bjres', amt: -10 } },
    );
    expect(ev).toMatchObject({ chipsReturn: false, insurance: 0, insuranceWon: false, net: -10 });
    expect(change({ hands: [hand(10)] }, { hands: [], lastAction: { k: 'bjres' } })).toEqual([]);
  });
  it('a cancelled round: the unpaid bets back from their spots, and the insurance', () => {
    const A = [hand(10, { chips: [5, 5] }), hand(30, { paid: true }), hand(20)];
    expect(change({ stack: 900, insurance: 5, hands: A }, { hands: [], lastAction: { k: 'refund', amt: 35 } })).toEqual(
      [
        {
          type: 'RoundRefunded',
          pid: YOU,
          mine: false,
          handsBefore: A,
          bets: [
            { index: 0, chips: [5, 5] },
            { index: 2, chips: 20 },
          ],
          insurance: 5,
          stackBefore: 900,
        },
      ],
    );
  });
  it("the dealer's correction: chips given or taken; nothing for 0", () => {
    expect(change({ stack: 900 }, { lastAction: { k: 'refund', amt: 100 } })).toEqual([
      { type: 'Refunded', pid: YOU, mine: false, amount: 100, stackBefore: 900 },
    ]);
    expect(change({}, { lastAction: { k: 'refund', amt: -50 } })[0]).toMatchObject({ type: 'Refunded', amount: -50 });
    expect(change({}, { lastAction: { k: 'refund' } })).toEqual([]);
    // spots still there (a correction mid-round): a correction, not a cancelled round
    expect(change({ hands: [hand(10)] }, { hands: [hand(10)], lastAction: { k: 'refund', amt: 5 } })[0]).toMatchObject({
      type: 'Refunded',
    });
  });
  it("a Blackjack action at a Hold'em table is read with Hold'em rules (nothing)", () => {
    expect(change({}, { lastAction: { k: 'ins' }, insurance: 5 }, HOLD_ROOM)).toEqual([]);
  });
});

describe('diffRoom', () => {
  const ctx = { myId: ME, players: {} };
  it('nothing for the first copy, another table, or a table this build does not play', () => {
    const b = { ...BJ_ROOM, closed: true, final: { at: 1, list: [] } };
    expect(diffRoom(null, b, ctx)).toEqual([]);
    expect(diffRoom(BJ_ROOM, null, ctx)).toEqual([]);
    expect(diffRoom({ ...BJ_ROOM, code: 'WXYZ' }, b, ctx)).toEqual([]);
    expect(diffRoom(BJ_ROOM, { ...b, appMin: 2 }, ctx)).toEqual([]);
    expect(diffRoom(BJ_ROOM, BJ_ROOM, ctx)).toEqual([]);
  });
  it('the game ended: closed with the standings', () => {
    const final = { at: 1, list: [{ pid: ME, name: 'x', stack: 5 }] };
    expect(diffRoom(BJ_ROOM, { ...BJ_ROOM, closed: true, final }, ctx)).toEqual([{ type: 'GameEnded' }]);
    expect(diffRoom(BJ_ROOM, { ...BJ_ROOM, closed: true, final: null }, ctx)).toEqual([]);
    expect(diffRoom({ ...BJ_ROOM, closed: true }, { ...BJ_ROOM, closed: true, final }, ctx)).toEqual([]);
  });
  it('bets locked: every player in the round, in seat order, with their spots', () => {
    const players = {
      p_late: { joinedAt: 9, bjRound: 3, hands: [hand(10), hand(10)] },
      p_out: { joinedAt: 1, bjRound: 2, hands: [hand(10)] },
      p_none: { joinedAt: 2, bjRound: 3, hands: [] },
      p_first: { joinedAt: 3, bjRound: 3, hands: [hand(5)] },
      p_zero: { bjRound: 3, hands: [hand(5)] },
    };
    const a = { ...BJ_ROOM, phase: 'betting' };
    expect(diffRoom(a, BJ_ROOM, { myId: ME, players })).toEqual([
      {
        type: 'BetsLocked',
        roundId: 3,
        spots: [
          { pid: 'p_zero', count: 1 },
          { pid: 'p_first', count: 1 },
          { pid: 'p_late', count: 2 },
        ],
      },
    ]);
    expect(diffRoom(a, { ...BJ_ROOM, roundId: 4 }, ctx)).toEqual([]); // a new round, not a lock
    expect(diffRoom({ ...a, game: 'holdem' }, { ...BJ_ROOM, game: 'holdem' }, ctx)).toEqual([]);
  });
  it('a round paid: by roundEnd, or by the event text when an older phone paid it; not a cancelled round', () => {
    const a = { ...BJ_ROOM, phase: 'playing', roundId: 3 },
      b = { ...BJ_ROOM, phase: 'betting', roundId: 4 };
    expect(diffRoom(a, { ...b, roundEnd: 'paid' }, ctx)).toEqual([{ type: 'RoundPaid', roundId: 3 }]);
    // What older phones wrote, in Hebrew: "round 3 paid · house +10" and "the round was cancelled", spelled with escapes
    // because Hebrew letters live only in src/i18n/he.ts.
    const paid = '\u05e1\u05d9\u05d1\u05d5\u05d1 3 \u05e9\u05d5\u05dc\u05dd',
      cancelled = '\u05d4\u05e1\u05d9\u05d1\u05d5\u05d1 \u05d1\u05d5\u05d8\u05dc';
    expect(diffRoom(a, { ...b, roundEnd: 'cancelled', lastEvent: { t: paid, ts: 1 } }, ctx)).toEqual([]);
    expect(diffRoom(a, { ...b, lastEvent: { t: paid + ' · +10', ts: 1 } }, ctx)).toEqual([
      { type: 'RoundPaid', roundId: 3 },
    ]);
    expect(diffRoom(a, { ...b, lastEvent: { t: cancelled, ts: 1 } }, ctx)).toEqual([]);
    expect(diffRoom(a, { ...b, lastEvent: null }, ctx)).toEqual([]);
    expect(diffRoom(a, { ...b, roundId: 3, roundEnd: 'paid' }, ctx)).toEqual([]);
    expect(diffRoom({ ...a, game: 'holdem' }, { ...b, roundEnd: 'paid' }, ctx)).toEqual([]);
  });
  it("Hold'em: a new hand, or the flop, turn and river", () => {
    expect(diffRoom(HOLD_ROOM, { ...HOLD_ROOM, handId: 8, stage: 'preflop' }, ctx)).toEqual([
      { type: 'HandStarted', handId: 8 },
    ]);
    expect(diffRoom({ ...HOLD_ROOM, handId: undefined }, { ...HOLD_ROOM, handId: undefined }, ctx)).toEqual([]);
    for (const stage of ['flop', 'turn', 'river'] as const)
      expect(diffRoom({ ...HOLD_ROOM, stage: 'x' }, { ...HOLD_ROOM, stage }, ctx)).toEqual([
        { type: 'StreetDealt', stage },
      ]);
    expect(diffRoom(HOLD_ROOM, { ...HOLD_ROOM, stage: 'showdown' }, ctx)).toEqual([]);
    expect(diffRoom(HOLD_ROOM, { ...HOLD_ROOM, stage: 'idle' }, ctx)).toEqual([]);
    expect(diffRoom({ ...BJ_ROOM, stage: 'idle' }, { ...BJ_ROOM, stage: 'flop' }, ctx)).toEqual([]);
  });
  it('several at once, in the order the effects always ran: the ceremony first', () => {
    const final = { at: 1, list: [] };
    expect(
      diffRoom({ ...HOLD_ROOM, handId: 1 }, { ...HOLD_ROOM, handId: 2, closed: true, final }, ctx).map(e => e.type),
    ).toEqual(['GameEnded', 'HandStarted']);
  });
});
