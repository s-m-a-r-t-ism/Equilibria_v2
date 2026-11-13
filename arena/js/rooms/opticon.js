// II. OPTICON: a quick brush sketch on a page torn from the Manhattan telephone directory,
// thrown up on the wall by an opaque projector until the stroke is the size of a man.
// Then painted, big, with a house painter's brush.

import { audio, loopNoise, tick, thump } from '../audio.js';
import { year, ARTIST } from '../labels.js';

export const meta = {
  id: 'opticon',
  numeral: 'II',
  name: 'Opticon',
  after: 'After Franz Kline',
  place: 'Willem de Kooning’s studio, 1949',
  years: '1949–1962',
  swatch: 'linear-gradient(90deg,#efebe2 0 14%,#121110 14% 36%,#efebe2 36% 44%,#121110 44% 52%,#efebe2 52% 76%,#121110 76%)',
  lede: 'Make a small brush sketch on a page of the 1949 Manhattan phone book. An opaque projector throws it onto the wall, twenty times larger. Pick the detail you like, then paint it at that size.',
  level: 0.9,
  wet: 0.3,
  freshLabel: 'New page',
  wall: `
    <blockquote>I paint the white as well as the black, and the white is just as important.<cite>Franz Kline, in conversation with Katharine Kuh, 1962</cite></blockquote>
    <p>For years Franz Kline made small, fast brush drawings in black ink on whatever paper was cheap: newsprint, and the pages of telephone directories. The story, told by Elaine de Kooning among others, is that in 1949 he put some of them into Willem de Kooning’s Bell-Opticon, an opaque projector that throws an image of a flat page onto a wall. Blown up, a stroke a few centimetres long became a beam of black two metres across, with every hesitation of the hand enlarged with it.</p>
    <p>From then on he painted big, with house painters’ brushes and cheap enamel, black and white. The pictures look instantaneous. Many were worked for weeks, the whites painted over the blacks and back again.</p>
    <h3>The directory</h3>
    <p>The page here is generated, but it follows the layout of a Manhattan directory of the late 1940s: surname first, first names abbreviated (Saml, Wm, Jas), occupation, street address, and an exchange name before the number. Exchanges were words, so you dialled the first two letters: GRamercy 5, MUrray Hill 4, BUtterfield 8. The exchange names here come from Manhattan numbers of the period.</p>
    <h3>Controls</h3>
    <dl>
      <dt>Draw on the page</dt><dd>a brush loaded with ink; it runs dry as it goes</dd>
      <dt>Black, White</dt><dd>ink, or white gouache to cut back into the black</dd>
      <dt>Wheel or drag on the wall</dt><dd>choose the detail the projector enlarges</dd>
      <dt>Paint it</dt><dd>paint the projected detail onto canvas at full size</dd>
    </dl>
    <p class="src">Sources: Elaine de Kooning, “Franz Kline: Painter of His Own Life”, ARTnews (November 1962); Katharine Kuh, The Artist’s Voice (1962); Harry F. Gaugh, The Vital Gesture: Franz Kline (1985).</p>
  `,
};

