// Puente seguro entre la interfaz y el proceso principal (sin acceso directo a Node desde la página).
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const progress = new Map();
ipcRenderer.on('codice:progress', (_e, id, p) => progress.get(id)?.(p));

contextBridge.exposeInMainWorld('codiceDesktop', {
  db: async (id, op, args, onProgress) => {
    if (onProgress) progress.set(id, onProgress);
    try { return await ipcRenderer.invoke('codice:db', id, op, args); } finally { progress.delete(id); }
  },
  pathForFile: (file) => { try { return webUtils.getPathForFile(file); } catch { return ''; } },
  pickLibrary: () => ipcRenderer.invoke('codice:pickLibrary'),
  saveText: (name, text) => ipcRenderer.invoke('codice:saveText', name, text),
  openText: () => ipcRenderer.invoke('codice:openText'),
  info: () => ipcRenderer.invoke('codice:info'),
  onMenu: (fn) => { const h = (_e, cmd) => fn(cmd); ipcRenderer.on('codice:menu', h); return () => ipcRenderer.removeListener('codice:menu', h); },
});
