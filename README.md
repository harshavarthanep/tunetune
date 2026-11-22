# Tune Tune

A free music player with an iOS-style interface. Runs in any modern browser and installs as an app on Android, iPhone, iPad, Windows, Mac and Linux. No account, no ads, no subscription, no build step.

## What's inside

| File | What it does |
|---|---|
| `index.html` | App shell |
| `styles.css` | iOS-style design (light/dark, phone/tablet/desktop layouts) |
| `app.js` | Everything else: music sources, player, equalizer, lyrics, library |
| `sw.js` | Service worker so the app opens offline |
| `manifest.webmanifest` | Makes it installable |
| `icons/` | App icons |

## Features

**Listening**
- Full-length songs streamed free from Audius (millions of tracks from independent artists)
- Trending this week, Fresh Underground, trending playlists, 16 genres
- Top Hits Worldwide chart from Deezer (30-second previews), with one-tap "Find on YouTube Music" and "Find on Spotify"
- Live radio: thousands of stations worldwide, by country ("Near You") and by genre, including Bollywood, Tamil and Hindi
- Your own files: add MP3, M4A, FLAC, WAV or OGG from the device (reads title, artist and cover art)

**Player**
- Apple Music-style Now Playing with blurred artwork background, swipe down to close
- Time-synced lyrics (tap a line to jump there) from LRCLIB
- Queue: Play Next, Add to Queue, drag to reorder, remove, clear
- Shuffle, repeat all / repeat one, Autoplay similar songs when the queue ends
- 10-band equalizer with 15 presets
- Sleep timer (with fade-out, or "when this song ends"), playback speed 0.5×–2×
- Background play plus lock-screen, headphone and car controls (Media Session API)
- Resumes where you left off after closing the app
- Keyboard: Space play/pause, ← → seek 10s, Shift+← → previous/next, L favorite, / search

**Library**
- Favorites, playlists (create, rename, delete, add from any song), saved stations, history
- Downloads for offline play (stored privately inside the app), "Download all" for playlists
- Unified search across songs, artists, chart hits, radio and your library
- Backup export/import (JSON)
- Light, dark or automatic theme, 9 accent colours

## Put it online (GitHub Pages)

1. Create a new public repo, for example `TuneTune`.
2. Upload every file and the `icons` folder to the repo root.
3. Settings → Pages → Source: *Deploy from a branch* → `main` / root → Save.
4. Open `https://<your-username>.github.io/TuneTune/` after a minute.

It must be served over HTTPS (GitHub Pages does this) for install, background play and the service worker. Opening `index.html` straight from your disk will not load music.

To test locally: `npx serve .` then open `http://localhost:3000`.

**Updating:** after changing files, bump `CACHE` in `sw.js` (for example `tunetune-v1.0.1`) so installed copies refresh.

## Install as an app

- **Android / Chrome / Edge:** open the site → menu → *Install app*.
- **iPhone / iPad:** open in Safari → Share → *Add to Home Screen*.
- **Play Store APK / Windows Store:** paste your GitHub Pages URL into <https://www.pwabuilder.com> and download the Android or Windows package.

## Where the music comes from

| Source | Used for | Notes |
|---|---|---|
| [Audius API](https://docs.audius.org) | Full songs, trending, artists, playlists, downloads | Free and open; artists choose to share their music there |
| [Deezer API](https://developers.deezer.com) | Worldwide chart and search | 30-second previews only |
| [Radio Browser](https://www.radio-browser.info) | Live radio | Only HTTPS streams are listed |
| [LRCLIB](https://lrclib.net) | Synced lyrics | Community lyrics library |
| [jsmediatags](https://github.com/aadsm/jsmediatags) | Reading tags from your own files | Loaded only when you add files |

**Why not YouTube Music or Spotify streaming?** Neither offers a public way for other apps to stream or download their full catalog. Apps that do it rely on YouTube's private internal API, which breaks YouTube's terms of service, gets apps pulled from stores, and stops working whenever Google changes it. Tune Tune links out to them instead ("Find on YouTube Music / Spotify"), so it stays safe to publish and keep online.

## Customising

- **Name:** change `TITLE` at the top of `app.js`, plus `<title>` in `index.html` and `name` in `manifest.webmanifest`.
- **Default colour:** `accent` in `DEFAULTS.settings` in `app.js` and `--accent` in `styles.css`.
- **Genres / radio categories / countries:** the `GENRES`, `RTAGS` and `COUNTRIES` lists in `app.js`.
- **EQ presets:** `PRESETS` in `app.js`.

## Good to know

- The equalizer works on downloads, device files and most Audius streams. If a stream's server blocks it, the song plays normally without EQ. Live radio and previews always play without EQ.
- Some radio stations go offline; the app tells you and moves on.
- On iPhone, the volume slider is hidden because iOS only allows the hardware buttons to change volume.
- Downloads live in the browser's storage. Clearing site data in the browser removes them.
