// II. STAIN: thinned paint poured onto raw cotton duck and steered by lifting the canvas.
// A shallow-water "virtual pipe" model on the GPU: water flows by height and tilt,
// the canvas drinks it, pigment rides along and is left in the weave. In oil, the
// solvent wicks past the colour and leaves a pale halo, as it did in 1952.

import { createGL, floatFormat, texture, framebuffer, program, use, quad, target, GLSL_NOISE, readToCanvas } from '../gl.js';
import { audio, loopNoise, tick } from '../audio.js';
import { stainTitle, stainReview, year, fmtTime, ARTIST } from '../labels.js';

export const meta = {
  id: 'stain',
  numeral: 'III',
  name: 'Stain',
  after: 'After Helen Frankenthaler and Morris Louis',
  place: 'A studio on West 23rd Street',
  years: '1952–1962',
  swatch: 'linear-gradient(90deg,#d9cfb9 0 10%,#c98a95 10% 32%,#d9cfb9 32% 40%,#6e9cae 40% 63%,#9bb07a 63% 80%,#d9cfb9 80%)',
  lede: 'Thinned paint poured onto raw, unprimed canvas. Lift the edges and the colour runs; the cloth drinks it where it stops. In oil the solvent outruns the pigment and leaves a halo.',
  level: 0.9,
  wet: 0.35,
  freshLabel: 'New canvas',
  wall: `
    <blockquote>A really good picture looks as if it’s happened at once.<cite>Helen Frankenthaler, interviewed in the 1960s</cite></blockquote>
    <p>In October 1952 Helen Frankenthaler, twenty-three, laid a length of unprimed cotton duck on her studio floor and poured oil paint thinned with turpentine straight onto it. The colour soaked into the cloth instead of sitting on top. The picture, <i>Mountains and Sea</i>, looked like a watercolour the size of a wall.</p>
    <p>The next spring Morris Louis and Kenneth Noland drove up from Washington to see it. Louis went home and began pouring acrylic resin paint (Magna) down canvases he held and tilted, letting the colour run in sheets. He called it a bridge between Pollock and what was possible. The results are known as the <i>Veils</i>.</p>
    <h3>The halo</h3>
    <p>Turpentine travels further into raw cotton than pigment does. Around every oil stain there is a pale, slightly yellow ring where only the solvent and oil went. Over decades the oil browns and the unprimed cotton weakens. Frankenthaler moved to water-based acrylics in 1962, which stay where they are put. Switch the medium in the toolbar to see both.</p>
    <h3>The simulation</h3>
    <p>The canvas is a grid of small cells. Each cell holds a little standing liquid, some pigment in suspension, some pigment already caught in the fibres, and a measure of how wet the cloth is. Liquid flows to neighbouring cells downhill, and the tilt of the canvas adds to the hill. Dry cloth drinks fast; wet cloth drinks slowly; slight irregularities in the weave make the edges finger and feather.</p>
    <h3>Controls</h3>
    <dl>
      <dt>Hold</dt><dd>pour from the can</dd>
      <dt>Tilt pad, WASD, arrows</dt><dd>lift an edge of the canvas</dd>
      <dt>Sponge</dt><dd>blot liquid and lift some colour</dd>
      <dt>Thinner</dt><dd>how much turpentine or water is in the paint</dd>
      <dt>Space</dt><dd>lay the canvas flat</dd>
    </dl>
    <p class="src">Sources: E. A. Carmean, Helen Frankenthaler: A Paintings Retrospective (1989); Diane Upright, Morris Louis: The Complete Paintings (1985); the stain model follows Curtis et al., “Computer-Generated Watercolor”, SIGGRAPH 1997, and the virtual-pipe water of Mei, Decaudin and Hu (2007).</p>
  `,
};

const WCM = 270, HCM = 180; // canvas size in cm

const COLORS = [
  { name: 'Rose madder', rgb: [0.86, 0.47, 0.53] },
  { name: 'Cerulean', rgb: [0.36, 0.62, 0.76] },
  { name: 'Sap green', rgb: [0.45, 0.62, 0.32] },
  { name: 'Yellow ochre', rgb: [0.9, 0.7, 0.32] },
  { name: 'Ultramarine', rgb: [0.22, 0.26, 0.66] },
  { name: 'Burnt umber', rgb: [0.47, 0.32, 0.22] },
  { name: 'Magenta', rgb: [0.72, 0.25, 0.52] },
  { name: 'Ivory black', rgb: [0.2, 0.2, 0.22] },
];

const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;

