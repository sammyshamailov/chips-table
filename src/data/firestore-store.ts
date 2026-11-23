/**
 * The Firestore adapter, over the Firebase **compat** SDK that `index.html` loads from gstatic as a classic script
 * (`window.firebase`). The SDK is passed in, so the browser tests can hand it `tests/fakefs.js` instead, and old and
 * new phones talk to Firestore in exactly the same way.
 */
import type { DocData, DocRef, DocSnap, Increment, Query, QuerySnap, Store, StoreError, Unsubscribe } from './store';

/** The part of a compat snapshot's metadata the app reads. */
interface CompatMeta {
  fromCache: boolean;
}

/** A compat `DocumentSnapshot` (`exists` is a property in the compat SDK). */
export interface CompatDocSnap {
  id: string;
  exists: boolean;
  data(): DocData | undefined;
  metadata: CompatMeta;
}

/** A compat `QuerySnapshot`. */
export interface CompatQuerySnap {
  docs: CompatDocSnap[];
  size: number;
  empty: boolean;
  metadata: CompatMeta;
}

type CompatListen<S> = (next: (s: S) => void, error?: (e: StoreError) => void) => Unsubscribe;

/** A compat `DocumentReference`. */
export interface CompatDocRef {
  id: string;
  path: string;
  get(): Promise<CompatDocSnap>;
  set(data: DocData): Promise<void>;
  update(data: DocData): Promise<void>;
  delete(): Promise<void>;
  onSnapshot: CompatListen<CompatDocSnap>;
}

/** A compat `Query` / `CollectionReference`. */
export interface CompatQuery {
  orderBy(field: string, dir?: 'asc' | 'desc'): CompatQuery;
  limit(n: number): CompatQuery;
  where(field: string, op: string, value: unknown): CompatQuery;
  get(): Promise<CompatQuerySnap>;
  onSnapshot: CompatListen<CompatQuerySnap>;
}

/** A compat `Firestore` instance. */
export interface CompatFirestore {
  settings(s: object): void;
  doc(path: string): CompatDocRef;
  collection(path: string): CompatQuery;
}

/** The compat namespace (`window.firebase`), with the Firestore part loaded. */
export interface CompatFirebase {
  initializeApp(config: object): unknown;
  firestore: { (): CompatFirestore; FieldValue: { increment(n: number): unknown } };
}

/** The settings the app has always used (`merge` is not a real setting; kept so nothing changes). */
export const FIRESTORE_SETTINGS = {
  ignoreUndefinedProperties: true,
  experimentalAutoDetectLongPolling: true,
  merge: true,
};

const docSnap = (s: CompatDocSnap): DocSnap => ({
  id: s.id,
  exists: s.exists,
  data: () => s.data(),
  metadata: { fromCache: s.metadata.fromCache },
});

const querySnap = (s: CompatQuerySnap): QuerySnap => ({
  docs: s.docs.map(docSnap),
  size: s.size,
  empty: s.empty,
  metadata: { fromCache: s.metadata.fromCache },
});

/** Subscribes with the snapshot converted; the error callback is passed only when there is one. */
function listen<S, T>(on: CompatListen<S>, conv: (s: S) => T, next: (t: T) => void, error?: (e: StoreError) => void) {
  const n = (s: S) => next(conv(s));
  return error ? on(n, error) : on(n);
}

function docRef(ref: CompatDocRef): DocRef {
  return {
    id: ref.id,
    path: ref.path,
    get: async () => docSnap(await ref.get()),
    set: d => ref.set(d),
    update: d => ref.update(d),
    delete: () => ref.delete(),
    onSnapshot: (next, error) => listen(ref.onSnapshot.bind(ref), docSnap, next, error),
  };
}

function query(q: CompatQuery): Query {
  return {
    orderBy: (f, dir) => query(dir ? q.orderBy(f, dir) : q.orderBy(f)),
    limit: n => query(q.limit(n)),
    where: (f, op, v) => query(q.where(f, op, v)),
    get: async () => querySnap(await q.get()),
    onSnapshot: (next, error) => listen(q.onSnapshot.bind(q), querySnap, next, error),
  };
}

/** Starts Firebase with `config` and returns the store. Throws when the SDK can't start (the caller goes local). */
export function createFirestoreStore(fb: CompatFirebase, config: object): Store {
  fb.initializeApp(config);
  const db = fb.firestore();
  try {
    db.settings(FIRESTORE_SETTINGS);
  } catch {
    // settings can only be set once; a second start keeps the first
  }
  return {
    doc: p => docRef(db.doc(p)),
    collection: p => query(db.collection(p)),
    increment: n => fb.firestore.FieldValue.increment(n) as Increment,
  };
}
