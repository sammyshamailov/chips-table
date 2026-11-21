// Shared helpers for the browser tests. See docs/TESTING.md.
// Needs Node 18+ and Playwright with Chromium (npm i -g playwright && npx playwright install chromium).
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const FAKE = fs.readFileSync(path.join(__dirname, 'fakefs.js'), 'utf8');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

function requirePlaywright(){
  try { return require('playwright'); }
  catch(e){ console.error('Playwright is not installed. Run: npm i -g playwright && npx playwright install chromium'); process.exit(2); }
}

// A tiny static server for the repo folder, so tests don't depend on anything else running.
function serve(){
  return new Promise(ok => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
      const f = path.join(ROOT, path.normalize(p));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() }));
  });
}

// Several independent "phones" (separate browser contexts, so separate localStorage and identity),
// connected through tests/fakefs.js: every write on one phone is copied to the others.
async function phones(browser, n = 2, { width = 390, height = 844, build = 'test-build', scale = 1 } = {}){
  const pages = [], errors = [], hub = { state: '{}' };
  for (let i = 0; i < n; i++){
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.route(/\/config\.js(\?|$)/, r => r.fulfill({ contentType: 'text/javascript', body: `window.FIREBASE_CONFIG={apiKey:"test",projectId:"test"};window.APP_BUILD=${JSON.stringify(build)};` }));
    await ctx.route(/firebase-app-compat\.js/, r => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
    await ctx.route(/firebase-firestore-compat\.js/, r => r.fulfill({ contentType: 'text/javascript', body: '' }));
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errors.push(`phone ${i + 1}: ${e.message}`));
    pages.push(pg);
  }
  for (let i = 0; i < n; i++){
    await pages[i].exposeFunction('__pull', () => hub.state);
    await pages[i].exposeFunction('__push', json => { hub.state = json; return Promise.all(pages.filter((_, j) => j !== i).map(p => p.evaluate(j => window.__apply(j), json).catch(() => {}))); });
  }
  return { pages, errors, db: () => JSON.parse(hub.state) };
}

// Set the chips in hand to an amount, the way the preset buttons do.
const setPending = (pg, v) => pg.evaluate(v => { const b = document.createElement('button'); b.dataset.a = 'setp'; b.dataset.v = v; document.body.appendChild(b); b.click(); b.parentNode.removeChild(b); }, v);
const players = db => Object.entries(db).filter(([k]) => k.includes('/players/')).map(([k, v]) => ({ pid: k.split('/').pop(), ...v }));
const room = db => Object.entries(db).find(([k]) => k.split('/').length === 2)[1];

let failed = 0;
function check(name, ok, detail = ''){
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + detail}`);
  if (!ok) failed++;
}
const failures = () => failed;

module.exports = { ROOT, OUT, requirePlaywright, serve, phones, setPending, players, room, check, failures };
