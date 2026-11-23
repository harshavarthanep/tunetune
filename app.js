/* Tune Tune v2 — free music player
   YouTube Music catalog: direct (desktop/Android app) or public Piped/Invidious mirrors (browser)
   Also: Audius (free full songs), Deezer chart, Radio Browser (live radio), LRCLIB (lyrics)
   Everything runs inside this private scope so nothing collides with browser globals. */
(() => {
'use strict';

const TITLE = 'Tune Tune';
const APP = 'TuneTune';
const VER = '2.0.0';
const KEY = 'tunetune.v1';
const YEAR = new Date().getFullYear();
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_CAP = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
const IS_DESKTOP = !!window.ttDesktop;
const NATIVE = IS_CAP || IS_DESKTOP;

/* ================= utils ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = encodeURIComponent;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const uniq = a => [...new Set(a.filter(Boolean))];
const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmt = s => {
  if (!isFinite(s) || s < 0) s = 0;
  s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`;
};
const fmtBytes = b => { if (b == null) return '—'; const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; } return b.toFixed(i > 1 ? 1 : 0) + ' ' + u[i]; };
const compact = n => { n = +n || 0; return n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(n); };
const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 360; };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const argb = n => '#' + ((n >>> 0) & 0xffffff).toString(16).padStart(6, '0');
const softErr = m => Object.assign(new Error(m), { soft: true });

async function fetchT(url, opts = {}, ms = 12000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); } finally { clearTimeout(t); }
}
async function getJSON(url, ms = 12000, opts) {
  const r = await fetchT(url, opts, ms);
  if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status });
  return r.json();
}
const hardFail = e => !e.soft && (!e.status || e.status >= 500 || e.status === 429 || e.status === 403);
function limiter(n) {
  let active = 0; const q = [];
  const pump = () => {
    while (active < n && q.length) {
      const { fn, res, rej } = q.shift(); active++;
      Promise.resolve().then(fn).then(res, rej).finally(() => { active--; pump(); });
    }
  };
  return fn => new Promise((res, rej) => { q.push({ fn, res, rej }); pump(); });
}
const lim = limiter(4);
const mem = new Map();
async function cached(key, ttl, fn) {
  const c = mem.get(key);
  if (c && Date.now() - c.t < ttl) return c.v;
  const v = await fn();
  if (!(Array.isArray(v) && !v.length)) mem.set(key, { t: Date.now(), v });
  return v;
}
function jsonp(url, timeout = 10000) {
  return new Promise((res, rej) => {
    const cb = '__tt' + Date.now() + Math.floor(Math.random() * 1e5);
    const s = document.createElement('script');
    const tm = setTimeout(() => { done(); rej(new Error('timeout')); }, timeout);
    function done() { clearTimeout(tm); try { delete window[cb]; } catch (e) { window[cb] = undefined; } s.remove(); }
    window[cb] = d => { done(); d && d.error ? rej(new Error(d.error.message || 'error')) : res(d); };
    s.onerror = () => { done(); rej(new Error('load')); };
    s.src = url + (url.includes('?') ? '&' : '?') + 'output=jsonp&callback=' + cb;
    document.head.appendChild(s);
  });
}

/* ================= icons ================= */
const P = (d, w = 2) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const svg = inner => `<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${inner}</svg>`;
const NEXT_D = 'M2.8 6.2v11.6c0 .7.8 1.1 1.3.7L12 12.7v-1.4L4.1 5.5c-.5-.4-1.3 0-1.3.7zM12 6.2v11.6c0 .7.8 1.1 1.3.7l7.9-5.8c.5-.35.5-1.05 0-1.4l-7.9-5.8c-.5-.4-1.3 0-1.3.7z';
const REP_D = 'M4 11V9a3 3 0 0 1 3-3h13M17 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H4M7 21l-3-3 3-3';
const SPEAKER = '<path d="M3.5 9.5h3.2L11 5.8v12.4l-4.3-3.7H3.5z"/>';
const I = {
  play: svg('<path d="M7 5.4v13.2c0 .8.9 1.3 1.6.9l10.9-6.6c.6-.4.6-1.3 0-1.7L8.6 4.5C7.9 4.1 7 4.6 7 5.4z"/>'),
  pause: svg('<rect x="6" y="4.5" width="4.2" height="15" rx="1.2"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2"/>'),
  next: svg(`<path d="${NEXT_D}"/>`),
  prev: svg(`<g transform="matrix(-1 0 0 1 24 0)"><path d="${NEXT_D}"/></g>`),
  shuffle: svg(P('M3 7h3.5c2 0 3.2 1 4.3 2.8l2.4 4.4C14.3 16 15.5 17 17.5 17H21M3 17h3.5c1.4 0 2.4-.5 3.2-1.4M14.3 8.4C15 7.5 16 7 17.5 7H21M18 4l3 3-3 3M18 14l3 3-3 3')),
  repeat: svg(P(REP_D)),
  repeat1: svg(P(REP_D) + P('M10.8 10.6l1.6-1.1v5', 1.8)),
  heart: svg(P('M12 20.3s-7.4-4.5-9.3-9C1.4 8.1 3.4 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.6 0 5.6 3.6 4.3 6.8-1.9 4.5-9.3 9-9.3 9z', 1.9)),
  heartFill: svg('<path d="M12 20.3s-7.4-4.5-9.3-9C1.4 8.1 3.4 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.6 0 5.6 3.6 4.3 6.8-1.9 4.5-9.3 9-9.3 9z"/>'),
  more: svg('<circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/>'),
  search: svg(P('M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L21 21', 2.2)),
  home: svg(P('M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19z', 1.9) + '<path d="M10 8.4v7.2c0 .5.5.8.9.5l5.6-3.6c.4-.25.4-.75 0-1L10.9 7.9c-.4-.3-.9 0-.9.5z"/>'),
  explore: svg(P('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 1.9) + '<path d="M15.8 8.2l-2.3 5.3-5.3 2.3 2.3-5.3z"/>'),
  radio: svg('<circle cx="12" cy="12" r="2.2"/>' + P('M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4')),
  library: svg('<rect x="3.5" y="4" width="3.4" height="16" rx="1"/><rect x="9" y="4" width="3.4" height="16" rx="1"/><path d="M14.5 5.4l3.2-.9 3.9 14.5-3.2.9z"/>'),
  chevDown: svg(P('M5 9l7 7 7-7', 2.6)),
  chevL: svg(P('M15 5l-7 7 7 7', 2.6)),
  chevR: svg(P('M9 5l7 7-7 7', 2.2)),
  plus: svg(P('M12 5v14M5 12h14', 2.4)),
  minus: svg(P('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12h8', 1.9)),
  download: svg(P('M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14')),
  dlok: svg('<circle cx="12" cy="12" r="10"/><path d="M12 7v9M8 12.5l4 4 4-4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  queue: svg(P('M4 6h16M4 11h16M4 16h9') + '<path d="M16 14v7l5-3.5z"/>'),
  playNext: svg(P('M4 6h10M4 11h10M4 16h6') + '<path d="M15 13v7l5.5-3.5z"/>'),
  lyrics: svg(P('M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9.5L5 20.5V17H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 9.5h8M8 12.5h5', 1.9)),
  timer: svg(P('M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4.5l2.5 1.5M9.5 2.5h5')),
  eq: svg(P('M5 3v18M12 3v18M19 3v18', 1.5) + '<circle cx="5" cy="15" r="2.6"/><circle cx="12" cy="8" r="2.6"/><circle cx="19" cy="13" r="2.6"/>'),
  share: svg(P('M12 3v12M8 7l4-4 4 4M7 10H6a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 18 10h-1')),
  trash: svg(P('M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5')),
  gear: svg(P('M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z', 1.8) + P('M19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7.6 7.6 0 0 1-2 1.2l-.3 2h-3.9l-.3-2a7.6 7.6 0 0 1-2-1.2l-1.9.7-2-3.4 1.6-1.2a7.5 7.5 0 0 1 0-3l-1.6-1.2 2-3.4 1.9.7a7.6 7.6 0 0 1 2-1.2l.3-2h3.9l.3 2a7.6 7.6 0 0 1 2 1.2l1.9-.7 2 3.4-1.6 1.2a7.5 7.5 0 0 1 0 3z', 1.8)),
  music: svg(P('M9 18V6l11-2v12') + '<circle cx="6.5" cy="18" r="2.6"/><circle cx="17.5" cy="16" r="2.6"/>'),
  x: svg(P('M6 6l12 12M18 6L6 18', 2.6)),
  folder: svg(P('M3.5 7V18a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5V9a1.5 1.5 0 0 0-1.5-1.5h-7L10 5H5A1.5 1.5 0 0 0 3.5 6.5z')),
  upload: svg(P('M12 15V4M7.5 8.5L12 4l4.5 4.5M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5')),
  save: svg(P('M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM12 10v7M9 14l3 3 3-3')),
  clock: svg(P('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2')),
  playlist: svg(P('M4 6h11M4 11h11M4 16h6M18.5 18V8.5l3-1') + '<circle cx="16.5" cy="18" r="2.2"/>'),
  volLow: svg(SPEAKER + P('M14.5 9.5a3.5 3.5 0 0 1 0 5')),
  volHigh: svg(SPEAKER + P('M14.5 9.5a3.5 3.5 0 0 1 0 5M17.5 6.5a8 8 0 0 1 0 11')),
  ext: svg(P('M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5')),
  user: svg(P('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1.3-3.6 4.2-5.3 7.5-5.3s6.2 1.7 7.5 5.3')),
  grip: svg(P('M5 9h14M5 15h14')),
  infinity: svg(P('M12 12c-2-2.7-3.6-4-5.5-4a4 4 0 0 0 0 8c1.9 0 3.5-1.3 5.5-4zm0 0c2 2.7 3.6 4 5.5 4a4 4 0 0 0 0-8c-1.9 0-3.5 1.3-5.5 4z')),
  speed: svg(P('M4.5 17a8.5 8.5 0 1 1 15 0M12 13l4-4') + '<circle cx="12" cy="13" r="1.6"/>'),
  globe: svg(P('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z', 1.7)),
  pulse: svg(P('M3 12h4l2.5-6 5 12 2.5-6H21')),
  wifiOff: svg(P('M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M3 3l18 18') + '<circle cx="12" cy="19" r="1.3"/>'),
};
const BARS = '<span class="bars"><i></i><i></i><i></i></span>';

/* placeholder artwork */
const phCache = new Map();
function ph(t) {
  const key = (t && (t.title || '') + (t.artist || '')) || 'x';
  if (phCache.has(key)) return phCache.get(key);
  const h = hue(key);
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},68%,62%)"/><stop offset="1" stop-color="hsl(${(h + 48) % 360},74%,40%)"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><path d="M42 66V36l26-6v30" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="36" cy="66" r="7" fill="rgba(255,255,255,.85)"/><circle cx="62" cy="60" r="7" fill="rgba(255,255,255,.85)"/></svg>`;
  const url = 'data:image/svg+xml,' + encodeURIComponent(s);
  phCache.set(key, url);
  return url;
}
const artCache = new Map();
function artOf(t, big) {
  if (!t) return ph();
  return artCache.get(t.id) || (big ? (t.artLarge || t.art) : t.art) || ph(t);
}
document.addEventListener('error', e => {
  const el = e.target;
  if (!el || el.tagName !== 'IMG' || el.dataset.fb) return;
  const src = el.getAttribute('src') || '';
  if (/\/(maxresdefault|hq720)\.jpg/.test(src)) { el.src = src.replace(/(maxresdefault|hq720)\.jpg/, 'mqdefault.jpg'); return; }
  el.dataset.fb = '1'; el.classList.remove('logo'); el.src = ph({ title: src });
}, true);

/* ================= state ================= */
const DEFAULTS = {
  liked: [], playlists: [], history: [], searches: [], downloads: [], locals: [],
  settings: { theme: 'auto', accent: '#ff375f', eqOn: false, eq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], eqPreset: 'Flat', autoplay: true, country: '', volume: 1, langs: null, quality: 'high', mirror: '' },
};
const S = (() => {
  const base = JSON.parse(JSON.stringify(DEFAULTS));
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    const out = { ...base, ...raw, settings: { ...base.settings, ...(raw.settings || {}) } };
    for (const k of ['liked', 'playlists', 'history', 'searches', 'downloads', 'locals']) if (!Array.isArray(out[k])) out[k] = [];
    if (!Array.isArray(out.settings.eq) || out.settings.eq.length !== 10) out.settings.eq = base.settings.eq.slice();
    return out;
  } catch (e) { return base; }
})();
let saveT;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Storage is full — remove some downloads'); } }, 250);
}
const KEEP = ['id', 'source', 'sid', 'uid', 'title', 'artist', 'handle', 'album', 'art', 'artLarge', 'duration', 'full', 'genre', 'url', 'live', 'preview', 'explicit', 'plays', 'permalink', 'home', 'hasArt', 'ytId'];
const clean = t => { const o = {}; for (const k of KEEP) if (t[k] !== undefined && t[k] !== null && t[k] !== '') o[k] = t[k]; return o; };
const isLiked = id => S.liked.some(t => t.id === id);
const isDl = id => String(id).startsWith('lc:') || S.downloads.some(t => t.id === id);
const myLangs = () => (Array.isArray(S.settings.langs) && S.settings.langs.length ? S.settings.langs : ['English']);
const isTrack = x => !!x && !x.kind;

function toggleLike(t) {
  const i = S.liked.findIndex(x => x.id === t.id);
  if (i >= 0) { S.liked.splice(i, 1); toast(t.live ? 'Station removed' : 'Removed from Favorites'); }
  else { S.liked.unshift(clean(t)); toast(t.live ? 'Station saved' : 'Added to Favorites'); }
  save(); UI.like();
  const e = cv(); if (e.v === 'library' || (e.v === 'coll' && ['liked', 'stations'].includes(e.k))) softRender();
}
function addHistory(t) {
  S.history = S.history.filter(x => x.id !== t.id);
  S.history.unshift(clean(t));
  if (S.history.length > 150) S.history.length = 150;
  save();
}
function saveSearch(q) {
  q = (q || '').trim(); if (q.length < 2) return;
  S.searches = [q, ...S.searches.filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 12); save();
}

/* ================= IndexedDB ================= */
const DB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('tunetune', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('blobs');
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction('blobs', mode); const rq = fn(t.objectStore('blobs'));
      t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  get(k) { return this.tx('readonly', s => s.get(k)); },
  put(k, v) { return this.tx('readwrite', s => s.put(v, k)); },
  del(k) { return this.tx('readwrite', s => s.delete(k)); },
};

/* ================= catalogs ================= */
const LANGS = [['Hindi', 'हिन्दी'], ['Tamil', 'தமிழ்'], ['Telugu', 'తెలుగు'], ['Malayalam', 'മലയാളം'], ['Kannada', 'ಕನ್ನಡ'], ['Punjabi', 'ਪੰਜਾਬੀ'],
  ['Bengali', 'বাংলা'], ['Marathi', 'मराठी'], ['Gujarati', 'ગુજરાતી'], ['Bhojpuri', 'भोजपुरी'], ['Odia', 'ଓଡ଼ିଆ'], ['Assamese', 'অসমীয়া'], ['Urdu', 'اردو'],
  ['Sinhala', 'සිංහල'], ['Nepali', 'नेपाली'], ['English', 'English'], ['Korean', '한국어'], ['Japanese', '日本語'], ['Chinese', '中文'], ['Spanish', 'Español'],
  ['Portuguese', 'Português'], ['French', 'Français'], ['German', 'Deutsch'], ['Italian', 'Italiano'], ['Arabic', 'العربية'], ['Turkish', 'Türkçe'],
  ['Russian', 'Русский'], ['Indonesian', 'Indonesia'], ['Malay', 'Melayu'], ['Thai', 'ไทย'], ['Vietnamese', 'Tiếng Việt'], ['Filipino', 'Filipino'],
  ['Persian', 'فارسی'], ['Swahili', 'Kiswahili'], ['Greek', 'Ελληνικά'], ['Dutch', 'Nederlands'], ['Polish', 'Polski'], ['Ukrainian', 'Українська'],
  ['Hebrew', 'עברית'], ['Afrikaans', 'Afrikaans']];
const MOODS = ['Chill', 'Romance', 'Party', 'Workout', 'Focus', 'Sleep', 'Feel good', 'Sad', 'Devotional', 'Throwback', 'Road trip', 'Rainy day', 'Lo-fi', 'Dance'];
const YT_GENRES = ['Pop', 'Hip-Hop', 'Rock', 'EDM', 'Indie', 'R&B', 'Jazz', 'Classical', 'K-Pop', 'Latin', 'Metal', 'Country', 'Reggae', 'Blues', 'Folk', 'Ghazal', 'Carnatic', 'Sufi', 'Instrumental', 'Soundtrack'];
const GENRES = [['Electronic', 262], ['Hip-Hop/Rap', 18], ['Pop', 330], ['R&B/Soul', 290], ['Lo-Fi', 200], ['Rock', 2], ['Alternative', 170], ['Ambient', 188],
  ['Jazz', 38], ['Acoustic', 100], ['House', 302], ['Latin', 14], ['Classical', 222], ['Devotional', 48], ['World', 142], ['Soundtrack', 240]];
const RTAGS = [['pop', 'Pop'], ['bollywood', 'Bollywood'], ['tamil', 'Tamil'], ['hindi', 'Hindi'], ['telugu', 'Telugu'], ['malayalam', 'Malayalam'], ['lofi', 'Lo-Fi'],
  ['chillout', 'Chill'], ['jazz', 'Jazz'], ['classical', 'Classical'], ['rock', 'Rock'], ['hiphop', 'Hip-Hop'], ['dance', 'Dance'], ['80s', '80s Hits'], ['90s', '90s Hits'],
  ['kpop', 'K-Pop'], ['latin', 'Latin'], ['ambient', 'Ambient'], ['country', 'Country'], ['devotional', 'Devotional'], ['news', 'News'], ['talk', 'Talk']];
const COUNTRIES = [['', 'Automatic'], ['IN', 'India'], ['US', 'United States'], ['GB', 'United Kingdom'], ['SG', 'Singapore'], ['AE', 'United Arab Emirates'], ['AU', 'Australia'], ['CA', 'Canada'],
  ['DE', 'Germany'], ['FR', 'France'], ['ES', 'Spain'], ['IT', 'Italy'], ['NL', 'Netherlands'], ['JP', 'Japan'], ['KR', 'South Korea'], ['MY', 'Malaysia'], ['ID', 'Indonesia'],
  ['PH', 'Philippines'], ['LK', 'Sri Lanka'], ['BR', 'Brazil'], ['MX', 'Mexico'], ['ZA', 'South Africa'], ['NG', 'Nigeria']];
const ACCENTS = ['#ff375f', '#fa2d48', '#ff9f0a', '#30d158', '#40c8e0', '#0a84ff', '#5e5ce6', '#bf5af2', '#8e8e93'];
const EQ_F = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EQ_L = ['31', '62', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'];
const PRESETS = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'Bass Boost': [6, 5, 4, 2, 0, 0, 0, 0, 0, 0], 'Bass Reducer': [-6, -5, -4, -2, 0, 0, 0, 0, 0, 0],
  'Treble Boost': [0, 0, 0, 0, 0, 1, 2, 4, 5, 6], Vocal: [-2, -2, -1, 1, 3, 4, 3, 1, 0, -1], Pop: [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2],
  Rock: [4, 3, 2, 0, -1, -1, 1, 2, 3, 4], 'Hip-Hop': [5, 4, 1, 3, -1, -1, 1, 0, 2, 3], Electronic: [5, 4, 1, 0, -2, 2, 1, 1, 4, 5],
  Jazz: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3], Classical: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4], Acoustic: [4, 4, 3, 1, 2, 2, 3, 3, 2, 1],
  Loudness: [6, 4, 0, 0, -2, 0, -1, -3, 5, 1], 'Spoken Word': [-3, -1, 0, 1, 3, 4, 4, 3, 1, -2], 'Late Night': [3, 2, 1, 0, -1, -1, 0, 1, 2, 1],
};
function detectCC() {
  if (S.settings.country) return S.settings.country;
  let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { }
  const map = { 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Singapore': 'SG', 'Asia/Dubai': 'AE', 'Europe/London': 'GB', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Australia/Sydney': 'AU', 'Asia/Colombo': 'LK', 'Asia/Kuala_Lumpur': 'MY' };
  if (map[tz]) return map[tz];
  const r = (navigator.language || '').split('-')[1];
  return r && r.length === 2 ? r.toUpperCase() : 'US';
}
function countryName(cc) {
  const f = COUNTRIES.find(c => c[0] === cc); if (f && cc) return f[1];
  try { return new Intl.DisplayNames([navigator.language || 'en'], { type: 'region' }).of(cc); } catch (e) { return cc; }
}

