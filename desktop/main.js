/* Tune Tune desktop (Windows, macOS, Linux)
   Talks to YouTube Music directly, keeps playing in the tray, and stops the OS from suspending playback. */
const { app, BrowserWindow, session, Tray, Menu, nativeImage, powerSaveBlocker, shell } = require('electron');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const UA = {
  ANDROID_VR: 'com.google.android.apps.youtube.vr.oculus/1.62.27 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
  IOS: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
  ANDROID: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip',
};
let win = null, tray = null, quitting = false;

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });

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
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });
  win.on('close', e => { if (!quitting && tray && process.platform !== 'darwin') { e.preventDefault(); win.hide(); } });
}

function createTray() {
  try {
    const img = nativeImage.createFromPath(path.join(ROOT, 'icons', 'icon-192.png')).resize({ width: 18, height: 18 });
    tray = new Tray(img);
    tray.setToolTip('Tune Tune');
    const send = js => win && win.webContents.executeJavaScript(js).catch(() => {});
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Show Tune Tune', click: () => { win.show(); win.focus(); } },
      { label: 'Play / Pause', click: () => send("document.querySelector('#m-pp')&&document.querySelector('#m-pp').click()") },
      { label: 'Next', click: () => send("document.querySelector('#mini [data-a=next]')&&document.querySelector('#mini [data-a=next]').click()") },
      { type: 'separator' },
      { label: 'Quit', click: () => { quitting = true; app.quit(); } },
    ]));
    tray.on('click', () => { if (win.isVisible()) win.hide(); else { win.show(); win.focus(); } });
  } catch (e) { tray = null; }
}

app.whenReady().then(() => {
  const filter = { urls: ['*://*.youtube.com/*', '*://*.googlevideo.com/*', '*://youtubei.googleapis.com/*'] };
  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (d, cb) => {
    const h = d.requestHeaders; let u;
    try { u = new URL(d.url); } catch (e) { return cb({ requestHeaders: h }); }
    for (const n of ['Origin', 'Referer']) { const k = headerKey(h, n); if (k) delete h[k]; }
    if (u.hostname.endsWith('googlevideo.com')) {
      const c = u.searchParams.get('c');
      if (UA[c]) { const k = headerKey(h, 'User-Agent'); if (k) delete h[k]; h['User-Agent'] = UA[c]; }
    } else {
      const ttua = headerKey(h, 'X-TT-UA');
      if (ttua) { const v = h[ttua]; delete h[ttua]; const k = headerKey(h, 'User-Agent'); if (k) delete h[k]; h['User-Agent'] = v; }
      const origin = u.hostname.startsWith('music.') ? 'https://music.youtube.com' : 'https://www.youtube.com';
      h['Origin'] = origin; h['Referer'] = origin + '/';
    }
    cb({ requestHeaders: h });
  });
  createWindow();
  createTray();
  powerSaveBlocker.start('prevent-app-suspension');
  app.on('activate', () => { if (win) win.show(); else createWindow(); });
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
