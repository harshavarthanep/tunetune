/* Tune Tune desktop (Windows, macOS, Linux)
   Talks to YouTube Music directly, keeps playing in the tray, and stops the OS from suspending playback. */
const { app, BrowserWindow, session, Tray, Menu, nativeImage, powerSaveBlocker, shell, ipcMain, Notification } = require('electron');
const fs = require('fs');
const HomeServer = require('./server.js');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const UA = {
  ANDROID_VR: 'com.google.android.apps.youtube.vr.oculus/1.62.27 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
  IOS: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
  ANDROID: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip',
};
let win = null, tray = null, quitting = false, home = null;
const PREFS = () => path.join(app.getPath('userData'), 'home-server.json');
const prefs = () => { try { return JSON.parse(fs.readFileSync(PREFS(), 'utf8')); } catch (e) { return { enabled: false, port: 8686 }; } };
function setHome(on) {
  const p = prefs(); p.enabled = on; try { fs.writeFileSync(PREFS(), JSON.stringify(p)); } catch (e) { }
  if (on && !home) home = HomeServer.start({ root: ROOT, port: p.port || 8686, version: app.getVersion(), onError: () => { home = null; } });
  if (!on && home) { home.stop(); home = null; }
  buildTrayMenu();
}
ipcMain.handle('tt:server', () => ({ enabled: !!home, port: home ? home.port : (prefs().port || 8686), addresses: home ? home.addresses() : [] }));
ipcMain.handle('tt:server-set', (e, on) => { setHome(!!on); return { enabled: !!home, addresses: home ? home.addresses() : [] }; });

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
if (!app.requestSingleInstanceLock()) app.quit();

/* ---- music files opened with Tune Tune (double-click, "Open with", default app) ---- */
const AUDIO = /\.(mp3|m4a|aac|flac|wav|ogg|oga|opus|aiff?|alac|wma|webm)$/i;
let pending = [], rendererReady = false;
function queueFiles(list) {
  const files = (list || []).filter(f => f && AUDIO.test(f) && fs.existsSync(f));
  if (!files.length) return;
  pending.push(...files);
  if (win) { win.show(); win.focus(); }
  flushFiles();
}
function flushFiles() {
  if (!rendererReady || !win || !pending.length) return;
  const out = [];
  for (const f of pending.splice(0)) { try { out.push({ name: path.basename(f), data: fs.readFileSync(f) }); } catch (e) { } }
  if (out.length) win.webContents.send('tt:open-files', out);
}
ipcMain.on('tt:ready', () => { rendererReady = true; flushFiles(); });
app.on('open-file', (e, f) => { e.preventDefault(); queueFiles([f]); });                       // macOS
app.on('second-instance', (e, argv) => { if (win) { win.show(); win.focus(); } queueFiles(argv.slice(1)); });
queueFiles(process.argv.slice(1));                                                                // Windows / Linux first launch

/* ---- gentle reminder if the app hasn't been opened for 3 days (while it runs in the tray) ---- */
const STATE = () => path.join(app.getPath('userData'), 'tt-state.json');
const state = () => { try { return JSON.parse(fs.readFileSync(STATE(), 'utf8')); } catch (e) { return { lastUsed: Date.now(), remind: true }; } };
const saveState = s2 => { try { fs.writeFileSync(STATE(), JSON.stringify(s2)); } catch (e) { } };
ipcMain.on('tt:used', () => { const s2 = state(); s2.lastUsed = Date.now(); saveState(s2); });
ipcMain.on('tt:remind', (e, on) => { const s2 = state(); s2.remind = !!on; saveState(s2); });
function checkReminder() {
  const s2 = state(); const DAY = 864e5;
  if (s2.remind === false || !Notification.isSupported()) return;
  if (Date.now() - (s2.lastUsed || Date.now()) < 3 * DAY || Date.now() - (s2.lastNotified || 0) < 3 * DAY) return;
  s2.lastNotified = Date.now(); saveState(s2);
  const n = new Notification({ title: 'Your music misses you 🎧', body: 'Pick up where you left off in Tune Tune', icon: path.join(ROOT, 'icons', 'icon-192.png') });
  n.on('click', () => { if (win) { win.show(); win.focus(); } });
  n.show();
}
const startHidden = process.argv.includes('--hidden');

