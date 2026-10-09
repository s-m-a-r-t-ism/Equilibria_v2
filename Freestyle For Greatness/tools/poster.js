// Render a still from the piece: SIZE=1600x2000 DSF=2 T=226 node poster.js out.png
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const path = require('path');
const url = 'file://' + encodeURI(path.resolve(__dirname, '..', 'index.html'));
const [W, H] = (process.env.SIZE || '1600x2000').split('x').map(Number);
const T = +(process.env.T || 226), OUT = process.argv[2] || 'poster.png';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: +(process.env.DSF || 1) });
  await p.goto(url); await p.evaluate(() => FFG.ready); await p.waitForTimeout(800);
  await p.evaluate(() => { FFG.enterClip(); FFG.setLabels(true); });
  // play the seconds before T so the shapes are in flight and the sky has faded in
  for (let t = T - 8; t <= T; t += 1 / 30) await p.evaluate(tt => FFG.frame(tt, 1 / 30), t);
  await p.screenshot({ path: OUT });
  await b.close();
})();
