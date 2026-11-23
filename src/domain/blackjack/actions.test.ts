import { describe, expect, it } from 'vitest';
import { MAX_CHIPS } from '../chips';
import type { BjHand, PlayerDoc, RoomDoc } from '../types';
import { clearBet, payBlackjackNow, placeBet, play } from './actions';
import { MAX_HANDS } from './rules';

const betting: RoomDoc = { roundId: 3, phase: 'betting', minBet: 10, maxBet: 500, house: 100 };
const playing: RoomDoc = { ...betting, phase: 'playing' };
const bettor = (hands: BjHand[], stack = 200, o: PlayerDoc = {}): PlayerDoc => ({ stack, bjRound: 3, hands, ...o });

describe('placeBet', () => {
  it('a first bet with the exact chips in hand', () => {
    expect(placeBet({ stack: 200 }, betting, 35, [25, 10])).toEqual({
      ok: true,
      add: 35,
      patch: {
        stack: 165,
        bjRound: 3,
        hands: [{ bet: 35, chips: [25, 10] }],
        insurance: 0,
        surrendered: false,
        lastAction: { k: 'bet', amt: 35 },
      },
    });
  });
  it('adding to a bet keeps the earlier chips underneath', () => {
    const res = placeBet(bettor([{ bet: 20, chips: [10, 10] }]), betting, 5, [5]);
    expect(res.ok && res.patch.hands).toEqual([{ bet: 25, chips: [10, 10, 5] }]);
    expect(res.ok && res.patch.lastAction).toEqual({ k: 'bet', amt: 25 });
  });
  it('makes up chips that do not add up from the amount', () => {
    const res = placeBet(bettor([{ bet: 20, chips: [25] }]), betting, 30, [10]);
    expect(res.ok && res.patch.hands).toEqual([{ bet: 50, chips: [10, 10, 25, 5] }]);
  });
  it('a bet from an earlier round is replaced, not added to', () => {
    const res = placeBet(bettor([{ bet: 20 }], 200, { bjRound: 2 }), betting, 15);
    expect(res.ok && res.patch.hands).toEqual([{ bet: 15, chips: [10, 5] }]);
  });
  it('leaves the chips out when there would be too many', () => {
    const ones = Array(MAX_CHIPS).fill(1);
    const res = placeBet(bettor([{ bet: MAX_CHIPS, chips: ones }]), { ...betting, minBet: 1 }, 1, [1]);
    expect(res.ok && res.patch.hands).toEqual([{ bet: MAX_CHIPS + 1 }]);
  });
  it('caps at the stack', () => {
    const res = placeBet({ stack: 30 }, betting, 100);
    expect(res.ok && res.add).toBe(30);
    expect(res.ok && res.patch.stack).toBe(0);
  });
  it('refuses outside the limits', () => {
    expect(placeBet({ stack: 1000 }, betting, 600)).toEqual({ ok: false, reason: 'over-max' });
    expect(placeBet(bettor([{ bet: 490 }]), betting, 20)).toEqual({ ok: false, reason: 'over-max' });
    expect(placeBet({ stack: 1000 }, betting, 5)).toEqual({ ok: false, reason: 'under-min' });
    expect(placeBet({ stack: 1000 }, { ...betting, maxBet: 0 }, 900).ok).toBe(true);
  });
  it('refuses with nothing to add, an empty stack, no player or closed bets', () => {
    expect(placeBet({ stack: 100 }, betting, 0)).toEqual({ ok: false, reason: 'nothing-to-add' });
    expect(placeBet({ stack: 0 }, betting, 50)).toEqual({ ok: false, reason: 'nothing-to-add' });
    expect(placeBet(null, betting, 50)).toEqual({ ok: false, reason: 'not-betting' });
    expect(placeBet({ stack: 100 }, playing, 50)).toEqual({ ok: false, reason: 'not-betting' });
  });
});

describe('clearBet', () => {
  it('returns every spot to the stack', () => {
    expect(clearBet(bettor([{ bet: 40 }], 160), betting)).toEqual({
      ok: true,
      patch: { stack: 200, bjRound: null, hands: [], lastAction: { k: 'clear' } },
    });
  });
  it('only with a bet this round, while bets are open', () => {
    expect(clearBet({ stack: 100 }, betting)).toEqual({ ok: false, reason: 'no-bet' });
    expect(clearBet(bettor([{ bet: 40 }]), playing)).toEqual({ ok: false, reason: 'not-betting' });
  });
});