function headerKey(h, name) { return Object.keys(h).find(k => k.toLowerCase() === name.toLowerCase()); }

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 840, minWidth: 380, minHeight: 600,
    title: 'Tune Tune', backgroundColor: '#000000', autoHideMenuBar: true,
    icon: path.join(ROOT, 'icons', 'icon-512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      webSecurity: false,           // lets the bundled app call YouTube Music directly (no CORS)
      backgroundThrottling: false,  // keeps the player running while minimised
    },
  });
  win.loadFile(path.join(ROOT, 'index.html'));
  if (startHidden) win.once('ready-to-show', () => win.hide());
  win.webContents.on('did-start-loading', () => { rendererReady = false; });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });
  win.on('close', e => { if (!quitting && tray && process.platform !== 'darwin') { e.preventDefault(); win.hide(); } });
}

function createTray() {
  try {
    const img = nativeImage.createFromPath(path.join(ROOT, 'icons', 'icon-192.png')).resize({ width: 18, height: 18 });
    tray = new Tray(img);
    tray.setToolTip('Tune Tune');
    buildTrayMenu();
    tray.on('click', () => { if (win.isVisible()) win.hide(); else { win.show(); win.focus(); } });
  } catch (e) { tray = null; }
}
function buildTrayMenu() {
  if (!tray) return;
  const send = js => win && win.webContents.executeJavaScript(js).catch(() => {});
  const addr = home ? home.addresses()[0] : '';
  tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Show Tune Tune', click: () => { win.show(); win.focus(); } },
      { label: 'Play / Pause', click: () => send("document.querySelector('#m-pp')&&document.querySelector('#m-pp').click()") },
      { label: 'Next', click: () => send("document.querySelector('#mini [data-a=next]')&&document.querySelector('#mini [data-a=next]').click()") },
      { type: 'separator' },
      { label: 'Start with my computer (in the tray)', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: m => app.setLoginItemSettings({ openAtLogin: m.checked, openAsHidden: true, args: ['--hidden'] }) },
      { label: 'Share music to phones & tablets', type: 'checkbox', checked: !!home, click: m => setHome(m.checked) },
      ...(addr ? [{ label: `Open on your phone: ${addr}`, enabled: false }] : []),
      { type: 'separator' },
      { label: 'Quit', click: () => { quitting = true; app.quit(); } },
    ]));
}

app.whenReady().then(() => {
  const filter = { urls: ['*://*.youtube.com/*', '*://*.googlevideo.com/*', '*://youtubei.googleapis.com/*'] };
  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (d, cb) => {
    const h = d.requestHeaders; let u;
    try { u = new URL(d.url); } catch (e) { return cb({ requestHeaders: h }); }
    const isPlayerFrame = d.resourceType === 'subFrame' || /\/(embed|iframe_api|s\/player)\//.test(u.pathname) || u.pathname === '/iframe_api';
    if (u.hostname.endsWith('googlevideo.com')) {
      const c = u.searchParams.get('c');
      // only the app's own direct audio streams get the matching app identity; the official player's traffic is left alone
      if (UA[c]) { for (const n of ['Origin', 'Referer', 'User-Agent']) { const k = headerKey(h, n); if (k) delete h[k]; } h['User-Agent'] = UA[c]; }
    } else if (isPlayerFrame) {
      const k = headerKey(h, 'Referer'); if (!k || !/^https?:/.test(h[k])) h['Referer'] = 'https://www.youtube.com/';
    } else {
      for (const n of ['Origin', 'Referer']) { const k = headerKey(h, n); if (k) delete h[k]; }
      const ttua = headerKey(h, 'X-TT-UA');
      if (ttua) { const v = h[ttua]; delete h[ttua]; const k = headerKey(h, 'User-Agent'); if (k) delete h[k]; h['User-Agent'] = v; }
      const origin = u.hostname.startsWith('music.') ? 'https://music.youtube.com' : 'https://www.youtube.com';
      h['Origin'] = origin; h['Referer'] = origin + '/';
    }
    cb({ requestHeaders: h });
  });
  createWindow();
  createTray();
  if (prefs().enabled !== false) setHome(true);
  powerSaveBlocker.start('prevent-app-suspension');
  setTimeout(checkReminder, 60e3); setInterval(checkReminder, 3 * 3600e3);
  if (process.platform === 'win32') app.setAppUserModelId('com.h24creationz.tunetune');
  app.on('activate', () => { if (win) win.show(); else createWindow(); });
});
app.on('before-quit', () => { quitting = true; if (home) home.stop(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
