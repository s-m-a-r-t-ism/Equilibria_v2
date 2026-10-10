// Render the clip frame by frame on song time and mux it with the song.
// SIZE=1920x1080 OUT=clip.mp4 node clip.js            (T0/T1 to render a part)
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const path = require('path');
const { spawn } = require('child_process');
const root = path.resolve(__dirname, '..');
const [W, H] = (process.env.SIZE || '1920x1080').split('x').map(Number);
const FPS = +(process.env.FPS || 30);
const OUT = process.env.OUT || path.join(root, 'site', 'media', 'long-delayed-echoes.mp4');
const AUDIO = process.env.AUDIO || path.join(root, 'build', 'song.wav');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + path.join(root, 'site', 'index.html') + '#clip');
  await p.waitForTimeout(800);
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => LDE.enterClip());
  const end = +(process.env.T1 || await p.evaluate(() => LDE.TL.end));
  const T0 = +(process.env.T0 || 0);
  const args = ['-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-ss', String(T0), '-t', String(end - T0), '-i', AUDIO,
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', process.env.CRF || '19', '-pix_fmt', 'yuv420p', '-tune', 'film',
    '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', OUT];
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 30; i > 0; i--) await p.evaluate(t => LDE.frame(t, 1 / 30), T0 - i / 30);
  const n = Math.round((end - T0) * FPS), t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const t = T0 + i / FPS;
    await p.evaluate(([tt, dt]) => LDE.frame(tt, dt), [t, 1 / FPS]);
    const jpg = await p.screenshot({ type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 600 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await b.close();
  console.log('done', OUT);
})();
