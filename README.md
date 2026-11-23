# Tune Tune — Version 1

A free music and podcast player that runs entirely on GitHub Pages. No server, no computer left running, no account and no API keys.

## Put it online (fresh start)
1. In your GitHub repo, delete all the old files.
2. Upload **everything in this folder**, including the `icons` folder and the hidden `.nojekyll` file. On a Mac, press `Cmd+Shift+.` to see hidden files.
3. Repo → Settings → Pages → *Deploy from a branch* → `main` / `(root)` → Save.
4. After a minute, open `https://<your-username>.github.io/<repo>/`.

Install it as an app:
- **Android (Chrome):** menu ⋮ → *Install app*.
- **iPhone/iPad (Safari):** Share → *Add to Home Screen*.
- **Desktop (Chrome/Edge):** the install icon in the address bar.

Your favorites, playlists and history stay when you update. Old music-source settings are reset automatically to the ones that work.

## How songs play
- **JioSaavn** is the main source: Tamil, Hindi, Telugu, Malayalam, Kannada, Punjabi, English and more, including old classics. Audio is up to 320 kbps with real album art.
- The app uses **JioSaavn's own API**. Browsers can't call it directly, so it goes through free relay services, tries each one, and remembers the one that works. Community JioSaavn servers are an extra backup.
- Songs are ordinary audio files, so they **keep playing on the lock screen and in the background**, with notification and lock-screen controls.
- If a song exists only on YouTube, the app first looks for the same song on JioSaavn. It never plays a different song by mistake. If there's no clean version, it **asks you** whether to use YouTube's player (which can show ads), and never switches to it silently.
- Podcasts come from the Apple Podcasts directory, radio from Radio Browser, lyrics from LRCLIB, independent music from Audius, and you can add your own files.

## If songs won't play
Open **Settings → Advanced → Test music sources**. It shows which source and relay are working.
- If JioSaavn says "not responding", the free relays may be busy. Wait a few minutes and test again; the app keeps retrying the others.
- For guaranteed uptime, add your own relay in Settings → Advanced → **Custom relay**. One option is a free Cloudflare Worker CORS proxy, entered as `https://your-relay.workers.dev/?url={url}`.

## Good to know
- Locking the screen or switching apps keeps music playing. Swiping the app away from recent apps closes it, as with any website.
- The equalizer is off on iPhone/iPad, because Safari stops it when the screen locks.
- Settings → Advanced → Export/Import moves your library between devices.
