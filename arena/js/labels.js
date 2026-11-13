// Museum labels and imagined reviews, written from what happened on the canvas.

const pick = (arr, r = Math.random()) => arr[Math.floor(r * arr.length) % arr.length];

export function year() { return String(new Date().getFullYear()); }

export function fmtTime(s) {
  s = Math.round(s);
  const m = Math.floor(s / 60), r = s % 60;
  return m ? `${m} min ${r} s` : `${r} s`;
}

export const ARTIST = { artist: 'You', born: 'unknown' };

const NOUNS_FLOOR = ['Mist', 'Rhythm', 'Fathom', 'Totem', 'Comet', 'Constellation', 'Weather', 'Undertow', 'Lattice', 'Static', 'Tide', 'Thicket', 'Swarm', 'Night Shift'];
export function floorTitle(n, colorNames) {
  const c = colorNames[0] || 'Black';
  return `Number ${n} (${c} ${pick(NOUNS_FLOOR)})`;
}

export function floorReview(s) {
  const D = s.D;
  const g = [];
  if (D == null) g.push('There is hardly a picture here yet, which may be the most honest thing on the wall.');
  else if (D < 1.25) g.push('Sparse, almost calligraphic. The canvas is still mostly canvas, and the lines know it.');
  else if (D < 1.45) g.push('The lines have begun to talk over one another. Not yet all-over, but no longer a drawing.');
  else if (D < 1.65) g.push('All-over in the proper sense: no centre, no edge that matters, the eye kept moving like a man looking for his keys.');
  else if (D < 1.8) g.push('Dense to the point of weather. The picture plane holds, but only just.');
  else g.push('So dense it closes like a lid. Somewhere under there, a better picture was smothered.');
  if (s.flicks > 6) g.push('The flung passages have real violence in them.');
  if (s.coils > 0.45) g.push('Too many lazy loops: the hand slowed down and the paint started doing the thinking.');
  else if (s.coils < 0.12 && s.thread > 20) g.push('The hand never once let the paint coil. That is speed, or nerve.');
  if (s.metal > 0.15) g.push('The aluminium catches the light the way a road does at night.');
  const who = D != null && D >= 1.45 ? 'A formalist, imagined' : 'An existentialist, imagined';
  return { who, text: g.slice(0, 2).join(' ') };
}

const STAIN_A = ['Harbour', 'Bay', 'Orchard', 'Shoal', 'Ladder', 'Coast', 'Marsh', 'Garden', 'Ferry', 'Window', 'Dune', 'Fog'];
const STAIN_B = ['Wind', 'Morning', 'Weather', 'Salt', 'Smoke', 'Pears', 'Lanterns', 'August', 'Rain', 'Swimmers'];
const GREEK = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Pi', 'Rho', 'Sigma', 'Tau', 'Phi', 'Chi', 'Psi', 'Omega'];
export function stainTitle(n, s) {
  if (s.veil) return `Veil: ${pick(GREEK)}-${pick(GREEK)}`;
  return `${pick(STAIN_A)} and ${pick(STAIN_B)}`;
}
export function stainReview(s) {
  const t = [];
  if (s.medium === 'oil') t.push('The oil has thrown a pale halo round every pour, a ghost of the turpentine that went further than the colour did. Conservators will hate it. It is the best thing in the picture.');
  else t.push('Acrylic keeps the edges clean: the colour sits in the weave and goes no further than it is told.');
  if (s.tiltMax > 12) t.push('The canvas was clearly lifted and steered; gravity is credited as a collaborator.');
  else t.push('Poured and left alone, which takes more patience than it looks.');
  return { who: 'A critic who prefers the floor to the easel, imagined', text: t.join(' ') };
}

export function fieldTitle(n, names, yr) {
  if (names.length >= 3) return `No. ${n} (${names[0]} and ${names[1]} on ${names[2]})`;
  if (names.length === 2) return `No. ${n} (${names[0]} on ${names[1]})`;
  return `No. ${n}`;
}
export function fieldReview(s) {
  const t = [];
  if (s.closest > 0.85) t.push('Seen, correctly, from very close. At that distance it stops being a picture of anything and becomes a room you are in.');
  else t.push('Seen from across the room, it behaves; come closer and it will not.');
  if (s.yearReached >= 1968) t.push('The palette has gone the way the late work went, toward maroon, toward brown, toward the dark.');
  else if (s.yearReached <= 1952) t.push('Still the warm years: oranges that seem lit from behind.');
  return { who: 'A visitor who sat on the bench too long, imagined', text: t.join(' ') };
}

const LATIN = ['Onement', 'Chorda', 'Monochordum', 'Sublimis', 'Cathedra Minor', 'Vox', 'Intervallum', 'Unitas'];
export function zipTitle(n, zips, ratioName) {
  if (zips === 1) return `Onement ${toRoman(n)}`;
  if (zips === 0) return `The Field Alone ${toRoman(n)}`;
  return `${pick(LATIN.slice(1))} ${toRoman(n)}${ratioName ? ` (${ratioName})` : ''}`;
}
export function zipReview(s) {
  const t = [];
  if (s.just > 0) t.push(`${s.just === 1 ? 'One division lands' : s.just + ' divisions land'} on a just ratio; the picture can be tuned like a cello.`);
  else t.push('Not one division is in tune with another. The field is all the louder for it.');
  t.push(s.zips <= 1 ? 'A single zip, and the whole field has to decide which side it is on.' : 'The zips do not divide the field so much as make it audible.');
  return { who: 'A guard at the Stedelijk, imagined', text: t.join(' ') };
}

export function toRoman(n) {
  const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '', k = Math.max(1, Math.min(39, n | 0));
  for (const [v, r] of map) while (k >= v) { s += r; k -= v; }
  return s;
}

// Rough colour naming from RGB (0..1), in a painter's vocabulary.
export function colorName(rgb) {
  const [r, g, b] = rgb;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2, d = mx - mn;
  const s = d < 1e-4 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d > 1e-4) {
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  if (l < 0.09) return 'Black';
  if (s < 0.14) return l > 0.82 ? 'White' : l > 0.55 ? 'Grey' : l > 0.3 ? 'Slate' : 'Black';
  if (h < 14 || h >= 345) return l < 0.3 ? 'Maroon' : l > 0.7 ? 'Rose' : 'Red';
  if (h < 38) return l < 0.3 ? 'Brown' : l > 0.7 ? 'Peach' : 'Orange';
  if (h < 52) return l < 0.35 ? 'Umber' : 'Ochre';
  if (h < 68) return 'Yellow';
  if (h < 160) return l < 0.3 ? 'Dark Green' : 'Green';
  if (h < 200) return 'Teal';
  if (h < 250) return l < 0.3 ? 'Ultramarine' : 'Blue';
  if (h < 290) return 'Violet';
  return l < 0.35 ? 'Plum' : 'Magenta';
}
