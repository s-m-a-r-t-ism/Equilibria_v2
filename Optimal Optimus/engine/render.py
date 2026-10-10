"""Render LONG DELAYED ECHOES to stems and a mastered stereo file.

python3 render.py [out_dir]      (writes song.wav, stems/*.wav, timeline.json)
"""
import json, os, sys, time
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
import pyloudnorm as pyln

import score as S
import synth as Y
import voice as V
import tts
import render_data

SR = Y.SR
OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else os.path.join(os.path.dirname(__file__), "..", "build")
os.makedirs(os.path.join(OUT, "stems"), exist_ok=True)
NTOT = Y.secs(S.END_T + 1.0)
BAR, BEAT, E8 = S.BAR, S.BEAT, S.E8
S16 = E8 / 2
rng = np.random.default_rng(7)
T0 = time.time()


def log(*a):
    print(f"[{time.time() - T0:6.1f}s]", *a, flush=True)


class Bus:
    def __init__(self, name):
        self.name = name
        self.x = np.zeros((2, NTOT))

    def add(self, sig, t, gain=1.0, pan=0.0):
        if sig.ndim == 1:
            sig = Y.pan(sig, pan)
        i0 = Y.secs(t)
        if i0 < 0:
            sig = sig[:, -i0:]
            i0 = 0
        n = min(sig.shape[1], NTOT - i0)
        if n > 0:
            self.x[:, i0:i0 + n] += sig[:, :n] * gain


def tb(bar, step16=0.0):
    return bar * BAR + step16 * S16


def automation(points, n=NTOT):
    """points: list of (time_s, value). Linear between, held at ends. Per-sample array."""
    ts = np.array([p[0] for p in points]) * SR
    vs = np.array([p[1] for p in points], float)
    return np.interp(np.arange(n), ts, vs)


def section_bar(name):
    for nm, b, n, _ in S.SECTIONS:
        if nm == name:
            return b, n
    raise KeyError(name)


# =========================================================== harmony helpers
def chord_pitches(sym, lo, hi):
    bass, tones = S.pcs(sym)
    return [m for m in range(lo, hi + 1) if m % 12 in tones]


def voice_lead(prev, sym, lo, hi, k):
    cand = chord_pitches(sym, lo, hi)
    if prev is None:
        # spread evenly over the range
        targets = np.linspace(lo + 3, hi - 3, k)
    else:
        targets = prev
    out, used = [], set()
    for tg in targets:
        best = sorted(cand, key=lambda m: (abs(m - tg) + (2.5 if m % 12 in used else 0)))[0]
        out.append(best)
        used.add(best % 12)
    return sorted(out)


def harmonies(notes, level):
    """Return extra note lists for the choir under/over a lead line."""
    if level <= 0:
        return [], []
    h1, h2, top, low = [], [], [], []
    for (t, L, m) in notes:
        sym = S.chord_at(t + 0.01)
        cp = chord_pitches(sym, 40, 90)
        below = [c for c in cp if c <= m - 3]
        a = below[-1] if below else m - 5
        below2 = [c for c in cp if c <= a - 3]
        b = below2[-1] if below2 else a - 4
        above = [c for c in cp if c >= m + 3]
        c = above[0] if above else m + 4
        h1.append((t, L, a)); h2.append((t, L, b)); top.append((t, L, c)); low.append((t, L, m - 12))
    under = [h1] + ([h2] if level >= 2 else [])
    over = ([top] if level >= 3 else [])
    if level >= 3:
        under.append(low)
    return under, over


# =========================================================== buses
drums = Bus("drums")
bass = Bus("bass")
pads = Bus("pads")
strings = Bus("strings")
gtr = Bus("guitar")
box = Bus("musicbox")
ther = Bus("theremin")
lead = Bus("lead")
choir = Bus("choir")
echo = Bus("echoes")
nums = Bus("numbers")
radio = Bus("radio")
plate_send = Bus("plate")
hall_send = Bus("hall")


