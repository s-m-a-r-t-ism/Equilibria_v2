// Shared audio: one context, a master bus, a hall reverb, and a few generators.

let A = null;
let muted = false;

export function audio() {
  if (A) return A;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC({ latencyHint: 'interactive' });
  const master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 3;
  comp.attack.value = 0.01; comp.release.value = 0.25;
  master.connect(comp).connect(ctx.destination);

  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 3.4, 2.6);
  const revGain = ctx.createGain();
  revGain.gain.value = 0.55;
  reverb.connect(revGain).connect(master);

  A = { ctx, master, reverb, comp };
  return A;
}

export function resume() {
  const a = audio();
  if (a && a.ctx.state !== 'running') a.ctx.resume();
  return a;
}

export function setMuted(m) {
  muted = m;
  if (A) A.master.gain.setTargetAtTime(m ? 0 : 0.9, A.ctx.currentTime, 0.08);
}
export function isMuted() { return muted; }

// A room bus: fades in and out as rooms are entered and left.
export function bus(level = 1, wet = 0.3) {
  const a = audio();
  if (!a) return null;
  const g = a.ctx.createGain();
  g.gain.value = 0;
  const dry = a.ctx.createGain(); dry.gain.value = 1;
  const send = a.ctx.createGain(); send.gain.value = wet;
  g.connect(dry).connect(a.master);
  g.connect(send).connect(a.reverb);
  return {
    input: g, send,
    fadeIn(t = 1.2) { g.gain.cancelScheduledValues(a.ctx.currentTime); g.gain.setTargetAtTime(level, a.ctx.currentTime, t / 3); },
    fadeOut(t = 0.8) { g.gain.cancelScheduledValues(a.ctx.currentTime); g.gain.setTargetAtTime(0, a.ctx.currentTime, t / 3); },
  };
}

export function impulse(ctx, seconds, decay) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // a little early-reflection cluster, then a smooth tail
      const er = i < rate * 0.08 && Math.random() < 0.004 ? (Math.random() * 2 - 1) * 0.8 : 0;
      const n = Math.random() * 2 - 1;
      lp += (n - lp) * (0.25 + 0.6 * (1 - t)); // darker as it decays
      d[i] = (lp * Math.pow(1 - t, decay) + er) * 0.6;
    }
  }
  return buf;
}

const noiseCache = {};
export function noiseBuffer(ctx, seconds = 2, color = 'white') {
  const key = color + seconds;
  if (noiseCache[key]) return noiseCache[key];
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b = 0, p0 = 0, p1 = 0, p2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (color === 'brown') { b = (b + 0.02 * w) / 1.02; d[i] = b * 3.5; }
    else if (color === 'pink') {
      p0 = 0.99765 * p0 + w * 0.099046; p1 = 0.963 * p1 + w * 0.2965164; p2 = 0.57 * p2 + w * 1.0526913;
      d[i] = (p0 + p1 + p2 + w * 0.1848) * 0.18;
    } else d[i] = w;
  }
  noiseCache[key] = buf;
  return buf;
}

export function loopNoise(ctx, color = 'white') {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx, 3, color);
  s.loop = true;
  s.loopStart = Math.random();
  s.start(0, Math.random() * 2);
  return s;
}

// Karplus-Strong pluck rendered in JS (WebAudio delay feedback cannot go below one block).
export function pluckBuffer(ctx, freq, seconds = 3, bright = 0.5, damping = 0.996) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  const N = Math.max(2, rate / freq);
  const Ni = Math.floor(N), frac = N - Ni;
  const line = new Float32Array(Ni + 2);
  for (let i = 0; i < line.length; i++) line[i] = (Math.random() * 2 - 1);
  // soften the excitation
  for (let k = 0; k < 2 + Math.round((1 - bright) * 6); k++)
    for (let i = 1; i < line.length; i++) line[i] = 0.5 * (line[i] + line[i - 1]);
  let idx = 0, prev = 0;
  const L = line.length;
  for (let i = 0; i < len; i++) {
    const a = line[idx % L], b = line[(idx + 1) % L];
    const out = a + (b - a) * frac;
    const y = damping * (0.5 * (out + prev));
    prev = out;
    line[idx % L] = y;
    d[i] = out;
    idx++;
  }
  // fade tail
  const f = Math.floor(rate * 0.05);
  for (let i = 0; i < f; i++) d[len - 1 - i] *= i / f;
  return buf;
}

export function playBuffer(buf, dest, { gain = 1, rate = 1, when = 0, pan = 0 } = {}) {
  const a = audio(); if (!a) return;
  const s = a.ctx.createBufferSource();
  s.buffer = buf; s.playbackRate.value = rate;
  const g = a.ctx.createGain(); g.gain.value = gain;
  let node = s.connect(g);
  if (pan && a.ctx.createStereoPanner) { const p = a.ctx.createStereoPanner(); p.pan.value = pan; node = g.connect(p); }
  node.connect(dest);
  s.start(when || a.ctx.currentTime);
  return s;
}

// A short burst of filtered noise. Used for drops, splats, clunks.
export function tick(dest, { freq = 3000, q = 4, gain = 0.3, dur = 0.04, when = 0, pan = 0, type = 'bandpass' } = {}) {
  const a = audio(); if (!a) return;
  const ctx = a.ctx;
  const t = when || ctx.currentTime;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx, 2, 'white');
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let n = s.connect(f).connect(g);
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); n = g.connect(p); }
  n.connect(dest);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.05);
}

export function thump(dest, { freq = 110, gain = 0.5, dur = 0.25, when = 0, sweep = 0.5 } = {}) {
  const a = audio(); if (!a) return;
  const ctx = a.ctx;
  const t = when || ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(freq * (1 + sweep), t);
  o.frequency.exponentialRampToValueAtTime(freq, t + dur * 0.4);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}
