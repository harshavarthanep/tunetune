# Tune Tune 2.0

A free music player with the YouTube Music catalog, 40 language collections, live radio, synced lyrics, an equalizer and offline downloads. No account, no API keys, no ads.

## Why v1 showed a blank screen

v1 declared a variable called `top`, which every browser already reserves (`window.top`). Browsers refuse to run a script with that clash, so nothing loaded. v2 runs entirely inside its own private scope, so no browser name can ever collide with it again.

## Three ways to run it

| | How music is fetched | Best for |
|---|---|---|
| **Desktop app** (Windows / Mac / Linux) | Talks to YouTube Music directly from your own internet connection | Most reliable. Full YouTube Music home, albums, charts, moods & genres |
| **Android app** (APK) | Same direct engine as desktop | Phone use with the direct engine |
| **Website / PWA** (GitHub Pages) | Free public YouTube mirrors (Piped and Invidious), switched automatically | Any device, nothing to install |

Browsers block websites from calling YouTube directly, which is why the website version uses mirrors. The desktop and Android apps don't have that limit.

### Website (GitHub Pages)
1. Upload everything in this folder to a GitHub repo (for example `TuneTune`).
2. Settings → Pages → Deploy from branch → `main` / root.
3. Open `https://<username>.github.io/TuneTune/`. On Android Chrome: menu → *Install app*. On iPhone Safari: Share → *Add to Home Screen*.

### Desktop and Android apps (built free by GitHub)
1. Push this folder to GitHub (the `.github/workflows/build-apps.yml` file must be included).
2. Open the repo's **Actions** tab → **Build apps** → **Run workflow**.
3. After about 10 minutes, open the finished run and download from **Artifacts**:
   `TuneTune-Windows` (.exe installer), `TuneTune-macOS` (.dmg), `TuneTune-Linux` (.AppImage), `TuneTune-Android` (.apk).

To run the desktop app on your own PC instead: install Node.js, then in this folder run `npm install` and `npm start`.

**First launch notes:** Windows shows "Windows protected your PC" (click *More info → Run anyway*) and macOS needs right-click → *Open*, because the apps aren't code-signed. On Android, allow "Install unknown apps" for your browser or file manager.

## What keeps the music playing
- Every song has three stream sources (direct → Piped mirrors → Invidious). If one fails mid-song, the next takes over from the same second.
- A watchdog restarts a frozen stream after 15 seconds, and resumes automatically when the internet comes back.
- The next song's stream is fetched while the current one plays, so tracks change instantly even with the screen off.
- When your queue ends, Autoplay adds related songs (YouTube Music radio) 45 seconds before the end.
- Unavailable songs are skipped. If every source is down, it stops after 6 tries with a clear message instead of looping.
- Desktop app: closing the window keeps it playing in the system tray, and the OS isn't allowed to suspend it.
- Settings → Music sources → **Test music sources** shows exactly what's working.

## Features
- Home: quick picks based on what you play, top songs and playlists for your languages, worldwide chart (played in full), live radio, free indie music
- Explore: charts, 40 languages (each with top songs, new releases, romance, party, melodies, throwback, sad, devotional, artists), moods, genres; plus YouTube Music's own moods & genres in the apps
- Search: songs, albums, artists, playlists, radio, free music and your library, with suggestions as you type
- Player: synced lyrics, queue with drag to reorder, shuffle, repeat, Start Radio, 10-band EQ with 15 presets, sleep timer, speed, lock-screen/headphone controls
- Library: favorites, playlists (save any YouTube playlist to your library), downloads with "Download all", Save to Device as a music file, device music import, history, backup/restore
- Streaming quality: High, Normal or Data saver

## Good to know
- Public mirrors are run by volunteers and are sometimes busy; the website switches between them automatically. For a mirror you control, add a self-hosted Piped or Invidious address under Settings → Music sources → Custom mirror.
- This uses YouTube's unofficial interfaces, which goes against YouTube's terms. It's fine as a personal app, but Google can change things at any time; the app then falls back to mirrors, Audius and radio while you update it.
- The Android app plays in the background, but Android's lock-screen media controls come from Chrome. If you want those, also install the website version from Chrome.
- iPhone: use the website (Add to Home Screen). Apple doesn't allow installing apps outside the App Store without a paid developer account.

## Files
`index.html`, `styles.css`, `app.js` — the app · `sw.js`, `manifest.webmanifest` — offline + install · `icons/` · `desktop/` — desktop app shell · `capacitor.config.json` — Android app config · `package.json` — build setup · `.github/workflows/build-apps.yml` — free app builds
