// Render the poster (3200x4000) to site/media/poster.jpg and a png.
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const path = require('path');
const root = path.resolve(__dirname, '..');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 2000 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + path.join(root, 'build', 'poster.html'));
  await p.waitForFunction(() => document.body.dataset.ready === '1');
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(root, 'site', 'media', 'poster.jpg'), type: 'jpeg', quality: 92 });
  await b.close();
  console.log('poster done');
})();
