// R-016: tapping on the table, on two phones. Run: node tests/tap.test.js
// A presses the button: a hand taps near A's seat on both phones, nothing but `tap` is written, a second press inside
// the 2 s cooldown writes nothing, a reloaded phone doesn't replay the old tap, and an unseated dealer's tap shows at the dealer's rack.
const { requirePlaywright, serve, phones, players, room, openTable, check, failures } = require('./lib');

(async () => {
  const { chromium } = requirePlaywright();
  const srv = await serve(), browser = await chromium.launch(), allErrors = [];
  const handAt = (pg, k) => pg.evaluate(k => {      // the first hand on #fx: where its fingertip lands vs the [data-k] element
    const h = document.querySelector('#fx .hand'); if (!h) return null;
    const el = document.querySelector('[data-k="' + k + '"]'); if (!el) return { hand: true };
    const b = el.getBoundingClientRect(), u = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u'));
    const x = parseFloat(h.style.left) - scrollX, y = parseFloat(h.style.top) - scrollY;
    return { hand: true, pid: h.dataset.pid, dist: Math.hypot(x - (b.left + b.width / 2), y - (b.top + b.height / 2)) / u, svg: !!h.querySelector('svg') };
  }, k);
  const hands = pg => pg.evaluate(() => document.querySelectorAll('#fx .hand').length);
  try {
    // 1. Sami (dealer, plays) and Dana: both bet; Sami taps.
    {
      const { pages: [A, B], errors, hub, db } = await phones(browser, 2, { height: 1100 });
      const wait = ms => A.waitForTimeout(ms); [A, B].forEach(pg => pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); }));
      const { ids } = await openTable([A, B], srv.url, { game: 'blackjack', settings: { min: 1 }, names: ['סמי', 'דנה'], play: true, db });
      const sami = ids['סמי'], dana = ids['דנה'];
      check('tap button in the betting dock on both phones', await A.isVisible('.dock [data-a=tap]') && await B.isVisible('.dock [data-a=tap]'));
      await setBet(A, 10); await setBet(B, 25); await wait(500);
      check('button has an aria-label and the label דפיקה', (await A.getAttribute('[data-a=tap]', 'aria-label')) && (await A.textContent('[data-a=tap]')).includes('דפיקה'));
      const before = players(db()).find(p => p.pid === sami), writes0 = hub.writes.length;
      await A.click('[data-a=tap]'); await wait(450);
      const t1 = players(db()).find(p => p.pid === sami);
      check('the tap is stored as a number', typeof t1.tap === 'number');
      const tw = hub.writes.slice(writes0).filter(x => x.path.endsWith('/' + sami) || x.path.includes('/' + sami));
      check('only `tap` is written (no lastAction/ts)', tw.length === 1 && JSON.stringify(Object.keys(tw[0].data)) === '["tap"]', JSON.stringify(tw.map(x => x.data)));
      check('lastAction and ts unchanged', JSON.stringify(t1.lastAction) === JSON.stringify(before.lastAction) && t1.ts === before.ts);
      const hb = await handAt(B, 'seat:' + sami), ha = await handAt(A, 'seat:' + sami);
      check('the other phone shows a hand near the seat', !!hb && hb.svg && hb.dist < 13, JSON.stringify(hb));
      check('the pressing phone shows it too (from the snapshot)', !!ha && ha.svg && ha.dist < 13, JSON.stringify(ha));
      check('exactly one hand per phone', await hands(A) === 1 && await hands(B) === 1, `${await hands(A)} / ${await hands(B)}`);
      check('the button is dimmed while cooling down', await A.isDisabled('[data-a=tap]'));
      // inside the 2 s cooldown: a forced press writes nothing
      const n1 = hub.writes.length;
      await A.evaluate(() => { const b = document.createElement('button'); b.dataset.a = 'tap'; document.body.appendChild(b); b.click(); b.remove(); }); await wait(200);
      check('a press during the cooldown writes nothing', hub.writes.length === n1 && players(db()).find(p => p.pid === sami).tap === t1.tap);
      await wait(1500);
      check('hands are removed when done', await hands(A) === 0 && await hands(B) === 0, `${await hands(A)} / ${await hands(B)}`);
      await wait(500);
      check('the button is enabled again after the cooldown', !(await A.isDisabled('[data-a=tap]')));
      await A.click('[data-a=tap]'); await wait(300);
      const t2 = players(db()).find(p => p.pid === sami).tap;
      check('a press after the cooldown works', t2 > t1.tap && await hands(B) === 1, `${t1.tap} -> ${t2}`);
      // Dana and Sami at once: two hands
      await wait(2200); await A.click('[data-a=tap]'); await B.click('[data-a=tap]'); await wait(350);
      check('two players tapping at once show two hands on each phone', await hands(A) === 2 && await hands(B) === 2, `${await hands(A)} / ${await hands(B)}`);
      // a reloaded phone must not replay
      await wait(2200);
      await B.reload(); let seen = 0; for (let i = 0; i < 12; i++){ await B.waitForTimeout(100); seen += await hands(B); }
      check('a reloaded phone does not replay old taps', seen === 0 && await B.isVisible('.dock'), 'hands seen ' + seen);
      // dock in the other branches: playing phase, and not betting
      await A.click('[data-a=deal]'); await wait(500);
      check('the button is in the dock after the deal too', await A.isVisible('.dock [data-a=tap]') && await B.isVisible('.dock [data-a=tap]'));
      check('no page errors (table 1)', errors.length === 0, errors.join(' | '));
      allErrors.push(...errors);
      for (const c of A.context().browser().contexts()) await c.close();
    }
    // 2. An unseated dealer taps: the hand shows at the dealer's rack on the player's phone.
    {
      const { pages: [A, B], errors, hub, db } = await phones(browser, 2, { height: 1100 });
      const wait = ms => A.waitForTimeout(ms); [A, B].forEach(pg => pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); }));
      const { code } = await openTable([A, B], srv.url, { game: 'blackjack', settings: { min: 1 }, names: ['סמי', 'דנה'], play: false, db });
      check('an unseated dealer has the button in the dealer controls', await A.isVisible('.host [data-a=tap]') && !(await A.isVisible('.dock')));
      const w0 = hub.writes.length;
      await A.click('.host [data-a=tap]'); await wait(450);
      const w1 = hub.writes.slice(w0);
      check('the room gets only dealerTap', w1.length === 1 && w1[0].path === 'rooms/' + code && JSON.stringify(Object.keys(w1[0].data)) === '["dealerTap"]', JSON.stringify(w1));
      check('the player sees the hand at the dealer rack', await B.evaluate(() => { const h = document.querySelector('#fx .hand'); return !!h && h.dataset.pid === 'dealer'; }));
      const hd = await handAt(B, 'dealer'); check('close to the rack', !!hd && hd.dist < 26, JSON.stringify(hd));
      check('the dealer sees their own hand', await hands(A) === 1);
      check('player table has no button for the dealer on the player phone', !(await B.isVisible('.host')));
      check('no page errors (table 2)', errors.length === 0, errors.join(' | ')); allErrors.push(...errors);
      for (const c of A.context().browser().contexts()) await c.close();
    }
    // 3. Hold'em has no tap button.
    {
      const { pages: [A, B], errors, db } = await phones(browser, 2, { height: 900 });
      await openTable([A, B], srv.url, { game: 'holdem', names: ['סמי', 'דנה'], db });
      check("Hold'em has no tap button", !(await A.isVisible('[data-a=tap]')) && !(await B.isVisible('[data-a=tap]')));
      check('no page errors (hold\'em)', errors.length === 0, errors.join(' | ')); allErrors.push(...errors);
    }
  } catch(e){ check('test ran to the end', false, e.stack || e.message); }
  await browser.close(); srv.close();
  const f = failures(); console.log(f ? `\n${f} failed` : '\nall passed'); process.exit(f ? 1 : 0);
})();

async function setBet(pg, amt){
  await pg.evaluate(v => { const b = document.createElement('button'); b.dataset.a = 'setp'; b.dataset.v = v; document.body.appendChild(b); b.click(); b.remove(); }, amt);
  await pg.waitForTimeout(100); await pg.click('[data-a=bjbet]');
}