/* ================= Audius / Deezer / Radio / Lyrics ================= */
const okTrack = x => x && !x.is_delete && x.is_streamable !== false && !x.stream_conditions;
const Audius = {
  host: '', hp: null,
  discover() {
    if (this.host) return Promise.resolve(this.host);
    if (!this.hp) this.hp = (async () => {
      try { const j = await getJSON('https://api.audius.co', 8000); const l = (j && j.data) || []; if (l.length) this.host = l[Math.floor(Math.random() * l.length)]; } catch (e) { }
      if (!this.host) this.host = 'https://api.audius.co';
      return this.host;
    })();
    return this.hp;
  },
  async get(path, params = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const host = (await this.discover()).replace(/\/$/, '');
      const u = new URL(host + '/v1' + path);
      Object.entries({ ...params, app_name: APP }).forEach(([k, v]) => { if (v !== undefined && v !== '') u.searchParams.set(k, v); });
      try { return (await getJSON(u.toString())).data; }
      catch (e) { if (attempt) throw e; this.host = ''; this.hp = null; }
    }
  },
  map(t) {
    const a = t.artwork || {};
    return { id: 'au:' + t.id, source: 'audius', sid: t.id, uid: t.user && t.user.id, title: t.title, artist: (t.user && t.user.name) || 'Unknown artist', handle: t.user && t.user.handle,
      art: a['480x480'] || a['150x150'] || '', artLarge: a['1000x1000'] || a['480x480'] || '', duration: t.duration, genre: t.genre, plays: t.play_count, permalink: t.permalink };
  },
  tracks(list) { return (list || []).filter(okTrack).map(x => this.map(x)); },
  streamUrl(t) { return `${(this.host || 'https://api.audius.co').replace(/\/$/, '')}/v1/tracks/${enc(t.sid)}/stream?app_name=${APP}`; },
  trending(genre = '', time = 'week') { return cached('au:tr:' + genre + time, 3e5, async () => this.tracks(await this.get('/tracks/trending', { genre, time }))); },
  underground() { return cached('au:ug', 3e5, async () => this.tracks(await this.get('/tracks/trending/underground'))); },
  search(q) { return cached('au:s:' + q, 3e5, async () => this.tracks(await this.get('/tracks/search', { query: q }))); },
  userTracks(id) { return cached('au:ut:' + id, 3e5, async () => this.tracks(await this.get(`/users/${enc(id)}/tracks`, { sort: 'plays', limit: 50 }))); },
};
const Deezer = {
  map(t) {
    return { id: 'dz:' + t.id, source: 'deezer', sid: t.id, title: t.title_short || t.title, artist: (t.artist && t.artist.name) || '', album: (t.album && t.album.title) || '',
      art: (t.album && t.album.cover_medium) || '', artLarge: (t.album && (t.album.cover_xl || t.album.cover_big)) || '', duration: t.duration, full: t.duration, url: t.preview, explicit: !!t.explicit_lyrics };
  },
  chart() { return cached('dz:chart', 6e5, async () => ((await jsonp('https://api.deezer.com/chart/0/tracks?limit=60')).data || []).map(this.map)); },
  async refresh(t) { const d = await jsonp('https://api.deezer.com/track/' + t.sid); return d && d.preview; },
};
const Radio = {
  bases: ['https://de1.api.radio-browser.info', 'https://fi1.api.radio-browser.info', 'https://de2.api.radio-browser.info', 'https://nl1.api.radio-browser.info'], bi: 0,
  async get(path) {
    let err;
    for (let k = 0; k < this.bases.length; k++) {
      const idx = (this.bi + k) % this.bases.length;
      try { const j = await getJSON(this.bases[idx] + path, 10000); this.bi = idx; return j; } catch (e) { err = e; }
    }
    throw err;
  },
  map(s) {
    const tags = (s.tags || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 2);
    return { id: 'rd:' + s.stationuuid, source: 'radio', sid: s.stationuuid, title: (s.name || 'Radio').trim(), artist: [s.country || s.countrycode, ...tags].filter(Boolean).join(' · ') || 'Live radio',
      art: s.favicon || '', url: s.url_resolved || s.url, live: true, home: s.homepage };
  },
  list(path) {
    return cached('rd:' + path, 3e5, async () => {
      const j = await this.get(path); const seen = new Set();
      return (j || []).filter(s => {
        const u = s.url_resolved || s.url || '';
        if (!u.startsWith('https://') && !NATIVE) return false;
        const k = (s.name || '').trim().toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true;
      }).map(s => this.map(s));
    });
  },
  top() { return this.list('/json/stations/topclick/150?hidebroken=true'); },
  country(cc) { return this.list(`/json/stations/bycountrycodeexact/${cc}?hidebroken=true&order=clickcount&reverse=true&limit=150`); },
  tag(t) { return this.list(`/json/stations/bytagexact/${enc(t)}?hidebroken=true&order=clickcount&reverse=true&limit=150`); },
  search(q) { return this.list(`/json/stations/search?name=${enc(q)}&hidebroken=true&order=clickcount&reverse=true&limit=80`); },
  click(t) { fetch(this.bases[this.bi] + '/json/url/' + t.sid).catch(() => { }); },
};
function parseLRC(s) {
  const out = [];
  for (const line of String(s).split(/\r?\n/)) {
    const tags = [...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (!tags.length) continue;
    const text = line.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of tags) out.push({ t: +m[1] * 60 + +m[2], text });
  }
  return out.sort((a, b) => a.t - b.t);
}
const Lyrics = {
  c: new Map(),
  async get(t) {
    if (this.c.has(t.id)) return this.c.get(t.id);
    const name = tidyTitle(t.title).replace(/\s*[([][^)\]]*(feat|ft\.|prod|remaster)[^)\]]*[)\]]/ig, '').split(/\s[|–-]\s/)[0].trim();
    const artist = (t.artist || '').split(/,|&| feat\.?| ft\.?| x /i)[0].trim();
    let r = null;
    try {
      const u = new URL('https://lrclib.net/api/get');
      u.searchParams.set('track_name', name); u.searchParams.set('artist_name', artist);
      const d = t.full || t.duration; if (d) u.searchParams.set('duration', Math.round(d));
      const res = await fetchT(u.toString(), {}, 10000); if (res.ok) r = await res.json();
    } catch (e) { }
    if (!r || (!r.syncedLyrics && !r.plainLyrics && !r.instrumental)) {
      try {
        const res = await fetchT('https://lrclib.net/api/search?q=' + enc(`${name} ${artist}`), {}, 10000);
        if (res.ok) { const arr = await res.json(); r = arr.find(x => x.syncedLyrics) || arr[0] || null; }
      } catch (e) { }
    }
    const out = { synced: r && r.syncedLyrics ? parseLRC(r.syncedLyrics) : null, plain: (r && r.plainLyrics) || '', instrumental: !!(r && r.instrumental) };
    this.c.set(t.id, out);
    return out;
  },
};

/* ================= YouTube Music engine ================= */
function tidyTitle(s) {
  const o = String(s || '');
  const r = o.replace(/\s*[([](?:official|lyric|lyrics|lyrical|audio|video|full video|full song|hd|4k|hq|visuali[sz]er|music video|video song|explicit)[^)\]]*[)\]]/ig, '').replace(/\s{2,}/g, ' ').trim();
  return r || o;
}
const tidyArtist = s => String(s || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/, '').trim();
const toSec = s => { if (typeof s === 'number') return s; const p = String(s || '').trim().split(':').map(Number); if (!p.length || p.length > 3 || p.some(isNaN)) return 0; return p.reduce((a, b) => a * 60 + b, 0); };
function sq(u, s) { if (!u) return ''; if (u.startsWith('//')) u = 'https:' + u; if (/googleusercontent|ggpht/.test(u) && /=[^=/]*$/.test(u)) return u.replace(/=[^=/]*$/, `=w${s}-h${s}-l90-rj`); return u; }
function mkYt(o) {
  if (!o || !o.id) return null;
  const art = o.art && !/i\.ytimg\.com|ytimg\.googleusercontent/.test(o.art) ? o.art : '';
  return clean({ id: 'yt:' + o.id, source: 'yt', sid: o.id, title: tidyTitle(o.title) || 'Untitled', artist: tidyArtist(o.artist) || 'Unknown artist', album: o.album || '',
    duration: toSec(o.duration) || 0, uid: o.uid || '',
    art: art ? sq(art, 226) : `https://i.ytimg.com/vi/${o.id}/mqdefault.jpg`, artLarge: art ? sq(art, 720) : `https://i.ytimg.com/vi/${o.id}/maxresdefault.jpg` });
}
const CAN_OPUS = (() => { try { return !!document.createElement('audio').canPlayType('audio/webm; codecs="opus"'); } catch (e) { return false; } })();
function pickAudio(list) {
  let l = list.filter(f => f.url && /audio\/(mp4|webm)/.test(f.mime || ''));
  if (!CAN_OPUS || IS_IOS) { const m = l.filter(f => /mp4/.test(f.mime)); if (m.length) l = m; }
  if (!l.length) l = list.filter(f => f.url);
  if (!l.length) return null;
  l.sort((a, b) => (+a.bitrate || 0) - (+b.bitrate || 0));
  const q = S.settings.quality;
  const p = q === 'saver' ? l[0] : q === 'normal' ? l[Math.floor((l.length - 1) / 2)] : l[l.length - 1];
  return { url: p.url, mime: p.mime || '' };
}
function expOf(u) { try { const e = +new URL(u, location.href).searchParams.get('expire'); if (e) return e * 1000; } catch (e) { } return Date.now() + 2 * 3600e3; }

/* --- InnerTube (YouTube Music's own API): used when the app runs without browser CORS limits (desktop/Android app) --- */
const txt = o => !o ? '' : typeof o === 'string' ? o : (o.simpleText || (o.runs || []).map(r => r.text).join(''));
function walk(o, fn) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { for (const x of o) walk(x, fn); return; }
  if (fn(o) === false) return;
  for (const k in o) { const v = o[k]; if (v && typeof v === 'object') walk(v, fn); }
}
function findKey(o, key) {
  let out;
  walk(o, n => { if (out !== undefined) return false; if (Object.prototype.hasOwnProperty.call(n, key)) { out = n[key]; return false; } });
  return out;
}
function bestThumb(o) { const th = findKey(o || {}, 'thumbnails'); return Array.isArray(th) && th.length ? th[th.length - 1].url : ''; }
const pageTypeOf = ep => String(findKey(ep || {}, 'pageType') || '');
const LABEL_SKIP = /^(song|video|single|ep|album|playlist|artist|episode|podcast|profile|station|community playlist)$/i;
function artistRuns(runs) {
  const ar = runs.filter(x => /ARTIST|USER_CHANNEL/.test(pageTypeOf(x.navigationEndpoint)));
  return { name: ar.map(x => x.text).join(', '), id: ar[0] ? ((ar[0].navigationEndpoint.browseEndpoint || {}).browseId || '') : '' };
}
function itItem(key, r) {
  if (key === 'playlistPanelVideoRenderer') {
    if (!r.videoId) return null;
    const by = (r.longBylineText || r.shortBylineText || {}).runs || [];
    const a = artistRuns(by);
    return mkYt({ id: r.videoId, title: txt(r.title), artist: a.name || (by[0] && by[0].text) || '', uid: a.id, duration: txt(r.lengthText), art: bestThumb(r.thumbnail) });
  }
  let title = '', runs = [], ep = null;
  if (key === 'musicTwoRowItemRenderer') { title = txt(r.title); runs = (r.subtitle && r.subtitle.runs) || []; ep = r.navigationEndpoint; }
  else {
    const cols = (r.flexColumns || []).map(c => (c.musicResponsiveListItemFlexColumnRenderer || {}).text).filter(Boolean);
    title = txt(cols[0]);
    const tr = cols[0] && cols[0].runs && cols[0].runs[0];
    ep = (tr && tr.navigationEndpoint) || r.navigationEndpoint;
    for (const c of cols.slice(1)) { if (runs.length) runs.push({ text: ' • ' }); runs.push(...(c.runs || [])); }
    for (const f of (r.fixedColumns || [])) { const t = txt((f.musicResponsiveListItemFixedColumnRenderer || {}).text); if (t) runs.push({ text: ' • ' }, { text: t }); }
  }
  ep = ep || r.navigationEndpoint || {};
  const browse = ep.browseEndpoint || (r.navigationEndpoint && r.navigationEndpoint.browseEndpoint);
  const pt = pageTypeOf(browse);
  const art = bestThumb(r.thumbnailRenderer || r.thumbnail);
  const parts = runs.map(x => x.text).join('').split(' • ').map(s => s.trim()).filter(Boolean);
  if (browse && browse.browseId && pt && !/WATCH/.test(pt)) {
    const kind = /ARTIST|USER_CHANNEL/.test(pt) ? 'artist' : /ALBUM/.test(pt) ? 'album' : 'playlist';
    const wp = findKey(r.overlay || {}, 'watchPlaylistEndpoint') || findKey(r.menu || {}, 'watchPlaylistEndpoint');
    return { kind, id: browse.browseId, title, sub: parts.filter(p => !LABEL_SKIP.test(p)).join(' · '), art: sq(art, 400), plId: wp && wp.playlistId, source: 'yt' };
  }
  const watch = ep.watchEndpoint || findKey(r.overlay || {}, 'watchEndpoint') || r.playlistItemData || {};
  if (!watch.videoId) return null;
  const a = artistRuns(runs);
  const album = (runs.find(x => /ALBUM/.test(pageTypeOf(x.navigationEndpoint))) || {}).text || '';
  const dur = parts.find(p => /^\d+(:\d{2})+$/.test(p)) || '';
  const artist = a.name || parts.find(p => !LABEL_SKIP.test(p) && !/^\d/.test(p) && !/views|plays/i.test(p)) || '';
  return mkYt({ id: watch.videoId, title, artist, uid: a.id, album, duration: dur, art });
}
const SHELF_KEYS = ['musicCarouselShelfRenderer', 'musicShelfRenderer', 'musicPlaylistShelfRenderer', 'gridRenderer', 'playlistPanelRenderer'];
const ITEM_KEYS = ['musicResponsiveListItemRenderer', 'musicTwoRowItemRenderer', 'playlistPanelVideoRenderer'];
function itShelves(j) {
  const out = [];
  walk(j, n => {
    for (const sk of SHELF_KEYS) {
      const s = n[sk]; if (!s || typeof s !== 'object') continue;
      const items = [];
      for (const c of (s.contents || s.items || [])) for (const ik of ITEM_KEYS) if (c && c[ik]) { try { const it = itItem(ik, c[ik]); if (it) items.push(it); } catch (e) { } }
      if (items.length) out.push({ title: txt(s.title) || txt(findKey(s.header || {}, 'title')) || '', items });
      return false;
    }
  });
  return out;
}
function findHeader(j) {
  let h = null;
  walk(j, n => {
    if (h) return false;
    for (const k of Object.keys(n)) if (/HeaderRenderer$/.test(k) && !/Shelf|Carousel|Card|Section|Tab|Chip/.test(k) && n[k] && n[k].title) { h = n[k]; return false; }
  });
  return h;
}
const CLIENTS = [
  { name: 'ANDROID_VR', id: 28, ver: '1.62.27', ua: 'com.google.android.apps.youtube.vr.oculus/1.62.27 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
    extra: { androidSdkVersion: 32, deviceMake: 'Oculus', deviceModel: 'Quest 3', osName: 'Android', osVersion: '12L' } },
  { name: 'IOS', id: 5, ver: '20.10.4', ua: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
    extra: { deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '18.3.2.22D82' } },
  { name: 'ANDROID', id: 3, ver: '20.10.38', ua: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip',
    extra: { androidSdkVersion: 34, osName: 'Android', osVersion: '14' } },
];
const SEARCH_PARAMS = { songs: 'EgWKAQIIAWoKEAkQBRAKEAMQBA==', albums: 'EgWKAQIYAWoKEAkQChAFEAMQBA==', artists: 'EgWKAQIgAWoKEAkQChAFEAMQBA==',
  playlists: 'EgeKAQQoADgBagoQCRAKEAUQAxAE', community: 'EgeKAQQoAEABagoQCRAKEAUQAxAE' };
