import { contextBridge, ipcRenderer } from "electron";

export type ToneHubDesktopApi = {
  listPorts: () => Promise<unknown>;
  connect: () => Promise<unknown>;
  disconnect: () => Promise<void>;
};

const api: ToneHubDesktopApi = {
  listPorts: () => ipcRenderer.invoke("tonehub:listPorts"),
  connect: () => ipcRenderer.invoke("tonehub:connect"),
  disconnect: () => ipcRenderer.invoke("tonehub:disconnect"),
};

contextBridge.exposeInMainWorld("tonehubDesktop", api);