const PAPER_FS = `#version 300 es
precision highp float;
in vec2 vUv; uniform vec2 uRes; uniform float uSeed; out vec4 o;
${GLSL_NOISE}
void main(){
  vec2 c = vUv * uRes + uSeed;
  float bump = vnoise(c * 0.22) * 0.3 + fbm3(c * 0.045) * 0.7;
  float sizing = fbm(c * 0.018) ;
  float absorb = 0.6 + 0.8 * smoothstep(0.2, 0.8, sizing) * (0.85 + 0.15 * vnoise(c * 0.18));
  float thread = vnoise(vec2(c.x * 0.15, c.y * 3.0)) * 0.5 + vnoise(vec2(c.x * 3.0, c.y * 0.15)) * 0.5;
  o = vec4(bump, absorb, thread, 1.0);
}`;

// flux: RGBA = outflow to left, right, up (y-1), down (y+1)
const FLUX_FS = `#version 300 es
precision highp float;
uniform sampler2D uState, uFlux, uPaper;
uniform vec2 uGrav; uniform float uK, uBump, uVisc;
out vec4 o;
float Hn(ivec2 p, ivec2 size, float self, out bool edge){
  edge = p.x < 0 || p.y < 0 || p.x >= size.x || p.y >= size.y;
  if (edge) return self;
  return texelFetch(uState, p, 0).x + uBump * texelFetch(uPaper, p, 0).x;
}
void main(){
  ivec2 ic = ivec2(gl_FragCoord.xy);
  ivec2 size = textureSize(uState, 0);
  vec4 s = texelFetch(uState, ic, 0);
  float h = s.x;
  float H = h + uBump * texelFetch(uPaper, ic, 0).x;
  vec4 f = texelFetch(uFlux, ic, 0);
  bool e0, e1, e2, e3;
  float hl = Hn(ic + ivec2(-1, 0), size, H, e0);
  float hr = Hn(ic + ivec2( 1, 0), size, H, e1);
  float hu = Hn(ic + ivec2( 0,-1), size, H, e2);
  float hd = Hn(ic + ivec2( 0, 1), size, H, e3);
  // thin films are held back by the cloth; viscous paint more so
  float damp = clamp(h / (h + 0.012 * uVisc), 0.0, 0.985);
  f *= damp;
  f.x += uK * ((H - hl) - uGrav.x);
  f.y += uK * ((H - hr) + uGrav.x);
  f.z += uK * ((H - hu) - uGrav.y);
  f.w += uK * ((H - hd) + uGrav.y);
  f = max(f, vec4(0.0));
  float sum = f.x + f.y + f.z + f.w;
  float K = sum > 0.0 ? min(1.0, h / sum) : 0.0;
  o = f * K;
}`;