/* ---------------- the page ---------------- */
const EXCH = ['ALgonquin', 'BArclay', 'BEekman', 'BOwling Green', 'BRyant', 'BUtterfield', 'CAnal', 'CHelsea', 'CIrcle', 'COlumbus', 'CORtlandt', 'DIgby', 'ELdorado', 'GRamercy', 'LAckawanna', 'LEhigh', 'LExington', 'LOngacre', 'MUrray Hill', 'ORchard', 'PEnnsylvania', 'PLaza', 'REgent', 'RHinelander', 'SChuyler', 'SPring', 'STuyvesant', 'TRafalgar', 'UNiversity', 'WAtkins', 'WIsconsin', 'WOrth'];
const SURN = {
  B: ['Baer', 'Bagnoli', 'Baker', 'Baldwin', 'Bamberger', 'Baptiste', 'Barbieri', 'Barone', 'Barrett', 'Baum', 'Becker', 'Bellini', 'Berger', 'Berkowitz', 'Bernstein', 'Bianco', 'Birnbaum', 'Blum', 'Bonnano', 'Boyle', 'Brady', 'Braun'],
  C: ['Cabrera', 'Cafiero', 'Cahill', 'Calabrese', 'Callahan', 'Caputo', 'Carbone', 'Carey', 'Caruso', 'Casey', 'Castro', 'Chang', 'Chen', 'Cohen', 'Colon', 'Conlon', 'Connelly', 'Conti', 'Corbett', 'Costa', 'Cruz'],
  G: ['Gaffney', 'Galante', 'Gallagher', 'Garcia', 'Gardner', 'Geller', 'Gerber', 'Giordano', 'Glass', 'Gold', 'Goldberg', 'Goldfarb', 'Goldstein', 'Gomez', 'Gordon', 'Grady', 'Greco', 'Green', 'Greenbaum', 'Grossman', 'Gutierrez'],
  K: ['Kahn', 'Kalish', 'Kane', 'Kaplan', 'Katz', 'Kaufman', 'Keane', 'Keller', 'Kelly', 'Kennedy', 'Kessler', 'Klein', 'Kline', 'Koch', 'Kohn', 'Kovacs', 'Kowalski', 'Kramer', 'Kraus', 'Kuhn'],
  M: ['Mack', 'Madden', 'Maggio', 'Maher', 'Malone', 'Mancuso', 'Marino', 'Martin', 'Martinez', 'Mazur', 'McCarthy', 'McGrath', 'Mendez', 'Meyer', 'Miller', 'Molina', 'Moran', 'Moretti', 'Morris', 'Murphy'],
  R: ['Rabinowitz', 'Ramirez', 'Ramos', 'Reilly', 'Reiss', 'Ricci', 'Rios', 'Rivera', 'Rizzo', 'Rocco', 'Rodriguez', 'Romano', 'Rosen', 'Rosenberg', 'Rossi', 'Roth', 'Rubin', 'Russo', 'Ryan'],
  S: ['Sachs', 'Salerno', 'Salinas', 'Sanchez', 'Santoro', 'Schaefer', 'Schneider', 'Schwartz', 'Scott', 'Segal', 'Shapiro', 'Shea', 'Siegel', 'Silver', 'Silverman', 'Smith', 'Sobel', 'Spector', 'Stein', 'Sullivan'],
};
const FIRST = ['Abr', 'Albt', 'Alex', 'Benj', 'Bernard', 'Chas', 'Dan', 'Dominick', 'Edw', 'Esther', 'Frank', 'Fredk', 'Geo', 'Harry', 'Hy', 'Irving', 'Isidore', 'Jas', 'Jno', 'Jos', 'Julius', 'Leo', 'Louis', 'Max', 'Michl', 'Morris', 'Nathan', 'Pasquale', 'Patk', 'Rose', 'Ruth', 'Saml', 'Sol', 'Thos', 'Vincent', 'Wm'];
const OCC = ['', '', '', '', 'atty', 'furs', 'tailor', 'dentist', 'phys', 'plmbr', 'rest', 'drgst', 'dry gds', 'bkr', 'barber', 'grocer', 'jeweler', 'printer', 'importer', 'cleaners', 'hats', 'shoes', 'acct', 'electrn', 'ins', 'real est'];
const STREET = () => {
  const r = Math.random();
  if (r < 0.45) return `${1 + Math.floor(Math.random() * 540)} ${Math.random() < 0.5 ? 'W' : 'E'} ${1 + Math.floor(Math.random() * 120)}`;
  if (r < 0.75) return `${1 + Math.floor(Math.random() * 1400)} ${['1 Av', '2 Av', '3 Av', 'Lex Av', 'Mad Av', '5 Av', 'Amst Av', 'Col Av', 'B\'way', '7 Av', '8 Av'][Math.floor(Math.random() * 11)]}`;
  return `${1 + Math.floor(Math.random() * 200)} ${['Grand', 'Delancey', 'Orchard', 'Mulberry', 'Bleecker', 'Christopher', 'Hester', 'Canal', 'Houston', 'Ludlow', 'Rivngtn', 'Bway'][Math.floor(Math.random() * 12)]}`;
};

