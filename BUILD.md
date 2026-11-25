# Building the Tune Tune apps (free, on GitHub)

GitHub builds every app for you — nothing to install on your computer.

## 1. Add these files to your Tune Tune repo
Upload everything from the build kit, keeping the folders:
`package.json`, `capacitor.config.json`, `.gitignore`, `BUILD.md`,
`.github/workflows/build-apps.yml`, `desktop/`, `scripts/`, `build/`
(Folders starting with a dot: on github.com use **Add file → Upload files** and drag the whole `.github` folder.)

## 2. Run the build
Repo → **Actions** tab → **Build apps** → **Run workflow**. It takes about 15–25 minutes.
(Or create a tag like `v1.1.0` — the release is then named after it.)

## 3. Get the files
Repo → **Releases** → newest release. You'll find:

| Device | File |
|---|---|
| Android phones & tablets | `TuneTune-Android.apk` |
| Windows (Intel & AMD) | `TuneTune-Windows-Setup-x64.exe` (installer) · `TuneTune-Windows-Portable.exe` (no install) |
| Windows on ARM | `TuneTune-Windows-Setup-arm64.exe` |
| Mac (Apple silicon & Intel) | `TuneTune-Mac.dmg` · `TuneTune-Mac.zip` |
| Linux (Intel & AMD) | `TuneTune-Linux-x86_64.AppImage` · `TuneTune-Linux-amd64.deb` · `TuneTune-Linux-x64.tar.gz` |
| Linux on ARM | `TuneTune-Linux-arm64.AppImage` · `TuneTune-Linux-arm64.deb` |
| iPhone & iPad | website → Safari → Share → **Add to Home Screen** |

Permanent "latest" links for your product page:
`https://github.com/<you>/<repo>/releases/latest/download/TuneTune-Android.apk` (same pattern for every file).

## Good to know
- **Android:** first install asks to allow "Install unknown apps" once. Updates install over the old app (fixed signing key in `build/`).
- **Mac:** the app isn't signed with a paid Apple certificate, so the first time: right-click the app → **Open** → **Open**.
- **Windows:** SmartScreen may say "unrecognised app" for new apps → **More info → Run anyway**.
- **Your music server:** add `tunetune-config.json` (or set `BUILT_IN_SERVER` in `app.js`) *before* building. Apps still use free sources first and only use your server when **My server** is switched on.
- **Default music player:** Windows (installer), Mac and Linux (.deb) register for music files; Settings → Playback → *Make Tune Tune your music player* walks you through it. Android lists Tune Tune as a music app — open a song in Files → Tune Tune → *Always*.
- **Home-screen widget (Android):** long-press the home screen → Widgets → Tune Tune (Resume, Favorites, Offline, Party).
- **Windows taskbar:** hover the Tune Tune icon for previous / play-pause / next buttons.
- **Reminders:** Settings → Playback → *Remind me when I'm away* (off, 3, 7 or 14 days; at most two nudges).
- Every app uses the same `app.js` / `styles.css` as the website, so website updates and app updates stay identical — just run the build again.
