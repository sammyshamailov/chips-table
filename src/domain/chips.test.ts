import { describe, expect, it } from 'vitest';
import {
  chipLabel,
  chipsOf,
  DEN,
  denoms,
  dispAmt,
  handHalves,
  handStack,
  MAX_CHIPS,
  MAX_DRAWN_CHIPS,
  N_CHIPS,
  okChips,
  sumOf,
} from './chips';

describe('denoms', () => {
  it("Hold'em follows the small blind, plus one smaller chip", () => {
    expect(denoms('holdem', 5, 10)).toEqual([2, 5, 10, 25, 50, 100]);
  });
  it('Blackjack follows the minimum bet', () => {
    expect(denoms('blackjack', 5, 10)).toEqual([5, 10, 25, 50, 100, 250]);
  });
  it('uses the largest chip not above an odd unit', () => {
    expect(denoms('blackjack', 0, 30)).toEqual([10, 25, 50, 100, 250, 500]);
  });
  it('starts at 1 when the unit is missing or tiny', () => {
    expect(denoms('holdem', undefined, undefined)).toEqual([1, 2, 5, 10, 25, 50]);
    expect(denoms('blackjack', 5, 0)).toEqual([1, 2, 5, 10, 25, 50]);
    expect(denoms('blackjack', 5, 3)).toEqual([1, 2, 5, 10, 25, 50]);
  });
  it('stops at the top of the chip list', () => {
    const top = DEN.slice(DEN.length - N_CHIPS);
    expect(denoms('holdem', 10000, 0)).toEqual(top);
    expect(denoms('holdem', 99999, 0)).toEqual(top);
  });
});

describe('chipLabel', () => {
  it('writes thousands as K', () => {
    expect(chipLabel(1000)).toBe('1K');
    expect(chipLabel(2500)).toBe('2.5K');
    expect(chipLabel(500)).toBe('500');
  });
});

describe('chipsOf', () => {
  it('makes up an amount from the biggest chips', () => {
    expect(chipsOf(1885)).toEqual([1000, 500, 250, 100, 25, 10]);
    expect(chipsOf(37)).toEqual([25, 10, 2]);
  });
  it('is empty for nothing', () => {
    expect(chipsOf(0)).toEqual([]);
    expect(chipsOf(null)).toEqual([]);
    expect(chipsOf(undefined)).toEqual([]);
    expect(chipsOf(-5)).toEqual([]);
  });
  it('drops fractions', () => {
    expect(chipsOf(7.9)).toEqual([5, 2]);
  });
  it('draws at most MAX_DRAWN_CHIPS chips', () => {
    const c = chipsOf(1_000_000);
    expect(c).toHaveLength(MAX_DRAWN_CHIPS);
    expect(c.every(d => d === 10000)).toBe(true);
  });
});

describe('sumOf', () => {
  it('adds the chips', () => {
    expect(sumOf([])).toBe(0);
    expect(sumOf([25, 10, 2])).toBe(37);
  });
});

describe('okChips', () => {
  it('accepts known chips that add up', () => {
    expect(okChips([25, 10, 2], 37)).toBe(true);
    expect(okChips(Array(MAX_CHIPS).fill(1), MAX_CHIPS)).toBe(true);
  });
  it('rejects anything else, so the amount is used instead', () => {
    expect(okChips([25, 10], 37)).toBe(false);
    expect(okChips([], 0)).toBe(false);
    expect(okChips([3, 2], 5)).toBe(false);
    expect(okChips(Array(MAX_CHIPS + 1).fill(1), MAX_CHIPS + 1)).toBe(false);
    expect(okChips(undefined, 5)).toBe(false);
    expect(okChips('5', 5)).toBe(false);
  });
});

describe('Blackjack spot stacks', () => {
  it('a surrendered spot shows the half that stays (rounded up)', () => {
    expect(dispAmt({ bet: 25, result: 'surrender' })).toBe(13);
    expect(dispAmt({ bet: 25 })).toBe(25);
    expect(handStack({ bet: 25, chips: [25], result: 'surrender' })).toBe(13);
  });
  it('draws the exact chips when they add up, otherwise the amount', () => {
    expect(handStack({ bet: 30, chips: [10, 10, 10] })).toEqual([10, 10, 10]);
    expect(handStack({ bet: 30, chips: [25] })).toBe(30);
    expect(handStack({ bet: 30 })).toBe(30);
  });
  it('splits a doubled spot into its two equal halves', () => {
    expect(handHalves({ bet: 40, chips: [10, 10, 10, 10] })).toEqual([
      [10, 10],
      [10, 10],
    ]);
    expect(handHalves({ bet: 50, chips: [25, 25] })).toEqual([[25], [25]]);
  });
  it('falls back to two amounts when the chips do not halve', () => {
    expect(handHalves({ bet: 40, chips: [25, 10, 5] })).toEqual([20, 20]);
    expect(handHalves({ bet: 40, chips: [25, 5, 5, 5] })).toEqual([20, 20]);
    expect(handHalves({ bet: 40, chips: [25] })).toEqual([20, 20]);
    expect(handHalves({ bet: 40 })).toEqual([20, 20]);
  });
});
