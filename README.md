# Tune Tune 3.1

A free music and podcast player: the YouTube Music catalog in 40 languages, podcasts, live radio, synced lyrics, an equalizer, downloads, and your own stats. No account, no API keys.

## Which version should I use?

| | Android app | Desktop app | iPhone, iPad, Mac & any browser via **Home Server** | Website alone |
|---|---|---|---|---|
| Audio | Direct, audio only | Direct, audio only | Clean audio streamed by your computer | Mirrors, or YouTube's player |
| Ads | None | None | None | YouTube's player can show ads |
| Screen locked | Keeps playing | Keeps playing (tray) | Keeps playing | Can pause with YouTube's player |
| Equalizer & downloads | Yes | Yes | Yes (EQ not on iPhone) | Only with working mirrors |

Browsers can't fetch YouTube audio by themselves. The **Home Server** gives them a helper: the desktop app fetches the audio and streams it to your other devices, the way Plex and Jellyfin do. Podcasts, radio, lyrics and your own files work everywhere, with or without it.

### Use Tune Tune on iPhone, iPad and Mac (Home Server)
1. Install and open the desktop app on your Windows, Mac or Linux computer. The Home Server switches on automatically (tray icon → "Share music to phones & tablets").
2. In the desktop app, open Settings → Home Server. You'll see an address like `http://192.168.1.5:8686` and a QR code.
3. On your iPhone or iPad (same Wi-Fi), scan the QR code with the Camera, or type the address in Safari.
4. Tap Share → **Add to Home Screen**. It now opens like an app, plays clean audio, and keeps going with the screen locked.

Keep the computer on and the app open (it can sit minimized in the tray). Away from home, install the free [Tailscale](https://tailscale.com) app on both devices and use the computer's Tailscale address the same way.

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

## What's new in 3.1
- **Home Server:** iPhone, iPad, Mac and any browser get the same clean, ad-free, screen-off audio as the apps.
- **Smarter search:** an "All" tab with a Top result across songs, artists and podcasts. For example, "Raj Shamani" shows *Figuring Out With Raj Shamani* first, then its episodes. There are new Episodes and Podcasts tabs, voice search, and individual recent searches can be removed.
- **No waiting:** pages open instantly from cache and refresh in the background. The next song is preloaded into memory, so tracks change without gaps and a weak network doesn't cause buffering. Quality adapts automatically on slow or data-saver connections.
- **Crossfade** (up to 12 s, on two real audio decks), **AirPlay and Chromecast** buttons, **Driving Mode** with huge buttons, **Song Info**, **Copy song**, "Move to top" in playlists, "Artists you follow" on Home.
- **Remove single items** from Recently Played and Continue Listening.
- **Apple Music-style motion:** page push/pop transitions, staggered lists, fade-in artwork, a drifting Now Playing background, and a heart pop. All of it can be turned off.
- **Everything customizable:** display size, lyrics size, animations, quality badge, vibration, which sections appear on Home, which page the app opens on, podcast speed and skip lengths, pause history, hide explicit songs, auto-download favorites, clear cache. An **Advanced** page has playback engine, connections, error log and backups.
- **Clean text handling:** stray text no longer gets selected while tapping and scrolling. Search boxes, lyrics, episode notes and addresses can still be selected and copied.
- App icon shortcuts: long-press the installed icon to jump to Search, Podcasts or Library.

## What was new in 3.0
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
`index.html`, `styles.css`, `app.js` — the app · `sw.js`, `manifest.webmanifest` — offline + install · `icons/` · `desktop/` — desktop app and Home Server · `capacitor.config.json`, `scripts/android-setup.js`, `build/` — Android app (icons, splash, signing key, background playback) · `package.json` · `.github/workflows/build-apps.yml` — builds and publishes all apps
