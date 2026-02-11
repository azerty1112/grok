const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('grokAPI', {
  run: (params) => ipcRenderer.invoke('grok:run', params),
  saveConfig: (conf) => ipcRenderer.invoke('grok:saveConfig', conf),
  getState: () => ipcRenderer.invoke('grok:getState'),
  openExternal: (url) => ipcRenderer.invoke('grok:openExternal', url)
});