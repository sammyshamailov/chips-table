// End-to-end check of a blackjack table played on two phones. Run: node tests/two-phones.test.js
// Covers what has broken before: sync between phones, exact chip stacks, paying a blackjack
// mid-round without paying it twice, avatars, closing the table, and loading a closed table.
// The two phones speak different languages (R-006): A (the dealer) Hebrew, B English. Each shows the event line, its
// toasts and the words over the table in its own language, and both see the same chips. A third phone on the old
// single-file version (before R-006) watches the same table and still shows the event line, in Hebrew.
const path = require('path');
const { ROOT, requirePlaywright, serve, phones, setPending, players, room, openTable, watchFlies, watchFloats, oldApp, check, failures } = require('./lib');

const toastOf = async pg => { await pg.waitForSelector('#toast:not([hidden])', { timeout: 3000 }).catch(() => {}); return pg.textContent('#toast'); };
const eventOf = pg => pg.textContent('.event');

(async () => {
  const { chromium } = requirePlaywright();
  const srv = await serve(), old = await serve(oldApp(path.join(ROOT, 'tests', 'out', 'old-app-2p'))), browser = await chromium.launch();
  const { pages: [A, B, C], errors, db } = await phones(browser, 3, { langs: ['he', 'en', 'he'] });
  const wait = ms => A.waitForTimeout(ms);
  try {
    // Sami opens a blackjack table (minimum 1) and picks a character; Dana joins from the invite link with a photo.
    await openTable([A, B], srv.url, { game: 'blackjack', settings: { min: 1 }, names: ['סמי', 'דנה'], play: true,
      avatars: [{ set: 'tex' }, { photo: path.join(ROOT, 'public', 'icons', 'icon-192.png') }], db });
    let ps = players(db()); const sami = ps.find(p => p.name === 'סמי'), dana = ps.find(p => p.name === 'דנה');
    check('both players seated', !!sami && !!dana);
    check('character avatar stored', sami.avatar && sami.avatar.k === 'set' && sami.avatar.v === 'tex');
    check('photo avatar stored small', dana.avatar && dana.avatar.k === 'img' && dana.avatar.v.length < 15000, dana.avatar && dana.avatar.v.length + ' chars');
    check('each phone sees the other\'s avatar', await A.isVisible(`[data-k="seat:${dana.pid}"] img`) && await B.isVisible(`[data-k="seat:${sami.pid}"] svg`));

    // Languages: each phone in its own, the page's direction with it; the event line stored with its key and in Hebrew.
    check('phone A is in Hebrew, right to left', await A.evaluate(() => document.documentElement.lang + ' ' + document.documentElement.dir) === 'he rtl');
    check('phone B is in English, left to right', await B.evaluate(() => document.documentElement.lang + ' ' + document.documentElement.dir) === 'en ltr');
    check('event line on A in Hebrew', (await eventOf(A)).trim() === 'השולחן נפתח', await eventOf(A));
    check('event line on B in English', (await eventOf(B)).trim() === 'Table opened', await eventOf(B));
    check('the event line is stored with its key and in Hebrew', JSON.stringify(room(db()).lastEvent && [room(db()).lastEvent.key, room(db()).lastEvent.t]) === JSON.stringify(['ev.opened', 'השולחן נפתח']), JSON.stringify(room(db()).lastEvent));
    // A phone on the old version opens the same table: it reads `t`.
    await C.goto(old.url + '#' + room(db()).code); await wait(1200);
    check('a phone on the old version shows the event line in Hebrew', ((await C.textContent('.event').catch(() => '')) || '').trim() === 'השולחן נפתח', await C.textContent('.event').catch(e => e.message));
    // Toasts: each phone's own, in its language.
    await A.click('[data-a=snd]'); check('toast on A in Hebrew', (await toastOf(A)).trim() === 'הצלילים כבויים', await toastOf(A)); await A.click('[data-a=snd]');
    await B.click('[data-a=snd]'); check('toast on B in English', (await toastOf(B)).trim() === 'Sounds off', await toastOf(B)); await B.click('[data-a=snd]');

    // Exact chips: five 1s stay five 1s; Dana's 25-2-2-1 keeps its order.
    for (let i = 0; i < 5; i++){ await A.click('.tray .chip[data-v="1"]'); await wait(90); }
    await wait(450);
    const fliesA = await watchFlies(A), fliesB = await watchFlies(B);
    await A.click('[data-a=bjbet]'); await wait(500);
    // Effects come from events (src/sync/diff.ts → src/fx/): the other phone flies the bet from the seat exactly once;
    // the bettor's own chips were already on the spot, so its phone only bumps the stack.
    const nB = await fliesB(), nA = await fliesA(0);
    check('the other phone flies the bet once', nB === 1, `saw ${nB} flights`);
    check('the bettor\'s phone flies nothing for its own bet', nA === 0, `saw ${nA} flights`);
    for (const v of ['25', '2', '2', '1']){ await B.click(`.tray .chip[data-v="${v}"]`); await wait(90); }
    await wait(450); await B.click('[data-a=bjbet]'); await wait(800);
    ps = players(db());
    check('five 1-chips stored', JSON.stringify(ps.find(p => p.name === 'סמי').hands) === '[{"bet":5,"chips":[1,1,1,1,1]}]');
    check('mixed chips stored in order', JSON.stringify(ps.find(p => p.name === 'דנה').hands) === '[{"bet":30,"chips":[25,2,2,1]}]');
    const chipsOnB = await B.$$eval(`[data-k="spot:${sami.pid}:0"] > .stk .cd`, els => els.length);
    check('the other phone draws the same five chips', chipsOnB === 5, `saw ${chipsOnB}`);

    // Deal, then the dealer declares Dana's blackjack mid-round: 30 back + 45.
    await A.click('[data-a=deal]'); await wait(400);
    check('deal: event line on A in Hebrew, on B in English', (await eventOf(A)).trim() === 'סיבוב 1: הקלפים חולקו' && (await eventOf(B)).trim() === 'Round 1: cards dealt', `${await eventOf(A)} | ${await eventOf(B)}`);
    check('deal: stored with key and parameters', JSON.stringify(room(db()).lastEvent.p) === '{"round":1}' && room(db()).lastEvent.key === 'ev.dealt', JSON.stringify(room(db()).lastEvent));
    check('deal: the old version shows the Hebrew line', ((await C.textContent('.event').catch(() => '')) || '').trim() === 'סיבוב 1: הקלפים חולקו', await C.textContent('.event').catch(e => e.message));
    const floatsA = await watchFloats(A), floatsB = await watchFloats(B);
    await A.click('[data-a=sheet][data-v=bjnow]'); await wait(100);
    await A.click(`[data-a=bjnow][data-v="${dana.pid}"]`); await wait(80); await A.click(`[data-a=bjnow][data-v="${dana.pid}"]`); await wait(1800);
    await A.click('[data-a=close]').catch(() => {});
    ps = players(db());
    check('blackjack paid 3:2 at once', ps.find(p => p.name === 'דנה').stack === 1045, ps.find(p => p.name === 'דנה').stack);
    check('house pays the blackjack', room(db()).house === -45, room(db()).house);
    check('the words over the table on A in Hebrew', (await floatsA()).includes("בלאק ג'ק!"), JSON.stringify(await floatsA()));
    check('the words over the table on B in English', (await floatsB()).includes('Blackjack!'), JSON.stringify(await floatsB()));
    check('blackjack: event line on B in English, stored in Hebrew', (await eventOf(B)).trim() === 'דנה: blackjack! +45' && room(db()).lastEvent.t === "דנה: בלאק ג'ק! +45", `${await eventOf(B)} | ${room(db()).lastEvent.t}`);
    check('both phones show the same chips', JSON.stringify(await A.$$eval('.st .ss', e => e.map(x => x.textContent))) === JSON.stringify(await B.$$eval('.st .ss', e => e.map(x => x.textContent))), JSON.stringify([await A.$$eval('.st .ss', e => e.map(x => x.textContent)), await B.$$eval('.st .ss', e => e.map(x => x.textContent))]));

    // Settle the rest (Sami loses): Dana must not be paid again.
    await A.click('[data-a=sheet][data-v=settle]'); await wait(150);
    await A.locator('.res4 [data-v$="|lose"]').first().click(); await A.click('[data-a=payout]'); await wait(1500);
    ps = players(db());
    check('paid blackjack is not paid twice', ps.find(p => p.name === 'דנה').stack === 1045, ps.find(p => p.name === 'דנה').stack);
    check('loser pays the house', ps.find(p => p.name === 'סמי').stack === 995 && room(db()).house === -40, JSON.stringify([ps.find(p => p.name === 'סמי').stack, room(db()).house]));
    check('payout: event line on B in English', (await eventOf(B)).trim() === 'Round 1 paid · house +5', await eventOf(B));
    check('payout: the old version shows the Hebrew line', ((await C.textContent('.event').catch(() => '')) || '').trim() === 'סיבוב 1 שולם · הבית \u2066+5\u2069', JSON.stringify(await C.textContent('.event').catch(e => e.message)));

    // End the game: everyone gets the ceremony; a reloaded phone sees the final standings instead.
    await A.click('[data-a=sheet][data-v=end]'); await A.click('[data-a=endgame]'); await wait(2600);
    check('table closed with standings', room(db()).closed === true && room(db()).final.list[0].name === 'דנה');
    check('ceremony plays on the other phone', await B.isVisible('#fin .fin-card'));
    await B.reload(); await B.waitForTimeout(1200);
    check('closed table loads without replaying the ceremony', !(await B.isVisible('#fin')) && await B.isVisible('.fincard'));
    check('no betting controls on a closed table', !(await B.isVisible('.dock')));

    check('no JavaScript errors', errors.length === 0, errors.join(' | '));
  } catch(e){ check('test ran to the end', false, e.message); }
  await browser.close(); srv.close(); old.close();
  const f = failures(); console.log(f ? `\n${f} failed` : '\nall passed'); process.exit(f ? 1 : 0);
})();
