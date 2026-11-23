import { afterEach, describe, expect, it, vi } from 'vitest';
import { connect } from './connect';
import type { CompatFirebase, CompatFirestore } from './firestore-store';
import { memoryStorage } from './local-store';

function firebase(fail = false) {
  const init = vi.fn(() => {
    if (fail) throw new Error('bad config');
  });
  const db = { settings() {}, doc: vi.fn(), collection: vi.fn() } as unknown as CompatFirestore;
  const fb: CompatFirebase = {
    initializeApp: init,
    firestore: Object.assign(() => db, { FieldValue: { increment: (n: number) => n } }),
  };
  return { fb, init };
}

afterEach(() => vi.restoreAllMocks());

describe('connect', () => {
  it('uses Firestore with a real config and the SDK loaded', () => {
    const { fb, init } = firebase();
    const c = connect({ apiKey: 'AIza', projectId: 'chips' }, fb, memoryStorage());
    expect(c.mode).toBe('cloud');
    expect(init).toHaveBeenCalledWith({ apiKey: 'AIza', projectId: 'chips' });
    expect(c.store.increment(2)).toBe(2);
  });

  it('stays on this phone without a config, a project, a real key, or the SDK', () => {
    const { fb, init } = firebase();
    for (const [cfg, sdk] of [
      [undefined, fb],
      [null, fb],
      [{ apiKey: 'AIza' }, fb],
      [{ apiKey: 'PASTE_YOUR_KEY', projectId: 'chips' }, fb],
      [{ apiKey: 'AIza', projectId: 'chips' }, undefined],
    ] as const) {
      expect(connect(cfg, sdk, memoryStorage()).mode).toBe('local');
    }
    expect(init).not.toHaveBeenCalled();
  });

  it('falls back to this phone when Firebase fails to start, and logs why', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const kv = memoryStorage();
    const c = connect({ apiKey: 'AIza', projectId: 'chips' }, firebase(true).fb, kv);
    expect(c.mode).toBe('local');
    expect(err).toHaveBeenCalledOnce();
    await c.store.doc('rooms/ABCD').set({ code: 'ABCD' });
    expect(kv.get('chips.localdb')).toContain('ABCD');
  });
});
