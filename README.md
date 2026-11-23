# Tune Tune 4.0 — GitHub Pages edition

A free music and podcast player that runs entirely from GitHub Pages. No computer has to stay on, nothing needs installing, and there's no account and no API key.

## Put it online
1. Create a repo (for example `TuneTune`) and upload **everything in this folder**, including the `icons` folder and the hidden `.nojekyll` file.
2. Repo → Settings → Pages → Source: *Deploy from a branch* → `main` / root → Save.
3. Open `https://<your-username>.github.io/TuneTune/` after a minute.

**Install it like an app:**
- **Android (Chrome):** menu ⋮ → *Install app*.
- **iPhone/iPad (Safari):** Share → *Add to Home Screen*.
- **Desktop (Chrome/Edge):** the install icon in the address bar.

**Updating:** upload the new files over the old ones. Open the app once and it refreshes itself. Your library stays.

## Where the music comes from
- **Songs:** JioSaavn's catalog (Tamil, Hindi, Telugu, Malayalam, Kannada, Punjabi, English and more, including old classics). It plays as clean audio up to 320 kbps with real album art. There's no YouTube and no video.
- **Podcasts:** the Apple Podcasts directory.
- **Live radio:** Radio Browser.
- **Lyrics:** LRCLIB.
- **Independent music:** Audius.
- **Your own files:** MP3/M4A/FLAC/WAV from your device.

Because songs are ordinary audio files, they **keep playing when you lock the screen or switch to another app**, with play/pause/next on the lock screen and in the notification. If you swipe the app away from your recent apps, the system closes it and music stops. That happens with every website, including Spotify's.

## If songs stop loading
Song data comes through free community-run JioSaavn servers. The app switches between several automatically. If they're all down:
1. Fork https://github.com/sumitkolhe/jiosaavn-api and deploy it free on Vercel. It takes about 2 minutes, and no credit card is needed.
2. In Tune Tune: Settings → Advanced → **JioSaavn server** → paste your Vercel address followed by `/api`.

Settings → Advanced → **Test music sources** shows what's working.

## Good to know
- YouTube's video player is **off** by default. If you want it as a last resort for songs JioSaavn doesn't have, turn it on in Settings → Advanced (it can show ads and pauses when locked).
- The equalizer isn't available on iPhone/iPad, because Safari stops it when the screen locks.
- Backups: Settings → Advanced → Export / Import moves your library between devices.
