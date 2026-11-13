import { resume, setMuted, isMuted, bus } from './audio.js';
import * as Floor from './rooms/floor.js';
import * as Stain from './rooms/stain.js';
import * as Field from './rooms/field.js';
import * as Zip from './rooms/zip.js';
import * as Black from './rooms/black.js';

const ROOMS = [Floor, Stain, Field, Zip, Black];
const byId = Object.fromEntries(ROOMS.map((r) => [r.meta.id, r]));

const $ = (s, el = document) => el.querySelector(s);
const lobby = $('#lobby'), stage = $('#stage'), catalogueEl = $('#catalogue');

/* ---------------- storage ---------------- */
const KEY = 'arena.exhibition.v1';
let works = [];
try { works = JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch { works = []; }
function saveWorks() {
  // drop oldest images until it fits
  for (let tries = 0; tries < 30; tries++) {
    try { localStorage.setItem(KEY, JSON.stringify(works)); return true; }
    catch { if (works.length > 1) works = works.slice(1); else return false; }
  }
  return false;
}
function countFor(roomId) { return works.filter((w) => w.room === roomId).length; }

/* ---------------- lobby ---------------- */
function renderLobby() {
  const ol = $('#room-list');
  ol.innerHTML = '';
  for (const R of ROOMS) {
    const m = R.meta;
    const li = document.createElement('li');
    li.innerHTML = `<button class="room-link" type="button" data-room="${m.id}">
        <span class="num">${m.numeral}</span>
        <span class="name">${m.name}<span class="after">${m.after}</span></span>
        <span class="desc">${m.lede}</span>
        <span class="yrs">${m.years}</span>
        <span class="swatch" style="background:${m.swatch}"></span>
      </button>`;
    ol.appendChild(li);
  }
  ol.addEventListener('click', (e) => {
    const b = e.target.closest('[data-room]');
    if (b) { resume(); go(b.dataset.room); }
  });
  $('#cat-count').textContent = works.length;
}
$('#to-cat').addEventListener('click', () => go('catalogue'));
$('#cat-back').addEventListener('click', () => go(''));

/* ---------------- catalogue ---------------- */
function renderCatalogue() {
  const box = $('#works');
  box.innerHTML = '';
  if (!works.length) {
    box.innerHTML = `<div class="empty">Nothing hung yet. Go into a room, make something, and press <b>Hang</b>.</div>`;
    return;
  }
  [...works].reverse().forEach((w) => {
    const L = w.label;
    const d = document.createElement('article');
    d.className = 'work';
    d.innerHTML = `
      <div class="frame"><img alt="${esc(L.title)}" src="${w.image}"></div>
      <div class="label">
        <span class="artist">${esc(L.artist || 'You')} <span style="font-weight:400;color:var(--muted)">(b. ${esc(L.born || 'unknown')})</span></span>
        <span class="title">${esc(L.title)}<span style="font-style:normal">, ${esc(L.year)}</span></span>
        <span class="med">${esc(L.medium)}</span>
        <span class="med">${esc(L.dims)}</span>
        ${L.facts && L.facts.length ? `<span class="facts">${L.facts.map(esc).join('<br>')}</span>` : ''}
        ${L.review ? `<div class="review"><span>${esc(L.review.who)}</span>${esc(L.review.text)}</div>` : ''}
      </div>
      <button class="rm" type="button">Take it down</button>`;
    d.querySelector('.rm').addEventListener('click', () => {
      works = works.filter((x) => x.id !== w.id); saveWorks(); renderCatalogue(); $('#cat-count').textContent = works.length;
    });
    box.appendChild(d);
  });
}
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ---------------- room shell ---------------- */
const live = {}; // id -> {R, inst, el, shell}
let current = null;

function buildShell(R) {
  const m = R.meta;
  const el = document.createElement('div');
  el.className = 'room';
  el.dataset.room = m.id;
  el.innerHTML = `
    <div class="chrome">
      <div class="topbar">
        <div class="plaque">
          <div class="t"><i>${m.numeral}</i>${m.name}</div>
          <div class="s">${m.after} · ${m.place}</div>
        </div>
        <div class="acts">
          <button class="hbtn primary" data-act="hang" type="button" title="Hang this picture in your exhibition (H)">Hang</button>
          <button class="hbtn" data-act="fresh" type="button" title="Start a new canvas (N)">${m.freshLabel || 'New canvas'}</button>
          <button class="hbtn" data-act="wall" type="button" title="Read the wall text (I)">Wall text</button>
          <button class="hbtn" data-act="mute" type="button" aria-pressed="false" title="Sound on or off (M)">Sound</button>
          <button class="hbtn" data-act="leave" type="button" title="Back to the rooms (Esc)">Rooms</button>
        </div>
      </div>
      <div class="readout"></div>
      <div class="toolbar"></div>
      <div class="hint"></div>
      <aside class="wall" aria-label="Wall text">
        <div class="close"><button type="button" data-act="wall-close">Close</button></div>
        <h2>${m.name}</h2>
        <div class="after">${m.after} · ${m.years}</div>
        ${m.wall}
      </aside>
      <div class="toast"></div>
      <div class="flash"></div>
    </div>`;
  stage.appendChild(el);
  const chrome = $('.chrome', el);
  const shell = {
    root: el,
    chrome,
    toolbar: $('.toolbar', el),
    readout: $('.readout', el),
    bus: bus(m.level ?? 1, m.wet ?? 0.3),
    hint(html, ms = 5000) {
      const h = $('.hint', el);
      h.innerHTML = html; h.style.opacity = 1;
      clearTimeout(h._t);
      if (ms) h._t = setTimeout(() => (h.style.opacity = 0), ms);
    },
    hideHint() { const h = $('.hint', el); h.style.opacity = 0; },
    toast(html, ms = 4200) {
      const t = $('.toast', el);
      t.innerHTML = html; t.classList.add('show');
      clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), ms);
    },
    setIdle(v) { el.classList.toggle('idle', !!v); },
    canvas() {
      const c = document.createElement('canvas');
      c.className = 'gl';
      el.insertBefore(c, chrome);
      return c;
    },
  };

  chrome.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    resume();
    act(b.dataset.act);
  });
  return shell;
}

