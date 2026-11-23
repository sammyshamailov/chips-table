/**
 * The storage port: the part of Firestore the app uses, as an interface. Three adapters implement it: Firestore over
 * the compat SDK (`firestore-store.ts`), single-device mode in localStorage (`local-store.ts`), and, in the tests,
 * `tests/fakefs.js` (an in-memory stand-in for the compat SDK) behind the Firestore adapter.
 *
 * Paths are Firestore paths: `rooms/ABCD` is a document, `rooms/ABCD/players` a collection.
 */

/** A stored document's fields, as written or read. */
export type DocData = Record<string, unknown>;

/** Stops a listener. */
export type Unsubscribe = () => void;

/** Where a snapshot came from: `fromCache` is true until the server has answered at least once. */
export interface SnapMeta {
  fromCache: boolean;
}

/** One document as read. `data()` is a fresh copy, or `undefined` when the document doesn't exist. */
export interface DocSnap {
  id: string;
  exists: boolean;
  data(): DocData | undefined;
  metadata: SnapMeta;
}

/** The documents of a collection (in query order) as read. */
export interface QuerySnap {
  docs: DocSnap[];
  size: number;
  empty: boolean;
  metadata: SnapMeta;
}

/** What a failed read or write rejects with: Firestore's `code` (`permission-denied`, `not-found`…) when it has one. */
export interface StoreError {
  code?: string;
  message?: string;
}

/**
 * A field value that adds `n` to whatever the stored field holds (missing counts as 0), applied where the document
 * lives, so it can't overwrite a change it hasn't seen. Opaque: only `Store.increment` makes one.
 */
export interface Increment {
  readonly __increment: never;
}

/** One document. */
export interface DocRef {
  readonly id: string;
  readonly path: string;
  get(): Promise<DocSnap>;
  /** Replaces the whole document (creating it). */
  set(data: DocData): Promise<void>;
  /** Changes the named fields; rejects when the document doesn't exist. */
  update(data: DocData): Promise<void>;
  delete(): Promise<void>;
  /** Calls `next` with the document now (asynchronously) and after every change, until unsubscribed. */
  onSnapshot(next: (snap: DocSnap) => void, error?: (e: StoreError) => void): Unsubscribe;
}

/** A collection, optionally ordered, filtered and limited. Each call returns a new query. */
export interface Query {
  orderBy(field: string, dir?: 'asc' | 'desc'): Query;
  limit(n: number): Query;
  where(field: string, op: '==', value: unknown): Query;
  get(): Promise<QuerySnap>;
  onSnapshot(next: (snap: QuerySnap) => void, error?: (e: StoreError) => void): Unsubscribe;
}

/** The storage port. */
export interface Store {
  doc(path: string): DocRef;
  collection(path: string): Query;
  /** The value to write to add `n` to a numeric field (the dealer's changes to a player's stack). */
  increment(n: number): Increment;
}

/** The last segment of a path: the document's id. */
export function idOf(path: string): string {
  return path.split('/').pop() as string;
}