const IT = {
  ok: null, p: null, failAt: 0,
  ver() { const d = new Date(Date.now() - 21 * 864e5); const z = n => String(n).padStart(2, '0'); return `1.${d.getUTCFullYear()}${z(d.getUTCMonth() + 1)}${z(d.getUTCDate())}.01.00`; },
  call(ep, body, q = '') {
    return lim(async () => {
      const r = await fetchT(`https://music.youtube.com/youtubei/v1/${ep}?prettyPrint=false${q}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: { client: { clientName: 'WEB_REMIX', clientVersion: this.ver(), hl: 'en', gl: detectCC() } }, ...body }),
      }, 12000);
      if (!r.ok) throw Object.assign(new Error('YTM ' + r.status), { status: r.status });
      return r.json();
    });
  },
  // Browsers block YouTube's API (CORS), so the direct engine only runs inside the desktop/Android apps.
  probe() {
    if (this.ok === true) return Promise.resolve(true);
    if (!NATIVE) { this.ok = false; return Promise.resolve(false); }
    if (this.ok === false && Date.now() - this.failAt < 120000) return Promise.resolve(false);
    if (!this.p) this.p = this.call('music/get_search_suggestions', { input: 'hello' }).then(() => (this.ok = true), () => { this.ok = false; this.failAt = Date.now(); return false; }).finally(() => { this.p = null; });
    return this.p;
  },
  async search(q, f) { const j = await this.call('search', { query: q, params: SEARCH_PARAMS[f] }); return itShelves(j).flatMap(s => s.items); },
  async suggest(q) {
    const j = await this.call('music/get_search_suggestions', { input: q }); const out = [];
    walk(j, n => { if (n.searchSuggestionRenderer) { out.push(txt(n.searchSuggestionRenderer.suggestion)); return false; } });
    return out.filter(Boolean);
  },
  async home() {
    return cached('it:home', 6e5, async () => {
      const j = await this.call('browse', { browseId: 'FEmusic_home' }); let sh = itShelves(j);
      try {
        const c = findKey(j, 'nextContinuationData');
        if (c && c.continuation) sh = sh.concat(itShelves(await this.call('browse', {}, `&ctoken=${enc(c.continuation)}&continuation=${enc(c.continuation)}&type=next`)));
      } catch (e) { }
      return sh;
    });
  },
  charts(gl) { return cached('it:ch:' + gl, 6e5, async () => itShelves(await this.call('browse', { browseId: 'FEmusic_charts', formData: { selectedValues: [gl] } }))); },
  moods() {
    return cached('it:moods', 36e5, async () => {
      const j = await this.call('browse', { browseId: 'FEmusic_moods_and_genres' }); const groups = [];
      walk(j, n => {
        if (!n.gridRenderer) return;
        const g = n.gridRenderer;
        const items = (g.items || []).map(i => i.musicNavigationButtonRenderer).filter(Boolean)
          .map(b => ({ title: txt(b.buttonText), params: ((b.clickCommand && b.clickCommand.browseEndpoint) || {}).params, color: b.solid && b.solid.leftStripeColor })).filter(x => x.params && x.title);
        if (items.length) groups.push({ title: txt(findKey(g.header || {}, 'title')) || 'Moods & genres', items });
        return false;
      });
      return groups;
    });
  },
  category(params) { return cached('it:cat:' + params, 6e5, async () => itShelves(await this.call('browse', { browseId: 'FEmusic_moods_and_genres_category', params }))); },
  async coll(c) {
    let id = c.id;
    if (c.kind === 'playlist' && !/^(VL|MPRE|UC|FE)/.test(id)) id = 'VL' + id;
    const j = await this.call('browse', { browseId: id });
    const sh = itShelves(j); const hd = findHeader(j) || {};
    const art = bestThumb(hd.thumbnail || hd.foregroundThumbnail || hd) || c.art;
    const title = txt(hd.title) || c.title;
    if (c.kind === 'artist') {
      const songs = sh.find(s => s.items.some(isTrack));
      return { title, art: sq(art, 720), sub: c.sub || 'Artist', tracks: songs ? songs.items.filter(isTrack) : [], shelves: sh.filter(s => s !== songs && s.items.some(x => !isTrack(x))) };
    }
    const sub = [txt(hd.straplineTextOne), txt(hd.subtitle), txt(hd.secondSubtitle)].filter(Boolean).join(' · ') || c.sub || '';
    const hdArtist = txt(hd.straplineTextOne) || (txt(hd.subtitle).split(' • ')[1] || '');
    const tracks = []; const seen = new Set();
    for (const s of sh) for (const t of s.items) if (isTrack(t) && !seen.has(t.id)) { seen.add(t.id); tracks.push(t); }
    tracks.forEach(t => {
      if (c.kind === 'album' && art && /i\.ytimg/.test(t.art)) { t.art = sq(art, 226); t.artLarge = sq(art, 720); }
      if (t.artist === 'Unknown artist' && hdArtist) t.artist = hdArtist;
      if (c.kind === 'album' && !t.album) t.album = title;
    });
    if (!tracks.length) throw softErr('empty collection');
    return { title, art: sq(art, 720), sub, tracks };
  },
  async next(id) {
    const j = await this.call('next', { videoId: id, playlistId: 'RDAMVM' + id, isAudioOnly: true, tunerSettingValue: 'AUTOMIX_SETTING_NORMAL' });
    const out = [];
    walk(j, n => { if (n.playlistPanelVideoRenderer) { const it = itItem('playlistPanelVideoRenderer', n.playlistPanelVideoRenderer); if (it) out.push(it); return false; } });
    return out.filter(x => x.sid !== id);
  },
  async player(videoId) {
    let last;
    for (const c of CLIENTS) {
      try {
        const headers = { 'Content-Type': 'application/json', 'X-YouTube-Client-Name': String(c.id), 'X-YouTube-Client-Version': c.ver };
        if (IS_CAP) headers['User-Agent'] = c.ua; else headers['X-TT-UA'] = c.ua;
        const r = await fetchT('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
          method: 'POST', headers,
          body: JSON.stringify({ context: { client: { clientName: c.name, clientVersion: c.ver, hl: 'en', gl: detectCC(), ...c.extra } }, videoId, contentCheckOk: true, racyCheckOk: true }),
        }, 12000);
        if (!r.ok) throw new Error('player ' + r.status);
        const j = await r.json();
        const st = j.playabilityStatus && j.playabilityStatus.status;
        if (st !== 'OK') throw new Error(st || 'unplayable');
        const fm = ((j.streamingData && j.streamingData.adaptiveFormats) || []).filter(f => f.url && /^audio\//.test(f.mimeType || ''))
          .map(f => ({ url: f.url, mime: f.mimeType, bitrate: f.averageBitrate || f.bitrate || 0 }));
        const p = pickAudio(fm);
        if (p) return { ...p, via: 'direct' };
        throw new Error('no audio formats');
      } catch (e) { last = e; }
    }
    throw last || new Error('direct failed');
  },
};

/* --- public mirrors (Piped & Invidious): used in the browser --- */
const PIPED_DEFAULT = ['https://pipedapi.kavin.rocks', 'https://pipedapi.adminforge.de', 'https://api.piped.private.coffee', 'https://pipedapi.reallyaweso.me',
  'https://pipedapi.leptons.xyz', 'https://pipedapi.nosebs.ru', 'https://piped-api.lunar.icu', 'https://pipedapi.drgns.space', 'https://pipedapi.ducks.party', 'https://pipedapi.r4fo.com'];
const INV_DEFAULT = ['https://inv.nadeko.net', 'https://invidious.nerdvpn.de', 'https://yewtu.be', 'https://invidious.privacyredirect.com', 'https://iv.ggtyler.dev',
  'https://invidious.jing.rocks', 'https://invidious.f5.si', 'https://inv.tux.pizza'];
const Mirrors = {
  piped: PIPED_DEFAULT.slice(), inv: INV_DEFAULT.slice(), fails: new Map(), best: {}, loaded: null,
  init() {
    try {
      const c = JSON.parse(localStorage.getItem('tunetune.mirrors') || 'null');
      if (c) { if (c.best) this.best = c.best; if (Date.now() - c.t < 864e5) { this.piped = uniq([...(c.piped || []), ...this.piped]); this.inv = uniq([...(c.inv || []), ...this.inv]); } }
    } catch (e) { }
  },
  load() {
    if (this.loaded) return this.loaded;
    this.loaded = (async () => {
      const [p, v] = await Promise.allSettled([getJSON('https://piped-instances.kavin.rocks/', 6000), getJSON('https://api.invidious.io/instances.json?sort_by=type,users', 6000)]);
      if (p.status === 'fulfilled' && Array.isArray(p.value)) {
        const l = p.value.filter(x => x && x.api_url).sort((a, b) => (b.uptime_24h || 0) - (a.uptime_24h || 0)).map(x => x.api_url.replace(/\/+$/, ''));
        this.piped = uniq([...l, ...this.piped]);
      }
      if (v.status === 'fulfilled' && Array.isArray(v.value)) {
        const l = v.value.filter(x => x && x[1] && x[1].api && x[1].cors && x[1].type === 'https').map(x => (x[1].uri || 'https://' + x[0]).replace(/\/+$/, ''));
        this.inv = uniq([...l, ...this.inv]);
      }
      this.persist();
    })().catch(() => { });
    return this.loaded;
  },
  order(kind) {
    const now = Date.now();
    const custom = S.settings.mirror ? [S.settings.mirror.replace(/\/+$/, '')] : [];
    const L = uniq([...custom, this.best[kind], ...this[kind]]);
    const recent = b => now - (this.fails.get(b) || 0) < 6e5;
    return L.filter(b => !recent(b)).concat(L.filter(recent));
  },
  good(kind, b) { this.fails.delete(b); if (this.best[kind] !== b) { this.best[kind] = b; this.persist(); } },
  bad(kind, b) { this.fails.set(b, Date.now()); if (this.best[kind] === b) { delete this.best[kind]; this.persist(); } },
  persist() { try { localStorage.setItem('tunetune.mirrors', JSON.stringify({ t: Date.now(), piped: this.piped.slice(0, 25), inv: this.inv.slice(0, 25), best: this.best })); } catch (e) { } },
};
async function viaMirror(kind, path, tries = 4) {
  await Promise.race([Mirrors.load(), sleep(2500)]);
  let err = new Error('No mirror available');
  for (const b of Mirrors.order(kind).slice(0, tries)) {
    try {
      const j = await lim(() => getJSON(b + path, 9000));
      if (!j || j.error) throw new Error((j && j.error) || 'empty');
      Mirrors.good(kind, b); return j;
    } catch (e) { err = e; Mirrors.bad(kind, b); }
  }
  throw err;
}
const idFrom = (url, key) => { const m = String(url || '').match(new RegExp(key + '([\\w-]+)')); return m ? m[1] : ''; };
function pipedTrack(it) {
  if (!it || (it.type && it.type !== 'stream')) return null;
  const id = idFrom(it.url, 'v='); if (!id) return null;
  return mkYt({ id, title: it.title, artist: it.uploaderName, duration: it.duration > 0 ? it.duration : 0, uid: idFrom(it.uploaderUrl, '/channel/') });
}
function pipedColl(it, kind) {
  if (!it) return null;
  if (it.type === 'playlist') { const id = idFrom(it.url, 'list='); return id ? { kind: kind || 'playlist', id, plId: id, title: it.name, sub: tidyArtist(it.uploaderName || ''), art: it.thumbnail, source: 'yt' } : null; }
  if (it.type === 'channel') { const id = idFrom(it.url, '/channel/'); return id ? { kind: 'artist', id, title: tidyArtist(it.name), sub: it.subscribers > 0 ? compact(it.subscribers) + ' subscribers' : 'Artist', art: it.thumbnail, source: 'yt' } : null; }
  return null;
}
function invTrack(v) { if (!v || (v.type && v.type !== 'video')) return null; return mkYt({ id: v.videoId, title: v.title, artist: v.author, duration: v.lengthSeconds, uid: v.authorId }); }
function invColl(p) {
  if (!p) return null;
  if (p.type === 'playlist') return { kind: 'playlist', id: p.playlistId, plId: p.playlistId, title: p.title, sub: p.author || '', art: p.playlistThumbnail || (p.videos && p.videos[0] ? `https://i.ytimg.com/vi/${p.videos[0].videoId}/mqdefault.jpg` : ''), source: 'yt' };
  if (p.type === 'channel') { const th = (p.authorThumbnails || []).slice(-1)[0]; return { kind: 'artist', id: p.authorId, title: tidyArtist(p.author), sub: p.subCount ? compact(p.subCount) + ' subscribers' : 'Artist', art: th ? sq(th.url, 400) : '', source: 'yt' }; }
  return null;
}
async function firstOk(fns) {
  let err;
  for (const f of fns) {
    try { const r = await f(); if (r && (!Array.isArray(r) || r.length)) return r; }
    catch (e) { err = e; }
  }
  if (err) throw err;
  return [];
}
const YT = {
  songs(q) {
    return cached('ys:' + q, 6e5, () => firstOk([
      async () => ((await IT.probe()) ? (await IT.search(q, 'songs')).filter(isTrack) : null),
      async () => ((await viaMirror('piped', `/search?q=${enc(q)}&filter=music_songs`)).items || []).map(pipedTrack).filter(Boolean),
      async () => ((await viaMirror('inv', `/api/v1/search?q=${enc(q)}&type=video`)) || []).map(invTrack).filter(Boolean),
    ]));
  },
  playlists(q) {
    return cached('yp:' + q, 6e5, () => firstOk([
      async () => ((await IT.probe()) ? (await IT.search(q, 'playlists')).filter(x => !isTrack(x)) : null),
      async () => ((await IT.probe()) ? (await IT.search(q, 'community')).filter(x => !isTrack(x)) : null),
      async () => ((await viaMirror('piped', `/search?q=${enc(q)}&filter=music_playlists`)).items || []).map(x => pipedColl(x)).filter(Boolean),
      async () => ((await viaMirror('inv', `/api/v1/search?q=${enc(q)}&type=playlist`)) || []).map(invColl).filter(Boolean),
    ]));
  },
  albums(q) {
    return cached('yl:' + q, 6e5, () => firstOk([
      async () => ((await IT.probe()) ? (await IT.search(q, 'albums')).filter(x => !isTrack(x)) : null),
      async () => ((await viaMirror('piped', `/search?q=${enc(q)}&filter=music_albums`)).items || []).map(x => pipedColl(x, 'album')).filter(Boolean),
      async () => ((await viaMirror('inv', `/api/v1/search?q=${enc(q + ' album')}&type=playlist`)) || []).map(invColl).filter(Boolean),
    ]));
  },
  artists(q) {
    return cached('ya:' + q, 6e5, () => firstOk([
      async () => ((await IT.probe()) ? (await IT.search(q, 'artists')).filter(x => x.kind === 'artist') : null),
      async () => ((await viaMirror('piped', `/search?q=${enc(q)}&filter=music_artists`)).items || []).map(x => pipedColl(x)).filter(Boolean),
      async () => ((await viaMirror('inv', `/api/v1/search?q=${enc(q)}&type=channel`)) || []).map(invColl).filter(Boolean),
    ]));
  },
  related(t) {
    const id = t.sid;
    return cached('yr:' + id, 6e5, () => firstOk([
      async () => ((await IT.probe()) ? IT.next(id) : null),
      async () => ((await viaMirror('piped', `/streams/${id}`)).relatedStreams || []).filter(x => !x.duration || (x.duration > 60 && x.duration < 720)).map(pipedTrack).filter(Boolean),
      async () => ((await viaMirror('inv', `/api/v1/videos/${id}`)).recommendedVideos || []).filter(x => !x.lengthSeconds || x.lengthSeconds < 720).map(v => invTrack({ ...v, type: 'video' })).filter(Boolean),
    ]));
  },
  suggest(q) {
    return cached('yg:' + q, 3e5, () => firstOk([
      async () => ((await IT.probe()) ? IT.suggest(q) : null),
      async () => (await viaMirror('piped', `/suggestions?query=${enc(q)}`, 2)) || [],
      async () => ((await viaMirror('inv', `/api/v1/search/suggestions?q=${enc(q)}`, 2)).suggestions) || [],
    ]));
  },
  collection(c) {
    return cached('yc:' + c.kind + c.id, 6e5, () => firstOk([
      async () => ((await IT.probe()) ? IT.coll(c) : null),
      async () => {
        if (c.kind === 'artist') {
          const j = await viaMirror('piped', `/channel/${c.id}`);
          return { title: tidyArtist(j.name) || c.title, art: j.avatarUrl || c.art, sub: j.subscriberCount > 0 ? compact(j.subscriberCount) + ' subscribers' : c.sub, tracks: (j.relatedStreams || []).map(pipedTrack).filter(Boolean), shelves: [] };
        }
        const id = c.plId || (String(c.id).startsWith('VL') ? c.id.slice(2) : c.id);
        if (/^MPRE/.test(id)) throw softErr('album needs the direct engine');
        const j = await viaMirror('piped', `/playlists/${id}`);
        const tracks = (j.relatedStreams || []).map(pipedTrack).filter(Boolean); if (!tracks.length) throw softErr('empty');
        return { title: j.name || c.title, art: c.art || j.thumbnailUrl, sub: tidyArtist(j.uploader || '') || c.sub, tracks };
      },
      async () => {
        if (c.kind === 'artist') {
          const j = await viaMirror('inv', `/api/v1/channels/${c.id}`);
          return { title: tidyArtist(j.author) || c.title, art: c.art, sub: c.sub, tracks: (j.latestVideos || []).map(v => invTrack({ ...v, type: 'video' })).filter(Boolean), shelves: [] };
        }
        const id = c.plId || (String(c.id).startsWith('VL') ? c.id.slice(2) : c.id);
        const j = await viaMirror('inv', `/api/v1/playlists/${id}`);
        return { title: j.title || c.title, art: c.art, sub: j.author || c.sub, tracks: (j.videos || []).map(v => invTrack({ ...v, type: 'video' })).filter(Boolean) };
      },
    ]));
  },
  async match(t) {
    const r = await this.songs(`${t.title} ${t.artist}`);
    return r[0] || null;
  },
};

/* --- audio stream resolver: direct → Piped → Invidious, with caching & expiry --- */
const Streams = {
  c: new Map(), pending: new Map(),
  get(id, avoid) {
    avoid = avoid || new Set();
    const hit = this.c.get(id);
    if (hit && hit.exp > Date.now() + 90e3 && !avoid.has(hit.via)) return Promise.resolve(hit);
    const key = id + '|' + [...avoid].join(',');
    if (this.pending.has(key)) return this.pending.get(key);
    const p = this.resolve(id, avoid).finally(() => this.pending.delete(key));
    this.pending.set(key, p);
    return p;
  },
  async resolve(id, avoid) {
    let err = null;
    if (!avoid.has('direct') && await IT.probe()) { try { return this.put(id, await IT.player(id)); } catch (e) { err = e; } }
    await Promise.race([Mirrors.load(), sleep(2500)]);
    for (const b of Mirrors.order('piped').slice(0, 4)) {
      const via = 'piped:' + b; if (avoid.has(via)) continue;
      try {
        const j = await getJSON(`${b}/streams/${id}`, 12000);
        if (j.error) throw softErr(j.error);
        const p = pickAudio((j.audioStreams || []).filter(s => s.url && !s.videoOnly).map(s => ({ url: s.url, mime: s.mimeType || '', bitrate: s.bitrate || 0 })));
        if (!p) throw softErr('no audio');
        Mirrors.good('piped', b); return this.put(id, { ...p, via });
      } catch (e) { err = e; if (hardFail(e)) Mirrors.bad('piped', b); }
    }
    for (const b of Mirrors.order('inv').slice(0, 4)) {
      const via = 'inv:' + b; if (avoid.has(via)) continue;
      try {
        const j = await getJSON(`${b}/api/v1/videos/${id}?local=true`, 12000);
        if (j.error) throw softErr(j.error);
        const p = pickAudio((j.adaptiveFormats || []).filter(f => f.url && /^audio\//.test(f.type || '')).map(f => ({ url: f.url.startsWith('/') ? b + f.url : f.url, mime: f.type, bitrate: +f.bitrate || 0 })));
        if (!p) throw softErr('no audio');
        Mirrors.good('inv', b); return this.put(id, { ...p, via });
      } catch (e) { err = e; if (hardFail(e)) Mirrors.bad('inv', b); }
    }
    throw err || new Error('No stream available');
  },
  put(id, s) { const v = { ...s, exp: expOf(s.url) }; this.c.set(id, v); if (this.c.size > 200) this.c.delete(this.c.keys().next().value); return v; },
  drop(id) { if (id) this.c.delete(id); },
};
const ytIdOf = t => (t.source === 'yt' ? t.sid : t.ytId);

/* ================= registries for on-screen lists ================= */
const REG = new Map(); let regN = 0;
function reg(tracks, meta = {}) {
  const k = 'l' + (++regN); REG.set(k, { tracks, meta });
  if (REG.size > 500) { const it = REG.keys(); for (let n = 0; n < 100; n++) REG.delete(it.next().value); }
  return k;
}
const REGC = new Map(); let regcN = 0;
function regc(c) {
  const k = 'c' + (++regcN); REGC.set(k, c);
  if (REGC.size > 800) { const it = REGC.keys(); for (let n = 0; n < 200; n++) REGC.delete(it.next().value); }
  return k;
}

/* ================= player ================= */
const SILENT = (() => {
  const n = 800, b = new ArrayBuffer(44 + n), v = new DataView(b);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  try { return URL.createObjectURL(new Blob([b], { type: 'audio/wav' })); } catch (e) { return ''; }
})();

const Player = {
  queue: [], i: -1, orig: null, shuffle: false, repeat: 'off', from: '',
  plain: null, fx: null, el: null, ctx: null, pre: null, filters: [],
  objUrl: null, ltok: 0, loaded: false, resumeAt: 0, rate: 1, vol: 1, isBlob: false, pendingSeek: 0,
  wantPlay: false, loading: false, srcAt: 0, lastProgress: 0, lastT: -1, resumeTries: 0, avoid: new Set(), attempts: 0, failRun: 0,
  via: '', previewMode: false, prefetched: false, extending: null, badCors: new Set(), waitOnline: false,
  sleepT: null, sleepAt: 0, sleepEnd: false,
  get cur() { return this.queue[this.i] || null; },

  init() {
    this.plain = this.mk(false); this.el = this.plain;
    this.setVol(S.settings.volume == null ? 1 : S.settings.volume, true);
    this.session(); this.restore();
    setInterval(() => this.persist(), 5000);
    setInterval(() => this.watch(), 4000);
    addEventListener('pagehide', () => this.persist());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.persist(); });
  },
  mk(fx) {
    const a = document.createElement('audio'); a.preload = 'auto'; if (fx) a.crossOrigin = 'anonymous';
    ['timeupdate', 'play', 'playing', 'pause', 'ended', 'error', 'loadedmetadata', 'durationchange'].forEach(ev => a.addEventListener(ev, () => { if (a === this.el && a.src !== SILENT) this.on(ev); }));
    return a;
  },
  on(ev) {
    const a = this.el, t = this.cur;
    if (ev === 'timeupdate') {
      if (a.currentTime !== this.lastT) { this.lastT = a.currentTime; this.lastProgress = Date.now(); }
      UI.time(); this.ahead();
    } else if (ev === 'durationchange') UI.time();
    else if (ev === 'play') UI.state();
    else if (ev === 'playing') { this.loading = false; this.resumeTries = 0; this.failRun = 0; this.wantPlay = true; this.lastProgress = Date.now(); UI.state(); }
    else if (ev === 'pause') { if (!this.loading && !a.ended) this.wantPlay = false; UI.state(); }
    else if (ev === 'loadedmetadata') {
      if (this.pendingSeek) { try { a.currentTime = this.pendingSeek; } catch (e) { } this.pendingSeek = 0; }
      a.playbackRate = t && t.live ? 1 : this.rate; UI.time();
    }
    else if (ev === 'ended') this.ended();
    else if (ev === 'error') this.fail();
  },
  ahead() {
    const t = this.cur, a = this.el; if (!t || t.live) return;
    if (!this.prefetched && a.currentTime > 8) { this.prefetched = true; this.prefetch(); }
    if (S.settings.autoplay && this.repeat === 'off' && this.i >= this.queue.length - 1 && !this.extending && isFinite(a.duration) && a.duration - a.currentTime < 45) this.autoExtend();
  },
  prefetch() {
    const n = this.queue[this.i + 1]; if (!n || n.live || isDl(n.id)) return;
    if (n.source === 'yt') Streams.get(n.sid).catch(() => { });
    else if (n.source === 'deezer') {
      const go = id => Streams.get(id).catch(() => { });
      if (n.ytId) go(n.ytId); else YT.match(n).then(m => { if (m) { n.ytId = m.sid; go(m.sid); } }).catch(() => { });
    }
  },
  async fail() {
    const t = this.cur, a = this.el;
    if (!t || !a.getAttribute('src')) return;
    const pos = t.live ? 0 : (a.currentTime || this.pendingSeek || 0);
    if (a === this.fx && !this.isBlob) {
      try { this.badCors.add(new URL(a.src).host); } catch (e) { }
      if (!document.hidden) toast('Equalizer isn’t available for this stream — playing without it');
      return this.load(true, pos, true);
    }
    if (this.isBlob) { toast('This saved file can’t be played'); return this.skipAfterFail(t); }
    const yid = ytIdOf(t);
    if (yid && !this.previewMode && this.attempts < 4) {
      this.attempts++; if (this.via) this.avoid.add(this.via); Streams.drop(yid);
      return this.load(true, pos, true);
    }
    if (t.source === 'deezer' && this.previewMode && this.attempts < 5) {
      this.attempts++;
      try { const u = await Deezer.refresh(t); if (u) { t.url = u; return this.load(true, 0, true); } } catch (e) { }
    }
    if ((t.source === 'audius' || t.live) && this.attempts < 1) {
      this.attempts++; if (t.source === 'audius') { Audius.host = ''; Audius.hp = null; }
      return this.load(true, pos, true);
    }
    if (!document.hidden) toast(t.live ? 'This station is offline right now' : `Can’t play “${t.title}” — moving on`);
    this.skipAfterFail(t);
  },
  skipAfterFail(t) {
    this.loading = false; UI.state();
    this.failRun++;
    if (this.failRun >= 6) {
      this.wantPlay = false; this.failRun = 0;
      toast('Music sources aren’t responding. Check your connection, then press play.');
      return;
    }
    if (this.i < this.queue.length - 1 || (S.settings.autoplay && !t.live)) setTimeout(() => { if (this.cur === t) this.next(true); }, 900);
  },
  async load(autoplay = true, startAt = 0, quiet = false) {
    const t = this.cur; if (!t) return;
    const tok = ++this.ltok; this.loaded = true;
    if (!quiet) { this.attempts = 0; this.avoid = new Set(); this.via = ''; this.prefetched = false; this.previewMode = false; addHistory(t); }
    if (autoplay) this.wantPlay = true;
    this.loading = true; this.waitOnline = false;
    UI.track(t); UI.state();
    let src = '', blob = false;
    if (t.source === 'local' || isDl(t.id)) {
      try {
        const b = await DB.get(t.id); if (tok !== this.ltok) return;
        if (b) { if (this.objUrl) URL.revokeObjectURL(this.objUrl); this.objUrl = URL.createObjectURL(b); src = this.objUrl; blob = true; this.via = 'saved'; }
      } catch (e) { }
    }
    if (!src) {
      if (t.source === 'local') { toast('This file is no longer on this device'); return this.skipAfterFail(t); }
      if (!navigator.onLine) {
        this.loading = false; this.waitOnline = true; this.resumeAt = startAt;
        toast('You’re offline — it will start when you’re back online'); UI.state(); return;
      }
      try {
        if (t.source === 'audius') { await Audius.discover(); src = Audius.streamUrl(t); this.via = 'audius'; }
        else if (t.source === 'radio') { src = t.url; this.via = 'radio'; }
        else {
          let yid = ytIdOf(t);
          if (!yid && t.source === 'deezer' && !this.previewMode) { try { const m = await YT.match(t); if (m) { yid = t.ytId = m.sid; } } catch (e) { } }
          if (tok !== this.ltok) return;
          if (yid && !this.previewMode) {
            try { const s = await Streams.get(yid, this.avoid); src = s.url; this.via = s.via; }
            catch (e) { if (t.source === 'yt') throw e; }
          }
          if (!src && t.source === 'deezer' && t.url) { this.previewMode = true; src = t.url; this.via = 'preview'; if (!document.hidden) toast('Full song unavailable right now — playing a 30-second preview'); }
        }
      } catch (e) {
        if (tok !== this.ltok) return;
        console.warn('stream', e);
        if (!document.hidden) toast(`Can’t play “${t.title}” — moving on`);
        return this.skipAfterFail(t);
      }
      if (tok !== this.ltok) return;
    }
    if (!src) return this.skipAfterFail(t);
    this.isBlob = blob;
    let host = ''; try { host = new URL(src, location.href).host; } catch (e) { }
    const fx = !!(S.settings.eqOn && !t.live && this.via !== 'preview' && (blob || !this.badCors.has(host)));
    this.route(fx);
    const a = this.el;
    this.pendingSeek = startAt > 0 ? startAt : 0; this.srcAt = Date.now(); this.lastProgress = Date.now(); this.lastT = -1;
    a.src = src;
    a.defaultPlaybackRate = a.playbackRate = t.live ? 1 : this.rate;
    UI.track(t); this.meta(t);
    if (t.live && !quiet) Radio.click(t);
    if (autoplay) this.play(); else { this.loading = false; UI.state(); }
  },
  async play() {
    this.wantPlay = true;
    try {
      if (this.ctx && this.ctx.state !== 'running') await this.ctx.resume();
      await this.el.play();
    } catch (e) {
      if (e && e.name === 'NotAllowedError') { this.loading = false; UI.state(); if (!document.hidden) toast('Tap play to start'); }
    }
  },
  userPause() { this.wantPlay = false; this.el.pause(); },
  route(fx) {
    if (fx && !this.ensureFx()) fx = false;
    const target = fx ? this.fx : this.plain;
    if (target !== this.el) {
      const old = this.el; this.el = target; target.volume = this.vol;
      old.pause(); old.removeAttribute('src'); try { old.load(); } catch (e) { }
    }
  },
  ensureFx() {
    if (this.fx) return true;
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return false;
    try {
      const a = this.mk(true); this.ctx = new C();
      const src = this.ctx.createMediaElementSource(a);
      this.pre = this.ctx.createGain(); src.connect(this.pre);
      let n = this.pre;
      this.filters = EQ_F.map((f, i) => {
        const b = this.ctx.createBiquadFilter();
        b.type = i === 0 ? 'lowshelf' : i === EQ_F.length - 1 ? 'highshelf' : 'peaking';
        b.frequency.value = f; b.Q.value = 1.4; n.connect(b); n = b; return b;
      });
      n.connect(this.ctx.destination);
      this.fx = a; a.volume = this.vol; this.applyEq(); return true;
    } catch (e) { console.warn('EQ unavailable', e); return false; }
  },
  applyEq() {
    if (!this.filters.length) return;
    const g = S.settings.eq; const max = Math.max(0, ...g);
    this.filters.forEach((f, i) => { f.gain.value = g[i] || 0; });
    this.pre.gain.value = Math.pow(10, (-max * 0.6) / 20);
  },
  reroute() {
    const t = this.cur; if (!t || !this.loaded) return;
    this.load(!this.el.paused, t.live ? 0 : (this.el.currentTime || 0), true);
  },
  toggle() {
    if (!this.cur) return;
    if (this.loading && this.wantPlay) {
      this.ltok++; this.wantPlay = false; this.loading = false; this.loaded = false;
      this.resumeAt = this.el.currentTime || this.pendingSeek || 0; this.el.pause(); UI.state(); return;
    }
    if (!this.loaded || this.waitOnline) return this.load(true, this.resumeAt, true);
    if (this.el.paused) this.play(); else this.userPause();
  },
  seek(s) {
    const t = this.cur; if (!t || t.live) return;
    if (!this.loaded) { this.resumeAt = Math.max(0, s); return this.load(true, this.resumeAt, true); }
    const a = this.el; if (isFinite(a.duration)) a.currentTime = clamp(s, 0, Math.max(0, a.duration - 0.25));
    UI.time();
  },
  playList(list, idx = 0, from = '', shuffle = null) {
    if (!list || !list.length) return;
    if (shuffle !== null) this.shuffle = shuffle;
    this.from = from; this.failRun = 0;
    const L = list.map(x => ({ ...x }));
    if (this.shuffle) { this.orig = L.slice(); const first = L.splice(idx, 1)[0]; this.queue = [first, ...shuf(L)]; this.i = 0; }
    else { this.orig = null; this.queue = L; this.i = idx; }
    this.load(true); UI.modes(); qRefresh();
  },
  playNext(t) {
    if (!this.cur) return this.playList([t], 0, 'Queue');
    this.queue.splice(this.i + 1, 0, { ...t }); if (this.orig) this.orig.push({ ...t });
    toast('Playing next'); qRefresh();
  },
  enqueue(t) {
    if (!this.cur) return this.playList([t], 0, 'Queue');
    this.queue.push({ ...t }); if (this.orig) this.orig.push({ ...t });
    toast('Added to queue'); qRefresh();
  },
  async next(auto = false) {
    if (!this.queue.length) return;
    if (this.i < this.queue.length - 1) { this.i++; return this.load(true); }
    if (this.repeat === 'all') { this.i = 0; return this.load(true); }
    if (await this.autoExtend() && this.i < this.queue.length - 1) { this.i++; return this.load(true); }
    if (auto) { this.wantPlay = false; this.el.pause(); try { this.el.currentTime = 0; } catch (e) { } UI.state(); }
    else toast('That’s the end of the queue');
  },
  autoExtend() {
    if (this.extending) return this.extending;
    this.extending = (async () => {
      const c = this.cur;
      if (!S.settings.autoplay || !c || c.live) return false;
      const have = new Set(this.queue.map(x => x.id));
      let pool = [];
      const yid = ytIdOf(c);
      if (yid) { try { pool = (await YT.related({ sid: yid })).filter(x => !have.has(x.id)); } catch (e) { } }
      if (!pool.length && c.source !== 'audius') {
        try { pool = shuf((await YT.songs(`${myLangs()[0]} top songs ${YEAR}`)).filter(x => !have.has(x.id))); } catch (e) { }
      }
      if (!pool.length) {
        try {
          let a = (await Audius.trending(c.source === 'audius' ? (c.genre || '') : '')).filter(x => !have.has(x.id));
          if (!a.length) a = (await Audius.trending()).filter(x => !have.has(x.id));
          pool = shuf(a);
        } catch (e) { }
      }
      pool = pool.slice(0, 20);
      if (!pool.length) return false;
      this.queue.push(...pool); if (this.orig) this.orig.push(...pool);
      if (!document.hidden) toast('Autoplay — similar songs added'); qRefresh();
      return true;
    })().finally(() => { this.extending = null; });
    return this.extending;
  },
  prev() {
    const t = this.cur; if (!t) return;
    if (!t.live && this.loaded && this.el.currentTime > 3) { this.el.currentTime = 0; return; }
    if (this.i > 0) { this.i--; this.load(true); }
    else if (!t.live && this.loaded) this.el.currentTime = 0;
  },
  jump(i) { if (i < 0 || i >= this.queue.length) return; this.i = i; this.load(true); qRefresh(); },
  removeAt(i) {
    if (i === this.i) return;
    const t = this.queue.splice(i, 1)[0]; if (i < this.i) this.i--;
    if (this.orig && t) { const k = this.orig.findIndex(x => x.id === t.id); if (k >= 0) this.orig.splice(k, 1); }
    qRefresh();
  },
  clearUpNext() { this.queue.length = this.i + 1; if (this.orig) this.orig = this.queue.slice(); qRefresh(); toast('Up Next cleared'); },
  setShuffle(on, silent) {
    this.shuffle = on; const c = this.cur;
    if (c) {
      if (on) { this.orig = this.queue.slice(); const rest = this.queue.filter((x, k) => k !== this.i); this.queue = [c, ...shuf(rest)]; this.i = 0; }
      else if (this.orig) { const k = this.orig.findIndex(x => x.id === c.id); this.queue = this.orig; this.i = k >= 0 ? k : 0; this.orig = null; }
    }
    UI.modes(); qRefresh(); if (!silent) toast(on ? 'Shuffle on' : 'Shuffle off');
  },
  cycleRepeat() {
    this.repeat = this.repeat === 'off' ? 'all' : this.repeat === 'all' ? 'one' : 'off';
    UI.modes(); qRefresh(); toast(this.repeat === 'off' ? 'Repeat off' : this.repeat === 'all' ? 'Repeat all' : 'Repeat this song');
  },
  ended() {
    if (this.sleepEnd) { this.sleepEnd = false; this.wantPlay = false; UI.state(); UI.timerBtn(); toast('Sleep timer — paused'); return; }
    if (this.repeat === 'one') { this.el.currentTime = 0; this.play(); return; }
    this.next(true);
  },
  // Watchdog: restarts stalled streams, resumes after network drops, retries blocked starts.
  watch() {
    const t = this.cur, a = this.el; if (!t || !this.loaded) return;
    if (this.waitOnline) { if (navigator.onLine) { this.waitOnline = false; this.load(this.wantPlay, this.resumeAt || 0, true); } return; }
    if (!this.wantPlay || !navigator.onLine) return;
    const now = Date.now();
    if (this.loading) {
      if (a.getAttribute('src') && now - this.srcAt > 25000 && a.readyState < 3) { this.loading = false; this.fail(); }
      return;
    }
    if (a.paused && !a.ended) { if (this.resumeTries < 3) { this.resumeTries++; this.play(); } return; }
    if (!a.paused && now - this.lastProgress > 15000) { this.lastProgress = now; this.recover(); }
  },
  recover() {
    const t = this.cur; if (!t) return;
    const pos = t.live ? 0 : (this.el.currentTime || 0);
    const yid = ytIdOf(t);
    if (yid && !this.isBlob) { Streams.drop(yid); if (this.via && this.via !== 'direct') this.avoid.add(this.via); }
    this.load(true, pos, true);
  },
  setVol(v, silent) {
    this.vol = clamp(v, 0, 1); this.plain.volume = this.vol; if (this.fx) this.fx.volume = this.vol;
    S.settings.volume = this.vol; if (!silent) save();
  },
  setRate(r) { this.rate = r; if (this.cur && !this.cur.live) this.el.playbackRate = r; toast(`Speed ${r}×`); },
  sleep(min) {
    clearTimeout(this.sleepT); this.sleepT = null; this.sleepEnd = false; this.sleepAt = 0;
    if (min === 'end') { this.sleepEnd = true; toast('Will pause when this song ends'); }
    else if (min > 0) { this.sleepAt = Date.now() + min * 60000; this.sleepT = setTimeout(() => this.fadeOut(), min * 60000); toast(`Sleep timer set for ${min} min`); }
    else toast('Sleep timer off');
    UI.timerBtn();
  },
  fadeOut() {
    const a = this.el, v0 = a.volume; let k = 0;
    const iv = setInterval(() => {
      k++; a.volume = Math.max(0, v0 * (1 - k / 20));
      if (k >= 20) { clearInterval(iv); this.userPause(); a.volume = v0; this.sleepAt = 0; this.sleepT = null; UI.timerBtn(); }
    }, 150);
  },
  session() {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession; const h = (n, f) => { try { ms.setActionHandler(n, f); } catch (e) { } };
    h('play', () => (this.loaded && !this.waitOnline ? this.play() : this.toggle()));
    h('pause', () => this.userPause());
    h('stop', () => this.userPause());
    h('previoustrack', () => this.prev());
    h('nexttrack', () => this.next());
    h('seekto', d => this.seek(d.seekTime));
    h('seekbackward', d => this.seek(this.el.currentTime - (d.seekOffset || 10)));
    h('seekforward', d => this.seek(this.el.currentTime + (d.seekOffset || 10)));
  },
  meta(t) {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
    const art = artOf(t, true);
    const artwork = art.startsWith('data:image/svg') ? [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] : [{ src: art, sizes: '512x512' }, { src: artOf(t), sizes: '256x256' }];
    try { navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: t.live ? 'Live Radio' : (t.album || TITLE), artwork }); } catch (e) { }
  },
  posState() {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    const a = this.el; if (!isFinite(a.duration) || !a.duration || (this.cur && this.cur.live)) return;
    try { navigator.mediaSession.setPositionState({ duration: a.duration, playbackRate: a.playbackRate || 1, position: Math.min(a.currentTime, a.duration) }); } catch (e) { }
  },
  persist() {
    if (!this.queue.length) delete S.session;
    else {
      const start = Math.max(0, this.i - 50);
      S.session = { q: this.queue.slice(start, start + 300).map(clean), i: this.i - start, t: this.loaded ? (this.el.currentTime || 0) : this.resumeAt, from: this.from, rep: this.repeat };
    }
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { }
  },
  restore() {
    const s = S.session; if (!s || !Array.isArray(s.q) || !s.q.length) return;
    this.queue = s.q; this.i = clamp(s.i || 0, 0, s.q.length - 1);
    this.resumeAt = this.cur.live ? 0 : (s.t || 0); this.from = s.from || ''; this.repeat = s.rep || 'off'; this.loaded = false; this.wantPlay = false;
    UI.track(this.cur); UI.modes(); UI.time(); UI.state();
  },
};

/* ================= UI updates ================= */
let seeking = false, npOpen = false, npPanel = null, ignorePop = 0;
const wide = () => matchMedia('(min-width: 900px)').matches;
const UI = {
  lastPos: 0,
  track(t) {
    document.body.classList.toggle('has-track', !!t); if (!t) return;
    const art = artOf(t), big = artOf(t, true);
    const ma = $('#m-art'); if (ma.getAttribute('src') !== art) { delete ma.dataset.fb; ma.src = art; } ma.classList.toggle('logo', !!t.live);
    $('#m-t').textContent = t.title; $('#m-s').textContent = t.artist;
    const ni = $('#np-img'); if (ni.getAttribute('src') !== big) { delete ni.dataset.fb; ni.src = big; } ni.classList.toggle('logo', !!t.live);
    $('#np-bg').style.backgroundImage = `url("${art.replace(/"/g, '%22')}")`;
    $('#np-t').textContent = t.title;
    $('#np-a').textContent = t.artist + (Player.previewMode ? ' · Preview' : '');
    $('#np-from').textContent = Player.from || TITLE;
    $('#np').classList.toggle('live', !!t.live);
    document.title = `${t.title} · ${t.artist}`;
    this.like(); this.rows();
    if (npOpen) panelRefresh();
  },
  like() {
    const t = Player.cur; const on = !!(t && isLiked(t.id)); const b = $('#np-like'); if (!b) return;
    b.innerHTML = on ? I.heartFill : I.heart; b.setAttribute('aria-pressed', String(on));
  },
  state() {
    const playing = Player.loaded && !Player.el.paused;
    const busy = Player.loading && Player.wantPlay;
    document.body.classList.toggle('playing', playing);
    document.body.classList.toggle('buffering', busy);
    $('#np').classList.toggle('paused', !playing && !busy);
    const ic = playing || busy ? I.pause : I.play;
    $('#m-pp').innerHTML = ic; $('#np-pp').innerHTML = ic;
    const lbl = playing || busy ? 'Pause' : 'Play';
    $('#m-pp').setAttribute('aria-label', lbl); $('#np-pp').setAttribute('aria-label', lbl);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing || busy ? 'playing' : 'paused';
  },
  time() {
    const a = Player.el, t = Player.cur; if (!t) return;
    const cur = Player.loaded ? a.currentTime : Player.resumeAt;
    const dur = Player.loaded && isFinite(a.duration) && a.duration ? a.duration : (t.duration || 0);
    if (t.live) $('#m-prog').style.width = '0';
    else {
      const p = dur ? clamp(cur / dur, 0, 1) : 0;
      $('#m-prog').style.width = (p * 100) + '%';
      if (!seeking) {
        const s = $('#np-seek'); s.value = Math.round(p * 1000); s.style.setProperty('--p', (p * 100) + '%');
        $('#np-cur').textContent = fmt(cur); $('#np-rem').textContent = '-' + fmt(Math.max(0, dur - cur));
      }
    }
    if (npOpen) lyrTick(cur);
    const now = Date.now(); if (now - this.lastPos > 1000) { this.lastPos = now; Player.posState(); }
  },
  modes() {
    $('#np-shuf').classList.toggle('on', Player.shuffle);
    const r = $('#np-rep'); r.classList.toggle('on', Player.repeat !== 'off'); r.innerHTML = Player.repeat === 'one' ? I.repeat1 : I.repeat;
  },
  rows() {
    const id = Player.cur && Player.cur.id;
    $$('.row[data-id]').forEach(r => {
      const on = r.dataset.id === id;
      if (on === r.classList.contains('is-cur')) return;
      r.classList.toggle('is-cur', on);
      const rt = r.querySelector('.rt'); if (!rt) return;
      const b = rt.querySelector('.bars');
      if (on && !b) rt.insertAdjacentHTML('afterbegin', BARS);
      if (!on && b) b.remove();
    });
  },
  timerBtn() { $('#np-btimer').classList.toggle('on', !!(Player.sleepAt || Player.sleepEnd)); },
};
let toastT;
function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400); }

