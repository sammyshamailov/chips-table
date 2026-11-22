// Money conservation when the dealer's player writes are slow. Run: node tests/race.test.js
// The dealer's phone writes each player's payout (or refund) after / around the room change. If another player
// bets the instant their phone shows the new betting phase, the dealer's write must not overwrite that bet.
// tests/lib.js holds the dealer's player-document writes back (hub.delay) so the window is wide.
const { requirePlaywright, serve, phones, players, room, check, failures } = require('./lib');

// stacks + bets of the current round + insurance + house; must never change
const total = db => {
  const r = room(db);
  return players(db).reduce((a, p) => a + (p.stack || 0) + (p.bjRound === r.roundId ? (p.hands || []).reduce((x, h) => x + (h.bet || 0), 0) + (p.insurance || 0) : 0), 0) + (r.house || 0);
};

async function scenario(browser, srv, errors0, mode){
  const { pages: [A, B], errors, hub, db } = await phones(browser, 2);
  const wait = ms => A.waitForTimeout(ms);
  await A.goto(srv.url); await wait(300);
  await A.fill('#name', 'סמי');
  await A.click('[data-a=cgame][data-v=blackjack]'); await A.fill('#cmin', '1'); await A.click('#cplay'); await A.click('[data-a=create]'); await wait(500);
  const code = (await A.textContent('.code')).trim();
  await B.goto(srv.url + '#' + code); await wait(500);
  await B.fill('#jname', 'דנה'); await B.click('[data-a=sit]'); await wait(500);
  const ps = players(db()), sami = ps.find(p => p.name === 'סמי'), dana = ps.find(p => p.name === 'דנה');
  const setP = (pg, v) => pg.evaluate(v => { const b = document.createElement('button'); b.dataset.a = 'setp'; b.dataset.v = v; document.body.appendChild(b); b.click(); b.parentNode.removeChild(b); }, v);
  await setP(A, 5); await A.click('[data-a=bjbet]'); await wait(400);
  await setP(B, 10); await B.click('[data-a=bjbet]'); await wait(600);
  const start = total(db());
  check(`[${mode}] start total is 2000`, start === 2000, start);
  await A.click('[data-a=deal]'); await wait(500);

  // Slow dealer connection: the dealer's writes to player documents reach the server 1.5 s late.
  hub.delay = (i, path) => i === 0 && path.includes('/players/') ? 1500 : 0;
  // Dana bets (7) the moment her phone shows the next round's betting phase.
  // (the app's state is private to its script, so the watcher looks for the betting controls in the page)
  await B.evaluate(() => { window.__betted = 0; const t = setInterval(() => {
    const btn = document.querySelector('[data-a=bjbet]');
    if (btn && !window.__betted){
      window.__betted = 1; clearInterval(t);
      const b = document.createElement('button'); b.dataset.a = 'setp'; b.dataset.v = 7; document.body.appendChild(b); b.click(); b.parentNode.removeChild(b);
      document.querySelector('[data-a=bjbet]').click();
    } }, 2); });

  if (mode === 'pay'){
    await A.click('[data-a=sheet][data-v=settle]'); await wait(150);
    await A.click(`[data-v="${dana.pid}:0|win"]`); await A.click(`[data-v="${sami.pid}:0|lose"]`);
    await A.click('[data-a=payout]');
  } else {
    await A.click('[data-a=sheet][data-v=cancel]').catch(() => {}); await wait(150);
    await A.click('[data-a=cancelround]');
  }
  await wait(4000);
  const d = db();
  check(`[${mode}] Dana bet in the new round`, room(d).roundId === 2 && !!players(d).find(p => p.pid === dana.pid).hands.length && await B.evaluate(() => window.__betted) === 1);
  const t = total(d);
  check(`[${mode}] total chips unchanged (stacks + bets + house)`, t === start, `start ${start}, now ${t}: ` + JSON.stringify(players(d).map(p => [p.name, p.stack, p.bjRound, p.hands])) + ' house ' + room(d).house);
  check(`[${mode}] no JavaScript errors`, errors.length === 0, errors.join(' | '));
  await A.context().close(); await B.context().close();
}

(async () => {
  const { chromium } = requirePlaywright();
  const srv = await serve(), browser = await chromium.launch();
  try { await scenario(browser, srv, null, 'pay'); await scenario(browser, srv, null, 'cancel'); }
  catch(e){ check('test ran to the end', false, e.message); }
  await browser.close(); srv.close();
  const f = failures(); console.log(f ? `\n${f} failed` : '\nall passed'); process.exit(f ? 1 : 0);
})();
