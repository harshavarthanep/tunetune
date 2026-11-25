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

## Other things you can edit
At the top of `app.js`: `PRODUCTS_URL` and `GITHUB_URL` (shown in Settings → More from H24 Creationz).

## Good to know
- Songs keep playing in the background and with the screen locked while the app is open. Browsers stop audio when an app is swiped away — that's a phone rule for all web apps.
- Party Mode's torch works in Chrome on Android, is limited to 2 flashes a second and turns itself off after 5 minutes.
- Your library, downloads and the last 30 songs you played stay on the device; clearing the browser *cache* doesn't remove them (clearing *site data* does).