function makePage(W, H) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  // cheap, slightly yellowed directory paper
  x.fillStyle = '#e9e1cc'; x.fillRect(0, 0, W, H);
  const img = x.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n * 0.8;
  }
  x.putImageData(img, 0, 0);
  // foxing near the edges
  const g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(160,130,70,0)'); g.addColorStop(1, 'rgba(160,120,60,0.22)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);

  const letters = Object.keys(SURN);
  const L = letters[Math.floor(Math.random() * letters.length)];
  const pool = SURN[L];
  const startIdx = Math.floor(Math.random() * Math.max(1, pool.length - 8));
  const entries = [];
  const order = letters.slice(letters.indexOf(L)).concat(letters.slice(0, letters.indexOf(L)));
  const names = order.flatMap((l, li) => (li === 0 ? SURN[l].slice(startIdx) : SURN[l]));
  for (let k = 0; k < names.length && entries.length < 420; k++) {
    const nPeople = 3 + Math.floor(Math.random() * 12);
    const firsts = [...FIRST].sort(() => Math.random() - 0.5).slice(0, nPeople).sort();
    for (const f of firsts) {
      const occ = OCC[Math.floor(Math.random() * OCC.length)];
      const ex = EXCH[Math.floor(Math.random() * EXCH.length)];
      const num = `${2 + Math.floor(Math.random() * 8)}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
      entries.push({ name: `${names[k]} ${f}${occ ? ' ' + occ : ''} ${STREET()}`, num: `${ex} ${num}` });
    }
  }
  const first = entries[0]?.name.split(' ')[0] || 'A', last = entries[entries.length - 1]?.name.split(' ')[0] || 'Z';
  const pageNo = 300 + Math.floor(Math.random() * 1400);
  const m = W * 0.06;
  x.fillStyle = '#1d1a16';
  x.font = `700 ${Math.round(W * 0.022)}px "Archivo", "Helvetica Neue", Arial, sans-serif`;
  x.textBaseline = 'top';
  x.fillText(`${first.slice(0, 3).toUpperCase()}–${last.slice(0, 3).toUpperCase()}`, m, m * 0.7);
  x.textAlign = 'center'; x.fillText(String(pageNo), W / 2, m * 0.7);
  x.textAlign = 'right'; x.fillText('MANHATTAN', W - m, m * 0.7);
  x.textAlign = 'left';
  x.fillRect(m, m * 0.7 + W * 0.03, W - 2 * m, Math.max(1, W * 0.002));
  const cols = 3, gap = W * 0.025;
  const colW = (W - 2 * m - gap * (cols - 1)) / cols;
  const fs = Math.max(6, Math.round(W * 0.0118));
  x.font = `${fs}px "Newsreader", Georgia, "Times New Roman", serif`;
  const lh = fs * 1.16;
  let col = 0, y = m * 0.7 + W * 0.045;
  const yMax = H - m * 0.8;
  let lastSurname = '';
  for (const e of entries) {
    if (y > yMax) { col++; y = m * 0.7 + W * 0.045; if (col >= cols) break; }
    const x0 = m + col * (colW + gap);
    let name = e.name;
    const sur = name.split(' ')[0];
    // repeated surnames are replaced by a dash, as directories did
    if (sur === lastSurname) name = '—' + name.slice(sur.length);
    else { x.font = `700 ${fs}px "Newsreader", Georgia, serif`; }
    lastSurname = sur;
    const numW = x.measureText(e.num).width;
    x.fillText(name, x0, y, colW - numW - fs * 1.2);
    x.font = `${fs}px "Newsreader", Georgia, "Times New Roman", serif`;
    x.textAlign = 'right'; x.fillText(e.num, x0 + colW, y); x.textAlign = 'left';
    const nameW = Math.min(x.measureText(name).width, colW - numW - fs * 1.2);
    // dot leaders
    x.fillStyle = 'rgba(29,26,22,0.6)';
    for (let dx = x0 + nameW + fs * 0.4; dx < x0 + colW - numW - fs * 0.4; dx += fs * 0.5) x.fillRect(dx, y + fs * 0.75, 1, 1);
    x.fillStyle = '#1d1a16';
    y += lh;
  }
  return { canvas: c, range: `${first}–${last}`, pageNo };
}

/* ---------------- the brush ---------------- */
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917)) >>> 0) / 4294967296; }

// Draw one stroke, bristle by bristle. pts are in page units (0..1 of page width, y also in page-width units).
function drawStroke(ctx, st, map, k, nb, alphaMul = 1) {
  const pts = st.pts;
  if (pts.length < 2) return;
  const R = rng(st.seed);
  const bristles = [];
  for (let j = 0; j < nb; j++) {
    const o = (j / (nb - 1)) * 2 - 1;
    bristles.push({ o: o + (R() - 0.5) * 0.06, ink: 0.6 + R() * 0.8, rate: 0.7 + R() * 0.7, thick: 0.7 + R() * 0.8 });
  }
  const col = st.white ? [238, 234, 225] : [17, 16, 15];
  ctx.lineCap = 'round';
  // smoothed normals
  let nx = 0, ny = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const tnx = -dy / len, tny = dx / len;
    if (i === 1) { nx = tnx; ny = tny; } else { nx = nx * 0.75 + tnx * 0.25; ny = ny * 0.75 + tny * 0.25; const l = Math.hypot(nx, ny); nx /= l; ny /= l; }
    const wa = a.w, wb = b.w;
    for (const br of bristles) {
      br.ink -= len / st.load * br.rate * (st.white ? 0.8 : 1);
      // a dry bristle skips; ink left decides how often
      const wet = br.ink + (R() - 0.5) * 0.25;
      if (wet <= 0) continue;
      const alpha = Math.min(1, 0.55 + wet) * alphaMul;
      const ax = a.x + nx * br.o * wa * 0.5, ay = a.y + ny * br.o * wa * 0.5;
      const bx = b.x + nx * br.o * wb * 0.5, by = b.y + ny * br.o * wb * 0.5;
      const p0 = map(ax, ay), p1 = map(bx, by);
      ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha.toFixed(3)})`;
      ctx.lineWidth = Math.max(0.6, ((wa + wb) * 0.5 / nb) * k * (nb > 40 ? 2.5 : 1.9) * br.thick * Math.min(1, 0.4 + wet));
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
    }
  }
}