# =========================================================== drums
def drums_part():
    kicks = [Y.kick(1.0, 50 + k, seed=k) for k in range(4)]
    snares = [Y.snare(1.0, seed=k) for k in range(4)]
    hats = [Y.hat(1.0, False, seed=k) for k in range(6)]
    ohat = Y.hat(1.0, True, seed=9)
    rims = [Y.rim(1.0, seed=k) for k in range(3)]
    shk = [Y.shaker(1.0, seed=k) for k in range(4)]

    def hit(kind, bar, step, vel, pan=0.0):
        swing = 0.13 * S16 if step % 2 == 1 else 0.0
        t = tb(bar, step) + swing + rng.normal(0, 0.003)
        v = vel * rng.uniform(0.9, 1.05)
        if kind in ("k", "s"):
            HITS.append((round(t, 4), kind, round(v, 3)))
        if kind == "k":
            drums.add(kicks[rng.integers(4)], t, 0.9 * v, 0)
        elif kind == "s":
            s = snares[rng.integers(4)]
            drums.add(s, t + 0.012, 0.55 * v, 0.05)  # lazy snare, a hair behind
            plate_send.add(s, t + 0.012, 0.35 * v, 0.05)
        elif kind == "g":
            drums.add(snares[rng.integers(4)], t + 0.01, 0.13 * v, 0.05)
        elif kind == "h":
            drums.add(hats[rng.integers(6)], t, 0.26 * v, 0.3)
        elif kind == "o":
            drums.add(ohat, t, 0.12 * v, 0.3)
        elif kind == "r":
            drums.add(rims[rng.integers(3)], t, 0.22 * v, -0.15)
            plate_send.add(rims[0], t, 0.1 * v)
        elif kind == "sh":
            drums.add(shk[rng.integers(4)], t, 0.1 * v, -0.35)

    def pattern_a(bar, var, hats16=False):
        hit("k", bar, 0, 1.0)
        hit("k", bar, 10, 0.82)
        if var == 3:
            hit("k", bar, 3, 0.5); hit("g", bar, 14, 1.0); hit("o", bar, 14, 0.8)
        hit("s", bar, 4, 1.0)
        hit("s", bar, 12, 1.0)
        hit("g", bar, 7, 1.0); hit("g", bar, 15, 0.8)
        for st in range(0, 16, 2):
            hit("h", bar, st, 0.55 if st % 4 == 0 else 0.9)
        if hats16:
            for st in (3, 7, 11):
                hit("h", bar, st, 0.35)

    def pattern_b(bar, var):
        hit("k", bar, 0, 1.0); hit("k", bar, 6, 0.6); hit("k", bar, 10, 0.9)
        if var == 3:
            hit("k", bar, 13, 0.55)
        hit("s", bar, 4, 1.05); hit("s", bar, 12, 1.05)
        hit("g", bar, 7, 1.0); hit("g", bar, 15, 0.9)
        for st in range(16):
            hit("h", bar, st, (0.95 if st % 4 == 2 else 0.4) * (0.8 if st % 2 else 1))
            hit("sh", bar, st, 0.7 if st % 2 else 0.4)
        if var == 3:
            hit("o", bar, 14, 1.0)

    # night: a heartbeat under the numbers
    for bar in range(16, 22):
        hit("k", bar, 0, 0.5); hit("k", bar, 3, 0.32)
    # reversed snare swell into verse 1
    rs = Y.snare(1.0, seed=3)[::-1]
    swell = np.concatenate([np.zeros(1), rs])
    drums.add(swell, tb(24) - len(swell) / SR, 0.45, 0)
    plate_send.add(swell, tb(24) - len(swell) / SR, 0.25)
    toms = {"hi": Y.tom(196, 1.0, 1), "mid": Y.tom(147, 1.0, 2), "lo": Y.tom(110, 1.0, 3)}

    def fill(bar, big=False):
        """The last half bar before a new section: toms walking down, snare in between."""
        seq = [(8, "hi"), (10, "hi"), (11, "mid"), (12, "mid"), (14, "lo"), (15, "lo")] if big else \
              [(10, "hi"), (12, "mid"), (14, "lo")]
        for st, k in seq:
            swing = 0.13 * S16 if st % 2 == 1 else 0.0
            t = tb(bar, st) + swing
            drums.add(toms[k], t, 0.5, {"hi": 0.25, "mid": 0.0, "lo": -0.25}[k])
            plate_send.add(toms[k], t, 0.12)
        for st in (9, 13):
            hit("g", bar, st, 2.2)

    for bar in range(24, 40):
        pattern_a(bar, bar % 4, hats16=False)
    for bar in range(40, 48):
        pattern_b(bar, bar % 4)
    for bar in range(48, 64):
        pattern_a(bar, bar % 4, hats16=True)
    for bar in range(64, 72):
        pattern_b(bar, bar % 4)
    # bridge: the beat breaks up (stutters, crushed), then drops away
    for bar in range(72, 80):
        hit("k", bar, 0, 0.9)
        if bar % 2 == 1:
            hit("k", bar, 10, 0.6)
        hit("s", bar, 12, 0.8)
        for st in rng.choice(16, 4, replace=False):
            hit("g", bar, int(st), 1.4)
        if bar in (75, 79):
            for k in range(8):
                hit("r", bar, 8 + k, 0.4 + 0.08 * k)
    for bar in range(80, 84):
        hit("k", bar, 0, 0.45); hit("k", bar, 3, 0.3)
    # build: snare roll accelerating into the final chorus
    for bar in range(84, 88):
        div = {84: 2, 85: 2, 86: 1, 87: 0.5}[bar]
        n = int(16 / div)
        for k in range(n):
            st = k * div
            prog = ((bar - 84) * 16 + st) / 64.0
            t = tb(bar, st)
            s = snares[k % 4]
            drums.add(s, t, (0.08 + 0.42 * prog ** 1.5), 0.0)
            plate_send.add(s, t, 0.15 * prog)
        hit("k", bar, 0, 0.9); hit("k", bar, 8, 0.8)
    for bar in range(88, 98):
        pattern_b(bar, bar % 4)
    for bar, big in ((39, False), (47, True), (63, False), (71, True), (95, True)):
        fill(bar, big)
    # riser into the final chorus: filtered noise climbing through two bars
    n = Y.secs(2 * BAR)
    rz = np.random.default_rng(4).normal(0, 1, n)
    cut = np.geomspace(250, 7000, n)
    rise = Y.svf(rz, cut, 4.0, 1) * np.linspace(0, 1, n) ** 2
    drums.add(rise, tb(86), 0.10, 0.0)
    hall_send.add(rise, tb(86), 0.08)
    # crash at the big moments
    crash = Y.hp(np.random.default_rng(5).normal(0, 1, Y.secs(3.0)), 5000) * np.exp(-np.arange(Y.secs(3.0)) / SR / 0.9)
    for bar in (40, 64, 88, 92, 96, 98):
        drums.add(crash, tb(bar), 0.12, -0.2)
        hall_send.add(crash, tb(bar), 0.04)


