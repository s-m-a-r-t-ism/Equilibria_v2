// III. FIELD: soft rectangles of thin glazed colour, seen in dim light from close up.
// You can walk toward it. Its edges can be moved. The longer you stay, the later it gets:
// the palette drifts from the warm years toward the chapel and the last black-on-grey.

import { createGL, program, use, quad, target, GLSL_NOISE, readToCanvas, texture, framebuffer } from '../gl.js';
import { audio } from '../audio.js';
import { fieldTitle, fieldReview, year, fmtTime, ARTIST, colorName } from '../labels.js';

export const meta = {
  id: 'field',
  numeral: 'IV',
  name: 'Field',
  after: 'After Mark Rothko',
  place: 'A dim room',
  years: '1949–1970',
  swatch: 'linear-gradient(90deg,#d7652a 0 25%,#7a1f2a 25% 55%,#2a1620 55% 80%,#8f8d8a 80%)',
  lede: 'Soft-edged fields of colour in a dim room. Walk up to eighteen inches. Drag the edges, glaze the colour. Stay, and the years pass: the palette darkens toward the chapel.',
  level: 0.85,
  wet: 0.55,
  freshLabel: 'Start again',
  wall: `
    <blockquote>I paint very large pictures. I realize that historically the function of painting large pictures is painting something very grandiose and pompous. The reason I paint them, however, is precisely because I want to be very intimate and human.<cite>Mark Rothko, symposium at the Museum of Modern Art, 1951</cite></blockquote>
    <p>Rothko wanted his pictures hung low, close together, in dim light, and seen from near. He is often quoted as saying the right distance is eighteen inches, about 45 centimetres. Use the scroll wheel or the distance slider to walk across the room until the colour is all there is.</p>
    <p>The paintings are built from many thin layers. He stained the raw canvas, then brushed in diluted oil and egg and resin so that each rectangle has a soft, uneven edge and seems lit from behind. The edges are where the picture breathes.</p>
    <h3>Time in this room</h3>
    <p>The painting starts in 1949, in the warm years of oranges, yellows and reds. While you stay, it ages. By 1958 it is the maroon and black of the murals he painted for the Four Seasons restaurant in the Seagram Building, then withdrew. By 1966 it is the plum-black of the chapel in Houston. If you stay about six minutes you reach 1969 and the <i>Black on Gray</i> paintings, with their white taped border. He died in February 1970.</p>
    <h3>The sound</h3>
    <p>Each rectangle sings one slow chord tone, chosen from its colour: darker fields sit lower, warmer fields higher. Bigger fields are louder. Walk closer and the chord opens up.</p>
    <h3>Controls</h3>
    <dl>
      <dt>Wheel, W S, slider</dt><dd>walk toward or away</dd>
      <dt>Drag an edge</dt><dd>reshape a field</dd>
      <dt>Click a field</dt><dd>lay on another glaze</dd>
      <dt>Start again</dt><dd>back to 1949</dd>
    </dl>
    <p class="src">Sources: Rothko, statement at MoMA symposium “How to Combine Architecture, Painting and Sculpture” (1951); Christopher Rothko, Mark Rothko: From the Inside Out (2015); Dore Ashton, About Rothko (1983).</p>
  `,
};

const PW = 230, PH = 290, HANG = 40; // painting size and height of its lower edge above the floor (cm)

// palettes by year: ground, then up to three fields
const KEYS = [
  { y: 1949, g: '#cf5b25', f: ['#efb93a', '#c53d26', '#e98a3a'] },
  { y: 1953, g: '#b2332b', f: ['#e3a145', '#6e1b27', '#d4603b'] },
  { y: 1956, g: '#2c4a63', f: ['#6c8b85', '#262b52', '#c3ad66'] },
  { y: 1958, g: '#3a0f13', f: ['#6e1a1d', '#260808', '#8c2b1f'] },
  { y: 1964, g: '#29151e', f: ['#1c1013', '#3a1f28', '#24131a'] },
  { y: 1969, g: '#e9e6df', f: ['#141212', '#141212', '#8a8784'] },
];
const DURATION = 380; // seconds from 1949 to 1969

