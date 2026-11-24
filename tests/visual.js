// Pixel comparison of the screens against tests/baseline/*.png, so "looks the same" is checked, not eyeballed.
//   node tests/visual.js                 compare; a screen that differs fails and leaves tests/out/visual-<name>-{actual,diff}.png
//   node tests/visual.js --update        take new baseline images (only after looking at them: they are the reference)
//   node tests/visual.js --only a,b      only these screens (ONLY=a,b works too); --jobs n screens at a time (default 4)
// Also run by tests/screenshots.js. Single-device mode (no config.js) unless a screen says `cloud` (the two-phone fake
// Firestore) or `build` (a config.js whose APP_BUILD changes: the "new version" button). One fresh context per screen.
// Made deterministic: seeded Math.random and crypto.getRandomValues (room codes, player ids), a fixed start date,
// CSS animations and transitions jumped to their end, no caret, web fonts blocked, deviceScaleFactor 1.
const fs = require('fs');
const path = require('path');
const { OUT, requirePlaywright, serve, setPending } = require('./lib');
const FAKE = fs.readFileSync(path.join(__dirname, 'fakefs.js'), 'utf8');

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

// Lay out and paint the screens the app renders (#app, #sheet) afresh, keeping scroll positions and focus. Chrome
// reuses the layout and paint of elements a render kept (Preact patches the page), and an element that only moved with
// its parent (a row of the fixed bottom dock when the dock grows) can come out 1 px off where a fresh layout puts it:
// sub-pixel snapping, not something a player can see. The picture should show what the page is, not how Chrome got
// there. (The overlays outside them, such as the ceremony, are created afresh by the app and left alone.)
const relayout = pg => pg.evaluate(() => {
  const scrolled = [...document.querySelectorAll('*')].filter(e => e.scrollTop || e.scrollLeft).map(e => [e, e.scrollTop, e.scrollLeft]);
  const x = scrollX, y = scrollY, focused = document.activeElement;
  for (const el of [document.getElementById('app'), document.getElementById('sheet')]){
    const d = el.style.display; el.style.display = 'none'; void el.offsetHeight; el.style.display = d; void el.offsetHeight;
  }
  scrolled.forEach(([e, t, l]) => { e.scrollTop = t; e.scrollLeft = l; }); scrollTo(x, y);
  if (focused && focused !== document.body && focused.focus) focused.focus({ preventScroll: true });
});

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

const P = [390, 844], L = [844, 390];
const w = (pg, ms = 200) => pg.waitForTimeout(ms);

