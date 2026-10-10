"""Instruments and effects. Everything is synthesized from scratch at 44.1 kHz."""
import numpy as np
from numba import njit
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
RNG = np.random.default_rng(1927)


def mtof(m):
    return 440.0 * 2.0 ** ((np.asarray(m, dtype=float) - 69.0) / 12.0)


def secs(n):
    return int(round(n * SR))


# ------------------------------------------------------------------ filters
def sos(kind, f, order=2):
    if kind == "band":
        return butter(order, [f[0] / (SR / 2), min(f[1] / (SR / 2), 0.99)], "bandpass", output="sos")
    return butter(order, min(f / (SR / 2), 0.99), kind, output="sos")


def lp(x, f, order=2):
    return sosfilt(sos("low", f, order), x, axis=-1)


def hp(x, f, order=2):
    return sosfilt(sos("high", f, order), x, axis=-1)


def bp(x, lo, hi, order=2):
    return sosfilt(sos("band", (lo, hi), order), x, axis=-1)


@njit(cache=True)
def svf(x, cutoff, q, mode):
    """Time-varying state-variable filter (Chamberlin, 2x oversampled).
    cutoff: array of Hz per sample. mode 0=low 1=band 2=high."""
    y = np.zeros_like(x)
    low = 0.0
    band = 0.0
    damp = 1.0 / q
    for i in range(len(x)):
        f = 2.0 * np.sin(np.pi * min(cutoff[i], 16000.0) / (2.0 * 44100.0))
        for _ in range(2):
            high = x[i] - low - damp * band
            band += f * high
            low += f * band
        if mode == 0:
            y[i] = low
        elif mode == 1:
            y[i] = band
        else:
            y[i] = high
    return y


@njit(cache=True)
def onepole(x, a):
    y = np.zeros_like(x)
    s = x[0] if len(x) else 0.0
    for i in range(len(x)):
        s = s + a * (x[i] - s)
        y[i] = s
    return y


# ------------------------------------------------------------------ oscillators
@njit(cache=True)
def _polyblep(t, dt):
    if t < dt:
        t = t / dt
        return t + t - t * t - 1.0
    elif t > 1.0 - dt:
        t = (t - 1.0) / dt
        return t * t + t + t + 1.0
    return 0.0


@njit(cache=True)
def saw(freq, phase0):
    """Band-limited saw following a per-sample frequency array."""
    y = np.zeros(len(freq))
    p = phase0
    for i in range(len(freq)):
        dt = freq[i] / 44100.0
        y[i] = 2.0 * p - 1.0 - _polyblep(p, dt)
        p += dt
        if p >= 1.0:
            p -= 1.0
    return y


def sine(freq, phase0=0.0):
    return np.sin(2 * np.pi * (np.cumsum(freq) / SR) + phase0)


def env_adsr(n, a, d, s, r, hold):
    """n samples total; hold = seconds before release begins."""
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = np.clip((t - hold) / max(r, 1e-4), 0, None)
    e = e * np.where(t > hold, np.exp(-rel * 4.0), 1.0)
    return e


# ------------------------------------------------------------------ space
def make_ir(length, decay, damp_hz=6000.0, predelay=0.012, seed=0, early=True):
    """Stereo synthetic reverb impulse response: decorrelated noise with an
    exponential decay that is faster at high frequencies."""
    rng = np.random.default_rng(seed)
    n = secs(length)
    t = np.arange(n) / SR
    ir = np.zeros((2, n + secs(predelay)))
    for ch in range(2):
        noise = rng.normal(0, 1, n)
        lo = lp(noise, 800)
        mid = bp(noise, 800, 4000)
        hi = hp(noise, 4000)
        e = lambda T: np.exp(-6.9 * t / T)
        x = lo * e(decay * 1.15) + mid * e(decay) + hi * e(decay * damp_hz / 12000.0)
        if early:
            for k in range(12):
                p = int(rng.uniform(0.003, 0.06) * SR)
                x[p] += rng.uniform(-1, 1) * 2.5 * (1 - k / 12)
        x *= np.clip(t / 0.02, 0, 1)  # soft onset
        ir[ch, secs(predelay):] = x
    ir /= np.sqrt(np.sum(ir ** 2) / 2)
    return ir


