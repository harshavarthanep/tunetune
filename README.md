# Tune Tune v1.1

**YouTube Music-style search · JioSaavn-quality sound · Apple Music-style design.**
A free music & podcast player for every device — no account, no ads of its own. Made by H24 Creationz.

## Upload to GitHub Pages
Upload everything in this folder to your repo (keep `.nojekyll` and the `icons` folder), then
**Settings → Pages → Deploy from branch → main / root**. Open the site and install it:
- **Android / Windows / Mac (Chrome or Edge):** menu → *Install app*.
- **iPhone / iPad (Safari):** Share → *Add to Home Screen*.

## Clean, ad-free audio for everyone (your free music server)
1. In the app: **Settings → Advanced → Your own music server** → *Copy server code*.
2. Paste it into a free Cloudflare Worker (dash.cloudflare.com → Workers & Pages → Create Worker → Edit code → Deploy).
3. Make it work for **every visitor**, even after they clear their browser — pick one:
   - open `app.js`, find `const BUILT_IN_SERVER = '';` near the top and put your address in the quotes, **or**
   - add a file named `tunetune-config.json` next to `index.html` containing
     `{ "musicServer": "https://tunetune.yourname.workers.dev" }`
     (see `tunetune-config.example.json`).

## Other things you can edit
At the top of `app.js`: `PRODUCTS_URL` and `GITHUB_URL` (shown in Settings → More from H24 Creationz).

## Good to know
- Songs keep playing in the background and with the screen locked while the app is open. Browsers stop audio when an app is swiped away — that's a phone rule for all web apps.
- Party Mode's torch works in Chrome on Android, is limited to 2 flashes a second and turns itself off after 5 minutes.
- Your library, downloads and the last 30 songs you played stay on the device; clearing the browser *cache* doesn't remove them (clearing *site data* does).
