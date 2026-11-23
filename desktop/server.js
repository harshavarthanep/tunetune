/* Tune Tune Home Server
   Runs inside the desktop app. Serves the app to phones, tablets and browsers on your network and
   fetches YouTube Music audio for them, so the website plays clean audio (no ads, works with the screen locked).
   Only talks to YouTube hosts; everything stays on your own network. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Readable } = require('stream');

const UA = {
  ANDROID_VR: 'com.google.android.apps.youtube.vr.oculus/1.62.27 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
  IOS: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
  ANDROID: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip',
  WEB: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};
const CLIENT_IDS = { ANDROID_VR: 28, IOS: 5, ANDROID: 3 };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8' };
const STATIC = new Set(['index.html', 'app.js', 'styles.css', 'sw.js', 'manifest.webmanifest']);

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
}
function send(res, code, body, type = 'application/json') {
  if (res.headersSent) { try { res.end(); } catch (e) { } return; }
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req, limit = 200000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function lanAddresses(port) {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) {
    if (a.family === 'IPv4' && !a.internal && !/^169\.254\./.test(a.address)) out.push(`http://${a.address}:${port}`);
  }
  return out;
}

function createServer({ root, version = '3', fetchImpl } = {}) {
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  return http.createServer(async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    let u; try { u = new URL(req.url, 'http://local'); } catch (e) { return send(res, 400, { error: 'bad url' }); }
    const p = u.pathname;
    try {
      if (p === '/api/ping') return send(res, 200, { tunetune: true, version, name: os.hostname() });

      // YouTube Music catalog (search, browse, next, suggestions)
      if (p.startsWith('/api/ytm/') && req.method === 'POST') {
        const ep = p.slice('/api/ytm/'.length);
        if (!/^(search|browse|next|music\/get_search_suggestions)$/.test(ep)) return send(res, 404, { error: 'unknown endpoint' });
        const body = await readBody(req);
        const qs = new URLSearchParams(u.search); qs.set('prettyPrint', 'false');
        const r = await doFetch(`https://music.youtube.com/youtubei/v1/${ep}?${qs}`, {
          method: 'POST', body,
          headers: { 'Content-Type': 'application/json', 'User-Agent': UA.WEB, Origin: 'https://music.youtube.com', Referer: 'https://music.youtube.com/' },
        });
        return send(res, r.status, await r.text());
      }

      // Audio stream info, fetched with a phone app's identity
      if (p === '/api/player' && req.method === 'POST') {
        const { client, body } = JSON.parse(await readBody(req) || '{}');
        if (!UA[client] || !CLIENT_IDS[client]) return send(res, 400, { error: 'unknown client' });
        const r = await doFetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
          method: 'POST', body: JSON.stringify(body || {}),
          headers: { 'Content-Type': 'application/json', 'User-Agent': UA[client], 'X-YouTube-Client-Name': String(CLIENT_IDS[client]), 'X-YouTube-Client-Version': (body && body.context && body.context.client && body.context.client.clientVersion) || '' },
        });
        return send(res, r.status, await r.text());
      }

      // The audio itself, passed through with seeking (Range) support
      if (p === '/api/stream') {
        const target = u.searchParams.get('u') || ''; const c = u.searchParams.get('c') || '';
        let t; try { t = new URL(target); } catch (e) { return send(res, 400, { error: 'bad target' }); }
        if (t.protocol !== 'https:' || !/(^|\.)googlevideo\.com$/.test(t.hostname)) return send(res, 403, { error: 'only YouTube audio can be streamed' });
        const headers = { 'User-Agent': UA[c] || UA.ANDROID_VR };
        if (req.headers.range) headers.Range = req.headers.range;
        const ac = new AbortController(); req.on('close', () => ac.abort());
        const r = await doFetch(t.toString(), { headers, signal: ac.signal });
        const out = { 'Content-Type': r.headers.get('content-type') || 'audio/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
        for (const h of ['content-length', 'content-range']) { const v = r.headers.get(h); if (v) out[h.replace(/(^|-)\w/g, m => m.toUpperCase())] = v; }
        res.writeHead(r.status, out);
        if (!r.body || req.method === 'HEAD') return res.end();
        Readable.fromWeb(r.body).on('error', () => { try { res.end(); } catch (e) { } }).pipe(res);
        return;
      }

      // The app itself
      let file = p === '/' ? 'index.html' : decodeURIComponent(p.slice(1));
      const ok = STATIC.has(file) || /^icons\/[\w.-]+\.png$/.test(file);
      if (!ok) return send(res, 404, 'Not found', 'text/plain');
      const full = path.join(root, file);
      if (!full.startsWith(path.resolve(root))) return send(res, 403, 'Forbidden', 'text/plain');
      fs.readFile(full, (err, buf) => {
        if (err) return send(res, 404, 'Not found', 'text/plain');
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(full)] || 'application/octet-stream', 'Cache-Control': file === 'index.html' || file === 'sw.js' ? 'no-cache' : 'public, max-age=300' });
        res.end(buf);
      });
    } catch (e) {
      send(res, 502, { error: String(e && e.message || e) });
    }
  });
}

function start({ root, port = 8686, version, onError } = {}) {
  const server = createServer({ root, version });
  server.on('error', e => onError && onError(e));
  server.listen(port, '0.0.0.0');
  return { server, port, addresses: () => lanAddresses(port), stop: () => new Promise(r => server.close(() => r())) };
}

module.exports = { createServer, start, lanAddresses, UA };
