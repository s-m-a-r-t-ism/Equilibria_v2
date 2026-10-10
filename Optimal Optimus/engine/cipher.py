"""A real numbers-station cipher: straddling checkerboard + one-time pad.

The eight most common letters take one digit, the rest take two (prefixed by
2 or 6). The digit stream is added, digit by digit without carry, to a key
(the pad). What the voice reads is the result. What the screen shows is the
reverse: cipher - key = stream, stream -> letters.
"""
import numpy as np

TOP = {"A": "0", "T": "1", "O": "3", "N": "4", "E": "5", "S": "7", "I": "8", "R": "9"}
ROW2 = "BCDFGHJKLM"
ROW6 = "PQUVWXYZ./"


def encode_letters(text):
    """Return list of (letter, digits) for the letters of text (spaces and punctuation dropped,
    except the full stop which has its own code)."""
    out = []
    for ch in text.upper():
        if ch in TOP:
            out.append((ch, TOP[ch]))
        elif ch in ROW2:
            out.append((ch, "2" + str(ROW2.index(ch))))
        elif ch in ROW6 and ch != "/":
            out.append((ch, "6" + str(ROW6.index(ch))))
    return out


def decode_stream(digits):
    rev = {v: k for k, v in TOP.items()}
    out, i = [], 0
    while i < len(digits):
        d = digits[i]
        if d in rev:
            out.append(rev[d]); i += 1
        elif d == "2" and i + 1 < len(digits):
            out.append(ROW2[int(digits[i + 1])]); i += 2
        elif d == "6" and i + 1 < len(digits):
            out.append(ROW6[int(digits[i + 1])]); i += 2
        else:
            i += 1
    return "".join(out)


def make_message(text, seed, pad_to=5):
    """Encrypt text. Returns dict with plain stream, key, cipher (strings of digits),
    letters with their digit spans, and the 5-digit groups of the cipher."""
    letters = encode_letters(text)
    stream = "".join(d for _, d in letters)
    # pad with nulls (a run of the code for '.') to a whole group
    while len(stream) % pad_to:
        stream += "68"[len(stream) % 2]
    rng = np.random.default_rng(seed)
    key = "".join(str(d) for d in rng.integers(0, 10, len(stream)))
    cipher = "".join(str((int(a) + int(b)) % 10) for a, b in zip(stream, key))
    spans, i = [], 0
    for ch, d in letters:
        spans.append((ch, i, i + len(d)))
        i += len(d)
    groups = [cipher[i:i + 5] for i in range(0, len(cipher), 5)]
    assert decode_stream("".join(str((int(c) - int(k)) % 10) for c, k in zip(cipher, key))).startswith(
        "".join(ch for ch, _ in letters))
    return dict(text=text, stream=stream, key=key, cipher=cipher, groups=groups, spans=spans)


if __name__ == "__main__":
    for t in ["THIS IS THE NIGHT BROADCAST. DO NOT ANSWER. JUST LISTEN.", "IF YOU CAN HEAR THIS, ANSWER."]:
        m = make_message(t, 1927)
        print(len(m["cipher"]), len(m["groups"]), m["groups"])