/* ================= shell & now playing ================= */
const TABS = [['home', 'Home', 'home'], ['explore', 'Explore', 'explore'], ['search', 'Search', 'search'], ['radio', 'Radio', 'radio'], ['library', 'Library', 'library']];
function buildShell() {
  $('#tabs').innerHTML = `<div class="brand"><img src="icons/icon-192.png" alt="">${TITLE}</div>` +
    TABS.map(([k, l, ic]) => `<button class="tab" data-tab="${k}">${I[ic]}<span>${l}</span></button>`).join('');
  $('#mini').innerHTML = `<img class="m-art" id="m-art" alt=""><div class="m-txt"><div class="m-t" id="m-t">Not Playing</div><div class="m-s" id="m-s"></div></div>
    <button class="ib m-prev" data-a="prev" aria-label="Previous">${I.prev}</button>
    <button class="ib" id="m-pp" data-a="toggle" aria-label="Play">${I.play}</button>
    <button class="ib" data-a="next" aria-label="Next">${I.next}</button><div class="m-prog" id="m-prog"></div>`;
  const v0 = Math.round((S.settings.volume == null ? 1 : S.settings.volume) * 100);
  $('#np').innerHTML = `<div class="np-bg" id="np-bg"></div><div class="np-shade"></div>
  <div class="np-in">
    <div class="np-top"><span class="grab"></span>
      <button class="np-ib" data-a="npclose" aria-label="Close Now Playing">${I.chevDown}</button>
      <div class="np-from"><span>Playing from</span><b id="np-from"></b></div>
      <button class="np-ib" data-a="npmore" aria-label="More options">${I.more}</button></div>
    <div class="np-stage">
      <div class="np-art"><img id="np-img" alt=""></div>
      <div class="np-panel" id="np-lyr"></div>
      <div class="np-panel" id="np-q"></div>
    </div>
    <div class="np-meta"><div class="np-tt"><div class="np-t" id="np-t"></div><div class="np-a" id="np-a" data-a="npartist"></div></div>
      <button class="np-ib" id="np-like" data-a="nplike" aria-label="Favorite">${I.heart}</button></div>
    <div class="scrub"><input class="rng" id="np-seek" type="range" min="0" max="1000" step="1" value="0" aria-label="Seek">
      <div class="times"><span id="np-cur">0:00</span><span class="livepill">● LIVE</span><span id="np-rem">-0:00</span></div></div>
    <div class="ctrl">
      <button class="np-ib c-s" id="np-shuf" data-a="shuffle" aria-label="Shuffle">${I.shuffle}</button>
      <button class="np-ib c-m" data-a="prev" aria-label="Previous">${I.prev}</button>
      <button class="np-ib c-p" id="np-pp" data-a="toggle" aria-label="Play">${I.play}</button>
      <button class="np-ib c-m" data-a="next" aria-label="Next">${I.next}</button>
      <button class="np-ib c-s" id="np-rep" data-a="repeat" aria-label="Repeat">${I.repeat}</button></div>
    ${IS_IOS ? '' : `<div class="vol">${I.volLow}<input class="rng" id="np-vol" type="range" min="0" max="100" value="${v0}" style="--p:${v0}%" aria-label="Volume">${I.volHigh}</div>`}
    <div class="np-bot">
      <button class="np-ib" id="np-blyr" data-a="panel" data-p="lyr" aria-label="Lyrics">${I.lyrics}</button>
      <button class="np-ib" data-a="eq" aria-label="Equalizer">${I.eq}</button>
      <button class="np-ib" id="np-btimer" data-a="sleep" aria-label="Sleep timer">${I.timer}</button>
      <button class="np-ib" id="np-bq" data-a="panel" data-p="q" aria-label="Queue">${I.queue}</button></div>
  </div>`;
}
function openNP() {
  if (!Player.cur || npOpen) return;
  npOpen = true; $('#np').classList.add('open'); history.pushState({ np: 1 }, '');
  UI.time(); panelRefresh();
}
function closeNP(fromPop) {
  if (!npOpen) return;
  npOpen = false; $('#np').classList.remove('open');
  if (!fromPop) { ignorePop++; history.back(); }
}
function togglePanel(p) {
  npPanel = wide() ? p : (npPanel === p ? null : p);
  const np = $('#np');
  np.classList.toggle('p-lyr', npPanel === 'lyr'); np.classList.toggle('p-q', npPanel === 'q');
  $('#np-blyr').classList.toggle('on', npPanel === 'lyr'); $('#np-bq').classList.toggle('on', npPanel === 'q');
  panelRefresh();
}
function panelRefresh() {
  const p = npPanel || (wide() ? 'lyr' : null);
  if (p === 'lyr') loadLyrics();
  if (p === 'q') renderQueue();
}
const qRefresh = () => { if (npOpen && npPanel === 'q') renderQueue(); };
const npMsg = (ic, title, d) => `<div class="np-msg">${I[ic]}<b>${esc(title)}</b><p>${esc(d)}</p></div>`;