// Set-ups for the screens below. "Me" is the phone's own player (the dealer, who sits at the table unless `play` is off).
async function holdemTable(pg, { play = true, players = ['דנה', 'יוסי', 'מיכל'] } = {}){
  await pg.fill('#name', 'סמי'); if (!play) await pg.click('#cplay'); await pg.click('[data-a=create]'); await w(pg, 300);
  await addPlayers(pg, players);
}
async function bjTable(pg, { play = true, players = ['דנה', 'יוסי'] } = {}){
  await pg.fill('#name', 'סמי'); await pg.click('[data-a=cgame][data-v=blackjack]'); if (play) await pg.click('#cplay'); await pg.click('[data-a=create]'); await w(pg, 300);
  await addPlayers(pg, players);
}
async function claimFirstOther(pg){ const v = await pg.$eval('[data-a=claim]', e => e.dataset.v); await pg.click(`[data-a=claim][data-v="${v}"]`); await w(pg); }
const hostId = pg => pg.evaluate(() => { const db = JSON.parse(localStorage.getItem('chips.localdb')); for (const k in db) if (k.split('/').length === 2) return db[k].hostId; });
async function asHost(pg){ const h = await hostId(pg); await pg.click(`.st[data-v="${h}"]`).catch(() => {}); await w(pg, 300); }
const seatIds = pg => pg.$$eval('.st[data-a=claim]', els => els.map(e => e.dataset.v));
// Sit as `pid` (single-device mode's "play as"), or back as the dealer.
async function as(pg, pid){ await pg.click(`.st[data-v="${pid}"]`); await w(pg, 120); }
// Wait for the toast ("… נוסף לשולחן") to go, so it isn't in the picture depending on timing.
const noToast = pg => pg.waitForFunction(() => document.getElementById('toast').hidden, null, { timeout: 6000 }).catch(() => {});
async function bet(pg, amt){ await setPending(pg, amt); await pg.click('[data-a=bjbet]'); await w(pg, 150); }
// The Blackjack scenario with one player's insurance taken, back as the dealer.
async function bjWithIns(pg){
  await bjScenario(pg);
  const one = await pg.evaluate(() => { const db = JSON.parse(localStorage.getItem('chips.localdb')); const ps = Object.entries(db).filter(([k]) => k.includes('/players/')); const host = Object.entries(db).find(([k]) => k.split('/').length === 2)[1].hostId; const p = ps.find(([k, v]) => v.hands && v.hands.length === 1 && !v.hands[0].doubled && k.split('/').pop() !== host); return p[0].split('/').pop(); });
  await pg.click(`.st[data-v="${one}"]`); await w(pg, 150); await pg.click('[data-a=bj][data-v="ins:0"]'); await w(pg, 1200);
  await asHost(pg);
}
async function endGame(pg){
  await pg.click('[data-a=sheet][data-v=end]'); await w(pg); await pg.click('[data-a=endgame]'); await w(pg, 4500);
}
// Blackjack mid-round: the dealer bets 100 and is paid a blackjack at once, דנה 50 with insurance, יוסי 30 surrenders,
// אבי 20 waits. Back as the dealer.
async function bjMidRound(pg){
  await bjTable(pg, { players: ['דנה', 'יוסי', 'אבי'] });
  const me = await pg.evaluate(() => localStorage.getItem('chips.pid')), [dana, yossi, avi] = await seatIds(pg);
  await bet(pg, 100); await as(pg, dana); await bet(pg, 50); await as(pg, yossi); await bet(pg, 30); await as(pg, avi); await bet(pg, 20);
  await as(pg, me); await pg.click('[data-a=deal]'); await w(pg, 400);
  await as(pg, dana); await pg.click('[data-a=bj][data-v="ins:0"]'); await w(pg, 1000);
  await as(pg, yossi); await pg.click('[data-a=bj][data-v="surrender:0"]'); await w(pg, 1000);
  await as(pg, me); await pg.click('[data-a=sheet][data-v=bjnow]'); await w(pg);
  await pg.click(`[data-a=bjnow][data-v="${me}"]`); await pg.click(`[data-a=bjnow][data-v="${me}"]`); await w(pg, 2500);
  await pg.click('[data-a=close]').catch(() => {}); await w(pg); await noToast(pg);
}
// ...then paid: דנה loses, אבי wins; the result badges over the seats, the next round open.
async function bjPaid(pg){
  await bjMidRound(pg);
  await pg.click('[data-a=sheet][data-v=settle]'); await w(pg);
  await pg.click('[data-a=res][data-v$="|lose"] >> nth=0'); await pg.click('[data-a=allwin]'); await w(pg);
  await pg.click('[data-a=payout]'); await w(pg, 3500);
}

