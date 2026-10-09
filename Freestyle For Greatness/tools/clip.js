// Render the clip frame by frame on song time, piping JPEGs into ffmpeg.
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const path = require('path');
const { spawn } = require('child_process');
const url = 'file://' + encodeURI(path.resolve(__dirname, '..', 'index.html'));
const [W, H] = (process.env.SIZE || '1920x1080').split('x').map(Number);
const FPS = +(process.env.FPS || 30);
const T_START = +(process.env.T0 || 0), T_END = +(process.env.T1 || 0);
const OUT = process.env.OUT || 'clip-video.mp4';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: +(process.env.DSF || 1) });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(url); await p.evaluate(() => FFG.ready); await p.waitForTimeout(800);
  const end = T_END || await p.evaluate(() => FFG.barTime(86) + 3.4);
  await p.evaluate(() => FFG.enterClip());
  const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', process.env.CRF || '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
  // warm up the physics for a second before the first frame so the stage is alive
  for (let i = 0; i < 30; i++) await p.evaluate(t => FFG.frame(t, 1 / 30), T_START - 1 + i / 30);
  const n = Math.round((end - T_START) * FPS), t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const t = T_START + i / FPS;
    await p.evaluate(([tt, dt]) => FFG.frame(tt, dt), [t, 1 / FPS]);
    const jpg = await p.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await b.close();
  console.log('done', OUT);
})();
