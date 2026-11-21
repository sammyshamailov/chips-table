// Screenshots of the table for a visual check, written to tests/out/. Run: node tests/screenshots.js
// Uses single-device mode (no config.js), where one phone can sit several players and switch between them.
const fs = require('fs');
const path = require('path');
const { OUT, requirePlaywright, serve, setPending } = require('./lib');

(async () => {
  const { chromium } = requirePlaywright();
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(), browser = await chromium.launch(), errors = [];
  for (const [w, h, label] of [[390, 844, 'portrait'], [844, 390, 'landscape'], [375, 667, 'small-portrait']]){
    const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    pg.on('pageerror', e => errors.push(`${label}: ${e.message}`));
    await pg.route(/gstatic|googleapis/, r => r.abort());
    await pg.goto(srv.url); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(300);
    await pg.fill('#name', 'סמי'); await pg.click('[data-a=cgame][data-v=blackjack]'); await pg.click('#cplay'); await pg.click('[data-a=create]'); await pg.waitForTimeout(300);
    for (const n of ['דנה', 'יוסי', 'מיכל', 'אבי', 'רונית', 'שלומי']){ await pg.click('[data-a=sheet][data-v=players]'); await pg.fill('#newp', n); await pg.click('[data-a=addp]'); await pg.waitForTimeout(60); await pg.click('[data-a=close]'); }
    const me = await pg.evaluate(() => localStorage.getItem('chips.pid'));
    const others = await pg.$$eval('.st[data-a=claim]', els => els.map(e => e.dataset.v));
    const bets = [150, 25, 500, 60, 15, 250, 35];
    await setPending(pg, bets[0]); await pg.click('[data-a=bjbet]'); await pg.waitForTimeout(150);
    for (let i = 0; i < others.length; i++){ await pg.click(`.st[data-v="${others[i]}"]`); await pg.waitForTimeout(60); await setPending(pg, bets[i + 1]); await pg.click('[data-a=bjbet]'); await pg.waitForTimeout(120); }
    await pg.click(`.st[data-v="${me}"]`).catch(() => {}); await pg.waitForTimeout(200);
    await pg.click('[data-a=deal]'); await pg.waitForTimeout(400);
    await pg.click(`.st[data-v="${others[0]}"]`); await pg.click('[data-a=bj][data-v="split:0"]'); await pg.waitForTimeout(1300);
    await pg.click('[data-a=bj][data-v="double:1"]'); await pg.waitForTimeout(1200);
    await pg.screenshot({ path: path.join(OUT, `table-${label}.png`) });
    console.log('wrote', path.join(OUT, `table-${label}.png`));
    await pg.close();
  }
  await browser.close(); srv.close();
  console.log(errors.length ? 'errors:\n' + errors.join('\n') : 'no errors');
  process.exit(errors.length ? 1 : 0);
})();