let lyrState = null, lyrIdx = -1, lyrHold = 0;
async function loadLyrics() {
  const box = $('#np-lyr'); const t = Player.cur;
  if (!t) { box.innerHTML = ''; return; }
  if (lyrState && lyrState.id === t.id) return;
  lyrState = { id: t.id }; lyrIdx = -1;
  if (t.live) { box.innerHTML = npMsg('radio', 'Live radio', 'Lyrics aren’t available for live stations.'); return; }
  box.innerHTML = '<div class="np-msg"><div class="spin light"></div></div>';
  let r = null; try { r = await Lyrics.get(t); } catch (e) { }
  if (!Player.cur || Player.cur.id !== t.id) return;
  lyrState = { id: t.id, ...(r || {}) };
  if (r && r.synced && r.synced.length) {
    box.innerHTML = `<div>${r.synced.map(l => `<p class="ly" data-a="lyseek" data-t="${l.t}">${l.text ? esc(l.text) : '♪'}</p>`).join('')}<p class="ly-src">Lyrics from LRCLIB</p></div>`;
    lyrTick(Player.loaded ? Player.el.currentTime : 0, true);
  } else if (r && r.plain) {
    box.innerHTML = `<div class="ly-plain">${esc(r.plain)}</div><p class="ly-src">Lyrics from LRCLIB</p>`;
    box.scrollTop = 0;
  } else if (r && r.instrumental) box.innerHTML = npMsg('music', 'Instrumental', 'No words — just the music.');
  else box.innerHTML = npMsg('lyrics', 'No lyrics yet', 'Lyrics for this song aren’t in the open lyrics library.');
}
function lyrTick(cur, force) {
  const s = lyrState; if (!s || !s.synced || Player.previewMode) return;
  const L = s.synced; let k = -1;
  for (let j = 0; j < L.length; j++) { if (L[j].t <= cur + 0.3) k = j; else break; }
  if (k === lyrIdx && !force) return;
  lyrIdx = k;
  const box = $('#np-lyr'); const ps = box.querySelectorAll('.ly');
  ps.forEach((p, j) => { p.classList.toggle('on', j === k); p.classList.toggle('past', j < k); });
  const el = ps[k];
  if (el && Date.now() > lyrHold && box.offsetParent !== null && box.scrollTo) box.scrollTo({ top: el.offsetTop - box.clientHeight * 0.32, behavior: force ? 'auto' : 'smooth' });
}
function renderQueue() {
  const box = $('#np-q'); const c = Player.cur; if (!c) { box.innerHTML = ''; return; }
  const up = Player.queue.slice(Player.i + 1);
  box.innerHTML = `<div class="qchips">
      <button class="qchip ${Player.shuffle ? 'on' : ''}" data-a="shuffle">${I.shuffle}Shuffle</button>
      <button class="qchip ${Player.repeat !== 'off' ? 'on' : ''}" data-a="repeat">${Player.repeat === 'one' ? I.repeat1 : I.repeat}Repeat</button>
      <button class="qchip ${S.settings.autoplay ? 'on' : ''}" data-a="autoplay">${I.infinity}Autoplay</button></div>
    <div class="q-h"><div><b>Playing Next</b><small>${up.length ? plural(up.length, 'song') : 'Nothing queued'}${Player.from ? ' from ' + esc(Player.from) : ''}</small></div>${up.length ? '<button data-a="qclear">Clear</button>' : ''}</div>
    <div id="qlist">${up.map((t, k) => {
      const qi = Player.i + 1 + k;
      return `<div class="qrow" data-q="${qi}"><img src="${esc(artOf(t))}" alt="" class="${t.live ? 'logo' : ''}" loading="lazy">
        <div class="qt" data-a="qjump" data-q="${qi}"><div>${esc(t.title)}</div><div class="s">${esc(t.artist)}</div></div>
        <button class="np-ib qx" data-a="qrm" data-q="${qi}" aria-label="Remove from queue">${I.minus}</button>
        <span class="qh" aria-label="Drag to reorder">${I.grip}</span></div>`;
    }).join('')}</div>
    ${!up.length && S.settings.autoplay && !c.live ? '<p class="qnote">Autoplay keeps going with similar songs when this one ends.</p>' : ''}`;
}
let qd = null;
document.addEventListener('pointerdown', e => {
  const h = e.target.closest && e.target.closest('.qh'); if (!h) return;
  const row = h.closest('.qrow'); e.preventDefault();
  qd = { row, y0: e.clientY, id: e.pointerId }; row.classList.add('drag');
  try { h.setPointerCapture(e.pointerId); } catch (err) { }
});
document.addEventListener('pointermove', e => { if (qd && e.pointerId === qd.id) qd.row.style.transform = `translateY(${e.clientY - qd.y0}px)`; });
function endDrag(e, cancel) {
  if (!qd || e.pointerId !== qd.id) return;
  const { row } = qd; qd = null;
  if (cancel) return renderQueue();
  const rows = $$('#qlist .qrow').filter(r => r !== row);
  const pos = rows.filter(r => { const b = r.getBoundingClientRect(); return b.top + b.height / 2 < e.clientY; }).length;
  const from = +row.dataset.q; const up = Player.queue.slice(Player.i + 1);
  const t = up.splice(from - Player.i - 1, 1)[0];
  if (t) { up.splice(pos, 0, t); Player.queue = Player.queue.slice(0, Player.i + 1).concat(up); }
  renderQueue();
}
document.addEventListener('pointerup', e => endDrag(e, false));
document.addEventListener('pointercancel', e => endDrag(e, true));

/* ================= sheets ================= */
let sheetActs = [], sheetOpen = false, askRes = null, pickSel = null;
function openSheet(html) {
  const s = $('#sheet');
  s.innerHTML = `<div class="bd" data-a="sclose"></div><div class="sp" role="dialog" aria-modal="true">${html}</div>`;
  void s.offsetHeight; s.classList.add('open'); sheetOpen = true;
}
function closeSheet() {
  const s = $('#sheet'); s.classList.remove('open'); sheetOpen = false;
  if (askRes) { const r = askRes; askRes = null; r(null); }
  setTimeout(() => { if (!sheetOpen) s.innerHTML = ''; }, 420);
}
function actionSheet({ head = '', acts = [], cancel = 'Cancel' }) {
  sheetActs = acts.filter(Boolean);
  openSheet(`<div class="sg">${head}${sheetActs.map((a, i) => `<button class="sa ${a.danger ? 'danger' : ''}" data-a="sa" data-i="${i}"><span>${esc(a.label)}</span>${a.icon ? I[a.icon] : ''}</button>`).join('')}</div>
    <button class="scancel" data-a="sclose">${esc(cancel)}</button>`);
}
const trackHead = t => `<div class="sh"><img src="${esc(artOf(t))}" alt="" class="${t.live ? 'logo' : ''}"><div class="sht"><div class="m-t">${esc(t.title)}</div><div class="m-s">${esc(t.artist)}</div></div></div>`;
const textHead = (t, d) => `<div class="sh col"><div class="m-t">${esc(t)}</div>${d ? `<div class="m-s">${esc(d)}</div>` : ''}</div>`;
function ask(title, placeholder, value = '', ok = 'Save') {
  return new Promise(res => {
    if (askRes) { const r = askRes; askRes = null; r(null); }
    openSheet(`<div class="sg form"><b class="ft">${esc(title)}</b><input class="tin" id="askin" placeholder="${esc(placeholder)}" value="${esc(value)}" maxlength="200" autocomplete="off">
      <div class="fbtns"><button class="fb" data-a="askc">Cancel</button><button class="fb pri" data-a="asko">${esc(ok)}</button></div></div>`);
    askRes = res;
    setTimeout(() => { const i = $('#askin'); if (i) { i.focus(); i.select(); } }, 380);
  });
}
function confirmSheet(title, msg, label, fn) { actionSheet({ head: textHead(title, msg), acts: [{ label, danger: true, fn }] }); }
const canDownload = t => ['audius', 'yt', 'deezer'].includes(t.source);
function trackMenu(t, meta = {}) {
  const liked = isLiked(t.id), dl = isDl(t.id), q = enc(`${t.title} ${t.artist}`);
  actionSheet({
    head: trackHead(t),
    acts: [
      !meta.np && { label: 'Play Next', icon: 'playNext', fn: () => Player.playNext(t) },
      !meta.np && { label: 'Add to Queue', icon: 'queue', fn: () => Player.enqueue(t) },
      !t.live && t.source !== 'local' && { label: 'Start Radio', icon: 'infinity', fn: () => startRadio(t) },
      { label: liked ? (t.live ? 'Remove Station' : 'Remove from Favorites') : (t.live ? 'Save Station' : 'Favorite'), icon: liked ? 'heartFill' : 'heart', fn: () => toggleLike(t) },
      !t.live && { label: 'Add to Playlist…', icon: 'playlist', fn: () => pickPlaylist(t) },
      canDownload(t) && !dl && { label: 'Download', icon: 'download', fn: () => download(t) },
      (dl || t.source === 'local') && { label: 'Save to Device', icon: 'save', fn: () => saveToDevice(t) },
      canDownload(t) && dl && { label: 'Remove Download', icon: 'trash', danger: true, fn: () => removeDownload(t) },
      t.source === 'local' && { label: 'Remove from This Device', icon: 'trash', danger: true, fn: () => confirmSheet('Remove this song?', 'It will be deleted from Tune Tune on this device.', 'Remove', () => removeLocal(t)) },
      meta.pl && { label: 'Remove from Playlist', icon: 'minus', danger: true, fn: () => removeFromPlaylist(meta.pl, t) },
      t.uid && (t.source === 'yt' || t.source === 'audius') && { label: 'Go to Artist', icon: 'user', fn: () => goArtist(t) },
      meta.np && !t.live && { label: 'Playback Speed', icon: 'speed', fn: speedMenu },
      !t.live && t.source !== 'local' && { label: t.source === 'yt' ? 'Open in YouTube Music' : 'Find on YouTube Music', icon: 'ext', fn: () => window.open(t.source === 'yt' ? `https://music.youtube.com/watch?v=${t.sid}` : 'https://music.youtube.com/search?q=' + q, '_blank', 'noopener') },
      !t.live && t.source !== 'local' && { label: 'Find on Spotify', icon: 'ext', fn: () => window.open('https://open.spotify.com/search/' + q, '_blank', 'noopener') },
      t.live && t.home && { label: 'Station Website', icon: 'ext', fn: () => window.open(t.home, '_blank', 'noopener') },
      { label: 'Share', icon: 'share', fn: () => share(t) },
    ],
  });
}
async function startRadio(t) {
  toast('Starting radio…');
  let pool = [];
  try {
    if (t.source === 'audius') pool = (await Audius.trending(t.genre || '')).filter(x => x.id !== t.id);
    else {
      let yid = ytIdOf(t);
      if (!yid) { const m = await YT.match(t); yid = m && m.sid; if (m) t.ytId = m.sid; }
      if (yid) pool = await YT.related({ sid: yid });
    }
  } catch (e) { }
  Player.playList([t, ...shuf(pool).slice(0, 30)], 0, `${t.title} Radio`, false);
  if (!pool.length) toast('Radio will fill up as it plays');
}
function goArtist(t) {
  const open = () => {
    if (t.source === 'audius') go('coll', { k: 'artist', id: t.uid, title: t.artist });
    else go('coll', { k: 'yt', c: { kind: 'artist', id: t.uid, title: t.artist, source: 'yt' }, title: t.artist });
  };
  if (npOpen) { closeNP(); setTimeout(open, 380); } else open();
}
function pickPlaylist(t) {
  actionSheet({
    head: textHead('Add to Playlist', t.title),
    acts: [
      { label: 'New Playlist…', icon: 'plus', fn: async () => { const n = await ask('New Playlist', 'Playlist name', `My Playlist ${S.playlists.length + 1}`, 'Create'); if (n) { newPlaylist(n, [t]); toast(`Added to “${n}”`); refreshIfLib(); } } },
      ...S.playlists.map(p => ({ label: p.name, icon: 'playlist', fn: () => addToPlaylist(p, t) })),
    ],
  });
}
function sleepMenu() {
  const rem = Player.sleepAt ? Math.ceil((Player.sleepAt - Date.now()) / 60000) : 0;
  actionSheet({
    head: textHead('Sleep Timer', Player.sleepEnd ? 'Pausing when this song ends' : rem ? `${rem} min left` : 'Music fades out and pauses'),
    acts: [...[5, 15, 30, 45, 60, 90].map(m => ({ label: `${m} minutes`, fn: () => Player.sleep(m) })),
      { label: 'When This Song Ends', fn: () => Player.sleep('end') },
      (Player.sleepAt || Player.sleepEnd) && { label: 'Turn Off Timer', danger: true, fn: () => Player.sleep(0) }],
  });
}
function speedMenu() {
  actionSheet({ head: textHead('Playback Speed', `Currently ${Player.rate}×`), acts: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(r => ({ label: `${r}×${r === Player.rate ? '  ✓' : ''}`, fn: () => Player.setRate(r) })) });
}
function playlistMenu(id) {
  const p = S.playlists.find(x => x.id === id); if (!p) return;
  actionSheet({
    head: textHead(p.name, plural(p.tracks.length, 'song')),
    acts: [
      p.tracks.length && { label: 'Play', icon: 'play', fn: () => Player.playList(p.tracks, 0, p.name, false) },
      p.tracks.length && { label: 'Shuffle', icon: 'shuffle', fn: () => Player.playList(p.tracks, Math.floor(Math.random() * p.tracks.length), p.name, true) },
      { label: 'Rename', icon: 'lyrics', fn: async () => { const n = await ask('Rename Playlist', 'Playlist name', p.name); if (n) { p.name = n; save(); softRender(); } } },
      { label: 'Delete Playlist', icon: 'trash', danger: true, fn: () => confirmSheet(`Delete “${p.name}”?`, 'The songs stay in your library.', 'Delete Playlist', () => { S.playlists = S.playlists.filter(x => x.id !== id); save(); toast('Playlist deleted'); history.back(); }) },
    ],
  });
}
function langPicker(first) {
  pickSel = new Set(S.settings.langs || []);
  openSheet(`<div class="sg form lp"><b class="ft">${first ? 'Pick your music languages' : 'Music languages'}</b>
    <p class="fsub">Home fills with top songs and playlists in these languages. Change it any time in Settings.</p>
    <div class="chips wrap">${LANGS.map(([l, n]) => `<button class="chip ${pickSel.has(l) ? 'on' : ''}" data-a="lpick" data-l="${esc(l)}">${esc(l)}${n !== l ? ` <span class="nat">${esc(n)}</span>` : ''}</button>`).join('')}</div>
    <div class="fbtns"><button class="fb pri" data-a="lpdone">Done</button></div></div>`);
}

