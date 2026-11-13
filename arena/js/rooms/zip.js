// IV. ZIP: a field of one colour divided by narrow vertical bands.
// Here the field is also a string. Its full width sounds a low A; every zip is a bridge,
// and each part of the field sounds at the pitch its length gives it, as on a monochord.

import { createGL, program, use, quad, target, GLSL_NOISE, readToCanvas, texture, framebuffer } from '../gl.js';
import { audio, pluckBuffer, playBuffer } from '../audio.js';
import { zipTitle, zipReview, year, ARTIST } from '../labels.js';

export const meta = {
  id: 'zip',
  numeral: 'IV',
  name: 'Zip',
  after: 'After Barnett Newman',
  place: 'Betty Parsons Gallery, East 57th Street',
  years: '1948–1970',
  swatch: 'linear-gradient(90deg,#b5231a 0 46%,#efe9dc 46% 47.5%,#b5231a 47.5% 80%,#7a1712 80% 81%,#b5231a 81%)',
  lede: 'One colour, divided by narrow vertical bands. The field is also a string: each zip is a bridge, and every part sounds at the pitch its width gives it. Tune the picture.',
  level: 0.8,
  wet: 0.4,
  freshLabel: 'Clear zips',
  wall: `
    <blockquote>There is a tendency to look at large pictures from a distance. The large pictures in this exhibition are intended to be seen from a short distance.<cite>Barnett Newman, notice pinned to the wall of his second show at Betty Parsons, 1951</cite></blockquote>
    <p>In January 1948 Barnett Newman put a strip of masking tape down the middle of a small canvas painted cadmium red dark, brushed a stripe of lighter, orange-red paint over the tape, and then looked at it for months. He left the tape where it was. The picture, <i>Onement I</i>, was the first of what he called zips: narrow vertical bands that do not divide a field so much as declare it.</p>
    <p><i>Vir Heroicus Sublimis</i> (1950–51) is red, nearly five and a half metres wide, crossed by five zips. In his essay “The Sublime Is Now” (1948) he wrote that the American painter was freeing himself from the weight of European culture, making the work out of ourselves rather than out of history.</p>
    <h3>Amsterdam</h3>
    <p>In 1986 a visitor to the Stedelijk Museum cut <i>Who’s Afraid of Red, Yellow and Blue III</i> with a knife. The restoration, finished in 1991, was itself attacked: critics said the red had been rolled on with a paint roller. In 1997 the same man slashed <i>Cathedra</i>, Newman’s blue field, in the same museum.</p>
    <h3>The monochord</h3>
    <p>Pythagoras is said to have found the musical ratios by moving a bridge along a single stretched string. Halve the string and it sounds an octave higher; take two thirds of it and you get a fifth. In this room the full width of the field is the string and sounds a low A at 55 Hz. Every zip you place is a bridge. Each part of the field sounds at the pitch its width gives it. The pencil marks above the canvas give each zip’s position as a fraction; the marks below name the interval between neighbouring parts. Zips snap gently to simple fractions. Hold Shift to place them freely.</p>
    <h3>Controls</h3>
    <dl>
      <dt>Click the field</dt><dd>lay down a zip</dd>
      <dt>Drag a zip</dt><dd>move the bridge</dd>
      <dt>Wheel on a zip</dt><dd>make it wider or narrower</dd>
      <dt>Double-click a zip</dt><dd>pull up the tape</dd>
      <dt>Hover</dt><dd>listen to one part of the field</dd>
      <dt>Strum</dt><dd>play every part, left to right</dd>
    </dl>
    <p class="src">Sources: Newman, “The Sublime Is Now”, The Tiger’s Eye (December 1948); Thomas Hess, Barnett Newman (MoMA, 1971); Ann Temkin (ed.), Barnett Newman (Philadelphia, 2002); reporting on the Stedelijk attacks in NRC Handelsblad and the New York Times, 1986–1997.</p>
  `,
};