def convolve_stereo(x, ir):
    """x: mono (n,) or stereo (2, n). Returns (2, n + len(ir) - 1)."""
    if x.ndim == 1:
        x = np.vstack([x, x])
    return np.vstack([fftconvolve(x[0], ir[0]), fftconvolve(x[1], ir[1])])


def pan(x, p):
    """Equal-power pan, p in [-1, 1]. Mono in, stereo out."""
    a = (p + 1) * np.pi / 4
    return np.vstack([x * np.cos(a), x * np.sin(a)])


def tape(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)


def crush(x, bits=12, down=1):
    q = 2.0 ** (bits - 1)
    y = np.round(x * q) / q
    if down > 1:
        y = np.repeat(y[..., ::down], down, axis=-1)[..., :x.shape[-1]]
    return y


@njit(cache=True)
def _ks(n, period, damping, bright, seed):
    np.random.seed(seed)
    L = int(period)
    frac = period - L
    buf = np.zeros(L + 2)
    for i in range(L + 2):
        buf[i] = np.random.uniform(-1.0, 1.0)
    # pick position colouring: a little low-pass on the excitation
    for k in range(3):
        for i in range(1, L + 2):
            buf[i] = bright * buf[i] + (1 - bright) * buf[i - 1]
    y = np.zeros(n)
    idx = 0
    prev = 0.0
    size = L + 2
    for i in range(n):
        j0 = idx
        j1 = (idx + 1) % size
        s = buf[j0] * (1 - frac) + buf[j1] * frac
        out = damping * 0.5 * (s + prev)
        prev = s
        y[i] = s
        buf[idx] = out
        idx = (idx + 1) % size
    return y


def pluck(freq, dur, vel=1.0, bright=0.5, damping=0.996, seed=0):
    """Karplus-Strong string, a clean electric guitar with a little body."""
    n = secs(dur)
    y = _ks(n, SR / freq, damping, bright, seed)
    y = y - lp(y, 90)  # remove DC rumble
    body = bp(y, 180, 2600, 1) * 0.6 + y * 0.4
    fade = np.ones(n)
    fr = min(secs(0.08), n)
    fade[-fr:] = np.linspace(1, 0, fr)
    return body * fade * vel


# ------------------------------------------------------------------ drums
def kick(vel=1.0, tone=52.0, seed=0):
    n = secs(0.9)
    t = np.arange(n) / SR
    f = tone + 110 * np.exp(-t / 0.035) + 40 * np.exp(-t / 0.006)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.42)
    click = hp(np.random.default_rng(seed).normal(0, 1, n), 1500) * np.exp(-t / 0.004) * 0.35
    y = tape(body * 1.3 + click, 1.6)
    return y * vel


def snare(vel=1.0, seed=0, tone=185.0, length=0.32):
    n = secs(0.6)
    t = np.arange(n) / SR
    rng = np.random.default_rng(seed)
    body = (np.sin(2 * np.pi * np.cumsum(tone * (1 + 0.5 * np.exp(-t / 0.01))) / SR)
            + 0.5 * np.sin(2 * np.pi * np.cumsum(tone * 1.63 * np.ones(n)) / SR)) * np.exp(-t / 0.06)
    noise = rng.normal(0, 1, n)
    wires = bp(noise, 1800, 9000) * np.exp(-t / (length * 0.45))
    crack = hp(noise, 3000) * np.exp(-t / 0.012)
    y = body * 0.7 + wires * 0.9 + crack * 0.5
    return tape(y * 1.2, 1.4) * vel


def tom(freq=120.0, vel=1.0, seed=0):
    n = secs(0.7)
    t = np.arange(n) / SR
    f = freq * (1 + 0.45 * np.exp(-t / 0.04))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.28)
    skin = bp(np.random.default_rng(seed).normal(0, 1, n), 300, 3000) * np.exp(-t / 0.03) * 0.25
    return tape((body + skin) * 1.2, 1.4) * vel


