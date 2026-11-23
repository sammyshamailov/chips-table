/**
 * Single-device mode's store: the whole database as one JSON object in localStorage (key `chips.localdb`), with the
 * same surface as Firestore. It behaves exactly as the old `LocalDB` did, quirks included, because phones that played
 * a table offline keep their data in it:
 * - `update` merges nested maps field by field (Firestore replaces a map named in an update; nothing the app
 *   writes depends on the difference);
 * - an increment is stored as the marker `{__inc: n}` in the write and resolved against the current value;
 * - listeners hear about a change asynchronously (`setTimeout(0)`), like Firestore's snapshots.
 */
import type { DocData, DocRef, DocSnap, Increment, Query, QuerySnap, SnapMeta, Store, Unsubscribe } from './store';
import { idOf } from './store';

/** Where the database lives: the app passes its `ls` helper (localStorage, errors swallowed). */
export interface KeyValue {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** The localStorage key of the single-device database. */
export const LOCAL_DB_KEY = 'chips.localdb';

/** Runs a callback later; `setTimeout(0)` in the app, so a snapshot never arrives inside the write that caused it. */
export type Defer = (f: () => void) => void;

interface QueryOpts {
  order?: [string, 'asc' | 'desc' | undefined];
  limit?: number;
  where?: [string, unknown][];
}

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;
const isObj = (v: unknown): v is DocData => !!v && typeof v === 'object' && !Array.isArray(v);
const isInc = (v: unknown): v is { __inc: number } => isObj(v) && typeof v.__inc === 'number';

/** The write with every increment marker replaced by its result against the current document. */
function resolve(cur: DocData | null, d: DocData): DocData {
  const o: DocData = {};
  for (const k in d) {
    const v = d[k];
    o[k] = isInc(v) ? (Number(cur && cur[k]) || 0) + v.__inc : v;
  }
  return o;
}

/** Copies `b` into `a`, merging maps that both have (arrays and everything else are replaced). */
function merge(a: DocData, b: DocData): DocData {
  for (const k in b) {
    const v = b[k],
      cur = a[k];
    if (isObj(v) && isObj(cur)) merge(cur, v);
    else a[k] = v;
  }
  return a;
}

/** A store kept in `storage` under `chips.localdb`. */
export function createLocalStore(storage: KeyValue, defer: Defer = f => setTimeout(f, 0)): Store {
  let docs: Record<string, DocData> = {};
  try {
    docs = (JSON.parse(storage.get(LOCAL_DB_KEY) || '{}') as Record<string, DocData>) || {};
  } catch {
    // a damaged database starts empty, as before
  }
  const listeners = new Set<() => void>();
  const meta: SnapMeta = { fromCache: false };
  const has = (p: string) => Object.prototype.hasOwnProperty.call(docs, p);
  const snap = (p: string): DocSnap => ({
    id: idOf(p),
    exists: has(p),
    data: () => (docs[p] ? clone(docs[p]) : undefined),
    metadata: meta,
  });
  const notify = () => {
    storage.set(LOCAL_DB_KEY, JSON.stringify(docs));
    defer(() => listeners.forEach(l => l()));
  };
  const listen = (l: () => void): Unsubscribe => {
    listeners.add(l);
    defer(l);
    return () => {
      listeners.delete(l);
    };
  };

  function docRef(p: string): DocRef {
    return {
      id: idOf(p),
      path: p,
      get: async () => snap(p),
      set: async d => {
        docs[p] = resolve(null, clone(d));
        notify();
      },
      update: async d => {
        if (!has(p)) throw { code: 'invalid_argument', message: 'missing' };
        merge(docs[p], resolve(docs[p], clone(d)));
        notify();
      },
      delete: async () => {
        delete docs[p];
        notify();
      },
      onSnapshot: next => listen(() => next(snap(p))),
    };
  }

  function query(p: string, o: QueryOpts = {}): Query {
    const depth = p.split('/').length + 1;
    const run = (): QuerySnap => {
      let ds = Object.keys(docs)
        .filter(k => k.startsWith(p + '/') && k.split('/').length === depth)
        .map(snap);
      for (const [f, v] of o.where || []) ds = ds.filter(s => (s.data() as DocData)[f] === v);
      if (o.order) {
        const [f, dir] = o.order;
        const val = (s: DocSnap) => ((s.data() as DocData)[f] as number) || 0;
        ds.sort((a, b) => (val(a) - val(b)) * (dir === 'desc' ? -1 : 1));
      }
      if (o.limit) ds = ds.slice(0, o.limit);
      return { docs: ds, size: ds.length, empty: !ds.length, metadata: meta };
    };
    return {
      orderBy: (f, dir) => query(p, { ...o, order: [f, dir] }),
      limit: n => query(p, { ...o, limit: n }),
      where: (f, _op, v) => query(p, { ...o, where: [...(o.where || []), [f, v]] }),
      get: async () => run(),
      onSnapshot: next => listen(() => next(run())),
    };
  }

  return { doc: docRef, collection: p => query(p), increment: n => ({ __inc: n }) as unknown as Increment };
}

/** A key-value storage in memory, for tests and anything that needs a throwaway store. */
export function memoryStorage(init: Record<string, string> = {}): KeyValue & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    get: k => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    set: (k, v) => {
      data[k] = v;
    },
  };
}