const PW = 542, PH = 242; // cm
const F0 = 55;
const FIELDS = [
  { name: 'Cadmium red', rgb: [0.71, 0.13, 0.09] },
  { name: 'Ultramarine', rgb: [0.1, 0.15, 0.52] },
  { name: 'Black', rgb: [0.075, 0.07, 0.07] },
  { name: 'Earth red', rgb: [0.36, 0.15, 0.11] },
  { name: 'Raw canvas', rgb: [0.84, 0.8, 0.71] },
];
const ZIPS = [
  { name: 'White', rgb: [0.93, 0.91, 0.86] },
  { name: 'Cadmium orange', rgb: [0.93, 0.45, 0.14] },
  { name: 'Maroon', rgb: [0.42, 0.06, 0.07] },
  { name: 'Yellow', rgb: [0.95, 0.8, 0.2] },
  { name: 'Ultramarine', rgb: [0.12, 0.17, 0.6] },
  { name: 'Black', rgb: [0.06, 0.06, 0.06] },
];
const RATIOS = [
  [1, 1, 'unison'], [2, 1, 'octave'], [3, 2, 'fifth'], [4, 3, 'fourth'], [5, 4, 'major third'], [6, 5, 'minor third'],
  [5, 3, 'major sixth'], [8, 5, 'minor sixth'], [9, 8, 'whole tone'], [16, 15, 'semitone'], [7, 4, 'harmonic seventh'],
  [15, 8, 'major seventh'], [9, 5, 'minor seventh'], [3, 1, 'twelfth'], [5, 2, 'major tenth'], [4, 1, 'two octaves'], [7, 5, 'septimal tritone'], [7, 6, 'septimal minor third'],
];
const NOTE = ['A', 'B♭', 'B', 'C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯'];
function noteName(f) {
  const n = 12 * Math.log2(f / 55);
  const r = Math.round(n);
  const cents = Math.round((n - r) * 100);
  const oct = 1 + Math.floor((r + 9) / 12);
  return `${NOTE[((r % 12) + 12) % 12]}${oct}${cents ? (cents > 0 ? ' +' : ' −') + Math.abs(cents) + '¢' : ''}`;
}
function nearestRatio(a, b, tol = 0.012) {
  const r = Math.max(a, b) / Math.min(a, b);
  let best = null;
  for (const [p, q, name] of RATIOS) {
    const d = Math.abs(Math.log(r / (p / q)));
    if (d < tol && (!best || d < best.d)) best = { p, q, name, d };
  }
  return best;
}

const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;

const FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec2 uScreen; uniform vec4 uRect; // painting rect on screen px (x0,y0,x1,y1)
uniform vec3 uField; uniform float uTime, uSeed, uFrameOnly;
uniform int uN;
uniform vec4 uZ[8];    // x (0..1), width cm, style, highlight
uniform vec3 uZC[8];   // colour
uniform float uSeg[9]; // per-segment glow (hover)
uniform float uBounds[10];
out vec4 o;
${GLSL_NOISE}
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
void main(){
  vec2 sp = vec2(gl_FragCoord.x, uScreen.y - gl_FragCoord.y);
  vec2 p = (sp - uRect.xy) / (uRect.zw - uRect.xy);
  vec3 col;
  bool inside = p.x >= 0.0 && p.x <= 1.0 && p.y >= 0.0 && p.y <= 1.0;
  if (uFrameOnly > 0.5) { p = clamp(p, 0.0, 1.0); inside = true; }
  if (!inside) {
    // gallery wall, white-ish in low light
    col = lin(vec3(0.27, 0.265, 0.255)) * (0.9 + 0.1 * fbm(sp * 0.004));
    vec2 c = (uRect.xy + uRect.zw) * 0.5;
    float d = length((sp - c) / (uRect.zw - uRect.xy));
    col *= 1.15 - 0.5 * d;
    // shadow below and to the right of the canvas
    vec2 q = (sp - vec2(uRect.x + 6.0, uRect.y + 10.0)) / (uRect.zw - uRect.xy);
    float sx = max(-q.x, q.x - 1.0), sy = max(-q.y, q.y - 1.0);
    float sd = max(sx * (uRect.z - uRect.x), sy * (uRect.w - uRect.y));
    col *= 1.0 - 0.5 * smoothstep(18.0, -4.0, sd);
  } else {
    vec2 cm = p * vec2(${PW}.0, ${PH}.0);
    // flat field, but rolled and brushed by hand: long, faint horizontal passes
    vec3 f = lin(uField);
    f *= 0.95 + 0.06 * fbm(vec2(cm.x * 0.01, cm.y * 0.06) + uSeed) + 0.03 * vnoise(vec2(cm.x * 0.3, cm.y * 2.0));
    col = f;
    // the part you are listening to warms a little
    for (int k = 0; k < 9; k++) {
      if (k > uN) break;
      float a = uBounds[k], b = uBounds[k + 1];
      if (p.x >= a && p.x < b) col *= 1.0 + 0.12 * uSeg[k];
    }
    for (int i = 0; i < 8; i++) {
      if (i >= uN) break;
      vec4 z = uZ[i];
      float hw = z.y * 0.5;
      float dx = (p.x - z.x) * ${PW}.0;
      // masking tape edges: paint creeps under the tape in tiny feathers
      float bleedL = (vnoise(vec2(cm.y * 1.6, float(i) * 7.0)) - 0.5) * 0.35 + (vnoise(vec2(cm.y * 2.5, float(i))) - 0.5) * 0.08;
      float bleedR = (vnoise(vec2(cm.y * 1.6, float(i) * 7.0 + 50.0)) - 0.5) * 0.35 + (vnoise(vec2(cm.y * 2.5, float(i) + 9.0)) - 0.5) * 0.08;
      float rough = z.z; // 1: knifed by hand, as in Onement I
      bleedL += rough * (fbm(vec2(cm.y * 0.25, float(i))) - 0.5) * hw * 1.6;
      bleedR += rough * (fbm(vec2(cm.y * 0.25, float(i) + 3.0)) - 0.5) * hw * 1.6;
      float aa = 0.12 + rough * 0.25 + 0.5 * ${PW}.0 / (uRect.z - uRect.x);
      float m = smoothstep(-hw - bleedL - aa, -hw - bleedL + aa, dx) * (1.0 - smoothstep(hw + bleedR - aa, hw + bleedR + aa, dx));
      vec3 zc = lin(uZC[i]) * (0.94 + 0.08 * vnoise(vec2(cm.x * 2.0, cm.y * 0.4) + float(i)));
      if (rough > 0.5) zc *= 0.88 + 0.2 * fbm(cm * vec2(1.4, 0.3) + float(i));
      // where a light zip crosses a dark field, a ghost of the field shows at its edge
      col = mix(col, zc, m * (0.96 - 0.12 * rough * vnoise(cm * 0.8)));
      col += vec3(0.04) * z.w * smoothstep(hw + 1.6, hw, abs(dx));
    }
    // overall light: a soft wash from above
    col *= 1.02 - 0.12 * p.y;
  }
  vec3 outc = pow(max(col, 0.0), vec3(1.0/2.2));
  outc += (hash12(sp + fract(uTime) * 17.0) - 0.5) * 0.014;
  o = vec4(outc, 1.0);
}`;

export function create(shell) {
  const cv = shell.canvas();
  const gl = createGL(cv);
  const prog = program(gl, QUAD_VS, FS);
  const Q = quad(gl);

  // pencil annotations live in the DOM, over the wall
  const notes = document.createElement('div');
  notes.style.cssText = 'position:absolute;inset:0;pointer-events:none;font-family:var(--serif);font-style:italic;color:rgba(236,230,218,.62);font-size:13px';
  shell.root.insertBefore(notes, shell.chrome);

  const S = {
    w: 1, h: 1, dpr: 1, rect: [0, 0, 1, 1], css: [0, 0, 1, 1], time: 0, active: false, seed: Math.random() * 50,
    field: 0, zipColor: 0, zips: [], drag: null, hoverSeg: -1, hoverZip: -1, segGlow: new Array(9).fill(0), shift: false,
  };
  // start with one zip, off-centre, as a first proposal
  S.zips.push({ x: 2 / 3, w: 3.2, c: 0, style: 0, id: 1 });
  let nextId = 2;

  function sorted() { return [...S.zips].sort((a, b) => a.x - b.x); }
  function bounds() { return [0, ...sorted().map((z) => z.x), 1]; }

  /* ---------- UI ---------- */
  shell.toolbar.innerHTML = `
    <div class="grp" role="group" aria-label="Field colour"><span class="lbl">Field</span>
      ${FIELDS.map((f, i) => `<button class="can" type="button" data-field="${i}" title="${f.name}" aria-label="Field: ${f.name}" aria-pressed="${i === 0}" style="border-radius:2px;background:rgb(${f.rgb.map((v) => Math.round(v * 255)).join(',')})"></button>`).join('')}
    </div>
    <div class="grp" role="group" aria-label="Zip colour"><span class="lbl">Zip</span>
      ${ZIPS.map((z, i) => `<button class="can" type="button" data-zipc="${i}" title="${z.name}" aria-label="Zip: ${z.name}" aria-pressed="${i === 0}" style="width:10px;border-radius:1px;background:rgb(${z.rgb.map((v) => Math.round(v * 255)).join(',')})"></button>`).join('')}
    </div>
    <div class="grp"><button class="seg" type="button" id="zip-strum">Strum</button></div>`;
  shell.readout.innerHTML = `<div>Full width <b>A1 · 55 Hz</b></div><div id="zip-notes">&nbsp;</div>`;
  const $ = (s) => shell.root.querySelector(s);
  shell.toolbar.addEventListener('click', (e) => {
    const f = e.target.closest('[data-field]');
    if (f) { S.field = +f.dataset.field; shell.toolbar.querySelectorAll('[data-field]').forEach((b) => b.setAttribute('aria-pressed', String(b === f))); }
    const z = e.target.closest('[data-zipc]');
    if (z) {
      S.zipColor = +z.dataset.zipc;
      shell.toolbar.querySelectorAll('[data-zipc]').forEach((b) => b.setAttribute('aria-pressed', String(b === z)));
      if (S.hoverZip >= 0) { const zz = S.zips.find((q) => q.id === S.hoverZip); if (zz) zz.c = S.zipColor; }
    }
  });
  $('#zip-strum').addEventListener('click', () => { initSound(); strum(); });

  function toP(e) {
    const r = cv.getBoundingClientRect();
    return [(e.clientX - r.left - S.css[0]) / (S.css[2] - S.css[0]), (e.clientY - r.top - S.css[1]) / (S.css[3] - S.css[1])];
  }
  function zipAt(px) {
    const tolCm = Math.max(4, 9 / ((S.css[2] - S.css[0]) / PW));
    let best = null;
    for (const z of S.zips) {
      const d = Math.abs(px - z.x) * PW;
      if (d < Math.max(tolCm, z.w * 0.5 + 2) && (!best || d < best.d)) best = { z, d };
    }
    return best ? best.z : null;
  }
  function snap(x) {
    if (S.shift) return x;
    let best = null;
    for (let q = 2; q <= 9; q++) for (let p = 1; p < q; p++) {
      const v = p / q;
      const d = Math.abs(v - x);
      if (d < 0.0045 && (!best || d < best.d)) best = { v, d };
    }
    return best ? best.v : x;
  }

  let ptr = null, downAt = 0, lastClick = 0;
  cv.addEventListener('pointerdown', (e) => {
    initSound();
    shell.hideHint();
    const [px, py] = toP(e);
    if (py < -0.1 || py > 1.1 || px < 0 || px > 1) return;
    ptr = e.pointerId;
    try { cv.setPointerCapture(ptr); } catch {}
    const z = zipAt(px);
    const now = performance.now();
    if (z && now - lastClick < 320) { removeZip(z); lastClick = 0; ptr = null; return; }
    lastClick = now;
    if (z) { S.drag = { z, moved: false, px }; return; }
    if (S.zips.length >= 8) { shell.toast('Eight zips is the most this field will take.'); return; }
    const nz = { x: snap(px), w: 2.4 + Math.random() * 1.6, c: S.zipColor, style: Math.random() < 0.18 ? 1 : 0, id: nextId++ };
    S.zips.push(nz);
    S.drag = { z: nz, moved: false, px, fresh: true };
    pluckAround(nz);
  });
  cv.addEventListener('pointermove', (e) => {
    S.shift = e.shiftKey;
    const [px, py] = toP(e);
    if (S.drag && ptr === e.pointerId) {
      const z = S.drag.z;
      if (py < -0.35 || py > 1.35) { z.lifting = true; } else z.lifting = false;
      const nx = snap(Math.max(0.004, Math.min(0.996, px)));
      if (Math.abs(nx - z.x) > 1e-5) { z.x = nx; S.drag.moved = true; }
      return;
    }
    const z = zipAt(px);
    S.hoverZip = z && py >= 0 && py <= 1 ? z.id : -1;
    cv.style.cursor = S.hoverZip >= 0 ? 'ew-resize' : (px >= 0 && px <= 1 && py >= 0 && py <= 1 ? 'copy' : 'default');
    // which part of the string are we listening to?
    S.hoverSeg = -1;
    if (py >= 0 && py <= 1 && px >= 0 && px <= 1) {
      const b = bounds();
      for (let k = 0; k < b.length - 1; k++) if (px >= b[k] && px < b[k + 1]) S.hoverSeg = k;
    }
  });
  cv.addEventListener('pointerleave', () => { S.hoverSeg = -1; S.hoverZip = -1; });
  const up = (e) => {
    if (e.pointerId !== ptr) return;
    ptr = null;
    if (S.drag) {
      const z = S.drag.z;
      if (z.lifting) removeZip(z);
      else if (S.drag.moved) pluckAround(z);
    }
    S.drag = null;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('contextmenu', (e) => { const [px] = toP(e); const z = zipAt(px); if (z) { e.preventDefault(); removeZip(z); } });
  cv.addEventListener('wheel', (e) => {
    const [px] = toP(e); const z = zipAt(px);
    if (!z) return;
    e.preventDefault();
    z.w = Math.max(1, Math.min(26, z.w * (e.deltaY > 0 ? 0.9 : 1.11)));
  }, { passive: false });
  window.addEventListener('keydown', (e) => { if (e.key === 'Shift') S.shift = true; if (S.active && (e.key === 's' || e.key === 'S')) { initSound(); strum(); } });
  window.addEventListener('keyup', (e) => { if (e.key === 'Shift') S.shift = false; });

  function removeZip(z) {
    S.zips = S.zips.filter((q) => q !== z);
    if (snd) { const t = snd.ctx.currentTime; tape(t); }
  }

  /* ---------- sound ---------- */
  let snd = null;
  function initSound() {
    const A = audio(); if (!A || snd || !shell.bus) return;
    const ctx = A.ctx, out = shell.bus.input;
    const master = ctx.createGain(); master.gain.value = 1; master.connect(out);
    const voices = [];
    for (let i = 0; i < 9; i++) {
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.detune.value = 7;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.value = 0;
      const trem = ctx.createOscillator(); trem.frequency.value = 0.13 + Math.random() * 0.2;
      const tg = ctx.createGain(); tg.gain.value = 0;
      trem.connect(tg).connect(g.gain);
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      o1.connect(lp); o2.connect(lp); lp.connect(g).connect(pan).connect(master);
      o1.start(); o2.start(); trem.start();
      voices.push({ o1, o2, lp, g, tg, pan, f: 110 });
    }
    snd = { ctx, out: master, voices };
  }
  function segs() {
    const b = bounds();
    const r = [];
    for (let k = 0; k < b.length - 1; k++) {
      const l = b[k + 1] - b[k];
      r.push({ l, f: F0 / Math.max(l, 1e-3), mid: (b[k] + b[k + 1]) / 2 });
    }
    return r;
  }
  function updateSound(dt) {
    if (!snd) return;
    const t = snd.ctx.currentTime;
    const ss = segs();
    snd.voices.forEach((v, k) => {
      const s = ss[k];
      if (!s || s.f > 2400) { v.g.gain.setTargetAtTime(0, t, 0.3); v.tg.gain.setTargetAtTime(0, t, 0.3); return; }
      v.o1.frequency.setTargetAtTime(s.f, t, 0.05); v.o2.frequency.setTargetAtTime(s.f, t, 0.05);
      v.lp.frequency.setTargetAtTime(Math.min(8000, s.f * (k === S.hoverSeg ? 4.5 : 2.2)), t, 0.2);
      if (v.pan.pan) v.pan.pan.setTargetAtTime((s.mid * 2 - 1) * 0.8, t, 0.2);
      const loud = (k === S.hoverSeg ? 0.1 : 0.022) * Math.pow(Math.min(1, s.l * 2.2), 0.5) * Math.pow(110 / s.f, 0.25);
      v.g.gain.setTargetAtTime(loud, t, k === S.hoverSeg ? 0.25 : 0.6);
      v.tg.gain.setTargetAtTime(loud * 0.35, t, 0.5);
    });
  }
  function pluck(f, pan, gain = 0.4, when = 0) {
    if (!snd || f > 3000) return;
    const buf = pluckBuffer(snd.ctx, f, 3.2, 0.55, 0.9965);
    playBuffer(buf, snd.out, { gain, pan, when });
  }
  function pluckAround(z) {
    if (!snd) return;
    const b = bounds();
    const i = b.indexOf(z.x);
    if (i < 0) return;
    const L = b[i] - b[i - 1], R = b[i + 1] - b[i];
    pluck(F0 / L, (b[i - 1] + b[i]) - 1, 0.35);
    pluck(F0 / R, (b[i] + b[i + 1]) - 1, 0.35, snd.ctx.currentTime + 0.06);
  }
  function strum() {
    if (!snd) return;
    const ss = segs();
    const t = snd.ctx.currentTime;
    ss.forEach((s, k) => pluck(s.f, s.mid * 2 - 1, 0.32, t + k * 0.11));
  }
  function tape(t) {
    // the rasp of masking tape pulled off
    const ctx = snd.ctx;
    const n = ctx.createBufferSource();
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.15 ? 1 : 0.2) * Math.sin(Math.PI * i / len);
    n.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500;
    const g = ctx.createGain(); g.gain.value = 0.25;
    n.connect(f).connect(g).connect(snd.out); n.start(t);
  }

  /* ---------- annotations ---------- */
  let lastSig = '';
  function annotate() {
    const sz = sorted();
    const sig = sz.map((z) => z.x.toFixed(4)).join(',') + '|' + S.css.join(',');
    if (sig === lastSig) return;
    lastSig = sig;
    const [x0, y0, x1, y1] = S.css;
    const W = x1 - x0;
    let html = '';
    const frac = (x) => {
      for (let q = 2; q <= 9; q++) for (let p = 1; p < q; p++) if (Math.abs(p / q - x) < 0.0006) return `${p}⁄${q}`;
      return (x * PW).toFixed(0) + ' cm';
    };
    sz.forEach((z) => {
      const X = x0 + z.x * W;
      html += `<div style="position:absolute;left:${X}px;top:${y0 - 22}px;transform:translateX(-50%);white-space:nowrap">${frac(z.x)}</div>`;
      html += `<div style="position:absolute;left:${X}px;top:${y0 - 6}px;width:1px;height:5px;background:rgba(236,230,218,.4)"></div>`;
    });
    const b = [0, ...sz.map((z) => z.x), 1];
    for (let k = 1; k < b.length - 1; k++) {
      const L = b[k] - b[k - 1], R = b[k + 1] - b[k];
      const r = nearestRatio(L, R);
      const X = x0 + b[k] * W;
      const label = r ? `${r.p}:${r.q} ${r.name}` : `${(Math.max(L, R) / Math.min(L, R)).toFixed(3)}`;
      html += `<div style="position:absolute;left:${X}px;top:${y1 + 8}px;transform:translateX(-50%);white-space:nowrap;${r ? '' : 'opacity:.5'}">${label}</div>`;
    }
    notes.innerHTML = html;
    const ss = segs();
    $('#zip-notes').textContent = ss.map((s) => (s.f > 2400 ? '(too high)' : noteName(s.f))).join(' · ');
  }

  /* ---------- lifecycle ---------- */
  function resize(w, h, dpr) {
    dpr = Math.min(dpr, 1.5);
    S.dpr = dpr; S.w = Math.round(w * dpr); S.h = Math.round(h * dpr); cv.width = S.w; cv.height = S.h;
    const mw = w - Math.max(40, w * 0.08), mh = h - 260;
    let cw = mw, ch = cw * PH / PW;
    if (ch > mh) { ch = mh; cw = ch * PW / PH; }
    const x0 = (w - cw) / 2, y0 = Math.max(95, (h - ch) / 2 - 10);
    S.css = [x0, y0, x0 + cw, y0 + ch];
    S.rect = S.css.map((v) => v * dpr);
    lastSig = '';
  }
  function uniforms(rect, screen, frameOnly) {
    const sz = sorted();
    const Z = [], ZC = [];
    for (let i = 0; i < 8; i++) {
      const z = sz[i];
      Z.push(z ? z.x : -1, z ? z.w : 0, z ? z.style : 0, z && (z.id === S.hoverZip || (S.drag && S.drag.z === z)) && !frameOnly ? 1 : 0);
      ZC.push(...(z ? ZIPS[z.c].rgb : [0, 0, 0]));
    }
    const b = [0, ...sz.map((z) => z.x), 1];
    while (b.length < 10) b.push(2);
    return {
      uScreen: screen, uRect: rect, uField: FIELDS[S.field].rgb, uTime: S.time, uSeed: S.seed, uFrameOnly: frameOnly ? 1 : 0,
      uN: sz.length, uZ: Z, uZC: ZC, uSeg: frameOnly ? new Array(9).fill(0) : S.segGlow, uBounds: b,
    };
  }
  function frame(dt) {
    S.time += dt;
    for (let k = 0; k < 9; k++) S.segGlow[k] += ((k === S.hoverSeg ? 1 : 0) - S.segGlow[k]) * Math.min(1, dt * 4);
    target(gl, null);
    use(gl, prog, uniforms(S.rect, [S.w, S.h], false));
    Q.draw();
    annotate();
    updateSound(dt);
  }
  function fresh() { S.zips = []; shell.toast('The tape is up. The field is whole again: one string, one A.'); }

  async function hang(n) {
    const OW = 1500, OH = Math.round(OW * PH / PW);
    const t = texture(gl, OW, OH, {});
    const fb = framebuffer(gl, t);
    target(gl, fb);
    use(gl, prog, uniforms([0, 0, OW, OH], [OW, OH], true));
    Q.draw();
    const c2 = readToCanvas(gl, fb, OW, OH);
    gl.deleteFramebuffer(fb); gl.deleteTexture(t);
    const sz = sorted();
    const b = [0, ...sz.map((z) => z.x), 1];
    let just = 0, names = [];
    for (let k = 1; k < b.length - 1; k++) { const r = nearestRatio(b[k] - b[k - 1], b[k + 1] - b[k]); if (r) { just++; names.push(`${r.p}:${r.q}`); } }
    const ss = segs().filter((s) => s.f <= 2400).map((s) => noteName(s.f));
    const zipNames = [...new Set(sz.map((z) => ZIPS[z.c].name.toLowerCase()))];
    return {
      image: c2.toDataURL('image/jpeg', 0.92),
      label: {
        ...ARTIST,
        title: zipTitle(n, sz.length, names.slice(0, 3).join(', ')),
        year: year(),
        medium: `Oil on canvas (${FIELDS[S.field].name.toLowerCase()}${zipNames.length ? '; ' + zipNames.join(', ') + ' over masking tape' : ''})`,
        dims: `${PH} × ${PW} cm`,
        facts: [sz.length ? `${sz.length} zip${sz.length > 1 ? 's' : ''} at ${sz.map((z) => (z.x * PW).toFixed(0)).join(', ')} cm` : 'No zips', `Sounds: ${ss.join(', ') || 'A1'}`],
        review: zipReview({ just, zips: sz.length }),
      },
    };
  }

  let hinted = false;
  return {
    resize, frame, fresh, hang,
    enter() { S.active = true; initSound(); notes.hidden = false; if (!hinted) { hinted = true; shell.hint('The whole field sounds a low A. Every zip is a bridge on the string.<small>Click to lay a zip · drag to tune · hover to listen · Shift places freely</small>', 7000); } },
    leave() { S.active = false; },
  };
}
