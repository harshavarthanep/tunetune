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
   through public mirrors. Then the free lists in `tunetune-sources.json`, then the free lists in `tunetune-config.json`.
   The app re-checks them every time it starts and keeps the fastest one.
2. **Backup servers** — `tunetune-sources.json` → `backupServers`, one by one, only after every free source failed
   (a slow free source is waited for, not skipped).
3. **Your servers** — only when **My server** is switched on (Settings → Music sources, the ⋯ menu, or the small
   switch beside *Show video*), and only after the backup servers failed:
   first your own server saved in the app, then the `musicServer` in `tunetune-config.json`.
4. **YouTube player** — the last resort for songs nothing else has.

Tap the quality badge in Now Playing to see where the current song is coming from
(green dot = free source, blue = your server, red = YouTube).

## Your own free music server (optional backup)
1. In the app: **Settings → Music sources → Your own music server** → *Copy server code*.
2. Paste it into a free Cloudflare Worker (dash.cloudflare.com → Workers & Pages → Create Worker → Edit code → Deploy).
3. Paste the worker address in the app and press **Test & Save**, then switch **My server** on.
4. To make it available for everyone who opens your site: put the address as `"musicServer"` in `tunetune-config.json`
   (see `tunetune-config.example.json`). It's still only used when **My server** is on, which is off by default.
   (`tunetune-config1.json` is an old file — the app doesn't read it.)

## More free sources
`tunetune-sources.json` is a list of BACKUP FREE sources (relays, JioSaavn servers, YouTube mirrors). It is always
used — no switch — but only after the built-in free sources fail, and before your own servers and the YouTube player.
Add or remove lines any time; dead entries are skipped automatically. Each entry can be a link or `{"name": "…", "url": "…"}`.
Relay links use `{url}` where the target goes: `…?url={url}` (link encoded) or `…/{url}` (link as is).

The order every song follows: built-in free sources → tunetune-sources.json → tunetune-config.json free lists →
backup servers → (My server on) your own server, then the tunetune-config musicServer → YouTube player.
Tap the quality badge to see which one answered.

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

## Calls, notifications and gapless (new)
* **Android app:** calls and alarms pause the music and it resumes afterwards; notification sounds lower songs for a
  moment and briefly pause podcasts; another music app starting stops Tune Tune — like Spotify. Settings → Pause for
  calls & notifications (on by default). This uses a small native plugin (`build/android-extra/java/AudioFocusPlugin.java`),
  added to the Android project automatically by `scripts/android-setup.js` during “Build apps”.
* **Gapless playback**, **search & sort inside playlists**, **hide a genre or language** (⋯ → Hide songs like this…) and
  **Play a random album** (Library).

## Other things you can edit
At the top of `app.js`: `PRODUCTS_URL` and `GITHUB_URL` (shown in Settings → More from H24 Creationz).

## Good to know
- Songs keep playing in the background and with the screen locked while the app is open. Browsers stop audio when an app is swiped away — that's a phone rule for all web apps.
- Party Mode's torch works in Chrome on Android, is limited to 2 flashes a second and turns itself off after 5 minutes.
- Your library, downloads and the last 30 songs you played stay on the device; clearing the browser *cache* doesn't remove them (clearing *site data* does).