# =========================================================== bass
BASS_LO = 30


def bass_note_for(sym):
    b, _ = S.pcs(sym)
    m = BASS_LO + ((b - BASS_LO) % 12)
    return m


def bass_part():
    notes = []
    def bar_notes(bar, rhythm):
        cs = S.BAR_CHORDS[bar]
        for (st, ln) in rhythm:
            t = tb(bar, st)
            sym = S.chord_at(t + 0.01)
            notes.append((t, t + ln * S16, bass_note_for(sym)))
    straight = [(0, 7), (8, 1.5), (10, 5)]
    push = [(0, 6), (6, 2), (10, 4), (14, 2)]
    for bar in range(28, 40):
        bar_notes(bar, straight)
    for bar in range(40, 48):
        bar_notes(bar, push)
    for bar in range(48, 64):
        bar_notes(bar, straight if bar % 4 != 3 else push)
    for bar in range(64, 72):
        bar_notes(bar, push)
    # bridge: pedal F#, the floor under the weather
    for bar in range(72, 80, 2):
        notes.append((tb(bar), tb(bar + 2) - 0.05, 30))
    notes.append((tb(83), tb(84) - 0.05, 30))
    for bar in range(84, 88):
        bar_notes(bar, [(0, 3.5), (4, 3.5), (8, 3.5), (12, 3.5)])
    for bar in range(88, 98):
        bar_notes(bar, push)
    notes.append((tb(98), tb(99) - 0.1, 30))
    notes.append((tb(100), tb(108), 30))
    f, gate = Y.glide_track(NTOT, notes, glide=0.025)
    env = Y.onepole(gate, 1 - np.exp(-1 / (SR * 0.012)))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
    x = Y.tape(x * env * 2.2, 2.4) * 0.45  # more harmonics: the bass speaks on small speakers too
    # night: sub swells under the numbers
    sw = np.zeros(NTOT)
    for bar in range(12, 24, 4):
        sym = S.BAR_CHORDS[bar][0]
        i0, n = Y.secs(tb(bar)), Y.secs(4 * BAR)
        t = np.arange(n) / SR
        sw[i0:i0 + n] += np.sin(2 * np.pi * Y.mtof(bass_note_for(sym)) * t) * np.sin(np.pi * t / (4 * BAR)) ** 2 * 0.5
    bass.add(Y.pan(x + sw, 0), 0)


