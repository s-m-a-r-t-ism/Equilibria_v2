"""Loudness of every stem in every section (LUFS), to balance the mix without ears."""
import sys, os, glob
import numpy as np, soundfile as sf, pyloudnorm as pyln
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import score as S
build = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "build")
m = pyln.Meter(44100)
stems = {os.path.basename(f)[:-4]: sf.read(f)[0] for f in sorted(glob.glob(os.path.join(build, "stems", "*.wav")))}
song = sf.read(os.path.join(build, "song.wav"))[0]
names = list(stems)
print("section     " + " ".join(f"{n[:7]:>7s}" for n in names) + "    SONG")
for nm, b, c, _ in S.SECTIONS:
    a, z = int(b * S.BAR * 44100), int((b + c) * S.BAR * 44100)
    row = []
    for n in names:
        try:
            l = m.integrated_loudness(stems[n][a:z])
        except Exception:
            l = -99
        row.append(l if np.isfinite(l) else -99)
    ls = m.integrated_loudness(song[a:z])
    print(f"{nm:10s} " + " ".join(f"{v:7.1f}" for v in row) + f"  {ls:6.1f}")