function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
const lin = (c) => c.map((v) => Math.pow(v, 2.2));
const unlin = (c) => c.map((v) => Math.pow(Math.max(0, v), 1 / 2.2));

function paletteAt(yr) {
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) if (yr >= KEYS[i].y && yr <= KEYS[i + 1].y) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  if (yr >= KEYS[KEYS.length - 1].y) a = b = KEYS[KEYS.length - 1];
  const t = a === b ? 0 : (yr - a.y) / (b.y - a.y);
  const s = t * t * (3 - 2 * t);
  const mix = (x, y) => unlin(lin(hex(x)).map((v, i) => v + (lin(hex(y))[i] - v) * s));
  return { g: mix(a.g, b.g), f: a.f.map((c, i) => mix(c, b.f[i])) };
}

const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;

const FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec2 uScreen, uCenter;
uniform float uScale, uTime, uBreath, uExposure, uDist, uBorder, uFrameOnly, uSeed, uLate, uUseCache;
uniform sampler2D uCache;
uniform vec3 uGround;
uniform vec3 uCol[3];
uniform vec4 uRect[3];   // x0,y0,x1,y1 in painting units 0..1
uniform vec3 uGlaze[3];  // tint
uniform float uGlazeAmt[3];
uniform float uFeather[3];
uniform vec2 uPaint;     // painting size cm
uniform float uHang;
uniform vec2 uHover;     // rect index + edge code
out vec4 o;
${GLSL_NOISE}

vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }

vec3 painting(vec2 p){
  // p in 0..1 (y down)
  vec2 cm = p * uPaint;
  // stained ground: thin, streaky, cloudy; the weave shows
  vec3 g = lin(uGround);
  float cloud = fbm(p * vec2(2.2, 3.0) + uSeed);
  float streak = fbm(vec2(p.x * 2.0, p.y * 14.0) + uSeed + 3.0);
  g *= 0.78 + 0.22 * cloud + 0.16 * streak;
  vec3 col = g;
  for (int i = 0; i < 3; i++) {
    vec4 r = uRect[i];
    if (r.z <= r.x) continue;
    float fe = uFeather[i];
    float fi = float(i);
    vec2 c = (r.xy + r.zw) * 0.5, hs = (r.zw - r.xy) * 0.5;
    vec2 q = abs(p - c) - hs + fe;
    float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - fe;
    // edges eaten by the brush: slow swells and quick fraying
    float wob = (fbm(p * vec2(5.0, 9.0) + fi * 13.1 + uSeed) - 0.5) * fe * 2.4
              + (fbm(p * vec2(28.0, 40.0) + fi * 3.0) - 0.5) * fe * 1.2;
    float e = sd + wob;
    float mask = 1.0 - smoothstep(-fe * 1.1, fe * 1.1, e);
    // scumbled body: thinner toward the edge, uneven within, ground glows through
    float clouds = fbm(p * vec2(3.0, 5.0) + fi * 7.7 + uSeed * 1.3);
    float brush = fbm(vec2(p.x * 3.0, p.y * 22.0) + fi * 5.0 + uSeed);
    float edgeThin = smoothstep(fe * 1.5, -fe * 3.0, e);
    float a = mask * mix(0.5, 0.97, edgeThin) * (0.78 + 0.22 * clouds);
    vec3 c1 = lin(uCol[i]);
    c1 *= 0.8 + 0.3 * clouds + 0.1 * brush;
    // inside the edge the colour lightens, as if lit from behind
    float rim = smoothstep(fe * 3.0, 0.0, abs(e + fe * 1.2)) * mask;
    c1 = mix(c1, min(c1 * 1.35 + g * 0.1, vec3(1.0)), rim * 0.4);
    col = mix(col, c1 + g * 0.08 * (1.0 - edgeThin), clamp(a, 0.0, 1.0));
    // glazes sit over the field and stain the ground just past its edge
    float gm = 1.0 - smoothstep(-fe, fe * 2.5, e);
    col = mix(col, col * lin(uGlaze[i]) * 1.7, uGlazeAmt[i] * gm * (0.65 + 0.35 * clouds));
  }
  // the taped white border of the last paintings
  float bx = min(min(p.x, 1.0 - p.x) * uPaint.x, min(p.y, 1.0 - p.y) * uPaint.y);
  float border = uBorder * (1.0 - smoothstep(4.5, 5.2 + vnoise(p * 300.0) * 0.6, bx));
  col = mix(col, lin(vec3(0.93, 0.92, 0.89)) * (0.95 + 0.05 * vnoise(p * 80.0)), border);
  // fine weave, visible only when close
  return col;
}

