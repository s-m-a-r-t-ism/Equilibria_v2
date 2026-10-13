"""LONG DELAYED ECHOES — the score.

80 BPM, 4/4. One bar lasts exactly three seconds, the delay Jørgen Hals heard
in 1927 between a signal from Eindhoven and its ghost. So every echo in this
song comes back exactly one bar late.
"""
import cipher

BPM = 80
BEAT = 60.0 / BPM          # 0.75 s
BAR = 4 * BEAT             # 3.0 s
E8 = BEAT / 2              # eighth note, 0.375 s

NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "E#": 5, "F": 5, "F#": 6, "Gb": 6,
        "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}

# ---------------------------------------------------------------- form
SECTIONS = [  # name, first bar, bars, title shown on screen
    ("intro", 0, 8, "CARRIER"),
    ("night", 8, 16, "I · NIGHT BROADCAST"),
    ("verse1", 24, 16, "II · THE WIRE"),
    ("chorus1", 40, 8, "II · THE WIRE"),
    ("verse2", 48, 16, "III · EINDHOVEN, 1927"),
    ("chorus2", 64, 8, "III · EINDHOVEN, 1927"),
    ("bridge", 72, 16, "IV · INTERFERENCE"),
    ("final", 88, 12, "V · ANSWER"),
    ("outro", 100, 12, "END OF TRANSMISSION"),
]
TOTAL_BARS = 112
FINAL_ECHO_T = TOTAL_BARS * BAR + 9.0   # the last long delayed echo, after the silence
END_T = FINAL_ECHO_T + 6.0

# ---------------------------------------------------------------- harmony
# chord symbols -> (bass pitch class, chord tones as pitch classes, name)
CHORDS = {
    "F#m9":    ("F#", ["F#", "A", "C#", "E", "G#"]),
    "Dmaj9":   ("D", ["D", "F#", "A", "C#", "E"]),
    "Bm9":     ("B", ["B", "D", "F#", "A", "C#"]),
    "C#7sus4": ("C#", ["C#", "F#", "G#", "B"]),
    "C#7":     ("C#", ["C#", "E#", "G#", "B"]),
    "C#7b9":   ("C#", ["C#", "E#", "G#", "B", "D"]),
    "Dmaj7":   ("D", ["D", "F#", "A", "C#"]),
    "A/C#":    ("C#", ["A", "C#", "E"]),
    "Bm7":     ("B", ["B", "D", "F#", "A"]),
    "F#m":     ("F#", ["F#", "A", "C#"]),
    "Esus4":   ("E", ["E", "A", "B"]),
    "E":       ("E", ["E", "G#", "B"]),
    "G/F#":    ("F#", ["G", "B", "D"]),
    "Em/F#":   ("F#", ["E", "G", "B"]),
    "F#":      ("F#", ["F#", "A#", "C#"]),
    "F#add9":  ("F#", ["F#", "A#", "C#", "G#"]),
    "Dmaj9/F#": ("F#", ["D", "F#", "A", "C#", "E"]),
    "Badd9/F#": ("F#", ["B", "D#", "F#", "C#"]),
}

VERSE_PROG = [["F#m9"], ["Dmaj9"], ["Bm9"], ["C#7sus4", "C#7"]]
CHORUS_PROG = [["Dmaj7"], ["A/C#"], ["Bm7"], ["F#m"], ["Dmaj7"], ["A/C#"], ["Esus4", "E"], ["E"]]
BRIDGE_PROG = [["F#m"], ["G/F#"], ["F#m"], ["G/F#"], ["F#m"], ["G/F#"], ["F#m"], ["G/F#"],
               ["Em/F#"], ["G/F#"], ["Em/F#"], ["G/F#"], ["Dmaj7"], ["E"], ["F#m"], ["C#7b9"]]
FINAL_PROG = [["Dmaj7"], ["A/C#"], ["Bm7"], ["F#m"], ["Dmaj7"], ["A/C#"], ["C#7sus4", "C#7"], ["F#add9"],
              ["Dmaj7"], ["E"], ["F#add9"], ["F#add9"]]