const fmtDb = v => (v > 0 ? '+' : '') + (+v).toFixed(Number.isInteger(+v) ? 0 : 1);
function eqInner() {
  const s = S.settings;
  return `<div class="eq-h"><div><b>Equalizer</b><small id="eqname">${s.eqOn ? esc(s.eqPreset) : 'Off'}</small></div>
    <label class="sw"><input type="checkbox" id="eqon" ${s.eqOn ? 'checked' : ''} aria-label="Equalizer on"><span></span></label></div>
    <div class="chips">${Object.keys(PRESETS).map(n => `<button class="chip ${s.eqOn && s.eqPreset === n ? 'on' : ''}" data-a="eqp" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>
    <div class="bands">${EQ_F.map((f, i) => `<div class="band"><span class="db" id="eqv${i}">${fmtDb(s.eq[i])}</span>
      <div class="vs"><input class="vr" type="range" min="-12" max="12" step="0.5" value="${s.eq[i]}" data-band="${i}" aria-label="${EQ_L[i]} hertz"></div><span class="hz">${EQ_L[i]}</span></div>`).join('')}</div>
    <p class="eq-note">Works on downloads, device music and most streams. If a source blocks it, the song keeps playing without EQ.</p>`;
}
function openEQ() { openSheet(`<div class="sg eq ${S.settings.eqOn ? '' : 'off'}" id="eqbox">${eqInner()}</div><button class="scancel" data-a="sclose">Done</button>`); }
function eqToggle(on) {
  S.settings.eqOn = on;
  if (on) { Player.ensureFx(); if (Player.ctx && Player.ctx.state !== 'running') Player.ctx.resume().catch(() => { }); }
  save(); const b = $('#eqbox'); if (b) { b.classList.toggle('off', !on); b.innerHTML = eqInner(); }
  Player.reroute(); toast(on ? 'Equalizer on' : 'Equalizer off');
}

/* ================= library operations ================= */
function newPlaylist(name, tracks = []) { const p = { id: uid(), name, tracks: tracks.map(clean), created: Date.now() }; S.playlists.unshift(p); save(); return p; }
function addToPlaylist(p, t) {
  if (p.tracks.some(x => x.id === t.id)) return toast(`Already in “${p.name}”`);
  p.tracks.push(clean(t)); save(); toast(`Added to “${p.name}”`); refreshIfLib();
}
function removeFromPlaylist(id, t) {
  const p = S.playlists.find(x => x.id === id); if (!p) return;
  p.tracks = p.tracks.filter(x => x.id !== t.id); save(); softRender(); toast('Removed from playlist');
}
async function createPlaylistFlow() {
  const n = await ask('New Playlist', 'Playlist name', `My Playlist ${S.playlists.length + 1}`, 'Create'); if (!n) return;
  const p = newPlaylist(n); toast('Playlist created'); go('coll', { k: 'playlist', id: p.id });
}
function refreshIfLib() { const v = cv().v; if (v === 'library' || v === 'coll') softRender(); }
const dropArt = id => { const u = artCache.get(id); if (u) { URL.revokeObjectURL(u); artCache.delete(id); } };

const dlActive = new Set();
async function mediaSource(t) {
  if (t.source === 'audius') { await Audius.discover(); return { url: Audius.streamUrl(t), mime: 'audio/mpeg' }; }
  let yid = ytIdOf(t);
  if (!yid && t.source === 'deezer') { const m = await YT.match(t); if (m) { yid = t.ytId = m.sid; } }
  if (!yid) throw new Error('no source');
  return Streams.get(yid);
}
async function fetchMedia(url, mime) {
  let clen = 0; try { clen = +new URL(url, location.href).searchParams.get('clen') || 0; } catch (e) { }
  const type = /webm/.test(mime) ? 'audio/webm' : /mp4|m4a/.test(mime) ? 'audio/mp4' : (mime || 'audio/mpeg').split(';')[0];
  if (!clen) { const r = await fetchT(url, {}, 180000); if (!r.ok) throw new Error('HTTP ' + r.status); const b = await r.blob(); return new Blob([b], { type: b.type && b.type !== 'application/octet-stream' ? b.type : type }); }
  const parts = []; const CH = 3 * 1024 * 1024;
  for (let s = 0; s < clen; s += CH) {
    const e = Math.min(clen, s + CH) - 1;
    const r = await fetchT(url, { headers: { Range: `bytes=${s}-${e}` } }, 90000);
    if (r.status === 200) { const b = await r.blob(); return new Blob([b], { type }); }
    if (r.status !== 206) throw new Error('HTTP ' + r.status);
    parts.push(await r.blob());
  }
  return new Blob(parts, { type });
}
async function download(t, quiet) {
  if (!canDownload(t)) return toast('This can’t be downloaded');
  if (isDl(t.id) || dlActive.has(t.id)) return;
  dlActive.add(t.id); if (!quiet) toast(`Downloading “${t.title}”…`);
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
    let blob = null, lastErr;
    for (let attempt = 0; attempt < 3 && !blob; attempt++) {
      try {
        if (attempt) Streams.drop(ytIdOf(t));
        const s = await mediaSource(t);
        blob = await fetchMedia(s.url, s.mime);
        if (!blob.size) { blob = null; throw new Error('empty'); }
      } catch (e) { lastErr = e; }
    }
    if (!blob) throw lastErr || new Error('failed');
    await DB.put(t.id, blob);
    const meta = clean(t);
    const artUrl = t.artLarge || t.art;
    if (artUrl && !artUrl.startsWith('data:')) {
      try { const ar = await fetchT(artUrl, {}, 15000); if (ar.ok) { const ab = await ar.blob(); await DB.put('art:' + t.id, ab); artCache.set(t.id, URL.createObjectURL(ab)); meta.hasArt = true; } } catch (e) { }
    }
    S.downloads = S.downloads.filter(x => x.id !== t.id); S.downloads.unshift(meta); save();
    if (!quiet) toast('Downloaded — plays offline');
    $$('.row[data-id]').filter(r => r.dataset.id === t.id).forEach(r => { const m = r.querySelector('.more'); if (m && !r.querySelector('.dlm')) m.insertAdjacentHTML('beforebegin', `<span class="dlm">${I.dlok}</span>`); });
    return true;
  } catch (e) {
    console.warn(e); if (!quiet) toast(`Couldn’t download “${t.title}” right now`); return false;
  } finally { dlActive.delete(t.id); }
}
async function downloadMany(tracks) {
  const todo = (tracks || []).filter(t => canDownload(t) && !isDl(t.id));
  if (!todo.length) return toast((tracks || []).some(canDownload) ? 'Already downloaded' : 'Nothing here can be downloaded');
  toast(`Downloading ${plural(todo.length, 'song')} in the background…`);
  let ok = 0;
  for (const t of todo) { if (await download(t, true)) ok++; }
  toast(`Downloaded ${ok} of ${todo.length}`); refreshIfLib();
}
async function saveToDevice(t) {
  try {
    const b = await DB.get(t.id); if (!b) return toast('Download it first');
    const ext = /webm/.test(b.type) ? 'webm' : /mp4|m4a|aac/.test(b.type) ? 'm4a' : /flac/.test(b.type) ? 'flac' : /wav/.test(b.type) ? 'wav' : /ogg/.test(b.type) ? 'ogg' : 'mp3';
    const name = `${t.artist} - ${t.title}`.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 120) + '.' + ext;
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    toast('Saving “' + name + '”');
  } catch (e) { toast('Couldn’t save the file'); }
}
async function removeDownload(t) {
  await DB.del(t.id).catch(() => { }); await DB.del('art:' + t.id).catch(() => { });
  S.downloads = S.downloads.filter(x => x.id !== t.id); dropArt(t.id); save(); toast('Download removed'); refreshIfLib();
}
async function removeLocal(t) {
  await DB.del(t.id).catch(() => { }); await DB.del('art:' + t.id).catch(() => { });
  S.locals = S.locals.filter(x => x.id !== t.id); dropArt(t.id); save(); toast('Removed'); refreshIfLib();
}
async function storageNote(sel) {
  let text = `${plural(S.downloads.length, 'download')}, ${plural(S.locals.length, 'device song')}`;
  try { const est = navigator.storage && navigator.storage.estimate && await navigator.storage.estimate(); if (est) text += ` · ${fmtBytes(est.usage)} used, ${fmtBytes(Math.max(0, est.quota - est.usage))} free`; } catch (e) { }
  const el = $(sel); if (el) el.textContent = text;
}

let tagLib = null;
function loadTagLib() {
  if (tagLib) return tagLib;
  tagLib = new Promise(res => {
    if (window.jsmediatags) return res(true);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsmediatags/3.9.5/jsmediatags.min.js';
    s.onload = () => res(!!window.jsmediatags); s.onerror = () => res(false);
    setTimeout(() => res(!!window.jsmediatags), 8000);
    document.head.appendChild(s);
  });
  return tagLib;
}
function readTags(file) {
  return new Promise(res => {
    if (!window.jsmediatags) return res({});
    const tm = setTimeout(() => res({}), 8000);
    try {
      window.jsmediatags.read(file, {
        onSuccess: tag => {
          clearTimeout(tm); const g = tag.tags || {}; let pic = null;
          if (g.picture && g.picture.data) {
            let f = g.picture.format || 'image/jpeg'; if (!f.includes('/')) f = 'image/' + f.replace('jpg', 'jpeg');
            try { pic = new Blob([new Uint8Array(g.picture.data)], { type: f }); } catch (e) { }
          }
          res({ title: g.title, artist: g.artist, album: g.album, pic });
        },
        onError: () => { clearTimeout(tm); res({}); },
      });
    } catch (e) { clearTimeout(tm); res({}); }
  });
}
async function shrink(blob, size = 512) {
  try {
    const bmp = await createImageBitmap(blob); const k = Math.min(1, size / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(b => r(b || blob), 'image/jpeg', 0.85));
  } catch (e) { return blob; }
}
function probeDuration(file) {
  return new Promise(res => {
    const a = document.createElement('audio'); let u = '';
    try { u = URL.createObjectURL(file); } catch (e) { return res(0); }
    const done = d => { URL.revokeObjectURL(u); res(isFinite(d) ? d : 0); };
    const tm = setTimeout(() => done(0), 5000);
    a.preload = 'metadata';
    a.onloadedmetadata = () => { clearTimeout(tm); done(a.duration); };
    a.onerror = () => { clearTimeout(tm); done(0); };
    a.src = u;
  });
}
async function importFiles(files) {
  const list = [...(files || [])].filter(f => (f.type || '').startsWith('audio/') || /\.(mp3|m4a|aac|flac|wav|ogg|opus|webm)$/i.test(f.name));
  if (!list.length) return toast('No audio files found');
  toast(`Adding ${plural(list.length, 'song')}…`);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  await loadTagLib();
  let ok = 0;
  for (const f of list) {
    try {
      const id = 'lc:' + uid();
      const [meta, dur] = await Promise.all([readTags(f), probeDuration(f)]);
      const base = f.name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim();
      const m = base.match(/^(.+?)\s+-\s+(.+)$/);
      await DB.put(id, f);
      let hasArt = false;
      if (meta.pic) { const small = await shrink(meta.pic); await DB.put('art:' + id, small); artCache.set(id, URL.createObjectURL(small)); hasArt = true; }
      S.locals.unshift(clean({ id, source: 'local', title: meta.title || (m ? m[2] : base), artist: meta.artist || (m ? m[1] : 'Unknown artist'), album: meta.album || '', duration: dur, hasArt }));
      ok++;
    } catch (e) { console.warn(e); }
  }
  save(); toast(`Added ${plural(ok, 'song')} to On This Device`); refreshIfLib();
}
function exportData() {
  const data = { app: TITLE, version: VER, exported: new Date().toISOString(), liked: S.liked, playlists: S.playlists, history: S.history, searches: S.searches, settings: S.settings };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  a.download = `tunetune-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Backup exported');
}
async function importBackup(file) {
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!d || !Array.isArray(d.liked)) throw new Error('bad');
    const merge = (a, b) => { const m = new Map(); [...a, ...b].forEach(x => { if (x && x.id && !m.has(x.id)) m.set(x.id, x); }); return [...m.values()]; };
    S.liked = merge(d.liked, S.liked); S.history = merge(d.history || [], S.history).slice(0, 150);
    S.playlists = merge(d.playlists || [], S.playlists);
    S.searches = [...new Set([...(d.searches || []), ...S.searches])].slice(0, 12);
    if (d.settings) Object.assign(S.settings, d.settings, { eqOn: S.settings.eqOn });
    save(); applyTheme(); render(); toast('Library restored');
  } catch (e) { toast('That file isn’t a Tune Tune backup'); }
}
async function share(t) {
  const url = t.source === 'yt' ? `https://music.youtube.com/watch?v=${t.sid}` : t.source === 'audius' && t.permalink ? 'https://audius.co' + t.permalink : (t.live && t.home) || location.href.split('#')[0];
  const text = `${t.title} — ${t.artist}`;
  try { if (navigator.share) { await navigator.share({ title: t.title, text, url }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toast('Link copied'); } catch (e) { toast(text); }
}
async function testSources() {
  toast('Testing music sources…');
  const lines = [];
  lines.push(`Engine: ${IT.ok ? 'YouTube Music direct' : 'public mirrors'}`);
  let tr = null;
  try { mem.delete('ys:top hits ' + YEAR); const r = await YT.songs('top hits ' + YEAR); tr = r[0]; lines.push(`Search: working (${r.length} songs)`); } catch (e) { lines.push('Search: not responding'); }
  if (tr) {
    try { Streams.drop(tr.sid); const s = await Streams.get(tr.sid); lines.push(`Streaming: working via ${s.via.replace(/^(piped|inv):https?:\/\//, '')}`); }
    catch (e) { lines.push('Streaming: not responding'); }
  }
  try { mem.delete('au:tr:week'); const a = await Audius.trending(); lines.push(`Audius: ${a.length ? 'working' : 'empty'}`); } catch (e) { lines.push('Audius: not responding'); }
  try { const r = await Radio.top(); lines.push(`Radio: ${r.length ? 'working' : 'empty'}`); } catch (e) { lines.push('Radio: not responding'); }
  actionSheet({ head: `<div class="sh col"><div class="m-t">Music sources</div><div class="m-s pre">${esc(lines.join('\n'))}</div></div>`, acts: [], cancel: 'Done' });
}

/* ================= theme ================= */
function applyTheme() {
  const s = S.settings.theme;
  const dark = s === 'dark' || (s === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const r = document.documentElement; r.dataset.theme = dark ? 'dark' : 'light'; r.style.setProperty('--accent', S.settings.accent);
  const m = $('meta[name="theme-color"]'); if (m) m.setAttribute('content', dark ? '#000000' : '#ffffff');
}

/* ================= navigation ================= */
const nav = { tab: 'home', stacks: { home: [{ v: 'home' }], explore: [{ v: 'explore' }], search: [{ v: 'search' }], radio: [{ v: 'radio' }], library: [{ v: 'library' }] } };
const cv = () => { const s = nav.stacks[nav.tab]; return s[s.length - 1]; };
let renderTok = 0;
function render() {
  const e = cv(); const tok = ++renderTok; const v = $('#view');
  v.classList.remove('scrolled');
  let html;
  try { html = (VIEWS[e.v] || VIEWS.home)(e, tok); }
  catch (err) { console.error(err); html = header('Something went wrong', { noLarge: true }) + emptyState({ icon: 'music', t: 'This page couldn’t open', d: String(err && err.message || err), btn: ['reload', 'Try Again'] }); }
  v.innerHTML = html;
  v.scrollTop = e.scroll || 0;
  setTimeout(() => { e.scroll = 0; }, 1500);
  $$('.tab').forEach(b => { const on = b.dataset.tab === nav.tab; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
}
function softRender() { const v = $('#view'); const st = v.scrollTop; render(); v.scrollTop = st; }
function go(v, params = {}) {
  const st = nav.stacks[nav.tab]; st[st.length - 1].scroll = $('#view').scrollTop;
  st.push({ v, ...params }); history.pushState({ v: 1 }, ''); render();
}
function popView() { const st = nav.stacks[nav.tab]; if (st.length > 1) { st.pop(); render(); } }
function switchTab(t) {
  if (!nav.stacks[t]) return;
  const v = $('#view'); const cur = nav.stacks[nav.tab]; cur[cur.length - 1].scroll = v.scrollTop;
  if (nav.tab === t) {
    if (cur.length > 1) { cur.length = 1; cur[0].scroll = 0; }
    else { v.scrollTo({ top: 0, behavior: 'smooth' }); if (t === 'search') setTimeout(() => { const i = $('#sq'); if (i) i.focus(); }, 50); return; }
  }
  nav.tab = t; render();
}
function restoreScroll() { const e = cv(); if (e.scroll) { const v = $('#view'); if (v.scrollTop < e.scroll) v.scrollTop = e.scroll; } }
function fill(sel, tok, promise, fn) {
  Promise.resolve(promise).then(data => {
    if (tok !== renderTok) return; const el = $(sel); if (!el) return;
    el.innerHTML = fn(data) || ''; restoreScroll();
  }).catch(err => {
    if (err === 'stale' || tok !== renderTok) return;
    console.warn(err); const el = $(sel); if (el) el.innerHTML = errBox();
  });
}
// A shelf removes itself when its source has nothing, so pages never show broken sections.
function fillShelf(id, tok, loader, fn) {
  return Promise.resolve().then(loader).then(items => {
    if (tok !== renderTok) return false; const el = document.getElementById(id); if (!el) return false;
    if (!items || !items.length) { const s = el.closest('.sec'); if (s) s.remove(); return false; }
    el.innerHTML = fn(items); restoreScroll(); return true;
  }).catch(err => {
    console.warn(err); if (tok !== renderTok) return false;
    const el = document.getElementById(id); const s = el && el.closest('.sec'); if (s) s.remove(); return false;
  });
}
function settle(ps, tok, sel) {
  Promise.all(ps).then(rs => {
    if (tok !== renderTok || rs.some(Boolean)) return;
    const n = $(sel); if (n) n.innerHTML = errBox('Music sources aren’t responding', 'Your connection may be down, or the free mirrors are busy. Try again in a moment.');
  });
}

/* ================= view helpers ================= */
const LABELS = { home: 'Home', explore: 'Explore', search: 'Search', radio: 'Radio', library: 'Library', settings: 'Settings' };
function header(title, o = {}) {
  const st = nav.stacks[nav.tab]; const back = st.length > 1;
  const prev = back ? (LABELS[st[st.length - 2].v] || st[st.length - 2].title || 'Back') : '';
  return `<div class="nb"><div class="nb-l">${back ? `<button class="nb-back" data-a="back">${I.chevL}<span>${esc(prev)}</span></button>` : ''}</div>
    <div class="nb-t">${esc(title)}</div><div class="nb-r">${o.right || ''}</div></div>${o.noLarge ? '' : `<h1 class="lt">${esc(title)}</h1>`}`;
}
const nbBtn = (a, ic, label, extra = '') => `<button class="nb-btn" data-a="${a}" aria-label="${esc(label)}" ${extra}>${I[ic]}</button>`;
function sec(title, body, o = {}) {
  const more = o.moreHTML || (o.moreTab ? `<button class="see" data-tab="${o.moreTab}">See All</button>`
    : o.moreK ? `<button class="see" data-a="go" data-v="coll" data-k="${o.moreK}">See All</button>` : '');
  return `<section class="sec"><div class="sec-h"><div><h2>${esc(title)}</h2>${o.sub ? `<div class="sub">${esc(o.sub)}</div>` : ''}</div>${more}</div><div ${o.id ? `id="${o.id}"` : ''}>${body}</div></section>`;
}
function rowHTML(t, k, i, o = {}) {
  const cur = !!(Player.cur && Player.cur.id === t.id);
  const sub = t.live ? t.artist : [t.artist, o.album && t.album].filter(Boolean).join(' · ');
  return `<div class="row ${cur ? 'is-cur' : ''}" data-a="play" data-l="${k}" data-i="${i}" data-id="${esc(t.id)}">${o.num ? `<span class="num">${i + 1}</span>` : ''}
    <img class="thumb ${t.live ? 'logo' : ''}" src="${esc(artOf(t))}" alt="" loading="lazy">
    <div class="rb"><div class="rtx"><div class="rt">${cur ? BARS : ''}<span class="tx">${esc(t.title)}</span></div>
      <div class="rs">${t.live ? '<span class="badge live">LIVE</span>' : ''}${t.explicit ? '<span class="badge">E</span>' : ''}${esc(sub)}</div></div>
      ${t.source !== 'local' && isDl(t.id) ? `<span class="dlm">${I.dlok}</span>` : ''}${o.dur && t.duration && !t.live ? `<span class="dur">${fmt(t.duration)}</span>` : ''}
      <button class="more" data-a="more" data-l="${k}" data-i="${i}" aria-label="More options for ${esc(t.title)}">${I.more}</button></div></div>`;
}
const rowsHTML = (list, k, o) => `<div class="rows">${list.map((t, i) => rowHTML(t, k, i, o)).join('')}</div>`;
function cardHTML(t, k, i) {
  const live = !!t.live;
  return `<div class="card" data-a="play" data-l="${k}" data-i="${i}"><div class="cw"><img class="art ${live ? 'round logo' : ''}" src="${esc(artOf(t))}" alt="" loading="lazy">
    <button class="cplay" data-a="play" data-l="${k}" data-i="${i}" aria-label="Play ${esc(t.title)}">${I.play}</button></div>
    <div class="ct ${live ? 'c' : ''}">${esc(t.title)}</div><div class="cs ${live ? 'c' : ''}">${esc(t.artist)}</div></div>`;
}
const cardsHTML = (list, k) => `<div class="hs">${list.map((t, i) => cardHTML(t, k, i)).join('')}</div>`;
function collCard(c) {
  const ar = c.kind === 'artist';
  const sub = c.sub || (c.kind === 'album' ? 'Album' : ar ? 'Artist' : 'Playlist');
  return `<div class="card" data-a="openc" data-c="${regc(c)}"><div class="cw"><img class="art ${ar ? 'round' : ''}" src="${esc(c.art || ph({ title: c.title }))}" alt="" loading="lazy"></div>
    <div class="ct ${ar ? 'c' : ''}">${esc(c.title)}</div><div class="cs ${ar ? 'c' : ''}">${esc(sub)}</div></div>`;
}
const gridCards = list => `<div class="cgrid">${list.map(collCard).join('')}</div>`;
function shelfBody(items, from) {
  const tracks = items.filter(isTrack), colls = items.filter(x => !isTrack(x));
  if (tracks.length >= colls.length) { const k = reg(tracks, { from }); return `<div class="cg">${tracks.slice(0, 24).map((t, i) => rowHTML(t, k, i)).join('')}</div>`; }
  return `<div class="hs">${colls.slice(0, 20).map(collCard).join('')}</div>`;
}
const slot = (id, title, kind, sub, o = {}) => sec(title, kind === 'rows' ? skRows(4) : skCards(6, kind === 'round'), { id, sub, ...o });
function collage(tracks, cls) {
  const arts = [...new Set(tracks.map(t => artOf(t)))].slice(0, 4);
  if (!arts.length) return `<div class="${cls} ptile">${I.music}</div>`;
  if (arts.length < 4) return `<img class="${cls}" src="${esc(arts[0])}" alt="">`;
  return `<div class="${cls} collage">${arts.map(a => `<img src="${esc(a)}" alt="">`).join('')}</div>`;
}
const myPlCard = p => `<div class="card" data-a="mypl" data-id="${p.id}"><div class="cw">${collage(p.tracks, 'art')}</div><div class="ct">${esc(p.name)}</div><div class="cs">${plural(p.tracks.length, 'song')}</div></div>`;
const tile = (label, attrs, h, small) => `<div class="tile" style="--h:${h}" ${attrs} role="button" tabindex="0"><span>${esc(label)}${small ? `<small>${esc(small)}</small>` : ''}</span></div>`;
const genreTiles = () => `<div class="tiles">${GENRES.map(([g, h]) => tile(g.replace('/Rap', '').replace('/Soul', ''), `data-a="genre" data-g="${esc(g)}"`, h)).join('')}</div>`;
const langTiles = () => `<div class="tiles">${LANGS.map(([l, n], i) => tile(l, `data-a="lang" data-l="${esc(l)}"`, (i * 29 + 330) % 360, n !== l ? n : '')).join('')}</div>`;
const moodTiles = (n = 99) => `<div class="tiles">${MOODS.slice(0, n).map((m, i) => tile(m, `data-a="mood" data-m="${esc(m)}"`, (i * 41 + 190) % 360)).join('')}</div>`;
const ytGenreTiles = () => `<div class="tiles">${YT_GENRES.map((g, i) => tile(g, `data-a="mood" data-m="${esc(g)}"`, (i * 53 + 20) % 360)).join('')}</div>`;
const skCards = (n = 6, round) => `<div class="hs">${Array.from({ length: n }, () => `<div><div class="sk art ${round ? 'round' : ''}"></div><div class="sk" style="height:12px;width:80%;margin-top:9px"></div><div class="sk" style="height:10px;width:55%;margin-top:6px"></div></div>`).join('')}</div>`;
const skRows = (n = 4) => `<div class="rows">${Array.from({ length: n }, () => `<div class="row"><div class="sk thumb"></div><div class="rb"><div class="rtx"><div class="sk" style="height:12px;width:58%"></div><div class="sk" style="height:10px;width:38%;margin-top:7px"></div></div></div></div>`).join('')}</div>`;
function emptyState(o = {}) {
  return `<div class="empty">${o.icon ? I[o.icon] : ''}<h3>${esc(o.t || 'Nothing here yet')}</h3>${o.d ? `<p>${esc(o.d)}</p>` : ''}${o.btn ? `<button class="btn" data-a="${o.btn[0]}">${esc(o.btn[1])}</button>` : ''}</div>`;
}
const errBox = (t, d) => `<div class="empty sm">${I.wifiOff}<h3>${esc(t || 'Couldn’t load this')}</h3><p>${esc(d || 'Check your connection, then try again.')}</p><button class="btn ghost" data-a="reload">Try Again</button></div>`;
function collHead(title, tracks, k, o = {}) {
  let art;
  if (o.art) art = `<img class="ch-art ${o.round ? 'round' : ''}" src="${esc(o.art)}" alt="">`;
  else if (o.icon) art = `<div class="ch-art ptile">${I[o.icon]}</div>`;
  else art = collage(tracks, 'ch-art');
  const n = tracks.length; const live = n > 0 && tracks.every(t => t.live);
  const mins = Math.round(tracks.reduce((s, t) => s + (t.live ? 0 : (t.duration || 0)), 0) / 60);
  const dur = mins ? (mins >= 60 ? ` · ${Math.floor(mins / 60)} hr ${mins % 60} min` : ` · ${mins} min`) : '';
  const sub = o.sub || (n ? (live ? plural(n, 'station') : plural(n, 'song') + dur) : '');
  return `<div class="ch">${art}<div class="ch-i"><h1>${esc(title)}</h1><p class="ch-sub">${esc(sub)}</p>
    ${n ? `<div class="ch-btns"><button class="pill" data-a="playAll" data-l="${k}">${I.play}Play</button>${live ? '' : `<button class="pill" data-a="shufAll" data-l="${k}">${I.shuffle}Shuffle</button>`}</div>` : ''}</div></div>`;
}
function slotsInto(sel, nsel, tok, title, defs) {
  const box = $(sel); if (!box || tok !== renderTok) return;
  box.innerHTML = defs.map((d, i) => slot(`s${tok}_${i}`, d[0], d[2] || 'cards', d[3] || '')).join('');
  settle(defs.map((d, i) => fillShelf(`s${tok}_${i}`, tok, d[1], items => shelfBody(items, `${title}: ${d[0]}`))), tok, nsel);
}
function defsPage(tok, title, sub, defs) {
  setTimeout(() => slotsInto('#pg', '#pgn', tok, title, defs));
  return header(title) + (sub ? `<p class="greet">${esc(sub)}</p>` : '') + '<div id="pg"></div><div id="pgn"></div>';
}
function dynPage(tok, title, sub, loader, fallback) {
  setTimeout(() => {
    Promise.resolve().then(loader).then(sh => {
      if (tok !== renderTok) return;
      if (!sh || !sh.length) throw new Error('empty');
      $('#pg').innerHTML = sh.slice(0, 14).map(s => sec(s.title || title, shelfBody(s.items, s.title || title))).join('');
      restoreScroll();
    }).catch(() => {
      if (tok !== renderTok) return;
      if (fallback && fallback.length) slotsInto('#pg', '#pgn', tok, title, fallback);
      else { const p = $('#pg'); if (p) p.innerHTML = errBox(); }
    });
  });
  return header(title) + (sub ? `<p class="greet">${esc(sub)}</p>` : '') + '<div id="pg"><div class="spin"></div></div><div id="pgn"></div>';
}

/* ================= views ================= */
const KINDS = {
  liked: { title: 'Favorite Songs', icon: 'heartFill', get: () => S.liked.filter(t => !t.live), empty: { icon: 'heart', t: 'No favorites yet', d: 'Tap the heart on any song to keep it here.' } },
  stations: { title: 'Saved Stations', icon: 'radio', get: () => S.liked.filter(t => t.live), empty: { icon: 'radio', t: 'No saved stations', d: 'Save live stations from their ••• menu to find them fast.' } },
  downloads: { title: 'Downloaded', icon: 'download', get: () => S.downloads, empty: { icon: 'download', t: 'No downloads', d: 'Download songs from their ••• menu to play them offline, even in airplane mode.' } },
  locals: { title: 'On This Device', icon: 'folder', get: () => S.locals, empty: { icon: 'folder', t: 'No device music', d: 'Add MP3, M4A, FLAC, WAV or OGG files from this phone or computer.', btn: ['import', 'Add Music Files'] } },
  history: { title: 'Recently Played', icon: 'clock', get: () => S.history, empty: { icon: 'clock', t: 'Nothing played yet', d: 'Songs and stations you play show up here.' } },
  trending: { title: 'Trending on Audius', load: e => Audius.trending(e.g || '') },
  under: { title: 'Fresh Underground', load: () => Audius.underground() },
  artist: { title: 'Artist', load: e => Audius.userTracks(e.id) },
  rtag: { title: 'Stations', icon: 'radio', load: e => Radio.tag(e.g) },
};
const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Late night listening' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
async function quickPicks() {
  const seed = S.history.find(t => t.source === 'yt' || t.ytId);
  if (seed) { try { const r = await YT.related({ sid: ytIdOf(seed) }); if (r.length) return r; } catch (e) { } }
  return YT.songs(`${myLangs()[0]} trending songs ${YEAR}`);
}
function renderHome(e, tok) {
  let html = header('Home', { right: nbBtn('go', 'gear', 'Settings', 'data-v="settings"') }) + `<p class="greet">${greeting()}</p>`;
  if (!navigator.onLine) {
    html += `<div class="note">${I.wifiOff}<span>You’re offline. Downloads and music on this device still play.</span></div>`;
    const off = [...S.downloads, ...S.locals];
    return html + (off.length ? sec('Available offline', rowsHTML(off, reg(off, { from: 'Offline' }), { dur: true })) : emptyState({ icon: 'download', t: 'Nothing saved offline', d: 'Next time you’re online, download songs to keep them here.' }));
  }
  const langs = myLangs();
  if (S.history.length) { const r = S.history.slice(0, 16); html += sec('Recently played', cardsHTML(r, reg(r, { from: 'Recently played' })), { moreK: 'history' }); }
  html += slot('h-qp', 'Quick picks', 'rows', 'Songs picked for you');
  html += '<div id="h-ytm"></div>';
  langs.slice(0, 3).forEach((L, i) => {
    html += slot(`h-l${i}s`, `Top ${L} songs`, 'rows', '', { moreHTML: `<button class="see" data-a="lang" data-l="${esc(L)}">See All</button>` });
    html += slot(`h-l${i}p`, `${L} playlists`, 'cards');
  });
  html += slot('h-ch', 'Top hits worldwide', 'rows', 'The global chart, updated daily', { moreHTML: '<button class="see" data-a="chart" data-r="global" data-title="Global top songs">See All</button>' });
  html += slot('h-rd', 'Live radio', 'round', `Popular in ${countryName(detectCC())}`, { moreTab: 'radio' });
  html += slot('h-au', 'Free & independent', 'cards', 'Fresh music from Audius artists', { moreK: 'trending' });
  html += sec('Moods & moments', moodTiles(8));
  html += `<div id="h-n"></div><p class="foot">${TITLE} is free. No account, no ads.</p>`;
  setTimeout(() => {
    const ps = [fillShelf('h-qp', tok, quickPicks, items => shelfBody(items, 'Quick picks'))];
    langs.slice(0, 3).forEach((L, i) => {
      ps.push(fillShelf(`h-l${i}s`, tok, () => YT.songs(`${L} top songs ${YEAR}`), items => shelfBody(items, `Top ${L} songs`)));
      ps.push(fillShelf(`h-l${i}p`, tok, () => YT.playlists(`${L} hits ${YEAR}`), items => shelfBody(items, `${L} playlists`)));
    });
    ps.push(fillShelf('h-ch', tok, () => Deezer.chart(), l => { const k = reg(l, { from: 'Top hits worldwide' }); return `<div class="cg">${l.slice(0, 24).map((t, i) => rowHTML(t, k, i, { num: true })).join('')}</div>`; }));
    ps.push(fillShelf('h-rd', tok, () => Radio.country(detectCC()).then(l => (l.length ? l : Radio.top())), l => { const s = l.slice(0, 16); return cardsHTML(s, reg(s, { from: 'Live radio' })); }));
    ps.push(fillShelf('h-au', tok, () => Audius.trending(), l => cardsHTML(l.slice(0, 20), reg(l, { from: 'Free & independent' }))));
    settle(ps, tok, '#h-n');
    if (NATIVE) IT.probe().then(ok => (ok ? IT.home() : null)).then(sh => {
      if (!sh || tok !== renderTok) return; const box = $('#h-ytm');
      if (box) box.innerHTML = sh.slice(0, 8).map(s => sec(s.title || 'For you', shelfBody(s.items, s.title || 'For you'))).join('');
    }).catch(() => { });
  });
  return html;
}
function renderExplore(e, tok) {
  const cc = detectCC();
  let html = header('Explore');
  html += sec('Charts', `<div class="tiles">${[[`Top songs in ${countryName(cc)}`, cc, 350], ['Global top songs', 'global', 210], ['Viral right now', 'viral', 30]]
    .map(([t, r, h]) => tile(t, `data-a="chart" data-r="${r}" data-title="${esc(t)}"`, h)).join('')}</div>`);
  html += sec('Languages', langTiles(), { sub: `Music in ${LANGS.length} languages` });
  html += sec('Moods & moments', moodTiles());
  html += sec('Genres', ytGenreTiles());
  html += '<div id="ex-ytm"></div>';
  html += sec('Free & independent', genreTiles(), { sub: 'Full songs shared by Audius artists' });
  if (NATIVE) setTimeout(() => IT.probe().then(ok => (ok ? IT.moods() : null)).then(groups => {
    if (!groups || tok !== renderTok) return; const box = $('#ex-ytm'); if (!box) return;
    box.innerHTML = groups.slice(0, 4).map(g => sec(g.title, `<div class="tiles">${g.items.map(b => `<div class="tile" style="${b.color ? `background:${argb(b.color)}` : `--h:${hue(b.title)}`}" data-a="ytcat" data-p="${esc(b.params)}" data-title="${esc(b.title)}" role="button" tabindex="0"><span>${esc(b.title)}</span></div>`).join('')}</div>`, { sub: 'From YouTube Music' })).join('');
  }).catch(() => { }));
  return html;
}
function langDefs(L) {
  return [
    ['Top songs', () => YT.songs(`${L} top songs ${YEAR}`), 'rows'],
    ['New releases', () => YT.playlists(`new ${L} songs ${YEAR}`)],
    ['Top playlists', () => YT.playlists(`${L} hits`)],
    ['Romance', () => YT.playlists(`${L} romantic songs`)],
    ['Party', () => YT.playlists(`${L} party songs`)],
    ['Chill & melodies', () => YT.playlists(`${L} melody chill songs`)],
    ['Throwback', () => YT.playlists(`${L} 90s 2000s hits`)],
    ['Sad songs', () => YT.playlists(`${L} sad songs`)],
    ['Devotional', () => YT.playlists(`${L} devotional songs`)],
    ['Artists', () => YT.artists(`${L} singer`), 'round'],
  ];
}
function moodDefs(m) {
  return [
    [`${m} playlists`, () => YT.playlists(`${m} music`)],
    [`${m} songs`, () => YT.songs(`${m} songs ${YEAR}`), 'rows'],
    ...myLangs().slice(0, 3).map(L => [`${L} ${m.toLowerCase()}`, () => YT.playlists(`${L} ${m} songs`)]),
  ];
}
function chartDefs(r) {
  if (r === 'global') return [
    ['Worldwide top 50', () => Deezer.chart(), 'rows'],
    ['Global top songs', () => YT.songs(`global top 50 songs ${YEAR}`), 'rows'],
    ['Global hit playlists', () => YT.playlists(`global top hits ${YEAR}`)],
  ];
  if (r === 'viral') return [
    ['Viral songs', () => YT.songs(`viral songs ${YEAR}`), 'rows'],
    ['Viral playlists', () => YT.playlists(`viral hits ${YEAR}`)],
    ['Trending reels songs', () => YT.playlists(`trending reels songs ${YEAR}`)],
  ];
  const c = countryName(r);
  return [
    ['Top songs', () => YT.songs(`top songs ${c} ${YEAR}`), 'rows'],
    ['Top playlists', () => YT.playlists(`top 50 ${c} ${YEAR}`)],
    ['Trending', () => YT.playlists(`trending ${c} songs`)],
  ];
}

/* search */
let sTok = 0, sDeb, sSug;
const SCH = [['songs', 'Songs'], ['albums', 'Albums'], ['artists', 'Artists'], ['playlists', 'Playlists'], ['radio', 'Radio'], ['free', 'Free music'], ['lib', 'Library']];
function renderSearch(e) {
  e.seg = e.seg || 'songs'; const q = e.q || '';
  setTimeout(() => { const i = $('#sq'); if (!i) return; i.value = q; q.trim() ? runSearch(e) : showSearchHome(); });
  return header('Search') + `<div class="sbar"><label class="sfield ${q ? 'has' : ''}">${I.search}<input id="sq" type="search" placeholder="Songs, artists, albums, stations" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Search">
    <button class="sx" data-a="sclear" aria-label="Clear search">${I.x}</button></label></div>
    <div class="chips pg" id="sseg" ${q.trim() ? '' : 'hidden'}>${SCH.map(([k, l]) => `<button class="chip ${e.seg === k ? 'on' : ''}" data-a="sseg" data-s="${k}">${l}</button>`).join('')}</div>
    <div id="ssug"></div><div id="sres"></div>`;
}
function searchInput(v) {
  const e = cv(); if (e.v !== 'search') return; e.q = v;
  const f = $('.sfield'); if (f) f.classList.toggle('has', !!v);
  const sg = $('#sseg'); if (sg) sg.hidden = !v.trim();
  clearTimeout(sDeb); clearTimeout(sSug);
  if (!v.trim()) { const s = $('#ssug'); if (s) s.innerHTML = ''; return showSearchHome(); }
  sSug = setTimeout(() => {
    YT.suggest(v.trim()).then(list => {
      if (cv().q !== v) return; const s = $('#ssug'); if (!s) return;
      const l = (list || []).filter(x => x && x.toLowerCase() !== v.trim().toLowerCase()).slice(0, 8);
      s.innerHTML = l.length ? `<div class="chips pg sug">${l.map(x => `<button class="chip ghost" data-a="recent" data-q="${esc(x)}">${I.search}${esc(x)}</button>`).join('')}</div>` : '';
    }).catch(() => { });
  }, 220);
  sDeb = setTimeout(() => runSearch(e), 550);
}
function showSearchHome() {
  const box = $('#sres'); if (!box) return; ++sTok;
  let h = '';
  if (S.searches.length) h += `<div class="sub-h row-h"><span>Recent</span><button class="see" data-a="clearRecent">Clear</button></div><div class="rows">${S.searches.map(q => `<div class="row" data-a="recent" data-q="${esc(q)}"><span class="thumb ptile ghost">${I.clock}</span><div class="rb"><div class="rtx"><div class="rt"><span class="tx">${esc(q)}</span></div></div></div></div>`).join('')}</div>`;
  h += `<div class="sub-h">Browse by language</div>${langTiles()}<div class="sub-h">Moods & moments</div>${moodTiles()}`;
  box.innerHTML = h;
}
function libSearch(q) {
  q = q.toLowerCase(); const pool = new Map();
  [...S.liked, ...S.downloads, ...S.locals, ...S.history, ...S.playlists.flatMap(p => p.tracks)].forEach(t => {
    if (!pool.has(t.id) && `${t.title} ${t.artist} ${t.album || ''}`.toLowerCase().includes(q)) pool.set(t.id, t);
  });
  return { tracks: [...pool.values()], pls: S.playlists.filter(p => p.name.toLowerCase().includes(q)) };
}
async function runSearch(e) {
  const q = (e.q || '').trim(); const box = $('#sres'); if (!box) return;
  if (!q) return showSearchHome();
  const tok = ++sTok; box.innerHTML = '<div class="spin"></div>';
  const none = `<div class="empty">${I.search}<h3>No results for “${esc(q)}”</h3><p>Check the spelling, or try another tab above.</p></div>`;
  try {
    let html = '';
    if (e.seg === 'songs') {
      const [tr, ar] = await Promise.allSettled([YT.songs(q), YT.artists(q)]);
      if (tok !== sTok) return;
      const songs = tr.status === 'fulfilled' ? tr.value : [];
      const artists = ar.status === 'fulfilled' ? ar.value : [];
      if (artists.length) html += `<div class="sub-h">Artists</div><div class="hs">${artists.slice(0, 10).map(collCard).join('')}</div>`;
      if (songs.length) html += `<div class="sub-h">Songs</div>` + rowsHTML(songs, reg(songs, { from: `Search: ${q}` }), { dur: true });
      if (!songs.length && tr.status === 'rejected') {
        const au = await Audius.search(q).catch(() => []); if (tok !== sTok) return;
        html += `<div class="note">${I.pulse}<span>The YouTube mirrors are busy right now, so here are free full songs instead. Try again in a minute for everything else.</span></div>`;
        if (au.length) html += rowsHTML(au, reg(au, { from: `Search: ${q}` }), { dur: true });
      }
    } else if (e.seg === 'albums') { const r = await YT.albums(q); if (tok !== sTok) return; if (r.length) html = gridCards(r); }
    else if (e.seg === 'artists') { const r = await YT.artists(q); if (tok !== sTok) return; if (r.length) html = gridCards(r); }
    else if (e.seg === 'playlists') { const r = await YT.playlists(q); if (tok !== sTok) return; if (r.length) html = gridCards(r); }
    else if (e.seg === 'radio') { const tr = await Radio.search(q); if (tok !== sTok) return; if (tr.length) html = rowsHTML(tr, reg(tr, { from: 'Radio' })); }
    else if (e.seg === 'free') { const tr = await Audius.search(q); if (tok !== sTok) return; if (tr.length) html = rowsHTML(tr, reg(tr, { from: `Free music: ${q}` }), { dur: true }); }
    else {
      const { tracks, pls } = libSearch(q);
      if (pls.length) html += `<div class="sub-h">Playlists</div><div class="hs">${pls.map(myPlCard).join('')}</div>`;
      if (tracks.length) html += `<div class="sub-h">Songs & stations</div>` + rowsHTML(tracks, reg(tracks, { from: 'Library' }));
    }
    if (tok === sTok) box.innerHTML = html || none;
  } catch (err) { console.warn(err); if (tok === sTok) box.innerHTML = errBox('Search isn’t responding', 'The free music mirrors may be busy. Try again in a moment.'); }
}

/* radio */
const RSEG = [['top', 'Top'], ['near', 'Near You'], ['genres', 'Genres'], ['fav', 'Saved']];
function renderRadio(e, tok) {
  e.seg = e.seg || 'top';
  setTimeout(() => loadRadio(e, tok));
  return header('Radio') + `<p class="greet">Live stations from every corner of the world.</p>
    <div class="seg" id="rseg">${RSEG.map(([k, l]) => `<button data-a="rseg" data-s="${k}" class="${e.seg === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="rres"></div>`;
}
function loadRadio(e, tok) {
  const box = $('#rres'); if (!box) return;
  const s = e.seg; const my = e.rt = (e.rt || 0) + 1;
  if (s === 'genres') { box.innerHTML = `<div class="tiles">${RTAGS.map(([g, l], i) => tile(l, `data-a="rtag" data-g="${g}" data-title="${esc(l)}"`, (i * 37 + 200) % 360)).join('')}</div>`; return; }
  if (s === 'fav') { const l = S.liked.filter(t => t.live); box.innerHTML = l.length ? rowsHTML(l, reg(l, { from: 'Saved stations' })) : emptyState(KINDS.stations.empty); return; }
  box.innerHTML = skRows(8);
  const cc = detectCC();
  const p = (s === 'near' ? Radio.country(cc) : Radio.top()).then(l => { if (e.rt !== my) throw 'stale'; return l; });
  fill('#rres', tok, p, l => {
    const from = s === 'near' ? `Radio in ${countryName(cc)}` : 'Top stations';
    return (s === 'near' ? `<div class="sub-h">${esc(countryName(cc))}</div>` : '') + (l.length ? rowsHTML(l, reg(l, { from })) : emptyState({ icon: 'radio', t: 'No stations found', d: 'Pick another region in Settings.' }));
  });
}

/* library */
function renderLibrary() {
  const items = [['liked', 'Favorite Songs', 'heart', KINDS.liked.get().length], ['playlists', 'Playlists', 'playlist', S.playlists.length],
    ['downloads', 'Downloaded', 'download', S.downloads.length], ['locals', 'On This Device', 'folder', S.locals.length],
    ['stations', 'Saved Stations', 'radio', KINDS.stations.get().length], ['history', 'Recently Played', 'clock', S.history.length]];
  let html = header('Library', { right: nbBtn('newpl', 'plus', 'New playlist') + nbBtn('go', 'gear', 'Settings', 'data-v="settings"') });
  html += `<div class="nl">${items.map(([k, l, ic, n]) => `<div class="nli" data-a="go" data-v="coll" data-k="${k}" role="button" tabindex="0">${I[ic]}<div class="nb2"><span>${l}</span><span class="cnt">${n || ''}</span><span class="chev">${I.chevR}</span></div></div>`).join('')}</div>`;
  if (S.playlists.length) html += sec('Your playlists', `<div class="hs">${S.playlists.map(myPlCard).join('')}</div>`);
  if (S.history.length) { const r = S.history.slice(0, 12); html += sec('Recently played', cardsHTML(r, reg(r, { from: 'Recently played' })), { moreK: 'history' }); }
  if (!S.playlists.length && !S.liked.length && !S.history.length) html += emptyState({ icon: 'music', t: 'Your library starts here', d: 'Favorite songs, make playlists, download for offline, or add music files from this device.', btn: ['gosearch', 'Find Music'] });
  return html;
}
function renderPlaylists() {
  return header('Playlists', { right: nbBtn('newpl', 'plus', 'New playlist') }) + `<div class="rows">
    <div class="row" data-a="newpl"><div class="thumb ptile">${I.plus}</div><div class="rb"><div class="rtx"><div class="rt acc">New Playlist…</div></div></div></div>
    ${S.playlists.map(p => `<div class="row" data-a="mypl" data-id="${p.id}">${collage(p.tracks, 'thumb')}<div class="rb"><div class="rtx"><div class="rt"><span class="tx">${esc(p.name)}</span></div><div class="rs">${plural(p.tracks.length, 'song')}</div></div><span class="chev">${I.chevR}</span></div></div>`).join('')}</div>`;
}
function renderMyPl(e) {
  const p = S.playlists.find(x => x.id === e.id);
  if (!p) return header('Playlist', { noLarge: true }) + emptyState({ icon: 'playlist', t: 'This playlist was deleted' });
  const k = reg(p.tracks, { from: p.name, pl: p.id });
  return header(p.name, { noLarge: true, right: (p.tracks.length ? nbBtn('dlall', 'download', 'Download all') : '') + nbBtn('plmenu', 'more', 'Playlist options', `data-id="${p.id}"`) }) +
    collHead(p.name, p.tracks, k) +
    (p.tracks.length ? rowsHTML(p.tracks, k, { dur: true }) : emptyState({ icon: 'search', t: 'This playlist is empty', d: 'Add songs with “Add to Playlist…” from any song’s ••• menu.', btn: ['gosearch', 'Find Music'] }));
}
function renderYtColl(e, tok) {
  const c = e.c || {}; const ar = c.kind === 'artist';
  const right = nbBtn('savecoll', 'plus', 'Save to Library') + nbBtn('dlall', 'download', 'Download all');
  setTimeout(() => fill('#cb', tok, YT.collection(c), r => {
    e.tracks = r.tracks || []; e.title = r.title || c.title;
    const k = reg(e.tracks, { from: e.title });
    let h = collHead(e.title, e.tracks, k, { art: r.art || c.art, sub: r.sub || c.sub, round: ar, icon: (r.art || c.art) ? null : 'music' });
    if (ar) {
      if (e.tracks.length) h += `<div class="sub-h">Top songs</div>` + rowsHTML(e.tracks.slice(0, 12), k, { dur: true });
      (r.shelves || []).forEach(s => { h += sec(s.title || 'More', shelfBody(s.items, s.title || e.title)); });
      if (!e.tracks.length && !(r.shelves || []).length) h += emptyState({ icon: 'music', t: 'Nothing here right now', d: 'Try again in a little while.' });
    } else h += e.tracks.length ? rowsHTML(e.tracks, k, { dur: true }) : emptyState({ icon: 'music', t: 'This list is empty' });
    return h;
  }));
  return header(c.title || '', { noLarge: true, right }) + `<div id="cb">${collHead(c.title || '', [], '', { art: c.art, icon: c.art ? null : 'music', sub: 'Loading…', round: ar })}<div class="spin"></div></div>`;
}
function renderColl(e, tok) {
  if (e.k === 'playlist') return renderMyPl(e);
  if (e.k === 'playlists') return renderPlaylists();
  if (e.k === 'yt') return renderYtColl(e, tok);
  if (e.k === 'lang') { const n = (LANGS.find(x => x[0] === e.l) || [])[1]; return defsPage(tok, e.l, n && n !== e.l ? n : '', langDefs(e.l)); }
  if (e.k === 'mood') return defsPage(tok, e.m, '', moodDefs(e.m));
  if (e.k === 'chart') {
    const fb = chartDefs(e.r);
    if (NATIVE && e.r !== 'viral') return dynPage(tok, e.title, 'From YouTube Music charts', async () => ((await IT.probe()) ? IT.charts(e.r === 'global' ? 'ZZ' : e.r) : null), fb);
    return defsPage(tok, e.title, '', fb);
  }
  if (e.k === 'ytcat') return dynPage(tok, e.title, 'From YouTube Music', () => IT.category(e.p), moodDefs(e.title));
  const K = KINDS[e.k]; if (!K) return header('Not found', { noLarge: true }) + emptyState({ t: 'This page doesn’t exist' });
  const title = e.title || K.title;
  const canDl = ['liked', 'artist', 'trending', 'under', 'history'].includes(e.k);
  const right = (e.k === 'locals' ? nbBtn('import', 'plus', 'Add music files') : '') + (canDl ? nbBtn('dlall', 'download', 'Download all') : '') +
    (e.k === 'downloads' && S.downloads.length ? nbBtn('clearDl', 'trash', 'Remove all downloads') : '') + (e.k === 'history' && S.history.length ? nbBtn('clearHist', 'trash', 'Clear history') : '');
  let html = header(title, { noLarge: true, right });
  if (K.get) {
    const tr = K.get(); const k = reg(tr, { from: title });
    html += collHead(title, tr, k, { icon: K.icon });
    if (e.k === 'locals' && tr.length) html += `<div class="note">${I.folder}<span>Files stay private on this device and play offline.${matchMedia('(hover:hover)').matches ? ' You can also drag and drop files anywhere.' : ''}</span><button class="btn sm" data-a="import">Add</button></div>`;
    if (e.k === 'downloads') { html += `<div class="note">${I.download}<span id="stor">Checking storage…</span></div>`; setTimeout(() => storageNote('#stor')); }
    html += tr.length ? rowsHTML(tr, k, { dur: true }) : emptyState(K.empty);
    return html;
  }
  html += `<div id="cb">${collHead(title, [], '', { art: e.art, icon: e.art ? null : (K.icon || 'music'), sub: 'Loading…' })}<div class="spin"></div></div>`;
  fill('#cb', tok, K.load(e), tr => {
    e.tracks = tr; const k = reg(tr, { from: title });
    const art = e.art || (!K.icon && tr[0] ? artOf(tr[0], true) : null);
    return collHead(title, tr, k, { art, icon: art ? null : K.icon }) + (tr.length ? rowsHTML(tr, k, { dur: true }) : emptyState({ icon: 'music', t: 'Nothing here right now', d: 'Try again in a little while.' }));
  });
  return html;
}
function renderSettings() {
  const s = S.settings;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true || NATIVE;
  const li = o => `<div class="li" ${o.a ? `data-a="${o.a}" role="button" tabindex="0"` : ''} ${o.extra || ''}>${o.icon ? `<span class="lic" style="background:${o.color || 'var(--accent)'}">${I[o.icon]}</span>` : ''}
    <div class="lb"><span class="lx ${o.danger ? 'danger' : ''} ${o.small ? 'small' : ''}" ${o.id ? `id="${o.id}"` : ''}>${esc(o.label)}</span>${o.value !== undefined ? `<span class="lv">${esc(o.value)}</span>` : ''}${o.ctl || ''}${o.chev ? `<span class="chev">${I.chevR}</span>` : ''}</div></div>`;
  const grp = (t, inner, foot) => `<div class="grp-t">${esc(t)}</div><div class="grp">${inner}</div>${foot ? `<p class="grp-f">${esc(foot)}</p>` : ''}`;
  const sw = (k, v) => `<label class="sw"><input type="checkbox" data-set="${k}" ${v ? 'checked' : ''}><span></span></label>`;
  const timerVal = Player.sleepEnd ? 'End of song' : Player.sleepAt ? `${Math.ceil((Player.sleepAt - Date.now()) / 60000)} min` : 'Off';
  const engine = IT.ok ? 'Direct' : NATIVE ? 'Direct (checking)' : 'Public mirrors';
  const mirror = (Mirrors.best.piped || Mirrors.best.inv || '').replace(/^https?:\/\//, '') || 'Chosen automatically';
  setTimeout(() => storageNote('#stor2'));
  return header('Settings') +
    grp('Music',
      li({ icon: 'globe', color: '#ff375f', label: 'Languages', value: myLangs().slice(0, 3).join(', ') + (myLangs().length > 3 ? ` +${myLangs().length - 3}` : ''), a: 'langs', chev: true }) +
      `<div class="li"><div class="lb"><span class="lx">Streaming quality</span></div></div><div class="pad"><div class="seg">${[['high', 'High'], ['normal', 'Normal'], ['saver', 'Data saver']].map(([k, l]) => `<button data-a="quality" data-q="${k}" class="${s.quality === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>`) +
    grp('Appearance', `<div class="pad"><div class="seg">${[['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button data-a="theme" data-t="${k}" class="${s.theme === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="sws" role="group" aria-label="Accent color">${ACCENTS.map(c => `<button class="swc ${s.accent === c ? 'on' : ''}" style="--c:${c}" data-a="accent" data-c="${c}" aria-label="Accent color ${c}"></button>`).join('')}</div>`) +
    grp('Playback',
      li({ icon: 'eq', color: '#ff9f0a', label: 'Equalizer', value: s.eqOn ? s.eqPreset : 'Off', a: 'eq', chev: true }) +
      li({ icon: 'infinity', color: '#30d158', label: 'Autoplay similar songs', ctl: sw('autoplay', s.autoplay) }) +
      li({ icon: 'timer', color: '#5e5ce6', label: 'Sleep Timer', value: timerVal, a: 'sleep', chev: true }) +
      li({ icon: 'speed', color: '#0a84ff', label: 'Playback Speed', value: Player.rate + '×', a: 'speed', chev: true }) +
      li({ icon: 'radio', color: '#ff375f', label: 'Region', ctl: `<select class="sel" data-set="country" aria-label="Region">${COUNTRIES.map(([c, n]) => `<option value="${c}" ${s.country === c ? 'selected' : ''}>${n}</option>`).join('')}</select>` }),
      'Autoplay keeps the music going with similar songs when your queue runs out.') +
    grp('Music sources',
      li({ icon: 'pulse', color: '#ff3b30', label: 'YouTube Music engine', value: engine }) +
      li({ label: 'Mirror in use', value: mirror, small: false }) +
      li({ label: 'Test music sources', a: 'testsrc', chev: true }) +
      li({ label: 'Custom mirror', value: s.mirror ? s.mirror.replace(/^https?:\/\//, '') : 'None', a: 'setmirror', chev: true }),
      NATIVE ? 'The app talks to YouTube Music directly and falls back to public mirrors if needed.' : 'In a browser, Tune Tune streams through free public mirrors and switches automatically when one is busy. The desktop and Android apps connect to YouTube Music directly, which is the most reliable.') +
    grp('Storage',
      li({ icon: 'download', color: '#30d158', label: 'Downloaded', value: String(S.downloads.length), a: 'go', extra: 'data-v="coll" data-k="downloads"', chev: true }) +
      li({ icon: 'folder', color: '#8e8e93', label: 'On This Device', value: String(S.locals.length), a: 'go', extra: 'data-v="coll" data-k="locals"', chev: true }) +
      li({ label: 'Checking storage…', small: true, id: 'stor2' }) +
      (S.downloads.length ? li({ label: 'Remove All Downloads', danger: true, a: 'clearDl' }) : '')) +
    grp('Your Library',
      li({ icon: 'share', color: '#0a84ff', label: 'Export Backup', a: 'exportData', chev: true }) +
      li({ icon: 'upload', color: '#0a84ff', label: 'Import Backup', a: 'importData', chev: true }) +
      (S.history.length ? li({ label: 'Clear Listening History', danger: true, a: 'clearHist' }) : '') +
      li({ label: 'Reset Tune Tune', danger: true, a: 'resetAll' }),
      'Backups include favorites, playlists, history and settings. Downloaded and device files stay on this device.') +
    (standalone ? '' : grp('App', li({ icon: 'plus', color: 'var(--accent)', label: `Install ${TITLE}`, a: 'install', chev: true }),
      IS_IOS ? 'On iPhone and iPad: tap Share, then Add to Home Screen. You get full-screen playback and lock-screen controls.' : 'Install for a full-screen app with lock-screen and headphone controls.')) +
    grp('About', li({ label: 'Version', value: VER + (IS_DESKTOP ? ' (desktop)' : IS_CAP ? ' (Android)' : '') }) + li({ label: 'Shortcuts', value: 'Space, arrows, L, /' }),
      `${TITLE} is free, with no account, ads or subscription. Lyrics come from LRCLIB, live radio from Radio Browser, and independent music from Audius.`) +
    '<div style="height:24px"></div>';
}
const VIEWS = { home: renderHome, explore: renderExplore, search: renderSearch, radio: renderRadio, library: renderLibrary, coll: renderColl, settings: renderSettings };

/* ================= actions ================= */
const listOf = d => REG.get(d.l);
const Actions = {
  play(el, d) {
    const L = listOf(d); if (!L) return; const t = L.tracks[+d.i]; if (!t) return;
    if (Player.cur && Player.cur.id === t.id && Player.loaded && !Player.el.paused) { openNP(); return; }
    Player.playList(L.tracks, +d.i, L.meta.from || '');
    if (nav.tab === 'search' && cv().q) saveSearch(cv().q);
  },
  more(el, d) { const L = listOf(d); const t = L && L.tracks[+d.i]; if (t) trackMenu(t, L.meta); },
  playAll(el, d) { const L = listOf(d); if (L && L.tracks.length) Player.playList(L.tracks, 0, L.meta.from, false); },
  shufAll(el, d) { const L = listOf(d); if (L && L.tracks.length) Player.playList(L.tracks, Math.floor(Math.random() * L.tracks.length), L.meta.from, true); },
  go(el, d) { go(d.v, { k: d.k, g: d.g, id: d.id, title: d.title, art: d.art }); },
  openc(el, d) { const c = REGC.get(d.c); if (c) go('coll', { k: 'yt', c, title: c.title }); },
  lang(el, d) { go('coll', { k: 'lang', l: d.l, title: d.l }); },
  mood(el, d) { go('coll', { k: 'mood', m: d.m, title: d.m }); },
  chart(el, d) { go('coll', { k: 'chart', r: d.r, title: d.title || 'Charts' }); },
  ytcat(el, d) { go('coll', { k: 'ytcat', p: d.p, title: d.title }); },
  back() { history.back(); },
  toggle() { Player.toggle(); }, next() { Player.next(); }, prev() { Player.prev(); },
  opennp() { openNP(); }, npclose() { closeNP(); },
  shuffle() { Player.setShuffle(!Player.shuffle); }, repeat() { Player.cycleRepeat(); },
  autoplay() { S.settings.autoplay = !S.settings.autoplay; save(); renderQueue(); toast(S.settings.autoplay ? 'Autoplay on' : 'Autoplay off'); },
  nplike() { if (Player.cur) toggleLike(Player.cur); },
  npmore() { if (Player.cur) trackMenu(Player.cur, { np: true }); },
  npartist() { const t = Player.cur; if (t && t.uid) goArtist(t); },
  panel(el, d) { togglePanel(d.p); },
  qjump(el, d) { Player.jump(+d.q); }, qrm(el, d) { Player.removeAt(+d.q); }, qclear() { Player.clearUpNext(); },
  lyseek(el, d) { Player.seek(+d.t); lyrHold = 0; },
  eq() { openEQ(); }, sleep() { sleepMenu(); }, speed() { speedMenu(); },
  eqp(el, d) {
    if (!PRESETS[d.n]) return;
    S.settings.eq = PRESETS[d.n].slice(); S.settings.eqPreset = d.n;
    if (!S.settings.eqOn) return eqToggle(true);
    save(); Player.applyEq(); const b = $('#eqbox'); if (b) b.innerHTML = eqInner();
  },
  sseg(el, d) { const e = cv(); e.seg = d.s; $$('#sseg .chip').forEach(b => b.classList.toggle('on', b === el)); runSearch(e); },
  sclear() { const i = $('#sq'); if (i) { i.value = ''; i.focus(); } searchInput(''); },
  recent(el, d) { const i = $('#sq'); if (i) i.value = d.q; searchInput(d.q); clearTimeout(sDeb); clearTimeout(sSug); const s = $('#ssug'); if (s) s.innerHTML = ''; runSearch(cv()); saveSearch(d.q); },
  clearRecent() { S.searches = []; save(); showSearchHome(); },
  rseg(el, d) { const e = cv(); e.seg = d.s; $$('#rseg button').forEach(b => b.classList.toggle('on', b === el)); loadRadio(e, renderTok); },
  genre(el, d) { go('coll', { k: 'trending', g: d.g, title: d.g.replace('/Rap', '').replace('/Soul', '') }); },
  rtag(el, d) { go('coll', { k: 'rtag', g: d.g, title: d.title }); },
  artist(el, d) { go('coll', { k: 'artist', id: d.id, title: d.title, art: d.art }); },
  mypl(el, d) { go('coll', { k: 'playlist', id: d.id }); },
  newpl() { createPlaylistFlow(); },
  plmenu(el, d) { playlistMenu(d.id); },
  savecoll() {
    const e = cv(); if (!e.tracks || !e.tracks.length) return toast('Still loading — try again in a moment');
    newPlaylist(e.title || 'Playlist', e.tracks); toast(`Saved “${e.title || 'Playlist'}” to your Library`);
  },
  dlall() {
    const e = cv(); let tr = [];
    if (e.k === 'playlist') { const p = S.playlists.find(x => x.id === e.id); tr = p ? p.tracks : []; }
    else tr = e.tracks || (KINDS[e.k] && KINDS[e.k].get ? KINDS[e.k].get() : []);
    downloadMany(tr);
  },
  import() { $('#f-audio').click(); },
  gosearch() { switchTab('search'); setTimeout(() => { const i = $('#sq'); if (i) i.focus(); }, 60); },
  theme(el, d) { S.settings.theme = d.t; save(); applyTheme(); softRender(); },
  accent(el, d) { S.settings.accent = d.c; save(); applyTheme(); softRender(); },
  quality(el, d) { S.settings.quality = d.q; Streams.c.clear(); save(); softRender(); toast(`Streaming quality: ${el.textContent}`); },
  langs() { langPicker(false); },
  lpick(el, d) { if (!pickSel) return; if (pickSel.has(d.l)) pickSel.delete(d.l); else pickSel.add(d.l); el.classList.toggle('on', pickSel.has(d.l)); },
  lpdone() {
    const l = pickSel ? [...pickSel] : []; S.settings.langs = l.length ? l : ['English']; pickSel = null; save(); closeSheet();
    const e = cv(); if (e.v === 'home' || e.v === 'settings') softRender();
  },
  testsrc() { testSources(); },
  async setmirror() {
    const v = await ask('Custom mirror', 'https://your-piped-api-or-invidious-site', S.settings.mirror || '');
    if (v === null) return;
    if (v && !/^https?:\/\/[^\s]+$/.test(v)) return toast('Enter a full address starting with https://');
    S.settings.mirror = v.replace(/\/+$/, ''); Mirrors.best = {}; mem.clear(); save(); softRender(); toast(v ? 'Custom mirror saved' : 'Custom mirror removed');
  },
  exportData() { exportData(); }, importData() { $('#f-backup').click(); },
  clearDl() {
    confirmSheet('Remove all downloads?', 'Songs stay in your favorites and playlists, but won’t play offline.', 'Remove All', async () => {
      for (const t of S.downloads) { await DB.del(t.id).catch(() => { }); await DB.del('art:' + t.id).catch(() => { }); dropArt(t.id); }
      S.downloads = []; save(); softRender(); toast('Downloads removed');
    });
  },
  clearHist() { confirmSheet('Clear listening history?', 'Recently Played will be emptied.', 'Clear History', () => { S.history = []; save(); softRender(); toast('History cleared'); }); },
  resetAll() {
    confirmSheet(`Reset ${TITLE}?`, 'This deletes favorites, playlists, downloads, device music and settings on this device.', 'Reset Everything', () => {
      try { localStorage.removeItem(KEY); localStorage.removeItem('tunetune.mirrors'); } catch (e) { }
      const r = indexedDB.deleteDatabase('tunetune'); r.onsuccess = r.onerror = r.onblocked = () => location.reload();
    });
  },
  install() {
    if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; }
    else toast(IS_IOS ? 'Tap Share, then Add to Home Screen' : 'Open your browser menu and choose Install app');
  },
  reload() { mem.clear(); IT.failAt = 0; render(); },
  sa(el, d) { const a = sheetActs[+d.i]; closeSheet(); if (a && a.fn) setTimeout(a.fn, 60); },
  sclose() { closeSheet(); },
  asko() { const v = (($('#askin') || {}).value || '').trim(); const r = askRes; askRes = null; closeSheet(); if (r) r(v || ''); },
  askc() { closeSheet(); },
};

/* ================= events ================= */
let deferredInstall = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
document.addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]'); if (tab) { switchTab(tab.dataset.tab); return; }
  const el = e.target.closest('[data-a]'); if (!el) return;
  const A = Actions[el.dataset.a]; if (A) { e.preventDefault(); A(el, el.dataset, e); }
});
document.addEventListener('contextmenu', e => {
  const c = e.target.closest('[data-l][data-i]'); if (!c || e.target.closest('#np')) return;
  e.preventDefault(); Actions.more(c, c.dataset);
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'np-seek') {
    seeking = true; const a = Player.el; const d = Player.loaded && isFinite(a.duration) ? a.duration : ((Player.cur && Player.cur.duration) || 0);
    const v = (t.value / 1000) * d; $('#np-cur').textContent = fmt(v); $('#np-rem').textContent = '-' + fmt(d - v); t.style.setProperty('--p', t.value / 10 + '%');
  } else if (t.id === 'np-vol') { Player.setVol(t.value / 100); t.style.setProperty('--p', t.value + '%'); }
  else if (t.dataset && t.dataset.band !== undefined) {
    const i = +t.dataset.band; S.settings.eq[i] = +t.value; S.settings.eqPreset = 'Custom';
    const v = $('#eqv' + i); if (v) v.textContent = fmtDb(t.value);
    const n = $('#eqname'); if (n && S.settings.eqOn) n.textContent = 'Custom';
    $$('#eqbox .chip.on').forEach(c => c.classList.remove('on'));
    Player.applyEq(); save();
  } else if (t.id === 'sq') searchInput(t.value);
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'np-seek') {
    seeking = false; const a = Player.el;
    const d = Player.loaded && isFinite(a.duration) ? a.duration : ((Player.cur && Player.cur.duration) || 0);
    Player.seek((t.value / 1000) * d);
  } else if (t.id === 'eqon') eqToggle(t.checked);
  else if (t.dataset && t.dataset.set) {
    const k = t.dataset.set; S.settings[k] = t.type === 'checkbox' ? t.checked : t.value; save();
    if (k === 'autoplay') toast(t.checked ? 'Autoplay on' : 'Autoplay off');
    if (k === 'country') { mem.clear(); toast(`Region: ${countryName(detectCC())}`); }
  } else if (t.id === 'f-audio') { importFiles(t.files); t.value = ''; }
  else if (t.id === 'f-backup') { importBackup(t.files[0]); t.value = ''; }
});
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.matches && tg.matches('input,textarea,select')) {
    if (tg.id === 'sq' && e.key === 'Enter') { clearTimeout(sDeb); runSearch(cv()); saveSearch(tg.value); tg.blur(); }
    if (tg.id === 'askin' && e.key === 'Enter') Actions.asko();
    if (tg.type !== 'range') return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && tg.matches && tg.matches('[role="button"][data-a],[role="button"][data-tab]')) { e.preventDefault(); tg.click(); return; }
  if (e.key === 'Escape') { if (sheetOpen) return closeSheet(); if (npOpen) return closeNP(); }
  if (e.metaKey || e.ctrlKey || e.altKey || sheetOpen) return;
  if (e.code === 'Space') { if (tg.closest && tg.closest('button')) return; e.preventDefault(); Player.toggle(); }
  else if (e.key === 'ArrowRight' && tg.type !== 'range') { e.preventDefault(); e.shiftKey ? Player.next() : Player.seek(Player.el.currentTime + 10); }
  else if (e.key === 'ArrowLeft' && tg.type !== 'range') { e.preventDefault(); e.shiftKey ? Player.prev() : Player.seek(Player.el.currentTime - 10); }
  else if (e.key === 'l' || e.key === 'L') { if (Player.cur) toggleLike(Player.cur); }
  else if (e.key === '/') { e.preventDefault(); Actions.gosearch(); }
});
addEventListener('popstate', () => {
  if (ignorePop > 0) { ignorePop--; return; }
  if (sheetOpen) { closeSheet(); history.pushState({ v: 1 }, ''); return; }
  if (npOpen) { closeNP(true); return; }
  popView();
});
addEventListener('online', () => {
  toast('Back online');
  if (cv().v === 'home') render();
  if (Player.waitOnline || (Player.wantPlay && Player.loaded && Date.now() - Player.lastProgress > 5000)) Player.recover();
});
addEventListener('offline', () => { toast('You’re offline — downloads still play'); if (cv().v === 'home') render(); });
addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); document.body.classList.add('dropping'); } });
addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('dropping'); });
addEventListener('drop', e => { document.body.classList.remove('dropping'); if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); importFiles(e.dataTransfer.files); } });
addEventListener('unhandledrejection', e => { console.warn('unhandled', e.reason); e.preventDefault && e.preventDefault(); });

