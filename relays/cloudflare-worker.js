// Tune Tune music server — paste into a free Cloudflare Worker and press Deploy
const ALLOW = /(^|\.)(jiosaavn\.com|saavncdn\.com|saavn\.com|shnwaz\.dev|sumit\.co|saavn\.dev|saavn\.me)$/;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
};
export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const target = new URL(req.url).searchParams.get('url');
    if (!target) return new Response('Tune Tune relay is running', { headers: CORS });
    let t;
    try { t = new URL(target); } catch (e) { return new Response('Bad link', { status: 400, headers: CORS }); }
    if (!ALLOW.test(t.hostname)) return new Response('Not allowed', { status: 403, headers: CORS });
    const h = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
      'Accept': '*/*', 'Accept-Language': 'en-IN,en;q=0.9', 'Referer': 'https://www.jiosaavn.com/',
    };
    const range = req.headers.get('Range');
    if (range) h['Range'] = range;
    if (t.hostname.endsWith('jiosaavn.com')) h['Cookie'] = 'gdpr_acceptance=true; DL=english';
    const media = t.hostname.endsWith('saavncdn.com');
    const r = await fetch(t.toString(), { method: req.method, headers: h, cf: { cacheTtl: media ? 86400 : 300, cacheEverything: true } });
    const out = new Headers(r.headers);
    for (const k in CORS) out.set(k, CORS[k]);
    out.delete('set-cookie');
    return new Response(r.body, { status: r.status, headers: out });
  },
};
