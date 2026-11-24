/**
 * What the classic scripts in index.html put on `window` before the app starts: `config.js` (the Firebase settings
 * and the build, written at deploy by scripts/build-config.js; missing in single-device mode) and the Firebase compat
 * SDK from gstatic.
 */
import type { FirebaseConfig } from './data/connect';
import type { CompatFirebase } from './data/firestore-store';

declare global {
  interface Window {
    /** The deployed commit; compared with the live config.js to update a phone that keeps the app open. */
    APP_BUILD?: string;
    FIREBASE_CONFIG?: FirebaseConfig;
    firebase?: CompatFirebase;
  }
}
