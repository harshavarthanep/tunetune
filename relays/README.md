# Backup servers for Tune Tune (used only when every free source fails)

Tune Tune always tries the **free sources first** — the built-in ones plus the free lists in `tunetune-sources.json`.
Only when **all** of them fail does it use the servers listed under `"backupServers"`, one by one in the order you
list them. Your "My server" switch and the musicServer in `tunetune-config.json` work exactly as before (after these).

## A. Cloudflare Worker on another account (100,000 requests a day per account, fails safely)
Use an account that belongs to the person whose email it is (for example a family member who agrees to it).
1. Sign in at **dash.cloudflare.com** with that account.
2. **Workers & Pages → Create → Create Worker** → give it a name (for example `tunetune`) → **Deploy**.
3. **Edit code** → delete everything → paste all of `relays/cloudflare-worker.js` → **Deploy**.
4. Copy the address, like `https://tunetune.their-name.workers.dev`, and open it — it should say
   "Tune Tune relay is running".
5. In `tunetune-sources.json` → `"backupServers"`, replace `https://tunetune.XXXX.workers.dev` with it.

When a free Cloudflare account reaches 100,000 requests in a day, requests just fail until the next day — the app
then moves to the next backup server. Nothing else happens to the account.

## B. Google Apps Script (20,000 fetches a day per Google account; stops itself at 18,000)
1. Open **script.google.com** → **New project** → delete what's there → paste all of `relays/google-apps-script.gs` → save.
2. **Deploy → New deployment** → gear icon → **Web app** → *Execute as:* **Me** · *Who has access:* **Anyone**
   → **Deploy** → **Authorize access** → allow.
3. Copy the **Web app URL** (ends in `/exec`) and open it — you should see `"relay":"Tune Tune"`.
4. In `tunetune-sources.json` → `"backupServers"`, replace `https://script.google.com/macros/s/XXXX/exec`
   with it — keep `?url={url}` at the end.

## The caps
* `"dailyCap"` on each backup server = how many times **one device** may use it per day. When reached, the app
  skips it until tomorrow and uses the next one.
* The Google relay also stops itself at 18,000 a day for everyone, and tells the app — the app then leaves it
  alone for 6 hours.

## Check it
* **Settings → Advanced → Music sources** shows each backup server and "N of cap used today".
* **Settings → Test music sources** lists every free route (✓ / ✗) and checks each backup server.
