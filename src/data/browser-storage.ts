/**
 * The phone's key-value storage (localStorage) with every error swallowed: private browsing, a full disk or a
 * blocked storage must never stop the app. Settings, the player's id and name, and single-device mode's database.
 */
import type { KeyValue } from './local-store';

export interface KeyValueStore extends KeyValue {
  del(key: string): void;
}

/** `localStorage`, or nothing when it can't be used. */
export function browserStorage(): KeyValueStore {
  return {
    get(k) {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, v);
      } catch {
        // storage full or blocked: the app works without it
      }
    },
    del(k) {
      try {
        localStorage.removeItem(k);
      } catch {
        // as above
      }
    },
  };
}
