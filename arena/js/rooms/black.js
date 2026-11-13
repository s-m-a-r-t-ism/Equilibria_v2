// V. BLACK: a five-foot square of nine near-black squares.
// Nothing is visible at first. Hold still and your eyes adjust: the cross comes up out
// of the dark, the reds sink and the blues rise. Move, and it is gone again.

import { createGL, program, use, quad, target, GLSL_NOISE, readToCanvas, texture, framebuffer } from '../gl.js';
import { audio } from '../audio.js';
import { year, fmtTime, ARTIST } from '../labels.js';

const RULES = [
  'No texture.', 'No brushwork or calligraphy.', 'No sketching or drawing.', 'No forms.', 'No design.', 'No colors.',
  'No light.', 'No space.', 'No time.', 'No size or scale.', 'No movement.', 'No object, no subject, no matter.',
];

export const meta = {
  id: 'black',
  numeral: 'VI',
  name: 'Black',
  after: 'After Ad Reinhardt',
  place: 'A dark room',
  years: '1960–1967',
  swatch: 'linear-gradient(90deg,#141217 0 33%,#16110f 33% 66%,#101413 66%)',
  lede: 'A square of nine squares, all nearly black. At first there is nothing. Hold completely still and your eyes adjust until a cross appears. Move and you lose it.',
  level: 0.5,
  wet: 0.6,
  noIdleChrome: true,
  freshLabel: 'Look again',
  wall: `
    <blockquote>A square (neutral, shapeless) canvas, five feet wide, five feet high, as high as a man, as wide as a man’s outstretched arms (not large, not small, sizeless), trisected (no composition), one horizontal form negating one vertical form (formless, no top, no bottom, directionless)…<cite>Ad Reinhardt, describing the black paintings, 1961</cite></blockquote>
    <p>From 1960 until his death in 1967 Ad Reinhardt made one painting, over and over: a five-foot square divided into a three-by-three grid, every square a black mixed from different colours. A cross shows faintly where the middle row and middle column meet. The paint was drained of its oil so that it dried completely matte, with no gloss to catch the light.</p>
    <p>In a museum most visitors walk past them in seconds and see a black square. Stand still in front of one for a minute or two and the eye adjusts. The cross appears. The blacks separate into a reddish black, a bluish black and a greenish black.</p>
    <h3>Twelve rules</h3>
    <p>In 1957 Reinhardt published “Twelve Rules for a New Academy”. Among them: no texture, no brushwork, no drawing, no forms, no design, no colours, no light, no space, no time, no size, no movement, no object. In this room the eleventh is enforced. Every time you move, the next rule appears and your eyes start again.</p>
    <h3>What the room does</h3>
    <p>It imitates dark adaptation. As you stay still the contrast of the picture slowly rises and its colours shift the way vision shifts in low light: reds fade, blues and greens hold on longer. That shift is named after Jan Evangelista Purkyně, who noticed red flowers turning dark before their leaves at dusk. In very low light vision is also grainy; the grain here is not a fault.</p>
    <p>There is no sound. After a while you may hear the two that John Cage said he heard in an anechoic chamber at Harvard in 1951: one high, one low.</p>
    <h3>Controls</h3>
    <dl><dt>Nothing</dt><dd>keep still</dd><dt>H</dt><dd>hang what you see, without moving</dd></dl>
    <p class="src">Sources: Reinhardt, “Twelve Rules for a New Academy”, ARTnews (May 1957); Barbara Rose (ed.), Art as Art: The Selected Writings of Ad Reinhardt (1975); Cage, Silence (1961).</p>
  `,
};

const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;

const FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec2 uScreen; uniform vec4 uRect;
uniform float uAdapt, uTime, uFrameOnly, uSeed;
out vec4 o;
${GLSL_NOISE}
void main(){
  vec2 sp = vec2(gl_FragCoord.x, uScreen.y - gl_FragCoord.y);
  vec2 p = (sp - uRect.xy) / (uRect.zw - uRect.xy);
  bool inside = all(greaterThanEqual(p, vec2(0.0))) && all(lessThanEqual(p, vec2(1.0)));
  if (uFrameOnly > 0.5) { inside = true; p = clamp(p, 0.0, 1.0); }
  // linear radiance, very low
  vec3 c = vec3(0.0034, 0.0033, 0.0032); // the wall
  if (inside) {
    ivec2 cell = ivec2(clamp(floor(p * 3.0), 0.0, 2.0));
    bool midRow = cell.y == 1, midCol = cell.x == 1;
    vec3 corner = vec3(0.0044, 0.0042, 0.0050);   // bluish black
    vec3 rowArm = vec3(0.0042, 0.0048, 0.0044);   // greenish black
    vec3 colArm = vec3(0.0053, 0.0041, 0.0039);   // reddish black
    vec3 centre = vec3(0.0049, 0.0044, 0.0043);
    c = corner;
    if (midRow) c = rowArm;
    if (midCol) c = colArm;
    if (midRow && midCol) c = centre;
    // the edges between squares are soft, the hand is barely there
    vec2 f = fract(p * 3.0);
    float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
    c *= 1.0 - 0.025 * smoothstep(0.02, 0.0, edge);
    c *= 1.0 + 0.012 * (fbm(p * 7.0 + uSeed) - 0.5);
  }
  // shadow of the canvas on the wall
  if (!inside) {
    vec2 q = p - vec2(0.01, 0.015);
    float out_ = max(max(-q.x, q.x - 1.0), max(-q.y, q.y - 1.0));
    c *= 1.0 - 0.12 * smoothstep(0.04, 0.0, out_);
  }
  // dark adaptation: gain rises, and the Purkinje shift moves sensitivity toward blue-green
  float a = uAdapt;
  vec3 purk = mix(vec3(1.0), vec3(0.72, 1.08, 1.25), a);
  float gain = mix(1.0, 16.0, a * a * (3.0 - 2.0 * a));
  vec3 seen = c * purk * gain;
  // contrast stretch around the mean level of the painting
  float mean = 0.0044 * gain;
  seen = mean + (seen - vec3(mean)) * mix(1.0, 3.6, a);
  // eigengrau: the eye's own grain, rising in the dark
  float g = (hash12(sp * 0.5 + floor(uTime * 24.0) * 13.7) - 0.5);
  float g2 = (vnoise(sp * 0.08 + uTime * 0.7) - 0.5);
  seen += (g * 0.008 + g2 * 0.005) * a * (1.0 - uFrameOnly);
  // phosphenes: slow faint clouds once deeply adapted
  float ph = smoothstep(0.62, 0.9, fbm(sp / uScreen.y * 2.2 + vec2(uTime * 0.03, -uTime * 0.021)));
  seen += vec3(0.010, 0.009, 0.013) * ph * smoothstep(0.7, 1.0, a) * (1.0 - uFrameOnly);
  vec3 outc = pow(max(seen, 0.0), vec3(1.0 / 2.2));
  o = vec4(outc, 1.0);
}`;

export function create(shell) {
  const cv = shell.canvas();
  const gl = createGL(cv);
  const prog = program(gl, QUAD_VS, FS);
  const Q = quad(gl);

  const rule = document.createElement('div');
  rule.style.cssText = 'position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 34px);transform:translateX(-50%);font-family:var(--serif);font-style:italic;font-size:19px;color:#8a8580;opacity:0;transition:opacity 1.2s;pointer-events:none;white-space:nowrap;text-align:center';
  shell.root.insertBefore(rule, shell.chrome);
  shell.toolbar.remove();
  shell.readout.remove();

  const S = { w: 1, h: 1, dpr: 1, rect: [0, 0, 1, 1], adapt: 0, still: 0, best: 0, ruleIdx: 10, time: 0, active: false, last: [0, 0], seed: Math.random() * 10, moves: 0 };

  function moved() {
    if (S.still > 3) S.snap = { still: S.still, adapt: S.adapt, at: performance.now() };
    if (S.still > 3) {
      S.ruleIdx = (S.ruleIdx + 1) % RULES.length;
      rule.textContent = `${S.ruleIdx + 1}. ${RULES[S.ruleIdx]}`;
      rule.style.opacity = 1;
      clearTimeout(rule._t); rule._t = setTimeout(() => (rule.style.opacity = 0), 2600);
      S.moves++;
    }
    S.still = 0;
    shell.setIdle(false);
    clearTimeout(S.idleT);
    S.idleT = setTimeout(() => shell.setIdle(true), 2200);
  }
  const onMove = (e) => {
    if (!S.active) return;
    const d = Math.hypot(e.clientX - S.last[0], e.clientY - S.last[1]);
    S.last = [e.clientX, e.clientY];
    if (d > 2) moved();
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', () => S.active && moved(), { passive: true });
  window.addEventListener('keydown', () => S.active && moved());
  window.addEventListener('wheel', () => S.active && moved(), { passive: true });

  /* ---------- sound: almost nothing ---------- */
  let snd = null;
  function initSound() {
    const A = audio(); if (!A || snd || !shell.bus) return;
    const ctx = A.ctx, out = shell.bus.input;
    // the high one: your nervous system, according to the engineer Cage asked
    const hi = ctx.createOscillator(); hi.frequency.value = 6280;
    const hi2 = ctx.createOscillator(); hi2.frequency.value = 6293;
    const hg = ctx.createGain(); hg.gain.value = 0;
    hi.connect(hg); hi2.connect(hg); hg.connect(out);
    // the low one: your blood
    const lo = ctx.createOscillator(); lo.frequency.value = 42;
    const lg = ctx.createGain(); lg.gain.value = 0;
    const pulse = ctx.createGain(); pulse.gain.value = 0;
    lo.connect(lg).connect(pulse).connect(out);
    hi.start(); hi2.start(); lo.start();
    snd = { ctx, hg, lg, pulse, nextBeat: 0 };
  }
  function updateSound() {
    if (!snd) return;
    const t = snd.ctx.currentTime;
    const a = Math.max(0, (S.adapt - 0.55) / 0.45);
    snd.hg.gain.setTargetAtTime(0.0035 * a, t, 1.5);
    snd.lg.gain.setTargetAtTime(0.5 * a, t, 1.5);
    if (t > snd.nextBeat) {
      // a heartbeat, about 58 a minute: lub, then dub
      const b = snd.nextBeat = t + 60 / 58;
      snd.pulse.gain.cancelScheduledValues(t);
      snd.pulse.gain.setValueAtTime(0, t);
      snd.pulse.gain.linearRampToValueAtTime(0.09, t + 0.03);
      snd.pulse.gain.exponentialRampToValueAtTime(0.002, t + 0.16);
      snd.pulse.gain.linearRampToValueAtTime(0.06, t + 0.25);
      snd.pulse.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    }
  }

  function resize(w, h, dpr) {
    dpr = Math.min(dpr, 1.25);
    S.dpr = dpr; S.w = Math.round(w * dpr); S.h = Math.round(h * dpr); cv.width = S.w; cv.height = S.h;
    const side = Math.min(w * 0.82, h * 0.66);
    const x0 = (w - side) / 2, y0 = (h - side) / 2 - h * 0.02;
    S.rect = [x0, y0, x0 + side, y0 + side].map((v) => v * dpr);
  }
  function frame(dt) {
    S.time += dt;
    S.still += dt;
    S.best = Math.max(S.best, S.still);
    // adaptation: slow to come, quick to go
    const lin_ = Math.min(1, Math.max(0, (S.still - 4) / 80));
    const target_ = lin_ * lin_ * (3 - 2 * lin_);
    const rate = target_ > S.adapt ? 0.9 : 2.8;
    S.adapt += (target_ - S.adapt) * Math.min(1, dt * rate);
    target(gl, null);
    use(gl, prog, { uScreen: [S.w, S.h], uRect: S.rect, uAdapt: S.adapt, uTime: S.time, uFrameOnly: 0, uSeed: S.seed });
    Q.draw();
    updateSound();
  }
  function fresh() { S.still = 0; S.adapt = 0; }

  async function hang(n) {
    const OW = 900;
    const t = texture(gl, OW, OW, {});
    const fb = framebuffer(gl, t);
    const snap = S.snap && performance.now() - S.snap.at < 12000 && S.snap.adapt > S.adapt ? S.snap : { still: S.still, adapt: S.adapt };
    const a = snap.adapt;
    target(gl, fb);
    use(gl, prog, { uScreen: [OW, OW], uRect: [0, 0, OW, OW], uAdapt: a, uTime: S.time, uFrameOnly: 1, uSeed: S.seed });
    Q.draw();
    const c2 = readToCanvas(gl, fb, OW, OW);
    gl.deleteFramebuffer(fb); gl.deleteTexture(t);
    return {
      image: c2.toDataURL('image/jpeg', 0.95),
      label: {
        ...ARTIST,
        title: `Abstract Painting ${n > 1 ? 'No. ' + n : ''}`.trim(),
        year: year(),
        medium: 'Oil on canvas, the oil drained out',
        dims: '152.4 × 152.4 cm',
        facts: [
          `Hung as seen after ${fmtTime(snap.still)} of stillness`,
          `Longest stillness in the room: ${fmtTime(S.best)}`,
          S.moves ? `Rules shown: ${S.moves}` : 'No rule was broken',
        ],
        review: { who: 'A visitor who walked past in four seconds, imagined', text: a > 0.6 ? 'There was a cross in it. I would not have believed it.' : 'It is a black square. I do not know what else to tell you.' },
      },
    };
  }

  return {
    resize, frame, fresh, hang,
    enter() {
      S.active = true; S.still = 0; S.adapt = 0; initSound();
      shell.hint('Keep still.<small>Your eyes need a minute or two</small>', 4500);
      clearTimeout(S.idleT); S.idleT = setTimeout(() => shell.setIdle(true), 3500);
    },
    leave() { S.active = false; clearTimeout(S.idleT); },
  };
}