// Hold'em (part C). Seats in joining order: the dealer (me), דנה, יוסי, מיכל; the first hand's button is the dealer,
// דנה the small blind, יוסי the big blind. Anyone may act at any time in single-device mode.
const hIds = pg => pg.$$eval('.seat [data-a=claim]', els => els.map(e => e.dataset.v));
async function hAs(pg, pid){ await pg.click(`.seat [data-a=claim][data-v="${pid}"]`); await w(pg, 150); }
async function hGo(pg, amt = 0){ if (amt) await setPending(pg, amt); await pg.click('[data-a=hgo]'); await w(pg, 900); }
async function hFold(pg){ await pg.click('[data-a=fold]'); await w(pg, 500); }
async function hAllIn(pg){ await pg.click('.dock .presets button:last-child'); await w(pg, 150); await pg.click('[data-a=hgo]'); await w(pg, 900); }
async function hNext(pg){ await pg.click('[data-a=next]'); await w(pg, 400); }
// A hand with the blinds posted; with `avatar`, the dealer picked a character first (an avatar in a seat row).
async function holdemPreflop(pg, { avatar = false } = {}){
  if (avatar){ await pg.click('[data-a=sheet][data-v=avatar]'); await pg.click('[data-a=avset][data-v=tex]'); await w(pg); await pg.click('[data-a=close]'); }
  await holdemTable(pg); await noToast(pg);
  await pg.click('[data-a=newhand]'); await w(pg, 1500);
}
// The flop: everyone called the big blind, then דנה bets 20 and מיכל folds. Seen by מיכל.
async function holdemFold(pg){
  await holdemPreflop(pg);
  const me = await pg.evaluate(() => localStorage.getItem('chips.pid')), [dana, yossi, michal] = await hIds(pg);
  await hGo(pg); await hAs(pg, dana); await hGo(pg); await hAs(pg, yossi); await hGo(pg); await hAs(pg, michal); await hGo(pg);
  await hAs(pg, me); await hNext(pg);
  await hAs(pg, dana); await hGo(pg, 20); await hAs(pg, michal); await hFold(pg);
}
// Three unequal stacks (1000, 600, 300) all in, מיכל folded: a main pot and a side pot. Seen by the dealer.
async function holdemAllIn(pg){
  await holdemTable(pg);
  const [dana, yossi, michal] = await hIds(pg);
  await pg.click('[data-a=sheet][data-v=players]'); await w(pg);
  for (const [pid, take] of [[dana, 400], [yossi, 700]]){ await pg.fill(`[id="adj-${pid}"]`, String(take)); await pg.click(`[data-a=adj][data-v="${pid}|-1"]`); await w(pg, 300); }
  await pg.click('[data-a=close]'); await noToast(pg);
  const me = await pg.evaluate(() => localStorage.getItem('chips.pid'));
  await pg.click('[data-a=newhand]'); await w(pg, 1500);
  await hAllIn(pg); await hAs(pg, dana); await hAllIn(pg); await hAs(pg, yossi); await hAllIn(pg); await hAs(pg, michal); await hFold(pg);
  await hAs(pg, me);
}
async function holdemShowdown(pg){ await holdemAllIn(pg); for (let i = 0; i < 4; i++) await hNext(pg); }