def rim(vel=1.0, seed=0):
    n = secs(0.15)
    t = np.arange(n) / SR
    y = (np.sin(2 * np.pi * 1650 * t) * 0.6 + np.sin(2 * np.pi * 520 * t)) * np.exp(-t / 0.018)
    y += hp(np.random.default_rng(seed).normal(0, 1, n), 2000) * np.exp(-t / 0.006) * 0.4
    return y * vel


def hat(vel=1.0, open_=False, seed=0):
    n = secs(0.6 if open_ else 0.12)
    t = np.arange(n) / SR
    # six detuned squares (the 808 way) plus noise
    fs = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0]
    m = sum(np.sign(np.sin(2 * np.pi * f * 1.7 * t + k)) for k, f in enumerate(fs)) / 6.0
    noise = np.random.default_rng(seed).normal(0, 1, n)
    y = hp(m * 0.6 + noise * 0.6, 7000, 2)
    y = y * np.exp(-t / (0.16 if open_ else 0.022))
    return y * vel


def shaker(vel=1.0, seed=0):
    n = secs(0.09)
    t = np.arange(n) / SR
    y = bp(np.random.default_rng(seed).normal(0, 1, n), 4000, 12000) * (t / 0.02) * np.exp(-t / 0.025)
    return y * vel


# ------------------------------------------------------------------ tuned voices
def music_box(freq, dur=2.6, vel=1.0):
    """A comb tine: inharmonic partials, fast-decaying upper modes."""
    n = secs(dur)
    t = np.arange(n) / SR
    parts = [(1.0, 1.0, 1.6), (2.0, 0.22, 0.7), (5.404, 0.18, 0.25), (8.933, 0.08, 0.12), (13.34, 0.04, 0.06)]
    y = np.zeros(n)
    for r, a, d in parts:
        f = freq * r
        if f < SR / 2.2:
            y += a * np.sin(2 * np.pi * f * t + r) * np.exp(-t / d)
    y += 0.25 * hp(np.random.default_rng(int(freq)).normal(0, 1, n), 5000) * np.exp(-t / 0.003)
    return y * np.clip(t / 0.001, 0, 1) * vel


def pad_voice(freq_track, bright_track, seed=0, detune=0.11):
    """Three detuned saws through a moving low-pass."""
    y = np.zeros(len(freq_track))
    rng = np.random.default_rng(seed)
    for k, dc in enumerate((-detune, 0.0, detune)):
        drift = 1 + 0.0015 * np.sin(2 * np.pi * (0.07 + 0.03 * k) * np.arange(len(freq_track)) / SR + rng.uniform(0, 6))
        y += saw(freq_track * 2 ** (dc / 12) * drift, rng.uniform(0, 1))
    return svf(y / 3, bright_track, 0.9, 0)


def theremin(freq_track, amp_track, seed=0):
    """Sine with a breath of the second and third harmonic, vibrato, slight noise: an ondes/theremin."""
    n = len(freq_track)
    t = np.arange(n) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.4 * t) * np.clip(amp_track * 3, 0, 1)
    f = freq_track * vib
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) + 0.12 * np.sin(2 * ph + 0.3) + 0.05 * np.sin(3 * ph)
    return y * amp_track


def glide_track(n, notes, t0=0.0, glide=0.06, default=None):
    """notes: list of (t_start, t_end, midi). Returns (freq per sample, gate per sample)."""
    m = np.full(n, np.nan)
    gate = np.zeros(n)
    for (a, b, mi) in notes:
        i0, i1 = max(secs(a - t0), 0), min(secs(b - t0), n)
        if i1 > i0:
            m[i0:i1] = mi
            gate[i0:i1] = 1.0
    ok = ~np.isnan(m)
    if not ok.any():
        return np.full(n, 110.0), gate
    idx = np.where(ok)[0]
    m = np.interp(np.arange(n), idx, m[idx])
    a = 1.0 - np.exp(-1.0 / (SR * glide))
    m = onepole(m.astype(np.float64), a)
    return mtof(m), gate
