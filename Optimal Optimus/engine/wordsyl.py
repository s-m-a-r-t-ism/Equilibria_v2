"""Syllables per displayed word, as espeak would sing them (to time the words on screen)."""
import re
import tts

OVERRIDE = {"twenty-seven,": 4}


def syllables_per_word(display):
    out = []
    for w in display.split():
        if w in OVERRIDE:
            out.append(OVERRIDE[w]); continue
        clean = re.sub(r"[^A-Za-z']", "", w)
        a, ph, _ = tts.say(clean, rate=165, pitch=45, prange=20)
        out.append(max(1, len(tts.vowels(ph))))
    return out


if __name__ == "__main__":
    import score
    for l in score.LINES:
        c = syllables_per_word(l["display"])
        flag = "OK " if sum(c) == len(l["notes"]) else "BAD"
        print(flag, sum(c), len(l["notes"]), c, l["display"])
