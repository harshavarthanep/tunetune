const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('ttDesktop', { platform: process.platform });
