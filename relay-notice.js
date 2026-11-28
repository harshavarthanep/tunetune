/* Relay Relay — messages + promotions for any H24 Creationz app  (v2.0)

   ADD IT TO AN APP
   1. Put this file next to the app's index.html in its GitHub repo.
   2. Add this one line just before </body> in index.html:
        <script src="relay-notice.js" data-app="zenpdf" defer></script>
      data-app = the app's name in Relay Relay (lowercase, no spaces): tunetune, zenpdf, beambeam, nodalis, shelfshelf …
   Relay Relay → Settings → Your apps writes this line for you, with your colours.

   OPTIONAL SETTINGS (on the same line)
      data-delay="300"      ms after the app opens before showing anything (default 300)
      data-every="60"       minutes between server checks on one device (default 60). Between checks the
                            last answer is reused, so promotions still rotate on every open without requests.
      data-accent="#fa2d48" button colour
      data-notices="off"    no message banners in this app
      data-promo="off"      no promotions in this app
      data-servers="https://a.workers.dev,https://b.workers.dev"   ask these Relay Relay servers in order
      data-preview="on"     preview only (used by the Relay Relay control app) — never checks a server

   REQUESTS: each server check = 2 requests (messages + promotions). Opening the app again before
   data-every minutes have passed uses 0 requests. Promotions with "Count views" on add 1 request per view
   and 1 per tap.
*/
(() => {
  'use strict';
  if (window.__relayNotice) return;
  window.__relayNotice = true;

  const me = document.currentScript || {};
  const ds = me.dataset || {};
  const num = (v, d) => (v != null && v !== '' && !isNaN(+v) ? +v : d);
  const CFG = {
    app: String(ds.app || 'app').trim().toLowerCase(),
    servers: String(ds.servers || 'https://relay-relay.harshavarthan-e.workers.dev').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean),
    delay: num(ds.delay, 300),
    every: num(ds.every, 60),
    accent: ds.accent || '#fa2d48',
    notices: ds.notices !== 'off',
    promo: ds.promo !== 'off',
    preview: ds.preview === 'on'
  };
  const NOT_FOUND = { notFound: true };
  const MAX_NOTICES = 3;            // unseen messages shown one after another per open
  const NOTICE_AGE = 14 * 864e5;    // older messages are skipped
  const CACHE_MAX = 250000;         // promotions bigger than this (uploaded pictures) are not kept between opens

  /* ---------- helpers ---------- */
  const K = k => 'rrn.' + CFG.app + '.' + k;    // each app keeps its own memory (all your github.io apps share storage)
  const get = (k, d) => { try { const v = localStorage.getItem(K(k)); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(K(k), JSON.stringify(v)); } catch (e) { } };
  const okUrl = u => /^https:\/\//i.test(String(u || ''));
  const okImg = u => okUrl(u) || /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i.test(String(u || ''));
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const safeId = id => /^[a-z0-9-]{1,40}$/.test(String(id || '')) ? String(id) : '';

  // v1 → v2 memory (so people don't see what they already closed)
  try {
    const old = localStorage.getItem(CFG.app + '.lastNotice');
    if (old != null && localStorage.getItem(K('lastNotice')) == null) localStorage.setItem(K('lastNotice'), JSON.stringify(+JSON.parse(old) || 0));
    const op = JSON.parse(localStorage.getItem(CFG.app + '.promoSeen') || 'null');
    if (op && op.id && localStorage.getItem(K('seen')) == null) localStorage.setItem(K('seen'), JSON.stringify({ [op.id]: op.at || Date.now() }));
  } catch (e) { }

  async function ask(path) {
    let missing = false;
    for (const s of CFG.servers) {
      try {
        const r = await fetch(s + path, { cache: 'no-store' });
        if (r.status === 404) { missing = true; continue; }
        if (r.ok) return await r.json();
      } catch (e) { /* next server */ }
    }
    return missing ? NOT_FOUND : null;
  }
  function beacon(kind, id) {
    id = safeId(id); if (!id || CFG.preview) return;
    try { fetch(`${CFG.servers[0]}/s/rr${kind}-${id}`, { mode: 'no-cors', keepalive: true, cache: 'no-store' }).catch(() => { }); } catch (e) { }
  }
  // "2026-12-31" = whole day, "2026-12-31T18:30" = exact local time
  function when(s, endOfDay) {
    s = String(s || '').trim(); if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += endOfDay ? 'T23:59:59' : 'T00:00:00';
    const t = new Date(s).getTime(); return isNaN(t) ? null : t;
  }
  const inWindow = p => { const now = Date.now(), a = when(p.start), b = when(p.end, true); return (a == null || now >= a) && (b == null || now <= b); };

  /* ---------- styles ---------- */
  function css() {
    if (document.getElementById('rrn-css')) return;
    const st = el('style'); st.id = 'rrn-css';
    st.textContent = `
.rrn,.rrn *{box-sizing:border-box}
.rrn{--rrn-accent:${CFG.accent};font:15px/1.42 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#111;-webkit-font-smoothing:antialiased;letter-spacing:-.005em}
.rrn button{font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.rrn-x{position:absolute;top:10px;right:10px;width:30px;height:30px;border:0;border-radius:50%;display:grid;place-items:center;background:rgba(0,0,0,.45);color:#fff;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);z-index:3}
.rrn-x svg{width:14px;height:14px}
.rrn-go{display:block;width:100%;margin-top:14px;padding:13px 16px;border:0;border-radius:14px;background:var(--rrn-accent);color:#fff;font-weight:600}
.rrn-go:active{transform:scale(.98)}
.rrn-tag{font-size:12px;color:rgba(0,0,0,.5);margin-bottom:4px;letter-spacing:.01em}
.rrn-t{font-size:19px;font-weight:700;line-height:1.22;letter-spacing:-.02em}
.rrn-d{margin-top:6px;color:rgba(0,0,0,.66);white-space:pre-line}
.rrn-cd{display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:5px 10px;border-radius:999px;background:rgba(0,0,0,.06);font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}
.rrn-cd i{width:7px;height:7px;border-radius:50%;background:var(--rrn-accent);animation:rrn-blink 1s steps(2) infinite}
@keyframes rrn-blink{50%{opacity:.25}}
/* message banner */
.rrn-note{position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:2147483000;max-width:520px;margin:0 auto;
  display:flex;gap:12px;align-items:flex-start;padding:14px 46px 14px 16px;border-radius:20px;background:rgba(255,255,255,.9);
  box-shadow:0 10px 40px rgba(0,0,0,.22);-webkit-backdrop-filter:saturate(1.8) blur(24px);backdrop-filter:saturate(1.8) blur(24px);
  transform:translateY(calc(-100% - 30px));opacity:0;transition:transform .45s cubic-bezier(.2,.9,.25,1),opacity .3s}
.rrn-note.on{transform:none;opacity:1}
.rrn-note .rrn-x{top:12px;right:12px;width:26px;height:26px;background:rgba(0,0,0,.08);color:#111}
.rrn-note .rrn-t{font-size:15px;letter-spacing:0}.rrn-note .rrn-d{margin-top:2px;font-size:14px}
.rrn-note .rrn-go{display:inline-block;width:auto;margin-top:10px;padding:7px 14px;border-radius:999px;font-size:14px}
.rrn-note .rrn-n{font-size:12px;color:rgba(0,0,0,.45);margin-top:6px}
/* promotion: shared */
.rrn-scrim{position:fixed;inset:0;z-index:2147482990;background:rgba(0,0,0,.42);opacity:0;transition:opacity .3s}
.rrn-scrim.on{opacity:1}
.rrn-card{position:fixed;z-index:2147482995;background:#fff;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.35);display:flex;flex-direction:column}
.rrn-body{padding:16px 18px 18px;overflow:auto}
.rrn-media{position:relative;flex:none;background:#eee}
.rrn-media img{display:block;width:100%;height:100%;max-height:min(56vh,520px);object-fit:cover}
.rrn-slides{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.rrn-slides::-webkit-scrollbar{display:none}
.rrn-slide{flex:0 0 100%;scroll-snap-align:center;position:relative}
.rrn-cap{position:absolute;left:0;right:0;bottom:0;padding:30px 16px 22px;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.6))}
.rrn-cap b{display:block;font-size:17px}.rrn-cap span{font-size:14px;opacity:.9}
.rrn-dots{position:absolute;left:0;right:0;bottom:8px;display:flex;justify-content:center;gap:6px;z-index:2}
.rrn-dots button{width:7px;height:7px;padding:0;border:0;border-radius:4px;background:rgba(255,255,255,.55);transition:width .25s,background .25s}
.rrn-dots button.on{width:18px;background:#fff}
/* popup (centre) */
.rrn-card.popup{left:50%;top:50%;width:min(420px,calc(100vw - 32px));max-height:calc(100% - 48px);border-radius:24px;transform:translate(-50%,-46%) scale(.94);opacity:0;transition:transform .45s cubic-bezier(.2,.9,.25,1),opacity .3s}
.rrn-card.popup.on{transform:translate(-50%,-50%);opacity:1}
/* sheet (bottom) */
.rrn-card.sheet{left:0;right:0;bottom:0;margin:0 auto;width:100%;max-width:560px;max-height:88%;border-radius:24px 24px 0 0;padding-bottom:env(safe-area-inset-bottom,0px);transform:translateY(105%);transition:transform .45s cubic-bezier(.2,.9,.25,1)}
.rrn-card.sheet.on{transform:none}
.rrn-card.sheet::before{content:"";position:absolute;top:7px;left:50%;width:38px;height:5px;margin-left:-19px;border-radius:3px;background:rgba(255,255,255,.75);z-index:3}
@media (min-width:700px){.rrn-card.sheet{bottom:24px;width:min(460px,calc(100vw - 48px));border-radius:24px}.rrn-card.sheet::before{display:none}}
/* banner (slim, top) */
.rrn-card.banner{left:12px;right:12px;top:calc(env(safe-area-inset-top,0px) + 10px);margin:0 auto;max-width:560px;flex-direction:row;align-items:center;gap:12px;padding:10px 44px 10px 10px;border-radius:20px;
  background:rgba(255,255,255,.92);-webkit-backdrop-filter:saturate(1.8) blur(24px);backdrop-filter:saturate(1.8) blur(24px);transform:translateY(calc(-100% - 30px));opacity:0;transition:transform .45s cubic-bezier(.2,.9,.25,1),opacity .3s}
.rrn-card.banner.on{transform:none;opacity:1}
.rrn-card.banner .rrn-media{width:64px;height:64px;border-radius:14px;overflow:hidden}
.rrn-card.banner .rrn-media img{height:64px;max-height:none}
.rrn-card.banner .rrn-body{padding:0;flex:1;min-width:0}
.rrn-card.banner .rrn-t{font-size:15px;letter-spacing:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rrn-card.banner .rrn-d{font-size:13px;margin-top:1px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rrn-card.banner .rrn-tag{font-size:11px;margin-bottom:1px}
.rrn-card.banner .rrn-go{display:inline-block;width:auto;margin-top:6px;padding:5px 12px;border-radius:999px;font-size:13px}
.rrn-card.banner .rrn-cd{margin-top:4px;padding:2px 8px;font-size:12px}
.rrn-card.banner .rrn-x{top:50%;margin-top:-13px;width:26px;height:26px;background:rgba(0,0,0,.08);color:#111}
@media (max-height:520px){.rrn-media img{max-height:38vh}.rrn-card.popup{max-height:calc(100% - 20px)}}
@media (prefers-color-scheme:dark){
  .rrn{color:#f2f2f7}.rrn-card,.rrn-card.sheet{background:#1c1c1e}.rrn-card.banner,.rrn-note{background:rgba(44,44,46,.9)}
  .rrn-tag,.rrn-note .rrn-n{color:rgba(255,255,255,.5)}.rrn-d{color:rgba(255,255,255,.7)}.rrn-cd{background:rgba(255,255,255,.1)}
  .rrn-note .rrn-x,.rrn-card.banner .rrn-x{background:rgba(255,255,255,.14);color:#fff}.rrn-media{background:#2c2c2e}}
@media (prefers-reduced-motion:reduce){.rrn-note,.rrn-card,.rrn-scrim{transition:opacity .2s!important;transform:none!important}.rrn-card.popup{transform:translate(-50%,-50%)!important}.rrn-cd i{animation:none}}`;
    document.head.appendChild(st);
  }
  const X_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  function closeBtn(fn) { const x = el('button', 'rrn-x'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.innerHTML = X_ICON; x.onclick = e => { e.stopPropagation(); fn(); }; return x; }
  const raf2 = f => requestAnimationFrame(() => requestAnimationFrame(f));
  const leave = (node, ms) => setTimeout(() => node.remove(), reduced() ? 50 : ms);

  /* ---------- one thing on screen at a time ---------- */
  const queue = []; let onScreen = false;
  function enqueue(show) { queue.push(show); pump(); }
  function pump() {
    if (onScreen || !queue.length || !document.body) return;
    onScreen = true;
    const show = queue.shift();
    let finished = false;
    const done = () => { if (finished) return; finished = true; setTimeout(() => { onScreen = false; pump(); }, 450); };
    try { show(done); } catch (e) { done(); }
  }

  /* ---------- countdown ---------- */
  function countdown(target, onEnd) {
    const box = el('div', 'rrn-cd'); box.appendChild(el('i')); const t = el('span'); box.appendChild(t);
    const pad = n => String(n).padStart(2, '0');
    const tick = () => {
      const ms = target - Date.now();
      if (ms <= 0) { t.textContent = 'Offer ended'; clearInterval(iv); onEnd && onEnd(); return; }
      const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
      t.textContent = 'Ends in ' + (d ? d + 'd ' : '') + pad(h) + ':' + pad(m) + ':' + pad(s % 60);
    };
    const iv = setInterval(() => { if (!box.isConnected) return clearInterval(iv); tick(); }, 1000); tick();
    return box;
  }

  /* ---------- message banner ---------- */
  function noticeView(n, i, total, onClose) {
    return done => {
      css();
      const box = el('div', 'rrn rrn-note'); box.setAttribute('role', 'alert');
      if (n._accent) box.style.setProperty('--rrn-accent', n._accent);
      const main = el('div'); main.style.minWidth = '0'; main.style.flex = '1';
      if (n.title) main.appendChild(el('div', 'rrn-t', n.title));
      if (n.body) main.appendChild(el('div', 'rrn-d', n.body));
      const close = () => { onClose && onClose(); box.classList.remove('on'); leave(box, 450); done(); };
      if (okUrl(n.url)) { const b = el('button', 'rrn-go', 'Open'); b.type = 'button'; b.onclick = () => { close(); window.open(n.url, '_blank', 'noopener'); }; main.appendChild(b); }
      if (total > 1) main.appendChild(el('div', 'rrn-n', (i + 1) + ' of ' + total));
      box.append(main, closeBtn(close));
      document.body.appendChild(box); raf2(() => box.classList.add('on'));
    };
  }

  /* ---------- promotion ---------- */
  function promoView(p, onShown) {
    return done => {
      css();
      const style = ['popup', 'sheet', 'banner'].includes(p.style) ? p.style : 'popup';
      const card = el('div', 'rrn rrn-card ' + style); card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', style === 'banner' ? 'false' : 'true');
      if (p._accent) card.style.setProperty('--rrn-accent', p._accent);
      const scrim = style === 'banner' ? null : el('div', 'rrn rrn-scrim');
      let timer = null, closed = false;
      const close = () => {
        if (closed) return; closed = true; clearInterval(timer); document.removeEventListener('keydown', esc);
        card.classList.remove('on'); scrim && scrim.classList.remove('on'); leave(card, 460); scrim && leave(scrim, 460); done();
      };
      const esc = e => { if (e.key === 'Escape') close(); };
      const slides = (Array.isArray(p.slides) ? p.slides : []).filter(s => s && okImg(s.image)).slice(0, 8);
      let cur = 0;
      const linkNow = () => (slides[cur] && okUrl(slides[cur].url) ? slides[cur].url : okUrl(p.url) ? p.url : '');
      const go = () => { const u = linkNow(); if (!u) return; if (p.track) beacon('c', p.id); close(); window.open(u, '_blank', 'noopener'); };

      // picture or carousel
      if (style !== 'banner' && slides.length > 1) {
        const media = el('div', 'rrn-media'); const track = el('div', 'rrn-slides'); const dots = el('div', 'rrn-dots');
        slides.forEach((s, i) => {
          const sl = el('div', 'rrn-slide'); const im = el('img'); im.src = s.image; im.alt = s.title || p.title || ''; im.loading = i ? 'lazy' : 'eager'; im.draggable = false; sl.appendChild(im);
          if (s.title || s.text) { const cap = el('div', 'rrn-cap'); if (s.title) cap.appendChild(el('b', '', s.title)); if (s.text) cap.appendChild(el('span', '', s.text)); sl.appendChild(cap); }
          if (linkNow) im.onclick = go;
          track.appendChild(sl);
          const d = el('button'); d.type = 'button'; d.setAttribute('aria-label', 'Slide ' + (i + 1)); d.onclick = () => { to(i); restart(); }; dots.appendChild(d);
        });
        const paint = () => [...dots.children].forEach((d, i) => d.classList.toggle('on', i === cur));
        const to = i => { cur = (i + slides.length) % slides.length; track.scrollTo({ left: cur * track.clientWidth, behavior: reduced() ? 'auto' : 'smooth' }); paint(); };
        track.addEventListener('scroll', () => { const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); if (i !== cur) { cur = i; paint(); } }, { passive: true });
        const restart = () => { clearInterval(timer); if (!reduced()) timer = setInterval(() => to(cur + 1), Math.max(2500, (p.slideSecs || 4) * 1000)); };
        track.addEventListener('touchstart', () => clearInterval(timer), { passive: true });
        track.addEventListener('touchend', restart, { passive: true });
        media.append(track, dots); card.appendChild(media); paint(); restart();
      } else {
        const img = slides[0] ? slides[0].image : p.image;
        if (okImg(img)) { const media = el('div', 'rrn-media'); const im = el('img'); im.src = img; im.alt = p.title || 'Promotion'; if (okUrl(p.url)) { im.style.cursor = 'pointer'; im.onclick = go; } media.appendChild(im); card.appendChild(media); }
      }
      const body = el('div', 'rrn-body');
      body.appendChild(el('div', 'rrn-tag', p.sponsor ? 'Sponsored \u00b7 ' + p.sponsor : 'Sponsored'));
      if (p.title) body.appendChild(el('div', 'rrn-t', p.title));
      if (p.text) body.appendChild(el('div', 'rrn-d', p.text));
      let cta = null;
      if (okUrl(p.url) || slides.some(s => okUrl(s.url))) { cta = el('button', 'rrn-go', p.cta || 'Learn more'); cta.type = 'button'; cta.onclick = go; }
      const end = when(p.end, true);
      if (p.countdown && end) body.appendChild(countdown(end, () => { if (cta) { cta.disabled = true; cta.style.opacity = '.5'; } }));
      if (cta) body.appendChild(cta);
      card.append(body, closeBtn(close));
      if (scrim) { scrim.onclick = close; document.body.appendChild(scrim); }
      document.addEventListener('keydown', esc);
      document.body.appendChild(card);
      raf2(() => { card.classList.add('on'); scrim && scrim.classList.add('on'); });
      onShown && onShown();
      if (p.track) beacon('v', p.id);
    };
  }

  /* ---------- deciding what to show ---------- */
  function normal(d) {
    if (!d || d === NOT_FOUND) return null;
    if (Array.isArray(d.items)) return { perOpen: Math.min(5, Math.max(1, +d.perOpen || 1)), items: d.items };
    if (d.id) return { perOpen: 1, items: [d] };      // v1 single promotion
    return null;
  }
  function due(p, seen) {
    const at = seen[p.id]; if (!at) return true;
    if (p.freq === 'always') return true;
    if (p.freq === 'daily') return Date.now() - at > 20 * 3600e3;
    return false;   // once per person
  }
  function pickPromos(data) {
    const seen = get('seen', {}) || {};
    const ok = data.items.filter(p => p && p.id && p.active !== false && inWindow(p) && (okImg(p.image) || p.title || (p.slides || []).some(s => okImg(s && s.image))) && due(p, seen));
    if (!ok.length) return [];
    const last = get('lastPromo', ''); const i = ok.findIndex(p => p.id === last);
    const start = i >= 0 ? i + 1 : 0;   // the next one after the last shown, so each open shows a different one
    const out = []; for (let k = 0; k < Math.min(data.perOpen, ok.length); k++) out.push(ok[(start + k) % ok.length]);
    return out;
  }
  function queuePromos(data) {
    if (!data) return;
    for (const p of pickPromos(data)) enqueue(promoView(p, () => {
      const seen = get('seen', {}) || {}; seen[p.id] = Date.now();
      const keep = new Set(data.items.map(x => x && x.id)); for (const k in seen) if (!keep.has(k)) delete seen[k];   // forget removed promotions
      put('seen', seen); put('lastPromo', p.id);
    }));
  }
  function queueNotices(items, latest) {
    const since = +get('lastNotice', 0) || 0;
    const list = (items || []).filter(n => n && n.id > since && Date.now() - (n.created || 0) < NOTICE_AGE && (n.title || n.body)).sort((a, b) => a.id - b.id).slice(-MAX_NOTICES);
    if (!list.length) { if (latest > since) put('lastNotice', latest); return; }
    list.forEach((n, i) => enqueue(noticeView(n, i, list.length, () => { if (n.id > (+get('lastNotice', 0) || 0)) put('lastNotice', n.id); })));
  }

  let busy = false;
  async function run() {
    if (CFG.preview || busy || onScreen || document.hidden) return;
    busy = true;
    try {
      const fresh = Date.now() - (+get('lastCheck', 0) || 0) >= CFG.every * 60e3 && navigator.onLine !== false;
      let feed = null, promos = null;
      if (fresh) {
        put('lastCheck', Date.now());
        const since = +get('lastNotice', 0) || 0;
        const [f, pr] = await Promise.all([
          CFG.notices ? ask(`/feed/${encodeURIComponent(CFG.app)}?since=${since}`).catch(() => null) : null,
          CFG.promo ? loadPromos() : null
        ]);
        if (f && f !== NOT_FOUND && Array.isArray(f.items)) { feed = f; put('feed', { items: f.items.slice(0, MAX_NOTICES), latest: f.latest }); }
        promos = pr;
      } else {
        const fc = get('feed', null); if (CFG.notices && fc) feed = fc;
        const pc = get('promos', null); if (CFG.promo && pc) promos = normal(pc);
      }
      if (feed) queueNotices(feed.items, feed.latest);
      if (promos) queuePromos(promos);
    } finally { busy = false; }
  }
  async function loadPromos() {
    let d = await ask(`/v/${encodeURIComponent(CFG.app)}/promos`).catch(() => null);
    if (d === NOT_FOUND) {   // older single promotion, checked at most once a day if there is none
      if (Date.now() - (+get('v1none', 0) || 0) > 864e5) { d = await ask(`/v/${encodeURIComponent(CFG.app)}/promo`).catch(() => null); if (d === NOT_FOUND) put('v1none', Date.now()); }
      else d = null;
    }
    if (d === NOT_FOUND) { put('promos', null); return null; }
    const n = normal(d);
    if (n) { const txt = JSON.stringify(d); put('promos', txt.length < CACHE_MAX ? d : null); }
    return n;
  }

  /* ---------- when the app opens ---------- */
  let hiddenAt = 0;
  const start = () => setTimeout(run, CFG.delay);
  if (!CFG.preview) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      if (Date.now() - hiddenAt > 30000) setTimeout(run, 500);   // counts as opening the app again
    });
  }

  window.RelayNotice = {
    config: CFG,
    now: () => { put('lastCheck', 0); return run(); },                     // check the server right now
    reset: () => { ['lastCheck', 'lastNotice', 'seen', 'lastPromo', 'feed', 'promos', 'v1none'].forEach(k => { try { localStorage.removeItem(K(k)); } catch (e) { } }); return run(); },
    // used by the Relay Relay control app to show exactly what people will see
    preview(kind, data) {
      if (kind === 'notice') enqueue(noticeView(data, 0, 1));
      else enqueue(promoView({ ...data, track: false }));
    }
  };
})();
