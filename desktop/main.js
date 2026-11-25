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

/* ---- gentle reminder when you haven't listened for a while (while the app sits in the tray) ----
   At most two per absence: after N days, then after 2N+1 days. Using the app resets it. */
const STATE = () => path.join(app.getPath('userData'), 'tt-state.json');
const state = () => { try { return JSON.parse(fs.readFileSync(STATE(), 'utf8')); } catch (e) { return { lastUsed: Date.now(), days: 3, sent: 0 }; } };
const saveState = s2 => { try { fs.writeFileSync(STATE(), JSON.stringify(s2)); } catch (e) { } };
let usedAt = 0;
ipcMain.on('tt:used', () => { if (Date.now() - usedAt < 60e3) return; usedAt = Date.now(); const s2 = state(); s2.lastUsed = Date.now(); s2.sent = 0; saveState(s2); });
ipcMain.on('tt:remind', (e, d) => { const s2 = state(); s2.days = d === true ? 3 : d === false ? 0 : Math.max(0, +d || 0); saveState(s2); });
function checkReminder() {
  const s2 = state(), DAY = 864e5, days = s2.days == null ? (s2.remind === false ? 0 : 3) : +s2.days;
  if (!days || !Notification.isSupported() || (s2.sent || 0) >= 2) return;
  const away = Date.now() - (s2.lastUsed || Date.now()), due = (s2.sent || 0) === 0 ? days : days * 2 + 1;
  if (away < due * DAY) return;
  s2.sent = (s2.sent || 0) + 1; saveState(s2);
  const first = s2.sent === 1;
  const n = new Notification({ title: first ? 'Your music misses you 🎧' : 'Fresh music is waiting 🎶', body: first ? 'Pick up where you left off in Tune Tune' : 'New hits in your languages — one click to play', icon: path.join(ROOT, 'icons', 'icon-192.png') });
  n.on('click', () => { if (win) { win.show(); win.focus(); } });
  n.show();
}

/* ---- only while music plays: keep the computer from suspending playback and run at full speed ---- */
let blocker = null, isPlaying = false;
const thumb = n => nativeImage.createFromPath(path.join(__dirname, 'icons', n + '.png'));
const media = a => { if (win) win.webContents.send('tt:media', a); };
function setThumbar() {
  if (process.platform !== 'win32' || !win) return;
  try {
    win.setThumbarButtons([
      { tooltip: 'Previous', icon: thumb('prev'), click: () => media('prev') },
      { tooltip: isPlaying ? 'Pause' : 'Play', icon: thumb(isPlaying ? 'pause' : 'play'), click: () => media('toggle') },
      { tooltip: 'Next', icon: thumb('next'), click: () => media('next') },
    ]);
  } catch (e) { }
}
ipcMain.on('tt:playing', (e, on) => {
  on = !!on; if (on === isPlaying) return; isPlaying = on;
  if (on && blocker === null) blocker = powerSaveBlocker.start('prevent-app-suspension');
  if (!on && blocker !== null) { try { powerSaveBlocker.stop(blocker); } catch (x) { } blocker = null; }
  try { if (win) win.webContents.setBackgroundThrottling(!on); } catch (x) { }
  setThumbar(); if (tray) tray.setToolTip(on ? 'Tune Tune — playing' : 'Tune Tune');
});

/* ---- make Tune Tune the default player for music files ---- */
const AUDIO_MIME = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/flac', 'audio/x-flac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/opus', 'audio/webm', 'audio/x-aiff'];
ipcMain.handle('tt:default-app', async () => {
  if (process.platform === 'win32') { try { await shell.openExternal('ms-settings:defaultapps'); } catch (e) { } return 'win'; }
  if (process.platform === 'linux') {
    const { execFile } = require('child_process');
    const ok = await new Promise(res => execFile('xdg-mime', ['default', 'tunetune.desktop', ...AUDIO_MIME], err => res(!err)));
    return ok ? 'linux-ok' : 'linux-manual';
  }
  return 'mac';
});
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
      backgroundThrottling: true,   // switched off only while music plays (see tt:playing)
    },
  });
  win.loadFile(path.join(ROOT, 'index.html'));
  win.once('ready-to-show', setThumbar);
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
  const addr = home ? home.addresses()[0] : '';
  tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Show Tune Tune', click: () => { win.show(); win.focus(); } },
      { label: 'Play / Pause', click: () => media('toggle') },
      { label: 'Next', click: () => media('next') },
      { label: 'Previous', click: () => media('prev') },
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
  setTimeout(checkReminder, 60e3); setInterval(checkReminder, 3 * 3600e3); // a tiny file check every 3 hours
  if (process.platform === 'win32') app.setAppUserModelId('com.h24creationz.tunetune');
  app.on('activate', () => { if (win) win.show(); else createWindow(); });
});
app.on('before-quit', () => { quitting = true; if (home) home.stop(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