# =========================================================== pads and strings
def chord_segments(lo, hi, k):
    """Voice-led chord voicings over the whole song: list of (t0, t1, [midi...])."""
    segs, prev = [], None
    for bar in range(S.TOTAL_BARS):
        cs = S.BAR_CHORDS[bar]
        for j, sym in enumerate(cs):
            t0 = tb(bar) + j * BAR / len(cs)
            t1 = t0 + BAR / len(cs)
            v = voice_lead(prev, sym, lo, hi, k)
            prev = v
            segs.append((t0, t1, v))
    return segs


def pads_part():
    segs = chord_segments(50, 74, 5)
    bright = automation([(0, 380), (tb(8), 700), (tb(24), 1100), (tb(40), 2100), (tb(48), 1300), (tb(64), 2300),
                         (tb(72), 650), (tb(84), 900), (tb(88), 3200), (tb(100), 1400), (tb(110), 450), (S.END_T, 300)])
    lfo = 1 + 0.25 * np.sin(2 * np.pi * np.arange(NTOT) / SR / 11.0)
    level = automation([(0, 0.0), (tb(1), 0.5), (tb(8), 0.6), (tb(24), 0.55), (tb(40), 0.65), (tb(48), 0.55),
                        (tb(64), 0.65), (tb(72), 0.6), (tb(79.5), 0.6), (tb(80), 0.3), (tb(84), 0.35),
                        (tb(87.9), 0.8), (tb(88), 0.75), (tb(100), 0.7),
                        (tb(110), 0.35), (tb(112), 0.0), (S.END_T, 0.0)])
    for k in range(5):
        f, _ = Y.glide_track(NTOT, [(a, b, v[k]) for a, b, v in segs], glide=0.18)
        x = Y.pad_voice(f, bright * lfo * (1 + 0.08 * k), seed=k)
        p = [-0.6, -0.25, 0.0, 0.25, 0.6][k]
        sig = Y.pan(x * level * 0.16, p)
        pads.add(sig, 0)
    hall_send.add(pads.x * 0.55, 0)


def strings_part():
    segs = chord_segments(62, 83, 4)
    level = automation([(0, 0), (tb(39), 0), (tb(40), 0.7), (tb(47.5), 0.7), (tb(48), 0), (tb(63), 0),
                        (tb(64), 0.8), (tb(71.5), 0.8), (tb(72), 0), (tb(84), 0), (tb(88), 1.0), (tb(100), 0.9),
                        (tb(108), 0.4), (tb(111), 0), (S.END_T, 0)])
    bright = automation([(0, 2500), (tb(88), 4200), (tb(100), 2600), (S.END_T, 1500)])
    t = np.arange(NTOT) / SR
    for k in range(4):
        f, _ = Y.glide_track(NTOT, [(a, b, v[k]) for a, b, v in segs], glide=0.12)
        f = f * (1 + 0.004 * np.sin(2 * np.pi * (5.0 + 0.3 * k) * t + k))
        x = Y.pad_voice(f, bright, seed=20 + k, detune=0.07)
        x = Y.bp(x, 280, 6000, 1)
        p = [-0.5, -0.15, 0.15, 0.5][k]
        strings.add(Y.pan(x * level * 0.12, p), 0)
    hall_send.add(strings.x * 0.5, 0)