describe('double', () => {
  it('takes the bet again and doubles the chips', () => {
    const res = play(bettor([{ bet: 30, chips: [25, 5] }], 100), playing, 'double', 0);
    expect(res).toEqual({
      ok: true,
      patch: { stack: 70, hands: [{ bet: 60, doubled: true, chips: [25, 5, 25, 5] }], lastAction: { k: 'double' } },
    });
  });
  it('drops the chips when doubling them would be too many, or they did not add up', () => {
    const many = Array(MAX_CHIPS / 2 + 1).fill(1);
    const res = play(bettor([{ bet: many.length, chips: many }]), playing, 'double', 0);
    expect(res.ok && res.patch.hands[0]).toEqual({ bet: many.length * 2, doubled: true });
    const bad = play(bettor([{ bet: 30, chips: [25] }]), playing, 'double', 0);
    expect(bad.ok && bad.patch.hands[0]).toEqual({ bet: 60, doubled: true });
  });
  it('doubles the spot asked for after a split', () => {
    const res = play(
      bettor([
        { bet: 10, split: true },
        { bet: 10, split: true },
      ]),
      playing,
      'double',
      1,
    );
    expect(res.ok && res.patch.hands).toEqual([
      { bet: 10, split: true },
      { bet: 20, split: true, doubled: true },
    ]);
  });
  it('refuses without the chips, twice, or on a finished spot', () => {
    expect(play(bettor([{ bet: 30 }], 29), playing, 'double', 0)).toEqual({ ok: false, reason: 'not-enough-chips' });
    expect(play(bettor([{ bet: 30 }], 30), playing, 'double', 0).ok).toBe(true);
    expect(play(bettor([{ bet: 60, doubled: true }]), playing, 'double', 0)).toEqual({
      ok: false,
      reason: 'already-doubled',
    });
    expect(play(bettor([{ bet: 30, result: 'surrender' }]), playing, 'double', 0)).toEqual({
      ok: false,
      reason: 'hand-done',
    });
  });
  it('does not change the stored hands', () => {
    const hands = [{ bet: 30, chips: [25, 5] }];
    play(bettor(hands), playing, 'double', 0);
    expect(hands).toEqual([{ bet: 30, chips: [25, 5] }]);
  });
});

describe('split', () => {
  it('adds a spot with the same bet and chips right after this one', () => {
    const res = play(bettor([{ bet: 20, chips: [10, 10] }], 100), playing, 'split', 0);
    expect(res).toEqual({
      ok: true,
      patch: {
        stack: 80,
        hands: [
          { bet: 20, chips: [10, 10], split: true },
          { bet: 20, chips: [10, 10], split: true },
        ],
        lastAction: { k: 'split' },
      },
    });
  });
  it('splits again in the middle', () => {
    const hands = [
      { bet: 10, split: true },
      { bet: 10, split: true, result: 'lose' as const },
    ];
    const res = play(bettor(hands), playing, 'split', 0);
    expect(res.ok && res.patch.hands.map(h => h.result || '-')).toEqual(['-', '-', 'lose']);
  });
  it(`up to ${MAX_HANDS} spots`, () => {
    const three = Array.from({ length: MAX_HANDS - 1 }, () => ({ bet: 10, split: true }));
    expect(play(bettor(three), playing, 'split', 0).ok).toBe(true);
    const four = Array.from({ length: MAX_HANDS }, () => ({ bet: 10, split: true }));
    expect(play(bettor(four), playing, 'split', 0)).toEqual({ ok: false, reason: 'too-many-hands' });
  });
  it('refuses without the chips, after a double or on a finished spot', () => {
    expect(play(bettor([{ bet: 30 }], 20), playing, 'split', 0)).toEqual({ ok: false, reason: 'not-enough-chips' });
    expect(play(bettor([{ bet: 60, doubled: true }]), playing, 'split', 0)).toEqual({
      ok: false,
      reason: 'already-doubled',
    });
    expect(play(bettor([{ bet: 30, result: 'win' }]), playing, 'split', 0)).toEqual({ ok: false, reason: 'hand-done' });
  });
});

