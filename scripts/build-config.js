// Writes config.js from Netlify environment variables at deploy time.
// Locally, without these variables, the app falls back to single-device mode.
const fs = require('fs');
const env = process.env;
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
fs.writeFileSync('config.js', 'window.FIREBASE_CONFIG = ' + JSON.stringify(cfg, null, 2) + ';\n');
console.log('config.js written for project ' + cfg.projectId);