const SCREENS = [
  // The first ten, from before the Vite build (phase 1).
  { name: 'home-empty', size: P, full: true, run: async () => {} },
  { name: 'home-name', size: P, full: true, run: async pg => { await pg.fill('#name', 'סמי'); } },
  { name: 'create-blackjack', size: P, full: true, run: async pg => { await pg.fill('#name', 'סמי'); await pg.click('[data-a=cgame][data-v=blackjack]'); await pg.click('#cplay'); } },
  { name: 'bj-portrait', size: P, run: bjScenario },
  { name: 'bj-landscape', size: L, run: bjScenario },
  { name: 'bj-small-portrait', size: [375, 667], run: bjScenario },
  { name: 'holdem-hand', size: P, full: true, run: holdemScenario },
  { name: 'holdem-landscape', size: L, run: holdemScenario },
  { name: 'sheet-players', size: P, run: async pg => { await holdemScenario(pg); await pg.click('[data-a=sheet][data-v=players]'); } },
  { name: 'sheet-settings', size: P, run: async pg => { await holdemScenario(pg); await pg.click('[data-a=sheet][data-v=settings]'); } },
  // Every sheet and its states, home variants, the closed table, the update screens (R-005 phase 5, part A).
  { name: 'home-rooms', size: P, full: true, run: async pg => { await holdemTable(pg); await pg.click('[data-a=sheet][data-v=settings]'); await pg.click('#sheet [data-a=home]'); await w(pg, 300); } },
  { name: 'home-unsupported', size: P, full: true, run: async pg => {
    await bjTable(pg); await pg.click('[data-a=sheet][data-v=settings]'); await pg.click('#sheet [data-a=home]'); await w(pg, 300);
    await pg.evaluate(() => { const db = JSON.parse(localStorage.getItem('chips.localdb')); for (const k in db) if (k.split('/').length === 2) db[k].appMin = 99; localStorage.setItem('chips.localdb', JSON.stringify(db)); });
    await pg.reload(); await w(pg, 500);
  } },
  { name: 'update-view', size: P, full: true, run: async pg => {
    await bjTable(pg); await pg.click('[data-a=sheet][data-v=settings]'); await pg.click('#sheet [data-a=home]'); await w(pg, 300);
    await pg.evaluate(() => { const db = JSON.parse(localStorage.getItem('chips.localdb')); for (const k in db) if (k.split('/').length === 2) db[k].appMin = 99; localStorage.setItem('chips.localdb', JSON.stringify(db)); });
    await pg.reload(); await w(pg, 500); await pg.click('[data-a=open]'); await w(pg, 500);
  } },
  { name: 'not-found', size: P, full: true, url: '#ZZZZ', run: async pg => { await w(pg, 500); } },
  { name: 'join-holdem', size: P, full: true, run: async pg => { await holdemTable(pg, { play: false }); } },
  { name: 'join-holdem-land', size: L, run: async pg => { await holdemTable(pg, { play: false }); } },
  { name: 'join-bj-host', size: P, full: true, run: async pg => { await bjTable(pg, { play: false }); } },
  { name: 'sheet-avatar-empty', size: P, run: async pg => { await pg.click('[data-a=sheet][data-v=avatar]'); } },
  { name: 'sheet-avatar-set', size: P, run: async pg => { await pg.fill('#name', 'סמי'); await pg.click('[data-a=sheet][data-v=avatar]'); await pg.click('[data-a=avset][data-v=tex]'); await w(pg); } },
  { name: 'home-avatar-set', size: P, full: true, run: async pg => { await pg.fill('#name', 'סמי'); await pg.click('[data-a=sheet][data-v=avatar]'); await pg.click('[data-a=avset][data-v=diva]'); await w(pg); await pg.click('[data-a=close]'); } },
  { name: 'sheet-settle', size: P, run: async pg => { await bjWithIns(pg); await pg.click('[data-a=sheet][data-v=settle]'); await w(pg); await pg.click('[data-a=res] >> nth=1'); await pg.click('[data-a=dbj]'); await w(pg); } },
  { name: 'sheet-settle-all', size: P, run: async pg => { await bjWithIns(pg); await pg.click('[data-a=sheet][data-v=settle]'); await w(pg); await pg.click('[data-a=res] >> nth=3'); await pg.click('[data-a=allwin]'); await w(pg); } },
  { name: 'sheet-settle-land', size: L, run: async pg => { await bjWithIns(pg); await pg.click('[data-a=sheet][data-v=settle]'); await w(pg); } },
  { name: 'sheet-bjnow', size: P, run: async pg => { await bjScenario(pg); await asHost(pg); await pg.click('[data-a=sheet][data-v=bjnow]'); await w(pg); await pg.click('[data-a=bjnow] >> nth=1'); await w(pg); } },
  { name: 'sheet-end-busy', size: P, run: async pg => { await bjScenario(pg); await asHost(pg); await pg.click('[data-a=sheet][data-v=end]'); await w(pg); } },
  { name: 'sheet-end', size: P, run: async pg => { await holdemTable(pg); await pg.click('[data-a=sheet][data-v=end]'); await w(pg); } },
  { name: 'sheet-cancel-bj', size: P, run: async pg => { await bjScenario(pg); await asHost(pg); await pg.click('[data-a=sheet][data-v=cancel]'); await w(pg); } },
  { name: 'sheet-cancel-holdem', size: P, run: async pg => { await holdemScenario(pg); await pg.click('[data-a=sheet][data-v=cancel]'); await w(pg); } },
  { name: 'sheet-award', size: P, run: async pg => { await holdemScenario(pg); await pg.click('[data-a=sheet][data-v=award]'); await w(pg); await pg.click('[data-a=pick] >> nth=1'); await w(pg); } },
  { name: 'sheet-award-two', size: P, run: async pg => { await holdemScenario(pg); await pg.click('[data-a=sheet][data-v=award]'); await w(pg); await pg.click('[data-a=pick] >> nth=0'); await pg.click('[data-a=pick] >> nth=2'); await w(pg); } },
  { name: 'ceremony', size: P, run: async pg => { await holdemScenario(pg); await pg.click('[data-a=sheet][data-v=cancel]'); await pg.click('[data-a=cancelhand]'); await w(pg, 1200); await endGame(pg); } },
  { name: 'final-card', size: P, full: true, run: async pg => { await holdemTable(pg); await endGame(pg); await pg.click('[data-a=finclose]'); await w(pg, 2200); } },
  { name: 'final-card-bj-land', size: L, run: async pg => { await bjTable(pg); await endGame(pg); await pg.click('[data-a=finclose]'); await w(pg, 2200); } },
  { name: 'final-card-guest', size: P, full: true, run: async pg => { await holdemTable(pg); await endGame(pg); await pg.click('[data-a=finclose]'); await w(pg, 300); await claimFirstOther(pg); await w(pg, 2000); } },
  { name: 'settings-guest', size: P, run: async pg => { await holdemScenario(pg); await claimFirstOther(pg); await pg.click('[data-a=sheet][data-v=settings]'); await w(pg); } },
  { name: 'players-guest', size: P, run: async pg => { await holdemScenario(pg); await claimFirstOther(pg); await pg.click('[data-a=sheet][data-v=players]'); await w(pg); } },
  { name: 'players-bj-remove', size: P, run: async pg => { await bjTable(pg); await pg.click('[data-a=sheet][data-v=players]'); await w(pg); await pg.click('[data-a=remove] >> nth=1'); await w(pg); } },
  { name: 'settings-bj', size: P, run: async pg => { await bjTable(pg); await pg.click('[data-a=sheet][data-v=settings]'); await w(pg); } },
  { name: 'settings-bj-busy-land', size: L, run: async pg => { await bjScenario(pg); await pg.click('[data-a=sheet][data-v=settings]'); await w(pg); } },
  { name: 'snd-off', size: P, run: async pg => { await holdemScenario(pg); await pg.click('[data-a=snd]'); await w(pg, 300); } },
  { name: 'toast-home', size: P, run: async pg => { await pg.click('[data-a=join]'); await w(pg, 200); } },
  { name: 'install', size: P, full: true, run: async pg => { await pg.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); window.dispatchEvent(e); }); await w(pg); } },
  { name: 'cloud-home', size: P, full: true, cloud: true, run: async pg => { await pg.fill('#name', 'סמי'); } },
  { name: 'cloud-table', size: P, full: true, cloud: true, run: async pg => { await holdemTable(pg); } },
  { name: 'cloud-table-land', size: L, cloud: true, run: async pg => { await bjTable(pg); } },
  { name: 'update-available', size: P, build: true, run: async pg => { await bjTable(pg); await setPending(pg, 50); await w(pg); await pg.evaluate(() => window.dispatchEvent(new Event('focus'))); await w(pg, 600); } },
  { name: 'update-available-settings', size: P, build: true, run: async pg => { await bjTable(pg); await setPending(pg, 50); await w(pg); await pg.evaluate(() => window.dispatchEvent(new Event('focus'))); await w(pg, 600); await pg.click('[data-a=sheet][data-v=settings]'); await w(pg); } },
  { name: 'update-available-land', size: L, build: true, run: async pg => { await bjTable(pg); await setPending(pg, 50); await w(pg); await pg.evaluate(() => window.dispatchEvent(new Event('focus'))); await w(pg, 600); } },
  // Blackjack states (R-005 phase 5, part B): chips in hand on your spot, insurance, a surrender, a blackjack paid at
  // once, the result badges after a payout, no bet this round, a crowded table, an empty one, the closed table.
  { name: 'bj-chips-in-hand', size: P, run: async pg => {
    await bjTable(pg); const [dana] = await seatIds(pg), me = await pg.evaluate(() => localStorage.getItem('chips.pid'));
    await as(pg, dana); await bet(pg, 40); await as(pg, me); await noToast(pg);
    for (const n of [3, 3, 1, 0]){ await pg.click(`.tray .chip >> nth=${n}`); await w(pg, 450); }
  } },
  { name: 'bj-mid-round', size: P, run: bjMidRound },
  { name: 'bj-mid-round-land', size: L, run: bjMidRound },
  { name: 'bj-paid', size: P, run: bjPaid },
  { name: 'bj-paid-land', size: L, run: bjPaid },
  { name: 'bj-no-bet-land', size: L, run: async pg => {
    await bjTable(pg); const [dana] = await seatIds(pg), me = await pg.evaluate(() => localStorage.getItem('chips.pid'));
    await as(pg, dana); await bet(pg, 40); await as(pg, me); await pg.click('[data-a=deal]'); await w(pg, 600); await noToast(pg);
  } },
  { name: 'bj-crowded', size: P, run: async pg => { await bjTable(pg, { players: ['דנה', 'יוסי', 'מיכל', 'אבי', 'רונית', 'שלומי', 'נועה', 'עידו'] }); await noToast(pg); } },
  { name: 'bj-empty-land', size: L, run: async pg => { await bjTable(pg, { play: false, players: [] }); } },
  { name: 'bj-closed', size: P, full: true, run: async pg => { await bjTable(pg); await endGame(pg); await pg.click('[data-a=finclose]'); await w(pg, 2200); } },
  // Hold'em states (R-005 phase 5, part C): blinds posted (an avatar in a row), short of the call, under the minimum
  // raise, a fold on the flop, all-in with unequal stacks, the showdown, the side pot in the award sheet, everyone
  // folded to one player, between hands, sitting out, waiting for the next hand, a small phone, an empty table.
  { name: 'holdem-preflop', size: P, full: true, run: async pg => { await holdemPreflop(pg, { avatar: true }); } },
  { name: 'holdem-short', size: P, run: async pg => { await holdemPreflop(pg); await setPending(pg, 5); await w(pg); } },
  { name: 'holdem-min-raise', size: P, run: async pg => { await holdemPreflop(pg); await setPending(pg, 15); await w(pg); } },
  { name: 'holdem-fold', size: P, full: true, run: holdemFold },
  { name: 'holdem-fold-land', size: L, run: holdemFold },
  { name: 'holdem-allin', size: P, full: true, run: holdemAllIn },
  { name: 'holdem-allin-land', size: L, run: holdemAllIn },
  { name: 'holdem-showdown', size: P, full: true, run: holdemShowdown },
  { name: 'holdem-award-side', size: P, run: async pg => {
    await holdemShowdown(pg); const [, yossi] = await hIds(pg);
    await pg.click('[data-a=sheet][data-v=award]'); await w(pg); await pg.click(`[data-a=pick][data-v="${yossi}"]`); await w(pg);
    await pg.click('[data-a=award]'); await w(pg, 1500); await noToast(pg);
  } },
  { name: 'holdem-solo', size: P, run: async pg => {
    await holdemPreflop(pg); const me = await pg.evaluate(() => localStorage.getItem('chips.pid'));
    for (const pid of await hIds(pg)){ await hAs(pg, pid); await hFold(pg); }
    await hAs(pg, me);
  } },
  { name: 'holdem-between', size: P, full: true, run: async pg => {
    await holdemPreflop(pg); const me = await pg.evaluate(() => localStorage.getItem('chips.pid'));
    for (const pid of await hIds(pg)){ await hAs(pg, pid); await hFold(pg); }
    await hAs(pg, me); await pg.click('[data-a=solo]'); await w(pg, 1500);
  } },
  { name: 'holdem-sitout', size: P, full: true, run: async pg => {
    await holdemTable(pg); const [, , michal] = await hIds(pg);
    await pg.click('[data-a=sheet][data-v=players]'); await w(pg); await pg.click(`[data-a=sitout][data-v="${michal}"]`); await w(pg, 300); await pg.click('[data-a=close]'); await noToast(pg);
    await pg.click('[data-a=newhand]'); await w(pg, 1500); await hAs(pg, michal);
  } },
  { name: 'holdem-waiting', size: P, full: true, run: async pg => {
    await holdemPreflop(pg); await addPlayers(pg, ['רונית']); await noToast(pg);
    const ids = await hIds(pg); await hAs(pg, ids[ids.length - 1]);
  } },
  { name: 'holdem-small', size: [375, 667], run: holdemScenario },
  { name: 'holdem-empty', size: P, full: true, run: async pg => { await holdemTable(pg, { play: false, players: [] }); } },
  // The turn-the-phone prompt (R-005 phase 6): a phone held upright (touch, coarse pointer) inside a table.
  { name: 'rotate', size: P, touch: true, run: async pg => { await pg.fill('#name', 'סמי'); await pg.click('[data-a=create]'); await w(pg, 500); } },
];

