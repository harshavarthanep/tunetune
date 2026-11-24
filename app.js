/* Tune Tune v2 — free music player
   YouTube Music catalog: direct (desktop/Android app) or public Piped/Invidious mirrors (browser)
   Also: Audius (free full songs), Deezer chart, Radio Browser (live radio), LRCLIB (lyrics)
   Everything runs inside this private scope so nothing collides with browser globals. */
(() => {
'use strict';

const TITLE = 'Tune Tune';
const APP = 'TuneTune';
const VER = '1.1';
// ✏️ OPTIONAL — paste your music-server address between the quotes (e.g. 'https://tunetune.yourname.workers.dev')
// so EVERYONE who opens your website gets clean, ad-free JioSaavn audio with no setup.
const BUILT_IN_SERVER = '';
// ✏️ Links shown in Settings → More from H24 Creationz
const PRODUCTS_URL = 'https://harshavarthanep.github.io/products/';
const GITHUB_URL = 'https://github.com/harshavarthanep';
const TAGLINE = 'YouTube Music-style search · JioSaavn-quality sound · Apple Music-style design';
const KEY = 'tunetune.v1';
const YEAR = new Date().getFullYear();
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_CAP = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
const IS_DESKTOP = !!window.ttDesktop;
const NATIVE = IS_CAP || IS_DESKTOP;
/* Home Server: the desktop app streams clean YouTube Music audio to phones, tablets and browsers */
const Server = {
  base: '', ok: false, p: null,
  candidates() {
    const c = [];
    try { const st = JSON.parse(localStorage.getItem('tunetune.v1') || '{}'); if (st.settings && st.settings.server) c.push(String(st.settings.server).replace(/\/+$/, '')); } catch (e) { }
    if (/^https?:$/.test(location.protocol) && !/\.github\.io$/.test(location.hostname)) c.push(location.origin);
    return [...new Set(c)];
  },
  detect(force) {
    if (NATIVE) return Promise.resolve(false);
    if (this.p && !force) return this.p;
    this.p = (async () => {
      for (const b of this.candidates()) {
        try {
          const c = new AbortController(); const t = setTimeout(() => c.abort(), 3500);
          const r = await fetch(b + '/api/ping', { signal: c.signal }); clearTimeout(t);
          const j = r.ok ? await r.json() : null;
          if (j && j.tunetune) { this.base = b; this.ok = true; return true; }
        } catch (e) { }
      }
      this.ok = false; this.base = ''; return false;
    })();
    return this.p;
  },
};
const DIRECT = () => NATIVE || Server.ok;

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
const LOG = [];
const warn = (...a) => { LOG.push(`${new Date().toLocaleTimeString()} ${a.map(x => (x && x.message) || String(x)).join(' ').slice(0, 200)}`); if (LOG.length > 60) LOG.shift(); try { console.warn(...a); } catch (e) { } };

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
const PC = {
  k: 'tunetune.cache', d: null, tm: 0,
  load() { if (!this.d) { try { this.d = JSON.parse(localStorage.getItem(this.k) || '{}') || {}; } catch (e) { this.d = {}; } } return this.d; },
  get(key) { const e = this.load()[key]; return e && Date.now() - e.t < 7 * 864e5 ? e : null; },
  set(key, v) { this.load()[key] = { t: Date.now(), v }; clearTimeout(this.tm); this.tm = setTimeout(() => this.flush(), 1200); },
  flush() {
    const d = this.load(); const keys = () => Object.keys(d).sort((a, b) => d[a].t - d[b].t);
    let ks = keys(); while (ks.length > 180) delete d[ks.shift()];
    let txt = JSON.stringify(d); while (txt.length > 1500000 && Object.keys(d).length) { delete d[keys()[0]]; txt = JSON.stringify(d); }
    try { localStorage.setItem(this.k, txt); } catch (e) { }
  },
  clear() { this.d = {}; try { localStorage.removeItem(this.k); } catch (e) { } },
};
const PERSIST = /^(lt:|ycs:|svr:|ys:|yp:|ya:|yl:|yr:|yc:|it:|dz:|ptop|pq:|pe:|pqe:|rd:|au:)/;
const inflight = new Map(); let BYPASS = false;
function refresh(key, ttl, fn) {
  if (inflight.has(key)) return inflight.get(key);
  const pr = Promise.resolve().then(fn).then(v => {
    if (!(Array.isArray(v) && !v.length)) { mem.set(key, { t: Date.now(), v }); if (PERSIST.test(key)) PC.set(key, v); }
    return v;
  }).finally(() => inflight.delete(key));
  inflight.set(key, pr); return pr;
}
async function cached(key, ttl, fn) {
  if (BYPASS) return refresh(key, ttl, fn);
  const c = mem.get(key);
  if (c && Date.now() - c.t < ttl) return c.v;
  if (!c && PERSIST.test(key)) {
    const p = PC.get(key);
    if (p && p.v && (!Array.isArray(p.v) || p.v.length)) {
      mem.set(key, { t: p.t, v: p.v });
      if (Date.now() - p.t > ttl) refresh(key, ttl, fn).catch(() => { });
      return p.v;
    }
  }
  if (c && c.v) { refresh(key, ttl, fn).catch(() => { }); return c.v; }
  return refresh(key, ttl, fn);
}
function jsonp(url, timeout = 10000, mode = 'deezer') {
  return new Promise((res, rej) => {
    const cb = '__tt' + Date.now() + Math.floor(Math.random() * 1e5);
    const s = document.createElement('script');
    const tm = setTimeout(() => { done(); rej(new Error('timeout')); }, timeout);
    function done() { clearTimeout(tm); try { delete window[cb]; } catch (e) { window[cb] = undefined; } s.remove(); }
    window[cb] = d => { done(); d && d.error ? rej(new Error(d.error.message || 'error')) : res(d); };
    s.onerror = () => { done(); rej(new Error('load')); };
    s.src = url + (url.includes('?') ? '&' : '?') + (mode === 'deezer' ? 'output=jsonp&' : '') + 'callback=' + cb;
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
  mic: svg(P('M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3', 1.9)),
  check: svg(P('M5 12.5l4.5 4.5L19 7.5', 2.4)),
  back15: svg(P('M12 4.5a7.5 7.5 0 1 1-7.5 7.5', 1.8) + '<path d="M12 1.6v5.6L8.5 4.4z"/><text x="12" y="15.4" font-size="7" font-weight="800" text-anchor="middle" font-family="system-ui,sans-serif">15</text>'),
  fwd30: svg(P('M12 4.5a7.5 7.5 0 1 0 7.5 7.5', 1.8) + '<path d="M12 1.6v5.6l3.5-2.8z"/><text x="12" y="15.4" font-size="7" font-weight="800" text-anchor="middle" font-family="system-ui,sans-serif">30</text>'),
  bars: svg('<rect x="4" y="12" width="3.5" height="8" rx="1"/><rect x="10.25" y="7" width="3.5" height="13" rx="1"/><rect x="16.5" y="3.5" width="3.5" height="16.5" rx="1"/>'),
  link: svg(P('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1')),
  ban: svg(P('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8')),
  chevUp: svg(P('M5 15l7-7 7 7', 2.4)),
  info: svg(P('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5', 2)),
  expand: svg(P('M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7', 2)),
  translate: svg(P('M4 5h9M8.5 3v2M6 5c.6 3 2.6 5.6 5 7M11 5c-.8 3.6-3.3 6.6-6.5 8.5M13 20l4-9 4 9M14.4 17h5.2', 1.8)),
  disco: `<svg class="ic disco" viewBox="0 0 24 24" aria-hidden="true"><defs><radialGradient id="dbg" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#c9d2e3"/><stop offset="1" stop-color="#59627a"/></radialGradient><clipPath id="dbc"><circle cx="12" cy="13" r="8"/></clipPath></defs><path d="M12 1v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="13" r="8" fill="url(#dbg)"/><g clip-path="url(#dbc)" stroke="rgba(40,48,70,.55)" stroke-width=".7" fill="none"><path d="M4 9.5h16M4 13h16M4 16.5h16"/><g class="db-mer"><path d="M2 5v16M6 5v16M10 5v16M14 5v16M18 5v16M22 5v16M26 5v16"/></g></g><circle class="db-glint" cx="9" cy="10" r="1.3" fill="#fff"/></svg>`,
  torch: svg(P('M8 3h8l-1.5 5h-5zM9.5 8h5v4l-1 9h-3l-1-9zM12 12v3', 1.8)),
  sparkle: svg(P('M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z', 1.7)),
  edit: svg(P('M4 20h4L19 9l-4-4L4 16zM14 6l4 4', 1.8)),
  pin: svg(P('M9 3h6l-1 6 3 3v2H7v-2l3-3zM12 14v7', 1.8)),
  wave: svg(P('M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4', 2.2)),
  eye: svg(P('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 1.8) + P('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 1.8)),
  user2: svg(P('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1-3.8 4-5.5 7.5-5.5s6.5 1.7 7.5 5.5', 1.9)),
  copy: svg(P('M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1')),
  car: svg(P('M5 17h14M6.5 17v2M17.5 17v2M4 13l2-6a2 2 0 0 1 2-1.5h8A2 2 0 0 1 18 7l2 6v4H4z') + '<circle cx="7.5" cy="14" r="1.2"/><circle cx="16.5" cy="14" r="1.2"/>'),
  cast: svg(P('M5 18a3 3 0 0 1 3 3M5 14a7 7 0 0 1 7 7M5 10a11 11 0 0 1 11 11M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3')),
  airplay: svg(P('M6 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1') + '<path d="M12 14l5 7H7z"/>'),
  server: svg(P('M4 4h16v6H4zM4 14h16v6H4zM7.5 7h.01M7.5 17h.01', 2)),
  sparkle: svg('<path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z"/>'),
  phone: svg(P('M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5zM11 18.5h2')),
  wifiOff: svg(P('M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M3 3l18 18') + '<circle cx="12" cy="19" r="1.3"/>'),
};
const BARS = '<span class="bars"><i></i><i></i><i></i></span>';
const skipIcon = (n, back) => svg(P(back ? 'M12 4.5a7.5 7.5 0 1 1-7.5 7.5' : 'M12 4.5a7.5 7.5 0 1 0 7.5 7.5', 1.8) + (back ? '<path d="M12 1.6v5.6L8.5 4.4z"/>' : '<path d="M12 1.6v5.6l3.5-2.8z"/>') + `<text x="12" y="15.4" font-size="7" font-weight="800" text-anchor="middle" font-family="system-ui,sans-serif">${n}</text>`);

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
document.addEventListener('load', e => { const el = e.target; if (el && el.tagName === 'IMG') el.classList.add('ld'); }, true);
const revealImgs = () => requestAnimationFrame(() => $$('img:not(.ld)').forEach(i => { if (i.complete) i.classList.add('ld'); }));
setInterval(revealImgs, 1500);
document.addEventListener('error', e => {
  const el = e.target;
  if (!el || el.tagName !== 'IMG' || el.dataset.fb) return;
  const src = el.getAttribute('src') || '';
  if (/\/(maxresdefault|hq720)\.jpg/.test(src)) { el.src = src.replace(/(maxresdefault|hq720)\.jpg/, 'mqdefault.jpg'); return; }
  el.dataset.fb = '1'; el.classList.remove('logo'); el.src = ph({ title: src });
}, true);

/* ================= state ================= */
const DEFAULTS = {
  liked: [], playlists: [], history: [], searches: [], downloads: [], locals: [], blocked: [], artists: [],
  pod: { follows: [], prog: {} }, stats: { plays: {}, days: {} },
  settings: { theme: 'auto', accent: '#ff375f', eqOn: false, eq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], eqPreset: 'Flat', eqCustom: [], eqPins: [], eqBoost: 0, eqPre: 0, eqBass: 0, eqTreble: 0, eqLoud: false, eqWidth: 1, autoplay: true, country: '', volume: 1, langs: null, quality: 'auto', mirror: '', server: '', saavn: '', proxy: '', ytPlayer: true, engine: 'auto', normalize: true, hideAppCard: false, apkUrl: '',
    crossfade: 0, preload: true, podSpeed: 1, podBack: 15, podFwd: 30, startTab: 'home', zoom: 1, motion: true, animBg: true, badge: true, haptics: true,
    pauseHistory: false, hideExplicit: false, smartDl: false, lyricsSize: 'm', partyStyle: 'disco', partyBuzz: false, autoSave: true, autoSaveMax: 30, landCar: true,
    homeSections: { mixes: true, langs: true, chart: true, following: true, radio: true, podcasts: true, free: true, moods: true } },
};
const S = (() => {
  const base = JSON.parse(JSON.stringify(DEFAULTS));
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    const out = { ...base, ...raw, settings: { ...base.settings, ...(raw.settings || {}) } };
    for (const k of ['liked', 'playlists', 'history', 'searches', 'downloads', 'locals', 'blocked', 'artists', 'cached']) if (!Array.isArray(out[k])) out[k] = [];
    if (!out.pod || typeof out.pod !== 'object') out.pod = { follows: [], prog: {} };
    if (!Array.isArray(out.pod.follows)) out.pod.follows = []; if (!out.pod.prog || typeof out.pod.prog !== 'object') out.pod.prog = {};
    if (!out.stats || typeof out.stats !== 'object') out.stats = { plays: {}, days: {} };
    if (!out.stats.plays || typeof out.stats.plays !== 'object') out.stats.plays = {}; if (!out.stats.days || typeof out.stats.days !== 'object') out.stats.days = {};
    if (!Array.isArray(out.settings.eq) || out.settings.eq.length !== 10) out.settings.eq = base.settings.eq.slice();
    out.settings.homeSections = { ...base.settings.homeSections, ...(out.settings.homeSections || {}) };
    return out;
  } catch (e) { return base; }
})();
let saveT;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Storage is full — remove some downloads'); } }, 250);
}
const KEEP = ['enc', 'hq', 'su', 'albumId', 'year', 'svSu', 'id', 'source', 'sid', 'uid', 'title', 'artist', 'handle', 'album', 'art', 'artLarge', 'duration', 'full', 'genre', 'url', 'live', 'preview', 'explicit', 'plays', 'permalink', 'home', 'hasArt', 'ytId', 'podId', 'date', 'desc', 'codec', 'bitrate', 'fmt', 'q', 'sr', 'bits', 'ch', 'kbps', 'lossless', 'lang', 'label', 'copy'];
const clean = t => { const o = {}; for (const k of KEEP) if (t[k] !== undefined && t[k] !== null && t[k] !== '') o[k] = t[k]; return o; };
const isLiked = id => S.liked.some(t => t.id === id);
const isDl = id => String(id).startsWith('lc:') || S.downloads.some(t => t.id === id);
const LANG_CODES = { en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam', kn: 'Kannada', pa: 'Punjabi', bn: 'Bengali', mr: 'Marathi', gu: 'Gujarati', or: 'Odia', as: 'Assamese', ur: 'Urdu',
  si: 'Sinhala', ne: 'Nepali', ko: 'Korean', ja: 'Japanese', zh: 'Chinese', es: 'Spanish', pt: 'Portuguese', fr: 'French', de: 'German', it: 'Italian', ar: 'Arabic', tr: 'Turkish', ru: 'Russian',
  id: 'Indonesian', ms: 'Malay', th: 'Thai', vi: 'Vietnamese', fil: 'Filipino', tl: 'Filipino', fa: 'Persian', sw: 'Swahili', el: 'Greek', nl: 'Dutch', pl: 'Polish', uk: 'Ukrainian', he: 'Hebrew', af: 'Afrikaans' };
const IOS_STANDALONE = IS_IOS && (navigator.standalone || matchMedia('(display-mode: standalone)').matches);
function iosHeal() {
  if (!IOS_STANDALONE) return;
  const app = document.getElementById('app'), v = document.getElementById('view'); if (!app) return;
  const st = v ? v.scrollTop : 0;
  app.style.display = 'none'; void app.offsetHeight; app.style.display = '';
  if (v) v.scrollTop = st; try { window.scrollTo(0, 0); } catch (e) { }
}
if (IOS_STANDALONE) {
  document.addEventListener('focusout', e => { if (e.target && e.target.matches && e.target.matches('input,textarea')) setTimeout(iosHeal, 350); });
  addEventListener('orientationchange', () => setTimeout(iosHeal, 500));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(iosHeal, 250); });
  addEventListener('pageshow', () => setTimeout(iosHeal, 250));
  setTimeout(iosHeal, 1500);
}
function deviceLangs() {
  const out = []; for (const l of (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'])) { const n = LANG_CODES[String(l).toLowerCase().split('-')[0]]; if (n && !out.includes(n)) out.push(n); }
  if (!out.length) out.push('English'); return out;
}
const myLangs = () => (Array.isArray(S.settings.langs) && S.settings.langs.length ? S.settings.langs : deviceLangs());
function langSuggest() {
  const mine = new Set(myLangs()), no = new Set(S.langNo || []), c = {};
  for (const t of (S.history || []).slice(0, 120)) { const L = t && t.lang; if (L && !mine.has(L) && !no.has(L) && LANGS.some(x => x[0] === L)) c[L] = (c[L] || 0) + 1; }
  const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; return best && best[1] >= 8 ? best[0] : '';
}
const isTrack = x => !!x && !x.kind;

function toggleLike(t) {
  const i = S.liked.findIndex(x => x.id === t.id);
  if (i >= 0) { S.liked.splice(i, 1); toast(t.live ? 'Station removed' : 'Removed from Favorites'); }
  else { S.liked.unshift(clean(t)); toast(t.live ? 'Station saved' : 'Added to Favorites', { label: 'Undo', ms: 3500, fn: () => { S.liked = S.liked.filter(x => x.id !== t.id); save(); UI.like && UI.like(); toast('Removed'); } }); if (S.settings.smartDl && canDownload(t) && !isDl(t.id)) download(t, true); }
  save(); UI.like();
  const e = cv(); if (e.v === 'library' || (e.v === 'coll' && ['liked', 'stations'].includes(e.k))) softRender();
}
function addHistory(t) {
  if (S.settings.pauseHistory) return;
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
const RTAGS_BASE = [['pop', 'Pop'], ['lofi', 'Lo-Fi'],
  ['chillout', 'Chill'], ['jazz', 'Jazz'], ['classical', 'Classical'], ['rock', 'Rock'], ['hiphop', 'Hip-Hop'], ['dance', 'Dance'], ['80s', '80s Hits'], ['90s', '90s Hits'],
  ['kpop', 'K-Pop'], ['latin', 'Latin'], ['ambient', 'Ambient'], ['country', 'Country'], ['devotional', 'Devotional'], ['news', 'News'], ['talk', 'Talk']];
const COUNTRIES = [['', 'Automatic'], ['IN', 'India'], ['US', 'United States'], ['GB', 'United Kingdom'], ['SG', 'Singapore'], ['AE', 'United Arab Emirates'], ['AU', 'Australia'], ['CA', 'Canada'],
  ['DE', 'Germany'], ['FR', 'France'], ['ES', 'Spain'], ['IT', 'Italy'], ['NL', 'Netherlands'], ['JP', 'Japan'], ['KR', 'South Korea'], ['MY', 'Malaysia'], ['ID', 'Indonesia'],
  ['PH', 'Philippines'], ['LK', 'Sri Lanka'], ['BR', 'Brazil'], ['MX', 'Mexico'], ['ZA', 'South Africa'], ['NG', 'Nigeria']];
const ACCENTS = ['#ff375f', '#fa2d48', '#ff9f0a', '#30d158', '#40c8e0', '#0a84ff', '#5e5ce6', '#bf5af2', '#8e8e93'];
const EQ_F = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EQ_L = ['31', '62', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'];
const PRESET_BASE = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'Bass Boost': [6, 5, 4, 2, 0, 0, 0, 0, 0, 0], 'Bass Reducer': [-6, -5, -4, -2, 0, 0, 0, 0, 0, 0],
  'Treble Boost': [0, 0, 0, 0, 0, 1, 2, 4, 5, 6], Vocal: [-2, -2, -1, 1, 3, 4, 3, 1, 0, -1], Pop: [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2],
  Rock: [4, 3, 2, 0, -1, -1, 1, 2, 3, 4], 'Hip-Hop': [5, 4, 1, 3, -1, -1, 1, 0, 2, 3], Electronic: [5, 4, 1, 0, -2, 2, 1, 1, 4, 5],
  Jazz: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3], Classical: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4], Acoustic: [4, 4, 3, 1, 2, 2, 3, 3, 2, 1],
  Loudness: [6, 4, 0, 0, -2, 0, -1, -3, 5, 1], 'Spoken Word': [-3, -1, 0, 1, 3, 4, 4, 3, 1, -2], 'Late Night': [3, 2, 1, 0, -1, -1, 0, 1, 2, 1],
  'Deep Bass': [9, 7, 5, 2, 0, 0, 0, 0, 0, 0], Headphones: [3, 2, 0, -1, 0, 1, 2, 3, 3, 2], 'Small Speakers': [-4, -2, 2, 3, 3, 2, 1, 1, 2, 1], Car: [4, 3, 2, 0, -1, 0, 1, 2, 3, 3],
  Party: [5, 4, 2, 0, 0, 1, 2, 3, 3, 4], Cinematic: [3, 2, 1, 0, 1, 2, 3, 2, 1, 1], Podcast: [-3, -2, 0, 2, 4, 4, 3, 1, -1, -3],
};
// Presets are a bit stronger than the usual ±6 dB so you can clearly hear them; a limiter at the end stops any distortion.
const PRESETS = Object.fromEntries(Object.entries(PRESET_BASE).map(([k, v]) => [k, v.map(x => Math.max(-12, Math.min(12, Math.round(x * 1.4 * 2) / 2)))]));
const eqCustom = () => (Array.isArray(S.settings.eqCustom) ? S.settings.eqCustom : (S.settings.eqCustom = []));
const eqPins = () => (Array.isArray(S.settings.eqPins) ? S.settings.eqPins : (S.settings.eqPins = []));
const eqFind = n => PRESETS[n] ? { n, eq: PRESETS[n] } : eqCustom().find(c => c.n === n) || null;
const eqName = () => S.settings.eqPreset || 'Flat';
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
      art: s.favicon || '', url: s.url_resolved || s.url, live: true, home: s.homepage, codec: s.codec || '', bitrate: +s.bitrate || 0 };
  },
  list(path) {
    return cached('rd:' + path, 3e5, async () => {
      const j = await this.get(path); const seen = new Set();
      return (j || []).filter(s => {
        const u = s.url_resolved || s.url || '';
        if (!u.startsWith('https://') && !NATIVE && location.protocol === 'https:') return false;
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
  const q = S.settings.quality === 'auto' || !S.settings.quality ? (slowNet() ? 'saver' : 'high') : S.settings.quality;
  const p = q === 'saver' ? l[0] : q === 'normal' ? l[Math.floor((l.length - 1) / 2)] : l[l.length - 1];
  return { url: p.url, mime: p.mime || '', bitrate: +p.bitrate || 0 };
}
function qLabel(mime, bitrate) {
  const m = String(mime || ''); const codec = /opus|webm/.test(m) ? 'OPUS' : /mp4a|audio\/mp4|m4a/.test(m) ? 'AAC' : /mpeg|mp3/.test(m) ? 'MP3' : /flac/.test(m) ? 'FLAC' : 'Audio';
  const k = Math.round((+bitrate || 0) / 1000);
  return k ? `${codec} · ${k} kbps` : codec;
}
function fmtLabel(f) {
  const x = String(f || '').toLowerCase();
  if (/flac/.test(x)) return 'Lossless · FLAC'; if (/wav/.test(x)) return 'Lossless · WAV'; if (/alac/.test(x)) return 'Lossless · ALAC';
  if (/mpeg|mp3/.test(x)) return 'MP3'; if (/mp4|m4a|aac/.test(x)) return 'AAC'; if (/ogg|opus|webm/.test(x)) return 'OPUS';
  return 'Audio';
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
      const url = Server.ok ? `${Server.base}/api/ytm/${ep}?prettyPrint=false${q}` : `https://music.youtube.com/youtubei/v1/${ep}?prettyPrint=false${q}`;
      const r = await fetchT(url, {
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
    if (!NATIVE && !Server.ok) return Server.detect().then(ok => { if (!ok) { this.ok = false; return false; } this.ok = null; this.failAt = 0; return this.probe(); });
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
        if (IS_CAP) headers['User-Agent'] = c.ua; else if (IS_DESKTOP) headers['X-TT-UA'] = c.ua;
        const body = { context: { client: { clientName: c.name, clientVersion: c.ver, hl: 'en', gl: detectCC(), ...c.extra } }, videoId, contentCheckOk: true, racyCheckOk: true };
        const r = Server.ok && !NATIVE
          ? await fetchT(`${Server.base}/api/player`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client: c.name, body }) }, 15000)
          : await fetchT('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', { method: 'POST', headers, body: JSON.stringify(body) }, 12000);
        if (!r.ok) throw new Error('player ' + r.status);
        const j = await r.json();
        const st = j.playabilityStatus && j.playabilityStatus.status;
        if (st !== 'OK') throw new Error(st || 'unplayable');
        const wrap = u => (Server.ok && !NATIVE ? `${Server.base}/api/stream?c=${c.name}&u=${enc(u)}` : u);
        const fm = ((j.streamingData && j.streamingData.adaptiveFormats) || []).filter(f => f.url && /^audio\//.test(f.mimeType || ''))
          .map(f => ({ url: wrap(f.url), mime: f.mimeType, bitrate: f.averageBitrate || f.bitrate || 0 }));
        const p = pickAudio(fm);
        if (p) return { ...p, via: Server.ok && !NATIVE ? 'server' : 'direct', exp: expOf(fm[0].url.includes('/api/stream') ? decodeURIComponent(fm[0].url.split('&u=')[1] || '') : fm[0].url), loud: +((j.playerConfig && j.playerConfig.audioConfig && j.playerConfig.audioConfig.loudnessDb) || 0) };
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
      if (!j || j.error) throw softErr((j && j.error) || 'empty');
      Mirrors.good(kind, b); return j;
    } catch (e) { err = e; if (hardFail(e)) Mirrors.bad(kind, b); }
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
/* ---- JioSaavn: full songs up to 320 kbps with album art — plays in any browser (lock screen too), no YouTube involved ---- */
const SAAVN_DEFAULT = [{ base: 'https://jio.shnwaz.dev/api', shape: 'A' }, { base: 'https://saavn.sumit.co/api', shape: 'A' }, { base: 'https://saavn.dev/api', shape: 'A' }, { base: 'https://saavn.me', shape: 'B' }, { base: 'https://jiosaavn-api-privatecvc2.vercel.app', shape: 'B' }];
const decodeEnt = x => String(x || '').replace(/&(quot|amp|#039|#39|apos|lt|gt);/g, (m, k) => ({ quot: '"', amp: '&', '#039': "'", '#39': "'", apos: "'", lt: '<', gt: '>' }[k]));
const https = u => String(u || '').replace(/^http:/, 'https:');
const SvC = {
  fails: new Map(), best: null,
  list() { const c = S.settings.saavn ? [{ base: S.settings.saavn.replace(/\/+$/, ''), shape: '?' }] : []; return [...c, ...SAAVN_DEFAULT.filter(x => !c.some(y => y.base === x.base))]; },
  down() { const now = Date.now(); return this.list().every(b => now - (this.fails.get(b.base) || 0) < 5 * 60e3); },
  order() {
    const now = Date.now(), L = this.list(), recent = b => now - (this.fails.get(b.base) || 0) < 5 * 60e3;
    const o = L.filter(b => !recent(b)).concat(L.filter(recent));
    const i = o.findIndex(b => b.base === this.best); if (i > 0) o.unshift(o.splice(i, 1)[0]);
    return o;
  },
  async get(pathA, pathB) {
    if (this.down()) throw new Error('JioSaavn is busy');
    const one = async inst => {
      let err = new Error('JioSaavn unavailable');
      for (const sh of inst.shape === '?' ? ['A', 'B'] : [inst.shape]) {
        const path = sh === 'A' ? pathA : pathB; if (!path) continue;
        try {
          const j = await getJSON(inst.base + path, 6000);
          if (!j || j.success === false || (j.status && String(j.status).toUpperCase() !== 'SUCCESS') || j.data == null) throw softErr('no data');
          this.best = inst.base; this.fails.delete(inst.base);
          return { data: j.data, shape: sh };
        } catch (e) { err = e; const unsupported = e.status >= 400 && e.status < 500 && e.status !== 429; if (!e.soft && !unsupported) { this.fails.set(inst.base, Date.now()); break; } }
      }
      throw err;
    };
    const o = this.order().filter(b => Date.now() - (this.fails.get(b.base) || 0) >= 5 * 60e3);
    const first = o[0] && o[0].base === this.best ? o.shift() : null;
    if (first) { try { return await lim(() => one(first)); } catch (e) { if (e.soft) throw e; } }
    if (!o.length) throw new Error('JioSaavn unavailable');
    try { return await Promise.any(o.map(one)); }
    catch (e) { const errs = (e && e.errors) || []; throw errs.find(x => x && x.soft) || errs[0] || new Error('JioSaavn unavailable'); }
  },
  img(x, q) {
    if (!x) return ''; if (typeof x === 'string') return https(x.replace(/\d+x\d+/, q));
    if (!Array.isArray(x) || !x.length) return '';
    const p = x.find(i => i.quality === q) || x[x.length - 1]; return https((p && (p.url || p.link)) || '');
  },
  names(t) {
    if (t.artists && Array.isArray(t.artists.primary) && t.artists.primary.length) return t.artists.primary.map(a => a.name).join(', ');
    return t.primaryArtists || t.singers || (t.more_info && t.more_info.singers) || '';
  },
  artistId(t) { if (t.artists && t.artists.primary && t.artists.primary[0]) return String(t.artists.primary[0].id); return String(t.primaryArtistsId || '').split(',')[0].trim(); },
  track(t) {
    if (!t || !t.id) return null; const su = {};
    for (const d of (t.downloadUrl || t.download_url || [])) { const q = parseInt(d.quality, 10); const u = d.url || d.link; if (q && u) su[q] = https(u); }
    if (!Object.keys(su).length) return null;
    return clean({ id: 'sv:' + t.id, source: 'saavn', sid: String(t.id), title: decodeEnt(t.name || t.title), artist: decodeEnt(this.names(t)) || 'Unknown artist',
      album: decodeEnt((t.album && (t.album.name || (typeof t.album === 'string' ? t.album : ''))) || ''), albumId: String((t.album && t.album.id) || ''), uid: this.artistId(t),
      art: this.img(t.image, '150x150'), artLarge: this.img(t.image, '500x500'), duration: +t.duration || 0, year: t.year ? String(t.year) : '', explicit: !!(t.explicitContent || t.explicit_content), su,
      lang: t.language ? String(t.language).replace(/^./, c => c.toUpperCase()) : '', label: decodeEnt(t.label || ''), copy: decodeEnt(t.copyright || '') });
  },
  coll(x, kind) {
    if (!x || !x.id) return null;
    const by = x.artists && x.artists.primary ? x.artists.primary.map(a => a.name).join(', ') : (x.primaryArtists || x.artist || '');
    const sub = kind === 'artist' ? 'Artist' : decodeEnt(by || x.description || (x.songCount ? x.songCount + ' songs' : '') || x.language || (kind === 'album' ? 'Album' : 'Playlist'));
    return { kind, id: String(x.id), title: decodeEnt(x.name || x.title), sub: kind === 'album' && x.year ? `${sub} · ${x.year}` : sub, art: this.img(x.image, '500x500'), source: 'saavn' };
  },
  list_(d) { return (d && (d.results || d.songs || (Array.isArray(d) ? d : []))) || []; },
  tracks(d) { return this.list_(d).map(x => this.track(x)).filter(Boolean); },
  async songs(q) { const { data } = await this.get(`/search/songs?query=${enc(q)}&limit=40`, `/search/songs?query=${enc(q)}&page=1&limit=40`); return this.tracks(data); },
  async colls(q, kind) { const { data } = await this.get(`/search/${kind}s?query=${enc(q)}&limit=30`, `/search/${kind}s?query=${enc(q)}&page=1&limit=30`); return this.list_(data).map(x => this.coll(x, kind)).filter(Boolean); },
  async song(id) { const { data } = await this.get(`/songs/${enc(id)}`, `/songs?id=${enc(id)}`); return this.track((Array.isArray(data) ? data : [data])[0]); },
  async related(t) {
    try { const { data } = await this.get(`/songs/${enc(t.sid)}/suggestions?limit=25`, null); const r = this.tracks(data); if (r.length) return r; } catch (e) { }
    const first = String(t.artist || '').split(',')[0].trim();
    const r = await this.songs(first ? `${first} hits` : t.title); return r.filter(x => x.id !== t.id);
  },
  async collection(c) {
    if (c.kind === 'album' || c.kind === 'playlist') {
      const { data } = await this.get(`/${c.kind}s?id=${enc(c.id)}&limit=150`, `/${c.kind}s?id=${enc(c.id)}`);
      const tracks = this.tracks(data); if (!tracks.length) throw softErr('empty');
      const by = this.names(data) || data.primaryArtists || '';
      return { title: decodeEnt(data.name) || c.title, art: this.img(data.image, '500x500') || c.art, sub: decodeEnt([by || data.description || c.sub, data.year].filter(Boolean).join(' · ')), tracks };
    }
    const { data } = await this.get(`/artists/${enc(c.id)}`, `/artists?id=${enc(c.id)}`);
    let tracks = (data.topSongs || []).map(x => this.track(x)).filter(Boolean);
    if (!tracks.length) { try { const r = await this.get(`/artists/${enc(c.id)}/songs?sortBy=popularity&sortOrder=desc`, `/artists/${enc(c.id)}/songs?page=1`); tracks = this.tracks(r.data); } catch (e) { } }
    const albums = (data.topAlbums || []).map(x => this.coll(x, 'album')).filter(Boolean);
    const singles = (data.singles || []).map(x => this.coll(x, 'album')).filter(Boolean);
    return { title: decodeEnt(data.name) || c.title, art: this.img(data.image, '500x500') || c.art, sub: data.followerCount ? compact(data.followerCount) + ' followers' : 'Artist', tracks,
      shelves: [albums.length && { title: 'Albums', items: albums }, singles.length && { title: 'Singles', items: singles }].filter(Boolean) };
  },
};

/* DES-ECB decrypt for JioSaavn's encrypted song links (verified against CryptoJS) */
const DES = (() => {
  const PC1 = [57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4];
  const PC2 = [14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32];
  const SH = [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];
  const IP = [58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,64,56,48,40,32,24,16,8,57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7];
  const FP = [40,8,48,16,56,24,64,32,39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26,33,1,41,9,49,17,57,25];
  const E = [32,1,2,3,4,5,4,5,6,7,8,9,8,9,10,11,12,13,12,13,14,15,16,17,16,17,18,19,20,21,20,21,22,23,24,25,24,25,26,27,28,29,28,29,30,31,32,1];
  const PP = [16,7,20,21,29,12,28,17,1,15,23,26,5,18,31,10,2,8,24,14,32,27,3,9,19,13,30,6,22,11,4,25];
  const SB = [
    '14 4 13 1 2 15 11 8 3 10 6 12 5 9 0 7 0 15 7 4 14 2 13 1 10 6 12 11 9 5 3 8 4 1 14 8 13 6 2 11 15 12 9 7 3 10 5 0 15 12 8 2 4 9 1 7 5 11 3 14 10 0 6 13',
    '15 1 8 14 6 11 3 4 9 7 2 13 12 0 5 10 3 13 4 7 15 2 8 14 12 0 1 10 6 9 11 5 0 14 7 11 10 4 13 1 5 8 12 6 9 3 2 15 13 8 10 1 3 15 4 2 11 6 7 12 0 5 14 9',
    '10 0 9 14 6 3 15 5 1 13 12 7 11 4 2 8 13 7 0 9 3 4 6 10 2 8 5 14 12 11 15 1 13 6 4 9 8 15 3 0 11 1 2 12 5 10 14 7 1 10 13 0 6 9 8 7 4 15 14 3 11 5 2 12',
    '7 13 14 3 0 6 9 10 1 2 8 5 11 12 4 15 13 8 11 5 6 15 0 3 4 7 2 12 1 10 14 9 10 6 9 0 12 11 7 13 15 1 3 14 5 2 8 4 3 15 0 6 10 1 13 8 9 4 5 11 12 7 2 14',
    '2 12 4 1 7 10 11 6 8 5 3 15 13 0 14 9 14 11 2 12 4 7 13 1 5 0 15 10 3 9 8 6 4 2 1 11 10 13 7 8 15 9 12 5 6 3 0 14 11 8 12 7 1 14 2 13 6 15 0 9 10 4 5 3',
    '12 1 10 15 9 2 6 8 0 13 3 4 14 7 5 11 10 15 4 2 7 12 9 5 6 1 13 14 0 11 3 8 9 14 15 5 2 8 12 3 7 0 4 10 1 13 11 6 4 3 2 12 9 5 15 10 11 14 1 7 6 0 8 13',
    '4 11 2 14 15 0 8 13 3 12 9 7 5 10 6 1 13 0 11 7 4 9 1 10 14 3 5 12 2 15 8 6 1 4 11 13 12 3 7 14 10 15 6 8 0 5 9 2 6 11 13 8 1 4 10 7 9 5 0 15 14 2 3 12',
    '13 2 8 4 6 15 11 1 10 9 3 14 5 0 12 7 1 15 13 8 10 3 7 4 12 5 6 11 0 14 9 2 7 11 4 1 9 12 14 2 0 6 10 13 15 3 5 8 2 1 14 7 4 10 8 13 15 12 9 0 3 5 6 11',
  ].map(x => x.split(' ').map(Number));
  const bits = bytes => { const o = []; for (const b of bytes) for (let i = 7; i >= 0; i--) o.push((b >> i) & 1); return o; };
  const perm = (src, t) => t.map(i => src[i - 1]);
  const keyCache = new Map();
  function subkeys(key) {
    if (keyCache.has(key)) return keyCache.get(key);
    const k = perm(bits([...key].map(c => c.charCodeAt(0))), PC1); let C = k.slice(0, 28), D = k.slice(28); const out = [];
    for (let r = 0; r < 16; r++) { for (let s = 0; s < SH[r]; s++) { C.push(C.shift()); D.push(D.shift()); } out.push(perm(C.concat(D), PC2)); }
    keyCache.set(key, out); return out;
  }
  function f(R, K) {
    const e = perm(R, E).map((b, i) => b ^ K[i]); const s = [];
    for (let i = 0; i < 8; i++) { const c = e.slice(i * 6, i * 6 + 6); const v = SB[i][(c[0] * 2 + c[5]) * 16 + c[1] * 8 + c[2] * 4 + c[3] * 2 + c[4]]; s.push((v >> 3) & 1, (v >> 2) & 1, (v >> 1) & 1, v & 1); }
    return perm(s, PP);
  }
  function block(b64bits, K) {
    const b = perm(b64bits, IP); let L = b.slice(0, 32), R = b.slice(32);
    for (let r = 15; r >= 0; r--) { const fr = f(R, K[r]); const nR = L.map((x, i) => x ^ fr[i]); L = R; R = nR; }
    return perm(R.concat(L), FP);
  }
  return function decrypt(b64, key = '38346591') {
    const raw = atob(String(b64).trim()); const bytes = [...raw].map(c => c.charCodeAt(0)); if (!bytes.length || bytes.length % 8) throw new Error('bad length');
    const K = subkeys(key); const out = [];
    for (let i = 0; i < bytes.length; i += 8) { const bb = block(bits(bytes.slice(i, i + 8)), K); for (let j = 0; j < 8; j++) { let v = 0; for (let k = 0; k < 8; k++) v = v * 2 + bb[j * 8 + k]; out.push(v); } }
    const pad = out[out.length - 1]; if (pad > 0 && pad <= 8) out.length -= pad;
    return decodeURIComponent(escape(String.fromCharCode(...out)));
  };
})();

/* JioSaavn's own API (the one jiosaavn.com uses). Browsers can't call it directly, so requests go through
   free relay services; the app tries each and remembers the one that works. */
const JS_RELAYS = [
  { id: 'direct', wrap: u => u },
  { id: 'allorigins', wrap: u => `https://api.allorigins.win/raw?url=${enc(u)}` },
  { id: 'codetabs', wrap: u => `https://api.codetabs.com/v1/proxy/?quest=${enc(u)}` },
  { id: 'corsproxy', wrap: u => `https://corsproxy.io/?url=${enc(u)}` },
  { id: 'cors.eu.org', wrap: u => `https://cors.eu.org/${u}` },
  { id: 'allorigins-get', wrap: u => `https://api.allorigins.win/get?url=${enc(u)}`, unwrap: j => parseLoose(j && j.contents) },
  { id: 'afeld', wrap: u => `https://jsonp.afeld.me/?url=${enc(u)}` },
  { id: 'thingproxy', wrap: u => `https://thingproxy.freeboard.io/fetch/${u}` },
];
function parseLoose(txt) {
  txt = String(txt || '').trim(); const i = txt.search(/[[{]/); if (i < 0) return null;
  try { return JSON.parse(txt.slice(i)); } catch (e) { return null; }
}
const SITE = { server: '' };
function normServer(v) { v = String(v || '').trim(); if (!v) return ''; if (!/^https?:\/\//.test(v)) v = 'https://' + v; return v.includes('{url}') ? v : v.replace(/[?#].*$/, '').replace(/\/+$/, '') + '/?url={url}'; }
async function loadSiteConfig() {
  try {
    const r = await fetchT('tunetune-config.json?v=' + Math.floor(Date.now() / 3600e3), { cache: 'no-store' }, 4000); if (!r.ok) return;
    const j = await r.json(); let v = String((j && (j.musicServer || j.server)) || '').trim(); if (!v) return;
    if (!/^https?:\/\//.test(v)) v = 'https://' + v;
    SITE.server = v.includes('{url}') ? v : v.replace(/[?#].*$/, '').replace(/\/+$/, '') + '/?url={url}';
    if (!S.settings.proxy) { JSA.reset(); JSA.setVia('custom'); mem.clear(); }
  } catch (e) { }
}
const WORKER_CODE = "// Tune Tune music server \u2014 paste into a free Cloudflare Worker and press Deploy\nconst ALLOW = /(^|\\.)(jiosaavn\\.com|saavncdn\\.com|saavn\\.com)$/;\nconst CORS = {\n  'Access-Control-Allow-Origin': '*',\n  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',\n  'Access-Control-Allow-Headers': '*',\n  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',\n};\nexport default {\n  async fetch(req) {\n    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });\n    const target = new URL(req.url).searchParams.get('url');\n    if (!target) return new Response('Tune Tune relay is running', { headers: CORS });\n    let t;\n    try { t = new URL(target); } catch (e) { return new Response('Bad link', { status: 400, headers: CORS }); }\n    if (!ALLOW.test(t.hostname)) return new Response('Not allowed', { status: 403, headers: CORS });\n    const h = {\n      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',\n      'Accept': '*/*', 'Accept-Language': 'en-IN,en;q=0.9', 'Referer': 'https://www.jiosaavn.com/',\n    };\n    const range = req.headers.get('Range');\n    if (range) h['Range'] = range;\n    if (t.hostname.endsWith('jiosaavn.com')) h['Cookie'] = 'gdpr_acceptance=true; DL=english';\n    const media = t.hostname.endsWith('saavncdn.com');\n    const r = await fetch(t.toString(), { method: req.method, headers: h, cf: { cacheTtl: media ? 86400 : 300, cacheEverything: true } });\n    const out = new Headers(r.headers);\n    for (const k in CORS) out.set(k, CORS[k]);\n    out.delete('set-cookie');\n    return new Response(r.body, { status: r.status, headers: out });\n  },\n};\n";
const JSA = {
  via: '', fails: new Map(), deadUntil: 0,
  init() { try { this.via = localStorage.getItem('tunetune.jsvia') || ''; this.deadUntil = +localStorage.getItem('tunetune.jsdead') || 0; } catch (e) { } },
  bad(p) { return Date.now() - (this.fails.get(p.id) || 0) < 10 * 60e3; },
  dead() { this.deadUntil = Date.now() + 10 * 60e3; try { localStorage.setItem('tunetune.jsdead', String(this.deadUntil)); } catch (e) { } },
  async attempt(p, url) {
    const r = await fetchT(p.wrap(url), {}, p.id === 'direct' ? 4000 : 7000);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = p.unwrap ? p.unwrap(await r.json()) : parseLoose(await r.text());
    if (!j || typeof j !== 'object') throw new Error('not JSON');
    return j;
  },
  relays() {
    const px = S.settings.proxy || SITE.server || normServer(BUILT_IN_SERVER);
    const c = px ? [{ id: 'custom', wrap: u => (px.includes('{url}') ? px.replace('{url}', enc(u)) : px + enc(u)) }] : [];
    return [...c, ...JS_RELAYS];
  },
  order() {
    const now = Date.now(), L = this.relays(), bad = p => now - (this.fails.get(p.id) || 0) < 10 * 60e3;
    const o = L.filter(p => !bad(p)).concat(L.filter(bad)); const i = o.findIndex(p => p.id === this.via); if (i > 0) o.unshift(o.splice(i, 1)[0]);
    return o;
  },
  down() { return Date.now() < this.deadUntil; },
  reset() { this.fails.clear(); this.deadUntil = 0; try { localStorage.removeItem('tunetune.jsdead'); } catch (e) { } },
  setVia(id) { if (this.via !== id) { this.via = id; try { localStorage.setItem('tunetune.jsvia', id); } catch (e) { } } },
  async call(params) {
    if (this.down()) throw new Error('JioSaavn unreachable');
    const url = 'https://www.jiosaavn.com/api.php?' + new URLSearchParams({ ...params, _format: 'json', _marker: '0', api_version: '4', ctx: 'web6dot0' });
    const all = this.relays();
    const known = all.find(p => p.id === this.via && !this.bad(p));
    if (known) {
      try { const j = await lim(() => this.attempt(known, url)); this.fails.delete(known.id); return j; }
      catch (e) { this.fails.set(known.id, Date.now()); }
    }
    const rest = all.filter(p => p !== known && !this.bad(p));
    if (!rest.length) { this.dead(); throw new Error('JioSaavn unreachable'); }
    try {
      const { j, p } = await Promise.any(rest.map(p => this.attempt(p, url).then(j => ({ j, p }), e => { this.fails.set(p.id, Date.now()); throw e; })));
      this.setVia(p.id); this.fails.delete(p.id); return j;
    } catch (e) { if (all.every(p => this.bad(p))) this.dead(); throw new Error('JioSaavn unreachable'); }
  },
  async diagnose() {
    const url = 'https://www.jiosaavn.com/api.php?' + new URLSearchParams({ __call: 'autocomplete.get', query: 'ilaiyaraaja', _format: 'json', _marker: '0', api_version: '4', ctx: 'web6dot0' });
    return Promise.all(this.relays().map(p => this.attempt(p, url).then(() => `✓ ${p.id}`, e => `✗ ${p.id} (${String(e.message || e).slice(0, 24)})`)));
  },
  img(u, size) { return https(String(u || '').replace(/\d{2,3}x\d{2,3}/, size)); },
  track(x) {
    if (!x || !x.id) return null; const mi = x.more_info || {};
    const encd = mi.encrypted_media_url || x.encrypted_media_url; if (!encd) return null;
    const am = mi.artistMap || x.artistMap || {}; const prim = (am.primary_artists || []).filter(a => a && a.name);
    const artist = prim.length ? prim.map(a => a.name).join(', ') : (x.primary_artists || mi.music || x.singers || String(x.subtitle || '').split(' - ')[0]);
    return clean({ id: 'sv:' + x.id, source: 'saavn', sid: String(x.id), title: decodeEnt(x.title || x.song), artist: decodeEnt(artist) || 'Unknown artist',
      album: decodeEnt(mi.album || x.album || ''), albumId: String(mi.album_id || x.albumid || ''), uid: String((prim[0] && prim[0].id) || String(x.primary_artists_id || '').split(',')[0] || ''),
      art: this.img(x.image, '150x150'), artLarge: this.img(x.image, '500x500'), duration: +(mi.duration || x.duration) || 0, year: String(x.year || ''),
      explicit: String(x.explicit_content) === '1', enc: encd, hq: String(mi['320kbps'] || x['320kbps']) === 'true',
      lang: x.language ? String(x.language).replace(/^./, c => c.toUpperCase()) : '', label: decodeEnt(mi.label || x.label || ''), copy: decodeEnt(mi.copyright_text || x.copyright_text || '') });
  },
  coll(x, kind) {
    if (!x || !x.id) return null; const mi = x.more_info || {};
    const sub = kind === 'artist' ? 'Artist' : decodeEnt(x.subtitle || x.description || mi.music || mi.artist_name || (kind === 'album' ? 'Album' : 'Playlist'));
    return { kind, id: String(x.id), title: decodeEnt(x.title || x.name), sub, art: this.img(x.image, '500x500'), source: 'saavn' };
  },
  tracks(arr) { return (Array.isArray(arr) ? arr : []).map(x => this.track(x)).filter(Boolean); },
  async songs(q) { const j = await this.call({ __call: 'search.getResults', q, n: 40, p: 1 }); const r = this.tracks(j.results); if (!r.length) throw softErr('no results'); return r; },
  async colls(q, kind) {
    const call = { album: 'search.getAlbumResults', artist: 'search.getArtistResults', playlist: 'search.getPlaylistResults' }[kind];
    const j = await this.call({ __call: call, q, n: 30, p: 1 }); const r = (j.results || []).map(x => this.coll(x, kind)).filter(Boolean); if (!r.length) throw softErr('no results'); return r;
  },
  async song(id) { const j = await this.call({ __call: 'song.getDetails', pids: id }); const arr = j.songs || Object.values(j).filter(v => v && typeof v === 'object' && v.id); return this.track(arr[0]); },
  async related(t) { const j = await this.call({ __call: 'reco.getreco', pid: t.sid }); const r = this.tracks(Array.isArray(j) ? j : (j.songs || j.results || j.list)); if (!r.length) throw softErr('no suggestions'); return r.filter(x => x.id !== t.id); },
  async collection(c) {
    if (c.kind === 'album' || c.kind === 'playlist') {
      const j = await this.call(c.kind === 'album' ? { __call: 'content.getAlbumDetails', albumid: c.id } : { __call: 'playlist.getDetails', listid: c.id, n: 150, p: 1 });
      const tracks = this.tracks(j.list || j.songs); if (!tracks.length) throw softErr('empty');
      return { title: decodeEnt(j.title || j.name) || c.title, art: this.img(j.image, '500x500') || c.art, sub: decodeEnt([j.subtitle || j.header_desc || c.sub, j.year].filter(Boolean).join(' · ')), tracks };
    }
    const j = await this.call({ __call: 'artist.getArtistPageDetails', artistId: c.id, n_song: 50, n_album: 20, page: 0, category: '', sort_order: '' });
    const tracks = this.tracks(j.topSongs); const albums = (j.topAlbums || []).map(x => this.coll(x, 'album')).filter(Boolean); const singles = (j.singles || []).map(x => this.coll(x, 'album')).filter(Boolean);
    if (!tracks.length && !albums.length) throw softErr('empty');
    return { title: decodeEnt(j.name) || c.title, art: this.img(j.image, '500x500') || c.art, sub: +j.follower_count ? compact(j.follower_count) + ' followers' : 'Artist', tracks,
      shelves: [albums.length && { title: 'Albums', items: albums }, singles.length && { title: 'Singles', items: singles }].filter(Boolean) };
  },
  async suggest(q) {
    const j = await this.call({ __call: 'autocomplete.get', query: q }); const out = [];
    for (const k of ['topquery', 'songs', 'artists', 'albums', 'playlists']) for (const x of ((j[k] && j[k].data) || [])) out.push(decodeEnt(x.title || x.name));
    return uniq(out).slice(0, 8);
  },
};

/* One "Saavn" source for the rest of the app: JioSaavn's own API first, community servers as backup */
function bestMatch(t, list) {
  const title = tidyTitle(t.title).replace(/\s*[([].*?[)\]]/g, '').trim(); const art = tidyArtist(String(t.artist || '').split(/,|&/)[0]).trim();
  let best = null, bs = 0;
  for (const x of list || []) {
    const ts = matchScore(title, String(x.title).replace(/\s*[([].*?[)\]]/g, '')); const as = art ? matchScore(art, x.artist) : 60;
    const sc = ts + as * 0.6; if (ts >= 75 && (as >= 45 || ts === 100) && sc > bs) { bs = sc; best = x; }
  }
  return best;
}
const Saavn = {
  get best() { return JSA.via && !JSA.down() ? `jiosaavn.com (${JSA.via === 'direct' ? 'direct' : 'via ' + JSA.via})` : SvC.best; },
  set best(v) { },
  fails: { clear() { JSA.reset(); SvC.fails.clear(); } },
  down() { return JSA.down() && SvC.down(); },
  songs(q) { return firstOk([() => JSA.songs(q), () => SvC.songs(q)]); },
  colls(q, kind) { return firstOk([() => JSA.colls(q, kind), () => SvC.colls(q, kind)]); },
  async song(id) { try { const t = await JSA.song(id); if (t) return t; } catch (e) { } return SvC.song(id); },
  related(t) { return firstOk([() => JSA.related(t), () => SvC.related(t)]); },
  collection(c) { return firstOk([() => JSA.collection(c), () => SvC.collection(c)]); },
  suggest(q) { return JSA.suggest(q); },
  async match(t) { return bestMatch(t, await this.songs(`${tidyTitle(t.title).replace(/\s*[([].*?[)\]]/g, '')} ${tidyArtist(String(t.artist || '').split(/,|&/)[0])}`)); },
  async langTop(L) {
    const pls = await this.colls(`${L} top 50`, 'playlist').catch(() => []);
    for (const p of pls.slice(0, 2)) { try { const r = await this.collection(p); if (r.tracks.length) return r.tracks; } catch (e) { } }
    return this.songs(`${L} hits`);
  },
  urls(x) {
    if (!x) return {};
    if (x.su && Object.keys(x.su).length) return x.su;
    if (!x.enc) return {};
    let base = ''; try { base = https(DES(x.enc)); } catch (e) { return {}; }
    const su = {}; for (const q of [96, 160, 320]) { if (q === 320 && x.hq === false) continue; su[q] = base.replace(/_(12|48|96|160|320)(_p)?\.mp4/, `_${q}.mp4`); }
    x.su = su; return su;
  },
  pick(x) {
    const su = x && (x.enc || x.su) ? this.urls(x) : x;
    const q = S.settings.quality === 'auto' || !S.settings.quality ? (slowNet() ? 'saver' : 'high') : S.settings.quality;
    const ks = Object.keys(su || {}).map(Number).filter(Boolean).sort((a, b) => a - b); if (!ks.length) return null;
    const want = q === 'saver' ? 96 : q === 'normal' ? 160 : 320; const k = ks.filter(v => v <= want).pop() || ks[0];
    return { url: su[k], kbps: k };
  },
};

const YT = {
  songs(q) {
    return cached('ys:' + q, 6e5, () => firstOk([
      () => Saavn.songs(q),
      async () => ((await IT.probe()) ? (await IT.search(q, 'songs')).filter(isTrack) : null),
      async () => ((await viaMirror('piped', `/search?q=${enc(q)}&filter=music_songs`)).items || []).map(pipedTrack).filter(Boolean),
      async () => ((await viaMirror('inv', `/api/v1/search?q=${enc(q)}&type=video`)) || []).map(invTrack).filter(Boolean),
    ]));
  },
  playlists(q) {
    return cached('yp:' + q, 6e5, () => firstOk([
      () => Saavn.colls(q, 'playlist'),
      async () => ((await IT.probe()) ? (await IT.search(q, 'playlists')).filter(x => !isTrack(x)) : null),
      async () => ((await IT.probe()) ? (await IT.search(q, 'community')).filter(x => !isTrack(x)) : null),
      async () => ((await viaMirror('piped', `/search?q=${enc(q)}&filter=music_playlists`)).items || []).map(x => pipedColl(x)).filter(Boolean),
      async () => ((await viaMirror('inv', `/api/v1/search?q=${enc(q)}&type=playlist`)) || []).map(invColl).filter(Boolean),
    ]));
  },
  albums(q) {
    return cached('yl:' + q, 6e5, () => firstOk([
      () => Saavn.colls(q, 'album'),
      async () => ((await IT.probe()) ? (await IT.search(q, 'albums')).filter(x => !isTrack(x)) : null),
      async () => ((await viaMirror('piped', `/search?q=${enc(q)}&filter=music_albums`)).items || []).map(x => pipedColl(x, 'album')).filter(Boolean),
      async () => ((await viaMirror('inv', `/api/v1/search?q=${enc(q + ' album')}&type=playlist`)) || []).map(invColl).filter(Boolean),
    ]));
  },
  artists(q) {
    return cached('ya:' + q, 6e5, () => firstOk([
      () => Saavn.colls(q, 'artist'),
      async () => ((await IT.probe()) ? (await IT.search(q, 'artists')).filter(x => x.kind === 'artist') : null),
      async () => ((await viaMirror('piped', `/search?q=${enc(q)}&filter=music_artists`)).items || []).map(x => pipedColl(x)).filter(Boolean),
      async () => ((await viaMirror('inv', `/api/v1/search?q=${enc(q)}&type=channel`)) || []).map(invColl).filter(Boolean),
    ]));
  },
  related(t) {
    if (t.source === 'saavn') return cached('svr:' + t.sid, 6e5, () => Saavn.related(t));
    const id = t.sid;
    return cached('yr:' + id, 6e5, () => firstOk([
      async () => ((await IT.probe()) ? IT.next(id) : null),
      async () => ((await viaMirror('piped', `/streams/${id}`)).relatedStreams || []).filter(x => !x.duration || (x.duration > 60 && x.duration < 720)).map(pipedTrack).filter(Boolean),
      async () => ((await viaMirror('inv', `/api/v1/videos/${id}`)).recommendedVideos || []).filter(x => !x.lengthSeconds || x.lengthSeconds < 720).map(v => invTrack({ ...v, type: 'video' })).filter(Boolean),
    ]));
  },
  suggest(q) {
    return cached('yg:' + q, 3e5, () => firstOk([
      () => Saavn.suggest(q),
      async () => ((await IT.probe()) ? IT.suggest(q) : null),
      async () => (await viaMirror('piped', `/suggestions?query=${enc(q)}`, 2)) || [],
      async () => ((await viaMirror('inv', `/api/v1/search/suggestions?q=${enc(q)}`, 2)).suggestions) || [],
    ]));
  },
  collection(c) {
    const main = () => this.collection0(c);
    if (c.kind !== 'artist') return main().then(r => { if (r && r.tracks && r.tracks.length) return r; throw softErr('empty'); }).catch(async e => {
      const name = String(c.title || '').replace(/\s*[-–|].*$/, '').replace(/\b(19|20)\d\d\b/g, '').replace(/so far/i, '').trim(); if (!name) throw e;
      const tracks = (await this.songs(name + (c.kind === 'album' ? '' : ' songs')).catch(() => [])).slice(0, 50); if (!tracks.length) throw e;
      return { title: c.title, art: c.art, sub: c.kind === 'album' ? 'Album' : 'Playlist', tracks, shelves: [] };
    });
    return cached('yca:' + c.id + c.title, 6e5, async () => {
      try { const r = await main(); if (r && r.tracks && r.tracks.length) return r; } catch (e) { }
      const name = String(c.title || '').trim(); if (!name) throw softErr('empty');
      const [a, b] = await Promise.all([this.songs(name).catch(() => []), this.songs(name + ' hits').catch(() => [])]);
      const seen = new Set(); const all = [...a, ...b].filter(t => !seen.has(t.id) && seen.add(t.id));
      const key = name.toLowerCase().split(/\s+/)[0];
      const mine = all.filter(t => String(t.artist || '').toLowerCase().includes(key));
      const tracks = (mine.length >= 6 ? mine : all).slice(0, 60); if (!tracks.length) throw softErr('empty');
      let albums = []; try { albums = (await this.albums(name)).slice(0, 12); } catch (e) { }
      return { title: name, art: c.art, sub: 'Artist', tracks, shelves: albums.length ? [{ title: 'Albums', items: albums }] : [] };
    });
  },
  collection0(c) {
    if (c.source === 'saavn') return cached('ycs:' + c.kind + c.id, 6e5, () => Saavn.collection(c));
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
  langTop(L) { return cached('lt:' + L, 6e5, () => firstOk([() => Saavn.langTop(L), () => this.songs(`${L} top songs ${YEAR}`)])); },
};

/* --- audio stream resolver: direct → Piped → Invidious, with caching & expiry --- */
const Streams = {
  c: new Map(), pending: new Map(),
  get(id, avoid, budget = 30000) {
    avoid = avoid || new Set();
    const hit = this.c.get(id);
    if (hit && hit.exp > Date.now() + 90e3 && !avoid.has(hit.via)) return Promise.resolve(hit);
    const key = id + '|' + [...avoid].join(',');
    if (this.pending.has(key)) return this.pending.get(key);
    const p = this.resolve(id, avoid, budget).finally(() => this.pending.delete(key));
    this.pending.set(key, p);
    return p;
  },
  // Tries direct → Piped → Invidious within a time budget, so a dead mirror network never stalls playback.
  async resolve(id, avoid, budget) {
    let err = null, hard = false;
    const deadline = Date.now() + budget;
    const left = () => Math.max(1500, Math.min(10000, deadline - Date.now()));
    if (!avoid.has('direct') && !avoid.has('server') && await IT.probe()) { try { return this.put(id, await IT.player(id)); } catch (e) { err = e; hard = true; } }
    await Promise.race([Mirrors.load(), sleep(2000)]);
    for (const b of Mirrors.order('piped').slice(0, 4)) {
      const via = 'piped:' + b; if (avoid.has(via)) continue;
      if (Date.now() > deadline) break;
      const tl = left(); if (tl < 1500) break;
      try {
        const j = await getJSON(`${b}/streams/${id}`, tl);
        if (j.error) throw softErr(j.error);
        const p = pickAudio((j.audioStreams || []).filter(s => s.url && !s.videoOnly).map(s => ({ url: s.url, mime: s.mimeType || '', bitrate: s.bitrate || 0 })));
        if (!p) throw softErr('no audio');
        Mirrors.good('piped', b); return this.put(id, { ...p, via });
      } catch (e) { err = e; if (hardFail(e) && (e.status || tl >= 8000)) { hard = true; Mirrors.bad('piped', b); } else if (hardFail(e)) hard = true; }
    }
    for (const b of Mirrors.order('inv').slice(0, 4)) {
      const via = 'inv:' + b; if (avoid.has(via)) continue;
      if (Date.now() > deadline) break;
      const tl = left(); if (tl < 1500) break;
      try {
        const j = await getJSON(`${b}/api/v1/videos/${id}?local=true`, tl);
        if (j.error) throw softErr(j.error);
        const p = pickAudio((j.adaptiveFormats || []).filter(f => f.url && /^audio\//.test(f.type || '')).map(f => ({ url: f.url.startsWith('/') ? b + f.url : f.url, mime: f.type, bitrate: +f.bitrate || 0 })));
        if (!p) throw softErr('no audio');
        Mirrors.good('inv', b); return this.put(id, { ...p, via });
      } catch (e) { err = e; if (hardFail(e) && (e.status || tl >= 8000)) { hard = true; Mirrors.bad('inv', b); } else if (hardFail(e)) hard = true; }
    }
    const out = err || new Error('No stream available');
    if (!hard && err) out.soft = true;
    throw out;
  },
  put(id, s) { const v = { ...s, exp: s.exp || expOf(s.url) }; this.c.set(id, v); if (this.c.size > 200) this.c.delete(this.c.keys().next().value); return v; },
  drop(id) { if (id) this.c.delete(id); },
};
const ytIdOf = t => (t.source === 'yt' ? t.sid : t.ytId);
const slowNet = () => { const c = navigator.connection; return !!(c && (c.saveData || /^(slow-2g|2g|3g)$/.test(c.effectiveType || ''))); };

/* --- mirror health: after mirrors fail twice, skip them for 20 minutes so songs start instantly --- */
const MirrorHealth = {
  s: (() => { try { return JSON.parse(localStorage.getItem('tunetune.mh') || '{}'); } catch (e) { return {}; } })(),
  ok() { return !(this.s.until > Date.now()); },
  bad(strong) { this.s.fails = (this.s.fails || 0) + 1; if (strong || this.s.fails >= 2) { this.s.until = Date.now() + 20 * 60e3; this.s.fails = 0; } this.keep(); },
  good() { if (this.s.fails || this.s.until) { this.s = {}; this.keep(); } },
  keep() { try { localStorage.setItem('tunetune.mh', JSON.stringify(this.s)); } catch (e) { } },
};

/* --- the official YouTube player (embedded): plays any song YouTube allows, no mirrors needed --- */
const Embed = {
  api: null, player: null, readyP: null, ready: false, broken: false, state: -1, id: '', srcAttr: '', err: null,
  vol: 1, rate: 1, poll: 0, lastDur: 0, ls: {}, needTap: false, tapT: 0,
  addEventListener(ev, fn) { (this.ls[ev] = this.ls[ev] || []).push(fn); },
  emit(ev) { (this.ls[ev] || []).forEach(f => { try { f(); } catch (e) { warn(e); } }); },
  loadApi() {
    if (this.api) return this.api;
    this.api = new Promise((res, rej) => {
      if (window.YT && window.YT.Player) return res(window.YT);
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (typeof prev === 'function') { try { prev(); } catch (e) { } } res(window.YT); };
      const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; sc.async = true;
      sc.onerror = () => rej(new Error('YouTube player blocked'));
      document.head.appendChild(sc);
      setTimeout(() => rej(new Error('YouTube player timed out')), 15000);
    }).catch(e => { this.api = null; throw e; });
    return this.api;
  },
  async ensure() {
    if (this.ready) return;
    const YTA = await this.loadApi();
    if (!this.readyP) {
      this.readyP = new Promise((res, rej) => {
        const vars = { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, playsinline: 1, rel: 0 };
        if (/^https?:/.test(location.origin)) vars.origin = location.origin;
        let host = $('#ytp'); if (!host) { const box = $('#ytbox'); box.innerHTML = '<div id="ytp"></div>'; }
        this.player = new YTA.Player('ytp', { width: '100%', height: '100%', host: 'https://www.youtube-nocookie.com', playerVars: vars, events: {
          onReady: () => { this.ready = true; try { this.player.setVolume(Math.round(this.vol * 100)); } catch (e) { } res(); },
          onStateChange: e => this.onState(e.data),
          onError: e => { this.err = { code: e.data }; this.stopPoll(); this.emit('error'); },
        } });
        setTimeout(() => { if (!this.ready) rej(new Error('YouTube player did not start')); }, 15000);
      }).catch(e => { this.readyP = null; try { this.player && this.player.destroy(); } catch (x) { } this.player = null; throw e; });
    }
    await this.readyP;
  },
  onState(st) {
    this.state = st;
    if (st === 1) { this.needTap = false; clearTimeout(this.tapT); UI.tapHint(false); this.startPoll(); this.emit('play'); this.emit('playing'); }
    else if (st === 2) { this.stopPoll(); this.emit('pause'); }
    else if (st === 0) { this.stopPoll(); this.emit('ended'); }
  },
  startPoll() {
    if (this.poll) return;
    this.poll = setInterval(() => {
      const d = this.duration;
      if (d && d !== this.lastDur) { this.lastDur = d; this.emit('durationchange'); }
      this.emit('timeupdate'); this.adCheck();
    }, 250);
  },
  stopPoll() { clearInterval(this.poll); this.poll = 0; },
  adCheck() {
    if (Player.el !== this) return;
    const ct = this.currentTime, now = Date.now(), d = this.duration, t = Player.cur;
    const moving = this.lastCt != null && Math.abs(ct - this.lastCt) > 0.08; this.lastCt = ct;
    if (this.state !== 1) { this.stuck = 0; return; }
    if (!moving) { if (!this.stuck) this.stuck = now; } else this.stuck = 0;
    const odd = d && t && t.duration > 90 && d < 75 && Math.abs(d - t.duration) > 30;
    if (odd || (this.stuck && now - this.stuck > 1600)) { this.okRun = 0; if (!this.ad) this.setAd(true); }
    else if (moving) { this.okRun = (this.okRun || 0) + 1; if (this.ad && this.okRun >= 6) this.setAd(false); }
  },
  setAd(on) {
    this.ad = on; const np = $('#np'); if (!np) return;
    np.classList.toggle('ytad', on); np.classList.toggle('ytfull', on || this.pinned); UI.ytPill();
    if (on && !npOpen && !this.adToast) { this.adToast = 1; toast('An ad is playing — open the player to see the Skip button'); }
  },
  resetAd() { this.ad = false; this.pinned = false; this.adToast = 0; this.stuck = 0; this.okRun = 0; this.lastCt = null; const np = $('#np'); if (np) np.classList.remove('ytad', 'ytfull'); UI.ytPill(); },
  async open(id, start, autoplay) {
    this.resetAd();
    this.err = null; this.id = id; this.srcAttr = 'youtube:' + id; this.state = -1; this.lastDur = 0;
    await this.ensure();
    if (this.id !== id) return;
    const opts = { videoId: id, startSeconds: Math.max(0, Math.floor(start || 0)) };
    if (autoplay) this.player.loadVideoById(opts); else this.player.cueVideoById(opts);
    try { this.player.setPlaybackRate(this.rate); this.player.setVolume(Math.round(this.vol * 100)); } catch (e) { }
    clearTimeout(this.tapT);
    if (autoplay) this.tapT = setTimeout(() => { if (this.id === id && (this.state === -1 || this.state === 5)) { this.needTap = true; UI.tapHint(true); } }, 5000);
  },
  play() { try { if (this.player && this.id) this.player.playVideo(); } catch (e) { } return Promise.resolve(); },
  pause() { try { if (this.player && this.state !== 2 && this.state !== 0) this.player.pauseVideo(); } catch (e) { } },
  stop() { this.stopPoll(); clearTimeout(this.tapT); this.needTap = false; UI.tapHint(false); this.srcAttr = ''; this.id = ''; this.state = -1; try { this.player && this.player.stopVideo(); } catch (e) { } },
  getAttribute(n) { return n === 'src' ? this.srcAttr : null; },
  removeAttribute() { this.stop(); },
  load() { },
  get src() { return this.srcAttr; },
  get paused() { return !(this.state === 1 || this.state === 3); },
  get ended() { return this.state === 0; },
  get readyState() { return this.state === 1 ? 4 : 0; },
  get error() { return this.err; },
  get currentTime() { try { return (this.player && this.player.getCurrentTime && this.player.getCurrentTime()) || 0; } catch (e) { return 0; } },
  set currentTime(v) { try { this.player.seekTo(v, true); } catch (e) { } },
  get duration() { try { const d = this.player && this.player.getDuration ? this.player.getDuration() : 0; return d > 0 ? d : NaN; } catch (e) { return NaN; } },
  get volume() { return this.vol; },
  set volume(v) { this.vol = v; try { this.player && this.player.setVolume(Math.round(v * 100)); } catch (e) { } },
  get playbackRate() { return this.rate; },
  set playbackRate(r) { this.rate = r; try { this.player && this.player.setPlaybackRate(r); } catch (e) { } },
  get defaultPlaybackRate() { return this.rate; },
  set defaultPlaybackRate(r) { },
};

/* ================= podcasts (Apple Podcasts directory — free, no key) ================= */
const Pod = {
  jp(url) { return jsonp(url, 12000, 'itunes'); },
  big: u => String(u || '').replace(/\/\d+x\d+(bb)?\.(jpg|png|webp)/, '/600x600bb.jpg'),
  show(r) { return { kind: 'podcast', id: String(r.collectionId || r.id), title: r.collectionName || r.name || r.trackName || 'Podcast', sub: r.artistName || '', art: this.big(r.artworkUrl600 || r.artworkUrl100 || ''), genre: r.primaryGenreName || '', source: 'pod' }; },
  ep(e, show) {
    return { id: 'pd:' + e.trackId, source: 'podcast', sid: String(e.trackId), podId: String(e.collectionId || (show && show.id) || ''), title: e.trackName || 'Episode', artist: e.collectionName || (show && show.title) || '',
      art: e.artworkUrl160 || (show && show.art) || '', artLarge: e.artworkUrl600 || (show && show.art) || '', url: e.episodeUrl, duration: Math.round((e.trackTimeMillis || 0) / 1000),
      date: String(e.releaseDate || '').slice(0, 10), desc: String(e.description || e.shortDescription || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 700) };
  },
  search(q) { return cached('pq:' + q, 6e5, async () => ((await this.jp(`https://itunes.apple.com/search?media=podcast&entity=podcast&limit=40&country=${detectCC()}&term=${enc(q)}`)).results || []).map(r => this.show(r))); },
  searchEpisodes(q) {
    return cached('pqe:' + q, 6e5, async () => ((await this.jp(`https://itunes.apple.com/search?media=podcast&entity=podcastEpisode&limit=30&country=${detectCC()}&term=${enc(q)}`)).results || [])
      .map(r => this.ep(r, { id: String(r.collectionId), title: r.collectionName, art: this.big(r.artworkUrl600 || r.artworkUrl160 || '') })).filter(x => x.url));
  },
  top() {
    return cached('ptop:' + detectCC(), 36e5, async () => {
      try {
        const j = await getJSON(`https://rss.applemarketingtools.com/api/v2/${detectCC().toLowerCase()}/podcasts/top/50/podcasts.json`, 8000);
        const r = (j.feed && j.feed.results) || []; if (r.length) return r.map(x => this.show(x));
      } catch (e) { }
      return this.search('top podcasts');
    });
  },
  episodes(id) {
    return cached('pe:' + id, 9e5, async () => {
      const j = await this.jp(`https://itunes.apple.com/lookup?id=${enc(id)}&media=podcast&entity=podcastEpisode&limit=200&country=${detectCC()}`);
      const res = j.results || [];
      const sr = res.find(r => r.kind === 'podcast' || r.wrapperType === 'track') || null;
      const show = sr ? this.show(sr) : { kind: 'podcast', id, title: '', art: '', source: 'pod' };
      const eps = res.filter(r => r.wrapperType === 'podcastEpisode' || r.kind === 'podcast-episode').map(e => this.ep(e, show)).filter(e => e.url);
      eps.sort((a, b) => b.date.localeCompare(a.date));
      return { show, eps };
    });
  },
};
const podProg = id => S.pod.prog[id];
function podSave(t, pos, dur, done) {
  if (!t || t.source !== 'podcast') return;
  S.pod.prog[t.id] = { pos: done ? (dur || pos) : pos, dur: dur || t.duration || 0, at: Date.now(), done: !!done, t: clean(t) };
  const keys = Object.keys(S.pod.prog); if (keys.length > 300) { keys.sort((a, b) => S.pod.prog[a].at - S.pod.prog[b].at).slice(0, 50).forEach(k => delete S.pod.prog[k]); }
}

/* ================= listening stats (stay on this device) ================= */
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const Stats = {
  add(t, dt, counted) {
    const k = dayKey(); S.stats.days[k] = (S.stats.days[k] || 0) + dt;
    if (t.live || t.source === 'podcast') return;
    const p = S.stats.plays[t.id] || (S.stats.plays[t.id] = { n: 0, s: 0, t: clean(t) });
    p.s += dt; p.last = Date.now(); if (counted) p.n++;
    const keys = Object.keys(S.stats.plays);
    if (keys.length > 700) keys.sort((a, b) => (S.stats.plays[a].n - S.stats.plays[b].n) || (S.stats.plays[a].last - S.stats.plays[b].last)).slice(0, 100).forEach(x => delete S.stats.plays[x]);
    const days = Object.keys(S.stats.days); if (days.length > 120) days.sort().slice(0, days.length - 120).forEach(x => delete S.stats.days[x]);
  },
  top(n = 25) { return Object.values(S.stats.plays).filter(p => p.n > 0).sort((a, b) => b.n - a.n || b.s - a.s).slice(0, n); },
  artists(n = 10) {
    const m = new Map();
    for (const p of Object.values(S.stats.plays)) { const a = (p.t.artist || '').split(/,|&/)[0].trim(); if (!a || a === 'Unknown artist') continue; const x = m.get(a) || { name: a, n: 0, s: 0, seed: p.t, best: 0 }; x.n += p.n; x.s += p.s; if (p.n > x.best && (p.t.source === 'saavn' || p.t.source === 'yt' || p.t.ytId)) { x.best = p.n; x.seed = p.t; } m.set(a, x); }
    return [...m.values()].sort((a, b) => b.n - a.n || b.s - a.s).slice(0, n);
  },
  minutes(days) { let s = 0; for (let i = 0; i < days; i++) { const d = new Date(Date.now() - i * 864e5); s += S.stats.days[dayKey(d)] || 0; } return Math.round(s / 60); },
  streak() { let n = 0; for (let i = 0; i < 400; i++) { const d = new Date(Date.now() - i * 864e5); if ((S.stats.days[dayKey(d)] || 0) >= 60) n++; else if (i > 0) break; } return n; },
};
const notBlocked = list => list.filter(x => !S.blocked.includes(x.id));
const Haptic = {
  el: null,
  tap(ms = 8) {
    try {
      if (navigator.vibrate) { navigator.vibrate(ms); return; }
      if (!IS_IOS) return;
      if (!this.el) { const l = document.createElement('label'); l.className = 'hapt'; l.setAttribute('aria-hidden', 'true'); l.innerHTML = '<input type="checkbox" switch tabindex="-1">'; document.body.appendChild(l); this.el = l; }
      this.el.click();
    } catch (e) { }
  },
};
const buzz = () => { if (S.settings.haptics !== false) Haptic.tap(8); };

/* ================= Android app: native lock-screen controls + background service ================= */
const NativeMS = (() => {
  if (!IS_CAP) return null;
  try { return window.Capacitor.registerPlugin ? window.Capacitor.registerPlugin('MediaSession') : (window.Capacitor.Plugins || {}).MediaSession || null; } catch (e) { return null; }
})();
const nms = (fn, arg, h) => { try { const r = h ? NativeMS[fn](arg, h) : NativeMS[fn](arg); if (r && r.catch) r.catch(() => { }); } catch (e) { } };

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

/* Preloads the next song fully into memory on a good connection: instant, gap-free track changes and no buffering if the network drops */
const Pre = {
  m: new Map(), busy: null,
  get(id) { return this.m.get(id); },
  prune(keep) { const ids = new Set((keep || []).filter(Boolean).map(x => x.id)); for (const id of [...this.m.keys()]) if (!ids.has(id)) this.drop(id); },
  drop(id) { const e = this.m.get(id); if (e && e.url !== (Player.objUrl || '') && Player.el && Player.el.src !== e.url) URL.revokeObjectURL(e.url); this.m.delete(id); },
  async warm(t) {
    if (!S.settings.preload || this.busy || !t || t.live || slowNet() || isDl(t.id) || this.m.has(t.id) || t.source === 'local') return;
    if (!navigator.onLine) return;
    this.busy = (async () => {
      try {
        let src = '', q = '';
        if (t.source === 'audius') { await Audius.discover(); src = Audius.streamUrl(t); q = 'MP3 · 320 kbps'; }
        else if (t.source === 'podcast') { src = t.url; q = 'Podcast'; }
        else if (t.source === 'saavn') { const pk = Saavn.pick(t); if (!pk) return; src = pk.url; q = `AAC · ${pk.kbps} kbps`; }
        else {
          const yid = ytIdOf(t); if (!yid) return;
          if (S.settings.engine === 'player' || (!DIRECT() && !MirrorHealth.ok())) return;
          const st = await Streams.get(yid, new Set(), DIRECT() ? 20000 : 6000); src = st.url; q = qLabel(st.mime, st.bitrate);
        }
        const r0 = await fetchT(src, { method: 'GET', headers: { Range: 'bytes=0-0' } }, 8000).catch(() => null);
        const total = r0 ? +((r0.headers.get('content-range') || '').split('/')[1] || r0.headers.get('content-length') || 0) : 0;
        if (total > 30e6) return;
        const blob = await fetchMedia(src, '');
        if (!blob || blob.size < 20000) return;
        this.m.set(t.id, { url: URL.createObjectURL(blob), q, blob });
        while (this.m.size > 3) this.drop(this.m.keys().next().value);
      } catch (e) { } finally { this.busy = null; }
    })();
  },
};

const Player = {
  queue: [], i: -1, orig: null, shuffle: false, repeat: 'off', from: '',
  plain: null, fx: null, el: null, ctx: null, pre: null, filters: [],
  objUrl: null, ltok: 0, loaded: false, resumeAt: 0, rate: 1, vol: 1, isBlob: false, pendingSeek: 0,
  wantPlay: false, loading: false, srcAt: 0, lastProgress: 0, lastT: -1, resumeTries: 0, avoid: new Set(), attempts: 0, failRun: 0,
  via: '', previewMode: false, prefetched: false, extending: null, badCors: new Set(), waitOnline: false, embedId: '', userPaused: false, xfStarted: false, fading: null, quality: '', norm: 1, lastStatT: null, listened: 0, counted: false, lastPodSave: 0,
  sleepT: null, sleepAt: 0, sleepEnd: false,
  get cur() { return this.queue[this.i] || null; },

  init() {
    this.plainA = this.mk(false); this.plainB = this.mk(false); this.plain = this.plainA; this.el = this.plain;
    ['timeupdate', 'play', 'playing', 'pause', 'ended', 'error', 'loadedmetadata', 'durationchange'].forEach(ev => Embed.addEventListener(ev, () => { if (this.el === Embed) this.on(ev); }));
    this.setVol(S.settings.volume == null ? 1 : S.settings.volume, true);
    this.session(); this.restore();
    setInterval(() => this.persist(), 5000);
    setInterval(() => this.watch(), 4000);
    addEventListener('pagehide', () => this.persist());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.hiddenAt = Date.now();
      if (document.hidden && Party.tr) Party.torchOff();
      if (document.hidden && this.intrAt && Date.now() - this.intrAt < 3000) this.intrOk = true;
      if (!document.hidden && this.intrAt) this.intrTry();
      if (document.hidden) return this.persist();
      if (this.ctx && this.ctx.state !== 'running' && this.wantPlay) this.ctx.resume().catch(() => { });
      if (this.wantPlay && this.loaded && this.el !== Embed && this.el.paused && !this.loading && this.el.error) this.load(true, this.el.currentTime || this.resumeAt || 0, true);
    });
    try { navigator.mediaDevices && navigator.mediaDevices.addEventListener && navigator.mediaDevices.addEventListener('devicechange', () => { Player.devAt = Date.now(); }); } catch (e) { }
    addEventListener('focus', () => { if (this.intrAt) this.intrTry(); });
    addEventListener('pageshow', () => { if (this.ctx && this.ctx.state !== 'running' && this.wantPlay) this.ctx.resume().catch(() => { }); });
  },
  mk(fx) {
    const a = document.createElement('audio'); a.preload = 'auto'; if (fx) a.crossOrigin = 'anonymous';
    ['timeupdate', 'play', 'playing', 'pause', 'ended', 'error', 'loadedmetadata', 'durationchange'].forEach(ev => a.addEventListener(ev, () => { if (a === this.el && a.src !== SILENT) this.on(ev); }));
    return a;
  },
  on(ev) {
    const a = this.el, t = this.cur;
    if (ev === 'timeupdate') {
      const now = a.currentTime;
      if (now !== this.lastT) { this.lastT = now; this.lastProgress = Date.now(); }
      if (t && !a.paused && this.lastStatT !== null) {
        const dt = now - this.lastStatT;
        if (dt > 0 && dt < 2.5) { this.listened += dt; const c = !this.counted && this.listened >= 30; if (c) { this.counted = true; setTimeout(() => Offline.keep(t), 1500); } Stats.add(t, dt, c); }
      }
      this.lastStatT = now;
      if (t && t.source === 'podcast' && Date.now() - this.lastPodSave > 5000) { this.lastPodSave = Date.now(); podSave(t, now, a.duration); }
      UI.time(); this.ahead();
    } else if (ev === 'durationchange') UI.time();
    else if (ev === 'play') UI.state();
    else if (ev === 'playing') {
      if (this.userPaused && !this.wantPlay && a !== Embed) { try { a.pause(); } catch (e) { } UI.state(); return; }
      this.loading = false; this.resumeTries = 0; this.failRun = 0; this.wantPlay = true; this.lastProgress = Date.now(); if (this.intrAt) { this.stopIntr(); }
      const hr = new Date().getHours();
      if ((hr >= 23 || hr < 4) && !this.sleepAt && !this.sleepEnd && S.lastNightTip !== dayKey() && S.settings.nightTip !== false && !document.hidden) { S.lastNightTip = dayKey(); save(); setTimeout(() => toast('Late night? Stop the music in 30 minutes', { label: 'Set', ms: 6000, fn: () => { try { Player.sleep(30); UI.timerBtn(); toast('Sleep timer: 30 minutes'); } catch (e) { } } }), 2500); }
      if (t) { clearTimeout(this.metaT); this.metaT = setTimeout(() => { if (this.cur === t) { try { this.meta(t); } catch (e) { } } }, 600); }
      try { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'; } catch (e) { }
      if (/^(piped|inv):/.test(this.via)) MirrorHealth.good();
      UI.state(); UI.track(t);
    }
    else if (ev === 'pause') {
      if (!this.loading && !a.ended && this.wantPlay && !this.userPaused && this.cur && S.settings.autoResume !== false && a !== Embed) { this.interrupted(); UI.state(); return; }
      if (a === Embed && document.hidden && this.wantPlay && !this.userPaused && Date.now() - (this.hiddenAt || 0) < 2000) { setTimeout(() => { if (this.el === Embed && this.wantPlay) Embed.play(); }, 400); UI.state(); return; }
      if (a === Embed && document.hidden) { this.wantPlay = false; this.userPaused = true; UI.state(); return; }
      if (!this.loading && !a.ended) this.wantPlay = false; UI.state();
    }
    else if (ev === 'loadedmetadata') {
      if (this.pendingSeek) { try { a.currentTime = this.pendingSeek; } catch (e) { } this.pendingSeek = 0; }
      a.playbackRate = t && t.live ? 1 : (t && t.source === 'podcast' ? (+S.settings.podSpeed || this.rate) : this.rate); UI.time();
    }
    else if (ev === 'ended') { if (t && t.source === 'podcast') podSave(t, a.duration || 0, a.duration || 0, true); this.ended(); }
    else if (ev === 'error') this.fail();
  },
  ahead() {
    const t = this.cur, a = this.el; if (!t || t.live) return;
    if (!this.prefetched && a.currentTime > 8) { this.prefetched = true; this.prefetch(); }
    if (a.currentTime > 20 && !this.preWarm) { this.preWarm = true; Pre.prune([this.queue[this.i - 1], t, this.queue[this.i + 1]]); Pre.warm(this.queue[this.i + 1]); }
    if (a.currentTime > 45 && !this.preWarmPrev) { this.preWarmPrev = true; const pv = this.queue[this.i - 1]; if (pv && !Offline.has(pv.id) && !isDl(pv.id) && !Pre.busy) Pre.warm(pv); }
    const cf = IS_IOS ? 0 : (+S.settings.crossfade || 0);
    if (cf > 0 && !this.xfStarted && !this.loading && a === this.plain && !a.paused && isFinite(a.duration) && a.duration > cf * 3 && a.duration - a.currentTime <= cf && this.repeat !== 'one' && t.source !== 'podcast') {
      const n = this.queue[this.i + 1];
      if (n && !n.live && n.source !== 'podcast' && this.ready(n)) { this.xfStarted = true; this.i++; this.load(true, 0, false, true); }
    }
    if (S.settings.autoplay && t.source !== 'podcast' && this.repeat === 'off' && this.i >= this.queue.length - 1 && !this.extending && isFinite(a.duration) && a.duration - a.currentTime < 45) this.autoExtend();
  },
  ready(n) {
    if (Pre.get(n.id) || isDl(n.id) || n.source === 'local' || n.source === 'audius' || (n.source === 'saavn' && (n.su || n.enc))) return true;
    const y = ytIdOf(n); const h = y && Streams.c.get(y);
    return !!(h && h.exp > Date.now() + 60e3);
  },
  crossfade(old, nw, secs) {
    this.stopFade();
    const target = clamp(this.vol * (this.norm || 1), 0, 1), from = old.volume, t0 = Date.now(), dur = secs * 1000;
    nw.volume = 0;
    const iv = setInterval(() => {
      const p = clamp((Date.now() - t0) / dur, 0, 1);
      old.volume = from * (1 - p); nw.volume = target * Math.sin(p * Math.PI / 2);
      if (p >= 1) this.stopFade();
    }, 50);
    this.fading = { old, nw, iv, target };
  },
  stopFade() {
    const f = this.fading; if (!f) return; this.fading = null; clearInterval(f.iv);
    try { f.old.pause(); f.old.removeAttribute('src'); f.old.load(); } catch (e) { }
    try { f.nw.volume = f.target; } catch (e) { }
  },
  prefetch() {
    const n = this.queue[this.i + 1]; if (!n || n.live || isDl(n.id)) return;
    if (S.settings.engine === 'player' || (!DIRECT() && !MirrorHealth.ok())) return;
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
    if (this.via === 'saavn' && !this.isBlob) {
      if (t.source === 'saavn') { if (this.attempts < 2) { this.attempts++; return this.load(true, pos, true); } }
      else { this.avoid.add('saavn'); delete t.svSu; this.attempts++; return this.load(true, pos, true); }
    }
    if (this.via === 'preloaded') { Pre.drop(t.id); this.avoid.add('preloaded'); return this.load(true, pos, true); }
    if (this.isBlob) { toast('This saved file can’t be played'); return this.skipAfterFail(t); }
    const yid = ytIdOf(t);
    if (a === Embed) {
      const code = Embed.err && Embed.err.code;
      this.avoid.add('embed:' + this.embedId);
      if (this.attempts < 5) { this.attempts++; return this.load(true, [2, 100, 101, 150].includes(code) ? 0 : pos, true); }
    } else if (yid && !this.previewMode && this.attempts < 5) {
      this.attempts++;
      if (this.via) this.avoid.add(this.via);
      if (!DIRECT() && /^(piped|inv):/.test(this.via)) { MirrorHealth.bad(); this.avoid.add('streams'); }
      Streams.drop(yid);
      return this.load(true, pos, true);
    }
    if (t.source === 'deezer' && this.previewMode && this.attempts < 5) {
      this.attempts++;
      try { const u = await Deezer.refresh(t); if (u) { t.url = u; return this.load(true, 0, true); } } catch (e) { }
    }
    if ((t.source === 'audius' || t.live || t.source === 'podcast') && this.attempts < 1) {
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
  async load(autoplay = true, startAt = 0, quiet = false, xfade = false) {
    const t = this.cur; if (!t) return;
    const tok = ++this.ltok; this.loaded = true;
    if (!quiet) {
      this.attempts = 0; this.avoid = new Set(); this.via = ''; this.prefetched = false; this.previewMode = false; this.listened = 0; this.counted = false; addHistory(t);
      this.ytOnce = false;
      if (t.source === 'podcast' && !startAt) { const pp = podProg(t.id); const d = pp && (pp.dur || t.duration); if (pp && !pp.done && pp.pos > 15 && (!d || pp.pos < d - 20)) startAt = pp.pos; }
    }
    this.lastStatT = null; this.norm = 1; this.quality = ''; this.preWarm = false; this.preWarmPrev = false;
    if (!xfade) this.stopFade();
    if (autoplay) this.wantPlay = true;
    this.loading = true; this.waitOnline = false;
    UI.track(t); UI.state();
    let src = '', blob = false, embedId = '';
    const pre = !this.avoid.has('preloaded') && Pre.get(t.id);
    if (pre) { src = pre.url; blob = true; this.via = 'preloaded'; this.quality = pre.q; }
    if (!src && !isDl(t.id) && Offline.has(t.id)) {
      const b = await Offline.get(t.id); if (tok !== this.ltok) return;
      if (b) { if (this.objUrl) URL.revokeObjectURL(this.objUrl); this.objUrl = URL.createObjectURL(b); src = this.objUrl; blob = true; this.via = 'saved'; this.quality = (S.cached.find(x => x.id === t.id) || {}).q || fmtLabel(b.type); }
      else Offline.forget(t.id);
    }
    if (!src && (t.source === 'local' || isDl(t.id))) {
      try {
        const b = await DB.get(t.id); if (tok !== this.ltok) return;
        if (b) { if (this.objUrl) URL.revokeObjectURL(this.objUrl); this.objUrl = URL.createObjectURL(b); src = this.objUrl; blob = true; this.via = 'saved'; this.quality = t.source === 'local' ? fmtLabel(t.fmt || b.type) : (t.q || fmtLabel(b.type)); }
      } catch (e) { }
    }
    if (!src) {
      if (t.source === 'local') { toast('This file is no longer on this device'); return this.skipAfterFail(t); }
      if (!navigator.onLine) {
        this.loading = false; this.waitOnline = true; this.resumeAt = startAt;
        const n = offlineList().length;
        if (n) toast('You’re offline — this song isn’t saved', { label: 'Offline Mix', ms: 6000, fn: () => playOffline('mix') });
        else toast('You’re offline — it will start when you’re back online');
        UI.state(); return;
      }
      try {
        if (t.source === 'audius') { await Audius.discover(); src = Audius.streamUrl(t); this.via = 'audius'; this.quality = 'MP3 · 320 kbps'; }
        else if (t.source === 'radio') { src = t.url; this.via = 'radio'; this.quality = t.codec ? `${t.codec}${t.bitrate ? ' · ' + t.bitrate + ' kbps' : ''}` : 'Live'; }
        else if (t.source === 'podcast') { src = t.url; this.via = 'podcast'; this.quality = 'Podcast'; }
        else if (t.source === 'saavn') {
          if (this.attempts > 0 || (!t.su && !t.enc)) { try { const f = await Saavn.song(t.sid); if (f) { delete t.su; t.enc = f.enc; t.hq = f.hq; if (f.su) t.su = f.su; } } catch (e) { } }
          if (tok !== this.ltok) return;
          const pk = Saavn.pick(t); if (!pk) throw new Error('song unavailable');
          src = pk.url; this.via = 'saavn'; this.quality = `AAC · ${pk.kbps} kbps`;
        }
        else {
          if (t.source === 'deezer' && !this.previewMode && !this.avoid.has('saavn')) {
            try { if (!t.svSu) { const m = await Saavn.match(t); if (m) t.svSu = Saavn.urls(m); } } catch (e) { }
            if (tok !== this.ltok) return;
            const pk = t.svSu && Saavn.pick(t.svSu); if (pk) { src = pk.url; this.via = 'saavn'; this.quality = `AAC · ${pk.kbps} kbps`; }
          }
          let yid = src ? '' : ytIdOf(t);
          if (!src && !yid && t.source === 'deezer' && !this.previewMode) { try { const m = await YT.match(t); if (m && m.source === 'yt') { yid = t.ytId = m.sid; } } catch (e) { } }
          if (tok !== this.ltok) return;
          if (yid && !this.previewMode) {
            const eng = S.settings.engine;
            const tryStreams = eng !== 'player' && !this.avoid.has('streams') && (DIRECT() || eng === 'audio' || MirrorHealth.ok());
            if (tryStreams) {
              try {
                const s = await Streams.get(yid, this.avoid, DIRECT() ? 30000 : 6000); src = s.url; this.via = s.via; this.quality = qLabel(s.mime, s.bitrate);
                if (S.settings.normalize && s.loud > 0) this.norm = clamp(Math.pow(10, -s.loud / 20), 0.25, 1);
              }
              catch (e) { if (!DIRECT() && !e.soft) MirrorHealth.bad(true); this.avoid.add('streams'); }
              if (tok !== this.ltok) return;
            }
            if (!src && !this.avoid.has('saavn') && t.source === 'yt') {
              try { if (!t.svSu) { const m = await Saavn.match(t); if (m) t.svSu = Saavn.urls(m); } } catch (e) { }
              if (tok !== this.ltok) return;
              const pk = t.svSu && Saavn.pick(t.svSu); if (pk) { src = pk.url; this.via = 'saavn'; this.quality = `AAC · ${pk.kbps} kbps`; }
            }
            if (!src && (eng === 'player' || (eng !== 'audio' && (S.settings.ytPlayer || this.ytOnce)))) {
              embedId = await this.pickEmbed(t, yid);
              if (tok !== this.ltok) return;
            }
            if (!src && !embedId && t.source === 'yt') {
              if (!document.hidden && eng !== 'audio' && !S.settings.ytPlayer && !this.ytOnce) { this.loading = false; this.wantPlay = false; UI.state(); askYouTube(t); return; }
              throw new Error('no playable source');
            }
          }
          if (!src && !embedId && t.source === 'deezer' && t.url) { this.previewMode = true; src = t.url; this.via = 'preview'; this.quality = 'Preview'; if (!document.hidden) toast('Full song unavailable right now — playing a 30-second preview'); }
        }
      } catch (e) {
        if (tok !== this.ltok) return;
        warn('stream', e);
        if (!document.hidden) toast(`Can’t play “${t.title}” — moving on`);
        return this.skipAfterFail(t);
      }
      if (tok !== this.ltok) return;
    }
    if (embedId) {
      this.isBlob = false; this.embedId = embedId; this.via = 'embed'; this.quality = 'YouTube player';
      if (!DIRECT() && /Android|iPhone|iPad/i.test(navigator.userAgent)) { try { if (!sessionStorage.getItem('tt.embedHint')) { sessionStorage.setItem('tt.embedHint', '1'); setTimeout(() => toast(releasesBase() ? 'This song uses YouTube’s player in the browser. For ad-free audio with the screen off, get the Android app in Settings.' : 'This song uses YouTube’s player in the browser, so ads can appear.'), 1500); } } catch (e) { } }
      this.route('embed');
      this.srcAt = Date.now(); this.lastProgress = Date.now(); this.lastT = -1; this.pendingSeek = 0;
      UI.track(t); this.meta(t);
      try { await Embed.open(embedId, startAt, autoplay); }
      catch (e) {
        if (tok !== this.ltok) return;
        Embed.broken = true; warn('embed', e);
        if (!document.hidden) toast('The YouTube player is blocked on this network or by an ad blocker');
        return this.skipAfterFail(t);
      }
      if (tok !== this.ltok) return;
      if (autoplay) this.play(); else { this.loading = false; UI.state(); }
      return;
    }
    if (!src) return this.skipAfterFail(t);
    this.isBlob = blob;
    const wantFx = (S.settings.eqOn || Party.react()) && !IS_IOS;
    if (!blob && wantFx && (S.settings.proxy || SITE.server) && /saavncdn\.com/.test(src)) src = JSA.relays()[0].wrap(src);
    let host = ''; try { host = new URL(src, location.href).host; } catch (e) { }
    const fx = !!(wantFx && !t.live && this.via !== 'preview' && (blob || !this.badCors.has(host)));
    let fadeFrom = null;
    if (xfade && !fx && this.el === this.plain && !this.el.paused) { fadeFrom = this.plain; this.plain = fadeFrom === this.plainA ? this.plainB : this.plainA; this.el = this.plain; }
    this.route(fx ? 'fx' : 'plain');
    const a = this.el;
    this.pendingSeek = startAt > 0 ? startAt : 0; this.srcAt = Date.now(); this.lastProgress = Date.now(); this.lastT = -1;
    a.src = src; this.applyVol();
    a.defaultPlaybackRate = a.playbackRate = t.live ? 1 : (t.source === 'podcast' ? (+S.settings.podSpeed || this.rate) : this.rate);
    if (fadeFrom) this.crossfade(fadeFrom, a, +S.settings.crossfade || 6);
    this.xfStarted = false;
    UI.track(t); this.meta(t);
    if (t.live && !quiet) Radio.click(t);
    if (autoplay) this.play(); else { this.loading = false; UI.state(); }
  },
  async pickEmbed(t, yid) {
    if (Embed.broken) return '';
    const ok = id => id && !this.avoid.has('embed:' + id);
    if (ok(yid)) return yid;
    if (!t._altsFetched) {
      t._altsFetched = true;
      try { t._alts = (await YT.songs(`${t.title} ${t.artist}`)).map(x => x.sid).filter(id => id !== yid).slice(0, 4); } catch (e) { t._alts = []; }
    }
    return (t._alts || []).find(ok) || '';
  },
  async play() {
    this.wantPlay = true; this.userPaused = false;
    if (this.ctx && this.ctx.state !== 'running') { try { await Promise.race([this.ctx.resume(), sleep(350)]); } catch (e) { } }
    const el = this.el, tok = this.ltok; clearTimeout(this.playWd);
    this.playWd = setTimeout(() => {
      if (this.wantPlay && this.ltok === tok && this.el === el && el.paused && !this.loading && this.cur && navigator.onLine && this.wdTok !== tok && Date.now() - (this.wdAt || 0) > 15000) {
        this.wdTok = tok; this.wdAt = Date.now(); warn('play did not start — reloading at the same spot'); this.load(true, el.currentTime || this.resumeAt || 0, true);
      }
    }, el === Embed ? 6000 : 3500);
    try { await el.play(); }
    catch (e) {
      if (e && e.name === 'NotAllowedError') { clearTimeout(this.playWd); this.loading = false; UI.state(); if (!document.hidden) toast('Tap play to start'); }
    }
  },
  userPause() { this.stopIntr(); this.wantPlay = false; this.userPaused = true; this.stopFade(); this.el.pause(); },
  interrupted() {
    this.stopIntr(); this.intrAt = Date.now(); this.intrOk = document.hidden; this.wantPlay = false;
    this.intrT = setInterval(() => this.intrTry(), 2000);
  },
  intrTry() {
    if (!this.intrAt) return;
    if (this.userPaused || !this.cur || Date.now() - this.intrAt > 5 * 60e3 || Date.now() - (Player.devAt || 0) < 4000 && (Player.devAt || 0) > this.intrAt - 2000) { UI.state(); return this.stopIntr(); }
    if (!this.el.paused) return this.stopIntr();
    if (!this.intrOk) { if (Date.now() - this.intrAt > 3500) { UI.state(); this.stopIntr(); } return; }
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => { });
    const p = this.el.play(); if (p && p.catch) p.catch(() => { });
  },
  stopIntr() { clearInterval(this.intrT); this.intrT = 0; this.intrAt = 0; this.intrOk = false; },
  route(kind) {
    if (kind === 'fx' && !this.ensureFx()) kind = 'plain';
    const target = kind === 'fx' ? this.fx : kind === 'embed' ? Embed : this.plain;
    if (target !== this.el) {
      const old = this.el; this.el = target; try { target.volume = target === Embed ? this.vol : clamp(this.vol * (this.norm || 1), 0, 1); } catch (e) { }
      old.pause(); old.removeAttribute('src'); try { old.load(); } catch (e) { }
    }
    $('#np').classList.toggle('video', kind === 'embed');
  },
  ensureFx() {
    if (this.fx) return true;
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return false;
    try {
      const a = this.mk(true); const ctx = this.ctx = new C();
      const src = ctx.createMediaElementSource(a);
      this.pre = ctx.createGain(); src.connect(this.pre);
      let n = this.pre;
      this.filters = EQ_F.map((f, i) => {
        const b = ctx.createBiquadFilter();
        b.type = i === 0 ? 'lowshelf' : i === EQ_F.length - 1 ? 'highshelf' : 'peaking';
        b.frequency.value = f; b.Q.value = 1.1; n.connect(b); n = b; return b;
      });
      this.bass = ctx.createBiquadFilter(); this.bass.type = 'lowshelf'; this.bass.frequency.value = 90; n.connect(this.bass);
      this.treble = ctx.createBiquadFilter(); this.treble.type = 'highshelf'; this.treble.frequency.value = 9000; this.bass.connect(this.treble);
      this.comp = ctx.createDynamicsCompressor(); this.treble.connect(this.comp);
      const sp = ctx.createChannelSplitter(2), mg = ctx.createChannelMerger(2);
      this.wid = ['LL', 'LR', 'RL', 'RR'].map(() => ctx.createGain());
      this.comp.connect(sp);
      sp.connect(this.wid[0], 0); sp.connect(this.wid[1], 1); sp.connect(this.wid[2], 0); sp.connect(this.wid[3], 1);
      this.wid[0].connect(mg, 0, 0); this.wid[1].connect(mg, 0, 0); this.wid[2].connect(mg, 0, 1); this.wid[3].connect(mg, 0, 1);
      this.master = ctx.createGain(); mg.connect(this.master);
      this.lim = ctx.createDynamicsCompressor(); this.master.connect(this.lim); this.lim.connect(ctx.destination);
      try { const L = this.lim; L.threshold.value = -1.5; L.knee.value = 0; L.ratio.value = 20; L.attack.value = 0.002; L.release.value = 0.09; } catch (e) { }
      try { this.an = ctx.createAnalyser(); this.an.fftSize = 1024; this.an.smoothingTimeConstant = 0.72; this.lim.connect(this.an); } catch (e) { this.an = null; }
      this.fx = a; a.volume = this.vol; this.applyEq(); return true;
    } catch (e) { warn('EQ unavailable', e); return false; }
  },
  applyEq() {
    if (!this.filters.length) return;
    const st = S.settings, g = st.eqOn ? st.eq : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.filters.forEach((f, i) => { f.gain.value = g[i] || 0; });
    const on = !!st.eqOn;
    this.bass.gain.value = on ? +st.eqBass || 0 : 0; this.treble.gain.value = on ? +st.eqTreble || 0 : 0;
    const peak = Math.max(0, ...g) + (on ? Math.max(0, +st.eqBass || 0) * 0.7 : 0);
    this.pre.gain.value = Math.pow(10, ((on ? +st.eqPre || 0 : 0) - peak * 0.35) / 20);
    const c = this.comp, loud = on && !!st.eqLoud;
    c.threshold.value = loud ? -26 : 0; c.knee.value = loud ? 24 : 0; c.ratio.value = loud ? 4 : 1; c.attack.value = 0.004; c.release.value = 0.22;
    this.master.gain.value = Math.pow(10, ((loud ? 5 : 0) + (on ? clamp(+st.eqBoost || 0, 0, 12) : 0)) / 20);
    const k = on ? clamp(+st.eqWidth || 1, 0, 2.2) : 1;
    this.wid[0].gain.value = (1 + k) / 2; this.wid[1].gain.value = (1 - k) / 2; this.wid[2].gain.value = (1 - k) / 2; this.wid[3].gain.value = (1 + k) / 2;
  },
  reroute() {
    const t = this.cur; if (!t || !this.loaded || this.el === Embed || this.via === 'embed') return;
    this.load(!this.el.paused, t.live ? 0 : (this.el.currentTime || 0), true);
  },
  toggle() {
    if (!this.cur) return;
    if (this.loading && this.wantPlay) {
      this.ltok++; this.wantPlay = false; this.loading = false; this.loaded = false;
      this.resumeAt = this.el.currentTime || this.pendingSeek || 0;
      if (this.el === Embed) Embed.stop(); else this.el.pause();
      UI.state(); return;
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
    if (!S.settings.mixPods) {
      const isPod = x => x && x.source === 'podcast', start = list[idx];
      if (start && list.some(isPod) && list.some(x => !isPod(x))) { const keep = list.filter(x => isPod(x) === isPod(start)); idx = Math.max(0, keep.indexOf(start)); list = keep; }
    }
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
  noteSkip() {
    const t = this.cur; if (!t || t.live || t.source === 'podcast' || this.counted || !this.loaded) return;
    if ((this.el.currentTime || 0) < 10) { S.skips = S.skips || {}; S.skips[t.id] = (S.skips[t.id] || 0) + 1; }
  },
  async next(auto = false) {
    if (!auto) this.noteSkip();
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
      if (!S.settings.autoplay || !c || c.live || c.source === 'podcast') return false;
      const recent = new Set((S.history || []).slice(0, 25).map(x => x.id));
      const skipped = x => ((S.skips || {})[x.id] || 0) >= 3 || recent.has(x.id);
      const have = new Set(this.queue.map(x => x.id));
      let pool = [];
      const yid = ytIdOf(c);
      if (c.source === 'saavn') { try { pool = (await YT.related(c)).filter(x => !have.has(x.id) && !skipped(x) && x.source !== 'podcast'); } catch (e) { } }
      else if (yid) { try { pool = (await YT.related({ sid: yid })).filter(x => !have.has(x.id)); } catch (e) { } }
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
      pool = notBlocked(pool).slice(0, 20);
      if (!pool.length) return false;
      this.queue.push(...pool); if (this.orig) this.orig.push(...pool);
      if (!document.hidden) toast('Autoplay — similar songs added'); qRefresh();
      return true;
    })().finally(() => { this.extending = null; });
    return this.extending;
  },
  prevTrack() {
    if (this.i > 0) { this.i--; this.load(true); }
    else if (this.repeat === 'all' && this.queue.length > 1) { this.i = this.queue.length - 1; this.load(true); }
    else if (this.loaded) this.seek(0);
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
    UI.modes(); qRefresh(); UI.drive(); if (!silent) toast(on ? 'Shuffle on' : 'Shuffle off');
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
    if (a === Embed && Embed.needTap) return;
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
    if (yid && !this.isBlob && this.el !== Embed) { Streams.drop(yid); if (this.via && !['direct', 'server'].includes(this.via)) this.avoid.add(this.via); }
    this.load(true, pos, true);
  },
  setVol(v, silent) {
    this.vol = clamp(v, 0, 1); this.applyVol();
    S.settings.volume = this.vol; if (!silent) save();
  },
  applyVol() { const v = clamp(this.vol * (this.norm || 1), 0, 1); if (this.fading) { this.fading.target = v; } else { this.plain.volume = v; } if (this.fx) this.fx.volume = v; Embed.volume = this.vol; },
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
    if (NativeMS) {
      const H = {
        play: () => (this.loaded && !this.waitOnline ? this.play() : this.toggle()), pause: () => this.userPause(), stop: () => this.userPause(),
        previoustrack: () => this.prev(), nexttrack: () => this.next(), seekto: d => this.seek(d && d.seekTime),
        seekbackward: d => this.seek(this.el.currentTime - ((d && d.seekOffset) || 10)), seekforward: d => this.seek(this.el.currentTime + ((d && d.seekOffset) || 10)),
      };
      for (const [action, fn] of Object.entries(H)) nms('setActionHandler', { action }, fn);
    }
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
    const art = artOf(t, true);
    if (NativeMS) {
      const src = /^https?:/.test(art) ? art.replace('/maxresdefault.jpg', '/hqdefault.jpg') : '';
      nms('setMetadata', { title: t.title, artist: t.artist, album: t.live ? 'Live Radio' : (t.album || TITLE), artwork: src ? [{ src, sizes: '512x512', type: 'image/jpeg' }] : [] });
    }
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
    const artwork = art.startsWith('data:image/svg') ? [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] : [{ src: art, sizes: '512x512' }, { src: artOf(t), sizes: '256x256' }];
    try { navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: t.live ? 'Live Radio' : (t.album || TITLE), artwork }); } catch (e) { }
  },
  posState() {
    const a = this.el; if (!isFinite(a.duration) || !a.duration || (this.cur && this.cur.live)) return;
    if (NativeMS) nms('setPositionState', { duration: a.duration, playbackRate: a.playbackRate || 1, position: Math.min(a.currentTime, a.duration) });
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
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
    const changed = this._lid !== t.id;
    let dir = 0;
    if (changed && this._lid) { if (this._lq === Player.queue) { if (Player.i === this._li + 1 || (this._li === Player.queue.length - 1 && Player.i === 0)) dir = 1; else if (Player.i === this._li - 1 || (this._li === 0 && Player.i === Player.queue.length - 1)) dir = -1; } }
    if (changed) { this._lid = t.id; this._li = Player.i; this._lq = Player.queue; }
    this.deck();
    if (t.source !== 'yt' && Player.via !== 'embed') $('#np').classList.remove('video');
    if (dir) {
      const m = $('#mini'); m.classList.remove('m-next', 'm-prev'); void m.offsetWidth; m.classList.add(dir > 0 ? 'm-next' : 'm-prev'); clearTimeout(this.mT); this.mT = setTimeout(() => m.classList.remove('m-next', 'm-prev'), 500);
      const np = $('#np'); np.classList.remove('t-next', 't-prev'); void np.offsetWidth; np.classList.add(dir > 0 ? 't-next' : 't-prev'); clearTimeout(this.tT); this.tT = setTimeout(() => np.classList.remove('t-next', 't-prev'), 500);
    }
    const ni = $('#np-img'); if (ni.getAttribute('src') !== big) { delete ni.dataset.fb; ni.classList.remove('ld'); ni.src = big; } ni.classList.toggle('logo', !!t.live);
    if (dir) Deck.arrive(dir);
    if (dir && document.getElementById('drive')) { const w = $('#dv-artw'); if (w) { w.classList.remove('in-r', 'in-l'); void w.offsetWidth; w.classList.add(dir > 0 ? 'in-r' : 'in-l'); setTimeout(() => w.classList.remove('in-r', 'in-l'), 520); } }
    this.dlMark();
    clearTimeout(this.artT); this.artT = setTimeout(() => {
      if (!Player.cur || Player.cur.id !== t.id) return;
      if (ni.complete && ni.naturalWidth) ni.classList.add('ld');
      else { const alt = (t.art && t.art !== big) ? t.art : ph(t); delete ni.dataset.fb; ni.src = alt; }
    }, 3500);
    $('#np-bg').style.backgroundImage = `url("${art.replace(/"/g, '%22')}")`; $('#np-bg2').style.backgroundImage = `url("${art.replace(/"/g, '%22')}")`;
    if (document.getElementById('drive')) this.drive();
    if (Party.on) Party.ui();
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
    const was = b.getAttribute('aria-pressed') === 'true';
    b.innerHTML = on ? I.heartFill : I.heart; b.setAttribute('aria-pressed', String(on));
    if (on && !was) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    const dl = $('#dv-like'); if (dl) dl.innerHTML = on ? I.heartFill : I.heart;
  },
  state() {
    const playing = Player.loaded && !Player.el.paused;
    const busy = Player.loading && Player.wantPlay;
    document.body.classList.toggle('playing', playing);
    document.body.classList.toggle('buffering', busy);
    $('#np').classList.toggle('paused', !playing && !busy);
    const ic = playing || busy ? I.pause : I.play;
    $('#m-pp').innerHTML = ic; $('#np-pp').innerHTML = ic; const dv = $('#dv-pp'); if (dv) dv.innerHTML = ic;
    const lbl = playing || busy ? 'Pause' : 'Play';
    $('#m-pp').setAttribute('aria-label', lbl); $('#np-pp').setAttribute('aria-label', lbl);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing || busy ? 'playing' : 'paused';
    if (Party.on) Party.ui();
    if (NativeMS && Player.cur) { const st = playing || busy ? 'playing' : 'paused'; if (st !== this.lastNative) { this.lastNative = st; nms('setPlaybackState', { playbackState: st }); } }
    $('#np').classList.toggle('pod', !!(Player.cur && Player.cur.source === 'podcast'));
    const qb = $('#np-qb'); if (qb) { const h = Player.cur ? badgeHTML(Player.cur) : ''; if (qb.dataset.h !== h) { qb.dataset.h = h; qb.innerHTML = h; const x = qInfo(Player.cur); qb.className = 'qbadge t-' + x.tier; } }
    const et = $('#np-eqt'); if (et) { const on = S.settings.eqOn && !IS_IOS && Player.cur && !Player.cur.live; const txt = on ? eqName() : ''; if (et.dataset.t !== txt + (Player.el === Player.fx)) { et.dataset.t = txt + (Player.el === Player.fx); et.innerHTML = on ? `${I.eq}${esc(txt)}` : ''; et.classList.toggle('na', on && Player.el !== Player.fx); et.title = on && Player.el !== Player.fx ? 'Equalizer isn’t available for this song' : 'Equalizer: ' + txt; } }
    const aq = $('#aqbox'); if (aq) { const k = (Player.cur && Player.cur.id) + '|' + Player.quality + '|' + Player.via + '|' + S.settings.eqOn; if (aq.dataset.k !== k) { aq.dataset.k = k; setHTML(aq, aqInner()); } }
  },
  time() {
    const a = Player.el, t = Player.cur; if (!t) return;
    const cur = Player.loaded ? a.currentTime : Player.resumeAt;
    const dur = Player.loaded && isFinite(a.duration) && a.duration ? a.duration : (t.duration || 0);
    if (t.live) { $('#m-prog').style.width = '0'; const mt = $('#m-time'); if (mt) mt.textContent = 'LIVE'; }
    else {
      const p = dur ? clamp(cur / dur, 0, 1) : 0;
      $('#m-prog').style.width = (p * 100) + '%';
      const mt = $('#m-time'); if (mt) mt.textContent = dur ? `${fmt(cur)} / ${fmt(dur)}` : '';
      if (!seeking) {
        const s = $('#np-seek'); s.value = Math.round(p * 1000); s.style.setProperty('--p', (p * 100) + '%');
        $('#np-cur').textContent = fmt(cur); $('#np-rem').textContent = '-' + fmt(Math.max(0, dur - cur));
      }
    }
    if (npOpen) lyrTick(cur);
    if (document.getElementById('drive') && !seeking) {
      const ds = $('#dv-seek'), p = dur ? clamp(cur / dur, 0, 1) : 0;
      if (ds) { ds.value = Math.round(p * 1000); ds.style.setProperty('--p', p * 100 + '%'); $('#dv-cur').textContent = t.live ? 'LIVE' : fmt(cur); $('#dv-rem').textContent = t.live ? '' : '-' + fmt(Math.max(0, dur - cur)); }
    }
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
  deck() {
    const q = Player.queue, i = Player.i, wrap = Player.repeat === 'all' && q.length > 1;
    const pv = i > 0 ? q[i - 1] : wrap ? q[q.length - 1] : null, nx = i < q.length - 1 ? q[i + 1] : wrap ? q[0] : null;
    for (const [id, t] of [['dk-prev', pv], ['dk-next', nx]]) {
      const el = document.getElementById(id); if (!el) continue;
      if (t) { const u = artOf(t, true); if (el.getAttribute('src') !== u) { delete el.dataset.fb; el.src = u; } el.classList.add('show'); el.classList.toggle('logo', !!t.live); el.title = t.title; }
      else el.classList.remove('show');
    }
  },
  ytPill() {
    const b = document.getElementById('yt-pill'); if (!b) return;
    b.innerHTML = Embed.ad ? `${I.expand}Ad playing — press Skip when it appears` : Embed.pinned ? `${I.expand}Back to album art` : `${I.expand}Show video`;
  },
  dlMark() {
    const t = Player.cur, el = $('#np-dl'), mm = $('#m-dl'); const on = t && t.source !== 'local' && (isDl(t.id) || Offline.has(t.id)); const auto = on && !isDl(t.id);
    [el, mm].forEach(x => { if (x) { x.classList.toggle('on', !!on); x.classList.toggle('auto', !!auto); x.title = auto ? 'Saved for offline' : 'Downloaded'; } });
  },
  timerBtn() { $('#np-btimer').classList.toggle('on', !!(Player.sleepAt || Player.sleepEnd)); this.drive(); },
  drive() {
    const t = Player.cur; if (!t || !$('#drive')) return;
    const da = $('#dv-art'); const u = artOf(t, true); if (da.getAttribute('src') !== u) { delete da.dataset.fb; da.src = u; }
    const q = Player.queue, i = Player.i, wrap = Player.repeat === 'all' && q.length > 1;
    const pv = i > 0 ? q[i - 1] : wrap ? q[q.length - 1] : null, nx = i < q.length - 1 ? q[i + 1] : wrap ? q[0] : null;
    [['dv-prev', pv], ['dv-next', nx]].forEach(([id, x]) => { const el = $('#' + id); if (!el) return; if (x) { const v = artOf(x, true); if (el.getAttribute('src') !== v) { delete el.dataset.fb; el.src = v; } el.classList.add('show'); } else el.classList.remove('show'); });
    $('#dv-t').textContent = t.title; $('#dv-a').textContent = t.artist;
    $('#dv-pp').innerHTML = Player.loaded && !Player.el.paused ? I.pause : I.play;
    $('#dv-back').innerHTML = skipIcon(skipSecs(-1), true); $('#dv-fwd').innerHTML = skipIcon(skipSecs(1), false);
    $('#dv-like').innerHTML = isLiked(t.id) ? I.heartFill : I.heart;
    $('#dv-shuf').classList.toggle('on', Player.shuffle); $('#dv-rep').classList.toggle('on', Player.repeat !== 'off'); $('#dv-rep').innerHTML = Player.repeat === 'one' ? I.repeat1 : I.repeat;
    $('#dv-sleep').classList.toggle('on', !!(Player.sleepAt || Player.sleepEnd));
    const n = Player.queue[Player.i + 1]; $('#dv-up').textContent = n ? `Up next · ${n.title} — ${n.artist}` : S.settings.autoplay && !t.live ? 'Up next · Autoplay will pick similar songs' : '';
    $('#drive').classList.toggle('live', !!t.live);
  },
  tapHint(on) {
    $('#np').classList.toggle('needtap', !!on);
    if (on) { openNP(); toast('Tap the video once to start — your browser needs one tap'); }
  },
};
let toastT;
let toastFn = null;
function toast(m, act) {
  const t = $('#toast'); if (!t) return;
  toastFn = act && act.fn ? act.fn : null;
  t.innerHTML = `<span>${esc(m)}</span>${act && act.fn ? `<button class="tact" data-a="toastact">${esc(act.label || 'Undo')}</button>` : ''}`;
  t.classList.toggle('act', !!toastFn); t.classList.add('on'); clearTimeout(toastT);
  toastT = setTimeout(() => { t.classList.remove('on'); toastFn = null; }, act && act.fn ? (act.ms || 5000) : (act && act.ms) || 2400);
}


/* ================= Party Mode: lights, waves, torch & vibration that move with the music ================= */
const PARTY_STYLES = [['disco', 'Disco'], ['waves', 'Waves'], ['lasers', 'Lasers'], ['rings', 'Rings'], ['calm', 'Calm']];
const Party = {
  on: false, raf: 0, tr: null, lastBeat: 0, avg: 0.2, lastTorch: 0, lastBuzz: 0, hue: 0, t0: 0, kick: 0, flash: 0, buf: null, lock: null, dots: null,
  react() { return this.on && !IS_IOS; },
  real() { return !!(Player.an && Player.el === Player.fx && Player.loaded && !Player.el.paused); },
  open() {
    if (this.on || !Player.cur) return; this.on = true; this.t0 = performance.now();
    const st = S.settings; st.partyStyle = st.partyStyle || 'disco';
    const d = document.createElement('div'); d.id = 'party';
    d.innerHTML = `<canvas id="pcv"></canvas><div class="p-glow"></div>
      <div class="p-top"><button class="p-x" data-a="partyx" aria-label="Exit Party Mode">${I.chevDown}</button><span class="p-tag" id="p-tag"></span><button class="p-x" data-a="partyfs" aria-label="Full screen">${I.expand}</button></div>
      <div class="p-mid"><div class="p-disc" id="p-disc"><img id="p-art" alt=""><span class="p-hole"></span></div>
        <div class="p-t" id="p-t"></div><div class="p-a" id="p-a"></div></div>
      <div class="p-ctl"><button data-a="prev" aria-label="Previous">${I.prev}</button><button class="big" data-a="toggle" id="p-pp" aria-label="Play or pause">${I.pause}</button><button data-a="next" aria-label="Next">${I.next}</button></div>
      <div class="p-styles">${PARTY_STYLES.map(([k, l]) => `<button class="pchip ${st.partyStyle === k ? 'on' : ''}" data-a="pstyle" data-s="${k}">${l}</button>`).join('')}</div>
      <div class="p-opts">${!IS_IOS && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && !IS_DESKTOP ? `<button class="popt" data-a="ptorch" id="p-torch">${I.torch}Torch</button>` : ''}${navigator.vibrate || IS_IOS ? `<button class="popt ${S.settings.partyBuzz ? 'on' : ''}" data-a="pbuzz" id="p-buzz">${I.pulse}Vibrate</button>` : ''}</div>`;
    document.body.appendChild(d); requestAnimationFrame(() => d.classList.add('on'));
    this.ui(); this.size(); addEventListener('resize', this.onResize = () => this.size());
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { this.lock = l; }).catch(() => { }); } catch (e) { }
    if (this.react() && Player.loaded && Player.el !== Embed && Player.el !== Player.fx) Player.reroute();
    if (Player.filters.length) Player.applyEq();
    if (!S.partySeen) { S.partySeen = 1; save(); setTimeout(() => toast('Flashing lights — pick “Calm” for gentle colours', { ms: 4500 }), 900); }
    const loop = now => { if (!this.on) return; this.frame(now); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop); buzz();
  },
  close() {
    if (!this.on) return; this.on = false; cancelAnimationFrame(this.raf); this.torchOff();
    removeEventListener('resize', this.onResize); try { this.lock && this.lock.release(); } catch (e) { } this.lock = null;
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { }
    const d = $('#party'); if (d) { d.classList.remove('on'); setTimeout(() => d.remove(), 420); }
    if (Player.filters.length) Player.applyEq();
  },
  ui() {
    const t = Player.cur, d = $('#party'); if (!t || !d) return;
    const a = $('#p-art'), u = artOf(t, true); if (a.getAttribute('src') !== u) { delete a.dataset.fb; a.src = u; }
    $('#p-t').textContent = t.title; $('#p-a').textContent = t.artist;
    $('#p-pp').innerHTML = Player.loaded && !Player.el.paused ? I.pause : I.play;
    $('#p-tag').textContent = IS_IOS || Player.el === Embed ? 'Lights follow the beat' : this.real() ? 'Lights react to the music' : 'Lights follow the beat';
  },
  size() { const c = $('#pcv'); if (!c) return; const r = Math.min(2, devicePixelRatio || 1) * (innerWidth * innerHeight > 1.5e6 ? 0.6 : 0.8); c.width = Math.round(innerWidth * r); c.height = Math.round(innerHeight * r); this.dots = null; },
  levels(now) {
    if (this.real()) {
      const an = Player.an; if (!this.buf || this.buf.length !== an.frequencyBinCount) this.buf = new Uint8Array(an.frequencyBinCount);
      an.getByteFrequencyData(this.buf); const b = this.buf, avg = (a, z) => { let s2 = 0; for (let i = a; i < z; i++) s2 += b[i]; return s2 / (z - a) / 255; };
      return { bass: avg(1, 7), mid: avg(7, 60), high: avg(60, 200), spec: b, real: true };
    }
    const playing = Player.loaded && !Player.el.paused, t = (now - this.t0) / 1000, bpm = 118, ph = (t * bpm / 60) % 1;
    if (!playing) return { bass: 0.08, mid: 0.1 + 0.05 * Math.sin(t), high: 0.06, real: false };
    const kick = Math.pow(Math.max(0, Math.cos(ph * Math.PI * 2)), 8);
    return { bass: 0.15 + kick * 0.8, mid: 0.35 + 0.2 * Math.sin(t * 2.1) + 0.1 * Math.sin(t * 5.3), high: 0.25 + 0.2 * Math.abs(Math.sin(t * 7.7)), real: false };
  },
  beat(now) {
    this.kick = 1;
    const calm = S.settings.partyStyle === 'calm';
    if (!calm) this.flash = Math.min(0.16, this.flash + 0.12);
    if (this.tr && !calm && !document.hidden && now - this.lastTorch > 500) {
      if (Date.now() - this.torchAt > 5 * 60e3) { this.torchOff(); toast('Torch switched off after 5 minutes to keep your phone cool'); }
      else { this.lastTorch = now; const tr = this.tr; const bad = () => { this.torchErr = (this.torchErr || 0) + 1; if (this.torchErr >= 2) { this.torchOff(); toast('Torch stopped — this phone didn’t respond reliably'); } };
        tr.applyConstraints({ advanced: [{ torch: true }] }).catch(bad); setTimeout(() => { if (this.tr === tr) tr.applyConstraints({ advanced: [{ torch: false }] }).catch(bad); }, 80); }
    }
    if (S.settings.partyBuzz && now - this.lastBuzz > 300) { this.lastBuzz = now; Haptic.tap(calm ? 12 : 28); }
  },
  frame(now) {
    if (document.hidden) return;
    const L = this.levels(now), t = (now - this.t0) / 1000, style = S.settings.partyStyle || 'disco', calm = style === 'calm';
    this.avg = this.avg * 0.93 + L.bass * 0.07;
    if (L.bass > this.avg * 1.28 && L.bass > 0.32 && now - this.lastBeat > 290) { this.lastBeat = now; this.beat(now); }
    this.kick *= 0.88; this.flash *= 0.85; this.hue = (this.hue + (calm ? 0.15 : 0.35 + L.bass * 1.6)) % 360;
    const disc0 = document.getElementById('p-disc'); if (disc0) disc0.style.setProperty('--k', String((1 + this.kick * (calm ? 0.02 : 0.07) + L.bass * 0.03).toFixed(3)));
    const c = $('#pcv'); if (!c) return; const g = c.getContext && c.getContext('2d'); if (!g) return;
    const W = c.width, H = c.height;
    const hsl = (h, sat, l, a) => `hsla(${(h % 360 + 360) % 360},${sat}%,${l}%,${a})`;
    g.globalCompositeOperation = 'source-over';
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, hsl(this.hue + 220, 60, 6 + L.bass * 6, 1)); bg.addColorStop(1, hsl(this.hue + 300, 70, 4 + L.mid * 6, 1));
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    let cx = W / 2, cy = H * 0.42; const R = Math.min(W, H);
    const dk = document.getElementById('p-disc'); if (dk) { const r = dk.getBoundingClientRect(), k = W / innerWidth; cx = (r.left + r.width / 2) * k; cy = (r.top + r.height / 2) * k; this.discR = r.width / 2 * k; }
    if (style === 'disco' || calm) {
      const n = calm ? 4 : 6;
      for (let i = 0; i < n; i++) {
        const a = t * (calm ? 0.12 : 0.45) + i * (Math.PI * 2 / n), x = cx + Math.cos(a) * W * 0.36, y = cy + Math.sin(a * 1.3) * H * 0.3;
        const r = R * (calm ? 0.55 : 0.32 + L.bass * 0.25), gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, hsl(this.hue + i * (360 / n), 95, 60, calm ? 0.28 : 0.38 + L.mid * 0.3)); gr.addColorStop(1, hsl(this.hue + i * 60, 90, 50, 0));
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      if (!calm) {
        if (!this.dots) this.dots = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random(), p: Math.random() * 6 }));
        for (const d2 of this.dots) {
          const x = ((d2.x + t * 0.03 * d2.s) % 1) * W, y = d2.y * H, tw = 0.5 + 0.5 * Math.sin(t * 6 * d2.s + d2.p);
          g.fillStyle = hsl(this.hue + d2.p * 40, 100, 80, 0.15 + tw * L.high * 0.9); g.beginPath(); g.arc(x, y, R * 0.006 * (1 + d2.s), 0, Math.PI * 2); g.fill();
        }
      }
    } else if (style === 'waves') {
      for (let k = 0; k < 6; k++) {
        g.beginPath(); const amp = H * (0.04 + L.mid * 0.16) * (1 - k * 0.1), base = H * (0.25 + k * 0.11);
        for (let x = 0; x <= W; x += 6) { const y = base + Math.sin(x / W * Math.PI * (2 + k * 0.6) + t * (1.2 + k * 0.3)) * amp + Math.sin(x / W * 13 + t * 3) * amp * L.high * 0.4; x ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.strokeStyle = hsl(this.hue + k * 40, 95, 60, 0.35 + L.bass * 0.4); g.lineWidth = R * (0.004 + L.bass * 0.01); g.stroke();
      }
    } else if (style === 'lasers') {
      const n = 10, ox = [W * 0.1, W * 0.9], sweep = Math.sin(t * 0.9) * 0.6;
      for (const o of ox) for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i - n / 2) * 0.09 + sweep * (o < cx ? 1 : -1);
        g.strokeStyle = hsl(this.hue + i * 18 + (o < cx ? 0 : 160), 100, 60, 0.12 + L.high * 0.55); g.lineWidth = R * 0.004;
        g.beginPath(); g.moveTo(o, H); g.lineTo(o + Math.cos(a) * H * 1.4, H + Math.sin(a) * H * 1.4); g.stroke();
      }
    } else if (style === 'rings') {
      const spec = L.spec, N = 72, base = (this.discR || R * 0.2) * 1.12;
      for (let i = 0; i < N; i++) {
        const v = spec ? spec[2 + Math.floor(i * 1.6)] / 255 : (0.3 + 0.7 * Math.abs(Math.sin(t * 3 + i * 0.4))) * (0.4 + L.bass * 0.6);
        const a = (i / N) * Math.PI * 2 + t * 0.2, r1 = base + R * 0.02, r2 = r1 + R * (0.02 + v * 0.18);
        g.strokeStyle = hsl(this.hue + i * 5, 95, 62, 0.75); g.lineWidth = R * 0.008;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); g.stroke();
      }
      for (let k = 1; k <= 3; k++) { g.strokeStyle = hsl(this.hue + k * 90, 90, 60, 0.18 * (1 - this.kick * 0.5)); g.lineWidth = R * 0.003; g.beginPath(); g.arc(cx, cy, base * (1 + k * 0.5 + this.kick * 0.15 * k), 0, Math.PI * 2); g.stroke(); }
    }
    if (this.flash > 0.01) { g.globalCompositeOperation = 'source-over'; g.fillStyle = hsl(this.hue + 180, 100, 85, this.flash); g.fillRect(0, 0, W, H); }
    const gl = document.querySelector('#party .p-glow'); if (gl) { gl.style.setProperty('--h', String(Math.round(this.hue))); gl.style.setProperty('--gx', (cx / W * 100).toFixed(1) + '%'); gl.style.setProperty('--gy', (cy / H * 100).toFixed(1) + '%'); }
  },
  async torch() {
    if (this.tr) { this.torchOff(); toast('Torch off'); return; }
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      const tr = st.getVideoTracks()[0]; const cap = tr && tr.getCapabilities ? tr.getCapabilities() : {};
      if (!cap.torch) { st.getTracks().forEach(x => x.stop()); return toast('This browser can’t control the torch on this device'); }
      this.tr = tr; this.torchAt = Date.now(); this.torchErr = 0; const b = $('#p-torch'); if (b) b.classList.add('on'); toast('Torch flashes with the beat (switches off by itself after 5 minutes)');
    } catch (e) { toast('Allow camera access to flash the torch (only the light is used)'); }
  },
  torchOff() { if (this.tr) { try { this.tr.applyConstraints({ advanced: [{ torch: false }] }).catch(() => { }); } catch (e) { } try { this.tr.applyConstraints({ advanced: [{ torch: false }] }).catch(() => { }); this.tr.stop(); } catch (e) { } } this.tr = null; const b = $('#p-torch'); if (b) b.classList.remove('on'); },
};

/* ================= shell & now playing ================= */
const CAN_AIRPLAY = !!window.WebKitPlaybackTargetAvailabilityEvent;
const CAN_CAST = !CAN_AIRPLAY && typeof HTMLMediaElement !== 'undefined' && 'remote' in HTMLMediaElement.prototype && !IS_DESKTOP;
const TABS = [['home', 'Home', 'home'], ['explore', 'Explore', 'explore'], ['search', 'Search', 'search'], ['podcasts', 'Podcasts', 'mic'], ['library', 'Library', 'library']];
function splash() {
  if (!S.settings.motion || document.getElementById('splash')) return;
  const d = document.createElement('div'); d.id = 'splash';
  const nm = (S.settings.name || '').trim();
  d.innerHTML = `<div class="sp-in"><div class="sp-logo"><span class="sp-ring"></span><span class="sp-ring r2"></span><span class="sp-ring r3"></span><img src="icons/icon-192.png" alt=""></div>
    <div class="sp-bars" aria-hidden="true">${'<i></i>'.repeat(7)}</div>
    <b class="sp-word">${[...TITLE].map((c, i) => `<span style="--i:${i}">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('')}</b>
    <small class="sp-tag">${nm ? `Welcome back, ${esc(nm)}` : TAGLINE}</small></div>`;
  document.body.appendChild(d);
  setTimeout(() => d.classList.add('out'), 950); setTimeout(() => d.remove(), 1500);
}
function buildShell() {
  $('#tabs').innerHTML = `<div class="brand"><img src="icons/icon-192.png" alt="">${TITLE}</div>` +
    TABS.map(([k, l, ic]) => `<button class="tab" data-tab="${k}">${I[ic]}<span>${l}</span></button>`).join('') +
    `<button class="tab tset" data-a="go" data-v="settings">${I.gear}<span>Settings</span></button>`;
  $('#mini').innerHTML = `<span class="m-aw"><img class="m-art" id="m-art" alt=""><span class="m-ring"></span></span><div class="m-txt"><div class="m-t" id="m-t">Not Playing</div><span class="dlbadge" id="m-dl">${I.dlok}</span><div class="m-s" id="m-s"></div></div>
    <span class="m-time" id="m-time"></span>
    <button class="ib m-prev" data-a="prev" aria-label="Previous">${I.prev}</button>
    <button class="ib" id="m-pp" data-a="toggle" aria-label="Play">${I.play}</button>
    <button class="ib" data-a="next" aria-label="Next">${I.next}</button><div class="m-prog" id="m-prog"></div>`;
  const v0 = Math.round((S.settings.volume == null ? 1 : S.settings.volume) * 100);
  $('#np').innerHTML = `<div class="np-bg" id="np-bg"></div><div class="np-bg np-bg2" id="np-bg2"></div><div class="np-shade"></div>
  <div class="np-in">
    <div class="np-top"><span class="grab"></span>
      <button class="np-ib" data-a="npclose" aria-label="Close Now Playing">${I.chevDown}</button>
      <div class="np-from"><span>Playing from</span><b id="np-from"></b></div>
      <button class="np-ib" data-a="npmore" aria-label="More options">${I.more}</button></div>
    <div class="np-stage">
      <div class="np-art" id="np-deck"><img class="dk dk-prev" id="dk-prev" alt="Previous" data-a="deckprev"><img id="np-img" alt=""><img class="dk dk-next" id="dk-next" alt="Next" data-a="decknext"><div class="burst" aria-hidden="true">${I.heartFill}</div><div id="ytbox"><div id="ytp"></div></div><button class="yt-pill" id="yt-pill" data-a="ytfull">${I.expand}Show video</button><p class="np-tap">Tap the video to start playing</p></div>
      <div class="ly-bar" id="ly-tools"></div><div class="np-panel" id="np-lyr"></div>
      <div class="np-panel" id="np-q"></div>
    </div>
    <div class="np-meta"><div class="np-tt"><div class="np-t" id="np-t"></div><span class="dlbadge" id="np-dl">${I.dlok}</span><div class="np-a" id="np-a" data-a="npartist"></div></div>
      <button class="np-ib" id="np-party" data-a="party" aria-label="Party Mode">${I.disco}</button><button class="np-ib" id="np-share" data-a="npshare" aria-label="Share">${I.share}</button><button class="np-ib" id="np-like" data-a="nplike" aria-label="Favorite">${I.heart}</button></div>
    <div class="scrub"><input class="rng" id="np-seek" type="range" min="0" max="1000" step="1" value="0" aria-label="Seek">
      <div class="times"><span id="np-cur">0:00</span><span class="livepill">● LIVE</span><span class="qbadge" id="np-qb" data-a="aq" role="button" tabindex="0" aria-label="Audio quality"></span><button class="eqtag" id="np-eqt" data-a="eq" aria-label="Equalizer"></button><span id="np-rem">-0:00</span></div></div>
    <div class="ctrl">
      <button class="np-ib c-s" id="np-shuf" data-a="shuffle" aria-label="Shuffle">${I.shuffle}</button>
      <button class="np-ib c-k" data-a="skipb" aria-label="Skip back">${skipIcon(S.settings.podBack || 15, true)}</button>
      <button class="np-ib c-m" data-a="prev" aria-label="Previous">${I.prev}</button>
      <button class="np-ib c-p" id="np-pp" data-a="toggle" aria-label="Play">${I.play}</button>
      <button class="np-ib c-m" data-a="next" aria-label="Next">${I.next}</button>
      <button class="np-ib c-k" data-a="skipf" aria-label="Skip forward">${skipIcon(S.settings.podFwd || 30, false)}</button>
      <button class="np-ib c-s" id="np-rep" data-a="repeat" aria-label="Repeat">${I.repeat}</button></div>
    ${IS_IOS ? '' : `<div class="vol">${I.volLow}<input class="rng" id="np-vol" type="range" min="0" max="100" value="${v0}" style="--p:${v0}%" aria-label="Volume">${I.volHigh}</div>`}
    <div class="np-bot">
      <button class="np-ib" id="np-blyr" data-a="panel" data-p="lyr" aria-label="Lyrics">${I.lyrics}</button>
      <button class="np-ib" data-a="eq" aria-label="Equalizer">${I.eq}</button>
      <button class="np-ib" id="np-btimer" data-a="sleep" aria-label="Sleep timer">${I.timer}</button>
      ${CAN_AIRPLAY || CAN_CAST ? `<button class="np-ib" data-a="cast" aria-label="${CAN_AIRPLAY ? 'AirPlay' : 'Cast'}">${CAN_AIRPLAY ? I.airplay : I.cast}</button>` : ''}
      <button class="np-ib" id="np-bq" data-a="panel" data-p="q" aria-label="Queue">${I.queue}</button></div>
  </div>`;
}
function openNP() {
  if (!Player.cur || npOpen) return;
  npOpen = true; $('#np').classList.add('open'); document.body.classList.add('np-open'); history.pushState({ np: 1 }, '');
  UI.time(); panelRefresh();
}
function closeNP(fromPop) {
  if (!npOpen) return;
  npOpen = false; $('#np').classList.remove('open'); document.body.classList.remove('np-open');
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
const qRefresh = () => { UI.deck(); if (npOpen && npPanel === 'q') renderQueue(); if ($('#drive')) UI.drive(); };
const npMsg = (ic, title, d) => `<div class="np-msg">${I[ic]}<b>${esc(title)}</b><p>${esc(d)}</p></div>`;

let lyrState = null, lyrIdx = -1, lyrHold = 0;
const INDIC = [[0x0900, 'hi', 'Hindi'], [0x0980, 'bn', 'Bengali'], [0x0A00, 'pa', 'Punjabi'], [0x0A80, 'gu', 'Gujarati'], [0x0B00, 'or', 'Odia'], [0x0B80, 'ta', 'Tamil'], [0x0C00, 'te', 'Telugu'], [0x0C80, 'kn', 'Kannada'], [0x0D00, 'ml', 'Malayalam']];
function lyrScript(txt) {
  const c = {}; for (const ch of String(txt || '')) { const cp = ch.codePointAt(0); if (cp >= 0x0900 && cp < 0x0D80) { const b = cp & 0xFF80; c[b] = (c[b] || 0) + 1; } }
  const best = Object.entries(c).sort((x, y) => y[1] - x[1])[0]; if (!best || best[1] < 6) return null;
  return INDIC.find(x => x[0] === +best[0]) || null;
}
const TL_V = { 5: 'a', 6: 'aa', 7: 'i', 8: 'ee', 9: 'u', 10: 'oo', 11: 'ru', 14: 'e', 15: 'e', 16: 'ai', 18: 'o', 19: 'o', 20: 'au' };
const TL_M = { 0x3E: 'aa', 0x3F: 'i', 0x40: 'ee', 0x41: 'u', 0x42: 'oo', 0x43: 'ru', 0x46: 'e', 0x47: 'e', 0x48: 'ai', 0x4A: 'o', 0x4B: 'o', 0x4C: 'au', 0x57: 'au' };
const TL_C = { 0x15: 'k', 0x16: 'kh', 0x17: 'g', 0x18: 'gh', 0x19: 'ng', 0x1A: 'ch', 0x1B: 'chh', 0x1C: 'j', 0x1D: 'jh', 0x1E: 'nj', 0x1F: 't', 0x20: 'th', 0x21: 'd', 0x22: 'dh', 0x23: 'n',
  0x24: 't', 0x25: 'th', 0x26: 'd', 0x27: 'dh', 0x28: 'n', 0x29: 'n', 0x2A: 'p', 0x2B: 'ph', 0x2C: 'b', 0x2D: 'bh', 0x2E: 'm', 0x2F: 'y', 0x30: 'r', 0x31: 'r', 0x32: 'l', 0x33: 'l', 0x34: 'zh', 0x35: 'v', 0x36: 'sh', 0x37: 'sh', 0x38: 's', 0x39: 'h' };
const TL_TAMIL = { 0x15: 'k', 0x1A: 's', 0x1F: 't', 0x24: 'th', 0x2A: 'p', 0x31: 'r', 0x1E: 'nj' };
function translit(str) {
  const out = []; const a = [...String(str || '')];
  for (let i = 0; i < a.length; i++) {
    const cp = a[i].codePointAt(0);
    if (cp < 0x0900 || cp >= 0x0D80) { out.push(a[i]); continue; }
    const base = cp & 0xFF80, o = cp - base, tamil = base === 0x0B80, deva = base === 0x0900;
    if (TL_V[o]) { out.push(TL_V[o]); continue; }
    if (o === 0x02) { out.push(tamil ? 'm' : 'n'); continue; } if (o === 0x03) { out.push(tamil ? 'k' : 'h'); continue; } if (o === 0x01) { out.push('n'); continue; }
    if (o >= 0x66 && o <= 0x6F) { out.push(String(o - 0x66)); continue; }
    if (o === 0x64 || o === 0x65) { out.push(o === 0x64 ? ',' : '.'); continue; }
    let c = (tamil && TL_TAMIL[o]) || TL_C[o];
    if (c) {
      let j = i + 1; if (a[j] && (a[j].codePointAt(0) - base) === 0x3C) j++;
      const nx = a[j] ? a[j].codePointAt(0) - base : -1, inBlock = a[j] && (a[j].codePointAt(0) & 0xFF80) === base;
      if (inBlock && nx === 0x4D) { out.push(c); i = j; continue; }
      if (inBlock && TL_M[nx]) { out.push(c + TL_M[nx]); i = j; if (a[i + 1] && (a[i + 1].codePointAt(0) - base) === 0x57) i++; continue; }
      const end = !a[j] || !/[\u0900-\u0D7F]/.test(a[j]);
      out.push(c + (deva && end && i > 0 ? '' : 'a')); i = j - 1; continue;
    }
  }
  return out.join('').replace(/\s+/g, ' ');
}
async function translateLines(lines, from) {
  const uniqL = [...new Set(lines.filter(x => x && x.trim()))]; const map = new Map(); const chunks = []; let cur = [];
  for (const l of uniqL) { if ((cur.join('\n') + '\n' + l).length > 420 && cur.length) { chunks.push(cur); cur = []; } cur.push(l); }
  if (cur.length) chunks.push(cur);
  for (const ch of chunks) {
    const j = await getJSON('https://api.mymemory.translated.net/get?' + new URLSearchParams({ q: ch.join('\n'), langpair: `${from}|en` }), 12000);
    const txt = j && j.responseData && j.responseData.translatedText; if (!txt || j.responseStatus >= 400 || /MYMEMORY WARNING|QUERY LENGTH/i.test(txt)) throw new Error('translation limit');
    const parts = txt.split(/\n/); if (parts.length === ch.length) ch.forEach((l, k) => map.set(l, decodeEnt(parts[k]).trim())); else map.set(ch.join('\n'), decodeEnt(txt));
  }
  return lines.map(l => map.get(l) || '');
}
function lyrBar(r) {
  const sc = lyrScript((r.synced || []).map(x => x.text).join(' ') || r.plain || ''); const m = S.settings.lyrMode || 'orig';
  const b = (k, label, ic) => `<button class="lyb ${m === k ? 'on' : ''}" data-a="lyrmode" data-m="${k}">${ic ? I[ic] : ''}${label}</button>`;
  return `<div class="ly-bar"><button class="lyb lyc" data-a="copylyr" aria-label="Copy lyrics">${I.copy}<span>Copy</span></button>${sc ? `<div class="lyseg" role="tablist">${b('orig', sc[2]) + b('latin', 'Aa English') + b('en', 'Translate', 'translate')}</div>` : ''}</div>`;
}
function lyrLine(r, k, text) {
  const m = S.settings.lyrMode || 'orig'; if (!text) return '♪';
  if (m === 'latin' && lyrScript(r.synced ? r.synced.map(x => x.text).join(' ') : r.plain)) return esc(translit(text));
  if (m === 'en' && r.tr && r.tr[k]) return `${esc(text)}<small class="ly-tr">${esc(r.tr[k])}</small>`;
  return esc(text);
}
function renderLyrics() {
  const box = $('#np-lyr'), r = lyrState; if (!box || !r) return;
  if (r.synced && r.synced.length) {
    $('#ly-tools').innerHTML = lyrBar(r).replace(/^<div class="ly-bar">|<\/div>$/g, '');
    box.innerHTML = `<div>${r.synced.map((l, k) => `<p class="ly" data-a="lyseek" data-t="${l.t}">${lyrLine(r, k, l.text)}</p>`).join('')}<p class="ly-src">Lyrics from LRCLIB${(S.settings.lyrMode === 'en' && r.tr) ? ' · translation by MyMemory' : ''}</p></div>`;
    lyrIdx = -1; lyrTick(Player.loaded ? Player.el.currentTime : 0, true);
  } else if (r.plain) {
    const L = r.plain.split('\n');
    $('#ly-tools').innerHTML = lyrBar(r).replace(/^<div class="ly-bar">|<\/div>$/g, '');
    box.innerHTML = `<div class="ly-plain">${L.map((l, k) => lyrLine(r, k, l) === '♪' ? '' : lyrLine(r, k, l)).join('\n')}</div><p class="ly-src">Lyrics from LRCLIB</p>`;
  }
}
async function loadLyrics() {
  const box = $('#np-lyr'); const t = Player.cur;
  if (!t) { box.innerHTML = ''; return; }
  if (lyrState && lyrState.id === t.id) return;
  lyrState = { id: t.id }; lyrIdx = -1; const tools = $('#ly-tools'); if (tools) tools.innerHTML = '';
  if (t.live) { box.innerHTML = npMsg('radio', 'Live radio', 'Lyrics aren’t available for live stations.'); return; }
  if (t.source === 'podcast') { if (t.desc && tools) tools.innerHTML = `<button class="lyb" data-a="copylyr">${I.copy}Copy notes</button>`; box.innerHTML = `<div class="ly-notes"><b>${esc(t.title)}</b><p>${esc([t.artist, fmtDate(t.date)].filter(Boolean).join(' · '))}</p><div class="ly-plain">${esc(t.desc || 'No episode notes for this one.')}</div>${t.desc ? `<p class="ly-src"><button class="ly-copy" data-a="copylyr">${I.copy}Copy notes</button></p>` : ''}</div>`; box.scrollTop = 0; return; }
  box.innerHTML = '<div class="np-msg"><div class="spin light"></div></div>';
  let r = null; try { r = await Lyrics.get(t); } catch (e) { }
  if (!Player.cur || Player.cur.id !== t.id) return;
  lyrState = { id: t.id, ...(r || {}) };
  if (r && ((r.synced && r.synced.length) || r.plain)) {
    renderLyrics(); if (!r.synced) box.scrollTop = 0;
    if (S.settings.lyrMode === 'en') lyrTranslate();
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
  const pOff = Math.max(0, Player.i - 50), prev = Player.queue.slice(pOff, Player.i);
  const keepTop = box.dataset.cur === c.id ? box.scrollTop : null;
  box.innerHTML = `${prev.length ? `<div class="q-h qprev-h"><div><b>Previously Played</b><small>${plural(prev.length, 'song')} · tap one to play it again</small></div></div>
    <div id="qprev">${prev.map((t, k) => { const qi = pOff + k; return `<div class="qrow qprev" data-a="qjump" data-q="${qi}" role="button" tabindex="0"><img src="${esc(artOf(t))}" alt="" class="${t.live ? 'logo' : ''}" loading="lazy">
      <div class="qt"><div>${esc(t.title)}</div><div class="s">${esc(t.artist)}</div></div></div>`; }).join('')}</div>` : ''}
    <div class="qchips">
      <button class="qchip ${Player.shuffle ? 'on' : ''}" data-a="shuffle">${I.shuffle}Shuffle</button>
      <button class="qchip ${Player.repeat !== 'off' ? 'on' : ''}" data-a="repeat">${Player.repeat === 'one' ? I.repeat1 : I.repeat}Repeat</button>
      <button class="qchip ${S.settings.autoplay ? 'on' : ''}" data-a="autoplay">${I.infinity}Autoplay</button></div>
    <div class="q-h"><div><b>Now Playing</b></div></div>
    <div class="qrow qcur"><span class="qart"><img src="${esc(artOf(c))}" alt="" class="${c.live ? 'logo' : ''}"><span class="eqbars ${Player.loaded && !Player.el.paused ? '' : 'paused'}"><i></i><i></i><i></i></span></span>
      <div class="qt"><div>${esc(c.title)}</div><div class="s">${esc(c.artist)}</div></div></div>
    <div class="q-h"><div><b>Playing Next</b><small>${up.length ? plural(up.length, 'song') : 'Nothing queued'}${Player.from ? ' from ' + esc(Player.from) : ''}</small></div>${up.length ? '<div class="qbtns"><button data-a="qsave">Save</button><button data-a="qclear">Clear</button></div>' : ''}</div>
    <div id="qlist">${up.map((t, k) => {
      const qi = Player.i + 1 + k;
      return `<div class="qrow qnext" data-q="${qi}"><img src="${esc(artOf(t))}" alt="" class="${t.live ? 'logo' : ''}" loading="lazy">
        <div class="qt" data-a="qjump" data-q="${qi}"><div>${esc(t.title)}</div><div class="s">${esc(t.artist)}</div></div>
        <button class="np-ib qx" data-a="qrm" data-q="${qi}" aria-label="Remove from queue">${I.minus}</button>
        <span class="qh" aria-label="Drag to reorder">${I.grip}</span></div>`;
    }).join('')}</div>
    ${!up.length && S.settings.autoplay && !c.live ? '<p class="qnote">Autoplay keeps going with similar songs when this one ends.</p>' : ''}`;
  revealImgs();
  if (keepTop !== null) box.scrollTop = keepTop;
  else {
    box.dataset.cur = c.id; const pr = box.querySelectorAll('.qprev'); const peek = pr.length ? pr[Math.max(0, pr.length - 2)] : null; const ch = box.querySelector('.qchips');
    const go = () => { const tgt = peek || ch; if (tgt) box.scrollTop = Math.max(0, tgt.offsetTop - (peek ? 34 : 6)); };
    go(); (window.requestAnimationFrame || (f => setTimeout(f, 16)))(go);
  }
}
let qd = null;
document.addEventListener('touchmove', e => { if (qd) e.preventDefault(); }, { passive: false });
document.addEventListener('pointerdown', e => {
  const h = e.target.closest && e.target.closest('.qh'); if (!h) return;
  const row = h.closest('.qrow'); if (!row) return; e.preventDefault(); qStart(row, e, h);
});
function qStart(row, e, capEl) {
  const list = $('#qlist'); if (!row || !list || qd) return;
  const rows = $$('#qlist .qrow'), idx = rows.indexOf(row);
  const step = rows.length > 1 ? Math.abs(rows[1].offsetTop - rows[0].offsetTop) || row.offsetHeight : row.offsetHeight;
  const sc = $('#np-q');
  qd = { row, rows, idx, to: idx, y0: e.clientY, y: e.clientY, id: e.pointerId, step, sc, st0: sc ? sc.scrollTop : 0 };
  row.classList.add('drag'); list.classList.add('dragging'); buzz();
  try { capEl.setPointerCapture(e.pointerId); } catch (err) { }
  const tick = () => {
    if (!qd) return;
    const b = qd.sc && qd.sc.getBoundingClientRect();
    if (b) { if (qd.y < b.top + 70) qd.sc.scrollTop -= 9; else if (qd.y > b.bottom - 70) qd.sc.scrollTop += 9; }
    qDragAt(qd.y); qd.raf = requestAnimationFrame(tick);
  };
  qd.raf = (window.requestAnimationFrame || (f => setTimeout(f, 16)))(tick);
}
function qDragAt(y) {
  if (!qd) return;
  const dy = y - qd.y0 + ((qd.sc ? qd.sc.scrollTop : 0) - qd.st0);
  qd.row.style.transform = `translateY(${dy}px) scale(1.02)`;
  const to = clamp(qd.idx + Math.round(dy / qd.step), 0, qd.rows.length - 1);
  if (to === qd.to) return; qd.to = to; buzz();
  qd.rows.forEach((r, k) => {
    if (r === qd.row) return; let sh = 0;
    if (qd.idx < to && k > qd.idx && k <= to) sh = -qd.step; else if (qd.idx > to && k >= to && k < qd.idx) sh = qd.step;
    r.style.transform = sh ? `translateY(${sh}px)` : '';
  });
}
document.addEventListener('pointermove', e => { if (qd && e.pointerId === qd.id) { qd.y = e.clientY; qDragAt(e.clientY); } });
function endDrag(e, cancel) {
  if (!qd || e.pointerId !== qd.id) return;
  const { idx, to, row, step } = qd; (window.cancelAnimationFrame || clearTimeout)(qd.raf); qd = null;
  const fin = !cancel ? to : idx;
  row.style.transition = 'transform .22s cubic-bezier(.2,.9,.25,1), box-shadow .22s'; row.style.transform = `translateY(${(fin - idx) * step}px)`; row.classList.add('settle');
  if (!cancel && to !== idx) {
    const up = Player.queue.slice(Player.i + 1); const t = up.splice(idx, 1)[0];
    if (t) { up.splice(to, 0, t); Player.queue = Player.queue.slice(0, Player.i + 1).concat(up); UI.deck(); buzz(); }
  }
  setTimeout(renderQueue, 230);
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
  if (needName && !String(S.settings.name || '').trim()) setTimeout(() => { if (!sheetOpen && !String(S.settings.name || '').trim()) nameSheet(true); }, 450);
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
const canDownload = t => ['audius', 'yt', 'deezer', 'podcast', 'saavn'].includes(t.source);
function trackMenu(t, meta = {}) {
  const liked = isLiked(t.id), dl = isDl(t.id), q = enc(`${t.title} ${t.artist}`);
  actionSheet({
    head: trackHead(t),
    acts: [
      !meta.np && { label: 'Play Next', icon: 'playNext', fn: () => Player.playNext(t) },
      !meta.np && { label: 'Add to Queue', icon: 'queue', fn: () => Player.enqueue(t) },
      !t.live && t.source !== 'local' && t.source !== 'podcast' && { label: 'Start Radio', icon: 'infinity', fn: () => startRadio(t) },
      t.source === 'podcast' && t.podId && { label: 'Go to Show', icon: 'mic', fn: () => { const open = () => go('coll', { k: 'pod', c: { kind: 'podcast', id: t.podId, title: t.artist, art: t.artLarge || t.art, source: 'pod' }, title: t.artist }); if (npOpen) { closeNP(); setTimeout(open, 380); } else open(); } },
      t.source === 'podcast' && { label: (podProg(t.id) || {}).done ? 'Mark as Unplayed' : 'Mark as Played', icon: 'check', fn: () => { const pp = podProg(t.id); if (pp && pp.done) delete S.pod.prog[t.id]; else podSave(t, t.duration, t.duration, true); save(); softRender(); } },
      { label: liked ? (t.live ? 'Remove Station' : 'Remove from Favorites') : (t.live ? 'Save Station' : 'Favorite'), icon: liked ? 'heartFill' : 'heart', fn: () => toggleLike(t) },
      !t.live && { label: 'Add to Playlist…', icon: 'playlist', fn: () => pickPlaylist(t) },
      canDownload(t) && !dl && { label: 'Download', icon: 'download', fn: () => download(t) },
      (dl || t.source === 'local') && { label: 'Save to Device', icon: 'save', fn: () => saveToDevice(t) },
      canDownload(t) && dl && { label: 'Remove Download', icon: 'trash', danger: true, fn: () => removeDownload(t) },
      t.source === 'local' && { label: 'Remove from This Device', icon: 'trash', danger: true, fn: () => confirmSheet('Remove this song?', 'It will be deleted from Tune Tune on this device.', 'Remove', () => removeLocal(t)) },
      meta.pl && meta.idx > 0 && { label: 'Move to Top', icon: 'chevUp', fn: () => moveInPlaylist(meta.pl, t, 0) },
      meta.pl && { label: 'Remove from Playlist', icon: 'minus', danger: true, fn: () => removeFromPlaylist(meta.pl, t) },
      (meta.hist || S.history.some(x => x.id === t.id) && meta.hist !== false) && { label: 'Remove from Recently Played', icon: 'clock', danger: true, fn: () => removeHistory(t) },
      t.source === 'podcast' && (podProg(t.id) && !podProg(t.id).done) && { label: 'Remove from Continue Listening', icon: 'x', fn: () => { delete S.pod.prog[t.id]; save(); softRender(); toast('Removed'); } },
      t.uid && ['yt', 'audius', 'saavn'].includes(t.source) && { label: 'Go to Artist', icon: 'user', fn: () => goArtist(t) },
      t.source === 'saavn' && t.albumId && { label: 'Go to Album', icon: 'music', fn: () => { const open = () => go('coll', { k: 'yt', c: { kind: 'album', id: t.albumId, title: t.album, art: t.artLarge, source: 'saavn' }, title: t.album }); if (npOpen) { closeNP(); setTimeout(open, 380); } else open(); } },
      meta.np && !t.live && { label: 'Playback Speed', icon: 'speed', fn: speedMenu },
      meta.np && { label: 'Party Mode — lights & DJ effects', icon: 'disco', fn: () => Actions.party() },
      meta.np && { label: 'Driving Mode', icon: 'car', fn: openDrive },
      meta.np && lyrState && lyrState.id === t.id && (lyrState.plain || (lyrState.synced && lyrState.synced.length)) && { label: 'Copy Lyrics', icon: 'lyrics', fn: copyLyrics },
      { label: 'Song Info', icon: 'info', fn: () => songInfo(t) },
      meta.np && { label: 'Audio Quality', icon: 'wave', fn: openAQ },
      meta.np && { label: S.settings.badge ? 'Hide Quality Badge' : 'Show Quality Badge', icon: 'eye', fn: () => { S.settings.badge = !S.settings.badge; save(); applyTheme(); toast(S.settings.badge ? 'Quality badge shown' : 'Quality badge hidden'); } },
      { label: 'Copy Song & Artist', icon: 'copy', fn: () => copyText(`${t.title} — ${t.artist}`, 'Copied') },
      !t.live && !['local', 'podcast'].includes(t.source) && { label: 'Don’t Recommend This', icon: 'ban', fn: () => blockTrack(t) },
      !t.live && !['local', 'podcast'].includes(t.source) && { label: t.source === 'yt' ? 'Open in YouTube Music' : 'Find on YouTube Music', icon: 'ext', fn: () => window.open(t.source === 'yt' ? `https://music.youtube.com/watch?v=${t.sid}` : 'https://music.youtube.com/search?q=' + q, '_blank', 'noopener') },
      !t.live && !['local', 'podcast'].includes(t.source) && { label: 'Find on Spotify', icon: 'ext', fn: () => window.open('https://open.spotify.com/search/' + q, '_blank', 'noopener') },
      t.live && t.home && { label: 'Station Website', icon: 'ext', fn: () => window.open(t.home, '_blank', 'noopener') },
      { label: 'Share', icon: 'share', fn: () => share(t) },
    ],
  });
}
function askYouTube(t) {
  actionSheet({
    head: textHead('No clean audio for this song', `“${t.title}” isn’t available on JioSaavn right now. You can play it with YouTube’s player (it may show ads and pauses when the screen locks).`),
    acts: [
      { label: 'Play with YouTube’s player', icon: 'play', fn: () => { Player.ytOnce = true; Player.load(true, 0, true); } },
      { label: 'Always use it as a backup', icon: 'check', fn: () => { S.settings.ytPlayer = true; save(); Player.load(true, 0, true); } },
      { label: 'Skip to the next song', icon: 'next', fn: () => Player.next() },
    ],
  });
}
function removeHistory(t) {
  S.history = S.history.filter(x => x.id !== t.id); save(); buzz();
  $$('.row[data-id], .card').forEach(el => { if (el.dataset.id === t.id && el.closest('[data-hist]')) el.remove(); });
  toast('Removed from Recently Played'); const e = cv(); if (e.v === 'library' || e.v === 'home' || (e.v === 'coll' && e.k === 'history')) softRender();
}
function moveInPlaylist(id, t, to) {
  const p = S.playlists.find(x => x.id === id); if (!p) return;
  const i = p.tracks.findIndex(x => x.id === t.id); if (i < 0) return;
  const [x] = p.tracks.splice(i, 1); p.tracks.splice(to, 0, x); save(); softRender(); toast('Moved to top');
}
async function copyText(text, msg) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) { const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (x) { } ta.remove(); }
  buzz(); toast(msg || 'Copied');
}
const kbpsOf = q => { const m = String(q || '').match(/(\d{2,4})\s*kbps/i); return m ? +m[1] : 0; };
function qInfo(t) {
  if (!t) return { tier: 'none', label: '' };
  const cur = Player.cur && Player.cur.id === t.id, q = cur ? Player.quality || '' : (t.q || '');
  const lossless = t.lossless || /lossless|flac|wav|alac|aiff/i.test((t.fmt || '') + ' ' + q);
  const kb = t.kbps || kbpsOf(q) || (t.source === 'saavn' && t.hq ? 320 : 0);
  if (lossless) {
    const hi = (t.bits || 0) > 16 || (t.sr || 0) > 48000;
    const spec = t.bits && t.sr ? `${t.bits}-bit / ${+(t.sr / 1000).toFixed(1)} kHz` : '';
    return { tier: hi ? 'hires' : 'lossless', label: hi ? 'Hi-Res Lossless' : 'Lossless', spec, kb, lossless: true };
  }
  if (t.live) return { tier: 'std', label: q || 'Live', kb };
  if (cur && Player.via === 'embed') return { tier: 'std', label: 'YouTube player', kb: 0 };
  if (t.source === 'podcast') return { tier: 'std', label: 'Podcast', kb };
  if (kb >= 256) return { tier: 'hq', label: 'High Quality', spec: (q.split('·')[0].trim() || 'AAC') + ' · ' + kb + ' kbps', kb };
  return { tier: 'std', label: q, kb };
}
function badgeHTML(t) {
  const x = qInfo(t); if (!x.label) return '';
  if (x.tier === 'hires') return `<span class="gold">${I.wave}Hi-Res</span>`;
  if (x.tier === 'lossless') return `<span class="gold">${I.wave}Lossless</span>`;
  if (x.tier === 'hq') return `<span class="gold">HQ</span>${x.kb} kbps`;
  return esc(x.label);
}
function aqInner() {
  const t = Player.cur; if (!t) return '<div class="form"><b class="ft">Audio Quality</b><p class="fsub">Play something to see its audio details.</p></div>';
  const x = qInfo(t), st = S.settings, yt = Player.via === 'embed';
  const codec = yt ? 'Chosen by YouTube' : t.source === 'local' ? (t.fmt || 'Audio file').toUpperCase() : String(Player.quality || '').split('·')[0].trim() || '—';
  const rows = [
    ['Format', codec],
    ['Bitrate', yt ? 'Chosen by YouTube' : x.lossless && x.kb ? `~${x.kb} kbps (lossless)` : x.kb ? `${x.kb} kbps` : '—'],
    ['Sample rate', t.sr ? `${+(t.sr / 1000).toFixed(1)} kHz` : t.source === 'saavn' && !yt ? '44.1 kHz' : '—'],
    ['Bit depth', t.bits ? `${t.bits}-bit` : x.lossless ? '—' : 'Compressed (lossy)'],
    ['Channels', t.ch === 1 ? 'Mono' : t.ch > 2 ? `${t.ch} channels` : 'Stereo'],
    ['Playing via', viaLabel(Player.via)],
    ['Equalizer', !st.eqOn ? 'Off' : Player.el === Player.fx ? 'On · ' + st.eqPreset : 'Not available for this song'],
    ['Volume levelling', st.normalize ? 'On' : 'Off'],
  ];
  const big = x.tier === 'hires' || x.tier === 'lossless' || x.tier === 'hq'
    ? `<div class="aq-hero ${x.tier}"><span class="aq-medal">${x.tier === 'hq' ? 'HQ' : I.wave}</span><div><b>${esc(x.label)}</b><small>${esc(x.spec || '')}</small></div></div>`
    : `<div class="aq-hero"><div><b>${esc(x.label || 'Standard')}</b><small>${yt ? 'Set up your own music server for clean high-quality audio' : 'Standard quality'}</small></div></div>`;
  return `<div class="aq-h"><b>Audio Quality</b><small>${esc(t.title)} · ${esc(t.artist)}</small></div>${big}
    <div class="info">${rows.map(([k, v]) => `<div class="inf"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
    <div class="sub-h">Streaming quality</div>${sSeg('quality', [['auto', 'Auto'], ['saver', 'Data saver'], ['normal', 'Normal'], ['high', 'High · 320']], st.quality || 'auto')}
    <div class="li"><div class="lb"><span class="lx">Show quality badge<small class="lh">Gold badge for High Quality, Lossless and Hi-Res</small></span>${sSw('badge', st.badge)}</div></div>
    <p class="eq-note">JioSaavn streams top out at 320 kbps AAC. Lossless and Hi-Res badges appear for your own FLAC, WAV and ALAC files. Dolby Atmos and Spatial Audio aren’t offered by any free source, so the app never shows them.</p>`;
}
function openAQ() { openSheet(`<div class="sg aq" id="aqbox">${aqInner()}</div><button class="scancel" data-a="sclose">Done</button>`); }
function songInfo(t) {
  const p = S.stats.plays[t.id]; const cur = Player.cur && Player.cur.id === t.id;
  const rows = [['Title', t.title], ['Artist', t.artist], t.album && ['Album', t.album], t.duration && !t.live && ['Length', fmt(t.duration)], t.date && ['Released', fmtDate(t.date)],
    t.year && ['Year', t.year], t.lang && ['Language', t.lang], t.label && ['Label', t.label], t.explicit && ['Explicit', 'Yes'], ['Audio', (() => { const x = qInfo(t); return [x.label, x.spec].filter(Boolean).join(' · ') || '—'; })()], ['Source', { saavn: 'JioSaavn', yt: 'YouTube Music', deezer: 'Chart (matched on YouTube Music)', audius: 'Audius', radio: 'Live radio', podcast: 'Podcast', local: 'This device' }[t.source] || t.source],
    cur && Player.quality && ['Quality', Player.quality], cur && ['Playing via', viaLabel(Player.via)], p && ['Your plays', `${p.n} · ${Math.round(p.s / 60)} min`], p && p.last && ['Last played', fmtDate(p.last)], isDl(t.id) && ['Offline', 'Downloaded'], t.copy && ['Copyright', t.copy]].filter(Boolean);
  openSheet(`<div class="sg"><div class="sh">${`<img src="${esc(artOf(t))}" alt="" class="${t.live ? 'logo' : ''}">`}<div class="sht"><div class="m-t">${esc(t.title)}</div><div class="m-s">${esc(t.artist)}</div></div></div>
    <div class="info">${rows.map(([k, v]) => `<div class="inf"><span>${esc(k)}</span><b class="selectable">${esc(v)}</b></div>`).join('')}</div></div><button class="scancel" data-a="sclose">Done</button>`);
}
function voiceSearch() {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) return toast('Voice search isn’t supported in this browser');
  const r = new R(); r.lang = navigator.language || 'en-IN'; r.interimResults = false; r.maxAlternatives = 1;
  toast('Listening…'); buzz();
  r.onresult = ev => {
    const q = ((ev.results[0] || [])[0] || {}).transcript || ''; if (!q) return;
    const d = $('#drive'); if (d) Actions.drivex();
    if (npOpen) closeNP();
    setTimeout(() => { switchTab('search'); setTimeout(() => { const i = $('#sq'); if (i) { i.value = q; searchInput(q); } }, 80); }, npOpen ? 400 : 0);
  };
  r.onerror = () => toast('Didn’t catch that — try again');
  try { r.start(); } catch (e) { toast('Voice search couldn’t start'); }
}
function isLandPhone() { return matchMedia('(orientation: landscape) and (max-height: 560px) and (pointer: coarse)').matches; }
let carAuto = false, carNoAuto = false;
function landCheck() {
  if (!isLandPhone()) { carNoAuto = false; if (carAuto && $('#drive')) { carAuto = false; Actions.drivex(); } return; }
  if (!S.settings.landCar || carNoAuto || $('#drive') || !Player.cur || sheetOpen) return;
  carAuto = true; openDrive();
  toast('Landscape: using Car Mode', { label: 'Undo', ms: 5000, fn: () => { carNoAuto = true; carAuto = false; Actions.drivex(); setTimeout(openNP, 380); } });
}
addEventListener('orientationchange', () => setTimeout(landCheck, 350));
try { matchMedia('(orientation: landscape)').addEventListener('change', () => setTimeout(landCheck, 350)); } catch (e) { }
function openDrive() {
  if ($('#drive')) return;
  const d = document.createElement('div'); d.id = 'drive';
  d.innerHTML = `<div class="dv-top"><button class="dv-x" data-a="drivex" aria-label="Close Driving Mode">${I.chevDown}</button><span class="dv-clock" id="dv-clock"></span><button class="dv-x" data-a="voice" aria-label="Voice search">${I.mic}</button></div>
    <div class="dv-art" id="dv-artw"><img class="dv-side" id="dv-prev" alt="" data-a="prev"><img id="dv-art" alt=""><img class="dv-side" id="dv-next" alt="" data-a="next"></div>
    <div class="dv-info">
    <div class="dv-t" id="dv-t"></div><div class="dv-a" id="dv-a"></div>
    <div class="dv-prog"><input class="rng" id="dv-seek" type="range" min="0" max="1000" value="0" aria-label="Seek"><div class="dv-times"><span id="dv-cur">0:00</span><span id="dv-rem">-0:00</span></div></div>
    <div class="dv-c"><button data-a="skipb2" id="dv-back" aria-label="Skip back"></button><button data-a="prev" aria-label="Previous">${I.prev}</button><button data-a="toggle" id="dv-pp" class="big" aria-label="Play or pause">${I.pause}</button><button data-a="next" aria-label="Next">${I.next}</button><button data-a="skipf2" id="dv-fwd" aria-label="Skip forward"></button></div>
    <div class="dv-c2"><button data-a="nplike" id="dv-like" aria-label="Favorite">${I.heart}</button><button data-a="shuffle" id="dv-shuf" aria-label="Shuffle">${I.shuffle}</button><button data-a="repeat" id="dv-rep" aria-label="Repeat">${I.repeat}</button><button data-a="sleep" id="dv-sleep" aria-label="Sleep timer">${I.timer}</button></div>
    <div class="dv-up" id="dv-up"></div></div>`;
  document.body.appendChild(d); requestAnimationFrame(() => d.classList.add('on')); UI.drive(); UI.time();
  const clock = () => { const c = $('#dv-clock'); if (c) c.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  clock(); d._clock = setInterval(clock, 15000);
  let sx = null; const art = $('#dv-artw');
  art.addEventListener('pointerdown', e => { sx = e.clientX; });
  art.addEventListener('pointerup', e => { if (sx === null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 60) { buzz(); dx < 0 ? Player.next() : Player.prev(); } });
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { d._lock = l; }).catch(() => { }); } catch (e) { }
}
async function lyrTranslate() {
  const r = lyrState; if (!r || r.tr || r.trBusy) return;
  const sc = lyrScript((r.synced || []).map(x => x.text).join(' ') || r.plain || ''); if (!sc) return;
  r.trBusy = true; const lines = r.synced ? r.synced.map(x => x.text) : r.plain.split('\n');
  toast('Translating lyrics…');
  try { r.tr = await translateLines(lines, sc[1]); if (lyrState === r) renderLyrics(); }
  catch (e) { toast('Translation isn’t available right now — try English letters instead'); }
  r.trBusy = false;
}
function copyLyrics() {
  const t = Player.cur; const r = lyrState; if (!t || !r) return;
  const m = S.settings.lyrMode || 'orig'; const raw = r.synced && r.synced.length ? r.synced.map(l => l.text) : String(r.plain || '').split('\n');
  const body = t.source === 'podcast' ? (t.desc || '') : raw.map((l, k) => m === 'latin' ? translit(l) : m === 'en' && r.tr && r.tr[k] ? `${l}\n${r.tr[k]}` : l).join('\n');
  if (!body.trim()) return toast('Nothing to copy');
  copyText(`${t.title} — ${t.artist}\n\n${body.trim()}`, t.source === 'podcast' ? 'Episode notes copied' : 'Lyrics copied');
}
const skipSecs = dir => { const t = Player.cur; return t && t.source === 'podcast' ? (dir < 0 ? +S.settings.podBack || 15 : +S.settings.podFwd || 30) : 10; };
async function startRadio(t) {
  toast('Starting radio…');
  let pool = [];
  try {
    if (t.source === 'audius') pool = (await Audius.trending(t.genre || '')).filter(x => x.id !== t.id);
    else {
      let seed = t.source === 'saavn' || t.source === 'yt' ? t : null;
      if (!seed) { const m = await YT.match(t); if (m) seed = m; }
      if (seed) pool = await YT.related(seed.source === 'saavn' ? seed : { sid: seed.sid });
    }
  } catch (e) { }
  Player.playList([t, ...shuf(pool).slice(0, 30)], 0, `${t.title} Radio`, false);
  if (!pool.length) toast('Radio will fill up as it plays');
}
function goArtist(t) {
  const open = () => {
    if (t.source === 'audius') go('coll', { k: 'artist', id: t.uid, title: t.artist });
    else go('coll', { k: 'yt', c: { kind: 'artist', id: t.uid, title: String(t.artist).split(',')[0], source: t.source === 'saavn' ? 'saavn' : 'yt' }, title: String(t.artist).split(',')[0] });
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
      p.tracks.length && { label: 'Share Playlist', icon: 'share', fn: () => sharePlaylist(p.name, p.tracks) },
      { label: 'Rename', icon: 'lyrics', fn: async () => { const n = await ask('Rename Playlist', 'Playlist name', p.name); if (n) { p.name = n; save(); softRender(); } } },
      { label: 'Delete Playlist', icon: 'trash', danger: true, fn: () => confirmSheet(`Delete “${p.name}”?`, 'The songs stay in your library.', 'Delete Playlist', () => { S.playlists = S.playlists.filter(x => x.id !== id); save(); toast('Playlist deleted'); history.back(); }) },
    ],
  });
}
let lpFirst = false;
let needName = false;
function nameSheet(first) {
  needName = !!first;
  openSheet(`<div class="sg form nm"><b class="ft">${first ? 'What should we call you?' : 'Your name'}</b>
    <p class="fsub">Your first name — for your greeting and the mixes made for you. You can change it any time in Settings.</p>
    <input class="tin" id="nmin" maxlength="30" value="${esc(S.settings.name || '')}" placeholder="Your name" autocomplete="given-name" autocapitalize="words" spellcheck="false">
    <div class="fbtns">${first ? '' : '<button class="fb" data-a="sclose">Cancel</button>'}<button class="fb pri" data-a="nmsave" id="nmbtn" ${String(S.settings.name || '').trim() ? '' : 'disabled'}>${first ? 'Continue' : 'Save'}</button></div></div>`);
  setTimeout(() => { const i = $('#nmin'); if (i) i.focus(); }, 380);
}
function askName(first) { nameSheet(first); }
function langPicker(first) {
  lpFirst = !!first;
  pickSel = new Set(S.settings.langs || (first ? deviceLangs() : []));
  const dev = deviceLangs(), ordered = [...dev.map(n => LANGS.find(x => x[0] === n)).filter(Boolean), ...LANGS.filter(x => !dev.includes(x[0]))];
  openSheet(`<div class="sg form lp"><b class="ft">${first ? 'Pick your music languages' : 'Music languages'}</b>
    <p class="fsub">Home fills with top songs and playlists in these languages. Change it any time in Settings.</p>
    <div class="chips wrap">${ordered.map(([l, n]) => `<button class="chip ${pickSel.has(l) ? 'on' : ''}" data-a="lpick" data-l="${esc(l)}">${esc(l)}${n !== l ? ` <span class="nat">${esc(n)}</span>` : ''}</button>`).join('')}</div>
    <div class="fbtns"><button class="fb pri" data-a="lpdone">Done</button></div></div>`);
}

const fmtDb = v => (v > 0 ? '+' : '') + (+v).toFixed(Number.isInteger(+v) ? 0 : 1);
function eqStatus() {
  const s = S.settings;
  if (IS_IOS) return ['off', 'iPhone and iPad stop sound processing when the screen locks, so the equalizer is off there.'];
  if (!s.eqOn) return ['off', 'Turn it on to shape the sound.'];
  if (!Player.cur || !Player.loaded) return ['ok', 'Ready — it applies as soon as a song plays.'];
  if (Player.el === Embed) return ['warn', 'Not active on this song: it plays through YouTube’s player, which doesn’t allow sound changes.'];
  if (Player.el === Player.fx) return ['ok', 'Active on this song.'];
  return ['warn', 'Not active on this song: its server doesn’t allow sound processing. It works on downloads, your own files and most clean-audio songs.'];
}
const eqKnob = (k, label, min, max, step, unit) => `<div class="eqk"><span>${label}</span><input class="slider" type="range" min="${min}" max="${max}" step="${step}" value="${S.settings[k]}" data-eqk="${k}" style="--p:${((S.settings[k] - min) / (max - min)) * 100}%" aria-label="${label}"><b id="eqk-${k}">${k === 'eqWidth' ? Math.round(S.settings[k] * 100) + '%' : fmtDb(S.settings[k]) + unit}</b></div>`;
function drawEq() {
  const cv = $('#eqc'); if (!cv || !cv.getContext) return;
  const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OC) return;
  const ctx2 = cv.getContext('2d'); if (!ctx2) return;
  const W = cv.width = cv.clientWidth * (window.devicePixelRatio || 1), H = cv.height = cv.clientHeight * (window.devicePixelRatio || 1);
  if (!drawEq.oc) drawEq.oc = new OC(1, 128, 44100);
  const oc = drawEq.oc, st = S.settings, N = 160;
  const fr = new Float32Array(N); for (let i = 0; i < N; i++) fr[i] = 20 * Math.pow(1000, i / (N - 1));
  const tot = new Float32Array(N).fill(+st.eqPre || 0), mag = new Float32Array(N), ph = new Float32Array(N);
  const add = (type, f, gain, q) => { const b = oc.createBiquadFilter(); b.type = type; b.frequency.value = f; b.gain.value = gain; if (q) b.Q.value = q; b.getFrequencyResponse(fr, mag, ph); for (let i = 0; i < N; i++) tot[i] += 20 * Math.log10(mag[i] || 1e-6); };
  EQ_F.forEach((f, i) => add(i === 0 ? 'lowshelf' : i === EQ_F.length - 1 ? 'highshelf' : 'peaking', f, st.eq[i] || 0, 1.1));
  add('lowshelf', 90, +st.eqBass || 0); add('highshelf', 9000, +st.eqTreble || 0);
  const css = getComputedStyle(document.documentElement), acc = css.getPropertyValue('--accent').trim() || '#ff375f', grid = css.getPropertyValue('--sep').trim() || 'rgba(128,128,128,.3)';
  const y = db => H / 2 - (clamp(db, -18, 18) / 18) * (H / 2 - 6);
  ctx2.clearRect(0, 0, W, H); ctx2.strokeStyle = grid; ctx2.lineWidth = 1;
  [y(0), y(9), y(-9)].forEach(yy => { ctx2.beginPath(); ctx2.moveTo(0, yy); ctx2.lineTo(W, yy); ctx2.stroke(); });
  ctx2.beginPath(); for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * W; i ? ctx2.lineTo(x, y(tot[i])) : ctx2.moveTo(x, y(tot[i])); }
  ctx2.strokeStyle = S.settings.eqOn ? acc : grid; ctx2.lineWidth = 2.5 * (window.devicePixelRatio || 1); ctx2.stroke();
  ctx2.lineTo(W, H / 2); ctx2.lineTo(0, H / 2); ctx2.closePath(); ctx2.globalAlpha = 0.14; ctx2.fillStyle = acc; ctx2.fill(); ctx2.globalAlpha = 1;
}
function eqInner() {
  const s = S.settings; const [kind, msg] = eqStatus();
  setTimeout(drawEq, 30); setTimeout(() => UI.state(), 0);
  const pins = eqPins(), mine = eqCustom().map(c => c.n), all = [...pins.filter(n => eqFind(n)), ...mine.filter(n => !pins.includes(n)), ...Object.keys(PRESETS).filter(n => !pins.includes(n))];
  const cur = eqName(), pinned = pins.includes(cur), custom = mine.includes(cur) || cur === 'Custom';
  return `<div class="eq-h"><div><b>Equalizer</b><span class="eq-nm"><small id="eqname">${s.eqOn ? esc(cur) : 'Off'}</small>${s.eqOn ? `<button class="eq-ed" data-a="eqname" aria-label="${custom ? 'Name or rename this sound' : 'Save as your own'}">${I.edit}</button><button class="eq-ed ${pinned ? 'on' : ''}" data-a="eqpin" aria-label="${pinned ? 'Unpin' : 'Pin'}">${I.pin}</button>${mine.includes(cur) ? `<button class="eq-ed del" data-a="eqdelask" aria-label="Delete this sound">${I.trash}</button>` : ''}` : ''}</span></div>
    <label class="sw"><input type="checkbox" id="eqon" ${s.eqOn ? 'checked' : ''} aria-label="Equalizer on"><span></span></label></div>
    <p class="eq-st ${kind}">${esc(msg)}</p>
    <canvas id="eqc" class="eqc" aria-label="Equalizer response curve"></canvas>
    <div class="chips">${all.map(n => `<button class="chip ${s.eqOn && cur === n ? 'on' : ''} ${mine.includes(n) ? 'mine' : ''}" data-a="eqp" data-n="${esc(n)}">${pins.includes(n) ? I.pin : ''}${esc(n)}</button>`).join('')}</div>
    <div class="bands">${EQ_F.map((f, i) => `<div class="band"><span class="db" id="eqv${i}">${fmtDb(s.eq[i])}</span>
      <div class="vs"><input class="vr" type="range" min="-12" max="12" step="0.5" value="${s.eq[i]}" data-band="${i}" aria-label="${EQ_L[i]} hertz"></div><span class="hz">${EQ_L[i]}</span></div>`).join('')}</div>
    <div class="eqks">${eqKnob('eqPre', 'Preamp', -12, 6, 0.5, ' dB')}${eqKnob('eqBass', 'Bass boost', 0, 12, 0.5, ' dB')}${eqKnob('eqTreble', 'Treble', -6, 10, 0.5, ' dB')}${eqKnob('eqWidth', 'Stereo width', 0, 2, 0.05, '')}</div>
    ${eqKnob('eqBoost', 'Enhance volume', 0, 12, 0.5, ' dB')}
    <div class="li eqloud"><div class="lb"><span class="lx">Loudness<small class="lh">Evens out quiet and loud parts — great in the car or with earbuds. A built-in limiter keeps every setting free of distortion.</small></span><label class="sw"><input type="checkbox" id="eqloud" ${s.eqLoud ? 'checked' : ''}><span></span></label></div></div>
    <div class="fbtns"><button class="fb" data-a="eqreset">Reset all</button></div>`;
}
function openEQ() { openSheet(`<div class="sg eq ${S.settings.eqOn ? '' : 'off'}" id="eqbox">${eqInner()}</div><button class="scancel" data-a="sclose">Done</button>`); }
function eqToggle(on) {
  S.settings.eqOn = on; save();
  const yt = Player.el === Embed || Player.via === 'embed';
  if (on && !yt) { Player.ensureFx(); if (Player.ctx && Player.ctx.state !== 'running') Player.ctx.resume().catch(() => { }); }
  const b = $('#eqbox'); if (b) { b.classList.toggle('off', !on); setHTML(b, eqInner()); }
  if (!yt) Player.reroute();
  toast(on ? 'Equalizer on' : 'Equalizer off');
  if (!yt) setTimeout(() => setHTML($('#eqbox'), eqInner()), 1500);
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
  if (t.source === 'audius') { await Audius.discover(); return { url: Audius.streamUrl(t), mime: 'audio/mpeg', bitrate: 320000 }; }
  if (t.source === 'podcast') return { url: t.url, mime: 'audio/mpeg' };
  if (t.source === 'saavn') { const pk = Saavn.pick(t); if (pk) return { url: pk.url, mime: 'audio/mp4', bitrate: pk.kbps * 1000 }; }
  if (t.svSu) { const pk = Saavn.pick(t.svSu); if (pk) return { url: pk.url, mime: 'audio/mp4', bitrate: pk.kbps * 1000 }; }
  if (t.source === 'deezer' || t.source === 'yt') { const m = await Saavn.match(t).catch(() => null); if (m) { t.svSu = Saavn.urls(m); const pk = Saavn.pick(t.svSu); if (pk) return { url: pk.url, mime: 'audio/mp4', bitrate: pk.kbps * 1000 }; } }
  let yid = ytIdOf(t);
  if (!yid && t.source === 'deezer') { const m = await YT.match(t); if (m) { yid = t.ytId = m.sid; } }
  if (!yid) throw new Error('no source');
  return Streams.get(yid, new Set(), DIRECT() ? 30000 : 15000);
}
async function fetchMediaAny(url, mime, onP) {
  try { return await fetchMedia(url, mime, onP); }
  catch (e) {
    if (/googlevideo|\/api\/stream/.test(url)) throw e;
    for (const id of uniq([S.settings.proxy ? 'custom' : '', JSA.via, 'codetabs', 'allorigins', 'corsproxy'].filter(Boolean))) {
      const p = JSA.relays().find(x => x.id === id && !x.unwrap && x.id !== 'direct'); if (!p) continue;
      try { const r = await fetchT(p.wrap(url), {}, 120000); if (!r.ok) continue; const b = await readWithProgress(r, onP); if (b.size > 50000) return new Blob([b], { type: /mp4|m4a/.test(url) ? 'audio/mp4' : (b.type || 'audio/mpeg') }); } catch (x) { }
    }
    throw e;
  }
}
async function readWithProgress(r, onP) {
  const total = +r.headers.get('content-length') || 0;
  if (!onP || !r.body || !r.body.getReader || !total) return r.blob();
  const rd = r.body.getReader(), parts = []; let got = 0, last = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; const p = Math.min(99, Math.round((got / total) * 100)); if (p !== last) { last = p; onP(p); } }
  return new Blob(parts, { type: r.headers.get('content-type') || '' });
}
async function fetchMedia(url, mime, onP) {
  let clen = 0; try { clen = +new URL(url, location.href).searchParams.get('clen') || 0; } catch (e) { }
  const type = /webm/.test(mime) ? 'audio/webm' : /mp4|m4a/.test(mime) ? 'audio/mp4' : (mime || 'audio/mpeg').split(';')[0];
  if (!clen) { const r = await fetchT(url, {}, 180000); if (!r.ok) throw new Error('HTTP ' + r.status); const b = await readWithProgress(r, onP); return new Blob([b], { type: b.type && b.type !== 'application/octet-stream' ? b.type : type }); }
  const parts = []; const CH = 3 * 1024 * 1024;
  for (let s = 0; s < clen; s += CH) {
    const e = Math.min(clen, s + CH) - 1;
    const r = await fetchT(url, { headers: { Range: `bytes=${s}-${e}` } }, 90000);
    if (r.status === 200) { const b = await r.blob(); return new Blob([b], { type }); }
    if (r.status !== 206) throw new Error('HTTP ' + r.status);
    parts.push(await r.blob()); if (onP) onP(Math.min(99, Math.round(((e + 1) / clen) * 100)));
  }
  return new Blob(parts, { type });
}
const Offline = {
  max() { return Math.max(0, +S.settings.autoSaveMax || 30); },
  has(id) { return (S.cached || []).some(x => x.id === id); },
  async get(id) { try { return await DB.get('c:' + id); } catch (e) { return null; } },
  forget(id) { if (!this.has(id)) return; S.cached = S.cached.filter(x => x.id !== id); DB.del && DB.del('c:' + id).catch(() => { }); save(); },
  async keep(t) {
    if (!S.settings.autoSave || !t || t.live || t.source === 'local' || t.source === 'yt' && !t.svSu || isDl(t.id) || this.has(t.id) || this.busy) return;
    if (!['saavn', 'audius', 'podcast', 'yt'].includes(t.source) || !navigator.onLine || slowNet()) return;
    this.busy = true;
    try {
      let blob = null; const pre = Pre.get(t.id); if (pre && pre.blob) blob = pre.blob;
      if (!blob && Player.cur && Player.cur.id === t.id && Player.isBlob && Player.via === 'preloaded' && pre) blob = pre.blob;
      if (!blob) { const s2 = await mediaSource(t); if (/googlevideo|\/api\/stream/.test(s2.url)) return; blob = await fetchMediaAny(s2.url, s2.mime); }
      if (!blob || blob.size < 5000) return;
      await DB.put('c:' + t.id, blob);
      S.cached = (S.cached || []).filter(x => x.id !== t.id); S.cached.unshift({ ...clean(t), at: Date.now(), size: blob.size });
      while (S.cached.length > this.max()) { const old = S.cached.pop(); if (DB.del) DB.del('c:' + old.id).catch(() => { }); }
      save(); UI.dlMark();
    } catch (e) { } finally { this.busy = false; }
  },
  async clear() { for (const x of S.cached || []) { if (DB.del) await DB.del('c:' + x.id).catch(() => { }); } S.cached = []; save(); UI.dlMark(); },
};
const dlPct = new Map();
function dlProgress(t, p) {
  if (p < 0) dlPct.delete(t.id); else dlPct.set(t.id, p);
  $$('.row[data-id]').filter(r => r.dataset.id === t.id).forEach(r => {
    let ring = r.querySelector('.dlp');
    if (p < 0) { if (ring) ring.remove(); return; }
    if (!ring) { const m = r.querySelector('.more'); if (!m) return; m.insertAdjacentHTML('beforebegin', '<span class="dlp"></span>'); ring = r.querySelector('.dlp'); }
    ring.style.setProperty('--d', p + '%');
  });
  if (p >= 0 && (p % 10 === 0 || p > 95) && !document.hidden) { const tt = $('#toast'); if (tt && tt.classList.contains('on') && /^Downloading/.test(tt.textContent)) tt.firstChild.textContent = `Downloading “${t.title}” · ${p}%`; }
}
async function download(t, quiet) {
  if (!canDownload(t)) return toast('This can’t be downloaded');
  if (isDl(t.id) || dlActive.has(t.id)) return;
  dlActive.add(t.id); if (!quiet) toast(`Downloading “${t.title}”…`);
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
    let blob = null, lastErr, dlQ = '', dlUrl = '';
    for (let attempt = 0; attempt < 3 && !blob; attempt++) {
      try {
        if (attempt) Streams.drop(ytIdOf(t));
        const s = await mediaSource(t);
        dlQ = qLabel(s.mime, s.bitrate);
        blob = await fetchMediaAny(s.url, s.mime, quiet ? null : p => dlProgress(t, p)); dlUrl = s.url;
        if (!blob.size) { blob = null; throw new Error('empty'); }
      } catch (e) { lastErr = e; }
    }
    if (!blob) throw lastErr || new Error('failed');
    await DB.put(t.id, blob);
    const meta = clean(t); meta.q = dlQ || fmtLabel(blob.type);
    const artUrl = t.artLarge || t.art;
    if (artUrl && !artUrl.startsWith('data:')) {
      try { const ar = await fetchT(artUrl, {}, 15000); if (ar.ok) { const ab = await ar.blob(); await DB.put('art:' + t.id, ab); artCache.set(t.id, URL.createObjectURL(ab)); meta.hasArt = true; } } catch (e) { }
    }
    S.downloads = S.downloads.filter(x => x.id !== t.id); S.downloads.unshift(meta); save();
    dlProgress(t, -1);
    if (!quiet) toast(`Downloaded “${t.title}” — plays offline`, { label: 'View', fn: () => { if (npOpen) closeNP(); setTimeout(() => go('coll', { k: 'downloads', title: 'Downloaded' }), npOpen ? 400 : 0); } });
    Offline.forget(t.id); UI.dlMark();
    $$('.row[data-id]').filter(r => r.dataset.id === t.id).forEach(r => { const m = r.querySelector('.more'); if (m && !r.querySelector('.dlm')) m.insertAdjacentHTML('beforebegin', `<span class="dlm">${I.dlok}</span>`); });
    return true;
  } catch (e) {
    warn(e);
    dlProgress(t, -1);
    if (!quiet && t.source === 'yt' && !t.svSu) { toast('This song only plays through YouTube’s player, which can’t be downloaded'); return false; }
    if (!quiet) { const s2 = await mediaSource(t).catch(() => null); if (s2 && s2.url && !/googlevideo|\/api\/stream/.test(s2.url)) { offerSave(t, s2.url); return false; } }
    if (!quiet) toast(`Couldn’t download “${t.title}” right now — try again in a moment`);
    return false;
  } finally { dlActive.delete(t.id); }
}
function offerSave(t, url) {
  actionSheet({
    head: textHead('Save this song as a file', 'Offline saving inside the app isn’t allowed for this song’s server, but you can save the audio file to your device.'),
    acts: [
      { label: 'Open the audio file to save it', icon: 'save', fn: () => { const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.download = `${t.artist} - ${t.title}.m4a`; document.body.appendChild(a); a.click(); a.remove(); toast('Use your browser’s download or ⋮ → Download button'); } },
      { label: 'Copy the file link', icon: 'copy', fn: () => copyText(url, 'Link copied') },
    ],
  });
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
async function probeAudio(f) {
  try {
    const part = f.slice(0, 262144);
    const ab = part.arrayBuffer ? await part.arrayBuffer() : await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsArrayBuffer(part); });
    const b = new Uint8Array(ab);
    const at = (str, from = 0) => { const c = [...str].map(x => x.charCodeAt(0)); outer: for (let i = from; i <= b.length - c.length; i++) { for (let k = 0; k < c.length; k++) if (b[i + k] !== c[k]) continue outer; return i; } return -1; };
    let i = at('fLaC');
    if (i >= 0 && i + 22 < b.length) { const o = i + 8; return { codec: 'FLAC', lossless: true, sr: (b[o + 10] << 12) | (b[o + 11] << 4) | (b[o + 12] >> 4), ch: ((b[o + 12] >> 1) & 7) + 1, bits: (((b[o + 12] & 1) << 4) | (b[o + 13] >> 4)) + 1 }; }
    if (at('RIFF') === 0 && (i = at('fmt ')) > 0 && i + 24 < b.length) { const dv = new DataView(b.buffer); return { codec: 'WAV', lossless: true, ch: dv.getUint16(i + 10, true), sr: dv.getUint32(i + 12, true), bits: dv.getUint16(i + 22, true) }; }
    if ((at('FORM') === 0) && at('AIFF') > 0) return { codec: 'AIFF', lossless: true };
    i = at('alac');
    if (i >= 0) { const j = at('alac', i + 4); if (j > 0 && j + 32 < b.length) { const dv = new DataView(b.buffer); return { codec: 'ALAC', lossless: true, bits: b[j + 13], ch: b[j + 17], sr: dv.getUint32(j + 28) }; } return { codec: 'ALAC', lossless: true }; }
    if (at('ftyp') >= 0) return { codec: 'AAC' };
    if (at('OggS') === 0) return { codec: at('OpusHead') > 0 ? 'Opus' : 'Vorbis' };
    return { codec: /\.mp3$/i.test(f.name) || /mpeg/.test(f.type) ? 'MP3' : '' };
  } catch (e) { return {}; }
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
      const [meta, dur, info] = await Promise.all([readTags(f), probeDuration(f), probeAudio(f)]);
      const base = f.name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim();
      const m = base.match(/^(.+?)\s+-\s+(.+)$/);
      await DB.put(id, f);
      let hasArt = false;
      if (meta.pic) { const small = await shrink(meta.pic); await DB.put('art:' + id, small); artCache.set(id, URL.createObjectURL(small)); hasArt = true; }
      const fmt = (f.name.match(/\.(\w+)$/) || [])[1] || f.type;
      S.locals.unshift(clean({ id, source: 'local', title: meta.title || (m ? m[2] : base), artist: meta.artist || (m ? m[1] : 'Unknown artist'), album: meta.album || '', duration: dur, hasArt, fmt: info.codec || fmt,
        sr: info.sr || 0, bits: info.bits || 0, ch: info.ch || 0, lossless: !!info.lossless, kbps: dur ? Math.round((f.size * 8) / dur / 1000) : 0 }));
      ok++;
    } catch (e) { warn(e); }
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
  const app = /^https?:/.test(location.origin) ? location.origin + location.pathname : '';
  const url = app && !t.local && t.source !== 'local' && !t.live ? `${app}?play=${enc((t.title + ' ' + (t.artist || '')).trim())}${t.source === 'podcast' ? '&pod=1' : ''}` : t.source === 'saavn' ? `https://www.jiosaavn.com/search/song/${enc(t.title + ' ' + t.artist)}` : t.source === 'yt' ? `https://music.youtube.com/watch?v=${t.sid}` : (t.live && t.home) || location.href.split('#')[0];
  const text = `🎧 ${t.title} — ${t.artist}\nListen free on Tune Tune`;
  try { if (navigator.share) { await navigator.share({ title: t.title, text, url }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toast('Link copied'); } catch (e) { toast(text); }
}
const b64u = {
  enc(u8) { let b = ''; for (let i = 0; i < u8.length; i += 8192) b += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(x) { const b = atob(x.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; },
};
async function packStr(str) {
  const raw = new TextEncoder().encode(str);
  try { if (window.CompressionStream) { const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); return 'z' + b64u.enc(z); } } catch (e) { }
  return 'r' + b64u.enc(raw);
}
async function unpackStr(x) {
  const k = x[0], b = b64u.dec(x.slice(1));
  if (k === 'z') return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  return new TextDecoder().decode(b);
}
const SHARE_KEYS = [['source', 's'], ['id', 'i'], ['sid', 'y'], ['ytId', 'v'], ['title', 't'], ['artist', 'a'], ['album', 'l'], ['duration', 'd'], ['enc', 'e'], ['hq', 'h'], ['url', 'u'], ['art', 'r'], ['artLarge', 'R'], ['podId', 'p']];
async function sharePlaylist(name, tracks) {
  const list = tracks.filter(t => t && t.source !== 'local' && !t.live).slice(0, 200);
  if (!list.length) return toast('Nothing shareable in this playlist');
  const data = { n: name, b: (S.settings.name || '').trim(), t: list.map(t => { const o = {}; SHARE_KEYS.forEach(([k, s2]) => { const v = t[k]; if (v === undefined || v === '' || v === false || v === 0) return; if ((k === 'art' || k === 'artLarge') && String(v).startsWith('data:')) return; o[s2] = v; }); return o; }) };
  const code = await packStr(JSON.stringify(data));
  const app = /^https?:/.test(location.origin) ? location.origin + location.pathname : location.href.split('?')[0];
  const url = `${app}?pl=${code}`;
  const text = `🎶 “${name}” — ${plural(list.length, 'song')}${data.b ? ' from ' + data.b : ''}\nListen free on Tune Tune`;
  try { if (navigator.share) { await navigator.share({ title: name, text, url }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  copyText(`${text}\n${url}`, 'Playlist link copied');
}
async function openSharedPlaylist(code) {
  let d; try { d = JSON.parse(await unpackStr(code)); } catch (e) { return toast('That playlist link is broken'); }
  const tracks = (d.t || []).map(o => { const t = {}; SHARE_KEYS.forEach(([k, s2]) => { if (o[s2] !== undefined) t[k] = o[s2]; }); if (!t.artLarge) t.artLarge = t.art; return clean(t); }).filter(t => t.id && t.title);
  if (!tracks.length) return toast('That playlist is empty');
  const name = d.n || 'Shared playlist';
  const arts = tracks.filter(t => t.art).slice(0, 4).map(t => `<img src="${esc(t.art)}" alt="">`).join('');
  actionSheet({ head: `<div class="sh col"><div class="mosaic">${arts || `<img src="${esc(ph({ title: name }))}" alt="">`}</div><b>${esc(name)}</b><div class="m-s">${plural(tracks.length, 'song')}${d.b ? ' · from ' + esc(d.b) : ''} · shared with you</div></div>`,
    acts: [
      { label: 'Play', icon: 'play', fn: () => { Player.playList(tracks, 0, name); setTimeout(openNP, 250); } },
      { label: 'Shuffle', icon: 'shuffle', fn: () => { Player.playList(tracks, Math.floor(Math.random() * tracks.length), name, true); setTimeout(openNP, 250); } },
      { label: 'Save to Library', icon: 'plus', fn: () => { const p = newPlaylist(name, tracks); toast('Saved to your playlists'); go('coll', { k: 'playlist', id: p.id }); } },
    ] });
}
async function openShared() {
  try {
    const u = new URL(location.href); const pl = u.searchParams.get('pl'); const sh = u.searchParams.get('share') || u.searchParams.get('text') || u.searchParams.get('url'); const op = u.searchParams.get('open');
    if (pl || sh || op) { ['pl', 'share', 'text', 'url', 'title', 'open'].forEach(k => u.searchParams.delete(k)); history.replaceState(history.state, '', u.pathname + u.search + u.hash); }
    if (pl) return openSharedPlaylist(pl);
    if (sh) return handleSharedText(sh);
    if (op) return openShortcut(op);
  } catch (e) { warn(e); }
  let q = '', pod = false; try { const u = new URL(location.href); q = u.searchParams.get('play') || ''; pod = u.searchParams.has('pod'); if (q) { u.searchParams.delete('play'); u.searchParams.delete('pod'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } } catch (e) { }
  if (!q || pod) { if (q) { switchTab('search'); setTimeout(() => { const i = $('#sq'); if (i) { i.value = q; searchInput(q); } }, 80); } return; }
  let r = []; try { r = await firstOk([() => Saavn.songs(q), () => YT.songs(q)]); } catch (e) { }
  const t = r && r[0]; if (!t) { switchTab('search'); setTimeout(() => { const i = $('#sq'); if (i) { i.value = q; searchInput(q); } }, 80); return; }
  actionSheet({ head: `<div class="sh col"><img src="${esc(artOf(t, true))}" alt="" style="width:120px;height:120px;border-radius:12px"><b>${esc(t.title)}</b><div class="m-s">${esc(t.artist)} · shared with you</div></div>`,
    acts: [{ label: 'Play now', icon: 'play', fn: () => { Player.playList(r.slice(0, 20), 0, 'Shared with you'); setTimeout(openNP, 250); } }, { label: 'Play Next', icon: 'playNext', fn: () => Player.playNext(t) }] });
}
async function handleSharedText(txt) {
  const s2 = String(txt || '');
  const yt = s2.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/)([\w-]{11})/);
  if (yt) { const t = clean({ id: 'yt:' + yt[1], source: 'yt', sid: yt[1], title: 'Shared song', artist: 'YouTube', art: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`, artLarge: `https://i.ytimg.com/vi/${yt[1]}/maxresdefault.jpg` });
    try { const r = await YT.songs(yt[1]); const m = r.find(x => x.sid === yt[1]); if (m) Object.assign(t, m); } catch (e) { }
    return actionSheet({ head: textHead(t.title, t.artist + ' · shared with you'), acts: [{ label: 'Play now', icon: 'play', fn: () => { Player.playList([t], 0, 'Shared with you'); setTimeout(openNP, 250); } }, { label: 'Play Next', icon: 'playNext', fn: () => Player.playNext(t) }] });
  }
  let q = s2.replace(/https?:\/\/\S+/g, ' ').trim();
  const slug = s2.match(/jiosaavn\.com\/song\/([^/]+)/) || s2.match(/gaana\.com\/song\/([^/?]+)/) || s2.match(/wynk\.in\/music\/song\/([^/?]+)/);
  if (!q && slug) q = decodeURIComponent(slug[1]).replace(/[-_]+/g, ' ');
  if (!q && /open\.spotify\.com\/track/.test(s2)) { try { const j = await getJSON('https://open.spotify.com/oembed?url=' + enc(s2.match(/https?:\/\/\S+/)[0]), 5000); q = j.title || ''; } catch (e) { } }
  if (!q) return toast('Couldn’t find a song in what was shared');
  switchTab('search'); setTimeout(() => { const i = $('#sq'); if (i) { i.value = q; searchInput(q); } }, 80);
}
/* ================= native apps: reminders, “Open with”, widget buttons ================= */
const Native = {
  cap() { return window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() ? window.Capacitor : null; },
  plug(n) { const c = this.cap(); return c && c.Plugins ? c.Plugins[n] : null; },
  async remind() {
    if (S.settings.remind3 === false) return;
    const LN = this.plug('LocalNotifications'); if (!LN) return;
    try {
      const p = await LN.checkPermissions(); if (p.display !== 'granted') { if (S.askedNotif) return; S.askedNotif = 1; save(); const r = await LN.requestPermissions(); if (r.display !== 'granted') return; }
      const nm = String(S.settings.name || '').trim(), t = (Player.cur && !Player.cur.live) ? Player.cur : (S.history || [])[0];
      await LN.cancel({ notifications: [{ id: 7301 }] }).catch(() => { });
      await LN.schedule({ notifications: [{ id: 7301, title: nm ? `${nm}, your music misses you 🎧` : 'Your music misses you 🎧',
        body: t ? `Pick up where you left off — “${t.title}”` : 'New songs in your languages are waiting',
        schedule: { at: new Date(Date.now() + 3 * 864e5), allowWhileIdle: true }, smallIcon: 'ic_stat_tunetune', iconColor: '#FF375F', extra: { url: 'tunetune://open/resume' } }] });
    } catch (e) { warn(e); }
  },
  async openUrl(url) {
    url = String(url || '');
    const m = url.match(/^tunetune:\/\/open\/([\w-]+)/); if (m) return openShortcut(m[1]);
    if (/^(content|file):/.test(url)) {
      try {
        const c = this.cap(); const r = await fetch(c.convertFileSrc(url)); const b = await r.blob();
        const name = decodeURIComponent(url.split('/').pop().split('?')[0] || 'Song') || 'Song';
        const before = S.locals.length; await importFiles([new File([b], /\.\w{2,4}$/.test(name) ? name : name + '.mp3', { type: b.type || 'audio/mpeg' })]);
        const added = S.locals.slice(0, S.locals.length - before); if (added.length) { Player.playList(added, 0, 'On This Device'); setTimeout(openNP, 250); }
      } catch (e) { toast('Couldn’t open that file'); }
    }
  },
  init() {
    const App = this.plug('App'), LN = this.plug('LocalNotifications');
    if (App) {
      App.addListener('appUrlOpen', d => this.openUrl(d && d.url));
      if (App.getLaunchUrl) App.getLaunchUrl().then(d => { if (d && d.url) setTimeout(() => this.openUrl(d.url), 900); }).catch(() => { });
      App.addListener('appStateChange', st => { if (!st.isActive) this.remind(); });
    }
    if (LN) LN.addListener('localNotificationActionPerformed', a => { const u = a && a.notification && a.notification.extra && a.notification.extra.url; if (u) this.openUrl(u); });
    if (LN) setTimeout(() => this.remind(), 20000);
    const D = window.ttDesktop;
    if (D && D.onOpenFiles) D.onOpenFiles(async files => {
      const fl = files.map(f => new File([f.data], f.name, { type: f.type || '' })); const before = S.locals.length;
      await importFiles(fl); const added = S.locals.slice(0, S.locals.length - before);
      if (added.length) { Player.playList(added, 0, 'On This Device'); setTimeout(openNP, 250); }
    });
    if (D && D.used) { D.used(); addEventListener('focus', () => D.used()); }
  },
};
function openShortcut(k) {
  if (k === 'home') return switchTab('home');
  if (k === 'search') return switchTab('search');
  if (k === 'offline') return playOffline('mix');
  if (k === 'party') { if (Player.cur) return Actions.party(); return toast('Play a song, then start Party Mode'); }
  if (k === 'liked') return go('coll', { k: 'liked', title: 'Favorite Songs' });
  if (k === 'resume') { if (Player.cur) { Player.toggle(); setTimeout(openNP, 200); } else toast('Nothing to resume yet'); return; }
  if (k === 'drive') { if (Player.cur) openDrive(); else toast('Play something first, then open Driving Mode'); return; }
  if (k === 'radio') return go('radio');
  if (k === 'downloads') return go('coll', { k: 'downloads', title: 'Downloaded' });
}
function offlineList(withPods) {
  const seen = new Set(), out = [];
  [...S.downloads, ...(S.cached || []), ...S.locals].forEach(t => { if (t && t.id && !seen.has(t.id) && (withPods || S.settings.mixPods || t.source !== 'podcast')) { seen.add(t.id); out.push(t); } });
  return out;
}
const shuffled = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const canPlayOffline = t => t && (t.source === 'local' || isDl(t.id) || Offline.has(t.id));
function playOffline(kind) {
  const noPod = x => S.settings.mixPods || x.source !== 'podcast';
  const L = (kind === 'dl' ? S.downloads : kind === 'saved' || kind === 'saved-order' ? (S.cached || []) : kind === 'local' ? S.locals : offlineList()).filter(noPod);
  if (!L.length) return toast('Nothing saved on this device yet');
  if (kind === 'saved-order') { Player.playList(L, 0, 'Recently saved', false); setTimeout(openNP, 250); return; }
  Player.playList(shuffled(L), 0, kind === 'dl' ? 'Downloads' : kind === 'saved' ? 'Recently saved' : kind === 'local' ? 'On This Device' : 'Offline Mix', true);
  setTimeout(openNP, 250);
}
let offShown = false;
function offlineNudge() {
  const n = offlineList().length;
  if (!n) return toast('You’re offline — download songs to listen without internet');
  toast(`You’re offline · ${plural(n, 'song')} ready`, { label: 'Play', ms: 6000, fn: () => offlineSheet() });
}
function offlineSheet() {
  const all = offlineList(), dl = S.downloads.length, sv = (S.cached || []).length, lc = S.locals.length;
  if (!all.length) return toast('You’re offline — download songs to listen without internet');
  actionSheet({ head: `<div class="sh col off-h"><div class="off-ic">${I.wifiOff}</div><b>You’re offline</b><div class="m-s">${plural(all.length, 'song')} on this device can still play</div></div>`,
    acts: [
      { label: `Offline Mix · ${plural(all.length, 'song')}`, icon: 'shuffle', fn: () => playOffline('mix') },
      dl && { label: `Downloads · ${dl}`, icon: 'download', fn: () => playOffline('dl') },
      sv && { label: `Recently saved · ${sv}`, icon: 'clock', fn: () => playOffline('saved') },
      lc && { label: `On This Device · ${lc}`, icon: 'folder', fn: () => playOffline('local') },
    ], cancel: 'Not now' });
}
addEventListener('offline', () => {
  document.body.classList.add('offline');
  if (Player.cur && Player.loaded && !Player.el.paused && canPlayOffline(Player.cur)) return;
  if (!offShown && S.settings.offlineTips !== false) { offShown = true; setTimeout(() => { if (!navigator.onLine) offlineNudge(); }, 700); }
});
addEventListener('online', () => { document.body.classList.remove('offline'); offShown = false; toast('Back online'); const e = cv(); if (e.v === 'home') softRender(); });
const normT = t => String((t && t.title) || '').toLowerCase().replace(/\s*[\[(].*?[\])]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function dedupeSongs(list) { const seen = new Set(); return list.filter(t => { const k = normT(t) + '|' + String(t.artist || '').toLowerCase().split(/,|&/)[0].trim(); if (!normT(t) || seen.has(k)) return false; seen.add(k); return true; }); }
function streak() {
  const d = S.stats.days || {}; let n = 0; const day = new Date();
  if (!((d[dayKey(day)] || 0) >= 60)) day.setDate(day.getDate() - 1);
  while ((d[dayKey(day)] || 0) >= 60) { n++; day.setDate(day.getDate() - 1); }
  return n;
}
function openServerGuide() {
  const cur = (S.settings.proxy || '').replace('/?url={url}', '');
  openSheet(`<div class="sg form guide"><b class="ft">Your own free music server</b>
    <p class="fsub">Shared public servers keep getting blocked. A free server in your own Cloudflare account makes JioSaavn work: full songs without ads, downloads, and the equalizer. About 2 minutes, no card needed.</p>
    <ol class="steps">
      <li>Open <a href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noopener">dash.cloudflare.com</a> and make a free account.</li>
      <li>Go to <b>Workers &amp; Pages</b> → <b>Create</b> → <b>Create Worker</b>. Name it <b>tunetune</b> and press <b>Deploy</b>.</li>
      <li>Press <b>Edit code</b>, delete everything, paste the server code, then press <b>Deploy</b>.<button class="fb cw" data-a="copyworker">${I.copy} Copy server code</button></li>
      <li>Copy your worker’s address (like <i>tunetune.yourname.workers.dev</i>) and paste it below.</li>
    </ol>
    <input class="tin" id="relayin" placeholder="https://tunetune.yourname.workers.dev" value="${esc(cur)}" autocomplete="off" autocapitalize="off" spellcheck="false">
    <p class="relay-st" id="relayst"></p>
    ${S.settings.proxy ? `<p class="fsub">To keep it even after clearing browser data — on every device and for everyone using your site — add a file named <b>tunetune-config.json</b> to your GitHub repo.<button class="fb cw" data-a="copycfg">${I.copy} Copy file contents</button></p>` : ''}
    <div class="fbtns">${S.settings.proxy ? '<button class="fb" data-a="relayclear">Remove</button>' : '<button class="fb" data-a="sclose">Later</button>'}<button class="fb pri" data-a="relaysave">Test &amp; Save</button></div></div>`);
}
async function testSources() {
  toast('Testing music sources…'); BYPASS = true; setTimeout(() => { BYPASS = false; }, 20000);
  const lines = [];
  lines.push(`Engine: ${IT.ok ? 'YouTube Music direct' : 'public mirrors'}`);
  try { JSA.reset(); lines.push('JioSaavn relays: ' + (await JSA.diagnose()).join(' · ')); } catch (e) { }
  let tr = null;
  try { mem.delete('ys:top hits ' + YEAR); const r = await YT.songs('top hits ' + YEAR); tr = r[0]; lines.push(`Search: working (${r.length} songs)`); } catch (e) { lines.push('Search: not responding'); }
  if (tr) {
    try { Streams.drop(tr.sid); const s = await Streams.get(tr.sid, new Set(), 12000); lines.push(`Audio streams: working via ${s.via.replace(/^(piped|inv):https?:\/\//, '')}`); }
    catch (e) { lines.push('Audio streams: busy (songs play through the YouTube player instead)'); }
  }
  try {
    Saavn.fails.clear(); const r = await Saavn.songs('ilaiyaraaja'); const pk = r[0] && Saavn.pick(r[0]);
    lines.unshift(`JioSaavn: ${r.length ? `working — ${r.length} songs via ${Saavn.best || 'a backup server'}${pk ? ', audio ' + pk.kbps + ' kbps' : ''}` : 'no results'}`);
  } catch (e) { lines.unshift(`JioSaavn: not responding (${String(e.message || e).slice(0, 40)})`); }
  if (S.settings.ytPlayer) { try { await Embed.ensure(); lines.push('YouTube player: ready'); } catch (e) { lines.push('YouTube player: blocked'); } }
  lines.push(`Audio mirrors: ${MirrorHealth.ok() ? 'in use when they respond' : 'busy, skipped for now'}`);
  try { mem.delete('au:tr:week'); const a = await Audius.trending(); lines.push(`Audius: ${a.length ? 'working' : 'empty'}`); } catch (e) { lines.push('Audius: not responding'); }
  try { const r = await Radio.top(); lines.push(`Radio: ${r.length ? 'working' : 'empty'}`); } catch (e) { lines.push('Radio: not responding'); }
  BYPASS = false;
  if (Server.ok) lines.unshift(`Home Server: connected (${Server.base.replace(/^https?:\/\//, '')})`);
  actionSheet({ head: `<div class="sh col"><div class="m-t">Music sources</div><div class="m-s pre">${esc(lines.join('\n'))}</div></div>`, acts: [], cancel: 'Done' });
}

/* ================= theme ================= */
function applyTheme() {
  const s = S.settings.theme;
  const dark = s === 'dark' || (s === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const r = document.documentElement; r.dataset.theme = dark ? 'dark' : 'light'; r.style.setProperty('--accent', S.settings.accent);
  const st = S.settings;
  r.classList.toggle('still', !st.motion); r.classList.toggle('nobg', !st.animBg); r.classList.toggle('nobadge', !st.badge);
  r.dataset.lyr = st.lyricsSize || 'm';
  r.style.setProperty('--zoom', String(+st.zoom || 1));
  const m = $('meta[name="theme-color"]'); if (m) m.setAttribute('content', dark ? '#000000' : '#ffffff');
}

/* ================= navigation ================= */
const nav = { tab: 'home', stacks: { home: [{ v: 'home' }], explore: [{ v: 'explore' }], search: [{ v: 'search' }], podcasts: [{ v: 'podcasts' }], library: [{ v: 'library' }] } };
const cv = () => { const s = nav.stacks[nav.tab]; return s[s.length - 1]; };
let renderTok = 0;
function render() {
  const e = cv(); const tok = ++renderTok; const v = $('#view');
  v.classList.remove('scrolled'); v.classList.toggle('narrow', e.v === 'settings' || e.v === 'advanced');
  let html;
  try { html = (VIEWS[e.v] || VIEWS.home)(e, tok); }
  catch (err) { console.error(err); html = header('Something went wrong', { noLarge: true }) + emptyState({ icon: 'music', t: 'This page couldn’t open', d: String(err && err.message || err), btn: ['reload', 'Try Again'] }); }
  const fresh = !softing && (render.lastKey !== e.v + '|' + (e.k || '') + '|' + (e.id || e.l || e.q || ''));
  render.lastKey = e.v + '|' + (e.k || '') + '|' + (e.id || e.l || e.q || '');
  v.innerHTML = html;
  for (const im of v.querySelectorAll('img')) if (im.complete && im.naturalWidth) im.classList.add('ld');
  revealImgs();
  if (fresh && S.settings.motion !== false) { v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); clearTimeout(render.t); render.t = setTimeout(() => v.classList.remove('enter'), 500); }
  v.scrollTop = e.scroll || 0;
  setTimeout(() => { e.scroll = 0; }, 1500);
  $$('.tab').forEach(b => { const on = b.dataset.tab ? b.dataset.tab === nav.tab && e.v !== 'settings' : e.v === 'settings' || e.v === 'advanced'; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
}
let softing = false;
function softRender() {
  const v = $('#view'); const st = v.scrollTop; const rows = [...v.querySelectorAll(HSEL)].map(r => r.scrollLeft);
  softing = true; try { render(); } finally { softing = false; } v.scrollTop = st;
  [...v.querySelectorAll(HSEL)].forEach((r, i) => { if (rows[i]) { r.style.scrollBehavior = 'auto'; r.scrollLeft = rows[i]; r.style.scrollBehavior = ''; } });
}
function enter(kind = 'push') {
  const v = $('#view'); v.classList.remove('enter', 'enter-push', 'enter-pop', 'enter-tab'); void v.offsetWidth; v.classList.add('enter', 'enter-' + kind);
  clearTimeout(enter.t); enter.t = setTimeout(() => v.classList.remove('enter', 'enter-push', 'enter-pop', 'enter-tab'), 900);
}
function go(v, params = {}) {
  const st = nav.stacks[nav.tab]; st[st.length - 1].scroll = $('#view').scrollTop;
  st.push({ v, ...params }); history.pushState({ v: 1 }, ''); render(); enter();
}
function popView() { const st = nav.stacks[nav.tab]; if (st.length > 1) { st.pop(); render(); enter('pop'); } }
function switchTab(t) {
  if (!nav.stacks[t]) return;
  const v = $('#view'); const cur = nav.stacks[nav.tab]; cur[cur.length - 1].scroll = v.scrollTop;
  if (nav.tab === t) {
    if (cur.length > 1) { cur.length = 1; cur[0].scroll = 0; }
    else { v.scrollTo({ top: 0, behavior: 'smooth' }); if (t === 'search') setTimeout(() => { const i = $('#sq'); if (i) i.focus(); }, 50); return; }
  }
  nav.tab = t; render(); enter('tab');
}
function restoreScroll() { const e = cv(); if (e.scroll) { const v = $('#view'); if (v.scrollTop < e.scroll) v.scrollTop = e.scroll; } }
function fill(sel, tok, promise, fn) {
  Promise.resolve(promise).then(data => {
    if (tok !== renderTok) return; const el = $(sel); if (!el) return;
    el.innerHTML = fn(data) || ''; restoreScroll();
  }).catch(err => {
    if (err === 'stale' || tok !== renderTok) return;
    warn(err); const el = $(sel); if (el) el.innerHTML = errBox();
  });
}
// A shelf removes itself when its source has nothing, so pages never show broken sections.
function fillShelf(id, tok, loader, fn) {
  return Promise.resolve().then(loader).then(items => {
    if (tok !== renderTok) return false; const el = document.getElementById(id); if (!el) return false;
    if (!items || !items.length) { const s = el.closest('.sec'); if (s) s.remove(); return false; }
    el.innerHTML = fn(items); restoreScroll(); return true;
  }).catch(err => {
    warn(err); if (tok !== renderTok) return false;
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
const LABELS = { advanced: 'Advanced', home: 'Home', explore: 'Explore', search: 'Search', radio: 'Radio', podcasts: 'Podcasts', library: 'Library', settings: 'Settings' };
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
  if (S.settings.hideExplicit && t.explicit) return '';
  const cur = !!(Player.cur && Player.cur.id === t.id);
  const sub = o.sub ? `${t.artist} · ${o.sub}` : t.live ? t.artist : t.source === 'podcast' ? (o.show ? t.artist + ' · ' : '') + podSub(t) : [t.artist, o.album && t.album].filter(Boolean).join(' · ');
  return `<div class="row ${cur ? 'is-cur' : ''}" style="--i:${Math.min(i, 14)}" data-a="play" data-l="${k}" data-i="${i}" data-id="${esc(t.id)}">${o.num ? `<span class="num">${i + 1}</span>` : ''}
    <img class="thumb ${t.live ? 'logo' : ''}" src="${esc(artOf(t))}" alt="" loading="lazy">
    <div class="rb"><div class="rtx"><div class="rt">${cur ? BARS : ''}<span class="tx">${esc(t.title)}</span></div>
      <div class="rs">${t.live ? '<span class="badge live">LIVE</span>' : ''}${t.explicit ? '<span class="badge">E</span>' : ''}${esc(sub)}</div></div>
      ${t.source !== 'local' && isDl(t.id) ? `<span class="dlm" title="Downloaded">${I.dlok}</span>` : t.source !== 'local' && Offline.has(t.id) ? `<span class="dlm auto" title="Saved for offline">${I.dlok}</span>` : ''}${o.dur && t.duration && !t.live && t.source !== 'podcast' ? `<span class="dur">${fmt(t.duration)}</span>` : ''}
      <button class="more" data-a="more" data-l="${k}" data-i="${i}" aria-label="More options for ${esc(t.title)}">${I.more}</button></div></div>`;
}
const rowsHTML = (list, k, o) => `<div class="rows">${list.map((t, i) => rowHTML(t, k, i, o)).join('')}</div>`;
function cardHTML(t, k, i) {
  if (S.settings.hideExplicit && t.explicit) return '';
  const live = !!t.live;
  return `<div class="card" style="--i:${Math.min(i, 10)}" data-a="play" data-l="${k}" data-i="${i}" data-id="${esc(t.id)}"><div class="cw"><img class="art ${live ? 'round logo' : ''}" src="${esc(artOf(t))}" alt="" loading="lazy">
    <button class="cplay" data-a="play" data-l="${k}" data-i="${i}" aria-label="Play ${esc(t.title)}">${I.play}</button></div>
    <div class="ct ${live ? 'c' : ''}">${esc(t.title)}</div><div class="cs ${live ? 'c' : ''}">${esc(t.artist)}</div></div>`;
}
const cardsHTML = (list, k) => `<div class="hs">${list.map((t, i) => cardHTML(t, k, i)).join('')}</div>`;
function collCard(c) {
  const ar = c.kind === 'artist';
  const sub = c.sub || (c.kind === 'album' ? 'Album' : ar ? 'Artist' : c.kind === 'podcast' ? 'Podcast' : 'Playlist');
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
const TILE_EMOJI = { Comedy: '😂', News: '📰', 'True Crime': '🔍', Business: '💼', Technology: '💻', 'Health & Fitness': '💪', Education: '🎓', 'Society & Culture': '🌍', Sports: '⚽', History: '🏛️', Science: '🔬',
  Spirituality: '🕉️', 'Kids & Family': '🧸', Arts: '🎨', Music: '🎵', Electronic: '🎛️', 'Hip-Hop': '🎤', Pop: '🎉', 'R&B': '💜', 'Lo-Fi': '☕', Rock: '🎸', Alternative: '🌀', Ambient: '🌌', Jazz: '🎷', Acoustic: '🪕', House: '🏠', Latin: '💃',
  Classical: '🎻', Devotional: '🪔', World: '🌏', Soundtrack: '🎬', Chill: '🌙', Romance: '❤️', Party: '🪩', Workout: '🏋️', Focus: '🎯', Sleep: '😴', 'Feel good': '😊', Sad: '🌧️', Throwback: '📼', 'Road trip': '🚗', 'Rainy day': '☔', Dance: '💃' };
const tile = (label, attrs, h, small, deco) => { const d = deco || TILE_EMOJI[label] || ''; return `<div class="tile" style="--h:${h}" ${attrs} role="button" tabindex="0">${d ? `<i class="tdeco${deco ? ' txt' : ''}" aria-hidden="true">${esc(d)}</i>` : ''}<span>${esc(label)}${small ? `<small>${esc(small)}</small>` : ''}</span></div>`; };
const genreTiles = () => `<div class="tiles">${GENRES.map(([g, h]) => tile(g.replace('/Rap', '').replace('/Soul', ''), `data-a="genre" data-g="${esc(g)}"`, h)).join('')}</div>`;
const langTiles = () => `<div class="tiles">${LANGS.map(([l, n], i) => tile(l, `data-a="lang" data-l="${esc(l)}"`, (i * 29 + 330) % 360, n !== l ? n : '', (n || l).slice(0, n === l ? 2 : 3))).join('')}</div>`;
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
    ${n ? `<div class="ch-btns"><button class="pill" data-a="playAll" data-l="${k}">${I.play}Play</button>${live ? '' : `<button class="pill" data-a="shufAll" data-l="${k}">${I.shuffle}Shuffle</button><button class="pill icon" data-a="shareColl" data-l="${k}" aria-label="Share this playlist">${I.share}</button>`}</div>` : ''}</div></div>`;
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
function fmtDate(d) {
  if (!d) return ''; const x = new Date(d + 'T00:00:00'); if (isNaN(x)) return '';
  const days = Math.floor((Date.now() - x) / 864e5);
  if (days < 1) return 'Today'; if (days < 2) return 'Yesterday'; if (days < 7) return days + ' days ago';
  return x.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(x.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
}
function podSub(t) {
  const pp = podProg(t.id); const d = (pp && pp.dur) || t.duration; const parts = [fmtDate(t.date)];
  if (pp && pp.done) parts.push('Played'); else if (pp && pp.pos > 15 && d) parts.push(`${Math.max(1, Math.round((d - pp.pos) / 60))} min left`); else if (d) parts.push(`${Math.max(1, Math.round(d / 60))} min`);
  return parts.filter(Boolean).join(' · ');
}
const contList = () => Object.values(S.pod.prog).filter(x => x && !x.done && x.pos > 15 && x.t).sort((a, b) => b.at - a.at).slice(0, 10).map(x => x.t);
async function newEpisodes() {
  const shows = S.pod.follows.slice(0, 8);
  const all = (await Promise.allSettled(shows.map(x => Pod.episodes(x.id)))).flatMap(r => (r.status === 'fulfilled' ? r.value.eps.slice(0, 3) : []));
  return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
}
function blockTrack(t) {
  if (!S.blocked.includes(t.id)) S.blocked.push(t.id); if (S.blocked.length > 500) S.blocked.shift();
  save(); buzz(); toast('Got it — this song won’t be recommended');
}
function releasesBase() {
  if (S.settings.apkUrl) return S.settings.apkUrl.replace(/\/download\/[^/]+$/, '');
  const h = location.hostname; if (!/\.github\.io$/.test(h)) return '';
  const owner = h.split('.')[0]; const seg = location.pathname.split('/').filter(Boolean)[0];
  const repo = seg && !/\./.test(seg) ? seg : h;
  return `https://github.com/${owner}/${repo}/releases/latest`;
}
const PODCATS = [['Comedy', 20], ['News', 210], ['True Crime', 0], ['Business', 150], ['Technology', 230], ['Health & Fitness', 120], ['Education', 190], ['Society & Culture', 300],
  ['Sports', 30], ['History', 40], ['Science', 170], ['Spirituality', 270], ['Kids & Family', 330], ['Arts', 280], ['Music', 350]];
const podCats = () => [...PODCATS, ...myLangs().slice(0, 6).map((L, i) => [L, (i * 47 + 10) % 360])];
function rtags() { return [...myLangs().slice(0, 4).map(L => [L.toLowerCase(), L]), ...RTAGS_BASE]; }
function renderPodcasts(e, tok) {
  let html = header('Podcasts', { right: nbBtn('go', 'gear', 'Settings', 'data-v="settings"') }) + '<p class="greet">Shows and episodes from around the world, free.</p>';
  const cont = contList();
  if (cont.length) html += sec('Continue listening', rowsHTML(cont, reg(cont, { from: 'Continue listening' }), { show: true }));
  if (S.pod.follows.length) {
    html += sec('Your shows', `<div class="hs">${S.pod.follows.map(collCard).join('')}</div>`, { moreHTML: '<button class="see" data-a="go" data-v="coll" data-k="podshows">See All</button>' });
    html += slot('p-new', 'New episodes', 'rows', 'From shows you follow');
  }
  html += slot('p-top', `Top shows in ${countryName(detectCC())}`, 'cards');
  html += sec('Browse categories', `<div class="tiles">${podCats().map(([c, h]) => tile(c, `data-a="podcat" data-q="${esc(c)}"`, h)).join('')}</div>`);
  html += '<div id="pgn"></div>';
  setTimeout(() => {
    const ps = [fillShelf('p-top', tok, () => Pod.top(), l => `<div class="hs">${l.slice(0, 30).map(collCard).join('')}</div>`)];
    if (S.pod.follows.length) ps.push(fillShelf('p-new', tok, newEpisodes, l => rowsHTML(l, reg(l, { from: 'New episodes' }), { show: true })));
    settle(ps, tok, '#pgn');
  });
  return html;
}
function renderPod(e, tok) {
  const c = e.c || {};
  setTimeout(() => fill('#cb', tok, Pod.episodes(c.id), r => {
    const show = { ...c }; for (const [k, v] of Object.entries(r.show)) if (v) show[k] = v;
    e.c = show; e.tracks = r.eps; const k = reg(r.eps, { from: show.title });
    const fol = S.pod.follows.some(x => x.id === show.id);
    return `<div class="ch"><img class="ch-art" src="${esc(show.art || ph({ title: show.title }))}" alt=""><div class="ch-i"><h1>${esc(show.title)}</h1><p class="ch-sub">${esc([show.sub, show.genre].filter(Boolean).join(' · '))}</p>
      <div class="ch-btns">${r.eps.length ? `<button class="pill" data-a="playAll" data-l="${k}">${I.play}Latest episode</button>` : ''}<button class="pill" data-a="podfollow" id="podfol">${fol ? I.check + 'Following' : I.plus + 'Follow'}</button></div></div></div>` +
      (r.eps.length ? `<div class="sub-h">${plural(r.eps.length, 'episode')}</div>` + rowsHTML(r.eps, k) : emptyState({ icon: 'mic', t: 'No episodes available', d: 'This show has no playable episodes right now.' }));
  }));
  return header(c.title || 'Podcast', { noLarge: true }) + `<div id="cb">${collHead(c.title || '', [], '', { art: c.art, icon: c.art ? null : 'mic', sub: 'Loading…' })}<div class="spin"></div></div>`;
}
function renderReplay() {
  const top = Stats.top(30), arts = Stats.artists(10);
  const days = [...Array(7)].map((_, i) => { const d = new Date(Date.now() - (6 - i) * 864e5); return { l: d.toLocaleDateString(undefined, { weekday: 'narrow' }), m: Math.round((S.stats.days[dayKey(d)] || 0) / 60) }; });
  const mx = Math.max(1, ...days.map(d => d.m));
  const tracks = top.map(x => x.t); const k = reg(tracks, { from: 'Your top songs' });
  let html = header('Your Replay', { noLarge: true });
  html += `<div class="rp-hero"><h1>Your Replay</h1><p>Your listening, kept privately on this device.</p>
    <div class="rp-stats"><div><b>${Stats.minutes(7)}</b><span>minutes this week</span></div><div><b>${Stats.minutes(1)}</b><span>minutes today</span></div><div><b>${Stats.streak()}</b><span>day streak</span></div></div>
    <div class="rp-week" aria-label="Minutes per day this week">${days.map(d => `<div class="rp-day"><i style="height:${Math.max(4, Math.round(d.m / mx * 100))}%" title="${d.m} min"></i><span>${esc(d.l)}</span></div>`).join('')}</div>
    ${tracks.length ? `<div class="ch-btns"><button class="pill" data-a="playAll" data-l="${k}">${I.play}Play top songs</button><button class="pill" data-a="shufAll" data-l="${k}">${I.shuffle}Shuffle</button></div>` : ''}</div>`;
  if (arts.length) html += sec('Top artists', `<div class="rows">${arts.map((a, i) => `<div class="row" data-a="mix" data-c="${regc({ kind: 'seed', t: a.seed, title: a.name })}" data-title="${esc(a.name)} Mix"><span class="num">${i + 1}</span><img class="thumb round" src="${esc(artOf(a.seed))}" alt=""><div class="rb"><div class="rtx"><div class="rt"><span class="tx">${esc(a.name)}</span></div><div class="rs">${plural(a.n, 'play')} · ${Math.round(a.s / 60)} min</div></div><span class="chev">${I.chevR}</span></div></div>`).join('')}</div>`);
  html += tracks.length ? sec('Top songs', `<div class="rows">${top.map((x, i) => rowHTML(x.t, k, i, { num: true, sub: plural(x.n, 'play') })).join('')}</div>`)
    : emptyState({ icon: 'bars', t: 'Nothing here yet', d: 'Listen to a few songs and your top songs, artists and minutes will show up here.' });
  return html;
}
async function mixTracks(seed) {
  const yid = ytIdOf(seed); let out = [];
  if (seed.source === 'saavn') { try { out = await YT.related(seed); } catch (e) { } }
  else if (yid) { try { out = await YT.related({ sid: yid }); } catch (e) { } }
  if (!out.length) { try { out = await YT.songs(`${seed.artist} songs`); } catch (e) { } }
  const first = String(seed.artist || '').split(',')[0];
  const mine = Stats.top(200).map(x => x.t).filter(t => first && (t.artist || '').includes(first)).slice(0, 6);
  const seen = new Set();
  return notBlocked([seed, ...shuf(mine), ...out]).filter(t => !seen.has(t.id) && seen.add(t.id)).slice(0, 40);
}
function renderMix(e, tok) {
  const seed = e.seed || {}; const title = e.title || 'Mix';
  setTimeout(() => fill('#cb', tok, mixTracks(seed), tr => {
    e.tracks = tr; const k = reg(tr, { from: title });
    return collHead(title, tr, k, { art: artOf(seed, true), sub: `Built around ${seed.artist || 'your music'}` }) + (tr.length ? rowsHTML(tr, k, { dur: true }) : emptyState({ icon: 'music', t: 'Couldn’t build this mix right now' }));
  }));
  return header(title, { noLarge: true, right: nbBtn('savecoll', 'plus', 'Save to Library') }) + `<div id="cb">${collHead(title, [], '', { art: artOf(seed, true), sub: 'Mixing…' })}<div class="spin"></div></div>`;
}
function madeForYou() {
  const arts = Stats.artists(8).filter(a => a.seed.source === 'saavn' || ytIdOf(a.seed)).slice(0, 4);
  if (!arts.length) return '';
  const used = new Set();
  const mosaic = a => {
    const pics = []; for (const p of Object.values(S.stats.plays)) { const t = p.t; if (!t || !String(t.artist || '').includes(a.name)) continue; const u = artOf(t); if (u && !used.has(u) && !pics.includes(u) && !/^data:/.test(u)) pics.push(u); if (pics.length >= 4) break; }
    pics.forEach(u => used.add(u));
    if (pics.length >= 4) return `<div class="mosaic4">${pics.map(u => `<img src="${esc(u)}" alt="">`).join('')}</div>`;
    if (pics.length) return `<img src="${esc(pics[0])}" alt="">`;
    return `<span class="mixini">${esc(a.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase())}</span>`;
  };
  return sec((S.settings.name || '').trim() ? `Made for ${esc(S.settings.name.trim())}` : 'Made for you', `<div class="hs">${arts.map((a, i) => `<div class="card" data-a="mix" data-c="${regc({ kind: 'seed', t: a.seed, title: a.name })}" data-title="Daily Mix ${i + 1}"><div class="cw"><div class="art mixart" style="--h:${(hue(a.name) + i * 60) % 360}">${mosaic(a)}<b>Daily Mix ${i + 1}</b></div></div><div class="ct">Daily Mix ${i + 1}</div><div class="cs">${esc(a.name)} and more</div></div>`).join('')}
    <div class="card" data-a="go" data-v="coll" data-k="replay"><div class="cw"><div class="art mixart rp" style="--h:330">${I.bars}<b>Replay</b></div></div><div class="ct">Your Replay</div><div class="cs">Top songs &amp; minutes</div></div></div>`);
}
const KINDS = {
  liked: { title: 'Favorite Songs', icon: 'heartFill', get: () => S.liked.filter(t => !t.live), empty: { icon: 'heart', t: 'No favorites yet', d: 'Tap the heart on any song to keep it here.' } },
  stations: { title: 'Saved Stations', icon: 'radio', get: () => S.liked.filter(t => t.live), empty: { icon: 'radio', t: 'No saved stations', d: 'Save live stations from their ••• menu to find them fast.' } },
  offline: { title: 'Offline Mix', icon: 'shuffle', get: () => offlineList(), empty: { icon: 'download', t: 'Nothing saved yet', d: 'Downloads and the songs you play are kept here so they play without internet.' } },
  downloads: { title: 'Downloaded', icon: 'download', get: () => S.downloads, empty: { icon: 'download', t: 'No downloads', d: 'Download songs from their ••• menu to play them offline, even in airplane mode.' } },
  locals: { title: 'On This Device', icon: 'folder', get: () => S.locals, empty: { icon: 'folder', t: 'No device music', d: 'Add MP3, M4A, FLAC, WAV or OGG files from this phone or computer.', btn: ['import', 'Add Music Files'] } },
  history: { title: 'Recently Played', icon: 'clock', get: () => S.history, empty: { icon: 'clock', t: 'Nothing played yet', d: 'Songs and stations you play show up here.' } },
  trending: { title: 'Trending on Audius', load: e => Audius.trending(e.g || '') },
  under: { title: 'Fresh Underground', load: () => Audius.underground() },
  artist: { title: 'Artist', load: e => Audius.userTracks(e.id) },
  rtag: { title: 'Stations', icon: 'radio', load: e => Radio.tag(e.g) },
};
const viaLabel = v => !v ? 'Nothing played yet' : v === 'saavn' ? 'JioSaavn (clean audio)' : v === 'preloaded' ? 'Preloaded' : v === 'embed' ? 'YouTube player' : v === 'direct' ? 'Direct audio' : v === 'saved' ? 'Downloaded file' : v === 'preview' ? 'Preview' : v === 'radio' ? 'Live radio' : v === 'audius' ? 'Audius' : 'Audio mirror';
const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Late night listening' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
async function quickPicks() {
  const seed = S.history.find(t => t.source === 'saavn' || t.source === 'yt' || t.ytId);
  if (seed) { try { const r = await YT.related(seed.source === 'saavn' ? seed : { sid: ytIdOf(seed) }); if (r.length) return r; } catch (e) { } }
  return YT.langTop(myLangs()[0]);
}
function renderHome(e, tok) {
  const stk = streak();
  const nm = (S.settings.name || '').trim();
  let html = header('Home', { right: nbBtn('go', 'gear', 'Settings', 'data-v="settings"') }) + `<p class="greet">${greeting()}${nm ? ', ' + esc(nm) : ''}${stk >= 2 ? ` <span class="streak" title="Days in a row you listened">🔥 ${stk}-day streak</span>` : ''}</p>`;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!standalone && !S.noInstall && Object.keys(S.stats.plays || {}).length >= 3 && (deferredInstall || IS_IOS)) html += `<div class="nudge"><div class="nudge-ic">${I.music}</div><div class="nudge-t"><b>Get the Tune Tune app</b><span>${IS_IOS ? 'Tap Share, then “Add to Home Screen”' : 'Opens instantly and plays from your lock screen'}</span></div>${IS_IOS ? '' : '<button class="fb pri" data-a="install">Install</button>'}<button class="nudge-x" data-a="noinstall" aria-label="Dismiss">${I.x}</button></div>`;
  if (!navigator.onLine) {
    html += `<div class="note">${I.wifiOff}<span>You’re offline. Downloads and music on this device still play.</span></div>`;
    const off = offlineList();
    if (off.length) html += `<div class="off-card"><div><b>Offline Mix</b><span>${plural(off.length, 'song')} — downloads, recently played and your own files</span></div><button class="fb pri" data-a="offmix">${I.shuffle}Play</button></div>`;
    return html + (off.length ? sec('Available offline', rowsHTML(off, reg(off, { from: 'Offline' }), { dur: true })) : emptyState({ icon: 'download', t: 'Nothing saved offline', d: 'Next time you’re online, download songs to keep them here.' }));
  }
  setTimeout(warmLangs, 2500);
  const sv = (S.cached || []).filter(t => S.settings.mixPods || t.source !== 'podcast');
  if (S.settings.savedCard !== false && sv.length >= 3) html += `<div class="saved-card"><div class="sc-arts">${sv.slice(0, 3).map(t => `<img src="${esc(artOf(t))}" alt="">`).join('')}</div><div class="sc-t"><b>Ready offline</b><span>Your last ${plural(sv.length, 'song')} — plays without internet</span></div><button class="np-ib" data-a="savedplay" aria-label="Play in order">${I.play}</button><button class="np-ib" data-a="savedshuf" aria-label="Shuffle">${I.shuffle}</button></div>`;
  const sug = langSuggest(); if (sug) html += `<div class="lang-sug"><span>You’ve been listening to a lot of <b>${esc(sug)}</b> music</span><button class="fb pri" data-a="addlang" data-l="${esc(sug)}">Add ${esc(sug)}</button><button class="nudge-x" data-a="nolang" data-l="${esc(sug)}" aria-label="Dismiss">${I.x}</button></div>`;
  const langs = myLangs();
  html += `<div class="chips pg">${langs.map(L => `<button class="chip" data-a="lang" data-l="${esc(L)}">${esc(L)}</button>`).join('')}<button class="chip ghost" data-a="langs">${I.plus}Languages</button></div>`;
  if (false) html += `<div class="appcard"><img src="icons/icon-192.png" alt=""><div class="ac-tx"><b>Get Tune Tune for Android</b><span>Ad-free audio that keeps playing with the screen off.</span></div><button class="btn sm" data-a="getapp">Get</button><button class="ac-x" data-a="hideapp" aria-label="Dismiss">${I.x}</button></div>`;
  if (S.history.length) { const r = dedupeSongs(S.history).slice(0, 16); html += sec('Recently played', cardsHTML(r, reg(r, { from: 'Recently played', hist: true })), { moreK: 'history' }); }
  const hs = S.settings.homeSections;
  if (hs.mixes) html += madeForYou();
  const cont = contList().slice(0, 4); if (cont.length) html += sec('Continue listening', rowsHTML(cont, reg(cont, { from: 'Continue listening' }), { show: true }), { moreTab: 'podcasts' });
  html += slot('h-qp', 'Quick picks', 'rows', 'Songs picked for you');
  html += '<div id="h-ytm"></div>';
  if (hs.following && S.artists.length) html += slot('h-fa', 'From artists you follow', 'rows', S.artists.slice(0, 3).map(a => a.title).join(', '), { moreHTML: '<button class="see" data-a="go" data-v="coll" data-k="artists">See All</button>' });
  if (hs.langs) langs.slice(0, 3).forEach((L, i) => {
    html += slot(`h-l${i}s`, `Top ${L} songs`, 'rows', '', { moreHTML: `<button class="see" data-a="lang" data-l="${esc(L)}">See All</button>` });
    html += slot(`h-l${i}p`, `${L} playlists`, 'cards');
  });
  if (hs.chart) html += slot('h-ch', 'Top hits worldwide', 'rows', 'The global chart, updated daily', { moreHTML: '<button class="see" data-a="chart" data-r="global" data-title="Global top songs">See All</button>' });
  if (hs.radio) html += slot('h-rd', 'Live radio', 'round', `Popular in ${countryName(detectCC())}`, { moreHTML: '<button class="see" data-a="go" data-v="radio">See All</button>' });
  if (hs.podcasts) html += slot('h-pd', 'Popular podcasts', 'cards', '', { moreTab: 'podcasts' });
  if (hs.free) html += slot('h-au', 'Free & independent', 'cards', 'Fresh music from Audius artists', { moreK: 'trending' });
  if (hs.moods) html += sec('Moods & moments', moodTiles(8));
  html += `<div id="h-n"></div><p class="foot">${TITLE} is free. No account, no ads.</p>`;
  setTimeout(() => {
    const ps = [fillShelf('h-qp', tok, quickPicks, items => shelfBody(notBlocked(items), 'Quick picks'))];
    if (S.artists.length) ps.push(fillShelf('h-fa', tok, async () => {
      const lists = await Promise.allSettled(S.artists.slice(0, 5).map(a => YT.songs(`${a.title} new song ${YEAR}`)));
      const out = []; lists.forEach(r => { if (r.status === 'fulfilled') out.push(...r.value.slice(0, 4)); });
      const seen = new Set(); return notBlocked(out).filter(t => !seen.has(t.id) && seen.add(t.id));
    }, items => shelfBody(items, 'From artists you follow')));
    langs.slice(0, 3).forEach((L, i) => {
      ps.push(fillShelf(`h-l${i}s`, tok, () => YT.langTop(L), items => shelfBody(items, `Top ${L} songs`)));
      ps.push(fillShelf(`h-l${i}p`, tok, () => YT.playlists(`${L} hits ${YEAR}`), items => shelfBody(items, `${L} playlists`)));
    });
    ps.push(fillShelf('h-ch', tok, () => Deezer.chart(), l => { const k = reg(l, { from: 'Top hits worldwide' }); return `<div class="cg">${l.slice(0, 24).map((t, i) => rowHTML(t, k, i, { num: true })).join('')}</div>`; }));
    ps.push(fillShelf('h-rd', tok, () => Radio.country(detectCC()).then(l => (l.length ? l : Radio.top())), l => { const s = l.slice(0, 16); return cardsHTML(s, reg(s, { from: 'Live radio' })); }));
    ps.push(fillShelf('h-pd', tok, () => Pod.top(), l => `<div class="hs">${l.slice(0, 16).map(collCard).join('')}</div>`));
    ps.push(fillShelf('h-au', tok, () => Audius.trending(), l => cardsHTML(l.slice(0, 20), reg(l, { from: 'Free & independent' }))));
    settle(ps, tok, '#h-n');
    IT.probe().then(ok => (ok ? IT.home() : null)).then(sh => {
      if (!sh || tok !== renderTok) return; const box = $('#h-ytm');
      if (box) box.innerHTML = sh.filter(x => x.items.length).slice(0, 8).map(s => sec(s.title || 'For you', shelfBody(s.items, s.title || 'For you'))).join('');
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
  html += sec('Live radio', `<div class="tiles">${rtags().slice(0, 7).map(([g, l], i) => tile(l, `data-a="rtag" data-g="${g}" data-title="${esc(l)}"`, (i * 37 + 200) % 360)).join('')}${tile('All stations', 'data-a="go" data-v="radio"', 0)}</div>`, { sub: 'Thousands of stations, live' });
  html += sec('Free & independent', genreTiles(), { sub: 'Full songs shared by Audius artists' });
  setTimeout(() => IT.probe().then(ok => (ok ? IT.moods() : null)).then(groups => {
    if (!groups || tok !== renderTok) return; const box = $('#ex-ytm'); if (!box) return;
    box.innerHTML = groups.slice(0, 4).map(g => sec(g.title, `<div class="tiles">${g.items.map(b => `<div class="tile" style="${b.color ? `background:${argb(b.color)}` : `--h:${hue(b.title)}`}" data-a="ytcat" data-p="${esc(b.params)}" data-title="${esc(b.title)}" role="button" tabindex="0"><span>${esc(b.title)}</span></div>`).join('')}</div>`, { sub: 'From YouTube Music' })).join('');
  }).catch(() => { }));
  return html;
}
let langWarm = 0;
function warmLangs() {
  if (langWarm || !navigator.onLine || slowNet()) return; langWarm = 1;
  const jobs = []; myLangs().slice(0, 2).forEach(L => langDefs(L).slice(0, 2).forEach(d => jobs.push(d[1])));
  const next = async () => {
    const f = jobs.shift(); if (!f) return;
    if (Player.loading || document.hidden) { setTimeout(next, 2500); jobs.unshift(f); return; }
    try { await f(); } catch (e) { }
    setTimeout(next, 600);
  };
  if (window.requestIdleCallback) requestIdleCallback(next, { timeout: 6000 }); else setTimeout(next, 4000);
}
function langDefs(L) {
  return [
    ['Top songs', () => YT.langTop(L), 'rows'],
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
const SCH = [['all', 'All'], ['songs', 'Songs'], ['podcasts', 'Podcasts'], ['episodes', 'Episodes'], ['artists', 'Artists'], ['albums', 'Albums'], ['playlists', 'Playlists'], ['radio', 'Radio'], ['free', 'Free music'], ['lib', 'Library']];
function renderSearch(e) {
  e.seg = e.seg || 'all'; const q = e.q || '';
  setTimeout(() => { const i = $('#sq'); if (!i) return; i.value = q; q.trim() ? runSearch(e) : showSearchHome(); });
  return header('Search') + `<div class="sbar"><label class="sfield ${q ? 'has' : ''}">${I.search}<input id="sq" type="search" placeholder="Songs, artists, podcasts, stations" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Search">
    <button class="sx" data-a="sclear" aria-label="Clear search">${I.x}</button>${(window.SpeechRecognition || window.webkitSpeechRecognition) ? `<button class="smic" data-a="voice" aria-label="Voice search">${I.mic}</button>` : ''}</label></div>
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
  }, 200);
  sDeb = setTimeout(() => runSearch(e), 450);
}
function showSearchHome() {
  const box = $('#sres'); if (!box) return; ++sTok;
  let h = '';
  if (S.searches.length) h += `<div class="sub-h row-h"><span>Recent</span><button class="see" data-a="clearRecent">Clear all</button></div><div class="rows">${S.searches.map(q => `<div class="row" data-a="recent" data-q="${esc(q)}"><span class="thumb ptile ghost">${I.clock}</span><div class="rb"><div class="rtx"><div class="rt"><span class="tx">${esc(q)}</span></div></div><button class="more" data-a="rmrecent" data-q="${esc(q)}" aria-label="Remove ${esc(q)}">${I.x}</button></div></div>`).join('')}</div>`;
  h += `<div class="sub-h">Browse by language</div>${langTiles()}<div class="sub-h">Moods & moments</div>${moodTiles()}<div class="sub-h">Podcast categories</div><div class="tiles">${PODCATS.slice(0, 8).map(([c, hh]) => tile(c, `data-a="podcat" data-q="${esc(c)}"`, hh)).join('')}</div>`;
  box.innerHTML = h;
}
function libSearch(q) {
  q = q.toLowerCase(); const pool = new Map();
  [...S.liked, ...S.downloads, ...S.locals, ...S.history, ...S.playlists.flatMap(p => p.tracks)].forEach(t => {
    if (!pool.has(t.id) && `${t.title} ${t.artist} ${t.album || ''}`.toLowerCase().includes(q)) pool.set(t.id, t);
  });
  return { tracks: [...pool.values()], pls: S.playlists.filter(p => p.name.toLowerCase().includes(q)) };
}
const normQ = x => String(x || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
function matchScore(q, ...fields) {
  const nq = normQ(q); if (!nq) return 0; let best = 0;
  for (const f of fields) {
    const nf = normQ(f); if (!nf) continue;
    if (nf === nq) best = Math.max(best, 100);
    else if (nf.startsWith(nq)) best = Math.max(best, 88);
    else if (nf.includes(nq)) best = Math.max(best, 75);
    else { const w = nq.split(' ').filter(x => x.length > 1); const hit = w.filter(x => nf.includes(x)).length; if (w.length) best = Math.max(best, Math.round(60 * hit / w.length)); }
  }
  return best;
}
function topCard(kind, item, k) {
  if (kind === 'song') return `<div class="topres" data-a="play" data-l="${k}" data-i="0" data-id="${esc(item.id)}"><img src="${esc(artOf(item, true))}" alt=""><div class="tr-tx"><b>${esc(item.title)}</b><span>Song · ${esc(item.artist)}</span></div><button class="btn sm" data-a="play" data-l="${k}" data-i="0">${I.play}Play</button></div>`;
  const c = regc(item); const ar = kind === 'artist';
  return `<div class="topres" data-a="openc" data-c="${c}"><img class="${ar ? 'round' : ''}" src="${esc(item.art || ph({ title: item.title }))}" alt=""><div class="tr-tx"><b>${esc(item.title)}</b><span>${ar ? 'Artist' : 'Podcast · ' + esc(item.sub || '')}</span></div><button class="btn sm ghost" data-a="openc" data-c="${c}">${ar ? 'View' : 'Episodes'}</button></div>`;
}
async function runSearch(e) {
  const q = (e.q || '').trim(); const box = $('#sres'); if (!box) return;
  if (!q) return showSearchHome();
  const tok = ++sTok;
  const none = `<div class="empty">${I.search}<h3>No results for “${esc(q)}”</h3><p>Check the spelling, or try another tab above.</p></div>`;
  const live = () => tok === sTok && $('#sres') === box;
  const seeAll = s => `<button class="see" data-a="sseg" data-s="${s}">See All</button>`;
  if (e.seg === 'all') {
    box.innerHTML = `<div id="s-top"><div class="spin"></div></div><div id="s-songs"></div><div id="s-pods"></div><div id="s-eps"></div><div id="s-arts"></div><div id="s-albs"></div><div id="s-pls"></div><div id="s-none"></div>`;
    const put = (id, html) => { if (!live()) return; const el = document.getElementById(id); if (el) el.innerHTML = html; };
    const songsP = YT.songs(q).catch(() => []), artsP = YT.artists(q).catch(() => []), podsP = Pod.search(q).catch(() => []);
    songsP.then(songs => { if (!songs.length) return; const k = reg(songs, { from: `Search: ${q}` }); e.sk = k; put('s-songs', `<div class="sub-h row-h"><span>Songs</span>${seeAll('songs')}</div>` + rowsHTML(songs.slice(0, 5), k, { dur: true })); });
    podsP.then(pods => { if (pods.length) put('s-pods', `<div class="sub-h row-h"><span>Podcasts</span>${seeAll('podcasts')}</div><div class="hs">${pods.slice(0, 12).map(collCard).join('')}</div>`); });
    artsP.then(arts => { if (arts.length) put('s-arts', `<div class="sub-h row-h"><span>Artists</span>${seeAll('artists')}</div><div class="hs">${arts.slice(0, 10).map(collCard).join('')}</div>`); });
    Pod.searchEpisodes(q).then(eps => { if (eps.length) { const k = reg(eps, { from: `Episodes: ${q}` }); put('s-eps', `<div class="sub-h row-h"><span>Episodes</span>${seeAll('episodes')}</div>` + rowsHTML(eps.slice(0, 4), k, { show: true })); } }).catch(() => { });
    YT.albums(q).then(r => { if (r.length) put('s-albs', `<div class="sub-h row-h"><span>Albums</span>${seeAll('albums')}</div><div class="hs">${r.slice(0, 10).map(collCard).join('')}</div>`); }).catch(() => { });
    YT.playlists(q).then(r => { if (r.length) put('s-pls', `<div class="sub-h row-h"><span>Playlists</span>${seeAll('playlists')}</div><div class="hs">${r.slice(0, 10).map(collCard).join('')}</div>`); }).catch(() => { });
    const soon = (pr, ms) => Promise.race([pr, new Promise(r => setTimeout(() => r(null), ms))]);
    const songs = await songsP; if (!live()) return;
    const [arts0, pods0] = await Promise.all([soon(artsP, songs.length ? 1500 : 6000), soon(podsP, songs.length ? 1500 : 6000)]);
    const arts = arts0 || [], pods = pods0 || [];
    if (!live()) return;
    // Best match wins; ties go podcast > artist > song. Weak matches never beat the first song.
    const rank = { podcast: 3, artist: 2, song: 1 }; const cands = [];
    pods.slice(0, 3).forEach(p => cands.push({ kind: 'podcast', item: p, s: matchScore(q, p.title, p.sub) }));
    if (arts[0]) cands.push({ kind: 'artist', item: arts[0], s: matchScore(q, arts[0].title) });
    if (songs[0]) cands.push({ kind: 'song', item: songs[0], s: Math.max(matchScore(q, songs[0].title), matchScore(q, songs[0].artist), matchScore(q, `${songs[0].title} ${songs[0].artist}`)) });
    const strong = cands.filter(c => c.s >= 70).sort((x, y) => y.s - x.s || rank[y.kind] - rank[x.kind]);
    const best = strong[0] || (songs[0] ? { kind: 'song', item: songs[0] } : arts[0] ? { kind: 'artist', item: arts[0] } : pods[0] ? { kind: 'podcast', item: pods[0] } : null);
    put('s-top', best ? `<div class="sub-h">Top result</div>${topCard(best.kind, best.item, e.sk || reg(songs, { from: `Search: ${q}` }))}` : '');
    if (!songs.length && !arts.length && !pods.length) {
      const au = await Audius.search(q).catch(() => []); if (!live()) return;
      put('s-none', au.length ? `<div class="note">${I.pulse}<span>Music sources are busy right now, so here are free full songs. Try again in a minute for everything else.</span></div>` + rowsHTML(au, reg(au, { from: `Search: ${q}` }), { dur: true }) : none);
    }
    return;
  }
  box.innerHTML = '<div class="spin"></div>';
  try {
    let html = '';
    if (e.seg === 'songs') { const r = await YT.songs(q); if (!live()) return; if (r.length) html = rowsHTML(r, reg(r, { from: `Search: ${q}` }), { dur: true }); }
    else if (e.seg === 'albums') { const r = await YT.albums(q); if (!live()) return; if (r.length) html = gridCards(r); }
    else if (e.seg === 'artists') { const r = await YT.artists(q); if (!live()) return; if (r.length) html = gridCards(r); }
    else if (e.seg === 'playlists') { const r = await YT.playlists(q); if (!live()) return; if (r.length) html = gridCards(r); }
    else if (e.seg === 'podcasts') { const r = await Pod.search(q); if (!live()) return; if (r.length) html = gridCards(r); }
    else if (e.seg === 'episodes') { const r = await Pod.searchEpisodes(q); if (!live()) return; if (r.length) html = rowsHTML(r, reg(r, { from: `Episodes: ${q}` }), { show: true }); }
    else if (e.seg === 'radio') { const tr = await Radio.search(q); if (!live()) return; if (tr.length) html = rowsHTML(tr, reg(tr, { from: 'Radio' })); }
    else if (e.seg === 'free') { const tr = await Audius.search(q); if (!live()) return; if (tr.length) html = rowsHTML(tr, reg(tr, { from: `Free music: ${q}` }), { dur: true }); }
    else {
      const { tracks, pls } = libSearch(q);
      if (pls.length) html += `<div class="sub-h">Playlists</div><div class="hs">${pls.map(myPlCard).join('')}</div>`;
      if (tracks.length) html += `<div class="sub-h">Songs & stations</div>` + rowsHTML(tracks, reg(tracks, { from: 'Library' }));
    }
    if (live()) box.innerHTML = html || none;
  } catch (err) { warn(err); if (live()) box.innerHTML = errBox('Search isn’t responding', 'Music sources may be busy. Try again in a moment.'); }
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
  if (s === 'genres') { box.innerHTML = `<div class="tiles">${rtags().map(([g, l], i) => tile(l, `data-a="rtag" data-g="${g}" data-title="${esc(l)}"`, (i * 37 + 200) % 360)).join('')}</div>`; return; }
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
    ['downloads', 'Downloaded', 'download', S.downloads.length], ['offline', 'Offline Mix', 'shuffle', offlineList().length], ['locals', 'On This Device', 'folder', S.locals.length],
    ['podshows', 'Podcasts', 'mic', S.pod.follows.length], ['artists', 'Artists', 'user', S.artists.length],
    ['stations', 'Saved Stations', 'radio', KINDS.stations.get().length], ['history', 'Recently Played', 'clock', S.history.length], ['replay', 'Your Replay', 'bars', 0]];
  let html = header('Library', { right: nbBtn('newpl', 'plus', 'New playlist') + nbBtn('go', 'gear', 'Settings', 'data-v="settings"') });
  html += `<div class="nl">${items.map(([k, l, ic, n]) => `<div class="nli" data-a="go" data-v="coll" data-k="${k}" role="button" tabindex="0">${I[ic]}<div class="nb2"><span>${l}</span><span class="cnt">${n || ''}</span><span class="chev">${I.chevR}</span></div></div>`).join('')}</div>`;
  html += `<div class="nl"><div class="nli" data-a="importpl" role="button" tabindex="0">${I.link}<div class="nb2"><span>Import a YouTube playlist</span><span class="chev">${I.chevR}</span></div></div></div>`;
  if (S.playlists.length) html += sec('Your playlists', `<div class="hs">${S.playlists.map(myPlCard).join('')}</div>`);
  if (S.history.length) { const r = dedupeSongs(S.history).slice(0, 12); html += sec('Recently played', cardsHTML(r, reg(r, { from: 'Recently played', hist: true })), { moreK: 'history' }); }
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
  const followed = ar && S.artists.some(x => x.id === c.id);
  const right = ar ? nbBtn('followart', followed ? 'check' : 'plus', followed ? 'Unfollow artist' : 'Follow artist') : nbBtn('savecoll', 'plus', 'Save to Library') + nbBtn('dlall', 'download', 'Download all');
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
  if (e.k === 'pod') return renderPod(e, tok);
  if (e.k === 'replay') return renderReplay();
  if (e.k === 'mix') return renderMix(e, tok);
  if (e.k === 'podcat') { setTimeout(() => fill('#pg', tok, Pod.search(`${e.q} podcast`), l => (l.length ? gridCards(l) : emptyState({ icon: 'mic', t: 'No shows found' })))); return header(e.title) + '<div id="pg"><div class="spin"></div></div>'; }
  if (e.k === 'podshows') return header('Your shows') + (S.pod.follows.length ? gridCards(S.pod.follows) : emptyState({ icon: 'mic', t: 'No shows yet', d: 'Tap Follow on any podcast to see it here.', btn: ['gopod', 'Find Podcasts'] }));
  if (e.k === 'artists') return header('Artists') + (S.artists.length ? gridCards(S.artists) : emptyState({ icon: 'user', t: 'No artists yet', d: 'Tap + on an artist’s page to follow them.' }));
  if (e.k === 'lang') { const n = (LANGS.find(x => x[0] === e.l) || [])[1]; return defsPage(tok, e.l, n && n !== e.l ? n : '', langDefs(e.l)); }
  if (e.k === 'mood') return defsPage(tok, e.m, '', moodDefs(e.m));
  if (e.k === 'chart') {
    const fb = chartDefs(e.r);
    if (e.r !== 'viral') return dynPage(tok, e.title, 'From YouTube Music charts', async () => ((await IT.probe()) ? IT.charts(e.r === 'global' ? 'ZZ' : e.r) : null), fb);
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
const sLi = o => `<div class="li" ${o.a ? `data-a="${o.a}" role="button" tabindex="0"` : ''} ${o.extra || ''}>${o.img ? `<img class="lic limg" src="${o.img}" alt="">` : o.icon ? `<span class="lic" style="background:${o.color || 'var(--accent)'}">${I[o.icon]}</span>` : ''}
    <div class="lb"><span class="lx ${o.danger ? 'danger' : ''} ${o.small ? 'small' : ''}" ${o.id ? `id="${o.id}"` : ''}>${esc(o.label)}${o.hint ? `<small class="lh">${esc(o.hint)}</small>` : ''}</span>${o.value !== undefined ? `<span class="lv">${esc(o.value)}</span>` : ''}${o.ctl || ''}${o.chev ? `<span class="chev">${I.chevR}</span>` : ''}</div></div>`;
const sGrp = (t, inner, foot) => `<div class="grp-t">${esc(t)}</div><div class="grp">${inner}</div>${foot ? `<p class="grp-f">${esc(foot)}</p>` : ''}`;
const sSw = (k, v) => `<label class="sw"><input type="checkbox" data-set="${k}" ${v ? 'checked' : ''}><span></span></label>`;
const sSeg = (k, opts, cur) => `<div class="pad"><div class="seg">${opts.map(([v, l]) => `<button data-a="setv" data-k="${k}" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
const sRow = (label, inner, hint) => `<div class="li"><div class="lb"><span class="lx">${esc(label)}${hint ? `<small class="lh">${esc(hint)}</small>` : ''}</span></div></div>${inner}`;
function renderSettings() {
  const s = S.settings; const hs = s.homeSections;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true || NATIVE;
  const timerVal = Player.sleepEnd ? 'End of song' : Player.sleepAt ? `${Math.ceil((Player.sleepAt - Date.now()) / 60000)} min` : 'Off';
  setTimeout(() => { storageNote('#stor2'); if (IS_DESKTOP) serverPanel(); });
  return header('Settings') +
    sGrp('You', sLi({ icon: 'user', color: '#bf5af2', label: 'Your name', value: S.settings.name || 'Add your name', a: 'setname', chev: true })) +
    sGrp('Music',
      sLi({ icon: 'globe', color: '#ff375f', label: 'Languages', value: myLangs().slice(0, 3).join(', ') + (myLangs().length > 3 ? ` +${myLangs().length - 3}` : ''), a: 'langs', chev: true }) +
      sLi({ icon: 'bars', color: '#30d158', label: 'Your Replay', a: 'go', extra: 'data-v="coll" data-k="replay"', chev: true }) +
      sRow('Streaming quality', sSeg('quality', [['auto', 'Auto'], ['high', 'Highest'], ['normal', 'Normal'], ['saver', 'Data saver']], s.quality), 'Auto lowers quality on slow or data-saver connections so music never stops') +
      sLi({ icon: 'volHigh', color: '#bf5af2', label: 'Normalize volume', hint: 'Every song plays at a similar loudness', ctl: sSw('normalize', s.normalize) }) +
      sLi({ icon: 'download', color: '#0a84ff', label: 'Preload next song', hint: 'No gaps or buffering between songs', ctl: sSw('preload', s.preload) }) +
      (IS_IOS ? '' : `<div class="li"><div class="lb"><span class="lx">Crossfade<small class="lh">Blend the end of one song into the next</small></span><span class="lv" id="v-crossfade">${+s.crossfade ? s.crossfade + ' s' : 'Off'}</span></div></div><div class="pad"><input class="slider" type="range" min="0" max="12" step="1" value="${+s.crossfade || 0}" data-set="crossfade" style="--p:${((+s.crossfade || 0) / 12) * 100}%" aria-label="Crossfade seconds"></div>`)) +
    sGrp('Playback',
      sLi({ icon: 'eq', color: '#ff9f0a', label: 'Equalizer', value: IS_IOS ? 'Not on iPhone' : s.eqOn ? eqName() : 'Off', a: 'eq', chev: true }) +
      (!IS_IOS && eqPins().length ? `<div class="pad"><div class="chips eqpins">${eqPins().filter(n => eqFind(n)).map(n => `<button class="chip ${s.eqOn && eqName() === n ? 'on' : ''}" data-a="eqp" data-n="${esc(n)}">${I.pin}${esc(n)}</button>`).join('')}</div></div>` : '') +
      sLi({ icon: 'infinity', color: '#30d158', label: 'Autoplay similar songs', ctl: sSw('autoplay', s.autoplay) }) +
      sLi({ label: 'Resume after calls', hint: 'Music continues by itself when a phone call or alarm ends', ctl: sSw('autoResume', S.settings.autoResume !== false) }) +
      sLi({ label: 'Mix podcasts with songs', hint: 'Off keeps podcasts and songs in separate queues', ctl: sSw('mixPods', !!S.settings.mixPods) }) +
      (IS_CAP || window.ttDesktop ? sLi({ label: 'Remind me after 3 days away', hint: 'A gentle notification if you haven’t listened for a while', ctl: sSw('remind3', S.settings.remind3 !== false) }) + '' : '') +
      sLi({ label: 'Car Mode in landscape', hint: 'Phones switch to big Car Mode controls when turned sideways', ctl: sSw('landCar', S.settings.landCar) }) +
      sLi({ icon: 'timer', color: '#5e5ce6', label: 'Sleep Timer', value: timerVal, a: 'sleep', chev: true }) +
      sLi({ icon: 'speed', color: '#0a84ff', label: 'Music speed', value: Player.rate + '×', a: 'speed', chev: true }) +
      sLi({ icon: 'radio', color: '#ff375f', label: 'Region', ctl: `<select class="sel" data-set="country" aria-label="Region">${COUNTRIES.map(([c, n]) => `<option value="${c}" ${s.country === c ? 'selected' : ''}>${n}</option>`).join('')}</select>` })) +
    sGrp('Podcasts',
      sRow('Podcast speed', sSeg('podSpeed', [[1, '1×'], [1.25, '1.25×'], [1.5, '1.5×'], [1.75, '1.75×'], [2, '2×']], s.podSpeed)) +
      sRow('Skip back', sSeg('podBack', [[10, '10 s'], [15, '15 s'], [30, '30 s']], s.podBack)) +
      sRow('Skip forward', sSeg('podFwd', [[15, '15 s'], [30, '30 s'], [45, '45 s']], s.podFwd))) +
    sGrp('Home screen',
      sRow('Open the app on', sSeg('startTab', [['home', 'Home'], ['explore', 'Explore'], ['podcasts', 'Podcasts'], ['library', 'Library']], s.startTab)) +
      [['mixes', 'Daily Mixes'], ['following', 'Artists you follow'], ['langs', 'Your languages'], ['chart', 'Top hits worldwide'], ['radio', 'Live radio'], ['podcasts', 'Popular podcasts'], ['free', 'Free & independent'], ['moods', 'Moods & moments']]
        .map(([k, l]) => sLi({ label: l, ctl: sSw('home.' + k, hs[k]) })).join(''),
      'Choose what shows on your Home page.') +
    sGrp('Appearance',
      sSeg('theme', [['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']], s.theme) +
      `<div class="sws" role="group" aria-label="Accent color">${ACCENTS.map(c => `<button class="swc ${s.accent === c ? 'on' : ''}" style="--c:${c}" data-a="accent" data-c="${c}" aria-label="Accent color ${c}"></button>`).join('')}</div>` +
      sRow('Display size', sSeg('zoom', [[0.9, 'Small'], [1, 'Default'], [1.1, 'Large'], [1.2, 'Larger']], s.zoom)) +
      sRow('Lyrics size', sSeg('lyricsSize', [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']], s.lyricsSize)) +
      sLi({ label: 'Animations', ctl: sSw('motion', s.motion) }) +
      sLi({ label: 'Moving Now Playing background', ctl: sSw('animBg', s.animBg) }) +
      sLi({ label: 'Show audio quality badge', ctl: sSw('badge', s.badge) }) +
      sLi({ label: 'Vibration feedback', ctl: sSw('haptics', s.haptics) })) +
    sGrp('Library & privacy',
      sLi({ label: 'Pause listening history', hint: 'New plays won’t be added to Recently Played', ctl: sSw('pauseHistory', s.pauseHistory) }) +
      sLi({ label: 'Hide explicit songs', ctl: sSw('hideExplicit', s.hideExplicit) }) +
      sLi({ label: 'Auto-download favorites', hint: 'Songs you favorite are saved for offline', ctl: sSw('smartDl', s.smartDl) }) +
      (S.history.length ? sLi({ label: 'Clear Listening History', danger: true, a: 'clearHist' }) : '') +
      (S.searches.length ? sLi({ label: 'Clear Search History', danger: true, a: 'clearRecent' }) : '')) +
    sGrp('Storage',
      sLi({ icon: 'download', color: '#30d158', label: 'Downloaded', value: String(S.downloads.length), a: 'go', extra: 'data-v="coll" data-k="downloads"', chev: true }) +
      sLi({ icon: 'folder', color: '#8e8e93', label: 'On This Device', value: String(S.locals.length), a: 'go', extra: 'data-v="coll" data-k="locals"', chev: true }) +
      sLi({ label: 'Show “Ready offline” on Home', ctl: sSw('savedCard', S.settings.savedCard !== false) }) +
      sLi({ label: 'Offline suggestions', hint: 'A small note when you lose internet', ctl: sSw('offlineTips', S.settings.offlineTips !== false) }) +
      sLi({ label: 'Save songs you play for offline', hint: `Keeps your last ${S.settings.autoSaveMax || 30} played songs on this device so they play without internet`, ctl: sSw('autoSave', S.settings.autoSave) }) +
      ((S.cached || []).length ? sLi({ label: `Saved for offline: ${plural(S.cached.length, 'song')}`, value: fmtBytes((S.cached || []).reduce((a, x) => a + (x.size || 0), 0)), a: 'clearOffline' }) : '') +
      sLi({ label: 'Checking storage…', small: true, id: 'stor2' }) +
      sLi({ label: 'Clear Cache', hint: 'Frees space; pages reload fresh', a: 'clearcache' }) +
      (S.downloads.length ? sLi({ label: 'Remove All Downloads', danger: true, a: 'clearDl' }) : '')) +
    (IS_DESKTOP ? sGrp('Home Server', '<div id="srvp"><div class="spin"></div></div>', 'Your iPhone, iPad and other devices can use this computer to play clean, ad-free YouTube Music audio that keeps playing with the screen locked. Keep this app open (it can sit in the tray).')
      : '') +
    (standalone ? '' : sGrp('App', sLi({ img: 'icons/icon-192.png', label: `Install ${TITLE}`, a: 'install', chev: true }),
      IS_IOS ? 'On iPhone and iPad: tap Share, then Add to Home Screen.' : 'Install for a full-screen app with lock-screen and headphone controls.')) +
    sGrp('More', sLi({ icon: 'gear', color: '#8e8e93', label: 'Advanced', a: 'go', extra: 'data-v="advanced"', chev: true }) +
      sLi({ label: TITLE, hint: TAGLINE, small: false }) +
      sLi({ icon: 'globe', color: '#0a84ff', label: 'Explore our other apps', hint: 'Free apps & extensions by H24 Creationz', a: 'openurl', extra: `data-u="${PRODUCTS_URL}"`, chev: true }) +
      sLi({ label: 'Version', value: VER + (IS_DESKTOP ? ' · Desktop' : IS_CAP ? ' · Android' : Server.ok ? ' · Home Server' : ' · Web') }) +
      sLi({ label: 'Shortcuts & gestures', a: 'keys', chev: true }),
      `${TITLE} is free, with no account and no ads of its own. Lyrics: LRCLIB · Radio: Radio Browser · Podcasts: Apple Podcasts directory · Independent music: Audius.`) +
    '<div style="height:24px"></div>';
}
function renderAdvanced() {
  const s = S.settings;
  const engine = IT.ok ? (Server.ok && !NATIVE ? 'Home Server' : 'Direct') : 'Public mirrors';
  const mirror = (Mirrors.best.piped || Mirrors.best.inv || '').replace(/^https?:\/\//, '') || 'Chosen automatically';
  return header('Advanced') +
    sGrp('Music sources',
      sLi({ label: 'Use YouTube’s player as a last resort', hint: 'Only for songs no clean source has. Can show ads and pauses when locked.', ctl: sSw('ytPlayer', s.ytPlayer) }) +
      sLi({ label: 'JioSaavn server', value: s.saavn ? s.saavn.replace(/^https?:\/\//, '') : 'Automatic', a: 'setsaavn', chev: true }) +
      sLi({ label: 'JioSaavn status', value: Saavn.best ? 'Working · ' + Saavn.best.replace(/^https?:\/\//, '') : Saavn.down() ? 'Busy — retrying soon' : 'Ready' }) +
      sLi({ label: 'Your own music server', hint: 'Free · makes JioSaavn work: clean songs, no ads, downloads, EQ', value: s.proxy ? 'Connected' : 'Set up', a: 'setproxy', chev: true }),
      'Songs play as clean audio from JioSaavn (up to 320 kbps). Lyrics: LRCLIB · Podcasts: Apple Podcasts directory · Radio: Radio Browser.') +
    sGrp('Playback engine', sSeg('engine', [['auto', 'Automatic'], ['player', 'YouTube player'], ['audio', 'Audio only']], s.engine) +
      sLi({ label: 'Last song played via', value: viaLabel(Player.via) }) + sLi({ label: 'Catalog', value: engine }) + sLi({ label: 'Mirror in use', value: mirror }) +
      sLi({ label: 'Test music sources', a: 'testsrc', chev: true }),
      'Automatic always picks the cleanest working source. Audio only never uses YouTube’s player.') +
    sGrp('Connections',
      sLi({ label: 'Home Server address', value: s.server ? s.server.replace(/^https?:\/\//, '') : 'Auto', a: 'connectsrv', chev: true }) +
      sLi({ label: 'Custom mirror', value: s.mirror ? s.mirror.replace(/^https?:\/\//, '') : 'None', a: 'setmirror', chev: true }) +
      sLi({ label: 'Android app download link', value: s.apkUrl ? 'Custom' : (releasesBase() ? 'Automatic' : 'Not set'), a: 'setapk', chev: true })) +
    sGrp('Your data',
      sLi({ icon: 'share', color: '#0a84ff', label: 'Export Backup', a: 'exportData', chev: true }) +
      sLi({ icon: 'upload', color: '#0a84ff', label: 'Import Backup', a: 'importData', chev: true }) +
      sLi({ label: 'Error log', value: String(LOG.length), a: 'errlog', chev: true }) +
      sLi({ label: 'Reset Tune Tune', danger: true, a: 'resetAll' }),
      'Backups include favorites, playlists, podcasts, history, stats and settings. Use them to move your library between devices.') + '<div style="height:24px"></div>';
}
let qrLib = null;
function loadQR() {
  if (qrLib) return qrLib;
  qrLib = new Promise(res => { if (window.QRCode) return res(true); const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; sc.onload = () => res(!!window.QRCode); sc.onerror = () => res(false); document.head.appendChild(sc); setTimeout(() => res(!!window.QRCode), 6000); });
  return qrLib;
}
async function serverPanel() {
  const box = $('#srvp'); if (!box || !window.ttDesktop || !window.ttDesktop.server) return;
  let info = {}; try { info = await window.ttDesktop.server(); } catch (e) { }
  const addr = (info.addresses || [])[0] || '';
  box.innerHTML = sLi({ icon: 'server', color: info.enabled ? '#30d158' : '#8e8e93', label: 'Share music to phones & tablets', ctl: `<label class="sw"><input type="checkbox" id="srvon" ${info.enabled ? 'checked' : ''}><span></span></label>` }) +
    (info.enabled && addr ? `<div class="srv"><div id="qr" class="qr"></div><div class="srv-t"><b>On your iPhone or iPad</b><span>Connect to the same Wi-Fi, scan this code with the Camera, then tap Share → Add to Home Screen.</span><code class="selectable">${esc(addr)}</code>${(info.addresses || []).slice(1).map(x => `<code class="selectable">${esc(x)}</code>`).join('')}<button class="btn sm ghost" data-a="copysrv" data-u="${esc(addr)}">${I.copy}Copy address</button></div></div>` : info.enabled ? sLi({ label: 'Not connected to a network', small: true }) : '');
  if (info.enabled && addr && await loadQR()) { const q = $('#qr'); if (q) { q.innerHTML = ''; try { new window.QRCode(q, { text: addr, width: 132, height: 132, colorDark: '#000000', colorLight: '#ffffff' }); } catch (e) { } } }
}
const VIEWS = { advanced: renderAdvanced, home: renderHome, explore: renderExplore, search: renderSearch, radio: renderRadio, podcasts: renderPodcasts, library: renderLibrary, coll: renderColl, settings: renderSettings };

/* ================= actions ================= */
const listOf = d => REG.get(d.l);
const Actions = {
  play(el, d) {
    const L = listOf(d); if (!L) return; const t = L.tracks[+d.i]; if (!t) return;
    if (Player.cur && Player.cur.id === t.id && Player.loaded && !Player.el.paused) { openNP(); return; }
    Player.playList(L.tracks, +d.i, L.meta.from || '');
    if (nav.tab === 'search' && cv().q) saveSearch(cv().q);
  },
  more(el, d) { const L = listOf(d); const t = L && L.tracks[+d.i]; if (t) trackMenu(t, { ...L.meta, idx: +d.i }); },
  playAll(el, d) { const L = listOf(d); if (L && L.tracks.length) Player.playList(L.tracks, 0, L.meta.from, false); },
  shufAll(el, d) { const L = listOf(d); if (L && L.tracks.length) Player.playList(L.tracks, Math.floor(Math.random() * L.tracks.length), L.meta.from, true); },
  go(el, d) { go(d.v, { k: d.k, g: d.g, id: d.id, title: d.title, art: d.art }); },
  openc(el, d) { const c = REGC.get(d.c); if (!c) return; if (c.kind === 'podcast') go('coll', { k: 'pod', c, title: c.title }); else go('coll', { k: 'yt', c, title: c.title }); },
  podcat(el, d) { go('coll', { k: 'podcat', q: d.q, title: d.q }); },
  gopod() { switchTab('podcasts'); },
  podfollow(el) {
    const c = cv().c; if (!c) return; const i = S.pod.follows.findIndex(x => x.id === c.id);
    if (i >= 0) { S.pod.follows.splice(i, 1); toast('Unfollowed'); } else { S.pod.follows.unshift({ kind: 'podcast', id: c.id, title: c.title, sub: c.sub || '', art: c.art || '', source: 'pod' }); toast(`Following ${c.title}`); }
    save(); buzz(); el.innerHTML = i >= 0 ? I.plus + 'Follow' : I.check + 'Following';
  },
  followart() {
    const c = cv().c; if (!c) return; const i = S.artists.findIndex(x => x.id === c.id);
    if (i >= 0) { S.artists.splice(i, 1); toast('Unfollowed'); } else { S.artists.unshift({ kind: 'artist', id: c.id, title: cv().title || c.title, sub: 'Artist', art: c.art || '', source: 'yt' }); toast(`Following ${cv().title || c.title}`); }
    save(); buzz(); softRender();
  },
  mix(el, d) { const c = REGC.get(d.c); if (c) go('coll', { k: 'mix', seed: c.t, title: d.title || `${c.title} Mix` }); },
  skipb() { Player.seek(Player.el.currentTime - (+S.settings.podBack || 15)); }, skipf() { Player.seek(Player.el.currentTime + (+S.settings.podFwd || 30)); },
  async qsave() { if (!Player.queue.length) return; const n = await ask('Save queue as playlist', 'Playlist name', Player.from || 'My Queue', 'Save'); if (n) { newPlaylist(n, Player.queue); toast(`Saved “${n}”`); } },
  async importpl() {
    const v = await ask('Import a YouTube playlist', 'Paste a YouTube or YouTube Music playlist link', '', 'Import'); if (!v) return;
    const m = v.match(/[?&]list=([\w-]+)/) || v.match(/browse\/VL([\w-]+)/) || v.match(/^((?:PL|OLAK5uy_|RD|LL)[\w-]+)$/);
    const id = m ? m[1] : '';
    if (!id) return toast('That doesn’t look like a playlist link');
    toast('Importing…');
    try {
      const r = await YT.collection({ kind: 'playlist', id, plId: id, title: 'Imported playlist', source: 'yt' });
      if (!r.tracks || !r.tracks.length) throw new Error('empty');
      const p = newPlaylist(r.title || 'Imported playlist', r.tracks); toast(`Imported ${plural(r.tracks.length, 'song')}`); go('coll', { k: 'playlist', id: p.id });
    } catch (e) { toast('Couldn’t import that playlist right now'); }
  },
  getapp() { const b = releasesBase(); if (b) window.open(b + '/download/TuneTune.apk', '_blank', 'noopener'); else toast('Build the Android app with GitHub Actions — see the README'); },
  getdesk() { const b = releasesBase(); if (b) window.open(b, '_blank', 'noopener'); else toast('Build the desktop app with GitHub Actions — see the README'); },
  hideapp() { S.settings.hideAppCard = true; save(); const c = $('.appcard'); if (c) c.remove(); },
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
  qjump(el, d) { Player.jump(+d.q); }, qrm(el, d) {
    const qi0 = +d.q, gone = Player.queue[qi0]; Player.removeAt(qi0);
    if (gone) toast(`Removed “${gone.title}”`, { label: 'Undo', fn: () => { const at = Math.min(qi0, Player.queue.length); Player.queue.splice(at, 0, gone); if (at <= Player.i) Player.i++; qRefresh(); toast('Back in the queue'); } });
  }, qclear() { Player.clearUpNext(); },
  lyseek(el, d) { Player.seek(+d.t); lyrHold = 0; },
  eq() { openEQ(); }, sleep() { sleepMenu(); }, speed() { speedMenu(); },
  eqp(el, d) {
    if (!eqFind(d.n)) return; setTimeout(drawEq, 20);
    const pr = eqFind(d.n); if (!pr) return;
    S.settings.eq = pr.eq.slice(); S.settings.eqPreset = d.n;
    if (pr.pre != null) Object.assign(S.settings, { eqPre: pr.pre, eqBass: pr.bass || 0, eqTreble: pr.treble || 0, eqWidth: pr.width || 1, eqLoud: !!pr.loud, eqBoost: pr.boost || 0 });
    if (!S.settings.eqOn) return eqToggle(true);
    save(); if (Player.filters.length) Player.applyEq(); setHTML($('#eqbox'), eqInner());
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
  setv(el, d) {
    const k = d.k; let v = d.v; if (v !== '' && !isNaN(+v) && !['theme', 'quality', 'engine', 'startTab', 'lyricsSize'].includes(k)) v = +v;
    S.settings[k] = v; save(); buzz();
    if (['theme', 'zoom', 'lyricsSize'].includes(k)) applyTheme();
    if (k === 'quality') { Streams.c.clear(); if (Player.cur && Player.loaded && Player.via === 'saavn') Player.reroute(); toast({ auto: 'Quality: Auto', saver: 'Quality: Data saver (96 kbps)', normal: 'Quality: Normal (160 kbps)', high: 'Quality: High (320 kbps)' }[v] || 'Quality changed'); }
    if (k === 'podBack' || k === 'podFwd') { const b = $('[data-a="skipb"]'), f = $('[data-a="skipf"]'); if (b) b.innerHTML = skipIcon(S.settings.podBack, true); if (f) f.innerHTML = skipIcon(S.settings.podFwd, false); }
    if (k === 'podSpeed' && Player.cur && Player.cur.source === 'podcast') Player.el.playbackRate = v;
    $$(`[data-a="setv"][data-k="${k}"]`).forEach(b => b.classList.toggle('on', b === el));
  },
  async connectsrv() {
    const v = await ask('Home Server', 'Address shown in the desktop app, e.g. http://192.168.1.5:8686', S.settings.server || '', 'Connect');
    if (v === null) return;
    S.settings.server = v.replace(/\/+$/, ''); save(); toast(v ? 'Connecting…' : 'Using automatic detection');
    const ok = await Server.detect(true); IT.ok = null; IT.failAt = 0; Streams.c.clear(); mem.clear();
    if (ok) toast('Connected — songs now play as clean audio');
    else if (v && location.protocol === 'https:' && /^http:/.test(v) && !/localhost|127\.0\.0\.1/.test(v)) toast('Open the Home Server address directly in your browser instead (secure sites can’t reach it)');
    else if (v) toast('Couldn’t reach that address — is the desktop app open on the same Wi-Fi?');
    softRender();
  },
  async setsaavn() {
    const v = await ask('JioSaavn server', 'Optional: your own jiosaavn-api address (e.g. https://my-saavn.vercel.app/api)', S.settings.saavn || '', 'Save');
    if (v === null) return;
    if (v && !/^https:\/\/[^\s]+$/.test(v)) return toast('Enter a full https:// address');
    S.settings.saavn = v.replace(/\/+$/, ''); Saavn.fails.clear(); Saavn.best = null; mem.clear(); PC.clear(); save(); softRender(); toast(v ? 'Saved' : 'Using automatic servers');
  },
  setproxy() { openServerGuide(); },
  copycfg() { const v = (S.settings.proxy || '').replace('/?url={url}', ''); copyText(JSON.stringify({ musicServer: v }, null, 2) + '\n', 'Copied — create tunetune-config.json in your repo and paste this'); },
  copyworker() { copyText(WORKER_CODE, 'Server code copied — paste it in Cloudflare'); },
  async relaysave() {
    const inp = $('#relayin'); let v = (inp && inp.value || '').trim(); const st = $('#relayst');
    if (!v) return toast('Paste your worker address first');
    if (!/^https?:\/\//.test(v)) v = 'https://' + v;
    const base = v.includes('{url}') ? v : v.replace(/[?#].*$/, '').replace(/\/+$/, '') + '/?url={url}';
    if (st) { st.className = 'relay-st busy'; st.textContent = 'Testing your server…'; }
    const old = S.settings.proxy; S.settings.proxy = base; JSA.reset();
    try {
      const j = await JSA.attempt(JSA.relays()[0], 'https://www.jiosaavn.com/api.php?' + new URLSearchParams({ __call: 'autocomplete.get', query: 'anirudh', _format: 'json', _marker: '0', api_version: '4', ctx: 'web6dot0' }));
      if (!j) throw new Error('no reply');
      JSA.setVia('custom'); save(); mem.clear(); if (st) { st.className = 'relay-st ok'; st.textContent = '✓ Working! JioSaavn songs now play clean, with downloads and the equalizer.'; }
      toast('Your music server works'); setTimeout(() => { closeSheet(); softRender(); }, 1400);
    } catch (e) {
      S.settings.proxy = old; save(); if (st) st.className = 'relay-st bad'; if (st) st.textContent = '✗ Couldn’t reach JioSaavn through it (' + String(e.message || e).slice(0, 40) + '). Check you pasted the code and pressed Deploy, then try again.';
    }
  },
  relayclear() { S.settings.proxy = ''; save(); JSA.reset(); if (JSA.via === 'custom') JSA.setVia(''); closeSheet(); toast('Removed your music server'); softRender(); },
  async setapk() { const v = await ask('Android app link', 'https://github.com/you/repo/releases/latest/download/TuneTune.apk', S.settings.apkUrl || '', 'Save'); if (v === null) return; S.settings.apkUrl = v; save(); softRender(); },
  copysrv(el, d) { copyText(d.u, 'Address copied'); },
  clearcache() { PC.clear(); mem.clear(); Streams.c.clear(); toast('Cache cleared'); },
  errlog() { openSheet(`<div class="sg form"><b class="ft">Error log</b><pre class="log selectable">${esc(LOG.slice().reverse().join('\n') || 'No errors — everything is running smoothly.')}</pre><div class="fbtns"><button class="fb" data-a="copylog">Copy</button><button class="fb pri" data-a="sclose">Done</button></div></div>`); },
  copylog() { copyText(LOG.join('\n') || 'No errors', 'Log copied'); },
  rmrecent(el, d) { S.searches = S.searches.filter(x => x !== d.q); save(); buzz(); showSearchHome(); },
  deckprev() { if (Date.now() - suppressDeck < 450) return; Deck.go(-1); },
  decknext() { if (Date.now() - suppressDeck < 450) return; Deck.go(1); },
  copylyr() { copyLyrics(); },
  lyrmode(el, d) { S.settings.lyrMode = d.m; save(); renderLyrics(); if (d.m === 'en') lyrTranslate(); },
  skipb2() { Player.seek(Player.el.currentTime - skipSecs(-1)); }, skipf2() { Player.seek(Player.el.currentTime + skipSecs(1)); },
  keys() { showKeys(); },
  savedplay() { playOffline('saved-order'); }, savedshuf() { playOffline('saved'); },
  addlang(el, d) { S.settings.langs = [...myLangs().filter(x => x !== d.l), d.l]; save(); mem.clear(); softRender(); toast(`${d.l} added to your languages`); },
  nolang(el, d) { S.langNo = [...(S.langNo || []), d.l]; save(); softRender(); },
  openurl(el, d) { try { window.open(d.u, '_blank', 'noopener'); } catch (e) { location.href = d.u; } },
  async eqname() {
    const st = S.settings, cur = eqName(), mine = eqCustom(), ex = mine.find(c => c.n === cur);
    const v = await ask(ex ? 'Rename your sound' : 'Save as your own sound', 'Name it — e.g. My Car, Gym, Night Drive', ex ? cur : '', ex ? 'Rename' : 'Save');
    const n = String(v || '').trim().slice(0, 24); if (!n) return;
    if (PRESETS[n] || (mine.some(c => c.n === n) && n !== cur)) return toast('That name is taken — try another');
    const snap = { n, eq: st.eq.slice(), pre: +st.eqPre || 0, bass: +st.eqBass || 0, treble: +st.eqTreble || 0, width: +st.eqWidth || 1, loud: !!st.eqLoud, boost: +st.eqBoost || 0 };
    if (ex) { Object.assign(ex, snap); st.eqPins = eqPins().map(x => (x === cur ? n : x)); } else mine.unshift(snap);
    st.eqPreset = n; save(); openEQ(); toast(ex ? 'Renamed' : `Saved “${n}”`);
  },
  eqpin() {
    const cur = eqName(), pins = eqPins(), i = pins.indexOf(cur);
    if (i >= 0) pins.splice(i, 1); else pins.unshift(cur); save(); setHTML($('#eqbox'), eqInner());
    toast(i >= 0 ? `Unpinned ${cur}` : `Pinned ${cur} — it shows first everywhere`);
  },
  eqdelask() { const cur = eqName(); confirmSheet(`Delete “${cur}”?`, 'Your own sound will be removed. You can always make it again.', 'Delete', () => { Actions.eqdel(); setTimeout(openEQ, 450); }); },
  eqdel() { const cur = eqName(); S.settings.eqCustom = eqCustom().filter(c => c.n !== cur); S.settings.eqPins = eqPins().filter(x => x !== cur); Actions.eqp(null, { n: 'Flat' }); toast('Deleted'); },
  offmix() { playOffline('mix'); },
  party() { Party.fromNP = npOpen; if (npOpen) closeNP(); setTimeout(() => Party.open(), npOpen ? 380 : 0); },
  partyx() { Party.close(); if (Player.cur) setTimeout(openNP, 120); },
  partyfs() { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { toast('Full screen isn’t available here'); } },
  pstyle(el, d) { S.settings.partyStyle = d.s; save(); $$('#party .pchip').forEach(b => b.classList.toggle('on', b.dataset.s === d.s)); if (d.s === 'calm') toast('Calm: gentle colours, no flashing'); },
  ptorch() { Party.torch(); },
  pbuzz() { S.settings.partyBuzz = !S.settings.partyBuzz; save(); const b = $('#p-buzz'); if (b) b.classList.toggle('on', S.settings.partyBuzz); toast(S.settings.partyBuzz ? 'Vibrates with the beat' : 'Vibration off'); },
  clearOffline() { confirmSheet('Remove songs saved for offline?', 'Your downloads stay. Songs you play will be saved again as you listen.', 'Remove', async () => { await Offline.clear(); toast('Removed offline copies'); softRender(); }); },
  toastact() { const f = toastFn; toastFn = null; $('#toast').classList.remove('on'); if (f) f(); },
  ytfull() { Embed.pinned = !Embed.pinned; $('#np').classList.toggle('ytfull', Embed.pinned || Embed.ad); UI.ytPill(); },
  npshare() { if (Player.cur) share(Player.cur); },
  shareColl(el, d) { const L = listOf(d); if (L && L.tracks.length) sharePlaylist(cv().title || L.meta.from || 'Playlist', L.tracks); },
  aq() { openAQ(); },
  setname() { nameSheet(false); },
  nmsave() {
    const i = $('#nmin'); const v = String(i && i.value || '').trim().slice(0, 30);
    if (!v) { if (i) { i.classList.remove('shake'); void i.offsetWidth; i.classList.add('shake'); i.focus(); } return; }
    const first = needName; S.settings.name = v; needName = false; save(); closeSheet();
    toast(first ? `Nice to meet you, ${v}!` : 'Name updated'); const e = cv(); if (e.v === 'home' || e.v === 'settings') softRender();
  },
  noinstall() { S.noInstall = 1; save(); softRender(); },
  eqreset() { Object.assign(S.settings, { eq: PRESETS.Flat.slice(), eqPreset: 'Flat', eqPre: 0, eqBass: 0, eqTreble: 0, eqLoud: false, eqWidth: 1, eqBoost: 0 }); save(); Player.applyEq(); setHTML($('#eqbox'), eqInner()); toast('Equalizer reset'); },
  drivex() { const d = $('#drive'); if (!d) return; clearInterval(d._clock); try { d._lock && d._lock.release(); } catch (e) { } d.classList.remove('on'); setTimeout(() => d.remove(), 300); },
  voice() { voiceSearch(); },
  cast() {
    const a = Player.el === Embed ? null : Player.el;
    if (!a) return toast('Casting works for audio streams, not the YouTube player');
    try {
      if (a.webkitShowPlaybackTargetPicker) return a.webkitShowPlaybackTargetPicker();
      if (a.remote && a.remote.prompt) return a.remote.prompt().catch(err => toast(err && err.name === 'NotFoundError' ? 'No speakers or TVs found nearby' : 'Casting isn’t available here'));
    } catch (e) { }
    toast('Casting isn’t available in this browser');
  },
  engine(el, d) { S.settings.engine = d.e; save(); softRender(); toast(d.e === 'player' ? 'Songs play through the official YouTube player' : d.e === 'audio' ? 'Audio only — equalizer and downloads on' : 'Automatic playback'); },
  lpick(el, d) { if (!pickSel) return; if (pickSel.has(d.l)) pickSel.delete(d.l); else pickSel.add(d.l); el.classList.toggle('on', pickSel.has(d.l)); },
  lpdone() {
    const l = pickSel ? [...pickSel] : []; S.settings.langs = l.length ? l : ['English']; pickSel = null; save(); closeSheet();
    const e = cv(); if (e.v === 'home' || e.v === 'settings') softRender();
    if (lpFirst && !String(S.settings.name || '').trim()) setTimeout(() => nameSheet(true), 480); lpFirst = false;
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
    if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; S.noInstall = 1; save(); setTimeout(() => { if (cv().v === 'home') softRender(); }, 1500); }
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
let suppressMini = 0, suppressRow = 0;
const HSEL = '.chips,.hs,.cg,.seg';
function setHTML(el, html) {
  if (!el) return;
  const rows = [...el.querySelectorAll(HSEL)].map(r => r.scrollLeft), top = el.scrollTop;
  el.innerHTML = html;
  const now = [...el.querySelectorAll(HSEL)];
  now.forEach((r, i) => { if (rows[i]) { r.style.scrollBehavior = 'auto'; r.scrollLeft = rows[i]; r.style.scrollBehavior = ''; } });
  if (top) el.scrollTop = top;
}
function scrollSnap() { return $$(HSEL).map(el => ({ el, x: el.scrollLeft, c: el.className })); }
function scrollRestore(snap) {
  const now = $$(HSEL); if (now.length !== snap.length) return;
  now.forEach((el, i) => { const o = snap[i]; if (el !== o.el && el.className === o.c && o.x) { el.style.scrollBehavior = 'auto'; el.scrollLeft = o.x; el.style.scrollBehavior = ''; } });
}
function selOf(el) {
  const q = v => (window.CSS && CSS.escape ? CSS.escape(v) : String(v).replace(/["\\]/g, '\\$&'));
  const d = el.dataset; const parts = Object.keys(d).filter(k => k !== 'fb').map(k => `[data-${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}="${q(d[k])}"]`);
  return parts.length ? el.tagName.toLowerCase() + parts.join('') : '';
}
function reveal(el) {
  if (!el || !el.isConnected) return; const sc = el.closest(HSEL + ',.sg,.np-panel'); if (!sc) return;
  const r = el.getBoundingClientRect(), b = sc.getBoundingClientRect();
  const hidden = r.left < b.left + 4 || r.right > b.right - 4 || r.top < b.top + 2 || r.bottom > b.bottom - 2;
  if (hidden) try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }); } catch (e) { }
}
let tapX = 0, tapY = 0, tapMoved = false, lastScrollAt = 0;
document.addEventListener('pointerdown', e => { tapX = e.clientX; tapY = e.clientY; tapMoved = false; }, { passive: true, capture: true });
document.addEventListener('pointermove', e => { if (Math.abs(e.clientX - tapX) > 10 || Math.abs(e.clientY - tapY) > 10) tapMoved = true; }, { passive: true, capture: true });
document.addEventListener('scroll', () => { lastScrollAt = Date.now(); }, { passive: true, capture: true });
document.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('.row,.card,.tile,.qrow') && !e.target.closest('.more,.qx,.np-ib') && (tapMoved || Date.now() - lastScrollAt < 120) && e.detail > 0) { e.preventDefault(); e.stopPropagation(); return; }
  if (Date.now() - suppressMini < 450 && e.target.closest('#mini')) { e.preventDefault(); return; }
  if (Date.now() - suppressRow < 600 && e.target.closest('[data-l][data-i]')) { e.preventDefault(); return; }
  const tab = e.target.closest('[data-tab]'); if (tab) { switchTab(tab.dataset.tab); return; }
  const el = e.target.closest('[data-a]'); if (!el) return;
  const A = Actions[el.dataset.a]; if (!A) return;
  e.preventDefault();
  if (el.matches('.np-ib,.lyb,.pchip,.popt,.qchip,.chip,.eq-ed,.nb-btn,.pill,.fb,#np-pp,.np-c button,.dv-c button,.dv-c2 button,.p-ctl button')) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); setTimeout(() => el.classList.remove('pop'), 420); }
  let snap = null, sel = '';
  try { if (el.closest(HSEL + ',.sg')) { snap = scrollSnap(); sel = selOf(el); reveal(el); } } catch (x) { snap = null; }
  A(el, el.dataset, e);
  if (snap) {
    try { scrollRestore(snap); } catch (x) { }
    requestAnimationFrame(() => { try { scrollRestore(snap); if (!el.isConnected && sel) { const n = document.querySelector(sel); if (n) reveal(n); } } catch (x) { } });
  }
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
  else if (t.dataset && t.dataset.set === 'crossfade') { const l = $('#v-crossfade'); if (l) l.textContent = +t.value ? t.value + ' s' : 'Off'; t.style.setProperty('--p', (t.value / 12 * 100) + '%'); }
  else if (t.dataset && t.dataset.band !== undefined) {
    const i = +t.dataset.band; S.settings.eq[i] = +t.value; if (!eqCustom().some(c => c.n === S.settings.eqPreset)) { const was = S.settings.eqPreset; S.settings.eqPreset = 'Custom'; if (was !== 'Custom') { const n = $('#eqname'); if (n) n.textContent = 'Custom'; UI.state(); } }
    const v = $('#eqv' + i); if (v) v.textContent = fmtDb(t.value);
    const n = $('#eqname'); if (n && S.settings.eqOn) n.textContent = 'Custom';
    $$('#eqbox .chip.on').forEach(c => c.classList.remove('on'));
    Player.applyEq(); save(); drawEq();
  } else if (t.dataset && t.dataset.eqk) {
    const k = t.dataset.eqk; S.settings[k] = +t.value; const l = $('#eqk-' + k);
    if (l) l.textContent = k === 'eqWidth' ? Math.round(t.value * 100) + '%' : fmtDb(+t.value) + ' dB';
    t.style.setProperty('--p', ((t.value - t.min) / (t.max - t.min)) * 100 + '%'); Player.applyEq(); save(); drawEq();
  } else if (t.id === 'dv-seek') {
    seeking = true; const a = Player.el; const d = Player.loaded && isFinite(a.duration) ? a.duration : ((Player.cur && Player.cur.duration) || 0);
    $('#dv-cur').textContent = fmt((t.value / 1000) * d); t.style.setProperty('--p', t.value / 10 + '%');
  } else if (t.id === 'nmin') { const b = $('#nmbtn'); if (b) b.disabled = !t.value.trim(); }
  else if (t.id === 'sq') searchInput(t.value);
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'np-seek') {
    seeking = false; const a = Player.el;
    const d = Player.loaded && isFinite(a.duration) ? a.duration : ((Player.cur && Player.cur.duration) || 0);
    Player.seek((t.value / 1000) * d);
  } else if (t.id === 'dv-seek') {
    seeking = false; const a = Player.el; const d = Player.loaded && isFinite(a.duration) ? a.duration : ((Player.cur && Player.cur.duration) || 0); Player.seek((t.value / 1000) * d);
  } else if (t.id === 'eqloud') { S.settings.eqLoud = t.checked; save(); Player.applyEq(); toast(t.checked ? 'Loudness on' : 'Loudness off'); }
  else if (t.id === 'eqon') eqToggle(t.checked);
  else if (t.id === 'srvon') { if (window.ttDesktop && window.ttDesktop.setServer) window.ttDesktop.setServer(t.checked).then(() => serverPanel()); }
  else if (t.dataset && t.dataset.set && t.dataset.set.startsWith('home.')) { S.settings.homeSections[t.dataset.set.slice(5)] = t.checked; save(); buzz(); }
  else if (t.dataset && t.dataset.set) {
    const k = t.dataset.set; S.settings[k] = t.type === 'checkbox' ? t.checked : t.type === 'range' ? +t.value : t.value; save(); buzz();
    if (['motion', 'animBg', 'badge'].includes(k)) applyTheme();
    if (k === 'normalize') Player.applyVol();
    if (k === 'remind3') { if (window.ttDesktop && window.ttDesktop.setRemind) window.ttDesktop.setRemind(t.checked); const LN = Native.plug('LocalNotifications'); if (!t.checked && LN) LN.cancel({ notifications: [{ id: 7301 }] }).catch(() => { }); else Native.remind(); }
    if (k === 'autoplay') toast(t.checked ? 'Autoplay on' : 'Autoplay off');
    if (k === 'country') { mem.clear(); toast(`Region: ${countryName(detectCC())}`); }
  } else if (t.id === 'f-audio') { importFiles(t.files); t.value = ''; }
  else if (t.id === 'f-backup') { importBackup(t.files[0]); t.value = ''; }
});
const KEYS = [['Space · K', 'Play / pause'], ['← →', 'Back / forward 10 seconds'], ['P · N', 'Previous / next song'], ['Shift ← →', 'Previous / next song'], ['↑ / ↓', 'Volume up / down'], ['M', 'Mute'],
  ['L or F', 'Favorite'], ['S', 'Shuffle'], ['R', 'Repeat'], ['Q', 'Queue'], ['Y', 'Lyrics'], ['E', 'Equalizer'], ['D', 'Driving mode'], ['X', 'Party Mode'], ['0 – 9', 'Jump to 0% – 90%'],
  ['/ or Ctrl + K', 'Search'], ['Esc', 'Close'], ['?', 'This list']];
const GESTURES = [['Swipe the album art', 'Next / previous song'], ['Tap a side album', 'Jump to it'], ['Double-tap the album art', 'Favorite'], ['Swipe down on Now Playing', 'Close'],
  ['Swipe the mini player', 'Next / previous'], ['Press and hold a song', 'More options'], ['Lock screen / headphones', 'Play, pause, skip']];
function showKeys() {
  openSheet(`<div class="sg form"><b class="ft">Shortcuts & gestures</b><div class="info">${GESTURES.map(([k, v]) => `<div class="inf"><span>${esc(v)}</span><b>${esc(k)}</b></div>`).join('')}</div>
    ${matchMedia('(pointer: fine)').matches ? '' : '<!--'}<b class="ft" style="margin-top:14px">Keyboard</b><div class="info">${KEYS.map(([k, v]) => `<div class="inf"><span>${esc(v)}</span><b><kbd>${esc(k)}</kbd></b></div>`).join('')}</div>${matchMedia('(pointer: fine)').matches ? '' : '-->'}
    <div class="fbtns"><button class="fb pri" data-a="sclose">Done</button></div></div>`);
}
let preMute = 1;
function volStep(dv) {
  Player.setVol(clamp(Player.vol + dv, 0, 1)); const v = $('#np-vol'); if (v) { v.value = Math.round(Player.vol * 100); v.style.setProperty('--p', v.value + '%'); }
  toast(Player.vol ? `Volume ${Math.round(Player.vol * 100)}%` : 'Muted');
}
document.addEventListener('keydown', e => {
  const tg = e.target;
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (sheetOpen) closeSheet(); if (npOpen) closeNP(); Actions.gosearch(); return; }
  if (tg.matches && tg.matches('input,textarea,select')) {
    if (tg.id === 'sq' && e.key === 'Enter') { clearTimeout(sDeb); runSearch(cv()); saveSearch(tg.value); tg.blur(); }
    if (tg.id === 'askin' && e.key === 'Enter') Actions.asko();
    if (tg.id === 'nmin' && e.key === 'Enter') Actions.nmsave();
    if (tg.type !== 'range') return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && tg.matches && tg.matches('[role="button"][data-a],[role="button"][data-tab]')) { e.preventDefault(); tg.click(); return; }
  if (e.key === 'Escape') { if (sheetOpen) return closeSheet(); if (Party.on) return Party.close(); if ($('#drive')) return Actions.drivex(); if (npOpen) return closeNP(); }
  if (e.metaKey || e.ctrlKey || e.altKey || sheetOpen) return;
  const k = e.key; const rng = tg.type === 'range';
  const pre = () => e.preventDefault();
  if (e.code === 'Space' || k === 'k' || k === 'K') { if (tg.closest && tg.closest('button') && e.code === 'Space') return; pre(); Player.toggle(); }
  else if (k === 'ArrowRight' && !rng) { pre(); e.shiftKey ? Player.next() : Player.seek(Player.el.currentTime + 10); }
  else if (k === 'ArrowLeft' && !rng) { pre(); e.shiftKey ? Player.prev() : Player.seek(Player.el.currentTime - 10); }
  else if (k === 'ArrowUp' && !rng) { pre(); volStep(0.1); }
  else if (k === 'ArrowDown' && !rng) { pre(); volStep(-0.1); }
  else if (k === 'n' || k === 'N') Player.next();
  else if (k === 'p' || k === 'P') Player.prev();
  else if (k === 'm' || k === 'M') { if (Player.vol > 0) { preMute = Player.vol; volStep(-1); } else volStep(preMute || 1); }
  else if ('lLfF'.includes(k)) { if (Player.cur) { toggleLike(Player.cur); buzz(); } }
  else if (k === 's' || k === 'S') Player.setShuffle(!Player.shuffle);
  else if (k === 'r' || k === 'R') Player.cycleRepeat();
  else if (k === 'q' || k === 'Q') { if (Player.cur) { openNP(); if (npPanel !== 'q') togglePanel('q'); } }
  else if (k === 'y' || k === 'Y') { if (Player.cur) { openNP(); if (npPanel !== 'lyr') togglePanel('lyr'); } }
  else if (k === 'e' || k === 'E') openEQ();
  else if (k === 'd' || k === 'D') { if (Player.cur) openDrive(); }
  else if (k === 'x' || k === 'X') { if (Player.cur) (Party.on ? Party.close() : Actions.party()); }
  else if (/^[0-9]$/.test(k) && !rng) { const a = Player.el; if (Player.cur && !Player.cur.live && isFinite(a.duration)) Player.seek(a.duration * (+k / 10)); }
  else if (k === '/') { pre(); Actions.gosearch(); }
  else if (k === '?') showKeys();
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
addEventListener('unhandledrejection', e => { warn('unhandled', e.reason); e.preventDefault && e.preventDefault(); });

let suppressDeck = 0;
const Deck = {
  busy: false, skip: false,
  el() { return document.getElementById('np-deck'); },
  set(p, anim) { const a = this.el(); if (!a) return; a.classList.toggle('drag', !anim); a.style.setProperty('--p', String(+p.toFixed(4))); a.style.setProperty('--ap', String(+Math.abs(p).toFixed(4))); },
  dist() {
    const a = this.el(); if (!a) return 300; const W = a.clientWidth, H = a.clientHeight;
    const wide = matchMedia('(min-width:900px)').matches; const S2 = wide ? Math.min(0.72 * W, H) : Math.min(0.8 * W, 0.96 * H);
    return Math.max(80, wide ? W / 2 - S2 * 0.31 : W / 2 + 6);
  },
  has(dir) { const el = document.getElementById(dir > 0 ? 'dk-next' : 'dk-prev'); return !!(el && el.classList.contains('show')); },
  go(dir) {
    const a = this.el(); if (!a || !Player.cur || this.busy) return;
    const move = () => (dir > 0 ? Player.next() : Player.prevTrack());
    if (!this.has(dir) || $('#np').classList.contains('ytfull')) { this.set(0, true); buzz(); move(); return; }
    buzz(); this.busy = true; this.set(-dir, true);
    setTimeout(() => {
      const cur = $('#np-img'), pv = $('#dk-prev'), nx = $('#dk-next'), cs = cur.getAttribute('src');
      if (dir > 0) { cur.src = nx.getAttribute('src'); pv.src = cs; } else { cur.src = pv.getAttribute('src'); nx.src = cs; }
      cur.classList.add('ld'); this.skip = true; this.set(0, false); move();
      requestAnimationFrame(() => requestAnimationFrame(() => { const x = this.el(); if (x) x.classList.remove('drag'); this.busy = false; }));
      setTimeout(() => { this.skip = false; this.busy = false; }, 600);
    }, 360);
  },
  arrive(dir) {
    if (this.skip) { this.skip = false; return; }
    if (!dir || !npOpen || this.busy) return;
    this.set(dir, false); void (this.el() || {}).offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => this.set(0, true)));
  },
};
function deckGo(dir) { Deck.go(dir); }
function likeBurst() {
  const t = Player.cur; if (!t) return; if (!isLiked(t.id)) toggleLike(t); else buzz();
  const b = $('#np-deck .burst'); if (b) { b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); }
}
function bindGestures() {
  const art = $('#np-deck'); let px = null, py = 0, pdx = 0, pt = 0, horiz = false, dMoved = 0, lastTap = 0, dist = 300;
  art.addEventListener('dragstart', e => e.preventDefault());
  art.querySelectorAll('img').forEach(i => { i.draggable = false; });
  art.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0 && !e.target.closest('.yt-pill,#ytbox')) e.preventDefault(); if (e.target.closest('.yt-pill') || (e.target.closest('#ytbox') && ($('#np').classList.contains('needtap') || $('#np').classList.contains('ytfull'))) || (e.pointerType === 'mouse' && e.button !== 0)) return; px = e.clientX; py = e.clientY; pdx = 0; dMoved = 0; pt = Date.now(); horiz = false; });
  art.addEventListener('pointermove', e => {
    if (px === null) return; const dx = e.clientX - px, dy = e.clientY - py; dMoved = Math.max(dMoved, Math.abs(dx), Math.abs(dy));
    if (!horiz && Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy) * 0.9 && !Deck.busy && !$('#np').classList.contains('drag')) { horiz = true; Deck.dragging = true; $('#np').classList.add('deckdrag'); dist = Deck.dist(); px = e.clientX - Math.sign(dx) * 2; try { art.setPointerCapture(e.pointerId); } catch (x) { } }
    if (horiz) {
      pdx = e.clientX - px; let p = clamp(pdx / dist, -1, 1); if ((p < 0 && !Deck.has(1) && !S.settings.autoplay) || (p > 0 && !Deck.has(-1))) p *= 0.25;
      if (!Deck.crossed && Math.abs(pdx) > dist * 0.28) { Deck.crossed = true; buzz(); } else if (Deck.crossed && Math.abs(pdx) < dist * 0.28) Deck.crossed = false;
      const raf = window.requestAnimationFrame || (f => setTimeout(f, 16)), caf = window.cancelAnimationFrame || clearTimeout;
      caf(Deck.raf); Deck.raf = raf(() => Deck.set(p, false));
    }
  });
  const end = e => {
    if (px === null) return; px = null; Deck.crossed = false; Deck.dragging = false; $('#np').classList.remove('deckdrag'); (window.cancelAnimationFrame || clearTimeout)(Deck.raf);
    if (!horiz) {
      if (dMoved < 10 && e.type === 'pointerup' && (e.target.id === 'np-img' || e.target.closest('#ytbox'))) { if (Date.now() - lastTap < 320) { lastTap = 0; likeBurst(); } else lastTap = Date.now(); }
      return;
    }
    suppressDeck = Date.now();
    const fast = Math.abs(pdx) / Math.max(1, Date.now() - pt) > 0.35;
    if ((pdx < -dist * 0.25 || (pdx < -24 && fast)) && (Deck.has(1) || S.settings.autoplay)) Deck.go(1);
    else if ((pdx > dist * 0.25 || (pdx > 24 && fast)) && Deck.has(-1)) Deck.go(-1);
    else Deck.set(0, true);
  };
  art.addEventListener('pointerup', end); art.addEventListener('pointercancel', end); art.addEventListener('lostpointercapture', e => { if (px !== null) end(e); });
  // press and hold a song or card on touch screens → its menu (iPhone has no right-click)
  let lp = null, lpX = 0, lpY = 0;
  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return; const c = e.target.closest && e.target.closest('[data-l][data-i]'); if (!c || e.target.closest('#np')) return;
    lpX = e.clientX; lpY = e.clientY; clearTimeout(lp);
    lp = setTimeout(() => { lp = null; suppressRow = Date.now(); buzz(); Actions.more(c, c.dataset); }, 520);
  }, { passive: true });
  const cancelLp = e => { if (lp && (!e.clientX || Math.abs(e.clientX - lpX) > 10 || Math.abs(e.clientY - lpY) > 10 || e.type !== 'pointermove')) { clearTimeout(lp); lp = null; } };
  document.addEventListener('pointermove', cancelLp, { passive: true }); document.addEventListener('pointerup', cancelLp, { passive: true }); document.addEventListener('pointercancel', cancelLp, { passive: true });
  const mini = $('#mini'); let sx = null, sy = 0, moved = false;
  mini.addEventListener('touchstart', e => { if (e.target.closest('button')) { sx = null; return; } sx = e.touches[0].clientX; sy = e.touches[0].clientY; moved = false; }, { passive: true });
  mini.addEventListener('touchmove', e => {
    if (sx === null) return; const dx = e.touches[0].clientX - sx;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(e.touches[0].clientY - sy)) { moved = true; const tx = $('.m-txt', mini); tx.style.transform = `translateX(${dx * 0.6}px)`; tx.style.opacity = String(1 - Math.min(0.7, Math.abs(dx) / 220)); }
  }, { passive: true });
  mini.addEventListener('touchend', e => {
    const tx = $('.m-txt', mini); tx.style.transform = ''; tx.style.opacity = '';
    if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (moved) { suppressMini = Date.now(); if (Math.abs(dx) > 70) { buzz(); if (dx < 0) Player.next(); else Player.prev(); } }
  });
  const v = $('#view');
  v.addEventListener('scroll', () => { v.classList.toggle('scrolled', v.scrollTop > (cv().v === 'coll' ? 200 : 40)); }, { passive: true });
  const np = $('#np'); let y0 = null, dy = 0, t0 = 0;
  np.addEventListener('touchstart', e => {
    if (wide() || e.target.closest('.np-panel,input,button') || !e.target.closest('.np-top,.np-art')) { y0 = null; return; }
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0; t0 = Date.now(); vdir = null;
  }, { passive: true });
  let x0 = 0, vdir = null;
  np.addEventListener('touchmove', e => {
    if (y0 === null) return;
    const ddx = e.touches[0].clientX - x0, ddy = e.touches[0].clientY - y0;
    if (!vdir) { if (Math.hypot(ddx, ddy) < 10) return; vdir = ddy > 0 && Math.abs(ddy) > Math.abs(ddx) * 1.3 && !Deck.dragging ? 'v' : 'h'; }
    if (vdir !== 'v') { y0 = null; return; }
    dy = Math.max(0, ddy - 10); np.classList.add('drag'); np.style.transform = `translate3d(0,${dy}px,0)`;
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
  if (S.schema !== 'r1' && S.schema !== 'r2') {
    S.schema = 'r1'; Object.assign(S.settings, { engine: 'auto', ytPlayer: false, saavn: '', mirror: '', proxy: '' });
    PC.clear(); MirrorHealth.s = {}; try { ['tunetune.mh', 'tunetune.mirrors', 'tunetune.jsvia'].forEach(k => localStorage.removeItem(k)); } catch (e) { }
    save();
  }
  if (S.schema === 'r1') { S.schema = 'r2'; S.settings.ytPlayer = true; save(); }
  if (S.settings.eqPreset === 'Bollywood') S.settings.eqPreset = 'Cinematic';
  if (S.settings.eqPreset && !eqFind(S.settings.eqPreset)) S.settings.eqPreset = 'Custom';
  S.settings.eqPins = eqPins().filter(n => eqFind(n));
  setTimeout(() => { openShared().catch(() => { }); }, 600);
  if (!navigator.onLine) { document.body.classList.add('offline'); setTimeout(() => { if (!navigator.onLine && S.settings.offlineTips !== false && String(S.settings.name || '').trim()) { offShown = true; offlineNudge(); } }, 1600); }
  try { Native.init(); } catch (e) { warn(e); }
  loadSiteConfig().then(() => { const add = h => { try { const l = document.createElement('link'); l.rel = 'preconnect'; l.href = h; l.crossOrigin = ''; document.head.appendChild(l); } catch (e) { } };
    const px = S.settings.proxy || SITE.server; if (px) { try { add(new URL(px.replace('{url}', '')).origin); } catch (e) { } } add('https://aac.saavncdn.com'); add('https://c.saavncdn.com'); });
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => { if (!p) navigator.storage.persist().catch(() => { }); }).catch(() => { }); } catch (e) { }
  try {
    if ('launchQueue' in window) window.launchQueue.setConsumer(async p => {
      if (!p || !p.files || !p.files.length) return;
      const files = await Promise.all(p.files.map(h => h.getFile())); const before = S.locals.length;
      await importFiles(files); const added = S.locals.slice(0, S.locals.length - before);
      if (added.length) Player.playList(added, 0, 'On This Device');
    });
  } catch (e) { }
  JSA.init();
  applyTheme();
  splash();
  buildShell();
  Mirrors.init();
  Player.init();
  bindGestures();
  if (nav.stacks[S.settings.startTab]) nav.tab = S.settings.startTab;
  try { const qt = new URLSearchParams(location.search).get('tab'); if (nav.stacks[qt]) nav.tab = qt; } catch (e) { }
  history.replaceState({ root: 1 }, '');
  render();
  loadArtCache();
  Audius.discover();
  Mirrors.load();
  IT.probe();
  if (!S.settings.langs) setTimeout(() => { if (!S.settings.langs && !sheetOpen) langPicker(true); }, 600);
  else if (!String(S.settings.name || '').trim()) setTimeout(() => { if (!String(S.settings.name || '').trim()) { if (sheetOpen) needName = true; else nameSheet(true); } }, /[?&](play|pl|share|text|url)=/.test(location.search) ? 6000 : 1500);
  Server.detect().then(ok => { if (!DIRECT() && (S.settings.ytPlayer || S.settings.engine === 'player')) setTimeout(() => Embed.ensure().catch(() => { }), 2500); if (ok) { IT.ok = null; softRender(); } });
  if (IS_IOS) document.addEventListener('touchend', unlockAudio, { once: true, capture: true });
  if ('serviceWorker' in navigator && !NATIVE && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => { });
  }
  window.TuneTune = { version: VER, engine: () => (IT.ok ? 'direct' : 'mirrors') };
  if (window.__TT_TEST__) window.TuneTune._ = { JSA, DES, Saavn, Player, Streams, Mirrors, IT, YT, S, nav, cv, Actions, itShelves, mem, Embed, MirrorHealth, download, share, probeAudio, qInfo, sharePlaylist, SvC, translit, Deck, SITE, Offline, landCheck, Party, offlineList, playOffline, offlineSheet, Pre, deviceLangs, langSuggest, eqName, eqPins, Haptic, rtags: () => rtags(), podCats: () => podCats(), lyrSet: r => { lyrState = { id: Player.cur && Player.cur.id, ...r }; renderLyrics(); } };
}
try { init(); }
catch (err) {
  console.error(err);
  const v = document.getElementById('view');
  if (v) v.innerHTML = `<div style="padding:40px 24px;font-family:system-ui;max-width:520px;margin:auto"><h2>Tune Tune couldn’t start</h2><p>${esc(err && err.message || err)}</p><p>Reload the page. If it keeps happening, clear this site’s data in your browser settings.</p></div>`;
}
})();