const UPDATE_FS = `#version 300 es
precision highp float;
uniform sampler2D uState, uFlux, uPig, uDep, uPaper;
uniform vec4 uPour;      // x, y (cells), radius, amount
uniform vec3 uPourAbs;   // absorbance of the colour poured
uniform vec4 uSponge;    // x, y, radius, strength
uniform float uAbsorb, uSatCap, uEvap, uDry, uWick, uSlip, uSettle, uHalo, uDeposit;
layout(location=0) out vec4 oState;
layout(location=1) out vec4 oPig;
layout(location=2) out vec4 oDep;

vec4 F(ivec2 p, ivec2 size){ if (p.x < 0 || p.y < 0 || p.x >= size.x || p.y >= size.y) return vec4(0.0); return texelFetch(uFlux, p, 0); }
vec4 S(ivec2 p, ivec2 size){ p = clamp(p, ivec2(0), size - 1); return texelFetch(uState, p, 0); }
vec3 C(ivec2 p, ivec2 size){
  if (p.x < 0 || p.y < 0 || p.x >= size.x || p.y >= size.y) return vec3(0.0);
  float h = texelFetch(uState, p, 0).x;
  return h > 1e-6 ? texelFetch(uPig, p, 0).rgb / h : vec3(0.0);
}
void main(){
  ivec2 ic = ivec2(gl_FragCoord.xy);
  ivec2 size = textureSize(uState, 0);
  vec4 s = texelFetch(uState, ic, 0);
  vec4 pg = texelFetch(uPig, ic, 0);
  vec4 dp = texelFetch(uDep, ic, 0);
  vec4 pap = texelFetch(uPaper, ic, 0);
  float h = s.x, sat = s.y;
  vec4 f = texelFetch(uFlux, ic, 0);
  float outF = f.x + f.y + f.z + f.w;
  float inL = F(ic + ivec2(-1,0), size).y;
  float inR = F(ic + ivec2( 1,0), size).x;
  float inU = F(ic + ivec2(0,-1), size).w;
  float inD = F(ic + ivec2(0, 1), size).z;
  float inF = inL + inR + inU + inD;
  // pigment moves with the liquid, a little slower than it
  vec3 c = h > 1e-6 ? pg.rgb / h : vec3(0.0);
  vec3 pin = inL * C(ic + ivec2(-1,0), size) + inR * C(ic + ivec2(1,0), size) + inU * C(ic + ivec2(0,-1), size) + inD * C(ic + ivec2(0,1), size);
  vec3 pigNew = pg.rgb + uSlip * (pin - outF * c);
  float hNew = max(0.0, h + inF - outF);
  // the slip leaves some pigment behind; keep it from going negative
  pigNew = max(pigNew, vec3(0.0));

  // pour
  vec2 pc = vec2(ic) + 0.5;
  if (uPour.w > 0.0) {
    float d = length(pc - uPour.xy) / uPour.z;
    float k = exp(-d * d * 2.0);
    float add = uPour.w * k;
    hNew += add;
    pigNew += add * uPourAbs;
  }
  // sponge
  if (uSponge.w > 0.0) {
    float d = length(pc - uSponge.xy) / uSponge.z;
    float k = exp(-d * d * 2.0) * uSponge.w;
    hNew *= 1.0 - k; pigNew *= 1.0 - k;
    dp.rgb *= 1.0 - 0.03 * k;
    sat *= 1.0 - 0.15 * k;
  }

  // the cloth drinks
  float thirst = uAbsorb * pap.y * (1.0 - sat) * (1.0 - sat);
  float a = min(hNew, thirst);
  float frac = hNew > 1e-7 ? a / hNew : 0.0;
  vec3 caught = pigNew * frac * uDeposit;
  dp.rgb += caught; pigNew -= caught;
  hNew -= a;
  sat = min(1.0, sat + a / uSatCap);

  // a little pigment settles out of standing liquid into the weave
  vec3 settle = pigNew * uSettle * (0.6 + 0.8 * pap.z);
  dp.rgb += settle; pigNew -= settle;

  // evaporation; when it is gone, everything left is laid down (and edges darken)
  hNew = max(0.0, hNew - uEvap);
  if (hNew < 2e-5) { dp.rgb += pigNew * 1.15; pigNew = vec3(0.0); hNew = 0.0; }

  // capillary wicking of the solvent through dry fibres
  float sl = S(ic + ivec2(-1,0), size).y, sr = S(ic + ivec2(1,0), size).y, su = S(ic + ivec2(0,-1), size).y, sd = S(ic + ivec2(0,1), size).y;
  float avg = (sl + sr + su + sd) * 0.25;
  sat += uWick * (avg - sat) * (0.6 + 0.8 * pap.y);
  // the ring the oil leaves where solvent went and colour did not
  dp.a = max(dp.a, uHalo * smoothstep(0.03, 0.5, sat));
  sat = max(0.0, sat - uDry);

  oState = vec4(hNew, sat, 0.0, 1.0);
  oPig = vec4(pigNew, 1.0);
  oDep = dp;
}`;

