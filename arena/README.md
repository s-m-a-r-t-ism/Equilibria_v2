# An Arena in Which to Act

Six playable rooms after the New York School, 1943 to 1970. Each room is a working
simulation of one way of making a picture, ordered from the most movement to none.
The title is from Harold Rosenberg's 1952 essay "The American Action Painters".

| | Room | After | What happens |
|---|---|---|---|
| I | **Floor** | Jackson Pollock, Janet Sobel | Enamel falls from a stick onto canvas on a barn floor. Ballistic fall, liquid-rope coiling when the hand is slower than the thread, Rayleigh-Plateau break-up of thin threads into drops, inertial flicks, drying gloss, aluminium paint. The canvas is measured by box-counting for its fractal dimension and compared with the values Taylor et al. reported for Pollock. A ghost painter walks a Lévy flight. New canvases go down on the same floor, which keeps everything. |
| II | **Opticon** | Franz Kline | Brush-sketch on a generated page of the 1949 Manhattan telephone directory. An opaque projector throws a detail of it onto the wall about twenty times larger. "Paint it" repaints that detail at full size with a house painter's brush that runs dry. |
| III | **Stain** | Helen Frankenthaler, Morris Louis | Thinned paint poured onto raw duck, steered by lifting the canvas. GPU shallow-water (virtual pipe) model with absorption, pigment transport and deposition. Oil leaves a solvent halo; acrylic does not. |
| IV | **Field** | Mark Rothko | Soft glazed rectangles in a dim room. Walk up to eighteen inches. Drag edges, add glazes. While you stay, the palette ages from 1949 to the black-on-grey paintings of 1969. Each field sings a chord tone chosen from its colour. |
| V | **Zip** | Barnett Newman | A field divided by zips, and also a monochord: the full width sounds a low A, every zip is a bridge, every part sounds at the pitch its width gives it. Zips snap to simple fractions and the intervals are pencilled under the canvas. |
| VI | **Black** | Ad Reinhardt | Nine near-black squares. Hold still and the display imitates dark adaptation: gain rises, the Purkinje shift moves colour toward blue-green, the eye's grain appears, and the cross comes up. Every movement shows the next of Reinhardt's twelve rules and starts again. |

Press **Hang** in any room and the picture joins **Your Exhibition**, with a museum label written from what
happened on the canvas (time, thread length, drops, fractal dimension, tilt, distance, intervals) and an
imagined review. The exhibition can be walked through one picture at a time. The lobby takes paint too.

## Running it

Plain HTML, CSS and ES modules, no build step and no libraries. Serve the folder over HTTP
(modules do not load from `file://`):

```
cd arena
python3 -m http.server 8000
# open http://localhost:8000/
```

Needs WebGL2 with renderable float textures (any recent desktop browser, most phones). Sound starts on the
first click; headphones help.

## Files

- `index.html`: lobby, exhibition, room chrome, styles
- `js/main.js`: routing, room shell, hanging, catalogue, the lobby's drip
- `js/gl.js`: a small WebGL2 toolkit
- `js/audio.js`: shared audio bus, reverb, noise, Karplus-Strong plucks
- `js/fractal.js`: box-counting dimension
- `js/labels.js`: titles, labels and imagined reviews
- `js/rooms/*.js`: one file per room

## Sources

Each room's wall text lists its sources. In short: Pollock, "My Painting" (1947); Taylor, Micolich and
Jonas, Nature 399 (1999), and the critique by Jones-Smith and Mathur, Nature 444 (2006); Herczyński,
Cernuschi and Mahadevan, Physics Today (2011); Elaine de Kooning on Kline, ARTnews (1962); Curtis et al.,
"Computer-Generated Watercolor" (1997); Rothko at MoMA (1951); Newman, "The Sublime Is Now" (1948);
Reinhardt, "Twelve Rules for a New Academy" (1957); Cage, Silence (1961).