# =========================================================== guitar
def guitar_part():
    """Arpeggios in threes against four (the Weird Fishes trick), dotted-eighth echoes."""
    order = [0, 2, 1, 3, 2, 1]
    k = 0
    bars = list(range(48, 72)) + list(range(88, 100))
    for bar in bars:
        for st in range(0, 16, 2):
            t = tb(bar, st)
            sym = S.chord_at(t + 0.01)
            cp = chord_pitches(sym, 59, 79)
            if len(cp) < 4:
                cp = cp + [c + 12 for c in cp]
            # three-note cell cycling over the eighths
            cell = [cp[0], cp[min(2, len(cp) - 1)], cp[min(4, len(cp) - 1)]] if len(cp) > 4 else cp[:3]
            m = cell[k % 3] + (12 if (k // 3) % 4 == 3 else 0)
            v = 0.75 if k % 3 == 0 else 0.55
            if bar < 52:
                v *= (bar - 47) / 5.0
            x = Y.pluck(Y.mtof(m), 1.6, v, bright=0.55, seed=k % 50)
            pn = -0.35 if k % 2 else 0.35
            gtr.add(x, t + rng.normal(0, 0.004), 0.32, pn)
            k += 1
    # dotted-eighth delay, ping-pong
    d = Y.secs(3 * S16)
    mono = Y.lp(gtr.x.sum(axis=0), 3800)
    wet = np.zeros_like(gtr.x)
    for r in range(1, 6):
        wet[r % 2, d * r:] += mono[:-d * r] * 0.42 ** r
    gtr.x += wet * 0.5
    plate_send.add(gtr.x * 0.3, 0)


# =========================================================== music box
def musicbox_part():
    for bar in S.INTERVAL_BARS:
        for (s8, l8, m) in S.INTERVAL:
            t = tb(bar) + s8 * E8 + rng.normal(0, 0.004)
            v = 0.5 if bar in (0, 108) else 0.7
            x = Y.music_box(Y.mtof(m), 3.0, v)
            box.add(x, t, 0.33, 0.2)
            hall_send.add(x, t, 0.22, 0.2)
    # verse 2: a few lonely notes from the box, as if from another room
    for bar, s8, m in [(51, 4, 73), (55, 4, 76), (59, 6, 73), (63, 4, 71)]:
        x = Y.music_box(Y.mtof(m), 3.0, 0.4)
        box.add(x, tb(bar) + s8 * E8, 0.25, 0.5)
        hall_send.add(x, tb(bar) + s8 * E8, 0.3, 0.5)


# =========================================================== theremin
THER_NOTES = render_data.THER_NOTES


def theremin_part():
    notes = [(tb(b) + s * E8, tb(b) + (s + l) * E8, m) for b, s, l, m in THER_NOTES]
    f, gate = Y.glide_track(NTOT, notes, glide=0.09)
    amp = Y.onepole(gate, 1 - np.exp(-1 / (SR * 0.12)))
    x = Y.theremin(f, amp * 0.22)
    ther.add(x, 0, 1.0, -0.25)
    hall_send.add(x, 0, 0.6)


# =========================================================== voices
VOCAL_SEGMENTS = []   # for the timeline
HITS = []             # drum hits for the picture: (t, kind, vel)


def place(bus, sig, t, gain, p):
    bus.add(sig, t, gain, p)


def lde(sig_mono, t, gain, p, flutter_seed):
    """A long delayed echo: same audio, three seconds later, through the upper air."""
    n = len(sig_mono)
    tt = np.arange(n) / SR
    r = np.random.default_rng(flutter_seed)
    # flutter: tiny time-warp
    warp = tt + 0.0012 * np.sin(2 * np.pi * 0.7 * tt + r.uniform(0, 6)) + 0.00012 * np.sin(2 * np.pi * 5.3 * tt)
    y = np.interp(warp * SR, np.arange(n), sig_mono)
    y = Y.bp(y, 380, 3200, 2)
    y = Y.tape(y * 2.2, 2.0) * 0.6
    fade = 0.75 + 0.25 * np.sin(2 * np.pi * 0.9 * tt + r.uniform(0, 6))
    y *= fade
    echo.add(Y.pan(y, p), t + BAR, gain)
    hall_send.add(Y.pan(y, p), t + BAR, gain * 0.9)


def vocals_part():
    for i, ln in enumerate(S.LINES):
        under, over = harmonies(ln["notes"], ln["choir"])
        t0, ld, hs = V.sing(ln["text"], ln["notes"], voices=under + over, seed=i + 1)
        g = 0.42
        place(lead, ld, t0, g, 0.0)
        # two quiet doubles, sung again with their own vibrato and drift, a hair late, left and right
        for k, (dl, pn) in enumerate(((0.014, -0.28), (0.009, 0.28))):
            td, ldd, _ = V.sing(ln["text"], ln["notes"], seed=i + 200 + 37 * k)
            place(lead, ldd, td + dl, g * 0.26, pn)
        plate_send.add(ld, t0, g * 0.32)
        hall_send.add(ld, t0, g * 0.12)
        pans = [-0.45, 0.45, -0.7, 0.7, 0.0]
        hg = [0.36, 0.3, 0.26, 0.22, 0.2]
        for j, h in enumerate(hs):
            place(choir, h, t0, g * hg[j], pans[j % len(pans)])
            hall_send.add(h, t0, g * hg[j] * 0.35)
        # the echo: the last syllables of the line come back one bar later
        ne = ln["echo"]
        if ne:
            ts = ln["notes"][-ne][0] - 0.12
            te = ln["notes"][-1][0] + ln["notes"][-1][1] + 0.35
            a, b = Y.secs(ts - t0), Y.secs(te - t0)
            seg = ld[max(a, 0):b].copy()
            fl = min(Y.secs(0.05), len(seg) // 4)
            seg[:fl] *= np.linspace(0, 1, fl)
            seg[-fl:] *= np.linspace(1, 0, fl)
            lde(seg, ts, 0.5 * g, 0.35 if i % 2 else -0.35, i)
            VOCAL_SEGMENTS.append(dict(kind="echo", t=ts + BAR, d=te - ts, line=i))
        log("sung", i, ln["text"][:40])
    # the final echo, after the silence: "...my name", once more, from very far away
    last = S.LINES[-1]
    t0, ld, _ = V.sing(last["text"], last["notes"], seed=99)
    ts = last["notes"][-2][0] - 0.1
    te = last["notes"][-1][0] + last["notes"][-1][1] + 0.4
    seg = ld[Y.secs(ts - t0):Y.secs(te - t0)].copy()
    fl = Y.secs(0.06)
    seg[:fl] *= np.linspace(0, 1, fl); seg[-fl:] *= np.linspace(1, 0, fl)
    y = Y.bp(seg, 450, 2800, 2)
    y = Y.tape(y * 2.0, 2.0) * 0.5
    echo.add(Y.pan(y, 0.2), S.FINAL_ECHO_T, 0.32)
    hall_send.add(Y.pan(y, 0.2), S.FINAL_ECHO_T, 0.5)
    VOCAL_SEGMENTS.append(dict(kind="final_echo", t=S.FINAL_ECHO_T, d=te - ts))


def radio_chain(x, lo=320, hi=3100, drive=2.5, seed=0):
    y = Y.bp(x, lo, hi, 2)
    y = Y.tape(y * drive, drive) * 0.7
    return y


_digit_cache = {}


def say_digit(word, who):
    key = (word, who)
    if key not in _digit_cache:
        if who == "station":
            a, ph, w = tts.say(word, voice="en+f2", rate=150, pitch=62, prange=0)
        else:
            a, ph, w = tts.say(word, voice="en+m3", rate=300, pitch=28, prange=0)
        a = a.astype(np.float64)
        nz = np.where(np.abs(a) > 0.01)[0]
        a = a[max(nz[0] - 50, 0):nz[-1] + 200] if len(nz) else a
        a = resample_poly(a, 2, 1)
        _digit_cache[key] = a
    return _digit_cache[key]


def numbers_part():
    for ev in S.SPOKEN:
        a = say_digit(ev["text"], ev["who"])
        if ev["who"] == "station":
            y = radio_chain(a, 330, 3200, 2.2)
            nums.add(y, ev["t"], 0.5, -0.1)
            hall_send.add(y, ev["t"], 0.12)
        else:
            y = radio_chain(a, 250, 2400, 4.0)
            tt = np.arange(len(y)) / SR
            y = y * (0.8 + 0.2 * np.sin(2 * np.pi * 9 * tt))
            nums.add(y, ev["t"], 0.5, 0.3)
            hall_send.add(y, ev["t"], 0.3)


# =========================================================== radio weather
def radio_part():
    t = np.arange(NTOT) / SR
    r = np.random.default_rng(11)
    white = r.normal(0, 1, NTOT)
    hiss = Y.bp(white, 300, 7000, 1)
    # crackle: sparse impulses through a short filter
    imp = (r.random(NTOT) < 0.0009) * r.normal(0, 1, NTOT) * 6
    crack = Y.bp(imp, 1000, 9000, 1)
    # QSB: slow fading of the static
    qsb = 0.6 + 0.4 * np.sin(2 * np.pi * 0.11 * t) * np.sin(2 * np.pi * 0.037 * t + 1)
    level = automation(render_data.RADIO_LEVEL)
    st = (hiss * qsb + crack) * level
    radio.add(Y.pan(st, 0), 0, 0.5)
    # heterodyne whistles: slow drifting tones of other stations
    for (a, b, f0, f1, g) in [(0, tb(8), 1650, 820, 0.012), (tb(76), tb(84), 600, 2300, 0.012),
                              (tb(104), tb(112), 900, 1900, 0.01)]:
        i0, i1 = Y.secs(a), Y.secs(b)
        n = i1 - i0
        f = np.geomspace(f0, f1, n) * (1 + 0.01 * np.sin(2 * np.pi * 0.3 * np.arange(n) / SR))
        w = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * np.arange(n) / n) ** 2
        radio.x[:, i0:i1] += Y.pan(w, 0.4) * g * 4
    # mains hum in the empty room before and after
    hum = (np.sin(2 * np.pi * 50 * t) + 0.3 * np.sin(2 * np.pi * 150 * t)) * 0.012
    hl = automation([(0, 1), (tb(8), 0.4), (tb(12), 0), (tb(106), 0), (tb(110), 1), (tb(112), 0), (S.END_T, 0)])
    radio.add(Y.pan(hum * hl, 0), 0)


# =========================================================== master
def limiter(x, ceiling=0.89, release=0.08, look=0.004):
    la = Y.secs(look)
    peak = np.max(np.abs(x), axis=0)
    # running max over the lookahead window
    from scipy.ndimage import maximum_filter1d
    pk = maximum_filter1d(peak, size=2 * la + 1)
    g = np.minimum(1.0, ceiling / np.maximum(pk, 1e-9))
    # smooth: instant attack (already looked ahead), exponential release
    a = 1 - np.exp(-1 / (SR * release))
    g2 = -Y.onepole(-g, a)
    g2 = np.minimum(g2, g)
    sm = np.convolve(g2, np.ones(la) / la, "same")
    return x * np.minimum(sm, g)[None, :]


def glue(x, thresh_db=-16, ratio=2.0, attack=0.02, release=0.25):
    mono = np.sqrt(np.mean(x ** 2, axis=0) + 1e-12)
    a_att = 1 - np.exp(-1 / (SR * attack))
    env = Y.onepole(mono, a_att)
    lvl = 20 * np.log10(env + 1e-9)
    over = np.maximum(lvl - thresh_db, 0)
    gr = -over * (1 - 1 / ratio)
    g = 10 ** (gr / 20)
    g = Y.onepole(g, 1 - np.exp(-1 / (SR * release)))
    return x * g[None, :]


def master():
    log("reverbs")
    plate = Y.make_ir(2.6, 2.1, damp_hz=7000, predelay=0.02, seed=1)
    hall = Y.make_ir(6.5, 5.5, damp_hz=4500, predelay=0.045, seed=2, early=False)
    plate_wet = Y.convolve_stereo(plate_send.x, plate)[:, :NTOT] * 0.33
    hall_wet = Y.convolve_stereo(hall_send.x, hall)[:, :NTOT] * 0.2

    # drum bus: dust (12-bit, a little saturation)
    d = Y.tape(Y.crush(drums.x, 12) * 1.2, 1.3)
    # bridge: the beat gets crushed harder
    br = automation([(0, 0), (tb(72), 0), (tb(72.01), 1), (tb(80), 1), (tb(80.01), 0), (S.END_T, 0)])
    d = d * (1 - br) + Y.crush(d, 7, 3) * br

    vox = lead.x + choir.x
    vox = Y.hp(vox, 140)
    # air: an exciter makes the harmonics the 22 kHz voice never had
    vox = vox + Y.hp(np.tanh(Y.hp(vox, 2500) * 6.0), 6500) * 0.05
    # vocal bus: gentle compression, then a soft clip to round off the pulse-train peaks
    mtr = pyln.Meter(SR)
    vl = mtr.integrated_loudness(vox.T)
    k = 10 ** ((-20 - vl) / 20)
    vox = glue(vox * k, thresh_db=-24, ratio=3.0, attack=0.008, release=0.12)
    pk = np.percentile(np.abs(vox), 99.9)
    vox = np.tanh(vox / (2.2 * pk)) * (2.2 * pk) / k
    log(f"vocal bus {vl:.1f} LUFS, p99.9 {20 * np.log10(pk):.1f} dB")

    db = lambda v: 10 ** (v / 20)
    TRIM = dict(drums=-3.5, bass=-4.0, pads=+6.5, strings=+8.0, guitar=+15.0, musicbox=0.0, theremin=0.0,
                vocals=+1.0, echoes=+5.0, numbers=+4.0, radio=+5.0, plate=+7.0, hall=+12.0)
    stems = dict(drums=d, bass=bass.x, pads=pads.x, strings=strings.x, guitar=gtr.x, musicbox=box.x,
                 theremin=ther.x, vocals=vox, echoes=echo.x, numbers=nums.x, radio=radio.x,
                 plate=plate_wet, hall=hall_wet)
    stems = {k: v * db(TRIM[k]) for k, v in stems.items()}
    mix = sum(stems.values())

    # multipath fading in the bridge: a slow comb sweeping through the music
    t = np.arange(NTOT) / SR
    fade_amt = automation([(0, 0), (tb(74), 0), (tb(78), 0.5), (tb(84), 0.5), (tb(86), 0), (S.END_T, 0)])
    dly = (0.0015 + 0.0012 * np.sin(2 * np.pi * 0.13 * t)) * SR
    idx = np.arange(NTOT) - dly
    comb = np.vstack([np.interp(idx, np.arange(NTOT), mix[c]) for c in range(2)])
    mix = mix * (1 - 0.5 * fade_amt) + comb * 0.5 * fade_amt

    # the radio frame: the song arrives through a narrow AM band and leaves through it
    narrow = Y.bp(mix, 420, 2900, 2) * 1.5
    w = automation([(0, 1), (tb(5), 1), (tb(8), 0), (tb(106), 0), (tb(111), 1), (S.END_T, 1)])
    mix = mix * (1 - w) + narrow * w

    mix = Y.hp(mix, 28, 2)
    # tilt: a little less sub, a little more air
    mix = mix - Y.lp(mix, 70, 1) * 0.3 + Y.hp(mix, 5500, 2) * 0.45
    meter = pyln.Meter(SR)
    # gain staging: bring the mix to -20 LUFS before the glue and the tape
    pre = meter.integrated_loudness(mix.T[:Y.secs(S.TOTAL_BARS * BAR)])
    stage = 10 ** ((-20.0 - pre) / 20)
    mix *= stage
    stems = {k: v * stage for k, v in stems.items()}
    log(f"raw mix {pre:.2f} LUFS")
    mix = glue(mix, thresh_db=-22, ratio=1.8)
    mix = Y.tape(mix * 1.6, 1.3) / 1.6
    lufs = meter.integrated_loudness(mix.T[:Y.secs(S.TOTAL_BARS * BAR)])
    gain = 10 ** ((-14.0 - lufs) / 20)
    log(f"pre-gain loudness {lufs:.2f} LUFS, gain {20 * np.log10(gain):+.2f} dB")
    mix = limiter(mix * gain, 0.89)
    lufs2 = meter.integrated_loudness(mix.T[:Y.secs(S.TOTAL_BARS * BAR)])
    log(f"final loudness {lufs2:.2f} LUFS, peak {20 * np.log10(np.abs(mix).max()):.2f} dBFS")
    # fade the very end
    fe = Y.secs(1.0)
    mix[:, -fe:] *= np.linspace(1, 0, fe)
    return mix, stems, gain


BUSES = [drums, bass, pads, strings, gtr, box, ther, lead, choir, echo, nums, radio, plate_send, hall_send]
CACHE = os.path.join(OUT, "cache")


def main():
    if "--mix" in sys.argv:
        for b in BUSES:
            b.x = np.load(os.path.join(CACHE, b.name + ".npy"))
        VOCAL_SEGMENTS.extend(json.load(open(os.path.join(OUT, "vocal_segments.json"))))
        return finish()
    log("drums"); drums_part()
    log("bass"); bass_part()
    log("pads"); pads_part()
    log("strings"); strings_part()
    log("guitar"); guitar_part()
    log("music box"); musicbox_part()
    log("theremin"); theremin_part()
    log("numbers"); numbers_part()
    log("radio"); radio_part()
    log("vocals"); vocals_part()
    os.makedirs(CACHE, exist_ok=True)
    for b in BUSES:
        np.save(os.path.join(CACHE, b.name + ".npy"), b.x.astype(np.float32))
    with open(os.path.join(OUT, "vocal_segments.json"), "w") as f:
        json.dump(VOCAL_SEGMENTS, f)
    with open(os.path.join(OUT, "hits.json"), "w") as f:
        json.dump(sorted(HITS), f)
    finish()


def finish():
    mix, stems, gain = master()
    sf.write(os.path.join(OUT, "song.wav"), mix.T.astype(np.float32), SR, subtype="FLOAT")
    for k, v in stems.items():
        sf.write(os.path.join(OUT, "stems", k + ".wav"), (v.T * gain).astype(np.float32), SR, subtype="FLOAT")
    log("done")


if __name__ == "__main__":
    main()
