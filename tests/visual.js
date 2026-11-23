// Pixel comparison of the main screens against tests/baseline/*.png, so "looks the same" is checked, not eyeballed.
//   node tests/visual.js            compare; a screen that differs fails and leaves tests/out/visual-<name>-{actual,diff}.png
//   node tests/visual.js --update   take new baseline images (only after looking at them: they are the reference)
// Also run by tests/screenshots.js. Single-device mode (no config.js), one fresh browser context per screen.
// Made deterministic: seeded Math.random and crypto.getRandomValues (room codes, player ids), a fixed start date,
// CSS animations and transitions jumped to their end, no caret, web fonts blocked, deviceScaleFactor 1.
const fs = require('fs');
const path = require('path');
const { OUT, requirePlaywright, serve, setPending } = require('./lib');

const BASE = path.join(__dirname, 'baseline');
const MAX_DIFF = 0;            // differing pixels allowed per screen (after pixelmatch's own anti-aliasing tolerance)
const THRESHOLD = 0.1;         // pixelmatch colour threshold (0..1)

const FREEZE = () => {
  const seeded = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  Math.random = seeded(0x2f6b1d);
  const bytes = seeded(0x51ed27);
  Object.defineProperty(crypto, 'getRandomValues', { value: a => { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); for (let i = 0; i < u.length; i++) u[i] = Math.floor(bytes() * 256); return a; } });
  const realNow = Date.now.bind(Date), t0 = realNow(), FIXED = Date.UTC(2026, 10, 20, 19, 0, 0);
  Date.now = () => FIXED + (realNow() - t0);
  const css = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}';
  const add = () => { const s = document.createElement('style'); s.textContent = css; document.documentElement.appendChild(s); };
  if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add);
};

// Wait until nothing is flying: the #fx layer is empty and no finite animation is still running.
async function settle(pg){
  await pg.waitForTimeout(150);
  await pg.waitForFunction(() => !document.querySelector('#fx').children.length && !document.getAnimations().some(a => a.playState === 'running' && a.effect && a.effect.getComputedTiming().endTime !== Infinity), null, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(150);
}

async function addPlayers(pg, names){
  for (const n of names){ await pg.click('[data-a=sheet][data-v=players]'); await pg.fill('#newp', n); await pg.click('[data-a=addp]'); await pg.waitForTimeout(60); await pg.click('[data-a=close]'); }
}

// The Blackjack scenario of tests/screenshots.js: seven players, a split and a double.
async function bjScenario(pg){
  await pg.fill('#name', 'סמי'); await pg.click('[data-a=cgame][data-v=blackjack]'); await pg.click('#cplay'); await pg.click('[data-a=create]'); await pg.waitForTimeout(300);
  await addPlayers(pg, ['דנה', 'יוסי', 'מיכל', 'אבי', 'רונית', 'שלומי']);
  const me = await pg.evaluate(() => localStorage.getItem('chips.pid'));
  const others = await pg.$$eval('.st[data-a=claim]', els => els.map(e => e.dataset.v));
  const bets = [150, 25, 500, 60, 15, 250, 35];
  await setPending(pg, bets[0]); await pg.click('[data-a=bjbet]'); await pg.waitForTimeout(150);
  for (let i = 0; i < others.length; i++){ await pg.click(`.st[data-v="${others[i]}"]`); await pg.waitForTimeout(60); await setPending(pg, bets[i + 1]); await pg.click('[data-a=bjbet]'); await pg.waitForTimeout(120); }
  await pg.click(`.st[data-v="${me}"]`).catch(() => {}); await pg.waitForTimeout(200);
  await pg.click('[data-a=deal]'); await pg.waitForTimeout(400);
  await pg.click(`.st[data-v="${others[0]}"]`); await pg.click('[data-a=bj][data-v="split:0"]'); await pg.waitForTimeout(1300);
  await pg.click('[data-a=bj][data-v="double:1"]'); await pg.waitForTimeout(1200);
}

// Hold'em mid-hand: the dealer plays, three added players, blinds posted, the dealer raises to 30.
async function holdemScenario(pg){
  await pg.fill('#name', 'סמי'); await pg.click('[data-a=create]'); await pg.waitForTimeout(300);
  await addPlayers(pg, ['דנה', 'יוסי', 'מיכל']);
  await pg.click('[data-a=newhand]'); await pg.waitForTimeout(1500);
  await setPending(pg, 30); await pg.waitForTimeout(100); await pg.click('[data-a=hgo]'); await pg.waitForTimeout(1500);
}

const P = [390, 844];
const SCREENS = [
  { name: 'home-empty', size: P, full: true, run: async () => {} },
  { name: 'home-name', size: P, full: true, run: async pg => { await pg.fill('#name', 'סמי'); } },
  { name: 'create-blackjack', size: P, full: true, run: async pg => { await pg.fill('#name', 'סמי'); await pg.click('[data-a=cgame][data-v=blackjack]'); await pg.click('#cplay'); } },
  { name: 'bj-portrait', size: P, run: bjScenario },
  { name: 'bj-landscape', size: [844, 390], run: bjScenario },
  { name: 'bj-small-portrait', size: [375, 667], run: bjScenario },
  { name: 'holdem-hand', size: P, full: true, run: holdemScenario },
  { name: 'holdem-landscape', size: [844, 390], run: holdemScenario },
  { name: 'sheet-players', size: P, run: async pg => { await holdemScenario(pg); await pg.click('[data-a=sheet][data-v=players]'); } },
  { name: 'sheet-settings', size: P, run: async pg => { await holdemScenario(pg); await pg.click('[data-a=sheet][data-v=settings]'); } }
];

async function shoot(browser, url, s, errors){
  const ctx = await browser.newContext({ viewport: { width: s.size[0], height: s.size[1] }, deviceScaleFactor: 1, serviceWorkers: 'block', locale: 'he-IL', timezoneId: 'Asia/Jerusalem', reducedMotion: 'no-preference' });
  await ctx.addInitScript(FREEZE);
  await ctx.route(/gstatic|googleapis/, r => r.abort());
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errors.push(`${s.name}: ${e.message}`));
  await pg.goto(url); await pg.waitForTimeout(300);
  await s.run(pg);
  await settle(pg);
  await pg.mouse.move(0, 0);
  const png = await pg.screenshot({ fullPage: !!s.full });
  await ctx.close();
  return png;
}

