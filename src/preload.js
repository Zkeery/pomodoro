const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pomodoro", {
  getStore: () => ipcRenderer.invoke("store:get"),
  setStore: (patch) => ipcRenderer.invoke("store:set", patch),
  setAlwaysOnTop: (flag) => ipcRenderer.invoke("window:set-always-on-top", flag),
  minimize: () => ipcRenderer.invoke("window:minimize"),
  close: () => ipcRenderer.invoke("window:close"),
  notify: (payload) => ipcRenderer.invoke("notify:session-end", payload),
});
