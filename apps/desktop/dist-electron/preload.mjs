"use strict";
const electron = require("electron");
const api = {
  listPorts: () => electron.ipcRenderer.invoke("tonehub:listPorts"),
  connect: () => electron.ipcRenderer.invoke("tonehub:connect"),
  disconnect: () => electron.ipcRenderer.invoke("tonehub:disconnect")
};
electron.contextBridge.exposeInMainWorld("tonehubDesktop", api);
