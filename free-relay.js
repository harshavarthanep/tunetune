// Tune Tune free relay — a second free backend, separate from your Cloudflare worker.
// Deno Deploy: create a new project/playground, paste this whole file, press Deploy.
// Val Town:   create an HTTP val, paste it, and change the LAST line to:  export default handle;
// Then add its address to tunetune-sources.json → "relays", e.g.
//   { "name": "My Deno relay", "url": "https://your-name.deno.dev/?url={url}" }

const ALLOW = /(^|\.)(jiosaavn\.com|saavncdn\.com|saavn\.com|youtube\.com)$/;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
};

async function handle(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const target = new URL(req.url).searchParams.get('url');
  if (!target) return new Response('Tune Tune relay is running', { headers: CORS });
  let t;
  try { t = new URL(target); } catch (e) { return new Response('Bad link', { status: 400, headers: CORS }); }
  if (!ALLOW.test(t.hostname)) return new Response('Not allowed', { status: 403, headers: CORS });
  const h = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
    'Accept': '*/*', 'Accept-Language': 'en-IN,en;q=0.9',
  };
  if (/saavn/.test(t.hostname)) h['Referer'] = 'https://www.jiosaavn.com/';
  if (t.hostname.endsWith('jiosaavn.com')) h['Cookie'] = 'gdpr_acceptance=true; DL=english';
  if (t.hostname.endsWith('youtube.com')) h['Cookie'] = 'CONSENT=YES+1';
  const range = req.headers.get('Range');
  if (range) h['Range'] = range;
  const r = await fetch(t.toString(), { method: req.method, headers: h });
  const out = new Headers(r.headers);
  for (const k in CORS) out.set(k, CORS[k]);
  out.delete('set-cookie'); out.delete('content-security-policy'); out.delete('content-encoding');
  return new Response(r.body, { status: r.status, headers: out });
}

Deno.serve(handle);
