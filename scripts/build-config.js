// Writes config.js from Netlify environment variables at deploy time.
// Locally, without these variables, the app falls back to single-device mode.
// Usage: node scripts/build-config.js [folder]   (default: the current folder; Netlify runs it with dist after vite build)
const fs = require('fs');
const path = require('path');
const env = process.env;
const outDir = process.argv[2] || '.';
const required = ['FIREBASE_API_KEY', 'FIREBASE_PROJECT_ID', 'FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_APP_ID'];
const missing = required.filter(k => !env[k]);
if (missing.length) {
  console.error('Missing environment variables: ' + missing.join(', '));
  process.exit(1);
}
const cfg = {
  apiKey: env.FIREBASE_API_KEY,
  authDomain: env.FIREBASE_AUTH_DOMAIN || `${env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: env.FIREBASE_PROJECT_ID,
  storageBucket: env.FIREBASE_STORAGE_BUCKET || `${env.FIREBASE_PROJECT_ID}.firebasestorage.app`,
  messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
  appId: env.FIREBASE_APP_ID
};
// APP_BUILD changes on every deploy; open apps compare it with the live one and update themselves.
const build = (env.COMMIT_REF || String(Date.now())).slice(0, 12);
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, 'config.js');
fs.writeFileSync(file, 'window.FIREBASE_CONFIG = ' + JSON.stringify(cfg, null, 2) + ';\nwindow.APP_BUILD = ' + JSON.stringify(build) + ';\n');
console.log(file + ' written for project ' + cfg.projectId + ', build ' + build);
