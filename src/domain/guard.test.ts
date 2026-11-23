import { describe, expect, it } from 'vitest';
import { FEATURE_LEVEL, tableUnsupported } from './guard';
import type { RoomDoc } from './types';

describe('tableUnsupported', () => {
  it('plays a missing room and an old room without the fields', () => {
    expect(tableUnsupported(null)).toBe(false);
    expect(tableUnsupported(undefined)).toBe(false);
    expect(tableUnsupported({ code: 'ABCD' })).toBe(false);
  });
  it('plays appMin up to FEATURE_LEVEL', () => {
    expect(tableUnsupported({ appMin: 0 })).toBe(false);
    expect(tableUnsupported({ appMin: FEATURE_LEVEL })).toBe(false);
    expect(tableUnsupported({ appMin: FEATURE_LEVEL + 1 })).toBe(true);
  });
  it('treats an appMin that is not a number as too new', () => {
    expect(tableUnsupported({ appMin: 'x' } as unknown as RoomDoc)).toBe(true);
    expect(tableUnsupported({ appMin: NaN })).toBe(true);
  });
  it('knows only the chips mode', () => {
    expect(tableUnsupported({ mode: 'chips' })).toBe(false);
    expect(tableUnsupported({ mode: 'cards' })).toBe(true);
  });
});
