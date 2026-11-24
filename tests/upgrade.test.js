// A phone on the old single-file version upgrades itself into the Vite build. Run: node tests/upgrade.test.js
// The old app (index.html, sw.js, manifest and icons from commit 568fddc, what main ran before R-005) is served and
// opened until its service worker controls the page and has cached the shell. Then the same origin switches to dist/
// with a new APP_BUILD in config.js, the old app notices (its self-update check) and reloads, and the new build must
// run: no page errors, the table opened on the old version still there, a new table can be created, the old cache
// replaced by the new service worker's, and the app still opening offline from that cache.
const { DIST, requirePlaywright, serve, oldApp, check, failures } = require('./lib');

(async () => {
  const { chromium } = requirePlaywright();
  const OLD = oldApp();

  // One origin; the folder it serves and the APP_BUILD in its config.js change mid-test. Single-device mode (no Firebase config).
  let root = OLD, build = 'old-build';
  const files = serve(() => root);
  const srv = await files;
  const http = require('http');
  const proxy = http.createServer((req, res) => {
    if (new URL(req.url, 'http://x').pathname === '/config.js'){ res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' }); res.end(`window.APP_BUILD = ${JSON.stringify(build)};\n`); return; }
    const up = http.request(srv.url.replace(/\/$/, '') + req.url, { method: req.method, headers: req.headers }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on('error', () => { res.writeHead(502); res.end(); }); req.pipe(up);
  });
  await new Promise(ok => proxy.listen(0, '127.0.0.1', ok));
  const url = `http://127.0.0.1:${proxy.address().port}/`;

  const browser = await chromium.launch(), errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.route(/www\.gstatic\.com\/firebasejs\//, r => r.fulfill({ contentType: 'text/javascript', body: '' }));
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errors.push(e.message));
  const cacheKeys = () => pg.evaluate(() => caches.keys());
  const swUrl = () => pg.evaluate(() => navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL);

  // 1. The old version, installed: its service worker controls the page and has cached the shell.
  await pg.goto(url); await pg.evaluate(() => navigator.serviceWorker.ready); await pg.reload(); await pg.waitForTimeout(500);
  check('old app: service worker controls the page', !!(await swUrl()));
  check('old app: shell cached as chips-v6', (await cacheKeys()).includes('chips-v6'), JSON.stringify(await cacheKeys()));
  check('old app: no built assets (it is the single-file version)', !(await pg.$('script[src*="assets/"]')));
  await pg.fill('#name', 'סמי'); await pg.click('[data-a=cgame][data-v=blackjack]'); await pg.click('[data-a=create]'); await pg.waitForTimeout(600);
  const code = (await pg.textContent('.code')).trim();
  check('old app: a table is open', /^[A-Z]{4}$/.test(code), code);

  // 2. Deploy: the origin now serves dist/ with a new APP_BUILD. The old app's update check (on focus) sees it and reloads.
  root = DIST; build = 'new-build';
  const nav = pg.waitForEvent('framenavigated', { timeout: 20000 }).catch(() => null);
  await pg.evaluate(() => window.dispatchEvent(new Event('focus')));
  check('old app reloads itself after the deploy', !!(await nav));
  await pg.waitForLoadState('load'); await pg.waitForTimeout(800);
  check('new build runs (hashed module script)', !!(await pg.$('script[type=module][src*="assets/index-"]')));
  check('new build: the table opened on the old version is shown', (await pg.textContent('.code').catch(() => '')).trim() === code);
  // R-006: the phone's languages list English (Playwright's default locale), but it used the app before: it stays in Hebrew.
  check('new build: a phone that used the app before stays in Hebrew', await pg.evaluate(() => document.documentElement.lang + ' ' + document.documentElement.dir + ' ' + localStorage.getItem('chips.lang')) === 'he rtl he', await pg.evaluate(() => [navigator.languages, document.documentElement.lang, localStorage.getItem('chips.lang')].join(' ')));
  check('new build: Blackjack table rendered', !!(await pg.$('.bjt')));

  // 3. The new service worker takes over and drops the old cache.
  await pg.waitForFunction(() => caches.keys().then(k => !k.includes('chips-v6') && k.some(n => /^chips-[0-9a-f]{10}$/.test(n))), null, { timeout: 20000 }).catch(() => {});
  const keys = await cacheKeys();
  check('new service worker: old cache chips-v6 deleted', !keys.includes('chips-v6'), JSON.stringify(keys));
  check('new service worker: one build cache', keys.length === 1 && /^chips-[0-9a-f]{10}$/.test(keys[0]), JSON.stringify(keys));
  const shell = await pg.evaluate(async () => { const c = await caches.open((await caches.keys())[0]); return (await c.keys()).map(r => new URL(r.url).pathname); });
  check('new cache holds the hashed JS and CSS', shell.some(p => /\/assets\/index-.*\.js$/.test(p)) && shell.some(p => /\/assets\/index-.*\.css$/.test(p)), JSON.stringify(shell));

  // 4. Fresh start on the new version: home renders, a new table can be created.
  await pg.reload(); await pg.waitForTimeout(600);
  check('new build: controlled by the new service worker', /\/sw\.js$/.test(await swUrl() || ''));
  await pg.click('[data-a=sheet][data-v=settings]'); await pg.click('[data-a=home]'); await pg.waitForTimeout(300);
  check('new build: home renders', !!(await pg.$('#name')) && !!(await pg.$('[data-a=create]')));
  await pg.click('[data-a=cgame][data-v=holdem]'); await pg.click('[data-a=create]'); await pg.waitForTimeout(600);
  const code2 = (await pg.textContent('.code').catch(() => '')).trim();
  check('new build: a new table can be created', /^[A-Z]{4}$/.test(code2) && code2 !== code, code2);
  check('new build: new table is Hold\'em', !!(await pg.$('[data-k=pot]')));

  // 5. Offline: the app opens from the new cache.
  await ctx.setOffline(true);
  await pg.reload().catch(() => {}); await pg.waitForTimeout(800);
  check('offline: the app opens from the cache', !!(await pg.$('script[src*="assets/index-"]')) && (await pg.textContent('.code').catch(() => '')).trim() === code2);
  await ctx.setOffline(false);

  check('no page errors', !errors.length, errors.join(' | '));
  await browser.close(); proxy.close(); srv.close();
  console.log(failures() ? `${failures()} check(s) failed` : 'all passed');
  process.exit(failures() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
