import { describe, expect, it, vi } from 'vitest';
import { createLocalStore, memoryStorage } from './local-store';
import type { DocData, DocRef, Store } from './store';
import { createWriter } from './writes';

/** A store whose writes wait until the test lets them finish, recording the order they start and end in. */
function gatedStore() {
  const log: string[] = [];
  const gates: { path: string; op: string; open: () => void; fail: (e: unknown) => void }[] = [];
  const op = (path: string, name: string) => (data?: DocData) =>
    new Promise<void>((res, rej) => {
      log.push(`start ${name} ${path}${data ? ' ' + JSON.stringify(data) : ''}`);
      gates.push({
        path,
        op: name,
        open: () => (log.push(`end ${name} ${path}`), res()),
        fail: e => (log.push(`fail ${name} ${path}`), rej(e)),
      });
    });
  const store = {
    doc: (path: string) =>
      ({ set: op(path, 'set'), update: op(path, 'update'), delete: op(path, 'delete') }) as unknown as DocRef,
    collection: () => {
      throw new Error('unused');
    },
    increment: (n: number) => ({ inc: n }),
  } as unknown as Store;
  return { store, log, gates };
}

const tick = () => new Promise(r => setTimeout(r, 0));

describe('createWriter', () => {
  it('runs writes to one document one at a time, in order', async () => {
    const g = gatedStore();
    const wr = createWriter({ store: () => g.store, onError: () => {} });
    const a = wr.write('rooms/A', 'update', { n: 1 });
    const b = wr.write('rooms/A', 'update', { n: 2 });
    await tick();
    expect(g.log).toEqual(['start update rooms/A {"n":1}']);
    g.gates[0].open();
    await tick();
    expect(g.log).toEqual(['start update rooms/A {"n":1}', 'end update rooms/A', 'start update rooms/A {"n":2}']);
    g.gates[1].open();
    expect(await Promise.all([a, b])).toEqual([true, true]);
  });

  it('runs writes to different documents in parallel', async () => {
    const g = gatedStore();
    const wr = createWriter({ store: () => g.store, onError: () => {} });
    const a = wr.write('rooms/A/players/p_1', 'update', { s: 1 });
    const b = wr.write('rooms/A/players/p_2', 'set', { s: 2 });
    const c = wr.write('rooms/A', 'delete');
    await tick();
    expect(g.log).toHaveLength(3);
    expect(g.log[2]).toBe('start delete rooms/A');
    g.gates.forEach(x => x.open());
    expect(await Promise.all([a, b, c])).toEqual([true, true, true]);
  });

  it('reports a failed write once, resolves it to false, and still runs the next one', async () => {
    const g = gatedStore();
    const onError = vi.fn();
    const wr = createWriter({ store: () => g.store, onError });
    const a = wr.write('rooms/A', 'update', { n: 1 });
    const b = wr.write('rooms/A', 'update', { n: 2 });
    await tick();
    g.gates[0].fail({ code: 'permission-denied' });
    expect(await a).toBe(false);
    expect(onError).toHaveBeenCalledExactlyOnceWith({ code: 'permission-denied' });
    await tick();
    g.gates[1].open();
    expect(await b).toBe(true);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('refuses paths the guard names without touching the store', async () => {
    const g = gatedStore();
    const onError = vi.fn();
    const wr = createWriter({ store: () => g.store, onError, refuse: p => p.startsWith('rooms/NEW') });
    expect(await wr.write('rooms/NEW/players/p_1', 'update', { s: 1 })).toBe(false);
    await tick();
    expect(g.log).toEqual([]);
    expect(onError).not.toHaveBeenCalled();
    const ok = wr.write('rooms/OLD', 'update', { s: 1 });
    await tick();
    g.gates[0].open();
    expect(await ok).toBe(true);
  });

  it('asks for the store on every write and makes increments with it', async () => {
    let st = createLocalStore(memoryStorage());
    const wr = createWriter({ store: () => st, onError: () => {} });
    await wr.write('a/b', 'set', { stack: 1 });
    st = createLocalStore(memoryStorage());
    expect(await wr.write('a/b', 'update', { stack: wr.inc(1) })).toBe(false); // the new store has no a/b
    expect(await wr.write('a/b', 'set', { stack: 1 })).toBe(true);
    expect(await wr.write('a/b', 'update', { stack: wr.inc(4) })).toBe(true);
    expect((await st.doc('a/b').get()).data()).toEqual({ stack: 5 });
  });
});
