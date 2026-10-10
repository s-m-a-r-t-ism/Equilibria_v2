"""The singer.

espeak-ng speaks a line; we measure its formants (LPC) frame by frame, then
re-time the phonemes so every vowel lands on its note and lasts as long as the
note, and excite those formants with band-limited pulse trains at the pitches
of the melody (and, for the choir, at the pitches of the chord). The result is
a sung voice with a vocoder's glassy sheen, in the line of Messina, Bon Iver
and Imogen Heap.
"""
import numpy as np
from scipy.linalg import solve_toeplitz
from scipy.signal import resample_poly
import tts

SR = tts.SR  # 22050
N = 1024     # analysis window
HOP = 128
NFFT = 2048

UNVOICED = {"p", "t", "k", "f", "T", "s", "S", "h", "x", "tS", "t#", "t2", "k2", "p2"}
HALF = {"v", "D", "z", "Z", "dZ"}


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def lpc_analysis(x, order=26):
    """Return per-frame log-magnitude envelopes (frames, NFFT//2+1) centred at k*HOP."""
    pad = np.concatenate([np.zeros(N // 2), x, np.zeros(N)])
    nfr = len(x) // HOP + 1
    win = np.hanning(N)
    env = np.empty((nfr, NFFT // 2 + 1), np.float32)
    pre = np.concatenate([[pad[0]], pad[1:] - 0.0 * pad[:-1]])
    for i in range(nfr):
        f = pre[i * HOP:i * HOP + N] * win
        r = np.correlate(f, f, "full")[N - 1:N + order]
        if r[0] < 1e-9:
            env[i] = -20.0
            continue
        r[0] *= 1.0001
        r[1:] *= np.exp(-0.5 * (2 * np.pi * 40.0 * np.arange(1, order + 1) / SR) ** 2)  # lag window
        a = solve_toeplitz(r[:order], -r[1:order + 1])
        A = np.concatenate([[1.0], a])
        err = max(r[0] + np.dot(a, r[1:order + 1]), 1e-12)
        g = np.sqrt(err / np.sum(win ** 2))
        H = g / np.abs(np.fft.rfft(A, NFFT))
        env[i] = np.log(H + 1e-9)
    return env


def _segments(ph, words, nsamp, notes):
    """Map phonemes onto the notes. notes: list of (t, dur, midi), seconds.
    Returns list of (out_a, out_b, src_a, src_b, voicing)."""
    spans = []
    for i, (p, s) in enumerate(ph):
        e = ph[i + 1][1] if i + 1 < len(ph) else nsamp
        b = tts.bare(p)
        if b.startswith("_") or e <= s:
            continue
        v = 0.0 if b in UNVOICED else 0.55 if b in HALF else 1.0
        spans.append(dict(p=b, a=s / SR, b=e / SR, vowel=tts.is_vowel(p), v=v))
    vidx = [i for i, sp in enumerate(spans) if sp["vowel"]]
    if len(vidx) != len(notes):
        raise ValueError(f"{len(vidx)} vowels {[spans[i]['p'] for i in vidx]} but {len(notes)} notes")
    wb = [w / SR for w in words]

    def split(lo, hi):
        """Consonants strictly between vowel lo and hi -> (coda of lo, onset of hi)."""
        cl = list(range(lo + 1, hi))
        if not cl:
            return [], []
        if lo < 0:
            return [], cl
        if hi >= len(spans):
            return cl, []
        # a word boundary inside the cluster decides the split
        for j, i in enumerate(cl):
            if any(spans[i - 1]["b"] - 0.004 <= w <= spans[i]["a"] + 0.02 for w in wb):
                return cl[:j], cl[j:]
        if len(cl) == 1:
            return [], cl
        return cl[:1], cl[1:]

    onset, coda = {}, {}
    prev = -1
    for k, vi in enumerate(vidx):
        c, o = split(prev, vi)
        if prev >= 0:
            coda[k - 1] = c
        onset[k] = o
        prev = vi
    coda[len(vidx) - 1] = split(vidx[-1], len(spans))[0]

    dur = lambda idx: sum(spans[i]["b"] - spans[i]["a"] for i in idx)
    out = []
    for k, vi in enumerate(vidx):
        t, L, _ = notes[k]
        on_n, cd_n = dur(onset[k]), dur(coda[k])
        # onset consonants end on the beat; squeeze if the previous note is close
        room_before = t - (notes[k - 1][0] + 0.07) if k else 0.25
        s_on = min(1.0, 0.75 * room_before / on_n) if on_n > 0 else 1.0
        s_on = min(s_on, 1.0)
        # vowel end: note end, or before the next onset
        nxt_on = 0.0
        if k + 1 < len(vidx):
            nn = notes[k + 1][0]
            no = dur(onset[k + 1])
            nxt_room = nn - (t + 0.07)
            nxt_on = no * min(1.0, 0.75 * nxt_room / no) if no > 0 else 0.0
            end_lim = min(t + L, nn - nxt_on)
        else:
            end_lim = t + L
        s_cd = min(1.0, 0.45 * max(end_lim - t, 0.02) / cd_n) if cd_n > 0 else 1.0
        cd_t = cd_n * s_cd
        v_end = max(end_lim - cd_t, t + 0.04)
        # onset
        ta = t - on_n * s_on
        for i in onset[k]:
            d = (spans[i]["b"] - spans[i]["a"]) * s_on
            out.append((ta, ta + d, spans[i]["a"], spans[i]["b"], spans[i]["v"]))
            ta += d
        sp = spans[vi]
        out.append((t, v_end, sp["a"], sp["b"], 1.0))
        ta = v_end
        for i in coda[k]:
            d = (spans[i]["b"] - spans[i]["a"]) * s_cd
            out.append((ta, ta + d, spans[i]["a"], spans[i]["b"], spans[i]["v"]))
            ta += d
    return out


def _f0_track(notes, t_axis, transpose=0.0, vib=0.32, seed=0, glide=0.045):
    """Per-sample f0 for a voice singing `notes` (t, dur, midi)."""
    rng = np.random.default_rng(seed)
    m = np.full(len(t_axis), np.nan)
    onset = np.zeros(len(t_axis))
    for (t, L, mi) in notes:
        a = np.searchsorted(t_axis, t - 0.03)
        b = np.searchsorted(t_axis, t + L + 0.4)
        m[a:b] = mi + transpose
        onset[a:b] = t
    # hold the last pitch into gaps, first pitch before start
    idx = np.where(~np.isnan(m))[0]
    if len(idx) == 0:
        return np.full(len(t_axis), 110.0)
    m[:idx[0]] = m[idx[0]]
    ok = ~np.isnan(m)
    m = np.interp(np.arange(len(m)), np.where(ok)[0], m[ok])
    # portamento: one-pole in pitch space, decimated for speed
    dec = 32
    md = m[::dec].copy()
    a = np.exp(-dec / (SR * glide))
    for i in range(1, len(md)):
        md[i] = a * md[i - 1] + (1 - a) * md[i]
    m = np.interp(np.arange(len(m)), np.arange(len(md)) * dec, md)
    # vibrato fades in after a quarter second on each note
    age = t_axis - np.maximum.accumulate(np.where(onset > 0, onset, 0))
    depth = vib * np.clip((age - 0.25) / 0.5, 0, 1)
    rate = 5.1 + 0.25 * np.sin(2 * np.pi * 0.13 * t_axis + seed)
    ph = np.cumsum(2 * np.pi * rate / SR)
    drift = np.cumsum(rng.normal(0, 1, len(t_axis) // 256 + 2))
    drift = np.interp(np.arange(len(t_axis)) / 256, np.arange(len(drift)), drift - drift.mean())
    drift *= 0.04 / (np.std(drift) + 1e-9)
    m = m + depth * np.sin(ph) + drift
    return midi_hz(m)


def _blit(f0):
    """Band-limited unit-RMS pulse train following f0 (Hz per sample)."""
    phase = np.cumsum(2 * np.pi * f0 / SR)
    K = int(np.floor((SR / 2 - 200) / f0.max()))
    half = phase / 2
    s = np.sin(half)
    num = np.sin((K + 0.5) * phase)
    with np.errstate(divide="ignore", invalid="ignore"):
        y = np.where(np.abs(s) < 1e-6, K + 0.5, num / (2 * s)) - 0.5
    y = y / np.sqrt(K / 2.0)
    return y


def sing(text, notes, voices=None, rate=165, voice="en", seed=1):
    """Render a sung line.

    text   : the words, as espeak should say them
    notes  : list of (start_sec, dur_sec, midi) for the lead, one per vowel; times absolute
    voices : optional list of extra note lists (same rhythm, other pitches) for harmony
    Returns (t0, lead, [harm...]) where t0 is the absolute start time (s) of the
    returned arrays at 44.1 kHz.
    """
    a, ph, words = tts.say(text, voice=voice, rate=rate, pitch=45, prange=20)
    segs = _segments(ph, words, len(a), notes)
    env = lpc_analysis(a)
    t0 = min(s[0] for s in segs) - 0.05
    t1 = max(s[1] for s in segs) + 0.25
    n_out = int((t1 - t0) * SR)
    nfr = n_out // HOP + 1
    fr_t = t0 + np.arange(nfr) * HOP / SR + N / 2 / SR
    # source time and voicing per output frame
    src = np.full(nfr, -1.0)
    voi = np.zeros(nfr)
    for (oa, ob, sa, sb, v) in segs:
        i0, i1 = np.searchsorted(fr_t, oa), np.searchsorted(fr_t, ob)
        if i1 > i0:
            src[i0:i1] = sa + (fr_t[i0:i1] - oa) / max(ob - oa, 1e-6) * (sb - sa)
            voi[i0:i1] = v
    # smooth voicing a touch so fricative edges are not clicks
    k = np.array([0.25, 0.5, 0.25])
    voi = np.convolve(voi, k, "same")
    # envelopes per output frame (interpolated in log domain)
    nsrc = env.shape[0]
    fi = src * SR / HOP
    lo = np.clip(np.floor(fi).astype(int), 0, nsrc - 1)
    hi = np.clip(lo + 1, 0, nsrc - 1)
    w = (fi - np.floor(fi))[:, None]
    E = np.exp((1 - w) * env[lo] + w * env[hi])
    E[src < 0] = 0.0
    # gate tiny edges: fade gain at silence borders
    alive = (src >= 0).astype(float)
    alive = np.convolve(alive, np.ones(5) / 5, "same")
    E *= alive[:, None]

    t_axis = t0 + np.arange(n_out + N + NFFT) / SR
    rng = np.random.default_rng(seed)
    noise = rng.normal(0, 1, len(t_axis))
    win = np.hanning(N)

    def render(nlist, sd):
        f0 = _f0_track(nlist, t_axis, seed=sd)
        pulse = _blit(f0)
        y = np.zeros(len(t_axis) + NFFT)
        for i in range(nfr):
            s0 = i * HOP
            if not E[i].any():
                continue
            v = voi[i]
            seg = (v * pulse[s0:s0 + N] + ((1 - v) * 0.9 + 0.07 * v) * noise[s0:s0 + N]) * win  # a little breath
            Y = np.fft.rfft(seg, NFFT) * E[i]
            y[s0:s0 + NFFT] += np.fft.irfft(Y, NFFT)
        y /= 2.0 * (HOP / (N / 2))  # hann OLA gain at this hop
        return y[:n_out]

    lead = render(notes, seed)
    harms = [render(h, seed + 10 + j) for j, h in enumerate(voices or [])]
    up = lambda y: resample_poly(y, 2, 1)
    return t0, up(lead), [up(h) for h in harms]


if __name__ == "__main__":
    import soundfile as sf
    beat = 0.75
    e = beat / 2
    # I put a wire up through the frost and sang it to the black
    rh = [(1, 1, 61), (2, 1, 61), (3, 1, 64), (4, 2, 66), (6, 1, 64), (7, 1, 66),
          (8, 1, 68), (9, 2, 69), (11, 1, 66), (12, 1, 64), (13, 1, 61), (14, 1, 64), (15, 1, 62), (16, 6, 61)]
    notes = [(s * e, l * e, m) for s, l, m in rh]
    t0, lead, _ = sing("I put a wire up through the frost and sang it to the black", notes)
    print(t0, len(lead) / 44100, np.abs(lead).max())
    sf.write("/tmp/claude-0/-home-user-Equilibria-v2/7ee290a2-6f36-5a92-a184-fddef7850514/scratchpad/line1.wav", lead / np.abs(lead).max() * 0.8, 44100)
