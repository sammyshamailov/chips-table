// The Store port's contract: the same cases against every adapter the app or its tests use.
// - local-store: single-device mode (here on an in-memory key-value storage instead of localStorage);
// - firestore-store over tests/fakefs.js: the in-memory compat SDK the browser tests load instead of Firebase,
//   run here in Node with a plain object as `window`. It checks the adapter and the fake at the same time.
// Real Firestore can't run here; its behaviour for these cases is what the fake copies (see docs/TESTING.md).
import { describe, expect, it } from 'vitest';
import fakefsSource from '../../tests/fakefs.js?raw';
import { createFirestoreStore, type CompatFirebase } from './firestore-store';
import { createLocalStore, memoryStorage } from './local-store';
import type { DocSnap, QuerySnap, Store } from './store';

/** A fresh copy of tests/fakefs.js, as a browser would load it, with nothing to relay writes to. */
function fakeFirebase(): CompatFirebase {
  const win: Record<string, unknown> = {};
  new Function('window', fakefsSource)(win);
  return win.firebase as CompatFirebase;
}

interface Adapter {
  name: string;
  make(): Store;
  /** What `update` does to a map field it names: LocalDB merges into it, Firestore (and the fake) replaces it. */
  nestedUpdate: 'merge' | 'replace';
}

const ADAPTERS: Adapter[] = [
  { name: 'local-store', make: () => createLocalStore(memoryStorage()), nestedUpdate: 'merge' },
  {
    name: 'firestore-store over fakefs',
    make: () => createFirestoreStore(fakeFirebase(), { projectId: 'test' }),
    nestedUpdate: 'replace',
  },
];

/** Lets pending timers (the asynchronous snapshot notifications) run. */
const settle = () => new Promise(r => setTimeout(r, 5));

