// Guard against table types a phone doesn't understand (R-009). Run: node tests/guard.test.js
// 1) a room with appMin above FEATURE_LEVEL, or an unknown mode, shows the update screen and the phone never writes to it.
// 2) mode 'chips' and a room with neither field behave as before.
// 3) legacy proof: a Blackjack room with phase 'cards' and a Hold'em room with stage 'cards' (what card tables will set
//    for phones older than the guard): what can today's code still write?
const { requirePlaywright, serve, phones, players, check, failures } = require('./lib');

const base = (code, extra = {}) => ({ code, game: 'blackjack', startStack: 1000, sb: 5, bb: 10, minBet: 1, maxBet: 0, hostId: 'p_host', hostName: 'דילר', createdAt: Date.now(), updatedAt: Date.now(),
  handId: 0, streetId: 0, stage: 'idle', potLevel: 0, buttonPid: null, roundId: 1, phase: 'betting', house: 0, dealerBJ: false, lastEvent: { t: 'השולחן נפתח', ts: Date.now() }, ...extra });
const player = (name, extra = {}) => ({ name, joinedAt: Date.now(), stack: 1000, handId: 0, streetId: 0, streetBet: 0, committed: 0, folded: false, allIn: false, sittingOut: false, bjRound: null, hands: [], insurance: 0, surrendered: false, lastAction: null, ts: Date.now(), avatar: null, ...extra });
const mine = (hub, i, code) => hub.writes.filter(w => w.phone === i && w.path.startsWith('rooms/' + code));

