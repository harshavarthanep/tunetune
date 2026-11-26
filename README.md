# Tune Tune v1.1

**YouTube Music-style search · JioSaavn-quality sound · Apple Music-style design.**
A free music & podcast player for every device — no account, no ads of its own. Made by H24 Creationz.

## Upload to GitHub Pages
Upload everything in this folder to your repo (keep `.nojekyll` and the `icons` folder), then
**Settings → Pages → Deploy from branch → main / root**. Open the site and install it:
- **Android / Windows / Mac (Chrome or Edge):** menu → *Install app*.
- **iPhone / iPad (Safari):** Share → *Add to Home Screen*.

## Where the music comes from (in this order)
1. **Free sources** — JioSaavn through free public relays and community servers, plus ad-free YouTube Music audio
   through public mirrors. The app re-checks them every time it starts and keeps the fastest one.
2. **Your servers** — only when **My server** is switched on (Settings → Music sources, the ⋯ menu, or the small
   switch beside *Show video*), and only after every free source failed:
   first the `musicServer` in `tunetune-config.json`, then your own server saved in the app.
3. **YouTube player** — the last resort for songs nothing else has.

Tap the quality badge in Now Playing to see where the current song is coming from
(green dot = free source, blue = your server, red = YouTube).

## Your own free music server (optional backup)
1. In the app: **Settings → Music sources → Your own music server** → *Copy server code*.
2. Paste it into a free Cloudflare Worker (dash.cloudflare.com → Workers & Pages → Create Worker → Edit code → Deploy).
3. Paste the worker address in the app and press **Test & Save**, then switch **My server** on.
4. To make it available for everyone who opens your site: rename `tunetune-config1.json` to `tunetune-config.json`
   (or create one from `tunetune-config.example.json`). It's still only used when **My server** is on.

## More free sources
`tunetune-sources.json` is a list of BACKUP FREE sources (relays, JioSaavn servers, YouTube mirrors). It is always
used — no switch — but only after the built-in free sources fail, and before your own servers and the YouTube player.
Add or remove lines any time; dead entries are skipped automatically. Each entry can be a link or `{"name": "…", "url": "…"}`.
Relay links use `{url}` where the target goes: `…?url={url}` (link encoded) or `…/{url}` (link as is).

The order every song follows: built-in free sources → tunetune-sources.json → (My server on) your tunetune-config
servers, then your own server → YouTube player. Tap the quality badge to see which one answered.

## Your own extra free relays (recommended)
Public free relays come and go — most were down in 2026. A free relay of your own is the most reliable free source,
and it doesn't use your Cloudflare musicServer's daily limit.
1. Go to Deno Deploy (deno.com/deploy), sign in, create a new project or playground.
2. Paste all of `free-relay.js` and deploy. You get an address like `https://your-name.deno.dev`.
3. Add it to `tunetune-sources.json` under `"relays"`:
   `{ "name": "My Deno relay", "url": "https://your-name.deno.dev/?url={url}" }`
4. Settings → Test music sources shows ✓ when it works.

You can also deploy your own copy of the open-source JioSaavn API on Vercel (sumitkolhe/jiosaavn-api, set the region to
Mumbai bom1) and add `https://your-copy.vercel.app/api` under `"saavnServers"`. Each one is free and has its own limits.

## Free sources and backup servers
`tunetune-sources.json` adds more FREE sources (relays, JioSaavn servers, YouTube mirrors) and your own BACKUP SERVERS
(Cloudflare Workers on other accounts, Google Apps Script). Order every song follows: built-in free sources → the free
lists in tunetune-sources.json → the free lists in tunetune-config.json → backup servers (one by one) → with My server on:
your own server, then the tunetune-config musicServer → YouTube player. A route is only marked down after two failures
in a row, and down routes are re-checked when the app starts and (at most every 3 minutes) while you use it — no
background timers. Set-up steps for backup servers: `relays/README.md`.

## Mixes, karaoke and customising
* **Artist & show mixes** — on any artist or podcast show page tap the mix button. Mixes update themselves, can be
  filtered, sorted (shows: continue where you left by default), pinned to Home, downloaded and shared as a link.
  Artists and shows are never mixed, and mixes stay apart from normal playlists.
* **Karaoke** — ⋯ menu, the lyrics bar or Car Mode. Turns the lead vocals down for songs (never podcasts or radio).
* **Settings → Home & tabs / Offline** — choose what Home, Podcasts and Explore show, and keep songs and podcasts apart.
* **Backup** — Settings → Export Backup saves everything except your name; Import restores it on any device.

## Other things you can edit
At the top of `app.js`: `PRODUCTS_URL` and `GITHUB_URL` (shown in Settings → More from H24 Creationz).

## Good to know
- Songs keep playing in the background and with the screen locked while the app is open. Browsers stop audio when an app is swiped away — that's a phone rule for all web apps.
- Party Mode's torch works in Chrome on Android, is limited to 2 flashes a second and turns itself off after 5 minutes.
- Your library, downloads and the last 30 songs you played stay on the device; clearing the browser *cache* doesn't remove them (clearing *site data* does).
