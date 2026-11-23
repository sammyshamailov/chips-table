import { describe, expect, it } from 'vitest';
import { places } from './rank';

describe('places', () => {
  it('numbers the standings, equal stacks sharing a place', () => {
    const s = (stack: number) => ({ pid: 'p' + stack, name: '', stack });
    expect(places([s(30), s(20), s(10)])).toEqual([1, 2, 3]);
    expect(places([s(30), s(30), s(10)])).toEqual([1, 1, 3]);
    expect(places([s(5), s(5), s(5)])).toEqual([1, 1, 1]);
    expect(places([])).toEqual([]);
  });
});
