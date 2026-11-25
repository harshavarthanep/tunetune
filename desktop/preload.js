const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ttDesktop', {
  platform: process.platform,
  server: () => ipcRenderer.invoke('tt:server'),
  setServer: on => ipcRenderer.invoke('tt:server-set', on),
  // music files opened with Tune Tune (double-click, "Open with", default app)
  onOpenFiles: cb => { ipcRenderer.on('tt:open-files', (e, files) => cb(files)); ipcRenderer.send('tt:ready'); },
  used: () => ipcRenderer.send('tt:used'),
  setRemind: d => ipcRenderer.send('tt:remind', typeof d === 'number' ? d : !!d),
  playing: on => ipcRenderer.send('tt:playing', !!on),
  onMedia: cb => ipcRenderer.on('tt:media', (e, a) => cb(a)),
  defaultApp: () => ipcRenderer.invoke('tt:default-app'),
});
