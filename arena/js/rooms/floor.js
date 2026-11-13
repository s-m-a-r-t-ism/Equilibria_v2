// I. FLOOR: enamel thrown from a stick onto canvas laid on a barn floor.
// The physics: ballistic fall, liquid-rope coiling when the hand is slower than the
// thread, Rayleigh-Plateau break-up of thin threads, inertial flicks, slow drying.

import { createGL, floatFormat, texture, framebuffer, program, use, quad, target, GLSL_NOISE, readToCanvas } from '../gl.js';
import { audio, loopNoise, tick, thump } from '../audio.js';
import { floorTitle, floorReview, year, fmtTime, ARTIST, colorName } from '../labels.js';
import { boxCount } from '../fractal.js';

export const meta = {
  id: 'floor',
  numeral: 'I',
  name: 'Floor',
  after: 'After Jackson Pollock and Janet Sobel',
  place: 'A barn at Springs, Long Island',
  years: '1943–1952',
  swatch: 'linear-gradient(90deg,#141210 0 18%,#a9aaa8 18% 30%,#e8e0cf 30% 52%,#c4952f 52% 63%,#141210 63% 80%,#b0402f 80%)',
  lede: 'Enamel thrown from a stick onto canvas laid flat on the floor. The paint falls, coils, breaks into drops and dries. The picture is measured for its fractal dimension while you work.',
  level: 1,
  wet: 0.22,
  wall: `
    <blockquote>On the floor I am more at ease. I feel nearer, more a part of the painting, since this way I can walk around it, work from the four sides and literally be in the painting.<cite>Jackson Pollock, “My Painting”, Possibilities, winter 1947–48</cite></blockquote>
    <p>From 1947 Pollock worked on unstretched canvas tacked to the floor of a barn behind his house at Springs. He poured house-paint enamel and aluminium paint from cans, and let it run off sticks, hardened brushes and a basting syringe. What fell past the edge of the canvas stayed on the floorboards. The floor is still there, covered in it.</p>
    <p>Janet Sobel, a Ukrainian-born grandmother in Brooklyn who began painting in her forties, was making all-over poured pictures before him. Clement Greenberg later wrote that Pollock had seen her work at Peggy Guggenheim’s gallery in 1944 and been struck by it. Her <i>Milky Way</i> (1945) is at MoMA.</p>
    <h3>The physics in this room</h3>
    <p>A viscous thread falling onto a slowly moving surface buckles and coils, like honey on toast. Move the hand faster than the thread falls and it lays down straight. Physicists who filmed Pollock-style pouring found that he moved fast enough to avoid coiling almost entirely. As the stick empties the thread thins, and a thin thread breaks into a string of drops. Stop sharply and the paint keeps going: it flies off the end and lands far ahead.</p>
    <h3>The number in the corner</h3>
    <p>In 1999 Richard Taylor and colleagues measured Pollock’s drip paintings by box-counting and reported fractal dimensions that rose over his career, from about 1.1 in 1943 to about 1.7 in 1952. Others disputed whether the method can tell a Pollock from anything else. This room counts boxes on your canvas the same way, for what it is worth.</p>
    <h3>Controls</h3>
    <dl>
      <dt>Hold</dt><dd>pour from the stick</dd>
      <dt>Swing, release</dt><dd>throw what is left</dd>
      <dt>Can, or 1 to 7</dt><dd>dip into a colour and reload</dd>
      <dt>Wheel, ↑ ↓</dt><dd>stick height above the canvas</dd>
      <dt>T</dt><dd>change tool</dd>
      <dt>New canvas</dt><dd>a fresh canvas; the floor keeps everything</dd>
    </dl>
    <p class="src">Sources: Pollock, “My Painting” (1947); Greenberg, “American-Type Painting” (1955); Taylor, Micolich and Jonas, Nature 399 (1999); Jones-Smith and Mathur, Nature 444 (2006); Herczyński, Cernuschi and Mahadevan, Physics Today (2011); Palacios et al., PLOS ONE (2019).</p>
  `,
};

const WORLD = { w: 230, h: 150 };
const CANVAS = { x0: 30, y0: 22, x1: 200, y1: 122 }; // 170 x 100 cm
const G = 981; // cm/s^2
const CAM_H = 320; // camera height for parallax of airborne paint

const PAINTS = [
  { name: 'Black enamel', short: 'Black', rgb: [0.06, 0.055, 0.05], visc: 1.0, metal: 0, key: '1' },
  { name: 'White lead', short: 'White', rgb: [0.9, 0.87, 0.8], visc: 1.35, metal: 0, key: '2' },
  { name: 'Aluminium paint', short: 'Aluminium', rgb: [0.62, 0.63, 0.64], visc: 0.85, metal: 1, key: '3' },
  { name: 'Yellow ochre', short: 'Ochre', rgb: [0.76, 0.56, 0.18], visc: 1.1, metal: 0, key: '4' },
  { name: 'Cobalt blue', short: 'Cobalt', rgb: [0.12, 0.22, 0.48], visc: 1.0, metal: 0, key: '5' },
  { name: 'Vermilion', short: 'Vermilion', rgb: [0.68, 0.17, 0.11], visc: 0.95, metal: 0, key: '6' },
  { name: 'Thinned black', short: 'Black', rgb: [0.08, 0.075, 0.07], visc: 0.45, metal: 0, key: '7', thin: true },
];

const TOOLS = {
  stick: { label: 'Stick', q0: 22, u0: 25, cap: 40, coil: 1.0, drip: true },
  baster: { label: 'Baster', q0: 11, u0: 190, cap: 35, coil: 0.6, drip: false },
  can: { label: 'Can', q0: 34, u0: 12, cap: 220, coil: 1.6, drip: false },
};

