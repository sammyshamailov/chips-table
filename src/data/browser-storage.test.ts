// browserStorage: localStorage when it works, nothing (and no error) when it doesn't.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserStorage } from './browser-storage';

afterEach(() => vi.unstubAllGlobals());

describe('browserStorage', () => {
  it('reads, writes and deletes through localStorage', () => {
    const m = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    });
    const s = browserStorage();
    expect(s.get('a')).toBe(null);
    s.set('a', '1');
    expect(s.get('a')).toBe('1');
    s.del('a');
    expect(s.get('a')).toBe(null);
  });
  it('swallows every error (private mode, full or blocked storage)', () => {
    const boom = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom });
    const s = browserStorage();
    expect(s.get('a')).toBe(null);
    expect(() => s.set('a', '1')).not.toThrow();
    expect(() => s.del('a')).not.toThrow();
  });
});
