// What a render must keep, now that Preact patches the page instead of replacing it (R-005 phase 5): the caret and the
// avatar letter while you type, the landscape side panel's element and scroll, a sheet's scroll, the amounts typed in it
// and the focus and caret in its field through a render, the sheet and the toast showing and hiding; the Blackjack table's elements (each seat stays with its player), the
// dealer's blink rhythm, your chips in hand landing on your spot; the Hold'em table's elements (each row stays with its
// player), the blink, the dock's buttons; the ceremony's winner circles and chip rain. Single-device mode. Run: node tests/behaviour.test.js
const { requirePlaywright, serve, setPending, check, failures } = require('./lib');

async function addPlayers(p, names){
  for (const n of names){ await p.click('[data-a=sheet][data-v=players]'); await p.fill('#newp', n); await p.click('[data-a=addp]'); await p.waitForTimeout(60); await p.click('[data-a=close]'); }
}

(async () => {
  const { chromium } = requirePlaywright();
  const srv = await serve(), browser = await chromium.launch(), errors = [];
  const page = async (w, h) => {
    const c = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', locale: 'he-IL' });
    await c.route(/gstatic|googleapis/, r => r.abort());
    const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.goto(srv.url); await p.waitForTimeout(300); return p;
  };
  try {
    // 1. Home: the avatar letter follows the name as it is typed, and the caret stays where it is.
    let p = await page(390, 844);
    await p.click('#name'); await p.keyboard.type('דנה');
    check('home: the avatar letter follows typing', (await p.textContent('.avbtn .av')).trim() === 'ד', await p.textContent('.avbtn .av'));
    await p.keyboard.press('Home'); await p.keyboard.type('X');
    check('home: the caret stays while typing', (await p.inputValue('#name')) === 'Xדנה', await p.inputValue('#name'));
    await p.fill('#name', ''); await p.waitForTimeout(50);
    check('home: the letter is back to ? when the name is cleared', (await p.textContent('.avbtn .av')).trim() === '?', await p.textContent('.avbtn .av'));

    // 2. Landscape: the side panel is the same element after a render, and keeps its scroll.
    p = await page(844, 390);
    await p.fill('#name', 'סמי'); await p.click('[data-a=create]'); await p.waitForTimeout(300);
    await addPlayers(p, ['דנה', 'יוסי', 'מיכל', 'אבי']);
    await p.click('[data-a=newhand]'); await p.waitForTimeout(1200);
    const max = await p.$eval('.side', e => e.scrollHeight - e.clientHeight);
    await p.$eval('.side', e => e.scrollTop = 60); await p.waitForTimeout(100);
    await setPending(p, 20); await p.waitForTimeout(300);                 // re-renders the room
    const st = await p.$eval('.side', e => e.scrollTop);
    check('landscape: the side panel keeps its scroll on a render', max >= 60 && st === 60, `max ${max} scrollTop ${st}`);
    await p.$eval('.side', e => e.__mark = 1); await setPending(p, 30); await p.waitForTimeout(200);
    check('landscape: the side panel element is kept', await p.$eval('.side', e => e.__mark === 1));

    // 3. Sheets: a re-render keeps the scroll; another sheet starts at the top.
    await p.click('[data-a=sheet][data-v=players]'); await p.waitForTimeout(200);
    await p.$eval('.sheet', e => e.scrollTop = 120); const before = await p.$eval('.sheet', e => e.scrollTop);
    await p.$$eval('[data-a=remove]', e => e[2].click()); await p.waitForTimeout(200);    // first tap: "בטוח?" (a re-render)
    check('sheet: keeps its scroll on a re-render', before > 0 && await p.$eval('.sheet', e => e.scrollTop) === before, `before ${before}`);
    await p.click('[data-a=sheet][data-v=avatar]'); await p.waitForTimeout(200);
    check('sheet: another sheet starts at the top', await p.$eval('.sheet', e => e.scrollTop) === 0);
    await p.click('[data-a=close]');

    // 4. Players sheet: the amount typed for a player stays with that player when another player is added.
    await p.click('[data-a=sheet][data-v=players]'); await p.waitForTimeout(200);
    const pid = await p.$$eval('[data-a=adj]', e => e[4].dataset.v.split('|')[0]);
    await p.fill(`[id="adj-${pid}"]`, '77');
    await p.fill('#newp', 'רונית'); await p.focus(`[id="adj-${pid}"]`); await p.click('[data-a=addp]'); await p.waitForTimeout(300);
    check('players sheet: a typed amount stays with its player', (await p.inputValue(`[id="adj-${pid}"]`)) === '77');
    // The focus and the caret stay in a field while the screens are drawn again (render() doesn't restore them: Preact
    // keeps the element).
    await p.click('#newp'); await p.keyboard.type('אבג'); await p.keyboard.press('ArrowRight');
    const caret = await p.$eval('#newp', e => [e.selectionStart, e.selectionEnd]);
    await setPending(p, 40); await p.waitForTimeout(200);                 // a render of the room and the sheet
    const after = await p.evaluate(() => { const a = document.activeElement; return [a && a.id, a && a.selectionStart, a && a.selectionEnd]; });
    check('players sheet: the focus and the caret stay through a render', after[0] === 'newp' && after[1] === caret[0] && after[2] === caret[1] && caret[0] === 2, JSON.stringify({ caret, after }));

    // 5. A closed sheet is hidden and empty; the toast shows and hides.
    await p.click('[data-a=close]'); await p.waitForTimeout(100);
    check('sheet: hidden and empty when closed', await p.$eval('#sheet', e => e.hidden && !e.children.length));
    await p.click('[data-a=snd]'); await p.waitForTimeout(100);
    check('toast: shows', await p.$eval('#toast', e => !e.hidden && e.textContent === 'הצלילים כבויים'));
    await p.waitForTimeout(3400);
    check('toast: hides', await p.$eval('#toast', e => e.hidden));

    // 6. Blackjack: the table's elements are kept across renders, each seat stays with its player when someone sits
    //    down, the blink keeps its phase, and chips from the tray land on your spot one by one.
    p = await page(390, 844);
    await p.fill('#name', 'סמי'); await p.click('[data-a=cgame][data-v=blackjack]'); await p.click('#cplay'); await p.click('[data-a=create]'); await p.waitForTimeout(300);
    await addPlayers(p, ['דנה', 'יוסי']);
    const dana = await p.$eval('.st[data-a=claim]', e => e.dataset.v);
    const lids = await p.$eval('.lids', e => e.getAttribute('style'));
    await p.$eval('.bjt', e => e.__mark = 1); await p.$eval(`.st[data-v="${dana}"]`, e => e.__mark = 1); await p.$eval('.dfig svg', e => e.__mark = 1);
    await p.click('.tray .chip >> nth=2'); await p.waitForTimeout(150);
    check('blackjack: a chip in the air is not on your spot yet', await p.$$eval('[data-k=ghost] .cd', e => e.length) === 0);
    await p.waitForTimeout(600);
    check('blackjack: the chip lands on your spot', await p.$$eval('[data-k=ghost] .cd', e => e.length) === 1 && (await p.textContent('[data-k=pend]')) === '25');
    await p.click('.tray .chip >> nth=0'); await p.waitForTimeout(700);
    check('blackjack: the next chip lands on top of it', await p.$$eval('[data-k=ghost] .cd', e => e.length) === 2 && (await p.textContent('[data-k=pend]')) === '30');
    check('blackjack: the table and the dealer are the same elements after renders', await p.$eval('.bjt', e => e.__mark === 1) && await p.$eval('.dfig svg', e => e.__mark === 1));
    check('blackjack: the dealer keeps her blink rhythm across renders', (await p.$eval('.lids', e => e.getAttribute('style'))) === lids);
    await addPlayers(p, ['מיכל']);
    check('blackjack: a seat stays with its player when someone sits down', await p.$eval(`.st[data-v="${dana}"]`, e => e.__mark === 1) && await p.$$eval('.st', e => e.length) === 4);
    await p.click('[data-a=bjbet]'); await p.waitForTimeout(600);
    const mine = await p.evaluate(() => localStorage.getItem('chips.pid'));
    check('blackjack: the bet is on your spot and your hand is empty', await p.$$eval(`[data-k="spot:${mine}:0"] > .stk .cd`, e => e.length) === 2 && !(await p.$('[data-k=ghost] .cd')) && (await p.textContent('[data-k=pend]')) === '0');

    // 7. Hold'em: the table, the dealer and each player's row are kept across renders (a row stays with its player when
    //    someone sits down), the blink keeps its phase, and the dock's main button is the same element as its label
    //    follows the chips in hand.
    p = await page(390, 844);
    await p.fill('#name', 'סמי'); await p.click('[data-a=create]'); await p.waitForTimeout(300);
    await addPlayers(p, ['דנה', 'יוסי']);
    const hDana = await p.$eval('.seat [data-a=claim]', e => e.dataset.v);
    const row = pid => `.seat:has([data-k="seat:${pid}"])`;
    await p.$eval('.stage .table', e => e.__mark = 1); await p.$eval('.hdealer svg', e => e.__mark = 1); await p.$eval(row(hDana), e => e.__mark = 1);
    const hLids = await p.$eval('.lids', e => e.getAttribute('style'));
    await p.click('[data-a=newhand]'); await p.waitForTimeout(1200);
    await p.$eval('[data-a=hgo]', e => e.__mark = 1);
    const label0 = await p.textContent('[data-a=hgo]');
    await p.click('.tray .chip >> nth=3'); await p.waitForTimeout(700);
    check("holdem: the main button follows the chips in hand and stays the same element", await p.$eval('[data-a=hgo]', e => e.__mark === 1) && (await p.textContent('[data-a=hgo]')) !== label0, `${label0} -> ${await p.textContent('[data-a=hgo]')}`);
    check("holdem: the table and the dealer are the same elements after renders", await p.$eval('.stage .table', e => e.__mark === 1) && await p.$eval('.hdealer svg', e => e.__mark === 1));
    check("holdem: the dealer keeps her blink rhythm across renders", (await p.$eval('.lids', e => e.getAttribute('style'))) === hLids);
    await addPlayers(p, ['מיכל']);
    check("holdem: a row stays with its player when someone sits down", await p.$eval(row(hDana), e => e.__mark === 1) && await p.$$eval('.seats .seat', e => e.length) === 4);

    // 8. The ceremony (Preact in #fin, outside the screens' render): each winner's circle has that player's colour, as
    //    in the standings under it, and the raining chips survive the standings sliding in (a second render of #fin).
    p = await page(390, 844);
    await p.fill('#name', 'סמי'); await p.click('[data-a=create]'); await p.waitForTimeout(300);
    await addPlayers(p, ['דנה', 'יוסי']);
    await p.click('[data-a=sheet][data-v=end]'); await p.waitForTimeout(200); await p.click('[data-a=endgame]');
    await p.waitForSelector('#fin .fin-rest.on', { timeout: 8000 }); await p.waitForTimeout(300);
    const circles = await p.evaluate(() => ({
      fin: [...document.querySelectorAll('#fin .fin-av')].map(e => e.getAttribute('style')),
      rank: [...document.querySelectorAll('#fin .rank .av')].map(e => e.getAttribute('style')),
    }));
    check('ceremony: each winner\'s circle has their own colour, as in the standings', circles.fin.length === 3 && new Set(circles.fin).size === 3 && circles.fin.every((c, i) => c === circles.rank[i]), JSON.stringify(circles));
    check('ceremony: the raining chips are still falling after the standings slide in', await p.$$eval('#fin .cf', e => e.length) > 0);
    await p.click('[data-a=finclose]'); await p.waitForTimeout(200);
    check('ceremony: closed, #fin hidden and empty', await p.$eval('#fin', e => e.hidden && !e.children.length));
  } catch(e){ check('test ran to the end', false, e.stack || e.message); }
  check('no page errors', !errors.length, errors.join(' | '));
  await browser.close(); srv.close();
  const f = failures(); console.log(f ? `\n${f} failed` : '\nall passed'); process.exit(f ? 1 : 0);
})();