describe('insurance', () => {
  it('costs half the bet, rounded down', () => {
    expect(play(bettor([{ bet: 25 }], 100), playing, 'ins', 0)).toEqual({
      ok: true,
      patch: { stack: 88, hands: [{ bet: 25 }], insurance: 12, lastAction: { k: 'ins' } },
    });
  });
  it('once, with one open spot, and only when the player can pay a non-zero amount', () => {
    expect(play(bettor([{ bet: 20 }], 100, { insurance: 10 }), playing, 'ins', 0)).toEqual({
      ok: false,
      reason: 'already-insured',
    });
    expect(play(bettor([{ bet: 20 }, { bet: 20 }]), playing, 'ins', 0)).toEqual({ ok: false, reason: 'only-one-hand' });
    expect(play(bettor([{ bet: 20, result: 'surrender' }]), playing, 'ins', 0)).toEqual({
      ok: false,
      reason: 'hand-done',
    });
    expect(play(bettor([{ bet: 20 }], 9), playing, 'ins', 0)).toEqual({ ok: false, reason: 'not-enough-chips' });
    expect(play(bettor([{ bet: 1 }], 100), playing, 'ins', 0)).toEqual({ ok: false, reason: 'not-enough-chips' });
  });
});

describe('surrender', () => {
  it('half the bet back at once (rounded down), the spot marked', () => {
    expect(play(bettor([{ bet: 25 }], 100), playing, 'surrender', 0)).toEqual({
      ok: true,
      patch: {
        stack: 112,
        hands: [{ bet: 25, result: 'surrender' }],
        surrendered: true,
        lastAction: { k: 'surrender' },
      },
    });
  });
  it('not after a split or a double, and only once', () => {
    expect(play(bettor([{ bet: 20 }, { bet: 20 }]), playing, 'surrender', 0)).toEqual({
      ok: false,
      reason: 'only-one-hand',
    });
    expect(play(bettor([{ bet: 40, doubled: true }]), playing, 'surrender', 0)).toEqual({
      ok: false,
      reason: 'already-doubled',
    });
    expect(play(bettor([{ bet: 40, result: 'surrender' }]), playing, 'surrender', 0)).toEqual({
      ok: false,
      reason: 'hand-done',
    });
  });
});

describe('play', () => {
  it('only for a player who bet this round, once the cards are dealt', () => {
    expect(play(bettor([{ bet: 20 }]), betting, 'double', 0)).toEqual({ ok: false, reason: 'not-playing' });
    expect(play(bettor([{ bet: 20 }], 100, { bjRound: 2 }), playing, 'double', 0)).toEqual({
      ok: false,
      reason: 'not-playing',
    });
    expect(play(null, playing, 'double', 0)).toEqual({ ok: false, reason: 'not-playing' });
  });
  it('a spot that does not exist means the first spot; an unknown action is refused', () => {
    const res = play(bettor([{ bet: 20 }]), playing, 'double', 5);
    expect(res.ok && res.patch.hands).toEqual([{ bet: 40, doubled: true }]);
    expect(play(bettor([{ bet: 20 }]), playing, 'hit', 0)).toEqual({ ok: false, reason: 'unknown' });
    const sp = play(bettor([{ bet: 20 }]), playing, 'split', 5);
    expect(sp.ok && sp.patch.hands).toEqual([
      { bet: 20, split: true },
      { bet: 20, split: true },
    ]);
    const su = play(bettor([{ bet: 20 }]), playing, 'surrender', 5);
    expect(su.ok && su.patch.hands).toEqual([{ bet: 20, result: 'surrender' }]);
  });
});

describe('payBlackjackNow', () => {
  it('pays 3:2 at once and marks the spot paid; the house pays the winnings', () => {
    const res = payBlackjackNow(bettor([{ bet: 25, chips: [25] }]), playing);
    expect(res).toEqual({
      ok: true,
      win: 37,
      stackInc: 62,
      patch: { hands: [{ bet: 25, chips: [25], result: 'bj', paid: true }], lastAction: { k: 'bjpay', amt: 37 } },
      room: { house: 63 },
    });
  });
  it('a room without a house balance starts at 0', () => {
    const res = payBlackjackNow(bettor([{ bet: 10 }]), { roundId: 3, phase: 'playing' });
    expect(res.ok && res.room).toEqual({ house: -15 });
  });
  it('only while playing, and only for an untouched single spot', () => {
    expect(payBlackjackNow(bettor([{ bet: 10 }]), betting)).toEqual({ ok: false, reason: 'not-playing' });
    expect(payBlackjackNow(undefined, playing)).toEqual({ ok: false, reason: 'not-playing' });
    expect(payBlackjackNow(bettor([{ bet: 20, doubled: true }]), playing)).toEqual({
      ok: false,
      reason: 'not-eligible',
    });
  });
});
