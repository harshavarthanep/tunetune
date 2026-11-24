const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ttDesktop', {
  platform: process.platform,
  server: () => ipcRenderer.invoke('tt:server'),
  setServer: on => ipcRenderer.invoke('tt:server-set', on),
  // music files opened with Tune Tune (double-click, "Open with", default app)
  onOpenFiles: cb => { ipcRenderer.on('tt:open-files', (e, files) => cb(files)); ipcRenderer.send('tt:ready'); },
  used: () => ipcRenderer.send('tt:used'),
  setRemind: on => ipcRenderer.send('tt:remind', !!on),
});
