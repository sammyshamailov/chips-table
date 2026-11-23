import { describe, expect, it } from 'vitest';
import type { BjHand, RoomDoc, Seat } from '../types';
import { cancelRound, playerPayout, roundPlayers, settleRound } from './round';

const room: RoomDoc = { roundId: 3, phase: 'playing', house: 1000 };
const seat = (pid: string, hands: BjHand[], o: Partial<Seat> = {}): Seat => ({
  pid,
  stack: 500,
  bjRound: 3,
  hands,
  ...o,
});

describe('playerPayout', () => {
  it('every result: win 1:1, blackjack 3:2, push, lose', () => {
    expect(playerPayout([{ bet: 10, result: 'win' }], 0, false)).toMatchObject({ pay: 20, stake: 10, net: 10 });
    expect(playerPayout([{ bet: 10, result: 'bj' }], 0, false)).toMatchObject({ pay: 25, stake: 10, net: 15 });
    expect(playerPayout([{ bet: 10, result: 'push' }], 0, false)).toMatchObject({ pay: 10, stake: 10, net: 0 });
    expect(playerPayout([{ bet: 10, result: 'lose' }], 0, false)).toMatchObject({ pay: 0, stake: 10, net: -10 });
  });
  it('a surrender counts its returned half (already in the stack) for the net and the house', () => {
    expect(playerPayout([{ bet: 25, result: 'surrender' }], 0, false)).toEqual({
      pay: 0,
      back: 12,
      insPay: 0,
      stake: 25,
      net: -13,
    });
  });
  it('insurance pays 2:1 only when the dealer has blackjack', () => {
    expect(playerPayout([{ bet: 20, result: 'lose' }], 10, true)).toEqual({
      pay: 0,
      back: 0,
      insPay: 30,
      stake: 20,
      net: 0,
    });
    expect(playerPayout([{ bet: 20, result: 'lose' }], 10, false)).toEqual({
      pay: 0,
      back: 0,
      insPay: 0,
      stake: 20,
      net: -30,
    });
  });
  it('skips a spot already paid mid-round', () => {
    expect(playerPayout([{ bet: 10, result: 'bj', paid: true }], 0, false)).toEqual({
      pay: 0,
      back: 0,
      insPay: 0,
      stake: 0,
      net: 0,
    });
  });
});

describe('roundPlayers', () => {
  it('players of this round with an open spot or insurance', () => {
    const list = [
      seat('a', [{ bet: 10 }]),
      seat('b', [{ bet: 10 }], { bjRound: 2 }),
      seat('c', [{ bet: 10, result: 'bj', paid: true }]),
      seat('d', [{ bet: 10, result: 'bj', paid: true }], { insurance: 5 }),
      seat('e', []),
    ];
    expect(roundPlayers(room, list).map(p => p.pid)).toEqual(['a', 'd']);
  });
});

