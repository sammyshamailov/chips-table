import { describe, expect, it } from 'vitest';
import type { Seat } from '../types';
import { award, cancelHandRefunds, computeAward } from './pots';
import { holdemState } from './rules';

/** A river where each player has committed the given chips (`f` = folded). */
const table = (committed: Record<string, number>, potLevel = 0, folded: string[] = []) =>
  holdemState(
    { sb: 5, bb: 10, handId: 1, streetId: 14, stage: 'river', potLevel },
    Object.entries(committed).map(([pid, c]): Seat => ({
      pid,
      stack: 0,
      handId: 1,
      streetId: 14,
      committed: c,
      folded: folded.includes(pid),
    })),
  );

describe('computeAward', () => {
  it('two players: the winner takes the pot', () => {
    expect(computeAward(table({ a: 50, b: 50 }), ['b'])).toEqual({ pay: { b: 100 }, newL: 50, left: 0 });
  });

  it('a single contributor gets their unmatched excess back', () => {
    // a bet 100, b called all-in for 60: the main pot is 120, a's last 40 nobody matched.
    expect(computeAward(table({ a: 100, b: 60 }), ['b'])).toEqual({ pay: { b: 120, a: 40 }, newL: 100, left: 0 });
    expect(computeAward(table({ a: 100, b: 60 }), ['a'])).toEqual({ pay: { a: 160 }, newL: 100, left: 0 });
  });

  it('three all-ins at different levels: main pot, side pot, excess', () => {
    const h = table({ a: 100, b: 200, c: 300 });
    // a wins the main pot (100 from each); the side pot between b and c has no chosen winner yet.
    const first = computeAward(h, ['a']);
    expect(first).toEqual({ pay: { a: 300 }, newL: 100, left: 300 });
    // The dealer then picks b for the side pot (100 from b and c); c's last 100 goes back to c.
    expect(computeAward(table({ a: 100, b: 200, c: 300 }, first.newL), ['b'])).toEqual({
      pay: { b: 200, c: 100 },
      newL: 300,
      left: 0,
    });
  });

  it('four players, two side pots, the top stack wins everything it reached', () => {
    const h = table({ a: 50, b: 100, c: 150, d: 150 });
    expect(computeAward(h, ['d'])).toEqual({ pay: { d: 450 }, newL: 150, left: 0 });
  });

  it('several winners at once pay each pot to whoever reached it', () => {
    // a (short) and c both win: a shares the main pot, c alone takes the side pot.
    const h = table({ a: 100, b: 200, c: 200 });
    expect(computeAward(h, ['a', 'c'])).toEqual({ pay: { a: 150, c: 350 }, newL: 200, left: 0 });
  });

  it('a tie splits each pot evenly', () => {
    expect(computeAward(table({ a: 40, b: 40, c: 40 }), ['a', 'c'])).toEqual({
      pay: { a: 60, c: 60 },
      newL: 40,
      left: 0,
    });
  });

  it('the odd chip goes to the first winner in seat order, whatever order they were picked in', () => {
    const h = table({ a: 5, b: 10, c: 10 });
    expect(computeAward(h, ['c', 'b'])).toEqual({ pay: { b: 13, c: 12 }, newL: 10, left: 0 });
    // Three-way tie on 31 (one chip from a folded player): the extra chip of the 4-chip level goes to a.
    const four = table({ a: 10, b: 10, c: 10, f: 1 }, 0, ['f']);
    expect(computeAward(four, ['c', 'b', 'a'])).toEqual({ pay: { a: 11, b: 10, c: 10 }, newL: 10, left: 0 });
  });

  it("a folded player's chips stay in the pot for the winners", () => {
    const h = table({ a: 60, b: 60, f: 30 }, 0, ['f']);
    expect(computeAward(h, ['a'])).toEqual({ pay: { a: 150 }, newL: 60, left: 0 });
  });

  it('counts only chips above the pot level', () => {
    expect(computeAward(table({ a: 150, b: 150 }, 100), ['a'])).toEqual({ pay: { a: 100 }, newL: 150, left: 0 });
  });

  it('pays nothing without a winner who reached the pot, and ignores unknown ids', () => {
    expect(computeAward(table({ a: 50, b: 50 }), [])).toEqual({ pay: {}, newL: 0, left: 100 });
    expect(computeAward(table({ a: 50, b: 50 }), ['zz'])).toEqual({ pay: {}, newL: 0, left: 100 });
  });

  it('a chosen winner who put nothing in this pot wins nothing', () => {
    expect(computeAward(table({ a: 50, b: 50, z: 0 }), ['z'])).toEqual({ pay: {}, newL: 0, left: 100 });
  });

  it('an empty pot pays nothing', () => {
    expect(computeAward(table({ a: 50, b: 50 }, 50), ['a'])).toEqual({ pay: {}, newL: 50, left: 0 });
  });
});

describe('award', () => {
  it('goes idle when the pot is empty and lists the payments', () => {
    const res = award(table({ a: 100, b: 60 }), ['b']);
    expect(res).toEqual({
      ok: true,
      room: { potLevel: 100, stage: 'idle' },
      pays: [
        ['b', 120],
        ['a', 40],
      ],
      left: 0,
    });
  });
  it('keeps the street while a side pot is left', () => {
    const res = award(table({ a: 100, b: 200, c: 300 }), ['a']);
    expect(res).toEqual({ ok: true, room: { potLevel: 100, stage: 'river' }, pays: [['a', 300]], left: 300 });
  });
  it('refuses when nobody would be paid', () => {
    expect(award(table({ a: 50, b: 50 }), [])).toEqual({ ok: false, reason: 'no-winner' });
  });
});

describe('cancelHandRefunds', () => {
  it('gives everyone back what they put in and empties the pot', () => {
    expect(cancelHandRefunds(table({ a: 100, b: 60, c: 0 }))).toEqual({
      room: { potLevel: 100, stage: 'idle' },
      refunds: [
        { pid: 'a', amt: 100 },
        { pid: 'b', amt: 60 },
      ],
    });
  });
  it('after a side pot was paid, refunds only what is above the pot level', () => {
    expect(cancelHandRefunds(table({ a: 100, b: 200, c: 300 }, 100))).toEqual({
      room: { potLevel: 300, stage: 'idle' },
      refunds: [
        { pid: 'b', amt: 100 },
        { pid: 'c', amt: 200 },
      ],
    });
  });
  it('an empty table keeps its pot level', () => {
    expect(cancelHandRefunds(holdemState({ stage: 'idle', potLevel: 20 }, []))).toEqual({
      room: { potLevel: 20, stage: 'idle' },
      refunds: [],
    });
  });
});