function act(a) {
  if (!current) return;
  const { inst, el, shell, R } = current;
  if (a === 'hang') hang();
  if (a === 'fresh') { inst.fresh && inst.fresh(); }
  if (a === 'wall') $('.wall', el).classList.toggle('open');
  if (a === 'wall-close') $('.wall', el).classList.remove('open');
  if (a === 'mute') { setMuted(!isMuted()); syncMute(); }
  if (a === 'leave') go('');
}
function syncMute() {
  document.querySelectorAll('[data-act="mute"]').forEach((b) => {
    b.setAttribute('aria-pressed', isMuted() ? 'true' : 'false');
    b.textContent = isMuted() ? 'Muted' : 'Sound';
  });
}

async function hang() {
  const { inst, el, shell, R } = current;
  if (!inst.hang) return;
  const n = countFor(R.meta.id) + 1;
  let res;
  try { res = await inst.hang(n); } catch (err) { console.error(err); shell.toast('That did not hang. ' + esc(err.message)); return; }
  if (!res) return;
  const flash = $('.flash', el);
  flash.style.transition = 'none'; flash.style.opacity = 0.85;
  requestAnimationFrame(() => { flash.style.transition = 'opacity .9s'; flash.style.opacity = 0; });
  const w = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), room: R.meta.id, image: res.image, label: res.label, at: Date.now() };
  works.push(w);
  const ok = saveWorks();
  $('#cat-count').textContent = works.length;
  shell.toast(`Hung: <i>${esc(res.label.title)}</i>, ${esc(res.label.year)}<small>${ok ? 'Now in your exhibition' : 'In your exhibition for this visit (storage is full or blocked)'}</small>`);
}

/* ---------------- routing ---------------- */
function go(id) {
  const h = id ? '#' + id : ' ';
  if (location.hash !== (id ? '#' + id : '')) {
    try { history.pushState(null, '', id ? '#' + id : location.pathname + location.search); } catch { location.hash = id; }
  }
  route();
}
window.addEventListener('hashchange', route);
window.addEventListener('popstate', route);

function route() {
  const id = (location.hash || '').slice(1);
  if (current) {
    current.inst.leave && current.inst.leave();
    current.shell.bus && current.shell.bus.fadeOut();
    current.el.hidden = true;
    current = null;
  }
  if (id === 'catalogue') {
    lobby.hidden = true; stage.hidden = true; catalogueEl.hidden = false;
    renderCatalogue(); window.scrollTo(0, 0);
    return;
  }
  const R = byId[id];
  if (!R) {
    lobby.hidden = false; stage.hidden = true; catalogueEl.hidden = true;
    $('#cat-count').textContent = works.length;
    return;
  }
  lobby.hidden = true; catalogueEl.hidden = true; stage.hidden = false;
  if (!live[id]) {
    const shell = buildShell(R);
    let inst;
    try { inst = R.create(shell); }
    catch (err) {
      console.error(err);
      shell.root.insertAdjacentHTML('afterbegin', `<div class="nogl">This room needs WebGL2 with float textures, which this browser did not provide.<br>${esc(err.message)}</div>`);
      inst = {};
    }
    live[id] = { R, inst, el: shell.root, shell };
  }
  current = live[id];
  current.el.hidden = false;
  syncMute();
  resize();
  current.inst.enter && current.inst.enter();
  current.shell.bus && current.shell.bus.fadeIn();
  idleKick();
}

/* ---------------- idle chrome ---------------- */
let idleTimer = 0;
function idleKick() {
  if (!current) return;
  if (current.R.meta.noIdleChrome) return;
  current.shell.setIdle(false);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => current && !current.R.meta.noIdleChrome && current.shell.setIdle(true), 7000);
}
window.addEventListener('pointermove', idleKick, { passive: true });
window.addEventListener('pointerdown', () => { resume(); idleKick(); }, { passive: true });

window.addEventListener('keydown', (e) => {
  if (!current) return;
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (e.key === 'Escape') {
    const wall = $('.wall.open', current.el);
    if (wall) wall.classList.remove('open'); else go('');
  }
  if (e.key === 'h' || e.key === 'H') hang();
  if (e.key === 'n' || e.key === 'N') act('fresh');
  if (e.key === 'i' || e.key === 'I') act('wall');
  if (e.key === 'm' || e.key === 'M') act('mute');
  idleKick();
});

/* ---------------- loop ---------------- */
function resize() {
  if (!current || !current.inst.resize) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  current.inst.resize(stage.clientWidth, stage.clientHeight, dpr);
}
window.addEventListener('resize', resize);

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (current && current.inst.frame && !document.hidden) {
    try { current.inst.frame(dt, now / 1000); }
    catch (err) { console.error(err); current.inst.frame = null; }
  }
  requestAnimationFrame(loop);
}

renderLobby();
route();
requestAnimationFrame(loop);
window.__arena = { go, get current() { return current; }, works: () => works };