function bindGestures() {
  const v = $('#view');
  v.addEventListener('scroll', () => { v.classList.toggle('scrolled', v.scrollTop > (cv().v === 'coll' ? 200 : 40)); }, { passive: true });
  const np = $('#np'); let y0 = null, dy = 0, t0 = 0;
  np.addEventListener('touchstart', e => {
    if (wide() || e.target.closest('.np-panel,input,button') || !e.target.closest('.np-top,.np-art')) { y0 = null; return; }
    y0 = e.touches[0].clientY; dy = 0; t0 = Date.now();
  }, { passive: true });
  np.addEventListener('touchmove', e => {
    if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0);
    if (dy > 4) { np.classList.add('drag'); np.style.transform = `translateY(${dy}px)`; }
  }, { passive: true });
  np.addEventListener('touchend', () => {
    if (y0 === null) return; np.classList.remove('drag'); np.style.transform = '';
    const vel = dy / Math.max(1, Date.now() - t0); if (dy > 140 || (dy > 40 && vel > 0.6)) closeNP(); y0 = null;
  });
  const lyr = $('#np-lyr'); const hold = () => { lyrHold = Date.now() + 3500; };
  lyr.addEventListener('wheel', hold, { passive: true }); lyr.addEventListener('touchmove', hold, { passive: true });
  const mq = matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', applyTheme);
  const mw = matchMedia('(min-width: 900px)'); if (mw.addEventListener) mw.addEventListener('change', () => { if (npOpen) panelRefresh(); });
}
function unlockAudio() {
  const a = Player.plain; if (!SILENT || a.getAttribute('src')) return;
  a.src = SILENT;
  const p = a.play(); if (p && p.then) p.then(() => { if (a.src === SILENT) { a.pause(); a.removeAttribute('src'); a.load(); } }).catch(() => { });
}
async function loadArtCache() {
  const ids = [...S.locals, ...S.downloads].filter(t => t.hasArt).map(t => t.id); if (!ids.length) return;
  for (const id of ids) { try { const b = await DB.get('art:' + id); if (b) artCache.set(id, URL.createObjectURL(b)); } catch (e) { } }
  softRender(); if (Player.cur) UI.track(Player.cur);
}

/* ================= boot ================= */
function init() {
  applyTheme();
  buildShell();
  Mirrors.init();
  Player.init();
  bindGestures();
  history.replaceState({ root: 1 }, '');
  render();
  loadArtCache();
  Audius.discover();
  Mirrors.load();
  IT.probe();
  if (!S.settings.langs) setTimeout(() => langPicker(true), 600);
  if (IS_IOS) document.addEventListener('touchend', unlockAudio, { once: true, capture: true });
  if ('serviceWorker' in navigator && !NATIVE && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => { });
  }
  window.TuneTune = { version: VER, engine: () => (IT.ok ? 'direct' : 'mirrors') };
  if (window.__TT_TEST__) window.TuneTune._ = { Player, Streams, Mirrors, IT, YT, S, nav, cv, Actions, itShelves, mem };
}
try { init(); }
catch (err) {
  console.error(err);
  const v = document.getElementById('view');
  if (v) v.innerHTML = `<div style="padding:40px 24px;font-family:system-ui;max-width:520px;margin:auto"><h2>Tune Tune couldn’t start</h2><p>${esc(err && err.message || err)}</p><p>Reload the page. If it keeps happening, clear this site’s data in your browser settings.</p></div>`;
}
})();