OUTRO_PROG = [["F#add9"], ["Badd9/F#"], ["F#add9"], ["Badd9/F#"], ["F#add9"], ["Dmaj9/F#"], ["F#add9"],
              ["Dmaj9/F#"], ["F#m9"], ["F#m9"], ["F#m9"], ["F#m9"]]
INTRO_PROG = [["F#m9"]] * 4 + [["Dmaj9"], ["F#m9"], ["Dmaj9"], ["C#7sus4", "C#7"]]

BAR_CHORDS = (INTRO_PROG + VERSE_PROG * 4 + VERSE_PROG * 4 + CHORUS_PROG + VERSE_PROG * 4 + CHORUS_PROG
              + BRIDGE_PROG + FINAL_PROG + OUTRO_PROG)
assert len(BAR_CHORDS) == TOTAL_BARS, len(BAR_CHORDS)


def chord_at(t):
    """Chord symbol sounding at time t (s)."""
    b = int(t // BAR)
    b = min(max(b, 0), TOTAL_BARS - 1)
    cs = BAR_CHORDS[b]
    if len(cs) == 1:
        return cs[0]
    frac = (t - b * BAR) / BAR
    return cs[min(int(frac * len(cs)), len(cs) - 1)]


def pcs(sym):
    bass, tones = CHORDS[sym]
    return NOTE[bass], [NOTE[n] for n in tones]


# ---------------------------------------------------------------- the words
# Each sung line: (section start bar, text for espeak, display text,
#                  [(start in eighths from section start, length in eighths, midi)], echo syllables)
C4, Cs4, D4, E4, Es4, Fs4, G4, Gs4, A4, B4, Cs5 = 60, 61, 62, 64, 65, 66, 67, 68, 69, 71, 73
B3 = 59

RH_A = [(1, 1), (2, 1), (3, 1), (4, 2), (6, 1), (7, 1), (8, 1), (9, 2), (11, 1), (12, 1), (13, 1), (14, 1), (15, 1), (16, 6)]
MEL_A = [Cs4, Cs4, E4, Fs4, E4, Fs4, Gs4, A4, Fs4, E4, Cs4, E4, D4, Cs4]


def L(bar, off8, text, display, rh, mel, echo, choir=0):
    assert len(rh) == len(mel), (text, len(rh), len(mel))
    return dict(bar=bar, text=text, display=display,
                notes=[(bar * BAR + (off8 + s) * E8, l * E8, m) for (s, l), m in zip(rh, mel)],
                echo=echo, choir=choir)


def verse1(b):
    return [
        L(b, 0, "I put a wire up through the frost and sang it to the black",
          "I put a wire up through the frost and sang it to the black", RH_A, MEL_A, 2),
        L(b + 4, 0, "they say the sky's a mirror, love, whatever leaves comes back",
          "They say the sky's a mirror, love: whatever leaves comes back.",
          [(1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1), (7, 1), (8, 2), (10, 1), (11, 1), (12, 1), (13, 2), (15, 1), (16, 6)],
          [Cs4, E4, Cs4, Fs4, E4, A4, Gs4, Fs4, E4, Fs4, E4, Cs4, Cs4, B3], 2),
        L(b + 8, 0, "so every night at three o'clock I read the numbers through",
          "So every night at three o'clock I read the numbers through,", RH_A, MEL_A, 1),
        L(b + 12, 0, "the only words I know of that would never lie to you",
          "the only words I know of that would never lie to you.",
          [(1, 1), (2, 1), (3, 1), (4, 2), (6, 1), (7, 1), (8, 1), (9, 1), (10, 1), (11, 1), (12, 1), (13, 2), (15, 1), (16, 6)],
          [Cs4, E4, Cs4, Fs4, E4, A4, Gs4, Fs4, E4, Fs4, E4, Cs4, B3, Cs4], 2),
    ]


def verse2(b):
    return [
        L(b, 0, "in nineteen twenty seven, a man in Oslo heard",
          "In nineteen twenty-seven, a man in Oslo heard",
          [(1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1), (7, 1), (8, 1), (9, 2), (11, 1), (12, 1), (13, 2), (16, 6)],
          [Cs4, E4, E4, Fs4, E4, Fs4, E4, Gs4, A4, Fs4, E4, D4, Cs4], 1),
        L(b + 4, 0, "a station out of [['eInthoUv@n]], and then again, each word",
          "a station out of Eindhoven, and then again, each word,",
          [(1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1), (7, 1), (8, 1), (9, 1), (10, 1), (11, 1), (12, 2), (14, 2), (16, 6)],
          [Cs4, E4, Cs4, Fs4, E4, A4, Gs4, Fs4, E4, Fs4, E4, Cs4, Cs4, B3], 2),
        L(b + 8, 0, "three seconds late and softer, like the sky had held it close",
          "three seconds late and softer, like the sky had held it close,",
          [(1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1), (7, 1), (8, 1), (9, 1), (10, 2), (12, 1), (13, 2), (15, 1), (16, 6)],
          [Cs4, Cs4, E4, Fs4, E4, Fs4, E4, Gs4, Gs4, A4, Fs4, E4, D4, Cs4], 1),
        L(b + 12, 0, "and handed it back wrong, the way the living keep their ghosts",
          "and handed it back wrong, the way the living keep their ghosts.",
          [(1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 2), (8, 1), (9, 1), (10, 1), (11, 1), (12, 1), (13, 2), (15, 1), (16, 6)],
          [Cs4, E4, Cs4, E4, Fs4, A4, Gs4, Fs4, E4, Fs4, E4, Cs4, B3, Cs4], 2),
    ]


def chorus(b, final=False, choir=2):
    lines = [
        L(b, 0, "I say it to the dark", "I say it to the dark,",
          [(0, 1), (1, 2), (3, 1), (4, 1), (5, 1), (6, 3)], [A4, A4, Fs4, A4, B4, Cs5], 2, choir),
        L(b, 0, "and it comes back changed", "and it comes back changed.",
          [(16, 1), (17, 1), (18, 2), (20, 2), (22, 5)], [B4, A4, A4, Fs4, Fs4], 2, choir),
        L(b, 0, "three seconds later, over the water", "Three seconds later, over the water:",
          [(32, 1), (33, 1), (34, 1), (35, 1), (36, 1), (37, 1), (38, 1), (39, 1), (40, 2), (42, 2)],
          [Cs4, E4, Fs4, A4, Gs4, Fs4, E4, Fs4, A4, E4], 0, choir),
    ]
    if not final:
        lines.append(L(b, 0, "my own voice, saying your name", "my own voice, saying your name.",
                       [(45, 1), (46, 1), (47, 2), (49, 1), (50, 1), (51, 1), (52, 6)],
                       [Cs4, E4, Fs4, Gs4, Fs4, E4, E4], 2, choir))
    else:
        lines.append(L(b, 0, "your own voice, saying my name", "your own voice, saying my name.",
                       [(45, 1), (46, 1), (47, 3), (50, 1), (51, 1), (52, 2), (56, 8)],
                       [Cs4, E4, Fs4, Gs4, Fs4, Es4, Fs4], 2, 3))
        lines.append(L(b, 0, "saying my name", "Saying my name.",
                       [(64, 1), (65, 1), (66, 2), (68, 6)], [Cs5, B4, A4, A4], 2, 3))
        lines.append(L(b, 0, "saying my name", "Saying my name.",
                       [(80, 1), (81, 1), (82, 2), (84, 10)], [Gs4, Fs4, Es4, Fs4], 2, 3))
    return lines


def bridge(b):
    return [
        L(b, 0, "maybe it's the weather in the upper air", "Maybe it's the weather in the upper air,",
          [(1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1), (7, 1), (8, 1), (9, 2), (11, 1), (12, 4)],
          [Cs4, Cs4, Cs4, D4, E4, D4, Cs4, Cs4, G4, Fs4, D4], 3),
        L(b, 0, "maybe only me, come round the world too late", "maybe only me, come round the world too late.",
          [(33, 1), (34, 1), (35, 1), (36, 1), (37, 2), (39, 1), (40, 1), (41, 1), (42, 2), (44, 1), (45, 3)],
          [Cs4, Cs4, E4, Cs4, Fs4, E4, G4, Fs4, D4, E4, D4], 2),
        L(b, 0, "so I am answering", "So I am answering,",
          [(97, 1), (98, 1), (99, 1), (100, 2), (102, 1), (103, 3)], [Cs4, E4, Fs4, A4, Gs4, Fs4], 0, 1),
        L(b, 0, "I am answering", "I am answering,",
          [(106, 1), (107, 1), (108, 2), (110, 1), (111, 3)], [Fs4, A4, B4, A4, Gs4], 0, 2),
        L(b, 0, "I am answering", "I am answering.",
          [(114, 1), (115, 1), (116, 2), (118, 1), (119, 5)], [A4, B4, Cs5, B4, A4], 2, 3),
    ]


def with_choir(lines, level):
    for ln in lines:
        ln["choir"] = level
    return lines


LINES = verse1(24) + chorus(40) + with_choir(verse2(48), 1) + chorus(64) + bridge(72) + chorus(88, final=True)

# ---------------------------------------------------------------- the numbers
NIGHT_TEXT = "THIS IS THE NIGHT BROADCAST. DO NOT ANSWER. JUST LISTEN."
ANSWER_TEXT = "IF YOU CAN HEAR THIS, ANSWER."
NIGHT = cipher.make_message(NIGHT_TEXT, 1927)
ANSWER = cipher.make_message(ANSWER_TEXT, 3)
DIGIT_WORD = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five",
              "6": "six", "7": "seven", "8": "eight", "9": "nine"}


