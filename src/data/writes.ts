/**
 * Writes, one at a time per document: a write to a document waits until the previous write to that document has
 * finished (or failed), so two quick taps can't arrive in the wrong order. Writes to different documents run in
 * parallel. A failed write is reported once to `onError` (the app shows a toast) and resolves to `false`.
 */
import type { DocData, Increment, Store } from './store';

/** What a write does to the document. */
export type WriteOp = 'set' | 'update' | 'delete';

export interface WriterOptions {
  /** The store to write to, asked on every write (the app can switch to single-device mode). */
  store: () => Store;
  /** Called with the error of each failed write. */
  onError: (e: unknown) => void;
  /** True for a path this phone must not write to (a table type it doesn't understand). Refused silently. */
  refuse?: (path: string) => boolean;
}

export interface Writer {
  /** Queues the write; resolves to `true` when it was stored, `false` when it was refused or failed. */
  write(path: string, op: WriteOp, data?: DocData): Promise<boolean>;
  /** The value that adds `n` to a numeric field on the store in use (dealer changes to a player's stack). */
  inc(n: number): Increment;
}

/** A write queue over the store `o.store()` returns. */
export function createWriter(o: WriterOptions): Writer {
  const queues = new Map<string, Promise<unknown>>();
  return {
    write(path, op, data) {
      if (o.refuse && o.refuse(path)) return Promise.resolve(false);
      const ref = o.store().doc(path),
        prev = queues.get(path) || Promise.resolve();
      const p = prev.catch(() => {}).then(() => (op === 'delete' ? ref.delete() : ref[op](data as DocData)));
      queues.set(path, p);
      return p.then(
        () => true,
        e => {
          o.onError(e);
          return false;
        },
      );
    },
    inc: n => o.store().increment(n),
  };
}
