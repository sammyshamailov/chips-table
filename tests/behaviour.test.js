// What a render must keep, now that Preact patches the page instead of replacing it (R-005 phase 5): the caret and the
// avatar letter while you type, the landscape side panel's element and scroll, a sheet's scroll and the amounts typed in
// it, the sheet and the toast showing and hiding. Single-device mode. Run: node tests/behaviour.test.js
const { requirePlaywright, serve, setPending, check, failures } = require('./lib');

async function addPlayers(p, names){
  for (const n of names){ await p.click('[data-a=sheet][data-v=players]'); await p.fill('#newp', n); await p.click('[data-a=addp]'); await p.waitForTimeout(60); await p.click('[data-a=close]'); }
}

(async () => {
  const { chromium } = requirePlaywright();
  const srv = await serve(), browser = await chromium.launch(), errors = [];
  const page = async (w, h) => {
    const c = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
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

    // 5. A closed sheet is hidden and empty; the toast shows and hides.
    await p.click('[data-a=close]'); await p.waitForTimeout(100);
    check('sheet: hidden and empty when closed', await p.$eval('#sheet', e => e.hidden && !e.children.length));
    await p.click('[data-a=snd]'); await p.waitForTimeout(100);
    check('toast: shows', await p.$eval('#toast', e => !e.hidden && e.textContent === 'הצלילים כבויים'));
    await p.waitForTimeout(3400);
    check('toast: hides', await p.$eval('#toast', e => e.hidden));
  } catch(e){ check('test ran to the end', false, e.stack || e.message); }
  check('no page errors', !errors.length, errors.join(' | '));
  await browser.close(); srv.close();
  const f = failures(); console.log(f ? `\n${f} failed` : '\nall passed'); process.exit(f ? 1 : 0);
})();