def spoken():
    """Every spoken (not sung) event: dict(t, text, voice, kind, ...)."""
    ev = []
    # ident, intro
    for bar in (2, 5):
        ev.append(dict(t=bar * BAR + 0.0, text="Attention.", who="station", kind="word"))
        for i, d in enumerate("1927"):
            ev.append(dict(t=bar * BAR + BEAT * 2 + i * E8 * 2, text=DIGIT_WORD[d], digit=d, who="station",
                           kind="ident"))
    # night broadcast: one 5-digit group per bar, digits on eighths
    ev.append(dict(t=8 * BAR, text="Attention.", who="station", kind="word"))
    for i, d in enumerate("1927"):
        ev.append(dict(t=9 * BAR + i * E8, text=DIGIT_WORD[d], digit=d, who="station", kind="ident"))
    for g, grp in enumerate(NIGHT["groups"]):
        for i, d in enumerate(grp):
            ev.append(dict(t=(10 + g) * BAR + i * E8, text=DIGIT_WORD[d], digit=d, who="station", kind="cipher",
                           msg="night", idx=g * 5 + i))
    # the answer: faster, sixteenths, a different voice, half a bar per group
    for g, grp in enumerate(ANSWER["groups"]):
        for i, d in enumerate(grp):
            ev.append(dict(t=80 * BAR + g * BAR / 2 + i * E8 / 2, text=DIGIT_WORD[d], digit=d, who="answer",
                           kind="cipher", msg="answer", idx=g * 5 + i))
    # sign-off
    ev.append(dict(t=104 * BAR, text="End of transmission.", who="station", kind="word"))
    for i, d in enumerate("1927"):
        ev.append(dict(t=105 * BAR + BEAT * 2 + i * E8 * 2, text=DIGIT_WORD[d], digit=d, who="station", kind="ident"))
    return ev


SPOKEN = spoken()

# the interval signal (music box), a two-bar phrase in eighths: (start8, len8, midi)
INTERVAL = [(0, 2, 73), (2, 2, 78), (4, 2, 81), (6, 1, 80), (7, 1, 78), (8, 2, 76), (10, 2, 78), (12, 4, 73)]
INTERVAL_BARS = [0, 2, 4, 6, 22, 100, 102, 106, 108]