/* ---------------- shaders ---------------- */
const SPLAT_VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aSeg;
layout(location=2) in vec4 aRad;
layout(location=3) in vec4 aCol;
layout(location=4) in vec4 aMat;
uniform vec2 uA; uniform vec2 uB; // clip = P*uA + uB
uniform float uPad;
out vec2 vL; out float vLen; out vec4 vRad; out vec4 vCol; out vec4 vMat; out vec2 vP;
void main(){
  vec2 p0 = aSeg.xy, p1 = aSeg.zw;
  vec2 d = p1 - p0; float len = length(d);
  vec2 dir = len > 1e-4 ? d/len : vec2(1.0,0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float rm = max(aRad.x, aRad.y) * (1.0 + aMat.z) + uPad;
  float a = mix(-rm, len + rm, aCorner.x*0.5+0.5);
  float c = aCorner.y * rm;
  vec2 P = p0 + dir*a + nrm*c;
  vL = vec2(a, c); vLen = len; vRad = aRad; vCol = aCol; vMat = aMat; vP = P;
  gl_Position = vec4(P*uA + uB, 0.0, 1.0);
}`;

const SPLAT_FS = `#version 300 es
precision highp float;
in vec2 vL; in float vLen; in vec4 vRad; in vec4 vCol; in vec4 vMat; in vec2 vP;
uniform int uMode; uniform float uAA;
out vec4 o;
${GLSL_NOISE}
void main(){
  float t = vLen > 1e-4 ? clamp(vL.x / vLen, 0.0, 1.0) : 0.0;
  float r = mix(vRad.x, vRad.y, t);
  vec2 q = vL - vec2(t*vLen, 0.0);
  float dist = length(q);
  float irr = vMat.z;
  if (irr > 0.0) {
    float n = vnoise(vP / max(r, 0.5) * 1.7 + vRad.w * 37.0) * 0.7 + vnoise(vP / max(r,0.5) * 4.3 + vRad.w * 11.0) * 0.3;
    r *= 1.0 + irr * (n * 2.0 - 1.0);
  }
  float aa = uAA;
  float m = 1.0 - smoothstep(r - aa, r + aa, dist);
  if (m <= 0.002) discard;
  float prof = sqrt(max(0.0, 1.0 - (dist*dist) / max(r*r, 1e-4)));
  if (uMode == 0) {
    float a = vCol.a * m;
    o = vec4(vCol.rgb * a, a);
  } else if (uMode == 1) {
    o = vec4(vRad.z * (0.35 + 0.65*prof) * m, 0.0, 0.0, 1.0);
  } else if (uMode == 2) {
    float a = m * step(0.5, vCol.a + 0.5);
    o = vec4(vMat.x * a, vMat.y * a, a, a);
  } else {
    // airborne paint drawn on screen: shaded tube
    float a = vCol.a * m;
    float hl = pow(prof, 3.0) * 0.0 + smoothstep(0.2, 0.9, prof) * 0.25;
    vec3 c = vCol.rgb * (0.65 + 0.5*prof) + hl * mix(0.3, 1.0, vMat.x);
    o = vec4(c * a, a);
  }
}`;

const ADD_FS = `#version 300 es
precision highp float;
in vec2 vUv; uniform sampler2D uT; out vec4 o;
void main(){ o = vec4(texture(uT, vUv).r, 0.0, 0.0, 0.0); }`;

const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;

const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uCol, uH, uMat;
uniform vec2 uScreen, uOff, uWorld, uTexel;
uniform float uScale, uNow, uPpc, uGrain;
uniform vec4 uCanvas;
uniform vec3 uStick; // x, y, height (cm)
uniform float uShowStick; uniform vec2 uStickDir;
out vec4 o;
${GLSL_NOISE}

vec3 floorBoards(vec2 w){
  float plankW = 17.5;
  float row = floor(w.y / plankW);
  float off = hash12(vec2(row, 3.1)) * 300.0;
  float seg = floor((w.x + off) / 260.0);
  vec2 id = vec2(row, seg);
  float tone = hash12(id);
  vec3 base = mix(vec3(0.40,0.30,0.21), vec3(0.52,0.40,0.28), tone);
  float grain = fbm(vec2((w.x+off)*0.035, w.y*0.9 + tone*40.0));
  float fine = vnoise(vec2((w.x+off)*0.6, w.y*6.0));
  base *= 0.82 + 0.3*grain + 0.06*fine;
  // knots
  vec2 kc = vec2(fract((w.x + off)/260.0) , fract(w.y/plankW));
  float knot = smoothstep(0.08, 0.0, length((kc - vec2(hash12(id+7.0), 0.5))*vec2(260.0/plankW*0.25, 1.0)) - 0.02);
  base *= 1.0 - 0.12*knot;
  float gy = abs(fract(w.y / plankW) - 0.5) * plankW;
  float gap = smoothstep(plankW*0.5 - 0.25, plankW*0.5 - 0.05, gy);
  float gx = abs(fract((w.x + off)/260.0) - 0.5) * 260.0;
  gap = max(gap, smoothstep(129.85, 129.98, gx));
  base *= 1.0 - 0.75*gap;
  // old dried paint from years of work: sparse and dusty
  float sp = vnoise(w*vec2(0.5, 1.4) + 13.0) * 0.7 + vnoise(w*3.0) * 0.3;
  float zone = smoothstep(0.55, 0.8, fbm3(w*0.02 + 4.0));
  float spots = smoothstep(0.78, 0.84, sp) * zone;
  vec3 old = mix(vec3(0.08), vec3(0.72,0.7,0.64), step(0.6, vnoise(w*0.07)));
  base = mix(base, old, spots*0.55);
  // dust
  base = mix(base, vec3(0.55,0.5,0.42), 0.12*fbm3(w*0.05));
  return base;
}

vec3 duck(vec2 w){
  float warp = vnoise(vec2(w.x*42.0, w.y*0.7));
  float weft = vnoise(vec2(w.x*0.7, w.y*42.0));
  float slub = smoothstep(0.75, 0.95, vnoise(vec2(w.x*0.4, w.y*9.0))) * 0.5 + smoothstep(0.78, 0.97, vnoise(vec2(w.x*9.0, w.y*0.4))) * 0.5;
  vec3 c = vec3(0.835, 0.785, 0.68);
  c *= 0.93 + 0.05*warp + 0.05*weft + 0.03*slub;
  c = mix(c, c*vec3(0.97,0.95,0.9), fbm3(w*0.03));
  return c;
}

void main(){
  vec2 sp = vec2(gl_FragCoord.x, uScreen.y - gl_FragCoord.y);
  vec2 w = (sp - uOff) / uScale;
  vec2 uv = w / uWorld;
  bool inWorld = all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)));
  bool onCanvas = w.x >= uCanvas.x && w.x <= uCanvas.z && w.y >= uCanvas.y && w.y <= uCanvas.w;

  vec3 L = normalize(vec3(-0.55, -0.7, 0.75));
  vec3 base;
  if (onCanvas) base = duck(w);
  else {
    base = floorBoards(w);
    // the canvas casts a slight shadow on the floor (it has thickness and a few wrinkles)
    vec2 sh = w + L.xy * 0.9;
    vec2 dd = max(vec2(uCanvas.x - sh.x, sh.y - uCanvas.w), vec2(sh.x - uCanvas.z, uCanvas.y - sh.y));
    float outside = max(max(uCanvas.x - sh.x, sh.x - uCanvas.z), max(uCanvas.y - sh.y, sh.y - uCanvas.w));
    base *= 1.0 - 0.45 * smoothstep(1.2, -0.2, outside);
  }

  vec4 pc = vec4(0.0); float h = 0.0, hx = 0.0, hy = 0.0; vec4 mat = vec4(0.0);
  if (inWorld) {
    pc = texture(uCol, uv);
    mat = texture(uMat, uv);
    vec2 e = uTexel * max(1.0, 0.7 * uPpc / uScale);
    h = texture(uH, uv).r;
    hx = texture(uH, uv + vec2(e.x, 0.0)).r - texture(uH, uv - vec2(e.x, 0.0)).r;
    hy = texture(uH, uv + vec2(0.0, e.y)).r - texture(uH, uv - vec2(0.0, e.y)).r;
  }
  float cover = pc.a;
  vec3 paint = cover > 0.001 ? pc.rgb / cover : vec3(0.0);
  float metal = cover > 0.001 ? mat.r / max(mat.b, 1e-3) : 0.0;
  float stamp = cover > 0.001 ? mat.g / max(mat.b, 1e-3) : 0.0;
  float age = fract(uNow / 1800.0 - stamp) * 1800.0;
  float wet = exp(-age / 45.0);

  float relief = 9.0;
  vec3 n = normalize(vec3(-hx * relief, -hy * relief, 1.0));
  float diff = 1.0 + 0.75 * (dot(n, L) - L.z);

  // thin paint on raw duck soaks a little and goes matte at the edges
  float body = smoothstep(0.0, 0.12, h);
  vec3 col = mix(base, paint * mix(0.9, 1.0, body), cover);
  col *= mix(1.0, diff, clamp(cover * 1.2, 0.0, 1.0));

  // gloss: enamel stays glossy, wet paint more so
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 Hh = normalize(L + V);
  float nh = max(dot(n, Hh), 0.0);
  float gloss = cover * (0.18 + 0.55 * wet) * (0.35 + 0.65 * body);
  float spec = pow(nh, 70.0) * gloss * 1.6 + pow(nh, 12.0) * gloss * 0.12;
  // aluminium: a dull mirror with flakes
  if (metal > 0.01) {
    float env = 0.55 + 0.9 * dot(n.xy, -normalize(L.xy)) + 0.25 * fbm3(w * 0.2);
    float flake = step(0.985, hash12(floor(w * uPpc * 1.3))) * 0.6;
    vec3 al = paint * (0.62 + 0.55 * env) + flake * cover;
    col = mix(col, al, metal * cover);
    spec *= 1.0 + 1.5 * metal;
  }
  col += spec * vec3(1.0, 0.97, 0.92);

  // a pool of light from the barn window and a dim surround
  vec2 cc = (vec2(uCanvas.x + uCanvas.z, uCanvas.y + uCanvas.w) * 0.5);
  float dl = length((w - cc + vec2(18.0, 10.0)) / vec2(160.0, 120.0));
  col *= mix(1.06, 0.52, smoothstep(0.35, 1.25, dl));

  // the stick's shadow
  if (uShowStick > 0.5) {
    vec2 shTip = uStick.xy - L.xy / L.z * uStick.z;
    vec2 dir = normalize(uStickDir - L.xy / L.z * 0.76);
    vec2 rel = w - shTip;
    float t = clamp(dot(rel, dir), 0.0, 60.0);
    float dist = length(rel - dir * t);
    float soft = 0.6 + uStick.z * 0.03;
    float s = smoothstep(soft + 0.7, 0.0, dist) * smoothstep(60.0, 20.0, t) * 0.32;
    col *= 1.0 - s;
  }

  // grain
  col += (hash12(sp + fract(uNow) * 91.0) - 0.5) * uGrain;
  o = vec4(pow(max(col, 0.0), vec3(1.0)), 1.0);
}`;

const COVER_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uCol; uniform vec4 uRect; uniform vec2 uStep;
out vec4 o;
void main(){
  vec2 uv = mix(uRect.xy, uRect.zw, vUv);
  float a = 0.0;
  for (int j=0;j<3;j++) for (int i=0;i<3;i++) a = max(a, texture(uCol, uv + (vec2(i,j)-1.0)*uStep).a);
  o = vec4(a, a, a, 1.0);
}`;

/* ---------------- room ---------------- */
export function create(shell) {
  const cv = shell.canvas();
  const gl = createGL(cv);
  const hf = floatFormat(gl, 4, false);
  if (!hf) throw new Error('No renderable half-float textures.');
  const hf1 = floatFormat(gl, 1, false);

  // texture density
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const scr = Math.max(window.innerWidth, window.innerHeight) * Math.min(2, window.devicePixelRatio || 1);
  const ppc = Math.max(5, Math.min(10, Math.floor(Math.min(maxTex / WORLD.w, scr / WORLD.w * 1.1))));
  const TW = Math.round(WORLD.w * ppc), TH = Math.round(WORLD.h * ppc);

  const colTex = texture(gl, TW, TH, {});
  const hTex = texture(gl, TW, TH, { internal: hf1.internal, format: hf1.format, type: hf1.type });
  const hTmp = texture(gl, TW, TH, { internal: hf1.internal, format: hf1.format, type: hf1.type });
  const matTex = texture(gl, TW, TH, { internal: hf.internal, format: hf.format, type: hf.type });
  const fbCol = framebuffer(gl, colTex), fbH = framebuffer(gl, hTex), fbTmp = framebuffer(gl, hTmp), fbMat = framebuffer(gl, matTex);
  for (const fb of [fbCol, fbH, fbTmp, fbMat]) { target(gl, fb); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }

  const pSplat = program(gl, SPLAT_VS, SPLAT_FS);
  const pAdd = program(gl, QUAD_VS, ADD_FS);
  const pComp = program(gl, QUAD_VS, COMPOSITE_FS);
  const pCover = program(gl, QUAD_VS, COVER_FS);
  const Q = quad(gl);

  // coverage target for box counting
  const CW = 510, CH = 300;
  const covTex = texture(gl, CW, CH, {});
  const fbCov = framebuffer(gl, covTex);

  // instanced splats
  const STRIDE = 16;
  let cap = 8192;
  let inst = new Float32Array(cap * STRIDE);
  let count = 0;
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const cornerBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const instBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
  gl.bufferData(gl.ARRAY_BUFFER, inst.byteLength, gl.DYNAMIC_DRAW);
  for (let i = 0; i < 4; i++) {
    gl.enableVertexAttribArray(1 + i);
    gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, STRIDE * 4, i * 16);
    gl.vertexAttribDivisor(1 + i, 1);
  }
  gl.bindVertexArray(null);

  function push(x0, y0, x1, y1, r0, r1, h, seed, rgb, a, metal, stamp, irr) {
    if (count >= cap) {
      cap *= 2;
      const n = new Float32Array(cap * STRIDE); n.set(inst); inst = n;
      gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
      gl.bufferData(gl.ARRAY_BUFFER, inst.byteLength, gl.DYNAMIC_DRAW);
    }
    const o = count * STRIDE;
    inst[o] = x0; inst[o + 1] = y0; inst[o + 2] = x1; inst[o + 3] = y1;
    inst[o + 4] = r0; inst[o + 5] = r1; inst[o + 6] = h; inst[o + 7] = seed;
    inst[o + 8] = rgb[0]; inst[o + 9] = rgb[1]; inst[o + 10] = rgb[2]; inst[o + 11] = a;
    inst[o + 12] = metal; inst[o + 13] = stamp; inst[o + 14] = irr; inst[o + 15] = 0;
    count++;
  }
  function drawInstances(mode, A, B, aa, pad) {
    if (!count) return;
    use(gl, pSplat, { uA: A, uB: B, uMode: mode, uAA: aa, uPad: pad });
    gl.bindVertexArray(vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
    gl.bindVertexArray(null);
  }

  /* ---------- state ---------- */
  const S = {
    w: 1, h: 1, dpr: 1, scale: 5, off: [0, 0],
    target: [115, 70], pos: [115, 70], vel: [0, 0], prevVel: [0, 0], acc: [0, 0], dir: [0.3, 1],
    height: 45, pouring: false, over: false,
    paint: PAINTS[0], tool: 'stick', load: 1,
    coilPhase: 0, stream: 0, lastLand: null, dropAcc: 0, dripT: 0.5, flickCool: 0,
    queue: [], // airborne parcels
    clock: 0, // seconds of sim time
    stamp0: performance.now() / 1000,
    D: null, coverage: 0, dTimer: 0, lastDT: 0, dirty: false,
    stats: null,
    active: false,
  };
  function freshStats() { return { thread: 0, drops: 0, flicks: 0, pourTime: 0, coilSum: 0, vol: {}, started: S.clock }; }
  S.stats = freshStats();

  const now = () => performance.now() / 1000 - S.stamp0;

  /* ---------- deposit primitives (world cm in, texture px out) ---------- */
  function depositSeg(x0, y0, x1, y1, r0, r1, paint, height, irr = 0) {
    push(x0 * ppc, y0 * ppc, x1 * ppc, y1 * ppc, Math.max(0.35, r0 * ppc), Math.max(0.35, r1 * ppc), height, Math.random(), paint.rgb, paint.thin ? 0.82 : 0.97, paint.metal, (now() / 1800) % 1, irr);
    S.dirty = true;
  }
  function splat(x, y, vx, vy, radius, paint, opts = {}) {
    const sp = Math.hypot(vx, vy);
    const ux = sp > 1 ? vx / sp : 1, uy = sp > 1 ? vy / sp : 0;
    const elong = Math.min(4, (opts.elong ?? 1) * sp / 380);
    const hgt = 0.35 + radius * 0.5;
    // main body: an irregular capsule skidding along the direction of travel
    depositSeg(x - ux * radius * 0.2, y - uy * radius * 0.2, x + ux * radius * elong, y + uy * radius * elong, radius, radius * (0.7 - 0.2 * Math.min(1, elong)), paint, hgt, 0.22);
    // crown spikes
    const spikes = opts.spikes ?? Math.round(3 + radius * 4 * Math.random());
    for (let i = 0; i < spikes; i++) {
      const a = Math.atan2(uy, ux) + (Math.random() - 0.5) * (sp > 150 ? 1.6 : 6.28);
      const L = radius * (1.1 + Math.random() * 1.6 + elong * 0.6);
      const r = radius * (0.12 + Math.random() * 0.14);
      depositSeg(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, r, r * 0.45, paint, hgt * 0.5, 0.15);
      if (Math.random() < 0.55) {
        const L2 = L * (1.15 + Math.random() * 0.6);
        const rr = r * (0.6 + Math.random() * 0.7);
        depositSeg(x + Math.cos(a) * L2, y + Math.sin(a) * L2, x + Math.cos(a) * L2, y + Math.sin(a) * L2, rr, rr, paint, hgt * 0.5, 0.2);
      }
    }
    // satellites thrown forward
    const sats = opts.sats ?? Math.round(sp / 90 * Math.random() * 3 + radius * 2);
    for (let i = 0; i < sats; i++) {
      const a = Math.atan2(uy, ux) + (Math.random() - 0.5) * 0.9;
      const L = radius * (2 + Math.random() * 6) + sp * 0.02 * Math.random();
      const rr = radius * (0.06 + Math.random() * 0.2);
      depositSeg(x + Math.cos(a) * L, y + Math.sin(a) * L, x + Math.cos(a) * (L + rr * 2), y + Math.sin(a) * (L + rr * 2), rr, rr * 0.7, paint, hgt * 0.4, 0.1);
    }
  }

  /* ---------- physics step ---------- */
  function fallTime(H, u0) { return (-u0 + Math.sqrt(u0 * u0 + 2 * G * H)) / G; }

  function step(dt) {
    S.clock += dt;
    const tool = TOOLS[S.tool];
    const paint = S.paint;
    // arm: critically damped spring toward the pointer
    const k = 900, c = 2 * Math.sqrt(k) * 0.9;
    const ax = k * (S.target[0] - S.pos[0]) - c * S.vel[0];
    const ay = k * (S.target[1] - S.pos[1]) - c * S.vel[1];
    S.prevVel[0] = S.vel[0]; S.prevVel[1] = S.vel[1];
    S.vel[0] += ax * dt; S.vel[1] += ay * dt;
    S.pos[0] += S.vel[0] * dt; S.pos[1] += S.vel[1] * dt;
    S.acc[0] = S.acc[0] * 0.7 + 0.3 * (S.vel[0] - S.prevVel[0]) / dt;
    S.acc[1] = S.acc[1] * 0.7 + 0.3 * (S.vel[1] - S.prevVel[1]) / dt;
    const speed = Math.hypot(S.vel[0], S.vel[1]);
    if (speed > 20) {
      // the stick trails behind the hand's motion
      const tx = -S.vel[0] / speed * 0.4 + 0.3, ty = -S.vel[1] / speed * 0.4 + 1;
      const tl = Math.hypot(tx, ty);
      S.dir[0] += (tx / tl - S.dir[0]) * 0.05; S.dir[1] += (ty / tl - S.dir[1]) * 0.05;
    }

    const H = S.height;
    const T = fallTime(H, tool.u0);
    const U = tool.u0 + G * T; // speed of the thread at impact
    S.flickCool -= dt;

    // inertial shedding: a sharp deceleration flings paint off the end
    const accAlong = speed > 1 ? (S.acc[0] * S.vel[0] + S.acc[1] * S.vel[1]) / speed : 0;
    if (S.tool !== 'can' && S.load > 0.05 && S.flickCool <= 0 && speed > 110 && -accAlong > 5200) {
      fling(Math.min(1, (-accAlong - 5200) / 9000), S.vel[0], S.vel[1]);
      S.flickCool = 0.16;
    }

    if (S.pouring && S.load > 0.002) {
      const q = tool.q0 * Math.pow(S.load, 1.5) / Math.max(0.6, paint.visc * 0.8 + 0.2);
      S.load = Math.max(0, S.load - q * dt / tool.cap);
      S.stats.pourTime += dt;
      S.stats.vol[paint.name] = (S.stats.vol[paint.name] || 0) + q * dt;
      // thread radius in free fall (mass conservation at impact speed)
      const a = Math.sqrt(q / (Math.PI * U));
      const aCrit = 0.055 * Math.sqrt(H / 40) / Math.pow(paint.visc, 0.7) * (S.tool === 'baster' ? 0.6 : 1);
      const continuous = a > aCrit;
      const vx = S.vel[0] * 0.92, vy = S.vel[1] * 0.92;
      S.queue.push({
        t0: S.clock, tl: S.clock + T, x: S.pos[0], y: S.pos[1], vx, vy, u0: tool.u0, H,
        q, a, cont: continuous, stream: S.stream, paint, kind: 'thread', U,
      });
    } else if (!S.pouring) {
      // between pours the loaded stick still drips
      if (tool.drip && S.load > 0.12 && S.over) {
        S.dripT -= dt * S.load;
        if (S.dripT <= 0) {
          S.dripT = 0.25 + Math.random() * 1.4;
          const Tf = fallTime(H, 0);
          const r = 0.12 + Math.random() * 0.18 * S.load;
          S.queue.push({ t0: S.clock, tl: S.clock + Tf, x: S.pos[0], y: S.pos[1], vx: S.vel[0], vy: S.vel[1], u0: 0, H, r, paint, kind: 'drop' });
          S.load -= 0.004;
        }
      }
    }

    // land everything whose time has come
    const q = S.queue;
    let i = 0;
    while (i < q.length) {
      const p = q[i];
      if (p.tl > S.clock) { i++; continue; }
      q.splice(i, 1);
      land(p, U);
    }
  }

  function fling(strength, vx, vy) {
    const tool = TOOLS[S.tool];
    const vol = tool.cap * S.load * (0.05 + 0.18 * strength);
    S.load = Math.max(0, S.load - vol / tool.cap);
    const n = 1 + Math.round(Math.random() * 2 + strength * 3);
    const H = S.height;
    const T = fallTime(H, 0);
    for (let j = 0; j < n; j++) {
      const f = j === 0 ? 1 : 0.55 + Math.random() * 0.5;
      const ang = (Math.random() - 0.5) * 0.35 * (j === 0 ? 0.3 : 1);
      const cs = Math.cos(ang), sn = Math.sin(ang);
      const v2x = (vx * cs - vy * sn) * f, v2y = (vx * sn + vy * cs) * f;
      const share = j === 0 ? 0.55 : 0.45 / (n - 1 || 1);
      const r = Math.cbrt(vol * share * 3 / (4 * Math.PI)) * 1.6;
      S.queue.push({ t0: S.clock, tl: S.clock + T * (0.95 + Math.random() * 0.1), x: S.pos[0], y: S.pos[1], vx: v2x, vy: v2y, u0: 0, H, r, paint: S.paint, kind: 'blob' });
    }
    S.stats.flicks++;
    S.stream++; // a fling breaks the thread
    S.lastLand = null;
  }

  function land(p, Unow) {
    const T = p.tl - p.t0;
    let x = p.x + p.vx * T, y = p.y + p.vy * T;
    const paint = p.paint;
    const pan = Math.max(-0.8, Math.min(0.8, ((x / WORLD.w) * 2 - 1) * 0.7));
    if (p.kind === 'thread') {
      const tool = TOOLS[S.tool];
      const v = Math.hypot(p.vx, p.vy);
      const r = v / p.U; // translation speed relative to thread speed
      // liquid rope coiling: radius grows with flow and viscosity
      const Rc = Math.min(2.4, (0.35 + 1.05 * Math.sqrt(p.q / 16) * Math.pow(paint.visc, 0.6)) * tool.coil * Math.pow(40 / Math.max(8, p.H), 0.25));
      const amp = p.cont ? 1 - smoothstep(0.45, 1.0, r) : 0;
      const m = smoothstep(0.12, 0.55, r);
      const omega = Math.min(150, p.U / Math.max(0.3, Rc)) * (1 - 0.45 * m);
      S.coilPhase += omega * (1 / 600) * (0.9 + Math.random() * 0.2);
      const tx = v > 1 ? p.vx / v : 1, ty = v > 1 ? p.vy / v : 0;
      const cs = Math.cos(S.coilPhase), sn = Math.sin(S.coilPhase);
      const ox = Rc * amp * ((1 - m) * cs * tx + sn * -ty);
      const oy = Rc * amp * ((1 - m) * cs * ty + sn * tx);
      x += ox; y += oy;
      S.stats.coilSum += amp * (1 / 600);
      if (p.cont) {
        const last = S.lastLand;
        if (last && last.stream === p.stream && last.paint === paint && Math.hypot(x - last.x, y - last.y) < 18) {
          const dl = Math.hypot(x - last.x, y - last.y);
          const vLand = dl * 600 + 1;
          // bead width from volume per length, flattened on impact
          const w = Math.min(2.4, 1.7 * Math.sqrt(p.q / (Math.PI * Math.max(vLand, p.U * 0.2))) + p.a * 0.9);
          depositSeg(last.x, last.y, x, y, last.w, w, paint, 0.18 + w * 0.9);
          S.stats.thread += dl;
          S.lastLand = { x, y, w, stream: p.stream, paint };
        } else {
          const w = Math.min(2.4, p.a * 2.2);
          depositSeg(x, y, x, y, w, w, paint, 0.2 + w);
          S.lastLand = { x, y, w, stream: p.stream, paint };
        }
        audioPour(p.q, Math.hypot(p.vx, p.vy), pan);
      } else {
        // broken thread: drops with Rayleigh-Plateau spacing
        S.lastLand = null;
        S.dropAcc += p.q / 600;
        const rd = p.a * 1.9;
        const vd = (4 / 3) * Math.PI * rd * rd * rd * (0.6 + Math.random() * 0.8);
        if (S.dropAcc >= vd) {
          S.dropAcc -= vd;
          const rr = Math.max(0.06, rd * 1.7);
          depositSeg(x, y, x + p.vx * 0.0006 * rr, y + p.vy * 0.0006 * rr, rr, rr * 0.85, paint, 0.15 + rr, 0.12);
          S.stats.drops++;
          dropSound(rr, pan);
        }
        S.stream++;
      }
    } else if (p.kind === 'drop') {
      const rr = p.r * 1.6;
      splat(x, y, p.vx, p.vy, rr, paint, { spikes: Math.random() < 0.5 ? 0 : 3, sats: Math.random() < 0.6 ? 0 : 2 });
      S.stats.drops++;
      dropSound(rr, pan);
    } else if (p.kind === 'blob') {
      splat(x, y, p.vx, p.vy, p.r, paint, { elong: 1.2 });
      splatSound(p.r, pan);
    }
  }

  function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  /* ---------- sound ---------- */
  let snd = null;
  function initSound() {
    const A = audio(); if (!A || snd || !shell.bus) return;
    const ctx = A.ctx;
    const out = shell.bus.input;
    // room tone of the barn
    const rt = loopNoise(ctx, 'brown');
    const rtf = ctx.createBiquadFilter(); rtf.type = 'lowpass'; rtf.frequency.value = 220;
    const rtg = ctx.createGain(); rtg.gain.value = 0.10;
    rt.connect(rtf).connect(rtg).connect(out);
    // crickets in the field outside
    const cr = ctx.createBufferSource(); cr.buffer = crickets(ctx); cr.loop = true; cr.start();
    const crg = ctx.createGain(); crg.gain.value = 0.07;
    cr.connect(crg).connect(out);
    // pour: a filtered hiss whose gain follows the flow
    const pn = loopNoise(ctx, 'white');
    const pf = ctx.createBiquadFilter(); pf.type = 'bandpass'; pf.frequency.value = 2600; pf.Q.value = 0.9;
    const pg = ctx.createGain(); pg.gain.value = 0;
    const pp = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    pn.connect(pf).connect(pg).connect(pp).connect(out);
    snd = { ctx, out, pf, pg, pp, level: 0, freq: 2600, pan: 0, lastDrop: 0 };
  }
  function audioPour(q, v, pan) {
    if (!snd) return;
    snd.level = Math.max(snd.level, Math.min(0.22, 0.03 + Math.sqrt(q) * 0.035) * (0.4 + Math.min(1, v / 250)));
    snd.freq = 1400 + 3200 / (0.4 + q / 10);
    snd.pan = pan;
  }
  function dropSound(r, pan) {
    if (!snd) return;
    const t = snd.ctx.currentTime;
    if (t - snd.lastDrop < 0.025) return;
    snd.lastDrop = t;
    tick(snd.out, { freq: 900 + 2600 / (0.3 + r * 3), q: 6, gain: 0.05 + r * 0.25, dur: 0.035 + r * 0.05, pan });
  }
  function splatSound(r, pan) {
    if (!snd) return;
    thump(snd.out, { freq: 70 + 40 / (r + 0.5), gain: Math.min(0.6, 0.15 + r * 0.25), dur: 0.22, sweep: 0.8 });
    tick(snd.out, { freq: 700, q: 0.8, gain: Math.min(0.5, 0.1 + r * 0.25), dur: 0.12, pan, type: 'lowpass' });
  }
  function dipSound() {
    if (!snd) return;
    const ctx = snd.ctx, t = ctx.currentTime;
    tick(snd.out, { freq: 380, q: 3, gain: 0.35, dur: 0.09 });
    thump(snd.out, { freq: 140, gain: 0.25, dur: 0.18, sweep: 0.3 });
    // the gloop of a stick pulled out of enamel
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(420, t + 0.12); o.frequency.exponentialRampToValueAtTime(130, t + 0.32);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t + 0.12); g.gain.linearRampToValueAtTime(0.16, t + 0.14); g.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
    o.connect(g).connect(snd.out); o.start(t + 0.1); o.stop(t + 0.4);
  }
  function updateSound(dt) {
    if (!snd) return;
    const t = snd.ctx.currentTime;
    snd.pg.gain.setTargetAtTime(snd.level, t, 0.03);
    snd.pf.frequency.setTargetAtTime(snd.freq, t, 0.05);
    if (snd.pp.pan) snd.pp.pan.setTargetAtTime(snd.pan, t, 0.1);
    snd.level *= Math.pow(0.002, dt);
  }

  /* ---------- UI ---------- */
  shell.toolbar.innerHTML = `
    <div class="grp" role="group" aria-label="Paint">
      ${PAINTS.map((p, i) => `<button class="can" type="button" data-paint="${i}" title="${p.name} (${p.key})" aria-label="${p.name}" aria-pressed="${i === 0}" style="background:${css(p.rgb)}${p.metal ? ';background-image:linear-gradient(135deg,#d9dadb,#7c7e80 55%,#c5c7c9)' : ''}"></button>`).join('')}
    </div>
    <div class="grp" role="group" aria-label="Tool">
      ${Object.entries(TOOLS).map(([k, t]) => `<button class="seg" type="button" data-tool="${k}" aria-pressed="${k === 'stick'}">${t.label}</button>`).join('')}
    </div>
    <div class="grp"><label class="lbl" for="floor-h">Height</label><input id="floor-h" type="range" min="6" max="120" value="45"><output id="floor-ho">45 cm</output></div>
    <div class="grp"><span class="lbl">Load</span><span id="floor-load" style="display:inline-block;width:64px;height:6px;border:1px solid rgba(236,230,218,.4);position:relative"><span style="position:absolute;inset:0;transform-origin:left;background:#ece6da"></span></span></div>
  `;
  shell.readout.innerHTML = `
    <div>Fractal dimension <b id="floor-d">n/a</b></div>
    <div id="floor-yr">&nbsp;</div>
    <div><b id="floor-th">0.0</b> m of thread · <b id="floor-dr">0</b> drops · <b id="floor-fl">0</b> flung</div>`;
  const $ = (s) => shell.root.querySelector(s);
  const loadBar = $('#floor-load span');
  const hIn = $('#floor-h'), hOut = $('#floor-ho');

  function css(rgb) { return `rgb(${rgb.map((v) => Math.round(Math.pow(v, 1 / 1.0) * 255)).join(',')})`; }
  function choosePaint(i) {
    S.paint = PAINTS[i]; S.load = 1; S.stream++; S.lastLand = null;
    shell.toolbar.querySelectorAll('.can').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.paint === i)));
    dipSound();
  }
  function chooseTool(k) {
    S.tool = k; S.load = 1; S.stream++;
    shell.toolbar.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === k)));
  }
  function setHeight(h) {
    S.height = Math.max(6, Math.min(120, h));
    hIn.value = Math.round(S.height); hOut.textContent = Math.round(S.height) + ' cm';
  }
  shell.toolbar.addEventListener('click', (e) => {
    const p = e.target.closest('[data-paint]'); if (p) { initSound(); choosePaint(+p.dataset.paint); }
    const t = e.target.closest('[data-tool]'); if (t) chooseTool(t.dataset.tool);
  });
  hIn.addEventListener('input', () => setHeight(+hIn.value));

  function toWorld(e) {
    const r = cv.getBoundingClientRect();
    const sx = (e.clientX - r.left) * S.dpr, sy = (e.clientY - r.top) * S.dpr;
    return [(sx - S.off[0]) / S.scale, (sy - S.off[1]) / S.scale];
  }
  let ptrId = null;
  cv.addEventListener('pointerdown', (e) => {
    initSound();
    ptrId = e.pointerId;
    try { cv.setPointerCapture(e.pointerId); } catch {}
    const w = toWorld(e);
    if (e.pointerType !== 'mouse') { S.pos = [...w]; S.vel = [0, 0]; }
    S.target = w; S.pouring = true; S.over = true; S.stream++; S.lastLand = null;
    shell.hideHint();
    shell.setIdle(true);
  });
  cv.addEventListener('pointermove', (e) => {
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const last = evs[evs.length - 1] || e;
    S.target = toWorld(last); S.over = true;
  });
  const up = (e) => {
    if (e.pointerId !== ptrId) return;
    ptrId = null;
    if (S.pouring) {
      const sp = Math.hypot(S.vel[0], S.vel[1]);
      if (sp > 160 && S.tool !== 'can' && S.load > 0.05) fling(Math.min(1, sp / 600), S.vel[0], S.vel[1]);
    }
    S.pouring = false; S.stream++; S.lastLand = null;
    shell.setIdle(false);
    if (e.pointerType !== 'mouse') S.over = false;
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && ptrId == null) S.over = false; });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); setHeight(S.height + (e.deltaY > 0 ? 3 : -3)); }, { passive: false });
  const onKey = (e) => {
    if (!S.active) return;
    const i = PAINTS.findIndex((p) => p.key === e.key);
    if (i >= 0) { initSound(); choosePaint(i); }
    if (e.key === 'ArrowUp') { setHeight(S.height + 4); e.preventDefault(); }
    if (e.key === 'ArrowDown') { setHeight(S.height - 4); e.preventDefault(); }
    if (e.key === 't' || e.key === 'T') { const ks = Object.keys(TOOLS); chooseTool(ks[(ks.indexOf(S.tool) + 1) % ks.length]); }
  };
  window.addEventListener('keydown', onKey);

  /* ---------- rendering ---------- */
  function flushSplats() {
    if (!count) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst.subarray(0, count * STRIDE));
    const A = [2 / TW, 2 / TH], B = [-1, -1];
    gl.enable(gl.BLEND);
    // colour: premultiplied over
    target(gl, fbCol);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    drawInstances(0, A, B, 0.75, 2);
    // material: over
    target(gl, fbMat);
    drawInstances(2, A, B, 0.75, 2);
    // height: max within this batch, then add to the accumulated relief
    target(gl, fbTmp);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.blendEquation(gl.MAX);
    drawInstances(1, A, B, 0.75, 2);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);
    target(gl, fbH);
    use(gl, pAdd, { uT: hTmp });
    Q.draw();
    gl.disable(gl.BLEND);
    count = 0;
  }

  function composite(fb, w, h, scale, off, showStick, grain) {
    target(gl, fb);
    use(gl, pComp, {
      uCol: colTex, uH: hTex, uMat: matTex,
      uScreen: [w, h], uOff: off, uWorld: [WORLD.w, WORLD.h], uTexel: [1 / TW, 1 / TH],
      uScale: scale, uNow: now(), uPpc: ppc, uGrain: grain,
      uCanvas: [CANVAS.x0, CANVAS.y0, CANVAS.x1, CANVAS.y1],
      uStick: [S.pos[0], S.pos[1], S.height], uStickDir: S.dir, uShowStick: showStick ? 1 : 0,
    });
    Q.draw();
  }

  // the airborne thread and the stick, drawn with a little parallax
  function proj(x, y, z) {
    const cx = WORLD.w / 2, cy = WORLD.h / 2;
    const k = CAM_H / (CAM_H - z);
    return [cx + (x - cx) * k, cy + (y - cy) * k, k];
  }
  function drawAir() {
    count = 0;
    const A = [2 * S.scale / S.w, -2 * S.scale / S.h];
    const B = [2 * S.off[0] / S.w - 1, 1 - 2 * S.off[1] / S.h];
    // stick
    if (S.over || S.pouring) {
      const tip = proj(S.pos[0], S.pos[1], S.height);
      const base = proj(S.pos[0] + S.dir[0] * 50, S.pos[1] + S.dir[1] * 50, S.height + 38);
      const wood = [0.42, 0.3, 0.18];
      push(base[0], base[1], tip[0], tip[1], 0.75 * base[2], 0.55 * tip[2], 0, 0, wood, 1, 0, 0, 0);
      const lp = S.load;
      if (lp > 0.01) push(tip[0], tip[1], tip[0] + S.dir[0] * 5, tip[1] + S.dir[1] * 5, 0.75 * tip[2] * (0.9 + lp * 0.5), 0.6 * tip[2], 0, 0, S.paint.rgb, 1, S.paint.metal, 0, 0);
    }
    // falling paint
    let prev = null;
    for (const p of S.queue) {
      const tau = S.clock - p.t0;
      const z = Math.max(0, p.H - p.u0 * tau - 0.5 * G * tau * tau);
      const P = proj(p.x + p.vx * tau, p.y + p.vy * tau, z);
      if (p.kind === 'thread') {
        const r = Math.max(0.09, p.a * (1 + 2.5 * z / Math.max(1, p.H))) * P[2];
        if (prev && prev.stream === p.stream && prev.cont && p.cont) push(prev.P[0], prev.P[1], P[0], P[1], prev.r, r, 0, 0, p.paint.rgb, 0.95, p.paint.metal, 0, 0);
        else if (!p.cont && Math.random() < 0.35) push(P[0], P[1], P[0], P[1], r * 1.4, r * 1.4, 0, 0, p.paint.rgb, 0.95, p.paint.metal, 0, 0);
        prev = { P, r, stream: p.stream, cont: p.cont };
      } else {
        const r = p.r * 0.7 * P[2];
        const sp = Math.hypot(p.vx, p.vy) + 1;
        push(P[0], P[1], P[0] - p.vx / sp * r * 1.5, P[1] - p.vy / sp * r * 1.5, r, r * 0.6, 0, 0, p.paint.rgb, 1, p.paint.metal, 0, 0);
        prev = null;
      }
    }
    if (!count) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst.subarray(0, count * STRIDE));
    target(gl, null);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    drawInstances(3, A, B, 0.8 / S.scale, 1.5 / S.scale);
    gl.disable(gl.BLEND);
    count = 0;
  }

  /* ---------- fractal dimension ---------- */
  const covPx = new Uint8Array(CW * CH * 4);
  const mask = new Uint8Array(CW * CH);
  function measure() {
    target(gl, fbCov);
    use(gl, pCover, {
      uCol: colTex,
      uRect: [CANVAS.x0 / WORLD.w, CANVAS.y0 / WORLD.h, CANVAS.x1 / WORLD.w, CANVAS.y1 / WORLD.h],
      uStep: [((CANVAS.x1 - CANVAS.x0) / WORLD.w) / CW / 3, ((CANVAS.y1 - CANVAS.y0) / WORLD.h) / CH / 3],
    });
    Q.draw();
    gl.readPixels(0, 0, CW, CH, gl.RGBA, gl.UNSIGNED_BYTE, covPx);
    for (let i = 0; i < CW * CH; i++) mask[i] = covPx[i * 4 + 3] > 0 && covPx[i * 4] > 110 ? 1 : 0;
    const r = boxCount(mask, CW, CH);
    S.D = r.D; S.coverage = r.coverage;
    const dEl = $('#floor-d'), yEl = $('#floor-yr');
    if (S.D == null) { dEl.textContent = 'n/a'; yEl.innerHTML = '&nbsp;'; }
    else {
      dEl.textContent = S.D.toFixed(2);
      const yr = 1943 + (S.D - 1.12) / (1.72 - 1.12) * 9;
      yEl.textContent = yr < 1943 ? 'sparser than Pollock in 1943' : yr > 1952.5 ? 'denser than Pollock in 1952' : `about where Pollock was in ${Math.round(yr)}`;
    }
  }

  /* ---------- lifecycle ---------- */
  function resize(w, h, dpr) {
    S.dpr = dpr;
    S.w = Math.round(w * dpr); S.h = Math.round(h * dpr);
    cv.width = S.w; cv.height = S.h;
    // fit the canvas plus a margin of floor
    const mx = 26, my = 22;
    const cw = CANVAS.x1 - CANVAS.x0 + mx * 2, ch = CANVAS.y1 - CANVAS.y0 + my * 2;
    const topPad = 70 * dpr, botPad = 74 * dpr;
    S.scale = Math.min(S.w / cw, (S.h - topPad - botPad) / ch);
    const ccx = (CANVAS.x0 + CANVAS.x1) / 2, ccy = (CANVAS.y0 + CANVAS.y1) / 2;
    S.off = [S.w / 2 - ccx * S.scale, topPad + (S.h - topPad - botPad) / 2 - ccy * S.scale];
  }

  function frame(dt) {
    const sub = 10;
    for (let i = 0; i < sub; i++) step(dt / sub);
    updateSound(dt);
    flushSplats();
    composite(null, S.w, S.h, S.scale, S.off, S.over || S.pouring, 0.025);
    drawAir();
    // UI
    loadBar.style.transform = `scaleX(${S.load.toFixed(3)})`;
    S.dTimer += dt;
    if (S.dTimer > 0.9 && S.dirty) { S.dTimer = 0; S.dirty = false; measure(); }
    $('#floor-th').textContent = (S.stats.thread / 100).toFixed(1);
    $('#floor-dr').textContent = S.stats.drops;
    $('#floor-fl').textContent = S.stats.flicks;
  }

  function fresh() {
    // a new canvas on the same floor
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(Math.floor(CANVAS.x0 * ppc), Math.floor(CANVAS.y0 * ppc), Math.ceil((CANVAS.x1 - CANVAS.x0) * ppc), Math.ceil((CANVAS.y1 - CANVAS.y0) * ppc));
    for (const fb of [fbCol, fbH, fbMat]) { gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    gl.disable(gl.SCISSOR_TEST);
    S.stats = freshStats(); S.D = null; S.dirty = true;
    shell.toast('A fresh canvas. The floor remembers the last one.');
  }

  async function hang(n) {
    flushSplats();
    measure();
    const OW = 1360, OH = Math.round(OW * (CANVAS.y1 - CANVAS.y0) / (CANVAS.x1 - CANVAS.x0));
    const t = texture(gl, OW, OH, {});
    const fb = framebuffer(gl, t);
    const sc = OW / (CANVAS.x1 - CANVAS.x0);
    composite(fb, OW, OH, sc, [-CANVAS.x0 * sc, -CANVAS.y0 * sc], false, 0.0);
    const c2 = readToCanvas(gl, fb, OW, OH);
    gl.deleteFramebuffer(fb); gl.deleteTexture(t);
    const vols = Object.entries(S.stats.vol).sort((a, b) => b[1] - a[1]);
    const total = vols.reduce((s, v) => s + v[1], 0) || 1;
    const metalVol = (S.stats.vol['Aluminium paint'] || 0) / total;
    const names = [...new Set(vols.map(([k]) => PAINTS.find((p) => p.name === k)?.short || 'Black'))];
    const mediumList = vols.map(([k]) => k.toLowerCase().replace('thinned black', 'thinned enamel'));
    const medium = (mediumList.length ? cap1(listJoin([...new Set(mediumList)])) : 'Enamel') + ' on unprimed cotton duck';
    const st = { D: S.D, flicks: S.stats.flicks, coils: S.stats.coilSum / Math.max(0.5, S.stats.pourTime), thread: S.stats.thread / 100, metal: metalVol };
    return {
      image: c2.toDataURL('image/jpeg', 0.88),
      label: {
        ...ARTIST,
        title: floorTitle(n, names),
        year: year(),
        medium,
        dims: '100 × 170 cm',
        facts: [
          S.D != null ? `Fractal dimension ${S.D.toFixed(2)} by box-counting; ${(S.coverage * 100).toFixed(0)}% of the canvas covered` : 'Too little paint to measure',
          `${(S.stats.thread / 100).toFixed(1)} m of continuous thread, ${S.stats.drops} drops, ${S.stats.flicks} flung`,
          `${fmtTime(S.stats.pourTime)} of pouring`,
        ],
        review: floorReview(st),
      },
    };
  }

  function listJoin(a) { return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function cap1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  let hinted = false;
  return {
    resize, frame, fresh, hang,
    enter() {
      S.active = true;
      initSound();
      if (!hinted) { hinted = true; shell.hint('Hold to pour. Move fast for straight lines, slowly for loops.<br>Swing and let go to throw.<small>Pick a can to reload · wheel for stick height · wall text for the physics</small>', 7000); }
    },
    leave() { S.active = false; S.pouring = false; },
  };
}

function crickets(ctx) {
  const rate = ctx.sampleRate, secs = 7;
  const buf = ctx.createBuffer(2, rate * secs, rate);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  const bugs = [];
  for (let b = 0; b < 4; b++) bugs.push({ f: 4100 + Math.random() * 900, period: 0.45 + Math.random() * 0.5, pulses: 2 + (Math.random() * 3 | 0), amp: 0.25 + Math.random() * 0.5, pan: Math.random() * 2 - 1, phase: Math.random() });
  for (const bug of bugs) {
    const gl = Math.sqrt(0.5 * (1 - bug.pan)), gr = Math.sqrt(0.5 * (1 + bug.pan));
    for (let t0 = bug.phase * bug.period; t0 < secs - 0.3; t0 += bug.period * (0.9 + Math.random() * 0.2)) {
      if (Math.random() < 0.12) continue;
      for (let p = 0; p < bug.pulses; p++) {
        const st = Math.floor((t0 + p * 0.028) * rate), len = Math.floor(0.016 * rate);
        for (let i = 0; i < len; i++) {
          const env = Math.sin(Math.PI * i / len);
          const s = Math.sin(2 * Math.PI * bug.f * (i / rate)) * env * env * bug.amp * 0.4;
          L[st + i] += s * gl; R[st + i] += s * gr;
        }
      }
    }
  }
  return buf;
}
