/**
 * Picks the store at start-up, exactly as the app always has: Firestore when `config.js` holds a real Firebase
 * config and the compat SDK has loaded, otherwise single-device mode. Synchronous on purpose: the app renders its
 * first screen in the same tick (CLAUDE.md rule 2).
 */
import { createFirestoreStore, type CompatFirebase } from './firestore-store';
import { createLocalStore, type KeyValue } from './local-store';
import type { Store } from './store';

/** `window.FIREBASE_CONFIG` from `config.js` (the template's placeholders start with `PASTE`). */
export interface FirebaseConfig {
  apiKey?: unknown;
  projectId?: unknown;
  [key: string]: unknown;
}

/** `cloud`: Firestore, shared between phones. `local`: this phone only. */
export type StoreMode = 'cloud' | 'local';

/** The store to use and which kind it is. */
export function connect(
  config: FirebaseConfig | null | undefined,
  firebase: CompatFirebase | null | undefined,
  storage: KeyValue,
): { store: Store; mode: StoreMode } {
  let store: Store | null = null;
  try {
    if (config && config.projectId && !String(config.apiKey).startsWith('PASTE') && firebase)
      store = createFirestoreStore(firebase, config);
  } catch (e) {
    console.error(e);
  }
  return store ? { store, mode: 'cloud' } : { store: createLocalStore(storage), mode: 'local' };
}