void main(){
  vec2 sp = vec2(gl_FragCoord.x, uScreen.y - gl_FragCoord.y);
  vec2 w = (sp - uScreen * 0.5) / uScale + uCenter; // wall cm, origin = painting top-left
  vec2 p = w / uPaint;
  vec3 col;
  float floorY = uPaint.y + uHang;
  if (uFrameOnly > 0.5) {
    col = painting(clamp(p, 0.0, 1.0));
    col *= uExposure;
    o = vec4(pow(col, vec3(1.0/2.2)), 1.0);
    return;
  }
  if (w.y > floorY) {
    // floor: dark boards catching a little of the light
    float fy = (w.y - floorY);
    // boards parallel to the wall, foreshortened
    float v = log(1.0 + fy * 0.03) * 9.0;
    float board = floor(v);
    col = lin(vec3(0.30, 0.25, 0.2)) * (0.82 + 0.18 * hash12(vec2(board, 1.0))) * (0.85 + 0.2 * fbm(vec2(w.x * 0.01 + board * 7.0, board)));
    col *= 1.0 - 0.45 * smoothstep(0.06, 0.0, abs(fract(v) - 0.5) - 0.44);
    col *= 0.55 + 0.45 * exp(-fy * 0.004);
    // skirting board
    col = mix(col, lin(vec3(0.5, 0.48, 0.44)), step(fy, 0.0));
    if (fy < 10.0) col = lin(vec3(0.42, 0.40, 0.37)) * (1.0 - fy * 0.02);
  } else {
    // plaster wall, lit from a skylight
    col = lin(vec3(0.56, 0.53, 0.49)) * (0.93 + 0.08 * fbm(w * 0.01));
    col *= mix(1.1, 0.75, clamp((w.y + 120.0) / 600.0, 0.0, 1.0));
  }
  // painting and its shadow on the wall
  vec2 d2 = max(-p, p - 1.0) * uPaint;
  float outside = max(d2.x, d2.y);
  float shadow = smoothstep(16.0, -2.0, max(max(-(w.x - 6.0), (w.x - 6.0) - uPaint.x), max(-(w.y - 9.0), (w.y - 9.0) - uPaint.y)));
  col *= 1.0 - 0.45 * shadow * step(0.0, outside);
  if (outside <= 0.0) {
    col = uUseCache > 0.5 ? lin(texture(uCache, vec2(p.x, 1.0 - p.y)).rgb) : painting(p);
    // fine weave, visible only when close
    vec2 cmw = p * uPaint;
    float weave = sin(cmw.x * 6.2831 * 12.0) * sin(cmw.y * 6.2831 * 12.0);
    float near = smoothstep(0.55, 1.0, uDist);
    col *= 1.0 + weave * 0.035 * near + (vnoise(cmw * 4.0) - 0.5) * 0.06 * near;
    // hover hint on an edge
    if (uHover.x >= 0.0) {
      int i = int(uHover.x);
      vec4 r = uRect[0]; if (i == 1) r = uRect[1]; if (i == 2) r = uRect[2];
      float ed = 1e9;
      int e = int(uHover.y);
      if (e == 0) ed = abs(p.y - r.y) * uPaint.y; if (e == 1) ed = abs(p.y - r.w) * uPaint.y;
      if (e == 2) ed = abs(p.x - r.x) * uPaint.x; if (e == 3) ed = abs(p.x - r.z) * uPaint.x;
      bool along = (e < 2) ? (p.x > r.x && p.x < r.z) : (p.y > r.y && p.y < r.w);
      if (along) col += vec3(0.05) * smoothstep(1.5 / uScale * 8.0 + 0.6, 0.0, ed);
    }
    // paint is slightly matte: a whisper of sheen near the top light
    col *= 1.0 + 0.04 * (1.0 - p.y);
  }
  // breathing, and the room dimming over the years
  col *= uExposure * (1.0 + uBreath * 0.035);
  // gallery light pool
  vec2 sc = (sp / uScreen - 0.5) * vec2(uScreen.x / uScreen.y, 1.0);
  col *= 1.0 - 0.35 * dot(sc, sc) * (1.0 - uDist * 0.6);
  vec3 outc = pow(max(col, 0.0), vec3(1.0/2.2));
  outc += (hash12(sp + fract(uTime) * 33.0) - 0.5) * 0.018;
  o = vec4(outc, 1.0);
}`;

export function create(shell) {
  const cv = shell.canvas();
  const gl = createGL(cv);
  const prog = program(gl, QUAD_VS, FS);
  const Q = quad(gl);
  const CW = 1000, CH = Math.round(CW * PH / PW);
  const cacheTex = texture(gl, CW, CH, {});
  const cacheFb = framebuffer(gl, cacheTex);
  const dummy = texture(gl, 1, 1, {});

  const S = {
    w: 1, h: 1, dpr: 1, dist: 0, distT: 0, presence: 0, time: 0, active: false,
    rects: null, glaze: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], glazeAmt: [0, 0, 0], tint: [null, null, null],
    hover: [-1, 0], drag: null, cacheT: 0, cacheDirty: true, closest: 0, seed: Math.random() * 100, glazes: 0, sway: [0, 0], swayT: [0, 0],
  };
  function defaultRects() {
    const v = Math.random();
    if (v < 0.5) return [[0.07, 0.05, 0.93, 0.44], [0.07, 0.49, 0.93, 0.6], [0.07, 0.65, 0.93, 0.95]];
    return [[0.06, 0.04, 0.94, 0.6], [0.06, 0.64, 0.94, 0.72], [0.06, 0.76, 0.94, 0.96]];
  }
  S.rects = defaultRects();

  function yearNow() { return Math.min(1969.99, 1949 + 20 * (S.presence / DURATION)); }

  function cam(w, h) {
    const e = S.dist * S.dist * (3 - 2 * S.dist);
    const s0 = 0.5 * h / PH, s1 = 1.95 * h / PH;
    const scale = s0 * Math.pow(s1 / s0, e);
    const ec = Math.sqrt(e);
    const cx = PW / 2 + S.sway[0] * (1 - e) * 25, cy = (PH * 0.62 + 30) * (1 - ec) + (PH * 0.47) * ec + S.sway[1] * (1 - e) * 10;
    return { scale, center: [cx, cy] };
  }
  function toPainting(clientX, clientY) {
    const r = cv.getBoundingClientRect();
    const sx = (clientX - r.left) * S.dpr, sy = (clientY - r.top) * S.dpr;
    const { scale, center } = cam(S.w, S.h);
    const wx = (sx - S.w / 2) / scale + center[0], wy = (sy - S.h / 2) / scale + center[1];
    return [wx / PW, wy / PH, scale];
  }
  function hitEdge(p, scale) {
    const tol = Math.max(0.012, 14 * S.dpr / scale / PH);
    let best = null;
    S.rects.forEach((r, i) => {
      const inX = p[0] > r[0] && p[0] < r[2], inY = p[1] > r[1] && p[1] < r[3];
      const cand = [
        [0, Math.abs(p[1] - r[1]), inX], [1, Math.abs(p[1] - r[3]), inX],
        [2, Math.abs(p[0] - r[0]) * PW / PH, inY], [3, Math.abs(p[0] - r[2]) * PW / PH, inY],
      ];
      for (const [e, d, ok] of cand) if (ok && d < tol && (!best || d < best.d)) best = { i, e, d };
    });
    return best;
  }
  function hitRect(p) {
    for (let i = 0; i < 3; i++) { const r = S.rects[i]; if (p[0] > r[0] && p[0] < r[2] && p[1] > r[1] && p[1] < r[3]) return i; }
    return -1;
  }

  /* ---------- UI ---------- */
  shell.toolbar.innerHTML = `
    <div class="grp"><label class="lbl" for="field-d">Distance</label><input id="field-d" type="range" min="0" max="1000" value="0" style="width:180px"><output id="field-do">4.0 m</output></div>
    <div class="grp"><button class="seg" type="button" id="field-glaze">Glaze a field</button></div>`;
  shell.readout.innerHTML = `<div>The year is <b id="field-yr">1949</b></div><div id="field-pal">&nbsp;</div>`;
  const $ = (s) => shell.root.querySelector(s);
  const dIn = $('#field-d'), dOut = $('#field-do');
  dIn.addEventListener('input', () => { S.distT = +dIn.value / 1000; });
  $('#field-glaze').addEventListener('click', () => glaze(Math.floor(Math.random() * 3)));

  function metres() { const m = 4.0 * Math.pow(0.457 / 4.0, S.dist); return m; }

  cv.addEventListener('wheel', (e) => { e.preventDefault(); S.distT = Math.max(0, Math.min(1, S.distT - e.deltaY * 0.0009)); }, { passive: false });
  const pts = new Map();
  let pinch0 = null;
  cv.addEventListener('pointerdown', (e) => {
    initSound();
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), t: S.distT }; S.drag = null; return; }
    const [px, py, sc] = toPainting(e.clientX, e.clientY);
    const h = hitEdge([px, py], sc);
    try { cv.setPointerCapture(e.pointerId); } catch {}
    if (h) { S.drag = { ...h, moved: false }; return; }
    const ri = hitRect([px, py]);
    S.drag = { click: ri, x: e.clientX, y: e.clientY };
  });
  cv.addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect();
    S.swayT = [(e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1];
    if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch0 && pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      S.distT = Math.max(0, Math.min(1, pinch0.t + Math.log(d / pinch0.d) * 0.5));
      return;
    }
    const [px, py, sc] = toPainting(e.clientX, e.clientY);
    if (S.drag && S.drag.e != null) {
      const r = S.rects[S.drag.i];
      const minS = 0.06;
      if (S.drag.e === 0) r[1] = Math.max(0.02, Math.min(r[3] - minS, py));
      if (S.drag.e === 1) r[3] = Math.min(0.98, Math.max(r[1] + minS, py));
      if (S.drag.e === 2) r[0] = Math.max(0.02, Math.min(r[2] - minS, px));
      if (S.drag.e === 3) r[2] = Math.min(0.98, Math.max(r[0] + minS, px));
      S.drag.moved = true;
      return;
    }
    const h = hitEdge([px, py], sc);
    S.hover = h ? [h.i, h.e] : [-1, 0];
    cv.style.cursor = h ? (h.e < 2 ? 'ns-resize' : 'ew-resize') : (hitRect([px, py]) >= 0 ? 'pointer' : 'default');
  });
  const up = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch0 = null;
    if (S.drag && S.drag.click != null && S.drag.click >= 0 && Math.hypot(e.clientX - S.drag.x, e.clientY - S.drag.y) < 6) glaze(S.drag.click);
    S.drag = null;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  window.addEventListener('keydown', (e) => {
    if (!S.active) return;
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') { S.distT = Math.min(1, S.distT + 0.08); e.preventDefault(); }
    if (k === 's' || k === 'arrowdown') { S.distT = Math.max(0, S.distT - 0.08); e.preventDefault(); }
    if (k === 'g') glaze(Math.floor(Math.random() * 3));
  });

  function glaze(i) {
    // a thin layer of a neighbouring colour from the current year
    const pal = paletteAt(yearNow());
    const choices = [pal.g, ...pal.f].filter((_, k) => k !== i + 1);
    const c = choices[Math.floor(Math.random() * choices.length)];
    S.glaze[i] = c.map((v) => Math.min(1, v * 1.15 + 0.08));
    S.glazeAmt[i] = Math.min(0.75, S.glazeAmt[i] + 0.22);
    S.glazes++;
    S.cacheDirty = true;
    if (snd) chime(i);
  }

  /* ---------- sound ---------- */
  let snd = null;
  const DEG = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8];
  function pitchFor(rgb) {
    const lum = 0.3 * rgb[0] + 0.55 * rgb[1] + 0.15 * rgb[2];
    const warm = rgb[0] - rgb[2];
    const deg = DEG[Math.max(0, Math.min(6, Math.round(3 + warm * 4)))];
    const oct = lum < 0.12 ? 0.5 : lum < 0.35 ? 1 : 2;
    return 65.41 * deg * oct; // C2-based
  }
  function initSound() {
    const A = audio(); if (!A || snd || !shell.bus) return;
    const ctx = A.ctx, out = shell.bus.input;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 0.4;
    const breath = ctx.createGain(); breath.gain.value = 1;
    lp.connect(breath).connect(out);
    const voices = [];
    for (let i = 0; i < 4; i++) {
      const g = ctx.createGain(); g.gain.value = 0;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (pan.pan) pan.pan.value = [-0.5, 0.45, -0.2, 0.25][i];
      const oscs = [];
      for (let k = 0; k < 3; k++) {
        const o = ctx.createOscillator();
        o.type = k === 2 ? 'triangle' : 'sine';
        o.detune.value = [-4, 5, 1201][k];
        const og = ctx.createGain(); og.gain.value = [0.5, 0.5, 0.12][k];
        o.connect(og).connect(g);
        o.start();
        oscs.push(o);
      }
      g.connect(pan).connect(lp);
      voices.push({ g, oscs });
    }
    snd = { ctx, out, lp, breath, voices };
  }
  function chime(i) {
    const ctx = snd.ctx, t = ctx.currentTime;
    const f = snd.voices[i + 1].oscs[0].frequency.value * 4;
    [1, 2.76, 5.4].forEach((m, k) => {
      const o = ctx.createOscillator(); o.frequency.value = f * m;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 / (k + 1), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5 / (k + 1));
      o.connect(g).connect(snd.out); o.start(t); o.stop(t + 4);
    });
  }
  function updateSound(pal, breath) {
    if (!snd) return;
    const t = snd.ctx.currentTime;
    const late = Math.max(0, (yearNow() - 1956) / 14);
    const near = S.dist;
    snd.lp.frequency.setTargetAtTime(260 + 1900 * near * near * (1 - 0.6 * late), t, 0.4);
    snd.breath.gain.setTargetAtTime(0.85 + 0.15 * breath, t, 0.3);
    const cols = [pal.g, ...pal.f];
    const areas = [0.35, ...S.rects.map((r) => (r[2] - r[0]) * (r[3] - r[1]))];
    cols.forEach((c, i) => {
      const v = snd.voices[i];
      const f = pitchFor(c) * (i === 0 ? 0.5 : 1);
      v.oscs.forEach((o) => o.frequency.setTargetAtTime(f, t, 1.2));
      const amp = (0.05 + 0.18 * areas[i]) * (0.35 + 0.65 * near) * (1 - 0.65 * late);
      v.g.gain.setTargetAtTime(amp, t, 0.8);
    });
  }

  /* ---------- lifecycle ---------- */
  function resize(w, h, dpr) { dpr = Math.min(dpr, 1.5); S.dpr = dpr; S.w = Math.round(w * dpr); S.h = Math.round(h * dpr); cv.width = S.w; cv.height = S.h; }

  function uniforms(pal, breath, frameOnly) {
    const yr = yearNow();
    const late = Math.max(0, (yr - 1956) / 14);
    const border = Math.max(0, Math.min(1, (yr - 1967.5) / 1.5));
    const feather = S.rects.map((_, i) => 0.022 + 0.008 * Math.sin(S.seed + i * 2.1));
    return {
      uGround: pal.g, uCol: pal.f.flat(), uRect: S.rects.flat(), uGlaze: S.glaze.flat(), uGlazeAmt: S.glazeAmt, uFeather: feather,
      uPaint: [PW, PH], uHang: HANG, uTime: S.time, uBreath: breath, uExposure: 1.0 - 0.35 * late, uDist: S.dist,
      uBorder: border, uFrameOnly: frameOnly ? 1 : 0, uSeed: S.seed, uLate: late, uHover: S.drag && S.drag.e != null ? [S.drag.i, S.drag.e] : S.hover,
    };
  }

  function frame(dt) {
    S.time += dt;
    S.presence += dt;
    S.dist += (S.distT - S.dist) * Math.min(1, dt * 2.2);
    S.sway[0] += (S.swayT[0] - S.sway[0]) * Math.min(1, dt * 1.5);
    S.sway[1] += (S.swayT[1] - S.sway[1]) * Math.min(1, dt * 1.5);
    S.closest = Math.max(S.closest, S.dist);
    // glazes slowly sink in
    for (let i = 0; i < 3; i++) S.glazeAmt[i] *= Math.pow(0.995, dt);
    const breath = Math.sin(S.time * Math.PI * 2 / 10); // six breaths a minute
    const pal = paletteAt(yearNow());
    const { scale, center } = cam(S.w, S.h);
    // the painting itself is redrawn into a texture only now and then
    S.cacheT -= dt;
    if (S.cacheT <= 0 || S.drag || S.cacheDirty) {
      S.cacheT = 0.35; S.cacheDirty = false;
      target(gl, cacheFb);
      use(gl, prog, { ...uniforms(pal, 0, true), uExposure: 1, uScreen: [CW, CH], uCenter: [PW / 2, PH / 2], uScale: CW / PW, uUseCache: 0, uCache: dummy });
      Q.draw();
    }
    target(gl, null);
    use(gl, prog, { ...uniforms(pal, breath, false), uScreen: [S.w, S.h], uCenter: center, uScale: scale, uUseCache: 1, uCache: cacheTex });
    Q.draw();
    updateSound(pal, breath);
    // UI
    if (document.activeElement !== dIn) dIn.value = Math.round(S.distT * 1000);
    const m = metres();
    dOut.textContent = S.dist > 0.985 ? '18 in' : m >= 1 ? m.toFixed(1) + ' m' : Math.round(m * 100) + ' cm';
    $('#field-yr').textContent = Math.floor(yearNow());
    $('#field-pal').textContent = [pal.f[0], pal.f[2], pal.g].map(colorName).filter((v, i, a) => a.indexOf(v) === i).join(', ').toLowerCase();
  }

  function fresh() {
    S.presence = 0; S.rects = defaultRects(); S.glazeAmt = [0, 0, 0]; S.seed = Math.random() * 100; S.closest = 0; S.glazes = 0;
    shell.toast('Back to 1949.');
  }

  async function hang(n) {
    const OW = 920, OH = Math.round(OW * PH / PW);
    const t = texture(gl, OW, OH, {});
    const fb = framebuffer(gl, t);
    const pal = paletteAt(yearNow());
    target(gl, fb);
    use(gl, prog, { ...uniforms(pal, 0, true), uScreen: [OW, OH], uCenter: [PW / 2, PH / 2], uScale: OW / PW, uUseCache: 0, uCache: dummy });
    Q.draw();
    const c2 = readToCanvas(gl, fb, OW, OH);
    gl.deleteFramebuffer(fb); gl.deleteTexture(t);
    const yr = Math.floor(yearNow());
    // names, top to bottom, then ground
    const order = S.rects.map((r, i) => [r[1], pal.f[i]]).sort((a, b) => a[0] - b[0]).map((x) => colorName(x[1]));
    const names = [...new Set([...order, colorName(pal.g)])];
    return {
      image: c2.toDataURL('image/jpeg', 0.92),
      label: {
        ...ARTIST,
        title: fieldTitle(n, names, yr),
        year: `${year()} (as of ${yr})`,
        medium: 'Oil, egg and dammar resin on canvas, in thin layers' + (S.glazes ? `; ${S.glazes} glaze${S.glazes > 1 ? 's' : ''}` : ''),
        dims: `${PH} × ${PW} cm`,
        facts: [`Seen from as close as ${S.closest > 0.985 ? '18 inches' : Math.round(4.0 * Math.pow(0.457 / 4.0, S.closest) * 100) + ' cm'}`, `${fmtTime(S.presence)} in the room`],
        review: fieldReview({ closest: S.closest, yearReached: yr }),
      },
    };
  }

  let hinted = false;
  return {
    resize, frame, fresh, hang,
    enter() { S.active = true; initSound(); if (!hinted) { hinted = true; shell.hint('Walk closer with the wheel or the slider.<br>Rothko is often quoted asking for eighteen inches.<small>Drag an edge to reshape a field · click a field to glaze it</small>', 7000); } },
    leave() { S.active = false; },
  };
}
