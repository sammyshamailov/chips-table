// The Firestore adapter's own job: start the compat SDK the way the app always did and pass calls through. The
// read/write behaviour is in store.contract.test.ts (over tests/fakefs.js).
import { describe, expect, it, vi } from 'vitest';
import {
  createFirestoreStore,
  FIRESTORE_SETTINGS,
  type CompatDocRef,
  type CompatFirebase,
  type CompatFirestore,
  type CompatQuery,
} from './firestore-store';

function spyFirebase(opts: { settingsThrows?: boolean } = {}) {
  const calls: unknown[][] = [];
  const snap = { id: 'ABCD', exists: true, data: () => ({ a: 1 }), metadata: { fromCache: true } };
  const docRef: CompatDocRef = {
    id: 'ABCD',
    path: 'rooms/ABCD',
    get: async () => snap,
    set: async d => void calls.push(['set', d]),
    update: async d => void calls.push(['update', d]),
    delete: async () => void calls.push(['delete']),
    onSnapshot(...args) {
      calls.push(['doc.onSnapshot', args.length]);
      args[0](snap);
      return () => calls.push(['unsub']);
    },
  };
  const q: CompatQuery = {
    orderBy: (...args) => (calls.push(['orderBy', ...args]), q),
    limit: n => (calls.push(['limit', n]), q),
    where: (...args) => (calls.push(['where', ...args]), q),
    get: async () => ({ docs: [snap], size: 1, empty: false, metadata: { fromCache: false } }),
    onSnapshot(...args) {
      calls.push(['q.onSnapshot', args.length]);
      return () => {};
    },
  };
  const db: CompatFirestore = {
    settings: s => {
      calls.push(['settings', s]);
      if (opts.settingsThrows) throw new Error('already started');
    },
    doc: p => (calls.push(['doc', p]), docRef),
    collection: p => (calls.push(['collection', p]), q),
  };
  const firestore = Object.assign(() => db, { FieldValue: { increment: (n: number) => ({ fieldValueInc: n }) } });
  const fb: CompatFirebase = { initializeApp: c => calls.push(['init', c]), firestore };
  return { fb, calls };
}

describe('createFirestoreStore', () => {
  it('starts Firebase with the config and the same settings as always', () => {
    const { fb, calls } = spyFirebase();
    createFirestoreStore(fb, { projectId: 'p' });
    expect(calls).toEqual([
      ['init', { projectId: 'p' }],
      ['settings', { ignoreUndefinedProperties: true, experimentalAutoDetectLongPolling: true, merge: true }],
    ]);
    expect(FIRESTORE_SETTINGS.merge).toBe(true);
  });

  it('carries on when the settings were already set', () => {
    const { fb } = spyFirebase({ settingsThrows: true });
    expect(() => createFirestoreStore(fb, {})).not.toThrow();
  });

  it('passes document calls through and converts snapshots', async () => {
    const { fb, calls } = spyFirebase();
    const st = createFirestoreStore(fb, {});
    const ref = st.doc('rooms/ABCD');
    expect([ref.id, ref.path]).toEqual(['ABCD', 'rooms/ABCD']);
    await ref.set({ a: 1 });
    await ref.update({ b: 2 });
    await ref.delete();
    const s = await ref.get();
    expect([s.id, s.exists, s.data(), s.metadata]).toEqual(['ABCD', true, { a: 1 }, { fromCache: true }]);
    expect(calls.slice(2)).toEqual([['doc', 'rooms/ABCD'], ['set', { a: 1 }], ['update', { b: 2 }], ['delete']]);
  });

  it('passes the error callback only when there is one', () => {
    const { fb, calls } = spyFirebase();
    const st = createFirestoreStore(fb, {});
    const seen: unknown[] = [];
    const un = st.doc('rooms/ABCD').onSnapshot(s => seen.push(s.data()));
    st.doc('rooms/ABCD').onSnapshot(
      () => {},
      () => {},
    );
    st.collection('rooms').onSnapshot(() => {});
    st.collection('rooms').onSnapshot(
      () => {},
      () => {},
    );
    un();
    expect(seen).toEqual([{ a: 1 }]);
    expect(calls.filter(c => String(c[0]).includes('onSnapshot') || c[0] === 'unsub')).toEqual([
      ['doc.onSnapshot', 1],
      ['doc.onSnapshot', 2],
      ['q.onSnapshot', 1],
      ['q.onSnapshot', 2],
      ['unsub'],
    ]);
  });

  it('builds queries the same way and converts query snapshots', async () => {
    const { fb, calls } = spyFirebase();
    const st = createFirestoreStore(fb, {});
    const q = await st
      .collection('rooms')
      .orderBy('updatedAt', 'desc')
      .orderBy('code')
      .where('game', '==', 'x')
      .limit(6)
      .get();
    expect([q.size, q.empty, q.metadata, q.docs.map(d => d.id)]).toEqual([1, false, { fromCache: false }, ['ABCD']]);
    expect(calls.slice(2)).toEqual([
      ['collection', 'rooms'],
      ['orderBy', 'updatedAt', 'desc'],
      ['orderBy', 'code'],
      ['where', 'game', '==', 'x'],
      ['limit', 6],
    ]);
  });

  it("makes increments with the SDK's FieldValue", () => {
    const { fb } = spyFirebase();
    const spy = vi.spyOn(fb.firestore.FieldValue, 'increment');
    expect(createFirestoreStore(fb, {}).increment(5)).toEqual({ fieldValueInc: 5 });
    expect(spy).toHaveBeenCalledWith(5);
  });
});
