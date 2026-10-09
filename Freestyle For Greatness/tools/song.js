// Render the song offline to a WAV file: node song.js [fromBar] [toBar] [out.wav]
// SOLO=kick,bass renders only the named voices (used for mixing).
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const path = require('path');
const fs = require('fs');
const url = 'file://' + encodeURI(path.resolve(__dirname, '..', 'index.html'));
const [from, to, out] = [+(process.argv[2]||0), +(process.argv[3]||86), process.argv[4]||'song.wav'];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(url); await p.waitForTimeout(500);
  const t = Date.now();
  const solo = process.env.SOLO ? process.env.SOLO.split(',') : null;
  const info = await p.evaluate(([a,z,so]) => FFG.renderSong(a, z, 44100, so), [from, to, solo]);
  console.log('rendered', info, (Date.now()-t)/1000+'s');
  const chunks = []; const CH = 44100*10;
  for (let s = 0; s < info.length; s += CH) chunks.push(Buffer.from(await p.evaluate(([a,l]) => FFG.songChunk(a,l), [s, CH]), 'base64'));
  const data = Buffer.concat(chunks);
  const h = Buffer.alloc(44);
  h.write('RIFF',0); h.writeUInt32LE(36+data.length,4); h.write('WAVE',8); h.write('fmt ',12);
  h.writeUInt32LE(16,16); h.writeUInt16LE(1,20); h.writeUInt16LE(2,22); h.writeUInt32LE(44100,24); h.writeUInt32LE(44100*4,28); h.writeUInt16LE(4,32); h.writeUInt16LE(16,34);
  h.write('data',36); h.writeUInt32LE(data.length,40);
  fs.writeFileSync(out, Buffer.concat([h, data]));
  await b.close();
})();
