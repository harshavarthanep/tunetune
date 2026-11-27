// relay-relay-tunetune.js — add to Tune Tune and load it before your app code.
// Tune Tune asks your Relay Relay servers for JioSaavn data, tries the next server if one fails,
// and shows announcements you send from the Alerts page.

const RR = {
  // Used if the remote config can't be loaded. Paste extra servers here too.
  servers: ['https://relay-relay.harshavarthan-e.workers.dev'],
  saavnPath: '/r/saavn',          // relay with caching: search, songs, albums, playlists
  streamPath: '/r/saavn-stream',  // relay without caching: stream links
  app: 'tunetune'
};

// Reads App data "tunetune/config" so you can change servers or paths from Relay Relay
// without touching Tune Tune's code.
async function rrLoadConfig() {
  for (const base of RR.servers) {
    try {
      const r = await fetch(base + '/v/tunetune/config');
      if (!r.ok) continue;
      const c = await r.json();
      if (Array.isArray(c.servers) && c.servers.length) RR.servers = c.servers;
      if (c.saavnPath) RR.saavnPath = c.saavnPath;
      if (c.streamPath) RR.streamPath = c.streamPath;
      return;
    } catch (e) { /* try the next server */ }
  }
}

// Tries each server in turn until one answers.
async function rrFetch(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  let lastErr;
  for (const base of RR.servers) {
    try {
      const r = await fetch(`${base}${path}${qs ? '?' + qs : ''}`);
      if (r.ok) return await r.json();
      lastErr = new Error(`${base} answered ${r.status}`);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('No relay server answered');
}

// Any JioSaavn web call, e.g. saavn({ __call: 'search.getResults', q: 'kesariya', p: 1, n: 20 })
const saavn = params => rrFetch(RR.saavnPath, params);

// Turns a song's encrypted_media_url into a playable link.
// If Tune Tune already gets stream links another way that works, keep that instead.
async function saavnStreamUrl(encryptedMediaUrl, bitrate = 320) {
  const d = await rrFetch(RR.streamPath, { __call: 'song.generateAuthToken', url: encryptedMediaUrl, bitrate });
  return d.auth_url;
}

// Shows the newest announcement the user hasn't seen yet.
// Pass in your own toast or banner function: rrCheckAnnouncements(n => showToast(n.title, n.body, n.url))
async function rrCheckAnnouncements(show) {
  const key = 'rr.lastNotice';
  const since = Number(localStorage.getItem(key)) || 0;
  try {
    const d = await rrFetch('/feed/' + RR.app, { since });
    if (d.items && d.items.length) {
      show(d.items[0]);
      localStorage.setItem(key, d.latest);
    }
  } catch (e) { /* announcements are optional */ }
}

/* Example, when Tune Tune starts:

   await rrLoadConfig();
   rrCheckAnnouncements(n => showToast(n.title, n.body, n.url));
   const res = await saavn({ __call: 'search.getResults', q: 'kesariya', p: 1, n: 20 });
   // res.results is the song list
*/
