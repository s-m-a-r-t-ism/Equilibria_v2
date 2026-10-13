"""Write the timeline the web page reads: everything you see is scheduled from it.

python3 export.py ../build/timeline.json
"""
import json, os, sys
import score as S
from wordsyl import syllables_per_word
import render_data


def main(out):
    build = os.path.dirname(out)
    lines = []
    for i, ln in enumerate(S.LINES):
        counts = syllables_per_word(ln["display"])
        assert sum(counts) == len(ln["notes"]), ln["display"]
        words, k = [], 0
        for w, c in zip(ln["display"].split(), counts):
            ns = ln["notes"][k:k + c]
            words.append(dict(w=w, t=round(ns[0][0], 3), d=round(ns[-1][0] + ns[-1][1] - ns[0][0], 3),
                              m=[n[2] for n in ns]))
            k += c
        # which words come back as the echo (those holding the last `echo` syllables)
        ew, need = [], ln["echo"]
        for wd in reversed(words):
            if need <= 0:
                break
            ew.insert(0, wd["w"])
            need -= len(wd["m"])
        lines.append(dict(i=i, t0=round(ln["notes"][0][0], 3),
                          t1=round(ln["notes"][-1][0] + ln["notes"][-1][1], 3),
                          words=words, echo=ew, choir=ln["choir"],
                          notes=[[round(a, 3), round(b, 3), m] for a, b, m in ln["notes"]]))
    msg = lambda m: dict(text=m["text"], cipher=m["cipher"], key=m["key"], stream=m["stream"],
                         spans=m["spans"], groups=m["groups"])
    tl = dict(
        title="Long Delayed Echoes",
        bpm=S.BPM, bar=S.BAR, beat=S.BEAT, total_bars=S.TOTAL_BARS,
        song_end=S.TOTAL_BARS * S.BAR, final_echo=S.FINAL_ECHO_T, end=S.END_T,
        sections=[dict(name=n, bar=b, bars=c, title=ti, t0=b * S.BAR, t1=(b + c) * S.BAR) for n, b, c, ti in S.SECTIONS],
        chords=[[[sym, S.pcs(sym)[0], S.pcs(sym)[1]] for sym in cs] for cs in S.BAR_CHORDS],
        lines=lines,
        spoken=[{k: (round(v, 3) if isinstance(v, float) else v) for k, v in e.items()} for e in S.SPOKEN],
        messages=dict(night=msg(S.NIGHT), answer=msg(S.ANSWER)),
        interval=[[round(b * S.BAR + s * S.E8, 3), round(l * S.E8, 3), m] for b in S.INTERVAL_BARS for s, l, m in S.INTERVAL],
        theremin=[[round(b * S.BAR + s * S.E8, 3), round(l * S.E8, 3), m] for b, s, l, m in render_data.THER_NOTES],
        hits=json.load(open(os.path.join(build, "hits.json"))) if os.path.exists(os.path.join(build, "hits.json")) else [],
        radio=render_data.RADIO_LEVEL,
    )
    with open(out, "w") as f:
        json.dump(tl, f, separators=(",", ":"))
    print("timeline", out, os.path.getsize(out), "bytes")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "build", "timeline.json"))
