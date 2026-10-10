// Screenshots of the page at given song times: node shots.js out_dir WxH t1 t2 ...
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const path = require('path');
const [out, size, ...times] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'site', 'index.html'));
  await p.waitForTimeout(600);
  if (times[0] === 'intro') { await p.screenshot({ path: `${out}/intro-${W}.png` }); times.shift(); }
  await p.evaluate(() => LDE.enterClip());
  for (const t of times.map(Number)) {
    for (let i = 30; i >= 0; i--) await p.evaluate(tt => LDE.frame(tt, 1 / 30), t - i / 30);
    await p.screenshot({ path: `${out}/t${String(t).padStart(5, '0')}-${W}.png` });
  }
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