(async () => {
  const { chromium } = requirePlaywright();
  const srv = await serve(), browser = await chromium.launch();
  try {
    // --- unsupported tables ---
    for (const [label, extra] of [['appMin 99', { appMin: 99 }], ['mode "something-new"', { mode: 'something-new' }]]){
      const { pages: [A, B], errors, hub } = await phones(browser, 2);
      hub.docs['rooms/NEWT'] = base('NEWT', extra);
      hub.docs['rooms/NEWT/players/p_other'] = player('דנה');
      hub.docs['rooms/OLDT'] = base('OLDT', { game: 'holdem' });       // a normal table in the list
      await A.goto(srv.url + '#NEWT'); await A.waitForTimeout(900);
      check(`${label}: update screen shown`, await A.isVisible('#needupd') && (await A.textContent('#needupd h2')).includes('גרסה חדשה'));
      check(`${label}: no betting, joining or host controls`, !(await A.$('.dock, [data-a=sit], [data-a=claim], [data-a=bjbet], [data-a=hgo], [data-a=deal], [data-a=newhand], [data-a=sheet]')));
      for (const a of ['sit', 'claim', 'bjbet', 'bjclear', 'deal', 'newhand', 'hgo', 'fold', 'payout', 'addp', 'endgame', 'setgame', 'saveset', 'remove', 'mkhost', 'sitout', 'adj']){   // even forced through the dispatcher
        await A.evaluate(a => { const b = document.createElement('button'); b.dataset.a = a; b.dataset.v = 'p_other'; document.body.appendChild(b); b.click(); b.remove(); }, a);
      }
      await A.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
      await A.waitForTimeout(500);
      check(`${label}: zero writes to the table`, mine(hub, 0, 'NEWT').length === 0, JSON.stringify(mine(hub, 0, 'NEWT')));
      check(`${label}: update button and a way home`, await A.isVisible('[data-a=upd]') && await A.isVisible('[data-a=home]'));
      await A.screenshot({ path: require('path').join(require('./lib').OUT, 'update-screen.png') }).catch(() => {});
      // the other phone arrives by the home list
      await B.goto(srv.url); await B.waitForTimeout(800);
      const rows = await B.$$eval('.roomrow', els => els.map(e => e.textContent));
      check(`${label}: list marks it as needing an update`, rows.some(t => t.includes('NEWT') && t.includes('צריך עדכון')) && rows.some(t => t.includes('OLDT') && !t.includes('צריך עדכון')), JSON.stringify(rows));
      await B.click('[data-a=open][data-v=NEWT]'); await B.waitForTimeout(500);
      check(`${label}: opening from the list shows the update screen`, await B.isVisible('#needupd'));
      // it becomes supported (as after an update): same phone renders the table
      hub.docs['rooms/NEWT'] = base('NEWT');
      await A.evaluate(d => window.__applyDoc('rooms/NEWT', d), hub.docs['rooms/NEWT']); await A.waitForTimeout(500);
      check(`${label}: renders normally once supported`, !(await A.isVisible('#needupd')) && await A.isVisible('.room'));
      check(`${label}: no JavaScript errors`, errors.length === 0, errors.join(' | '));
      await A.context().close(); await B.context().close();
    }
    // --- supported: mode 'chips' and missing fields ---
    {
      const { pages: [A], errors, hub } = await phones(browser, 1);
      hub.docs['rooms/CHIP'] = base('CHIP', { mode: 'chips', appMin: 0 });
      await A.goto(srv.url + '#CHIP'); await A.waitForTimeout(800);
      check('mode chips: normal table with join card', !(await A.isVisible('#needupd')) && await A.isVisible('[data-a=sit]'));
      await A.fill('#jname', 'סמי'); await A.click('[data-a=sit]'); await A.waitForTimeout(500);
      check('mode chips: joining writes the player', players(hub.docs).length === 1);
      check('mode chips: no JavaScript errors', errors.length === 0, errors.join(' | '));
      await A.context().close();
    }
    // --- legacy proof: phase/stage 'cards' ---
    {
      const { pages: [A, B], errors, hub } = await phones(browser, 2);
      hub.docs['rooms/BJCD'] = base('BJCD', { phase: 'cards' });
      hub.docs['rooms/BJCD/players/p_a'] = player('סמי');
      hub.docs['rooms/BJOK'] = base('BJOK'); hub.docs['rooms/BJOK/players/p_a'] = player('סמי');
      hub.docs['rooms/HOOK'] = base('HOOK', { game: 'holdem', stage: 'preflop', handId: 1, buttonPid: 'p_b' });
      hub.docs['rooms/HOOK/players/p_b'] = player('דנה', { handId: 1, streetBet: 0, committed: 0 }); hub.docs['rooms/HOOK/players/p_c'] = player('רן', { handId: 1, streetBet: 10, committed: 10 });
      hub.docs['rooms/HOCD'] = base('HOCD', { game: 'holdem', stage: 'cards', handId: 1, buttonPid: 'p_b' });
      hub.docs['rooms/HOCD/players/p_b'] = player('דנה', { handId: 1, streetBet: 10, committed: 10 });
      hub.docs['rooms/HOCD/players/p_c'] = player('רן', { handId: 1, streetBet: 10, committed: 10 });
      const stacks = code => JSON.stringify(Object.entries(hub.docs).filter(([k]) => k.startsWith('rooms/' + code + '/')).map(([k, v]) => [k, v.stack]));
      // Blackjack player on a phase:'cards' table
      await A.goto(srv.url + '#BJCD'); await A.waitForTimeout(700);
      await A.click('[data-a=claim][data-v=p_a]'); await A.waitForTimeout(300);
      const s0 = stacks('BJCD'), w0 = hub.writes.length;
      for (let i = 0; i < 3; i++){ await A.click('.tray .chip >> nth=1', { timeout: 1500 }).catch(() => {}); await A.waitForTimeout(100); }
      await A.click('[data-a=bjbet]', { timeout: 1500 }).catch(() => {}); await A.click('[data-a=bjclear]', { timeout: 1500 }).catch(() => {});
      for (const k of ['double', 'split', 'ins', 'surrender']) await A.evaluate(k => { const b = document.createElement('button'); b.dataset.a = 'bj'; b.dataset.v = k + ':0'; document.body.appendChild(b); b.click(); b.remove(); }, k);
      await A.waitForTimeout(500);
      check('legacy blackjack phase "cards": no writes from a player tapping chips, bet, clear, play buttons', hub.writes.length === w0 && stacks('BJCD') === s0, JSON.stringify(hub.writes.slice(w0)));
      // Hold'em player on a stage:'cards' table
      await B.goto(srv.url + '#HOCD'); await B.waitForTimeout(700);
      await B.click('[data-a=claim][data-v=p_b]'); await B.waitForTimeout(300);
      const w1 = hub.writes.length;
      for (const a of ['hgo', 'fold']) await B.evaluate(a => { const b = document.createElement('button'); b.dataset.a = a; b.dataset.v = '10'; document.body.appendChild(b); b.click(); b.remove(); }, a);
      await B.click('.dock [data-a=hgo]', { timeout: 1500 }).catch(() => {}); await B.click('.dock [data-a=fold]', { timeout: 1500 }).catch(() => {});
      await B.waitForTimeout(500);
      check('legacy hold\'em stage "cards": no writes from a player acting', hub.writes.length === w1, JSON.stringify(hub.writes.slice(w1)));
      // Controls: the same taps on a normal table DO write, so the "no writes" results above are not vacuous.
      await A.goto(srv.url + '#BJOK'); await A.reload(); await A.waitForTimeout(700); await A.click('[data-a=claim][data-v=p_a]', { timeout: 1500 }).catch(() => {}); await A.waitForTimeout(300);
      const w2 = hub.writes.length;
      await A.click('.tray .chip >> nth=1', { timeout: 3000 }).catch(() => {}); await A.waitForTimeout(450); await A.click('[data-a=bjbet]', { timeout: 3000 }).catch(() => {}); await A.waitForTimeout(500);
      check('control: the same bet on a normal Blackjack table writes', hub.writes.length > w2);
      await B.goto(srv.url + '#HOOK'); await B.reload(); await B.waitForTimeout(700); await B.click('[data-a=claim][data-v=p_b]', { timeout: 1500 }).catch(() => {}); await B.waitForTimeout(300);
      const w3 = hub.writes.length;
      await B.click('.dock [data-a=fold]', { timeout: 3000 }).catch(() => {}); await B.waitForTimeout(500);
      check('control: a fold on a normal Hold\'em table writes', hub.writes.length > w3);
      check('legacy: no JavaScript errors', errors.length === 0, errors.join(' | '));
    }
  } catch(e){ check('test ran to the end', false, e.stack || e.message); }
  await browser.close(); srv.close();
  const f = failures(); console.log(f ? `\n${f} failed` : '\nall passed'); process.exit(f ? 1 : 0);
})();
