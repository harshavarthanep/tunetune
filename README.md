# Tune Tune 3.0

A free music and podcast player: the YouTube Music catalog in 40 languages, podcasts, live radio, synced lyrics, an equalizer, downloads, and your own stats. No account, no API keys.

## Which version should I use?

| | Android app | Desktop app (Win/Mac/Linux) | Website / PWA |
|---|---|---|---|
| Audio | Direct from YouTube Music, audio only | Direct from YouTube Music, audio only | Free mirrors when they work, otherwise YouTube's own player |
| Ads | None | None | YouTube's player can show ads |
| Screen locked / app in background | Keeps playing, lock-screen controls | Keeps playing (system tray) | Can stop when the YouTube player is used |
| Start time | About 1 second | About 1 second | Slower, depends on mirrors |
| Equalizer, downloads | Yes | Yes | Only with working mirrors |

**For PixelMusic-style listening, use the Android app.** Browsers don't allow websites to fetch YouTube audio directly, so no website can be fully ad-free and play with the screen off. That's why PixelMusic, InnerTune and ViMusic are all Android apps.

## Get the apps (free, built by GitHub)
1. Push this folder to your GitHub repo (keep the hidden `.github` folder).
2. Open the repo → **Actions** → **Build apps** → **Run workflow**. Wait about 15 minutes.
3. Open the repo's **Releases**. The newest one has `TuneTune.apk`, `TuneTune-Windows.exe`, `TuneTune-macOS.dmg` and `TuneTune-Linux.AppImage`.

Permanent links (always the newest build):
`https://github.com/<you>/<repo>/releases/latest/download/TuneTune.apk`

The website finds this link by itself when hosted on GitHub Pages. It shows a "Get the Android app" card on Android phones and in Settings → Apps.

**Installing on Android:** open TuneTune.apk and allow "Install unknown apps" once. Future builds install as updates over the old one, so your library stays.
**Keep it playing:** if your phone is aggressive about battery (Xiaomi, Oppo, Vivo, Samsung), set Tune Tune's battery usage to "Unrestricted".

## Website (GitHub Pages)
Upload everything to the repo → Settings → Pages → Deploy from branch → `main` / root.

## What's new in 3.0
- **Podcasts tab:** top shows for your country, 20 categories (including Tamil, Hindi, Malayalam, Telugu), search, show pages, follow, "New episodes", "Continue listening" with exact resume, ±15/30 s skip, episode notes, mark played, downloads.
- **Android app made PixelMusic-grade:** direct audio, no video or ads, a background media service so music continues with the screen off, and notification and lock-screen controls.
- **Premium audio:** always the highest-quality stream (OPUS ~160 kbps from YouTube), loudness normalization so songs play at an even volume, and a quality badge in Now Playing. Your own FLAC/WAV files play lossless, with a gold "Lossless" badge.
- **Made for you:** Daily Mixes from your most-played artists, and **Your Replay** (minutes per day, weekly chart, streak, top songs and artists, all kept on your device).
- **Everyday features:** follow artists, import a YouTube or YouTube Music playlist from a link, save your queue as a playlist, "Don't recommend this", swipe the mini player to skip, and haptic feedback.
- Faster browser playback: shorter mirror timeouts, and YouTube's player is preloaded in the background.

A note on audio quality: YouTube's best audio is about 160 kbps Opus, which sounds the same as a CD for most listeners. True hi-res lossless only exists in your own files (FLAC/WAV), and Tune Tune plays those at full quality.

## All features
Home (quick picks, daily mixes, language shelves, global chart, radio, podcasts) · Explore (charts, 40 languages, moods, genres, live radio) · Search (songs, albums, artists, playlists, podcasts, radio, free music, library, suggestions, top result) · Now Playing (synced lyrics, queue with drag to reorder, shuffle/repeat, autoplay radio, 10-band EQ with 15 presets, sleep timer, speed) · Library (favorites, playlists, downloads with Save to Device, device music import, podcasts, artists, stations, history, Replay, backup/restore) · light/dark themes · 9 accent colours · keyboard shortcuts · works offline for downloads.

## Good to know
- This uses YouTube's unofficial interfaces, which goes against YouTube's terms. It's fine as a personal app, but Google changes things sometimes. Settings → Music sources → Test music sources shows what's working.
- iPhone: use the website (Add to Home Screen). Installing apps on iPhone outside the App Store needs a Mac and a paid Apple developer account.
- Spotify playlists can't be imported: Spotify requires each user to log in to a developer account for that.

## Files
`index.html`, `styles.css`, `app.js` — the app · `sw.js`, `manifest.webmanifest` — offline + install · `icons/` · `desktop/` — desktop app · `capacitor.config.json`, `scripts/android-setup.js`, `build/` — Android app (icons, splash, signing key, background playback) · `package.json` · `.github/workflows/build-apps.yml` — builds and publishes all apps
