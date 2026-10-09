#!/usr/bin/env python3
"""Wrap freestyle.html (the artifact body) into a standalone index.html."""
from pathlib import Path
here = Path(__file__).parent
body = (here / "freestyle.html").read_text(encoding="utf-8")
html = ('<!doctype html>\n<html lang="nl">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + body.replace("<canvas", "</head>\n<body>\n<canvas", 1) + "\n</body>\n</html>\n")
(here / "index.html").write_text(html, encoding="utf-8")
print("index.html written", len(html), "bytes")