describe('settleRound', () => {
  it('pays each player by their marks and moves the house', () => {
    const list = [
      seat('a', [{ bet: 10 }, { bet: 10 }]),
      seat('b', [{ bet: 20, result: 'surrender' }]),
      seat('c', [{ bet: 30, doubled: true }], { insurance: 0 }),
    ];
    const marks = { 'a:0': 'win', 'a:1': 'push', 'c:0': 'bj' } as const;
    const res = settleRound(room, list, marks, false);
    expect(res).toEqual({
      ok: true,
      writes: [
        {
          pid: 'a',
          stackInc: 30,
          patch: {
            bjPaidRound: 3,
            hands: [
              { bet: 10, result: 'win' },
              { bet: 10, result: 'push' },
            ],
            lastAction: { k: 'bjres', amt: 10 },
          },
        },
        {
          pid: 'b',
          stackInc: 0,
          patch: { bjPaidRound: 3, hands: [{ bet: 20, result: 'surrender' }], lastAction: { k: 'bjres', amt: -10 } },
        },
        {
          pid: 'c',
          stackInc: 75,
          patch: {
            bjPaidRound: 3,
            hands: [{ bet: 30, doubled: true, result: 'bj' }],
            lastAction: { k: 'bjres', amt: 45 },
          },
        },
      ],
      // In 20 + 20 + 30 = 70; out 30 + 10 + 75 = 115.
      room: { phase: 'betting', roundId: 4, dealerBJ: false, roundEnd: 'paid', house: 955 },
      houseDelta: -45,
    });
  });
  it('a stored result wins over a mark', () => {
    const res = settleRound(room, [seat('a', [{ bet: 10, result: 'lose' }])], { 'a:0': 'win' }, false);
    expect(res.ok && res.writes[0].stackInc).toBe(0);
  });
  it('refuses while a hand has no result', () => {
    const list = [seat('a', [{ bet: 10 }, { bet: 10 }])];
    expect(settleRound(room, list, { 'a:0': 'win' }, false)).toEqual({ ok: false, reason: 'unmarked' });
  });
  it('insurance: paid with the dealer blackjack, kept by the house otherwise', () => {
    const list = [seat('a', [{ bet: 20 }], { insurance: 10 })];
    const bj = settleRound(room, list, { 'a:0': 'lose' }, true);
    expect(bj.ok && bj.writes[0]).toMatchObject({ stackInc: 30, patch: { lastAction: { amt: 0 } } });
    expect(bj.ok && bj.houseDelta).toBe(0);
    const no = settleRound(room, list, { 'a:0': 'lose' }, false);
    expect(no.ok && no.writes[0].stackInc).toBe(0);
    expect(no.ok && no.houseDelta).toBe(30);
  });
  it('a blackjack paid mid-round is not paid again, and its player is left alone', () => {
    const list = [seat('a', [{ bet: 10, result: 'bj', paid: true }]), seat('b', [{ bet: 10 }])];
    const res = settleRound(room, list, { 'b:0': 'lose' }, false);
    expect(res.ok && res.writes.map(x => x.pid)).toEqual(['b']);
    expect(res.ok && res.houseDelta).toBe(10);
  });
  it('a paid spot next to an open one (insured player) adds nothing for the paid spot', () => {
    const list = [seat('a', [{ bet: 10, result: 'bj', paid: true }], { insurance: 5 })];
    const res = settleRound(room, list, {}, true);
    expect(res.ok && res.writes[0]).toMatchObject({ stackInc: 15, patch: { lastAction: { amt: 10 } } });
  });
  it('a player already settled by an earlier try is not paid twice, but still counts for the house', () => {
    const list = [seat('a', [{ bet: 10, result: 'win' }], { bjPaidRound: 3 }), seat('b', [{ bet: 10 }])];
    const res = settleRound(room, list, { 'b:0': 'win' }, false);
    expect(res.ok && res.writes.map(x => x.pid)).toEqual(['b']);
    expect(res.ok && res.houseDelta).toBe(-20);
    expect(res.ok && res.room.house).toBe(980);
  });
  it('a room without a round id or house balance', () => {
    const res = settleRound({ phase: 'playing' }, [], {}, false);
    expect(res).toEqual({
      ok: true,
      writes: [],
      room: { phase: 'betting', roundId: 2, dealerBJ: false, roundEnd: 'paid', house: 0 },
      houseDelta: 0,
    });
  });
});

describe('cancelRound', () => {
  it('refunds every open bet and insurance, clears the spots', () => {
    const list = [
      seat('a', [{ bet: 10 }, { bet: 10, doubled: false }]),
      seat('b', [{ bet: 25, result: 'surrender' }], { insurance: 0 }),
      seat('c', [{ bet: 20 }], { insurance: 10 }),
      seat('d', [{ bet: 30 }], { bjRound: 2 }),
    ];
    const clear = (amt: number) => ({ bjPaidRound: 3, hands: [], bjRound: null, lastAction: { k: 'refund', amt } });
    expect(cancelRound(room, list)).toEqual({
      refunds: [
        { pid: 'a', stackInc: 20, patch: clear(20) },
        { pid: 'b', stackInc: 13, patch: clear(13) },
        { pid: 'c', stackInc: 30, patch: clear(30) },
      ],
      room: { phase: 'betting', roundId: 4, roundEnd: 'cancelled' },
    });
  });
  it('a paid blackjack is not refunded; its insured player gets the insurance back', () => {
    const list = [
      seat('a', [{ bet: 10, result: 'bj', paid: true }]),
      seat('b', [{ bet: 10, result: 'bj', paid: true }], { insurance: 5 }),
    ];
    expect(cancelRound(room, list).refunds).toEqual([
      {
        pid: 'b',
        stackInc: 5,
        patch: { bjPaidRound: 3, hands: [], bjRound: null, lastAction: { k: 'refund', amt: 5 } },
      },
    ]);
  });
  it('skips players already refunded by an earlier try', () => {
    const list = [seat('a', [{ bet: 10 }], { bjPaidRound: 3 }), seat('b', [{ bet: 10 }])];
    expect(cancelRound(room, list).refunds.map(x => x.pid)).toEqual(['b']);
  });
});
