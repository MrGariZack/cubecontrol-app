import { app, ipcMain, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CubeBabySession } from "@tonehub/cube-baby-api";
import { classifyCubeBabyPort } from "@tonehub/midi-core";
import { NodeMidiTransport } from "@tonehub/midi-transport-node";
class DeviceBridge {
  #transport;
  #session;
  #ports;
  async listPorts() {
    const transport = await this.#ensureTransport();
    const ports = await transport.listPorts();
    return ports.map((port) => this.#toPortInfo(port));
  }
  async connect() {
    await this.disconnect();
    const transport = await this.#ensureTransport();
    const ports = await transport.listPorts();
    const input = ports.find(
      (port) => port.direction === "input" && classifyCubeBabyPort(port) === "confirmed"
    );
    const output = ports.find(
      (port) => port.direction === "output" && classifyCubeBabyPort(port) === "confirmed"
    );
    if (input === void 0 || output === void 0) {
      throw new Error(
        "No se encontró CUBE Baby USB (VID/PID confirmado). Cierra CubeSuite y reconecta el cable."
      );
    }
    const session = await CubeBabySession.open(transport, {
      inputPortId: input.id,
      outputPortId: output.id
    });
    try {
      const identity = await session.identify({ timeoutMs: 2e3 });
      const bank = await session.readPresetBank({ timeoutMs: 2e3 });
      const slotA = bank.slots[0];
      this.#session = session;
      this.#ports = { inputPortId: input.id, outputPortId: output.id };
      return {
        deviceName: identity.reportedName,
        inputPortId: input.id,
        outputPortId: output.id,
        bankSummary: `A gain ${slotA.gain} · cab ${slotA.cabinet}`
      };
    } catch (error) {
      await session.close();
      throw error;
    }
  }
  async disconnect() {
    const session = this.#session;
    this.#session = void 0;
    this.#ports = void 0;
    if (session !== void 0) await session.close();
  }
  async dispose() {
    await this.disconnect();
    const transport = this.#transport;
    this.#transport = void 0;
    if (transport !== void 0) await transport.dispose();
  }
  get connected() {
    return this.#session !== void 0 && this.#session.connected;
  }
  get ports() {
    return this.#ports;
  }
  async #ensureTransport() {
    if (this.#transport === void 0) {
      this.#transport = new NodeMidiTransport();
    }
    return this.#transport;
  }
  #toPortInfo(port) {
    return {
      id: port.id,
      direction: port.direction,
      name: port.name,
      cubeBabyMatch: classifyCubeBabyPort(port),
      vendorId: port.vendorId ?? null,
      productId: port.productId ?? null
    };
  }
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
const bridge = new DeviceBridge();
function createWindow() {
  const win = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: "#E8EEEA",
    title: "ToneHub",
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(path.join(__dirname$1, "../dist/index.html"));
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