// Every screen again in English (R-006): a phone whose languages list English first, so it starts in English, with the
// players' names typed in English. The table is the same picture (not mirrored); the words and the side panel follow
// the language. The Hebrew screens above are the reference for the Hebrew version.
const NAMES_EN = { 'סמי': 'Sam', 'דנה': 'Dana', 'יוסי': 'Yossi', 'מיכל': 'Michal', 'אבי': 'Avi', 'רונית': 'Ronit', 'שלומי': 'Shlomi', 'נועה': 'Noa', 'עידו': 'Ido' };
SCREENS.push(...SCREENS.map(s => ({ ...s, name: s.name + '-en', lang: 'en' })));

async function shoot(browser, url, s, errors){
  const ctx = await browser.newContext({ viewport: { width: s.size[0], height: s.size[1] }, deviceScaleFactor: 1, serviceWorkers: 'block', locale: s.lang === 'en' ? 'en-US' : 'he-IL', timezoneId: 'Asia/Jerusalem', reducedMotion: 'no-preference', hasTouch: !!s.touch, isMobile: !!s.touch });
  await ctx.addInitScript(FREEZE);
  await ctx.route(/gstatic|googleapis/, r => r.abort());
  if (s.cloud){
    await ctx.route(/\/config\.js(\?|$)/, r => r.fulfill({ contentType: 'text/javascript', body: 'window.FIREBASE_CONFIG={apiKey:"test",projectId:"test"};window.APP_BUILD="abcdef123";' }));
    await ctx.route(/firebase-app-compat\.js/, r => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
    await ctx.route(/firebase-firestore-compat\.js/, r => r.fulfill({ contentType: 'text/javascript', body: '' }));
  }
  if (s.build){
    let n = 0;
    await ctx.route(/\/config\.js(\?|$)/, r => r.fulfill({ contentType: 'text/javascript', body: `window.APP_BUILD="${n++ ? 'bbbb2222' : 'aaaa1111'}";` }));
  }
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errors.push(`${s.name}: ${e.message}`));
  if (s.lang === 'en'){ const fill = pg.fill.bind(pg); pg.fill = (sel, v, o) => fill(sel, NAMES_EN[v] || v, o); }
  await pg.goto(url + (s.url || '')); await pg.waitForTimeout(300);
  await s.run(pg);
  await settle(pg);
  await pg.mouse.move(0, 0);
  await relayout(pg);
  const png = await pg.screenshot({ fullPage: !!s.full });
  await ctx.close();
  return png;
}

