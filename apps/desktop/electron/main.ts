import { app, BrowserWindow, dialog, ipcMain, session } from "electron";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LiveParamName, PresetSlotId } from "@tonehub/cube-baby-protocol";
import { DeviceBridge, type LiveParamsSnapshot, type MatchVolumesSource } from "./deviceBridge.js";
import {
  exportDiagnosticsBundle,
  openExternalUrl,
  revealInFolder,
  type DiagnosticsExportInput,
} from "./diagnostics.js";
import { LibraryStore } from "./library/libraryStore.js";
import type { LibraryProfile } from "./library/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bridge = new DeviceBridge();
let library: LibraryStore;

function resolveAppIcon(): string | undefined {
  const candidates = [
    path.join(__dirname, "../build/icon.ico"),
    path.join(process.resourcesPath, "build/icon.ico"),
    path.join(process.resourcesPath, "icon.ico"),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function createWindow(): BrowserWindow {
  const icon = resolveAppIcon();
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#121416",
    title: "CubeControl",
    ...(icon ? { icon } : {}),
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
  return win;
}

function stamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

app.whenReady().then(async () => {
  library = new LibraryStore(app.getPath("userData"));
  await library.ensure();

  // Mic / audio input for the software tuner (renderer getUserMedia).
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "media" || permission === "mediaKeySystem");
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return permission === "media" || permission === "mediaKeySystem";
  });

  ipcMain.handle("tonehub:listPorts", async () => bridge.listPorts());
  ipcMain.handle("tonehub:connect", async () => bridge.connect());
  ipcMain.handle("tonehub:disconnect", async () => {
    await bridge.disconnect();
  });
  ipcMain.handle("tonehub:getBank", async () => bridge.getBank());
  ipcMain.handle("tonehub:writeLiveParam", async (_event, param: LiveParamName, value: number) => {
    await bridge.writeLiveParam(param, value);
  });
  ipcMain.handle("tonehub:selectCabinet", async (_event, cabinet: number) => {
    await bridge.selectCabinet(cabinet);
  });
  ipcMain.handle("tonehub:applySlotToLive", async (_event, slot: PresetSlotId) => {
    return bridge.applySlotToLive(slot);
  });
  ipcMain.handle("tonehub:applyLiveParams", async (_event, live: LiveParamsSnapshot) => {
    await bridge.applyLiveParams(live);
  });
  ipcMain.handle(
    "tonehub:saveSlot",
    async (_event, slot: PresetSlotId, live: LiveParamsSnapshot) => {
      return bridge.saveSlot(slot, live);
    },
  );
  ipcMain.handle(
    "tonehub:loadIrFromWav",
    async (
      _event,
      wav: Uint8Array,
      cabinet: number,
      options?: { confirmFactoryIrOverwrite?: boolean; distance?: number },
    ) => {
      const bytes = wav instanceof Uint8Array ? wav : Uint8Array.from(wav);
      const romSlot = cabinet - 1;
      try {
        const sector = await bridge.dumpIrRomSlot(romSlot);
        await library.saveIrBackup({
          cabinet,
          romSlot,
          sector,
          sourceName: "pre-load-ir",
        });
      } catch (error) {
        console.warn("safe IR backup failed", error);
      }
      return bridge.loadIrFromWav(bytes, cabinet, {
        confirmFactoryIrOverwrite: options?.confirmFactoryIrOverwrite === true,
        ...(options?.distance === undefined ? {} : { distance: options.distance }),
      });
    },
  );

  ipcMain.handle("tonehub:exportBank", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const document = await bridge.readBankFileDocument();
    const options = {
      title: "Exportar bank CubeControl",
      defaultPath: `cubecontrol-bank-${stamp()}.json`,
      filters: [{ name: "CubeControl Bank", extensions: ["json"] }],
    };
    const choice =
      win === null ? await dialog.showSaveDialog(options) : await dialog.showSaveDialog(win, options);
    if (choice.canceled || choice.filePath === undefined) return null;
    await writeFile(choice.filePath, document.json, "utf8");
    return { path: choice.filePath, dataHex: document.dataHex };
  });

  ipcMain.handle(
    "tonehub:matchVolumes",
    async (_event, source: MatchVolumesSource, liveSlot: PresetSlotId, liveVolume?: number) => {
      return bridge.matchVolumes(source, liveSlot, liveVolume);
    },
  );

  ipcMain.handle(
    "tonehub:copySlot",
    async (
      _event,
      from: PresetSlotId | "live",
      to: PresetSlotId,
      options?: { live?: LiveParamsSnapshot; liveSlot?: PresetSlotId },
    ) => {
      return bridge.copySlot(from, to, options);
    },
  );

  ipcMain.handle("tonehub:importBank", async (event, liveSlot: PresetSlotId) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: "Restaurar bank CubeControl",
      properties: ["openFile" as const],
      filters: [{ name: "CubeControl Bank", extensions: ["json"] }],
    };
    const choice =
      win === null ? await dialog.showOpenDialog(options) : await dialog.showOpenDialog(win, options);
    if (choice.canceled || choice.filePaths[0] === undefined) return null;
    const filePath = choice.filePaths[0];
    const jsonText = await readFile(filePath, "utf8");
    const restored = await bridge.restoreBankFromJson(jsonText, liveSlot);
    return { path: filePath, ...restored };
  });

  // —— Library ——
  ipcMain.handle("library:list", async () => library.list());
  ipcMain.handle("library:root", async () => library.root);
  ipcMain.handle(
    "library:savePreset",
    async (
      _event,
      input: {
        name: string;
        notes?: string;
        tags?: string[];
        profile?: LibraryProfile;
        params: LiveParamsSnapshot;
        id?: string;
      },
    ) => library.savePreset(input),
  );
  ipcMain.handle("library:deletePreset", async (_event, id: string) => {
    await library.deletePreset(id);
  });
  ipcMain.handle(
    "library:importIrWav",
    async (
      _event,
      input: {
        name: string;
        notes?: string;
        tags?: string[];
        profile?: LibraryProfile;
        wav: Uint8Array;
      },
    ) => {
      const wav = input.wav instanceof Uint8Array ? input.wav : Uint8Array.from(input.wav);
      return library.importIrWav({ ...input, wav });
    },
  );
  ipcMain.handle("library:deleteIr", async (_event, id: string) => {
    await library.deleteIr(id);
  });
  ipcMain.handle("library:readIrWav", async (_event, id: string) => library.readIrWav(id));
  ipcMain.handle(
    "library:loadIrToPedal",
    async (
      _event,
      irId: string,
      cabinet: number,
      options?: { confirmFactoryIrOverwrite?: boolean; distance?: number },
    ) => {
      const wav = await library.readIrWav(irId);
      const romSlot = cabinet - 1;
      try {
        const sector = await bridge.dumpIrRomSlot(romSlot);
        await library.saveIrBackup({
          cabinet,
          romSlot,
          sector,
          sourceName: `lib:${irId}`,
        });
      } catch (error) {
        console.warn("safe IR backup failed", error);
      }
      return bridge.loadIrFromWav(wav, cabinet, {
        confirmFactoryIrOverwrite: options?.confirmFactoryIrOverwrite === true,
        ...(options?.distance === undefined ? {} : { distance: options.distance }),
      });
    },
  );
  ipcMain.handle("library:restoreIrBackup", async (_event, backupId: string) => {
    const index = await library.list();
    const item = index.irBackups.find((b) => b.id === backupId);
    if (item === undefined) throw new Error("backup no encontrado");
    const sector = await library.readIrBackup(backupId);
    const verified = await bridge.persistIrRomSector(item.romSlot, sector);
    await bridge.selectCabinet(item.cabinet);
    return { verified, cabinet: item.cabinet, romSlot: item.romSlot };
  });
  ipcMain.handle("library:saveSong", async (_event, input) => library.saveSong(input));
  ipcMain.handle("library:deleteSong", async (_event, id: string) => {
    await library.deleteSong(id);
  });
  ipcMain.handle("library:saveShow", async (_event, input) => library.saveShow(input));
  ipcMain.handle("library:deleteShow", async (_event, id: string) => {
    await library.deleteShow(id);
  });
  ipcMain.handle("library:exportShowAsPack", async (_event, showId: string) =>
    library.exportShowAsPack(showId),
  );
  ipcMain.handle(
    "library:createPack",
    async (
      _event,
      input: {
        name: string;
        notes?: string;
        presetIds: string[];
        irIds: string[];
        includeBank: boolean;
      },
    ) => {
      let bankJson: string | undefined;
      if (input.includeBank && bridge.connected) {
        bankJson = (await bridge.readBankFileDocument()).json;
      }
      return library.createPack({
        name: input.name,
        presetIds: input.presetIds,
        irIds: input.irIds,
        ...(input.notes === undefined ? {} : { notes: input.notes }),
        ...(bankJson === undefined ? {} : { bankJson }),
      });
    },
  );
  ipcMain.handle("library:exportPack", async (event, packId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const index = await library.list();
    const pack = index.packs.find((p) => p.id === packId);
    if (pack === undefined) throw new Error("pack no encontrado");
    const options = {
      title: "Exportar pack CubeControl",
      defaultPath: `${pack.name.replace(/[^\w\-]+/g, "_")}-${stamp()}.zip`,
      filters: [{ name: "CubeControl Pack", extensions: ["zip"] }],
    };
    const choice =
      win === null ? await dialog.showSaveDialog(options) : await dialog.showSaveDialog(win, options);
    if (choice.canceled || choice.filePath === undefined) return null;
    await library.exportPackZip(packId, choice.filePath);
    return { path: choice.filePath };
  });
  ipcMain.handle("library:importPack", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: "Importar pack CubeControl",
      properties: ["openFile" as const],
      filters: [{ name: "CubeControl Pack", extensions: ["zip"] }],
    };
    const choice =
      win === null ? await dialog.showOpenDialog(options) : await dialog.showOpenDialog(win, options);
    if (choice.canceled || choice.filePaths[0] === undefined) return null;
    const bytes = new Uint8Array(await readFile(choice.filePaths[0]));
    const pack = await library.importPackZip(bytes);
    return { path: choice.filePaths[0], pack };
  });

  ipcMain.handle(
    "library:pushUndo",
    async (
      _event,
      snapshot: { label: string; params: LiveParamsSnapshot; activeSlot: PresetSlotId },
    ) => {
      library.pushUndo(snapshot);
      return library.undoState();
    },
  );
  ipcMain.handle(
    "library:undo",
    async (
      _event,
      current: { params: LiveParamsSnapshot; activeSlot: PresetSlotId; label?: string },
    ) => {
      const prev = library.popUndo(current);
      if (prev === null) return { snapshot: null, ...library.undoState() };
      await bridge.applyLiveParams(prev.params);
      return { snapshot: prev, ...library.undoState() };
    },
  );
  ipcMain.handle(
    "library:redo",
    async (
      _event,
      current: { params: LiveParamsSnapshot; activeSlot: PresetSlotId; label?: string },
    ) => {
      const next = library.popRedo(current);
      if (next === null) return { snapshot: null, ...library.undoState() };
      await bridge.applyLiveParams(next.params);
      return { snapshot: next, ...library.undoState() };
    },
  );
  ipcMain.handle("library:undoState", async () => library.undoState());
  ipcMain.handle("library:compareSlots", async () => {
    const bank = await bridge.getBank();
    return library.compareSlots(bank);
  });

  ipcMain.handle("diagnostics:exportBundle", async (event, input: DiagnosticsExportInput) =>
    exportDiagnosticsBundle(event, input),
  );
  ipcMain.handle("diagnostics:openExternal", async (_event, url: string) => {
    await openExternalUrl(url);
  });
  ipcMain.handle("diagnostics:revealInFolder", async (_event, filePath: string) => {
    revealInFolder(filePath);
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
