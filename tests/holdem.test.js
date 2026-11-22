// End-to-end check of Texas Hold'em on three phones (dealer who also plays + two players). Run: node tests/holdem.test.js
// Drives the real buttons (dock, dealer panel, sheets) and checks every phone after every step: each stack as shown
// on the seats, the pot (data-k="pot"), the stage label, and that stacks + pot always add up to the chips at the table.
//   Hand 1: blinds, preflop call/check, flop bet/call/fold, turn checks, river bet/call, award the pot.
//   Hand 2: the button and blinds have moved; all three go all-in with different stacks -> main pot and side pot to
//           different players (the award sheet asks twice), the biggest stack gets its excess back.
//   Hand 3: a raise, a call and a fold, a bet on the flop, then the dealer cancels: everyone gets back what they put in.
//   Hand 4: a new hand after the cancel starts normally.
const { requirePlaywright, serve, phones, players, room, openTable, check, failures } = require('./lib');

(async () => {
  const { chromium } = requirePlaywright();
  const srv = await serve(), browser = await chromium.launch();
  const { pages, errors, db } = await phones(browser, 3);
  const [A, B, C] = pages, wait = ms => A.waitForTimeout(ms);
  const fmt = n => Number(n).toLocaleString('en-US');
  const STAGE = { preflop: 'פרה-פלופ', flop: 'פלופ', turn: 'טרן', river: 'ריבר', showdown: 'שואודאון', idle: 'בין ידיים' };
  try {
    const { ids } = await openTable(pages, srv.url, { game: 'holdem', settings: { stack: 1000, sb: 5, bb: 10 }, names: ['סמי', 'דנה', 'רון'], db });
    const [SAMI, DANA, RON] = [ids['סמי'], ids['דנה'], ids['רון']];
    const phoneOf = { [SAMI]: A, [DANA]: B, [RON]: C };
    const nameOf = { [SAMI]: 'סמי', [DANA]: 'דנה', [RON]: 'רון' };
    check('three players seated', !!SAMI && !!DANA && !!RON);

    // ---- helpers ----
    const order = () => players(db()).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0)).map(p => p.pid);
    const stackOf = pid => players(db()).find(p => p.pid === pid).stack;
    const stacks = () => Object.fromEntries(players(db()).map(p => [p.pid, p.stack]));
    // chips still in the pot: what each player put in this hand above the level already paid out (like the app, but read from the server copy)
    const potOf = d => { const r = room(d); return r.stage === 'idle' ? 0 : players(d).filter(p => p.handId === r.handId).reduce((a, p) => a + Math.max(0, (p.committed || 0) - (r.potLevel || 0)), 0); };
    const TOTAL = 1900;
    // What one phone shows right now.
    const view = async pg => pg.evaluate(ids => {
      const num = t => Number(String(t).replace(/[^\d]/g, ''));
      const st = {}; for (const [pid] of Object.entries(ids)){ const el = document.querySelector(`.seat:has([data-k="seat:${pid}"]) .sub .num`); st[pid] = el ? num(el.textContent) : null; }
      const pill = document.querySelector('.stage-row .pill');
      return { pot: num((document.querySelector('[data-k="pot"]') || {}).textContent), stage: pill ? pill.textContent : '', st };
    }, Object.fromEntries(Object.values(ids).map(p => [p, 1])));
    // Every phone must show these stacks, this pot and this stage (waits for the snapshots and the chip animations).
    const verify = async (label, { st, pot, stage }) => {
      let bad = [];
      for (let t = 0; t < 40; t++){
        bad = [];
        for (const [i, pg] of pages.entries()){
          const v = await view(pg);
          for (const pid of Object.keys(st)) if (v.st[pid] !== st[pid]) bad.push(`phone ${i + 1} sees ${nameOf[pid]} ${v.st[pid]}, expected ${st[pid]}`);
          if (v.pot !== pot) bad.push(`phone ${i + 1} pot ${v.pot}, expected ${pot}`);
          if (stage && !v.stage.includes(STAGE[stage])) bad.push(`phone ${i + 1} stage "${v.stage}", expected ${STAGE[stage]}`);
        }
        if (!bad.length) break; await wait(150);
      }
      check(`${label}: every phone shows stacks ${Object.keys(st).map(p => st[p]).join('/')}, pot ${pot}, ${stage || ''}`, !bad.length, bad.join('; '));
      const d = db(); const s = players(d).reduce((a, p) => a + p.stack, 0), pt = potOf(d);
      check(`${label}: server stacks match, total ${s} + pot ${pt} = ${TOTAL}`, JSON.stringify(stacks()) === JSON.stringify(st) && pt === pot && s + pt === TOTAL, `server ${JSON.stringify(stacks())} pot ${pt}`);
    };
    // Put an amount in the "to add" box with the real chip buttons (biggest first), then press the main action button.
    const addChips = async (pg, amount) => {
      const vals = (await pg.$$eval('.dock .tray .chip', els => els.map(e => Number(e.dataset.v)))).sort((a, b) => b - a);
      for (const v of vals) while (amount >= v){ await pg.click(`.dock .tray .chip[data-v="${v}"]`); await wait(90); amount -= v; }
      if (amount) throw new Error('cannot make the amount with the chips ' + vals);
      await wait(350);
    };
    const go = async (pid, chips = 0) => { const pg = phoneOf[pid]; if (chips) await addChips(pg, chips); await pg.click('.dock [data-a=hgo]:not([disabled])'); await wait(600); };
    const fold = async pid => { await phoneOf[pid].click('.dock [data-a=fold]'); await wait(600); };
    const allIn = async pid => { const pg = phoneOf[pid]; await pg.click('.dock .presets button:has-text("אול-אין")'); await wait(300); await pg.click('.dock [data-a=hgo]:not([disabled])'); await wait(700); };
    const dealerTap = async sel => { await A.click(sel); await wait(700); };
    const nextStreet = () => dealerTap('.o-host [data-a=next]');
    const newHand = async () => { await dealerTap('.o-host [data-a=newhand]'); await wait(500); };
    const award = async (pids) => { await dealerTap('.o-host [data-a=sheet][data-v=award]'); for (const p of pids){ await A.click(`[data-a=pick][data-v="${p}"]`); await wait(100); } await A.click('[data-a=award]'); await wait(1200); };
    const closeSheet = async () => { await A.click('[data-a=close]').catch(() => {}); await wait(200); };
    const lastEvent = () => room(db()).lastEvent && room(db()).lastEvent.t;
    // Do the seats on every phone mark the right player with the dealer button (D)?
    const buttonShown = async pid => { for (const pg of pages){ const owner = await pg.evaluate(() => { const e = document.querySelector('.seat .tag.btn-d'); return e ? e.closest('.seat').querySelector('[data-k^="seat:"]').dataset.k.slice(5) : null; }); if (owner !== pid) return false; } return true; };

    // ---- the dealer sets different stacks from the Players sheet: 1000 / 600 / 300 ----
    await A.click('[data-a=sheet][data-v=players]'); await wait(200);
    for (const [pid, take] of [[DANA, 400], [RON, 700]]){
      await A.fill(`#adj-${pid}`, String(take)); await A.click(`[data-a=adj][data-v="${pid}|-1"]`); await wait(500);
    }
    await closeSheet();
    await verify('start', { st: { [SAMI]: 1000, [DANA]: 600, [RON]: 300 }, pot: 0, stage: 'idle' });

    // =================== Hand 1 ===================
    const ord = order();
    check('players are in joining order', JSON.stringify(ord) === JSON.stringify([SAMI, DANA, RON]), JSON.stringify(ord));
    await newHand();
    let r = room(db());
    const b1 = ord[0], sb1 = ord[1], bb1 = ord[2];      // first hand: the button goes to the first seat
    check('hand 1: button, small and big blind', r.handId === 1 && r.buttonPid === b1 && r.sbPid === sb1 && r.bbPid === bb1, JSON.stringify([r.handId, r.buttonPid, r.sbPid, r.bbPid]));
    check('hand 1: every phone shows the button on the right seat', await buttonShown(b1));
    let S = { [SAMI]: 1000, [DANA]: 600, [RON]: 300 };
    S[sb1] -= 5; S[bb1] -= 10;
    check('hand 1: committed is the blind', players(db()).find(p => p.pid === sb1).committed === 5 && players(db()).find(p => p.pid === bb1).committed === 10 && players(db()).find(p => p.pid === b1).committed === 0);
    await verify('hand 1 blinds', { st: S, pot: 15, stage: 'preflop' });
    // preflop: button calls 10, small blind calls 5 more, big blind checks
    await go(b1); S[b1] -= 10;
    await go(sb1); S[sb1] -= 5;
    await go(bb1);
    await verify('hand 1 preflop done', { st: S, pot: 30, stage: 'preflop' });
    // flop: small blind bets 20, big blind calls, button folds
    await nextStreet();
    await verify('hand 1 flop opened', { st: S, pot: 30, stage: 'flop' });
    await go(sb1, 20); S[sb1] -= 20;
    await go(bb1); S[bb1] -= 20;
    await fold(b1);
    await verify('hand 1 flop bet, call, fold', { st: S, pot: 70, stage: 'flop' });
    check('hand 1: the fold is stored', players(db()).find(p => p.pid === b1).folded === true);
    // turn: both check
    await nextStreet();
    await go(sb1); await go(bb1);
    await verify('hand 1 turn checks', { st: S, pot: 70, stage: 'turn' });
    // river: small blind bets 30, big blind calls
    await nextStreet();
    await go(sb1, 30); S[sb1] -= 30;
    await go(bb1); S[bb1] -= 30;
    await verify('hand 1 river bet and call', { st: S, pot: 130, stage: 'river' });
    await nextStreet();
    await verify('hand 1 showdown', { st: S, pot: 130, stage: 'showdown' });
    check('hand 1: committed adds up to the pot', players(db()).reduce((a, p) => a + (p.committed || 0), 0) === 130);
    // dealer awards the whole pot to the big blind
    await award([bb1]); S[bb1] += 130;
    await verify('hand 1 awarded to the big blind', { st: S, pot: 0, stage: 'idle' });
    check('hand 1: the award is announced', (lastEvent() || '').includes(nameOf[bb1]) && (lastEvent() || '').includes('130'), lastEvent());

    // =================== Hand 2: all-in with unequal stacks ===================
    const s2 = { ...S };                                  // 990 / 540 / 370 in some order
    await newHand();
    r = room(db());
    const b2 = ord[1], sb2 = ord[2], bb2 = ord[0];
    check('hand 2: the button moved one seat, blinds moved with it', r.handId === 2 && r.buttonPid === b2 && r.sbPid === sb2 && r.bbPid === bb2 && b2 !== b1, JSON.stringify([r.handId, r.buttonPid, r.sbPid, r.bbPid]));
    check('hand 2: every phone shows the button on the right seat', await buttonShown(b2));
    const S2 = { ...s2 }; S2[sb2] -= 5; S2[bb2] -= 10;
    await verify('hand 2 blinds', { st: S2, pot: 15, stage: 'preflop' });
    const bySize = Object.keys(s2).sort((a, b) => s2[a] - s2[b]);       // smallest, middle, biggest stack
    const [small, mid, big] = bySize;
    check('hand 2: stacks are all different', new Set(Object.values(s2)).size === 3, JSON.stringify(s2));
    for (const pid of [big, mid, small]) await allIn(pid);
    const S2b = { [SAMI]: 0, [DANA]: 0, [RON]: 0 };
    await verify('hand 2 everyone all-in', { st: S2b, pot: TOTAL, stage: 'preflop' });
    check('hand 2: all three are marked all-in', players(db()).every(p => p.allIn === true));
    check('hand 2: every phone shows ALL-IN tags', (await Promise.all(pages.map(pg => pg.locator('.seat .tag.allin').count()))).every(n => n === 3));
    for (const st of ['flop', 'turn', 'river', 'showdown']) await nextStreet();
    await verify('hand 2 showdown', { st: S2b, pot: TOTAL, stage: 'showdown' });
    // main pot -> the smallest stack, then the side pot -> the middle stack; the biggest gets the excess back
    const c1 = s2[small], c2 = s2[mid], c3 = s2[big];
    const mainPot = 3 * c1, sidePot = 2 * (c2 - c1), excess = c3 - c2;
    await dealerTap('.o-host [data-a=sheet][data-v=award]');
    await A.click(`[data-a=pick][data-v="${small}"]`); await wait(200);
    const preview = await A.textContent('.sheet') || '';
    check('hand 2: the award sheet previews the main pot only', preview.includes(fmt(mainPot)) && preview.includes(fmt(sidePot + excess)), preview.replace(/\s+/g, ' ').slice(0, 300));
    await A.click('[data-a=award]'); await wait(1200);
    const S2c = { ...S2b, [small]: mainPot };
    await verify('hand 2 main pot paid', { st: S2c, pot: sidePot + excess, stage: 'showdown' });
    check('hand 2: the sheet asks again for the side pot', await A.isVisible('[data-a=pick]'));
    await A.click(`[data-a=pick][data-v="${mid}"]`); await wait(200);
    await A.click('[data-a=award]'); await wait(1500);
    const S2d = { ...S2c, [mid]: sidePot, [big]: excess };
    await verify('hand 2 side pot paid, excess returned', { st: S2d, pot: 0, stage: 'idle' });
    check(`hand 2: exact amounts (main ${mainPot}, side ${sidePot}, back ${excess})`, stackOf(small) === mainPot && stackOf(mid) === sidePot && stackOf(big) === excess, JSON.stringify(stacks()));
    await closeSheet();

    // =================== Hand 3: cancelled mid-street ===================
    const s3 = { ...S2d };
    await newHand();
    r = room(db());
    const b3 = ord[2], sb3 = ord[0], bb3 = ord[1];
    check('hand 3: button and blinds moved again', r.handId === 3 && r.buttonPid === b3 && r.sbPid === sb3 && r.bbPid === bb3, JSON.stringify([r.handId, r.buttonPid, r.sbPid, r.bbPid]));
    let S3 = { ...s3 }; S3[sb3] -= 5; S3[bb3] -= 10;
    await verify('hand 3 blinds', { st: S3, pot: 15, stage: 'preflop' });
    await go(b3, 30); S3[b3] -= 30;                      // button raises to 30
    await go(sb3); S3[sb3] -= 25;                        // small blind calls 25 more
    await fold(bb3);
    await verify('hand 3 raise, call, fold', { st: S3, pot: 30 + 30 + 10, stage: 'preflop' });
    await nextStreet();
    await go(sb3, 20); S3[sb3] -= 20;
    await go(b3); S3[b3] -= 20;
    await verify('hand 3 flop bet and call', { st: S3, pot: 110, stage: 'flop' });
    await dealerTap('.o-host [data-a=sheet][data-v=cancel]');
    await A.click('[data-a=cancelhand]'); await wait(1500);
    await verify('hand 3 cancelled: everyone has what they had', { st: s3, pot: 0, stage: 'idle' });
    check('hand 3: the cancel is announced', /בוטלה/.test(lastEvent() || ''), lastEvent());
    check('hand 3: no cancel sheet left open', !(await A.isVisible('[data-a=cancelhand]')));

    // =================== Hand 4: a new hand after the cancel ===================
    await newHand();
    r = room(db());
    const b4 = ord[0], sb4 = ord[1], bb4 = ord[2];
    check('hand 4: starts normally, button moved on', r.handId === 4 && r.stage === 'preflop' && r.buttonPid === b4 && r.sbPid === sb4 && r.bbPid === bb4, JSON.stringify([r.handId, r.stage, r.buttonPid, r.sbPid, r.bbPid]));
    const S4 = { ...s3 }; S4[sb4] -= 5; S4[bb4] -= 10;
    await verify('hand 4 blinds', { st: S4, pot: 15, stage: 'preflop' });
    await dealerTap('.o-host [data-a=sheet][data-v=cancel]'); await A.click('[data-a=cancelhand]'); await wait(1500);
    await verify('hand 4 cancelled too: blinds returned', { st: s3, pot: 0, stage: 'idle' });

    check('no JavaScript errors on any phone', errors.length === 0, errors.join(' | '));
  } catch(e){ check('test ran to the end', false, e.message.split('\n')[0]); console.error(e); }
  await browser.close(); srv.close();
  const f = failures(); console.log(f ? `\n${f} failed` : '\nall passed'); process.exit(f ? 1 : 0);
})();
