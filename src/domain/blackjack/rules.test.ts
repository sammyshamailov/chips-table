import { describe, expect, it } from 'vitest';
import type { PlayerDoc, RoomDoc } from '../types';
import {
  alreadySettled,
  betLimitError,
  blackjackEligible,
  handRefund,
  handReturn,
  hasOpenBets,
  insuranceCost,
  isCurrent,
  nextRoundId,
  stake,
  surrenderReturn,
} from './rules';

const r: RoomDoc = { roundId: 3, phase: 'playing', minBet: 10, maxBet: 500 };

describe('isCurrent', () => {
  it('a player who bet in this round', () => {
    expect(isCurrent({ bjRound: 3, hands: [{ bet: 10 }] }, r)).toBe(true);
  });
  it('not an old round, no spots, no player or no room', () => {
    expect(isCurrent({ bjRound: 2, hands: [{ bet: 10 }] }, r)).toBe(false);
    expect(isCurrent({ bjRound: 3, hands: [] }, r)).toBe(false);
    expect(isCurrent({ bjRound: 3 }, r)).toBe(false);
    expect(isCurrent(null, r)).toBe(false);
    expect(isCurrent({ bjRound: 3, hands: [{ bet: 10 }] }, null)).toBe(false);
  });
});

describe('stake', () => {
  it('adds the spots, not the insurance', () => {
    expect(stake({ hands: [{ bet: 10 }, { bet: 20 }], insurance: 5 })).toBe(30);
    expect(stake({})).toBe(0);
  });
});

describe('bet limits', () => {
  it('between the minimum and the maximum', () => {
    expect(betLimitError(r, 10)).toBeNull();
    expect(betLimitError(r, 500)).toBeNull();
    expect(betLimitError(r, 9)).toBe('under-min');
    expect(betLimitError(r, 501)).toBe('over-max');
  });
  it('a maximum of 0 (or none) means no maximum; no minimum means any bet', () => {
    expect(betLimitError({ minBet: 10, maxBet: 0 }, 1_000_000)).toBeNull();
    expect(betLimitError({}, 1)).toBeNull();
  });
});

describe('what each result pays', () => {
  it('returns the bet plus the winnings', () => {
    expect(handReturn('win', 25)).toBe(50);
    expect(handReturn('bj', 25)).toBe(62);
    expect(handReturn('bj', 10)).toBe(25);
    expect(handReturn('push', 25)).toBe(25);
    expect(handReturn('lose', 25)).toBe(0);
    expect(handReturn('surrender', 25)).toBe(12);
  });
  it('insurance costs half the bet, surrender returns half (rounded down)', () => {
    expect(insuranceCost(25)).toBe(12);
    expect(surrenderReturn(25)).toBe(12);
  });
});

describe('handRefund (cancelled round)', () => {
  it('the bet, the half left of a surrender, nothing for a paid blackjack', () => {
    expect(handRefund({ bet: 25 })).toBe(25);
    expect(handRefund({ bet: 25, result: 'surrender' })).toBe(13);
    expect(handRefund({ bet: 25, result: 'bj', paid: true })).toBe(0);
  });
});

describe('blackjackEligible', () => {
  const p = (o: PlayerDoc): PlayerDoc => ({ bjRound: 3, hands: [{ bet: 10 }], ...o });
  it('one untouched spot in this round', () => {
    expect(blackjackEligible(p({}), r)).toBe(true);
  });
  it('not after a double, a split, a result, or with two spots', () => {
    expect(blackjackEligible(p({ hands: [{ bet: 20, doubled: true }] }), r)).toBe(false);
    expect(blackjackEligible(p({ hands: [{ bet: 10, split: true }] }), r)).toBe(false);
    expect(blackjackEligible(p({ hands: [{ bet: 10, result: 'surrender' }] }), r)).toBe(false);
    expect(blackjackEligible(p({ hands: [{ bet: 10 }, { bet: 10 }] }), r)).toBe(false);
    expect(blackjackEligible(p({ bjRound: 2 }), r)).toBe(false);
    expect(blackjackEligible(undefined, r)).toBe(false);
  });
});

describe('the paid-hand and settled-player rules', () => {
  it('a player whose only spot was paid has nothing left for the end of the round', () => {
    expect(hasOpenBets({ hands: [{ bet: 10, result: 'bj', paid: true }] })).toBe(false);
    expect(hasOpenBets({ hands: [{ bet: 10, result: 'bj', paid: true }], insurance: 5 })).toBe(true);
    expect(hasOpenBets({ hands: [{ bet: 10 }] })).toBe(true);
    expect(hasOpenBets({})).toBe(false);
  });
  it('bjPaidRound equal to the round means already settled', () => {
    expect(alreadySettled({ bjPaidRound: 3 }, r)).toBe(true);
    expect(alreadySettled({ bjPaidRound: 2 }, r)).toBe(false);
    expect(alreadySettled({}, r)).toBe(false);
  });
  it('the next round id (a room without one is round 1)', () => {
    expect(nextRoundId(r)).toBe(4);
    expect(nextRoundId({})).toBe(2);
  });
});
