// End-to-end check of a blackjack table played on two phones. Run: node tests/two-phones.test.js
// Covers what has broken before: sync between phones, exact chip stacks, paying a blackjack
// mid-round without paying it twice, avatars, closing the table, and loading a closed table.
const path = require('path');
const { ROOT, requirePlaywright, serve, phones, setPending, players, room, check, failures } = require('./lib');

(async () => {
  const { chromium } = requirePlaywright();
  const srv = await serve(), browser = await chromium.launch();
  const { pages: [A, B], errors, db } = await phones(browser, 2);
  const wait = ms => A.waitForTimeout(ms);
  try {
    // Sami opens a blackjack table (minimum 1) and picks a character.
    await A.goto(srv.url); await wait(300);
    await A.fill('#name', 'סמי');
    await A.click('[data-a=sheet][data-v=avatar]'); await A.click('[data-a=avset][data-v=tex]'); await A.click('[data-a=close]');
    await A.click('[data-a=cgame][data-v=blackjack]'); await A.fill('#cmin', '1'); await A.click('#cplay'); await A.click('[data-a=create]'); await wait(500);
    const code = (await A.textContent('.code')).trim();

    // Dana joins from the invite link with a photo.
    await B.goto(srv.url + '#' + code); await wait(500);
    await B.fill('#jname', 'דנה');
    await B.setInputFiles('#avfile', path.join(ROOT, 'icons', 'icon-192.png')); await wait(600);
    await B.click('[data-a=sit]'); await wait(500);
    let ps = players(db()); const sami = ps.find(p => p.name === 'סמי'), dana = ps.find(p => p.name === 'דנה');
    check('both players seated', !!sami && !!dana);
    check('character avatar stored', sami.avatar && sami.avatar.k === 'set' && sami.avatar.v === 'tex');
    check('photo avatar stored small', dana.avatar && dana.avatar.k === 'img' && dana.avatar.v.length < 15000, dana.avatar && dana.avatar.v.length + ' chars');
    check('each phone sees the other\'s avatar', await A.isVisible(`[data-k="seat:${dana.pid}"] img`) && await B.isVisible(`[data-k="seat:${sami.pid}"] svg`));

    // Exact chips: five 1s stay five 1s; Dana's 25-2-2-1 keeps its order.
    for (let i = 0; i < 5; i++){ await A.click('.tray .chip[data-v="1"]'); await wait(90); }
    await wait(450); await A.click('[data-a=bjbet]'); await wait(500);
    for (const v of ['25', '2', '2', '1']){ await B.click(`.tray .chip[data-v="${v}"]`); await wait(90); }
    await wait(450); await B.click('[data-a=bjbet]'); await wait(800);
    ps = players(db());
    check('five 1-chips stored', JSON.stringify(ps.find(p => p.name === 'סמי').hands) === '[{"bet":5,"chips":[1,1,1,1,1]}]');
    check('mixed chips stored in order', JSON.stringify(ps.find(p => p.name === 'דנה').hands) === '[{"bet":30,"chips":[25,2,2,1]}]');
    const chipsOnB = await B.$$eval(`[data-k="spot:${sami.pid}:0"] > .stk .cd`, els => els.length);
    check('the other phone draws the same five chips', chipsOnB === 5, `saw ${chipsOnB}`);

    // Deal, then the dealer declares Dana's blackjack mid-round: 30 back + 45.
    await A.click('[data-a=deal]'); await wait(400);
    await A.click('[data-a=sheet][data-v=bjnow]'); await wait(100);
    await A.click(`[data-a=bjnow][data-v="${dana.pid}"]`); await wait(80); await A.click(`[data-a=bjnow][data-v="${dana.pid}"]`); await wait(1800);
    await A.click('[data-a=close]').catch(() => {});
    ps = players(db());
    check('blackjack paid 3:2 at once', ps.find(p => p.name === 'דנה').stack === 1045, ps.find(p => p.name === 'דנה').stack);
    check('house pays the blackjack', room(db()).house === -45, room(db()).house);

    // Settle the rest (Sami loses): Dana must not be paid again.
    await A.click('[data-a=sheet][data-v=settle]'); await wait(150);
    await A.locator('.res4 [data-v$="|lose"]').first().click(); await A.click('[data-a=payout]'); await wait(1500);
    ps = players(db());
    check('paid blackjack is not paid twice', ps.find(p => p.name === 'דנה').stack === 1045, ps.find(p => p.name === 'דנה').stack);
    check('loser pays the house', ps.find(p => p.name === 'סמי').stack === 995 && room(db()).house === -40, JSON.stringify([ps.find(p => p.name === 'סמי').stack, room(db()).house]));

    // End the game: everyone gets the ceremony; a reloaded phone sees the final standings instead.
    await A.click('[data-a=sheet][data-v=end]'); await A.click('[data-a=endgame]'); await wait(2600);
    check('table closed with standings', room(db()).closed === true && room(db()).final.list[0].name === 'דנה');
    check('ceremony plays on the other phone', await B.isVisible('#fin .fin-card'));
    await B.reload(); await B.waitForTimeout(1200);
    check('closed table loads without replaying the ceremony', !(await B.isVisible('#fin')) && await B.isVisible('.fincard'));
    check('no betting controls on a closed table', !(await B.isVisible('.dock')));

    check('no JavaScript errors', errors.length === 0, errors.join(' | '));
  } catch(e){ check('test ran to the end', false, e.message); }
  await browser.close(); srv.close();
  const f = failures(); console.log(f ? `\n${f} failed` : '\nall passed'); process.exit(f ? 1 : 0);
})();