describe.each(ADAPTERS)('Store contract: $name', ({ make, nestedUpdate }) => {
  it('reads a missing document as not existing', async () => {
    const s = await make().doc('rooms/ABCD').get();
    expect(s.id).toBe('ABCD');
    expect(s.exists).toBe(false);
    expect(s.data()).toBeUndefined();
    expect(s.metadata.fromCache).toBe(false);
  });

  it('set creates the document; data() is a copy', async () => {
    const st = make(),
      ref = st.doc('rooms/ABCD');
    expect(ref.id).toBe('ABCD');
    expect(ref.path).toBe('rooms/ABCD');
    await ref.set({ code: 'ABCD', stack: 5, list: [1, 2], m: { a: 1 } });
    const s = await ref.get();
    expect(s.exists).toBe(true);
    expect(s.data()).toEqual({ code: 'ABCD', stack: 5, list: [1, 2], m: { a: 1 } });
    (s.data() as { m: { a: number } }).m.a = 9;
    expect((await ref.get()).data()).toEqual({ code: 'ABCD', stack: 5, list: [1, 2], m: { a: 1 } });
  });

  it('set replaces the whole document', async () => {
    const ref = make().doc('rooms/ABCD');
    await ref.set({ a: 1, b: 2 });
    await ref.set({ c: 3 });
    expect((await ref.get()).data()).toEqual({ c: 3 });
  });

  it('update changes the fields it names and keeps the rest; arrays are replaced', async () => {
    const ref = make().doc('rooms/ABCD/players/p_x');
    await ref.set({ name: 'Dana', stack: 100, hands: [{ bet: 5 }, { bet: 10 }] });
    await ref.update({ stack: 90, hands: [{ bet: 20 }] });
    expect((await ref.get()).data()).toEqual({ name: 'Dana', stack: 90, hands: [{ bet: 20 }] });
  });

  it(`update of a map field: ${nestedUpdate}`, async () => {
    const ref = make().doc('rooms/ABCD/players/p_x');
    await ref.set({ lastAction: { k: 'bet', amt: 5, chips: [5] } });
    await ref.update({ lastAction: { k: 'refund', amt: 5 } });
    const want = nestedUpdate === 'merge' ? { k: 'refund', amt: 5, chips: [5] } : { k: 'refund', amt: 5 };
    expect((await ref.get()).data()).toEqual({ lastAction: want });
  });

  it('update of a missing document fails and creates nothing', async () => {
    const ref = make().doc('rooms/ABCD');
    await expect(ref.update({ a: 1 })).rejects.toMatchObject({ code: expect.any(String) });
    expect((await ref.get()).exists).toBe(false);
  });

  it('increment adds to the stored number (missing counts as 0) and can go down', async () => {
    const st = make(),
      ref = st.doc('rooms/ABCD/players/p_x');
    await ref.set({ stack: 100, n: st.increment(3) });
    await ref.update({ stack: st.increment(25), other: st.increment(-4) });
    await ref.update({ stack: st.increment(-10) });
    expect((await ref.get()).data()).toEqual({ stack: 115, n: 3, other: -4 });
  });

  it('increment applies to the value stored, not the writer copy', async () => {
    const st = make(),
      ref = st.doc('rooms/ABCD/players/p_x');
    await ref.set({ stack: 100 });
    await ref.update({ stack: 40 }); // the player's own write (a bet)
    await ref.update({ stack: st.increment(50) }); // the dealer's payout, worked out before the bet
    expect((await ref.get()).data()).toEqual({ stack: 90 });
  });

  it('delete removes the document', async () => {
    const ref = make().doc('rooms/ABCD');
    await ref.set({ a: 1 });
    await ref.delete();
    expect((await ref.get()).exists).toBe(false);
  });

  it('a document listener hears the current state later, then every change, until unsubscribed', async () => {
    const ref = make().doc('rooms/ABCD');
    await ref.set({ n: 1 });
    await settle(); // the set's own notification has gone out
    const seen: (DocSnap | null)[] = [];
    const un = ref.onSnapshot(s => seen.push(s));
    expect(seen).toHaveLength(0); // never inside the call
    await settle();
    expect(seen.map(s => s && s.data())).toEqual([{ n: 1 }]);
    const p = ref.update({ n: 2 });
    expect(seen).toHaveLength(1); // never inside the write
    await p;
    await settle();
    expect(seen[seen.length - 1]?.data()).toEqual({ n: 2 });
    await ref.delete();
    await settle();
    expect(seen[seen.length - 1]?.exists).toBe(false);
    const count = seen.length;
    un();
    await ref.set({ n: 3 });
    await settle();
    expect(seen).toHaveLength(count);
  });

  it('a collection holds its direct documents only', async () => {
    const st = make();
    await st.doc('rooms/AAAA').set({ code: 'AAAA' });
    await st.doc('rooms/AAAA/players/p_a').set({ name: 'a' });
    await st.doc('rooms/BBBB').set({ code: 'BBBB' });
    await st.doc('roomsX/CCCC').set({ code: 'CCCC' });
    const rooms = await st.collection('rooms').get();
    expect(rooms.docs.map(d => d.id).sort()).toEqual(['AAAA', 'BBBB']);
    expect(rooms.size).toBe(2);
    expect(rooms.empty).toBe(false);
    expect(rooms.docs.every(d => d.exists)).toBe(true);
    const players = await st.collection('rooms/AAAA/players').get();
    expect(players.docs.map(d => [d.id, d.data()])).toEqual([['p_a', { name: 'a' }]]);
    const none = await st.collection('rooms/BBBB/players').get();
    expect(none.empty).toBe(true);
    expect(none.size).toBe(0);
  });

  it('orderBy (missing counts as 0), where ==, and limit', async () => {
    const st = make();
    await st.doc('rooms/AAAA').set({ updatedAt: 30, game: 'holdem' });
    await st.doc('rooms/BBBB').set({ updatedAt: 10, game: 'blackjack' });
    await st.doc('rooms/CCCC').set({ updatedAt: 20, game: 'holdem' });
    await st.doc('rooms/DDDD').set({ game: 'holdem' });
    const ids = (q: QuerySnap) => q.docs.map(d => d.id);
    expect(ids(await st.collection('rooms').orderBy('updatedAt', 'desc').get())).toEqual([
      'AAAA',
      'CCCC',
      'BBBB',
      'DDDD',
    ]);
    expect(ids(await st.collection('rooms').orderBy('updatedAt', 'asc').get())).toEqual([
      'DDDD',
      'BBBB',
      'CCCC',
      'AAAA',
    ]);
    expect(ids(await st.collection('rooms').orderBy('updatedAt', 'desc').limit(2).get())).toEqual(['AAAA', 'CCCC']);
    const holdem = st.collection('rooms').where('game', '==', 'holdem').orderBy('updatedAt', 'desc');
    expect(ids(await holdem.get())).toEqual(['AAAA', 'CCCC', 'DDDD']);
    expect(ids(await holdem.limit(1).get())).toEqual(['AAAA']);
  });

  it('a collection listener hears writes to its documents', async () => {
    const st = make();
    const seen: string[][] = [];
    const un = st
      .collection('rooms/AAAA/players')
      .onSnapshot(q => seen.push(q.docs.map(d => d.id + ':' + String((d.data() as { stack: number }).stack))));
    await settle();
    expect(seen).toEqual([[]]);
    await st.doc('rooms/AAAA/players/p_a').set({ stack: 5 });
    await settle();
    expect(seen[seen.length - 1]).toEqual(['p_a:5']);
    await st.doc('rooms/AAAA/players/p_a').update({ stack: st.increment(5) });
    await settle();
    expect(seen[seen.length - 1]).toEqual(['p_a:10']);
    un();
  });

  it('a query listener keeps its order and limit', async () => {
    const st = make();
    await st.doc('rooms/AAAA').set({ updatedAt: 1 });
    await st.doc('rooms/BBBB').set({ updatedAt: 2 });
    let last: string[] = [];
    const un = st
      .collection('rooms')
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .onSnapshot(q => (last = q.docs.map(d => d.id)));
    await settle();
    expect(last).toEqual(['BBBB']);
    await st.doc('rooms/AAAA').update({ updatedAt: 3 });
    await settle();
    expect(last).toEqual(['AAAA']);
    un();
  });
});