/* ---------------- room ---------------- */
export function create(shell) {
  const root = document.createElement('div');
  root.style.cssText = 'position:absolute;inset:0;background:radial-gradient(ellipse at 70% 40%, #2a2724 0%, #121110 55%, #090808 100%)';
  shell.root.insertBefore(root, shell.chrome);
  const wall = document.createElement('canvas');
  wall.style.cssText = 'position:absolute;left:0;top:0;touch-action:none;cursor:grab';
  root.appendChild(wall);
  const desk = document.createElement('div');
  desk.style.cssText = 'position:absolute;box-shadow:0 18px 40px rgba(0,0,0,.6);transform-origin:50% 50%;transition:transform .6s cubic-bezier(.2,.8,.2,1)';
  root.appendChild(desk);
  const pageCv = document.createElement('canvas');
  pageCv.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:crosshair';
  desk.appendChild(pageCv);
  const deskLabel = document.createElement('div');
  deskLabel.style.cssText = 'position:absolute;left:0;right:0;top:100%;margin-top:8px;font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:rgba(236,230,218,.55);text-align:center';
  desk.appendChild(deskLabel);
  const cropEl = document.createElement('div');
  cropEl.style.cssText = 'position:absolute;border:1.5px dashed rgba(179,48,28,.8);pointer-events:none;box-sizing:border-box';
  desk.appendChild(cropEl);

  const PW = 1150, PH = Math.round(1150 * 29 / 23); // page pixels
  pageCv.width = PW; pageCv.height = PH;
  const pctx = pageCv.getContext('2d');
  const wctx = wall.getContext('2d');

  const S = {
    page: null, strokes: [], cur: null, white: false, crop: { cx: 0.5, cy: 0.62, w: 0.5 }, // crop in page-width units, aspect 5:4
    mode: 'project', paintAnim: null, painting: null, dust: [], w: 1, h: 1, dpr: 1, layout: null, active: false, time: 0,
    lampOn: true, seedN: 1,
  };
  const ASPECT = 5 / 4; // painting w:h
  const PAGE_H = 29 / 23; // page height in page-width units

  function newPage() {
    S.page = makePage(PW, PH);
    S.strokes = []; S.painting = null; S.mode = 'project'; S.paintAnim = null;
    deskLabel.textContent = `Manhattan directory, p. ${S.page.pageNo} · ${S.page.range}`;
    commit(); redrawPage();
  }
  const committed = document.createElement('canvas');
  committed.width = PW; committed.height = PH;
  const cctx = committed.getContext('2d');
  const pageMap = (x, y) => [x * PW, y * PW];
  function commit() {
    cctx.drawImage(S.page.canvas, 0, 0);
    for (const st of S.strokes) drawStroke(cctx, st, pageMap, PW, 22);
  }
  function redrawPage() {
    pctx.drawImage(committed, 0, 0);
    if (S.cur) drawStroke(pctx, S.cur, pageMap, PW, 22);
    S.projDirty = true;
    const c = cropRect();
    cropEl.style.left = (c.x0 * 100) + '%'; cropEl.style.width = ((c.x1 - c.x0) * 100) + '%';
    cropEl.style.top = (c.y0 / PAGE_H * 100) + '%'; cropEl.style.height = ((c.y1 - c.y0) / PAGE_H * 100) + '%';
  }
  function cropRect() {
    const w = S.crop.w, h = w / ASPECT;
    let cx = Math.max(w / 2, Math.min(1 - w / 2, S.crop.cx));
    let cy = Math.max(h / 2, Math.min(PAGE_H - h / 2, S.crop.cy));
    S.crop.cx = cx; S.crop.cy = cy;
    return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
  }

  /* ---------- drawing on the page ---------- */
  function pagePos(e) {
    const r = pageCv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.width, t: performance.now() };
  }
  let pid = null;
  pageCv.addEventListener('pointerdown', (e) => {
    initSound(); shell.hideHint();
    pid = e.pointerId; try { pageCv.setPointerCapture(pid); } catch {}
    const p = pagePos(e);
    S.cur = { pts: [{ ...p, w: 0.04 }], seed: (Math.random() * 1e9) | 0, white: S.white, load: S.white ? 0.55 : 0.75 };
    if (S.mode !== 'project') setMode('project');
  });
  pageCv.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pid || !S.cur) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs) {
      const p = pagePos(ev);
      const last = S.cur.pts[S.cur.pts.length - 1];
      const d = Math.hypot(p.x - last.x, p.y - last.y);
      if (d < 0.002) continue;
      const v = d / Math.max(4, p.t - last.t) * 1000; // page widths per second
      // fast strokes are narrower; pressure, if the device reports it, presses wider
      const press = e.pressure && e.pointerType === 'pen' ? 0.5 + e.pressure : 1;
      const wT = Math.max(0.012, Math.min(0.075, 0.056 / (1 + v * 0.55))) * press;
      p.w = last.w + (wT - last.w) * 0.35;
      S.cur.pts.push(p);
      brushSound(v);
    }
    redrawPage();
  });
  const up = (e) => {
    if (e.pointerId !== pid) return;
    pid = null;
    if (S.cur && S.cur.pts.length > 1) S.strokes.push(S.cur);
    S.cur = null; commit(); redrawPage();
    if (snd) snd.brush.gain.setTargetAtTime(0, snd.ctx.currentTime, 0.05);
  };
  pageCv.addEventListener('pointerup', up); pageCv.addEventListener('pointercancel', up);

  /* ---------- choosing the detail on the wall ---------- */
  let wdrag = null;
  wall.addEventListener('wheel', (e) => {
    e.preventDefault();
    S.crop.w = Math.max(0.18, Math.min(1, S.crop.w * (e.deltaY > 0 ? 1.06 : 0.94)));
    if (S.mode !== 'project') setMode('project');
    redrawPage();
  }, { passive: false });
  wall.addEventListener('pointerdown', (e) => {
    initSound();
    wdrag = { x: e.clientX, y: e.clientY, cx: S.crop.cx, cy: S.crop.cy };
    try { wall.setPointerCapture(e.pointerId); } catch {}
    wall.style.cursor = 'grabbing';
  });
  wall.addEventListener('pointermove', (e) => {
    if (!wdrag || !S.layout) return;
    const L = S.layout.proj;
    const k = S.crop.w / (L.w); // page units per css px
    S.crop.cx = wdrag.cx - (e.clientX - wdrag.x) * k;
    S.crop.cy = wdrag.cy - (e.clientY - wdrag.y) * k;
    if (S.mode !== 'project') setMode('project');
    redrawPage();
  });
  const wup = () => { wdrag = null; wall.style.cursor = 'grab'; };
  wall.addEventListener('pointerup', wup); wall.addEventListener('pointercancel', wup);

  /* ---------- UI ---------- */
  shell.toolbar.innerHTML = `
    <div class="grp" role="group" aria-label="Ink">
      <button class="seg" type="button" data-ink="black" aria-pressed="true">Black</button>
      <button class="seg" type="button" data-ink="white" aria-pressed="false">White</button>
      <button class="seg" type="button" id="op-undo">Undo</button>
    </div>
    <div class="grp" role="group" aria-label="Wall">
      <button class="seg" type="button" data-mode="project" aria-pressed="true">Project</button>
      <button class="seg" type="button" data-mode="paint" aria-pressed="false">Paint it</button>
    </div>`;
  shell.readout.innerHTML = `<div>Enlarged <b id="op-k">20×</b></div><div id="op-size">&nbsp;</div>`;
  const $ = (s) => shell.root.querySelector(s);
  shell.toolbar.addEventListener('click', (e) => {
    const i = e.target.closest('[data-ink]');
    if (i) { S.white = i.dataset.ink === 'white'; shell.toolbar.querySelectorAll('[data-ink]').forEach((b) => b.setAttribute('aria-pressed', String(b === i))); }
    const m = e.target.closest('[data-mode]');
    if (m) { initSound(); setMode(m.dataset.mode); }
  });
  $('#op-undo').addEventListener('click', () => { S.strokes.pop(); commit(); redrawPage(); });
  function setMode(m) {
    if (m === S.mode && m !== 'paint') return;
    S.mode = m;
    shell.toolbar.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    if (m === 'paint') startPainting();
    if (snd) { tick(snd.out, { freq: 1800, q: 2, gain: 0.25, dur: 0.05 }); thump(snd.out, { freq: 90, gain: 0.15, dur: 0.12 }); }
  }

  /* ---------- the painting, at full size ---------- */
  const CW = 1500, CH = Math.round(1500 / ASPECT);
  const canvasCm = { w: 254, h: Math.round(254 / ASPECT) };
  function startPainting() {
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    const x = c.getContext('2d');
    // the ground: whites of several makes, laid on in broad passes
    x.fillStyle = '#ece7dc'; x.fillRect(0, 0, CW, CH);
    const R = rng(S.seedN++ * 7919);
    for (let i = 0; i < 70; i++) {
      const y = R() * CH, x0 = -100 + R() * CW, len = 200 + R() * 900, w = 40 + R() * 140;
      const tone = 225 + R() * 22;
      x.strokeStyle = `rgba(${tone},${tone - 3},${tone - 10},${0.1 + R() * 0.2})`;
      x.lineWidth = w; x.lineCap = 'butt';
      x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + len, y + (R() - 0.5) * 80); x.stroke();
    }
    const cr = cropRect();
    const k = CW / (cr.x1 - cr.x0);
    const map = (px, py) => [(px - cr.x0) * k, (py - cr.y0) * k];
    // painting order: blacks first, then whites cut back in
    const order = [...S.strokes.filter((s) => !s.white), ...S.strokes.filter((s) => s.white)];
    S.paintAnim = { c, x, order, i: 0, t: 0, map, k };
    S.painting = c;
    if (snd) swish(0);
  }
  function stepPainting(dt) {
    const A = S.paintAnim;
    if (!A) return;
    A.t += dt;
    const per = Math.max(0.18, 2.4 / Math.max(1, A.order.length));
    while (A.i < A.order.length && A.t > per) {
      A.t -= per;
      drawStroke(A.x, A.order[A.i], A.map, A.k, 90, 1);
      if (snd) swish(A.i);
      A.i++;
    }
    if (A.i >= A.order.length) S.paintAnim = null;
  }

  /* ---------- the wall ---------- */
  function layout() {
    const w = S.w / S.dpr, h = S.h / S.dpr;
    const portrait = h > w * 1.05;
    let page, proj;
    if (!portrait) {
      const ph = Math.min(h * 0.5, 440), pw = ph * 23 / 29;
      page = { x: Math.max(20, w * 0.04), y: h - ph - 120, w: pw, h: ph };
      const left = page.x + pw + 40, availW = w - left - 30, availH = h - 190;
      let pjw = availW, pjh = pjw / ASPECT;
      if (pjh > availH) { pjh = availH; pjw = pjh * ASPECT; }
      proj = { x: left + (availW - pjw) / 2, y: 80 + (availH - pjh) / 2, w: pjw, h: pjh };
    } else {
      const pjw = w - 32, pjh = pjw / ASPECT;
      proj = { x: 16, y: 90, w: pjw, h: pjh };
      const top = proj.y + pjh + 30, availH = h - top - 150;
      const ph = Math.max(140, Math.min(availH, 330)), pw = ph * 23 / 29;
      page = { x: (w - pw) / 2, y: top, w: pw, h: ph };
    }
    return { page, proj, portrait };
  }
  function resize(w, h, dpr) {
    dpr = Math.min(dpr, 1.5);
    S.dpr = dpr; S.w = Math.round(w * dpr); S.h = Math.round(h * dpr);
    wall.width = S.w; wall.height = S.h; wall.style.width = w + 'px'; wall.style.height = h + 'px';
    S.layout = layout();
    const p = S.layout.page;
    desk.style.left = p.x + 'px'; desk.style.top = p.y + 'px'; desk.style.width = p.w + 'px'; desk.style.height = p.h + 'px';
    desk.style.transform = S.layout.portrait ? 'none' : 'rotate(-2.5deg)';
    if (!S.dust.length) for (let i = 0; i < 90; i++) S.dust.push({ x: Math.random(), y: Math.random(), z: Math.random(), vx: (Math.random() - 0.5) * 0.01, vy: (Math.random() - 0.5) * 0.006 });
  }

  let proj = null, pj = null, tmp = null, tj = null;
  function drawWall(dt) {
    const c = wctx, d = S.dpr;
    const P = S.layout.proj;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, S.w, S.h);
    c.setTransform(d, 0, 0, d, 0, 0);
    if (S.mode === 'project') {
      // the beam's spill around the image
      const g = c.createRadialGradient(P.x + P.w / 2, P.y + P.h / 2, P.h * 0.3, P.x + P.w / 2, P.y + P.h / 2, P.w * 0.75);
      g.addColorStop(0, 'rgba(255,236,190,0.12)'); g.addColorStop(1, 'rgba(255,236,190,0)');
      c.fillStyle = g; c.fillRect(P.x - 200, P.y - 200, P.w + 400, P.h + 400);
      // the page, enlarged, with a little keystone (drawn in strips) and softness; cached until it changes
      if (S.projDirty || !proj || proj.width !== Math.round(P.w * 1.04 * d) || proj.height !== Math.round(P.h * d)) {
        S.projDirty = false;
        if (!proj) { proj = document.createElement('canvas'); pj = proj.getContext('2d'); tmp = document.createElement('canvas'); tj = tmp.getContext('2d'); }
        proj.width = tmp.width = Math.round(P.w * 1.04 * d); proj.height = tmp.height = Math.round(P.h * d);
        const cr = cropRect();
        const strips = 48;
        for (let i = 0; i < strips; i++) {
          const t0 = i / strips;
          const sy = (cr.y0 + (cr.y1 - cr.y0) * t0) * PW, sh = (cr.y1 - cr.y0) * PW / strips;
          const ks = 1 + 0.035 * (1 - t0); // wider at the top: the projector sits below the image
          const dw = tmp.width / 1.04 * ks, dx = (tmp.width - dw) / 2;
          tj.drawImage(pageCv, cr.x0 * PW, sy, (cr.x1 - cr.x0) * PW, sh, dx, tmp.height * t0, dw, tmp.height / strips + 0.8);
        }
        pj.save();
        try { pj.filter = `blur(${((0.8 + 0.7 * (1 - S.crop.w)) * d).toFixed(2)}px) sepia(0.25) brightness(1.08)`; } catch {}
        pj.drawImage(tmp, 0, 0);
        pj.restore();
      }
      c.drawImage(proj, P.x - P.w * 0.02, P.y, P.w * 1.04, P.h);
      // hot spot and fall-off of the lamp
      const v = c.createRadialGradient(P.x + P.w / 2, P.y + P.h * 0.48, P.h * 0.1, P.x + P.w / 2, P.y + P.h / 2, P.w * 0.62);
      v.addColorStop(0, 'rgba(255,245,215,0.10)'); v.addColorStop(0.7, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
      c.fillStyle = v; c.fillRect(P.x - 4, P.y - 4, P.w + 8, P.h + 8);
      // dust turning in the beam
      c.fillStyle = 'rgba(255,240,210,0.5)';
      for (const p of S.dust) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 0) p.x += 1; if (p.x > 1) p.x -= 1; if (p.y < 0) p.y += 1; if (p.y > 1) p.y -= 1;
        const s = 0.5 + p.z * 1.6;
        c.globalAlpha = 0.15 + 0.35 * p.z * (0.5 + 0.5 * Math.sin(S.time * 2 + p.x * 40));
        c.fillRect(P.x + p.x * P.w, P.y + p.y * P.h, s, s);
      }
      c.globalAlpha = 1;
    } else if (S.painting) {
      // the canvas, hung, under a work light
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 30; c.shadowOffsetY = 12;
      c.drawImage(S.painting, P.x, P.y, P.w, P.h);
      c.restore();
      const v = c.createLinearGradient(0, P.y, 0, P.y + P.h);
      v.addColorStop(0, 'rgba(255,240,215,0.06)'); v.addColorStop(1, 'rgba(0,0,0,0.12)');
      c.fillStyle = v; c.fillRect(P.x, P.y, P.w, P.h);
    }
    const cr = cropRect();
    const enlarge = (canvasCm.w / ((cr.x1 - cr.x0) * 23));
    $('#op-k').textContent = Math.round(enlarge) + '×';
    $('#op-size').textContent = `${((cr.x1 - cr.x0) * 23).toFixed(1)} cm of page → ${canvasCm.h} × ${canvasCm.w} cm canvas`;
  }

  /* ---------- sound ---------- */
  let snd = null;
  function initSound() {
    const A = audio(); if (!A || snd || !shell.bus) return;
    const ctx = A.ctx, out = shell.bus.input;
    // projector: a fan and a mains hum
    const fan = loopNoise(ctx, 'brown');
    const ff = ctx.createBiquadFilter(); ff.type = 'bandpass'; ff.frequency.value = 180; ff.Q.value = 0.7;
    const fg = ctx.createGain(); fg.gain.value = 0;
    fan.connect(ff).connect(fg).connect(out);
    const hum = ctx.createOscillator(); hum.frequency.value = 60; // American mains
    const hum2 = ctx.createOscillator(); hum2.frequency.value = 120;
    const hg = ctx.createGain(); hg.gain.value = 0;
    hum.connect(hg); hum2.connect(hg); hg.connect(out);
    hum.start(); hum2.start();
    // brush on paper
    const bn = loopNoise(ctx, 'pink');
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 2500; bf.Q.value = 0.8;
    const brush = ctx.createGain(); brush.gain.value = 0;
    bn.connect(bf).connect(brush).connect(out);
    snd = { ctx, out, fg, hg, brush, bf };
  }
  function brushSound(v) {
    if (!snd) return;
    const t = snd.ctx.currentTime;
    snd.brush.gain.setTargetAtTime(Math.min(0.18, 0.03 + v * 0.06), t, 0.02);
    snd.bf.frequency.setTargetAtTime(1500 + v * 1800, t, 0.05);
  }
  function swish(i) {
    const ctx = snd.ctx, t = ctx.currentTime;
    const n = ctx.createBufferSource();
    const len = Math.floor(ctx.sampleRate * 0.6);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let k = 0; k < len; k++) { const e = Math.sin(Math.PI * k / len); d[k] = (Math.random() * 2 - 1) * e * e; }
    n.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(500 + (i % 3) * 200, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.5);
    const g = ctx.createGain(); g.gain.value = 0.3;
    n.connect(f).connect(g).connect(snd.out); n.start(t);
  }
  function updateSound() {
    if (!snd) return;
    const t = snd.ctx.currentTime;
    const on = S.mode === 'project' ? 1 : 0;
    snd.fg.gain.setTargetAtTime(0.22 * on, t, 0.3);
    snd.hg.gain.setTargetAtTime(0.012 * on, t, 0.3);
  }

  /* ---------- lifecycle ---------- */
  function frame(dt) {
    S.time += dt;
    stepPainting(dt);
    drawWall(dt);
    updateSound();
  }

  async function hang(n) {
    if (!S.painting || S.mode !== 'paint') { setMode('paint'); }
    // finish the painting at once
    while (S.paintAnim) { S.paintAnim.t = 1e9; stepPainting(0); }
    const c = document.createElement('canvas');
    c.width = 1200; c.height = Math.round(1200 / ASPECT);
    c.getContext('2d').drawImage(S.painting, 0, 0, c.width, c.height);
    const cr = cropRect();
    const blacks = S.strokes.filter((s) => !s.white).length, whites = S.strokes.length - blacks;
    const towns = ['Shamokin', 'Tamaqua', 'Nanticoke', 'Mount Carmel', 'Lansford', 'Coaldale', 'Shickshinny', 'Frackville', 'Mahanoy City', 'Minersville', 'Plymouth', 'Ashley', 'Larksville', 'Pittston'];
    const title = S.strokes.length ? towns[Math.floor(Math.random() * towns.length)] : 'Untitled (Directory)';
    return {
      image: c.toDataURL('image/jpeg', 0.9),
      label: {
        ...ARTIST,
        title,
        year: year(),
        medium: 'Oil and house enamel on canvas, from a brush sketch in ink on a page of the Manhattan telephone directory',
        dims: `${canvasCm.h} × ${canvasCm.w} cm`,
        facts: [
          `Enlarged about ${Math.round(canvasCm.w / ((cr.x1 - cr.x0) * 23))}× from a ${((cr.x1 - cr.x0) * 23).toFixed(1)} cm detail of page ${S.page.pageNo} (${S.page.range})`,
          `${blacks} black stroke${blacks === 1 ? '' : 's'}${whites ? `, ${whites} cut back in white` : ''}`,
        ],
        review: { who: 'A sign painter from Wilkes-Barre, imagined', text: blacks > 6 ? 'Too many strokes for one wall, but the big one holds it up like a girder.' : blacks ? 'A few strokes, the size of a coal tipple. You can feel the brush run dry.' : 'A page from the phone book, very large. Someone will call.' },
      },
    };
  }

  let hinted = false;
  newPage();
  return {
    resize, frame, hang,
    fresh() { newPage(); shell.toast('A new page, torn from the directory.'); },
    enter() { S.active = true; initSound(); if (!hinted) { hinted = true; shell.hint('Sketch on the phone-book page with the brush.<br>The projector throws it on the wall.<small>Wheel or drag on the wall to pick a detail · Paint it when you like it</small>', 7500); } },
    leave() { S.active = false; if (snd) snd.brush.gain.value = 0; },
  };
}