async function compare(name, actual){
  const { PNG } = require('pngjs');
  const pixelmatch = (await import('pixelmatch')).default;
  const file = path.join(BASE, name + '.png');
  if (!fs.existsSync(file)) return { ok: false, detail: 'no baseline (run with --update)' };
  const a = PNG.sync.read(fs.readFileSync(file)), b = PNG.sync.read(actual);
  const save = () => fs.writeFileSync(path.join(OUT, `visual-${name}-actual.png`), actual);
  if (a.width !== b.width || a.height !== b.height){ save(); return { ok: false, detail: `size ${b.width}x${b.height}, baseline ${a.width}x${a.height}` }; }
  const diff = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: THRESHOLD });
  if (n > MAX_DIFF){ save(); fs.writeFileSync(path.join(OUT, `visual-${name}-diff.png`), PNG.sync.write(diff)); }
  return { ok: n <= MAX_DIFF, n };
}

// Returns the number of failed screens (or page errors).
async function run({ update = false, browser: given, url: givenUrl } = {}){
  fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(BASE, { recursive: true });
  const { chromium } = requirePlaywright();
  const srv = givenUrl ? null : await serve(), url = givenUrl || srv.url;
  const browser = given || await chromium.launch(), errors = [];
  let failed = 0;
  for (const s of SCREENS){
    const png = await shoot(browser, url, s, errors);
    fs.writeFileSync(path.join(OUT, `visual-${s.name}.png`), png);
    if (update){ fs.writeFileSync(path.join(BASE, s.name + '.png'), png); console.log('baseline', s.name); continue; }
    const r = await compare(s.name, png);
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  visual ${s.name}${r.n != null ? ` (${r.n} px differ)` : ''}${r.ok ? '' : '  ' + (r.detail || 'see tests/out/visual-' + s.name + '-diff.png')}`);
    if (!r.ok) failed++;
  }
  if (!given) await browser.close();
  if (srv) srv.close();
  if (errors.length){ console.log('page errors:\n' + errors.join('\n')); failed += errors.length; }
  return failed;
}

module.exports = { run, SCREENS };

if (require.main === module){
  run({ update: process.argv.includes('--update') }).then(f => { console.log(f ? `${f} visual check(s) failed` : 'visual: all screens match'); process.exit(f ? 1 : 0); }, e => { console.error(e); process.exit(1); });
}