const RENDER_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uState, uPig, uDep, uPaper;
uniform vec2 uRes, uCm, uLight;
uniform float uTime, uMedium, uGrain;
out vec4 o;
${GLSL_NOISE}
vec4 samp(sampler2D t, vec2 uv){
  vec2 p = uv * uRes - 0.5;
  vec2 i = floor(p), f = fract(p);
  ivec2 a = ivec2(i);
  ivec2 mx = ivec2(uRes) - 1;
  vec4 s00 = texelFetch(t, clamp(a, ivec2(0), mx), 0);
  vec4 s10 = texelFetch(t, clamp(a + ivec2(1,0), ivec2(0), mx), 0);
  vec4 s01 = texelFetch(t, clamp(a + ivec2(0,1), ivec2(0), mx), 0);
  vec4 s11 = texelFetch(t, clamp(a + ivec2(1,1), ivec2(0), mx), 0);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y);
}
void main(){
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 w = uv * uCm;
  // raw duck
  float warp = vnoise(vec2(w.x * 30.0, w.y * 0.8));
  float weft = vnoise(vec2(w.x * 0.8, w.y * 30.0));
  float fine = sin(w.x * 6.2831 * 9.0) * sin(w.y * 6.2831 * 9.0);
  float slub = smoothstep(0.75, 0.95, vnoise(vec2(w.x * 0.3, w.y * 7.0))) * 0.5 + smoothstep(0.78, 0.97, vnoise(vec2(w.x * 7.0, w.y * 0.3))) * 0.5;
  vec3 base = vec3(0.88, 0.85, 0.77);
  float tex = 0.04 * warp + 0.04 * weft + 0.02 * fine + 0.035 * slub;
  base *= 0.94 + tex;
  base = mix(base, base * vec3(0.98, 0.96, 0.92), fbm3(w * 0.02));

  vec4 st = samp(uState, uv);
  vec4 pg = samp(uPig, uv);
  vec4 dp = samp(uDep, uv);
  // pigment lodges in the valleys of the weave
  float valley = 0.8 + 0.45 * (1.0 - (warp + weft) * 0.5) + 0.15 * fine;
  vec3 A = dp.rgb * valley + pg.rgb * 0.9;
  vec3 col = base * exp(-A);
  // the oil halo: pale yellow-brown where the solvent went alone
  float halo = clamp(dp.a, 0.0, 1.0);
  col *= mix(vec3(1.0), vec3(0.93, 0.88, 0.76), halo);
  // wet cloth is darker
  float sat = st.y;
  col *= 1.0 - 0.16 * smoothstep(0.0, 0.6, sat);
  // standing liquid: a meniscus sheen
  float h = st.x;
  vec2 e = 1.6 / uRes;
  float hx = samp(uState, uv + vec2(e.x, 0.0)).x - samp(uState, uv - vec2(e.x, 0.0)).x;
  float hy = samp(uState, uv + vec2(0.0, e.y)).x - samp(uState, uv - vec2(0.0, e.y)).x;
  vec3 n = normalize(vec3(-hx * 6.0, -hy * 6.0, 1.0));
  vec3 L = normalize(vec3(uLight, 0.8));
  vec3 Hh = normalize(L + vec3(0.0, 0.0, 1.0));
  float wetMask = smoothstep(0.0005, 0.02, h);
  float spec = pow(max(dot(n, Hh), 0.0), 40.0) * wetMask * 0.55;
  col = col * (1.0 - 0.1 * wetMask) + spec * vec3(1.0, 0.98, 0.94);
  col *= 1.0 + 0.25 * (dot(n, L) - L.z) * wetMask;
  // light falloff and grain
  float vig = length((uv - 0.5) * vec2(1.0, 0.8));
  col *= 1.04 - 0.22 * vig * vig;
  col += (hash12(gl_FragCoord.xy + fract(uTime) * 71.0) - 0.5) * uGrain;
  o = vec4(col, 1.0);
}`;

export function create(shell) {
  // the canvas sits in a perspective frame so it can visibly tilt
  const frame = document.createElement('div');
  frame.style.cssText = 'position:absolute;inset:0;perspective:1600px;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 45%, #3a3430 0%, #1a1715 60%, #0d0b0a 100%)';
  shell.root.insertBefore(frame, shell.chrome);
  const floorTex = document.createElement('div');
  floorTex.style.cssText = 'position:absolute;inset:0;opacity:.35;background:repeating-linear-gradient(90deg, rgba(0,0,0,.25) 0 2px, transparent 2px 140px), repeating-linear-gradient(0deg, rgba(255,255,255,.02) 0 1px, transparent 1px 7px)';
  frame.appendChild(floorTex);
  const cv = document.createElement('canvas');
  cv.className = 'stain-cv';
  cv.style.cssText = 'position:relative;display:block;box-shadow:0 30px 70px rgba(0,0,0,.55), 0 4px 10px rgba(0,0,0,.4);transform-origin:50% 50%;touch-action:none;cursor:crosshair';
  frame.appendChild(cv);
  const ring = document.createElement('div');
  ring.style.cssText = 'position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border:1px solid rgba(255,255,255,.7);border-radius:50%;pointer-events:none;mix-blend-mode:difference;opacity:0;transition:opacity .3s';
  shell.root.insertBefore(ring, shell.chrome);

  const gl = createGL(cv);
  const ff = floatFormat(gl, 4, true);
  if (!ff) throw new Error('No renderable float textures.');
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const GW = small ? 420 : 600, GH = Math.round(GW * HCM / WCM);
  const cellCm = WCM / GW;
  const spec = { internal: ff.internal, format: ff.format, type: ff.type, filter: gl.NEAREST };

  const paper = texture(gl, GW, GH, { filter: gl.NEAREST });
  const fbPaper = framebuffer(gl, paper);
  const flux = [framebuffer(gl, texture(gl, GW, GH, spec)), framebuffer(gl, texture(gl, GW, GH, spec))];
  const sim = [0, 1].map(() => framebuffer(gl, [texture(gl, GW, GH, spec), texture(gl, GW, GH, spec), texture(gl, GW, GH, spec)]));
  let fi = 0, si = 0;

  const pPaper = program(gl, QUAD_VS, PAPER_FS);
  const pFlux = program(gl, QUAD_VS, FLUX_FS);
  const pUpd = program(gl, QUAD_VS, UPDATE_FS);
  const pRender = program(gl, QUAD_VS, RENDER_FS);
  const Q = quad(gl);

  function clearAll() {
    for (const fb of [...flux, ...sim]) { target(gl, fb); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    target(gl, fbPaper);
    use(gl, pPaper, { uRes: [GW, GH], uSeed: Math.random() * 500 });
    Q.draw();
  }
  clearAll();

  const S = {
    tilt: [0, 0], tiltTarget: [0, 0], keys: new Set(),
    pouring: false, pos: [GW / 2, GH / 2], color: 0, thin: 0.55, tool: 'pour', medium: 'oil',
    wetness: 0, w: 1, h: 1, dpr: 1, active: false, time: 0,
    stats: null,
  };
  const freshStats = () => ({ poured: 0, tiltMax: 0, time: 0, colors: {}, veil: 0, pourTime: 0 });
  S.stats = freshStats();

  function mediumParams() {
    return S.medium === 'oil'
      ? { absorb: 0.0010, satCap: 0.22, wick: 0.045, halo: 0.55, deposit: 0.55, slip: 0.88, visc: 1.0, dry: 0.00002 }
      : { absorb: 0.0008, satCap: 0.28, wick: 0.006, halo: 0.0, deposit: 0.8, slip: 0.97, visc: 0.7, dry: 0.00004 };
  }

  function stepSim(n) {
    const mp = mediumParams();
    const g = 0.55; // gravity along the plane at full tilt, in cell-height units
    const grav = [Math.sin(S.tilt[0]) * g, Math.sin(S.tilt[1]) * g];
    const c = COLORS[S.color];
    const strength = 3.4 * (1.2 - S.thin * 0.85);
    const absorb = c.rgb.map((v) => -Math.log(Math.max(0.03, v)) * strength);
    const pourAmt = S.pouring && S.tool === 'pour' ? 0.085 * (0.6 + S.thin) : 0;
    const sponge = S.pouring && S.tool === 'sponge' ? 0.12 : 0;
    for (let i = 0; i < n; i++) {
      // flux
      const fr = flux[fi], fw = flux[1 - fi];
      const sr = sim[si], sw = sim[1 - si];
      target(gl, fw);
      use(gl, pFlux, { uState: sr.tex[0], uFlux: fr.tex[0], uPaper: paper, uGrav: grav, uK: 0.22, uBump: 0.06, uVisc: mp.visc * (1.2 - S.thin * 0.6) });
      Q.draw();
      fi = 1 - fi;
      // update
      target(gl, sw);
      use(gl, pUpd, {
        uState: sr.tex[0], uPig: sr.tex[1], uDep: sr.tex[2], uFlux: fw.tex[0], uPaper: paper,
        uPour: [S.pos[0], S.pos[1], 4.0 / cellCm, pourAmt],
        uPourAbs: absorb,
        uSponge: [S.pos[0], S.pos[1], 7 / cellCm, sponge],
        uAbsorb: mp.absorb, uSatCap: mp.satCap, uEvap: 0.0000045, uDry: mp.dry, uWick: mp.wick,
        uSlip: mp.slip, uSettle: 0.0009, uHalo: mp.halo, uDeposit: mp.deposit,
      });
      Q.draw();
      si = 1 - si;
    }
    if (pourAmt) {
      S.stats.poured += pourAmt * n; S.stats.pourTime += n / 360;
      S.stats.colors[c.name] = (S.stats.colors[c.name] || 0) + pourAmt * n;
      S.wetness = Math.min(1, S.wetness + pourAmt * n * 0.05);
      if (S.pos[1] < GH * 0.2 && Math.hypot(...S.tilt) > 0.15) S.stats.veil += pourAmt * n;
    }
  }

  function render(fb, w, h, grain) {
    target(gl, fb);
    const sr = sim[si];
    use(gl, pRender, {
      uState: sr.tex[0], uPig: sr.tex[1], uDep: sr.tex[2], uPaper: paper,
      uRes: [GW, GH], uCm: [WCM, HCM], uLight: [-0.5 - S.tilt[0] * 2, -0.6 - S.tilt[1] * 2], uTime: S.time, uMedium: S.medium === 'oil' ? 1 : 0, uGrain: grain,
    });
    Q.draw();
  }

  /* ---------- UI ---------- */
  shell.toolbar.innerHTML = `
    <div class="grp" role="group" aria-label="Colour">
      ${COLORS.map((c, i) => `<button class="can" type="button" data-col="${i}" title="${c.name}" aria-label="${c.name}" aria-pressed="${i === 0}" style="background:rgb(${c.rgb.map((v) => Math.round(v * 255)).join(',')})"></button>`).join('')}
    </div>
    <div class="grp" role="group" aria-label="Tool">
      <button class="seg" type="button" data-tool="pour" aria-pressed="true">Pour</button>
      <button class="seg" type="button" data-tool="sponge" aria-pressed="false">Sponge</button>
    </div>
    <div class="grp" role="group" aria-label="Medium">
      <button class="seg" type="button" data-med="oil" aria-pressed="true" title="Oil thinned with turpentine (1952)">Oil</button>
      <button class="seg" type="button" data-med="acrylic" aria-pressed="false" title="Acrylic thinned with water (after 1962)">Acrylic</button>
    </div>
    <div class="grp"><label class="lbl" for="stain-thin">Thinner</label><input id="stain-thin" type="range" min="0" max="100" value="55"></div>
    <div class="grp"><span class="lbl">Tilt</span>
      <div id="stain-pad" style="width:46px;height:46px;border-radius:50%;border:1px solid rgba(236,230,218,.4);position:relative;touch-action:none;cursor:grab" title="Drag to lift the opposite edge. Paint runs toward the dot.">
        <div style="position:absolute;left:50%;top:50%;width:1px;height:100%;background:rgba(236,230,218,.15);transform:translate(-50%,-50%)"></div>
        <div style="position:absolute;left:50%;top:50%;height:1px;width:100%;background:rgba(236,230,218,.15);transform:translate(-50%,-50%)"></div>
        <div id="stain-dot" style="position:absolute;width:12px;height:12px;border-radius:50%;background:#e0523a;left:50%;top:50%;transform:translate(-50%,-50%)"></div>
      </div>
      <output id="stain-deg">flat</output>
    </div>`;
  shell.readout.innerHTML = `<div><b id="stain-ml">0</b> ml poured · tilt <b id="stain-t">0°</b></div><div id="stain-med">oil and turpentine on raw duck</div>`;
  const $ = (s) => shell.root.querySelector(s);
  shell.toolbar.addEventListener('click', (e) => {
    const c = e.target.closest('[data-col]');
    if (c) { S.color = +c.dataset.col; shell.toolbar.querySelectorAll('[data-col]').forEach((b) => b.setAttribute('aria-pressed', String(b === c))); setTool('pour'); }
    const t = e.target.closest('[data-tool]'); if (t) setTool(t.dataset.tool);
    const m = e.target.closest('[data-med]');
    if (m) {
      S.medium = m.dataset.med;
      shell.toolbar.querySelectorAll('[data-med]').forEach((b) => b.setAttribute('aria-pressed', String(b === m)));
      $('#stain-med').textContent = S.medium === 'oil' ? 'oil and turpentine on raw duck' : 'acrylic and water on raw duck';
    }
  });
  function setTool(t) { S.tool = t; shell.toolbar.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t))); ring.style.width = ring.style.height = t === 'sponge' ? '64px' : '30px'; ring.style.margin = t === 'sponge' ? '-32px 0 0 -32px' : '-15px 0 0 -15px'; }
  $('#stain-thin').addEventListener('input', (e) => { S.thin = +e.target.value / 100; });

  const pad = $('#stain-pad'), dot = $('#stain-dot');
  const MAXT = 0.42; // ~24 degrees
  function padSet(e) {
    const r = pad.getBoundingClientRect();
    let x = (e.clientX - r.left) / r.width * 2 - 1, y = (e.clientY - r.top) / r.height * 2 - 1;
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    S.tiltTarget = [x * MAXT, y * MAXT];
  }
  let padDrag = false;
  pad.addEventListener('pointerdown', (e) => { padDrag = true; pad.setPointerCapture(e.pointerId); padSet(e); });
  pad.addEventListener('pointermove', (e) => { if (padDrag) padSet(e); });
  pad.addEventListener('pointerup', () => { padDrag = false; });
  pad.addEventListener('dblclick', () => { S.tiltTarget = [0, 0]; });

  // pointer on the tilted canvas: invert the CSS perspective
  let persp = 1600;
  function rotation() {
    const b = S.tilt[0] * 0.5, a = -S.tilt[1] * 0.5; // visual tilt, half the physical
    return { a, b };
  }
  function toCell(e) {
    const fr = frame.getBoundingClientRect();
    const cx = fr.left + fr.width / 2, cy = fr.top + fr.height / 2;
    const sx = e.clientX - cx, sy = e.clientY - cy;
    const { a, b } = rotation();
    // R = Rx(a) * Ry(b)
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    const R = [
      [cb, 0, sb],
      [sa * sb, ca, -sa * cb],
      [-ca * sb, sa, ca * cb],
    ];
    const n = [R[0][2], R[1][2], R[2][2]];
    const C = [0, 0, persp];
    const D = [sx - C[0], sy - C[1], 0 - C[2]];
    const t = -(n[0] * C[0] + n[1] * C[1] + n[2] * C[2]) / (n[0] * D[0] + n[1] * D[1] + n[2] * D[2]);
    const P = [C[0] + t * D[0], C[1] + t * D[1], C[2] + t * D[2]];
    const lx = R[0][0] * P[0] + R[1][0] * P[1] + R[2][0] * P[2];
    const ly = R[0][1] * P[0] + R[1][1] * P[1] + R[2][1] * P[2];
    return [(lx / S.cssW + 0.5) * GW, (ly / S.cssH + 0.5) * GH];
  }
  let ptr = null;
  cv.addEventListener('pointerdown', (e) => {
    ptr = e.pointerId; try { cv.setPointerCapture(ptr); } catch {}
    S.pos = toCell(e); S.pouring = true; shell.hideHint(); shell.setIdle(true); initSound();
  });
  cv.addEventListener('pointermove', (e) => {
    S.pos = toCell(e);
    ring.style.left = e.clientX - shell.root.getBoundingClientRect().left + 'px';
    ring.style.top = e.clientY - shell.root.getBoundingClientRect().top + 'px';
    ring.style.opacity = 1;
  });
  cv.addEventListener('pointerleave', () => { ring.style.opacity = 0; });
  const up = (e) => { if (e.pointerId === ptr) { ptr = null; S.pouring = false; shell.setIdle(false); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

  const onKey = (e, down) => {
    if (!S.active) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { down ? S.keys.add(k) : S.keys.delete(k); e.preventDefault(); }
    if (down && k === ' ') { S.tiltTarget = [0, 0]; e.preventDefault(); }
  };
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));

  /* ---------- sound ---------- */
  let snd = null;
  function initSound() {
    const A = audio(); if (!A || snd || !shell.bus) return;
    const ctx = A.ctx, out = shell.bus.input;
    // a trickle: band-limited noise with slow random wobble
    const n = loopNoise(ctx, 'pink');
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 900; f1.Q.value = 2.5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 2400; f2.gain.value = 6; f2.Q.value = 3;
    const g = ctx.createGain(); g.gain.value = 0;
    n.connect(f1).connect(f2).connect(g).connect(out);
    // the city through a closed window
    const city = loopNoise(ctx, 'brown');
    const cf = ctx.createBiquadFilter(); cf.type = 'lowpass'; cf.frequency.value = 160;
    const cg = ctx.createGain(); cg.gain.value = 0.13;
    city.connect(cf).connect(cg).connect(out);
    snd = { ctx, out, f1, f2, g, nextBloop: 0 };
  }
  function updateSound(dt) {
    if (!snd) return;
    const t = snd.ctx.currentTime;
    const tiltMag = Math.hypot(...S.tilt) / MAXT;
    const flow = (S.pouring && S.tool === 'pour' ? 0.6 : 0) + S.wetness * tiltMag * 0.9;
    snd.g.gain.setTargetAtTime(Math.min(0.32, flow * 0.3), t, 0.15);
    snd.f1.frequency.setTargetAtTime(600 + 900 * Math.random() + tiltMag * 500, t, 0.08);
    snd.f2.frequency.setTargetAtTime(1600 + 2400 * Math.random(), t, 0.05);
    if (flow > 0.15 && t > snd.nextBloop) {
      snd.nextBloop = t + 0.05 + Math.random() * 0.25 / flow;
      tick(snd.out, { freq: 500 + Math.random() * 1400, q: 18, gain: 0.05 + flow * 0.06, dur: 0.05 + Math.random() * 0.06, pan: (Math.random() - 0.5) * 0.8 });
    }
  }

  /* ---------- lifecycle ---------- */
  function resize(w, h, dpr) {
    dpr = Math.min(dpr, 1.5);
    S.dpr = dpr;
    const maxW = Math.min(w - 32, w * 0.84), maxH = h - 250;
    let cw = maxW, ch = cw * HCM / WCM;
    if (ch > maxH) { ch = Math.max(160, maxH); cw = ch * WCM / HCM; }
    S.cssW = cw; S.cssH = ch;
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    persp = Math.max(1200, cw * 1.6);
    frame.style.perspective = persp + 'px';
  }

  function frame_(dt) {
    S.time += dt;
    S.stats.time += dt;
    // keys nudge the tilt target
    const kx = (S.keys.has('d') || S.keys.has('arrowright') ? 1 : 0) - (S.keys.has('a') || S.keys.has('arrowleft') ? 1 : 0);
    const ky = (S.keys.has('s') || S.keys.has('arrowdown') ? 1 : 0) - (S.keys.has('w') || S.keys.has('arrowup') ? 1 : 0);
    if (kx || ky) {
      S.tiltTarget[0] = Math.max(-MAXT, Math.min(MAXT, S.tiltTarget[0] + kx * dt * 0.6));
      S.tiltTarget[1] = Math.max(-MAXT, Math.min(MAXT, S.tiltTarget[1] + ky * dt * 0.6));
    }
    // the canvas has weight: tilt eases toward the target
    S.tilt[0] += (S.tiltTarget[0] - S.tilt[0]) * Math.min(1, dt * 3);
    S.tilt[1] += (S.tiltTarget[1] - S.tilt[1]) * Math.min(1, dt * 3);
    const deg = Math.hypot(...S.tilt) * 57.3;
    S.stats.tiltMax = Math.max(S.stats.tiltMax, deg);
    const { a, b } = rotation();
    cv.style.transform = `rotateX(${a}rad) rotateY(${b}rad)`;
    dot.style.left = (50 + S.tiltTarget[0] / MAXT * 50) + '%';
    dot.style.top = (50 + S.tiltTarget[1] / MAXT * 50) + '%';
    $('#stain-deg').textContent = deg < 0.5 ? 'flat' : Math.round(deg) + '°';
    $('#stain-t').textContent = Math.round(deg) + '°';
    $('#stain-ml').textContent = Math.round(S.stats.poured * cellCm * cellCm * 60);
    S.wetness *= Math.pow(0.97, dt);

    stepSim(6);
    render(null, cv.width, cv.height, 0.02);
    updateSound(dt);
  }

  function fresh() { clearAll(); S.stats = freshStats(); S.tiltTarget = [0, 0]; S.wetness = 0; shell.toast('Fresh duck, unprimed.'); }

  async function hang(n) {
    const OW = 1350, OH = Math.round(OW * HCM / WCM);
    const t = texture(gl, OW, OH, {});
    const fb = framebuffer(gl, t);
    render(fb, OW, OH, 0);
    const c2 = readToCanvas(gl, fb, OW, OH);
    gl.deleteFramebuffer(fb); gl.deleteTexture(t);
    const used = Object.entries(S.stats.colors).sort((a, b) => b[1] - a[1]).map(([k]) => k.toLowerCase());
    const st = { medium: S.medium, tiltMax: S.stats.tiltMax, veil: S.stats.veil > S.stats.poured * 0.5 && S.stats.poured > 0 };
    return {
      image: c2.toDataURL('image/jpeg', 0.9),
      label: {
        ...ARTIST,
        title: stainTitle(n, st),
        year: year(),
        medium: S.medium === 'oil' ? `Oil${used.length ? ' (' + used.slice(0, 4).join(', ') + ')' : ''} thinned with turpentine on unprimed cotton duck` : `Acrylic${used.length ? ' (' + used.slice(0, 4).join(', ') + ')' : ''} thinned with water on unprimed cotton duck`,
        dims: `${HCM} × ${WCM} cm`,
        facts: [
          `About ${Math.round(S.stats.poured * cellCm * cellCm * 60)} ml poured over ${fmtTime(S.stats.pourTime)}`,
          `Lifted to ${Math.round(S.stats.tiltMax)}° at most`,
        ],
        review: stainReview(st),
      },
    };
  }

  let hinted = false;
  return {
    resize, frame: frame_, fresh, hang,
    enter() { S.active = true; initSound(); if (!hinted) { hinted = true; shell.hint('Hold to pour. Use the tilt pad, or WASD, to lift an edge.<small>Oil leaves a halo · acrylic does not · Space lays it flat</small>', 7000); } },
    leave() { S.active = false; S.pouring = false; S.keys.clear(); },
  };
}
