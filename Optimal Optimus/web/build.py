#!/usr/bin/env python3
"""Assemble the page: inline the fonts and the timeline.

Writes  ../site/index.html     (standalone, open it next to site/media/)
        ../site/artifact.html  (the same page without the document skeleton)
"""
import base64, json, os, sys
from pathlib import Path

here = Path(__file__).parent
root = here.parent
site = root / "site"
site.mkdir(exist_ok=True)
fonts_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else here / "fonts"
timeline = root / "build" / "timeline.json"

FACES = [
    ("Instrument Serif", 400, "normal", "instrument-serif-latin-400-normal.woff2"),
    ("Instrument Serif", 400, "italic", "instrument-serif-latin-400-italic.woff2"),
    ("IBM Plex Mono", 400, "normal", "ibm-plex-mono-latin-400-normal.woff2"),
    ("IBM Plex Mono", 500, "normal", "ibm-plex-mono-latin-500-normal.woff2"),
]
css = []
for fam, w, st, fn in FACES:
    b64 = base64.b64encode((fonts_dir / fn).read_bytes()).decode()
    css.append(f'@font-face{{font-family:"{fam}";font-style:{st};font-weight:{w};font-display:block;'
               f'src:url(data:font/woff2;base64,{b64}) format("woff2")}}')

body = (here / "page.html").read_text(encoding="utf-8")
tl = json.loads(timeline.read_text())
body = body.replace("/*FONTS*/", "\n".join(css), 1)
body = body.replace("/*TIMELINE*/null", json.dumps(tl, separators=(",", ":")), 1)
(site / "artifact.html").write_text(body, encoding="utf-8")
html = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + body.replace('<div id="stage">', '</head>\n<body>\n<div id="stage">', 1) + "\n</body>\n</html>\n")
(site / "index.html").write_text(html, encoding="utf-8")
poster = (here / "poster.html").read_text(encoding="utf-8").replace("/*FONTS*/", "\n".join(css), 1)
(root / "build" / "poster.html").write_text(poster, encoding="utf-8")
print("site/index.html", len(html), "bytes")