async function compare(name, actual, base = BASE){
  const { PNG } = require('pngjs');
  const pixelmatch = (await import('pixelmatch')).default;
  const file = path.join(base, name + '.png');
  if (!fs.existsSync(file)) return { ok: false, detail: 'no baseline (run with --update)' };
  const a = PNG.sync.read(fs.readFileSync(file)), b = PNG.sync.read(actual);
  const save = () => fs.writeFileSync(path.join(OUT, `visual-${name}-actual.png`), actual);
  if (a.width !== b.width || a.height !== b.height){ save(); return { ok: false, detail: `size ${b.width}x${b.height}, baseline ${a.width}x${a.height}` }; }
  const diff = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: THRESHOLD });
  if (n > MAX_DIFF){ save(); fs.writeFileSync(path.join(OUT, `visual-${name}-diff.png`), PNG.sync.write(diff)); }
  return { ok: n <= MAX_DIFF, n };
}

const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };

// Returns the number of failed screens (or page errors). `only`: screen names; `jobs`: screens shot at the same time;
// `dist`: the folder to serve (the build by default); `baseline`: the folder of reference images (tests/baseline/).
async function run({ update = false, browser: given, url: givenUrl, only = null, jobs = 4, dist, baseline = BASE, quiet = false } = {}){
  fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(baseline, { recursive: true });
  const { chromium } = requirePlaywright();
  const srv = givenUrl ? null : await serve(dist), url = givenUrl || srv.url;
  const browser = given || await chromium.launch(), errors = [];
  const list = only ? SCREENS.filter(s => only.includes(s.name)) : SCREENS;
  if (only) only.filter(n => !SCREENS.some(s => s.name === n)).forEach(n => { console.log(`FAIL  visual ${n}  no such screen`); errors.push(n + ': no such screen'); });
  const lines = new Array(list.length);
  let failed = 0, next = 0;
  const worker = async () => {
    while (next < list.length){
      const i = next++, s = list[i];
      const png = await shoot(browser, url, s, errors);
      fs.writeFileSync(path.join(OUT, `visual-${s.name}.png`), png);
      if (update){ fs.writeFileSync(path.join(baseline, s.name + '.png'), png); lines[i] = 'baseline ' + s.name; }
      else {
        const r = await compare(s.name, png, baseline);
        lines[i] = `${r.ok ? 'PASS' : 'FAIL'}  visual ${s.name}${r.n != null ? ` (${r.n} px differ)` : ''}${r.ok ? '' : '  ' + (r.detail || 'see tests/out/visual-' + s.name + '-diff.png')}`;
        if (!r.ok) failed++;
      }
      if (!quiet) console.log(lines[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, jobs) }, worker));
  if (!given) await browser.close();
  if (srv) srv.close();
  if (errors.length){ console.log('page errors:\n' + errors.join('\n')); failed += errors.length; }
  return failed;
}

module.exports = { run, SCREENS };

if (require.main === module){
  const only = (arg('--only') || process.env.ONLY || '').split(',').filter(Boolean);
  run({ update: process.argv.includes('--update'), only: only.length ? only : null, jobs: Number(arg('--jobs')) || 4 })
    .then(f => { console.log(f ? `${f} visual check(s) failed` : 'visual: all screens match'); process.exit(f ? 1 : 0); }, e => { console.error(e); process.exit(1); });
}
