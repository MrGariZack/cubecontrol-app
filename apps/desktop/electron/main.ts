import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DeviceBridge } from "./deviceBridge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bridge = new DeviceBridge();

function createWindow(): void {
  const win = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: "#E8EEEA",
    title: "ToneHub",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  ipcMain.handle("tonehub:listPorts", async () => bridge.listPorts());
  ipcMain.handle("tonehub:connect", async () => bridge.connect());
  ipcMain.handle("tonehub:disconnect", async () => {
    await bridge.disconnect();
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  void bridge.dispose().finally(() => {
    if (process.platform !== "darwin") app.quit();
  });
});
