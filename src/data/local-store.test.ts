// Single-device mode's store, beyond the shared contract: where it keeps the data and the old LocalDB's details that
// phones with an offline table depend on.
import { describe, expect, it } from 'vitest';
import { createLocalStore, LOCAL_DB_KEY, memoryStorage } from './local-store';

describe('local-store', () => {
  it('keeps the whole database as JSON under chips.localdb', async () => {
    const kv = memoryStorage();
    const st = createLocalStore(kv);
    await st.doc('rooms/ABCD').set({ code: 'ABCD' });
    await st.doc('rooms/ABCD/players/p_a').set({ stack: 5 });
    expect(LOCAL_DB_KEY).toBe('chips.localdb');
    expect(JSON.parse(kv.data['chips.localdb'])).toEqual({
      'rooms/ABCD': { code: 'ABCD' },
      'rooms/ABCD/players/p_a': { stack: 5 },
    });
  });

  it('reads back what an earlier start stored (the old LocalDB format)', async () => {
    const kv = memoryStorage({ 'chips.localdb': JSON.stringify({ 'rooms/WXYZ': { code: 'WXYZ', updatedAt: 1 } }) });
    const st = createLocalStore(kv);
    expect((await st.doc('rooms/WXYZ').get()).data()).toEqual({ code: 'WXYZ', updatedAt: 1 });
  });

  it('starts empty when the stored database is damaged or null', async () => {
    for (const bad of ['{not json', 'null']) {
      const st = createLocalStore(memoryStorage({ 'chips.localdb': bad }));
      expect((await st.collection('rooms').get()).empty).toBe(true);
    }
  });

  it('writes increments as the {__inc} marker and stores the result', async () => {
    const kv = memoryStorage();
    const st = createLocalStore(kv);
    expect(st.increment(7)).toEqual({ __inc: 7 });
    await st.doc('a/b').set({ stack: 10 });
    await st.doc('a/b').update({ stack: st.increment(7) });
    expect(JSON.parse(kv.data['chips.localdb'])['a/b']).toEqual({ stack: 17 });
  });

  it('refuses an update of a missing document with invalid_argument, as before', async () => {
    const st = createLocalStore(memoryStorage());
    await expect(st.doc('a/b').update({ x: 1 })).rejects.toEqual({ code: 'invalid_argument', message: 'missing' });
  });

  it('merges nested maps on update, at every depth; arrays and nulls replace', async () => {
    const st = createLocalStore(memoryStorage());
    await st.doc('a/b').set({ m: { x: 1, deep: { y: 1, z: 1 } }, list: [1, 2], n: { a: 1 } });
    await st.doc('a/b').update({ m: { deep: { z: 2 } }, list: [3], n: null });
    expect((await st.doc('a/b').get()).data()).toEqual({ m: { x: 1, deep: { y: 1, z: 2 } }, list: [3], n: null });
  });

  it('notifies through the defer function it is given', async () => {
    const queued: (() => void)[] = [];
    const st = createLocalStore(memoryStorage(), f => queued.push(f));
    const seen: number[] = [];
    st.doc('a/b').onSnapshot(s => seen.push(s.exists ? 1 : 0));
    expect(queued).toHaveLength(1);
    queued.shift()?.();
    expect(seen).toEqual([0]);
    await st.doc('a/b').set({ v: 1 });
    expect(seen).toEqual([0]);
    queued.forEach(f => f());
    expect(seen).toEqual([0, 1]);
  });

  it('ignores the where operator other than as ==', async () => {
    const st = createLocalStore(memoryStorage());
    await st.doc('r/a').set({ g: 1 });
    await st.doc('r/b').set({ g: 2 });
    expect((await st.collection('r').where('g', '==', 2).get()).docs.map(d => d.id)).toEqual(['b']);
  });
});

describe('memoryStorage', () => {
  it('answers null for a missing key and keeps what is set', () => {
    const kv = memoryStorage({ a: '1' });
    expect(kv.get('a')).toBe('1');
    expect(kv.get('b')).toBeNull();
    kv.set('b', '2');
    expect(kv.get('b')).toBe('2');
  });
});
