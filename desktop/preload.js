const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ttDesktop', {
  platform: process.platform,
  server: () => ipcRenderer.invoke('tt:server'),
  setServer: on => ipcRenderer.invoke('tt:server-set', on),
});
