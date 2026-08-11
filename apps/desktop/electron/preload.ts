import { contextBridge, ipcRenderer } from "electron";
import type { LiveParamName, PresetSlotId } from "@tonehub/cube-baby-protocol";
import type {
  DesktopConnectionInfo,
  DesktopPortInfo,
  ExportBankResult,
  ImportBankResult,
  LiveParamsSnapshot,
  LoadIrResult,
  MatchVolumesResult,
  MatchVolumesSource,
  CopySlotResult,
  CopySlotSource,
  SaveSlotResult,
  BankSnapshot,
} from "./deviceBridge";
import type {
  IrBackupItem,
  IrLibraryItem,
  LibraryIndex,
  LibraryProfile,
  LiveSnapshot,
  PackLibraryItem,
  PresetLibraryItem,
  ShowLibraryItem,
  SlotDiffRow,
  SongLibraryItem,
} from "./library/types";

export type UndoState = {
  readonly undoCount: number;
  readonly redoCount: number;
};

export type UndoResult = UndoState & {
  readonly snapshot: LiveSnapshot | null;
};

export type ToneHubLibraryApi = {
  list: () => Promise<LibraryIndex>;
  root: () => Promise<string>;
  savePreset: (input: {
    name: string;
    notes?: string;
    tags?: string[];
    profile?: LibraryProfile;
    params: LiveParamsSnapshot;
    id?: string;
  }) => Promise<PresetLibraryItem>;
  deletePreset: (id: string) => Promise<void>;
  importIrWav: (input: {
    name: string;
    notes?: string;
    tags?: string[];
    profile?: LibraryProfile;
    wav: Uint8Array;
  }) => Promise<IrLibraryItem>;
  deleteIr: (id: string) => Promise<void>;
  readIrWav: (id: string) => Promise<Uint8Array>;
  loadIrToPedal: (
    irId: string,
    cabinet: number,
    options?: { confirmFactoryIrOverwrite?: boolean; distance?: number },
  ) => Promise<LoadIrResult>;
  restoreIrBackup: (
    backupId: string,
  ) => Promise<{ verified: boolean; cabinet: number; romSlot: number }>;
  saveSong: (input: {
    name: string;
    notes?: string;
    tags?: string[];
    presetId: string;
    irId?: string;
    irCabinet?: number;
    irDistance?: number;
    key?: string;
    bpm?: number;
    id?: string;
  }) => Promise<SongLibraryItem>;
  deleteSong: (id: string) => Promise<void>;
  saveShow: (input: {
    name: string;
    notes?: string;
    songIds: string[];
    id?: string;
  }) => Promise<ShowLibraryItem>;
  deleteShow: (id: string) => Promise<void>;
  exportShowAsPack: (showId: string) => Promise<PackLibraryItem>;
  createPack: (input: {
    name: string;
    notes?: string;
    presetIds: string[];
    irIds: string[];
    includeBank: boolean;
  }) => Promise<PackLibraryItem>;
  exportPack: (packId: string) => Promise<{ path: string } | null>;
  importPack: () => Promise<{ path: string; pack: PackLibraryItem } | null>;
  pushUndo: (snapshot: {
    label: string;
    params: LiveParamsSnapshot;
    activeSlot: PresetSlotId;
  }) => Promise<UndoState>;
  undo: (current: {
    params: LiveParamsSnapshot;
    activeSlot: PresetSlotId;
    label?: string;
  }) => Promise<UndoResult>;
  redo: (current: {
    params: LiveParamsSnapshot;
    activeSlot: PresetSlotId;
    label?: string;
  }) => Promise<UndoResult>;
  undoState: () => Promise<UndoState>;
  compareSlots: () => Promise<SlotDiffRow[]>;
};

export type ToneHubDesktopApi = {
  listPorts: () => Promise<DesktopPortInfo[]>;
  connect: () => Promise<DesktopConnectionInfo>;
  disconnect: () => Promise<void>;
  getBank: () => Promise<BankSnapshot>;
  writeLiveParam: (param: LiveParamName, value: number) => Promise<void>;
  selectCabinet: (cabinet: number) => Promise<void>;
  applySlotToLive: (slot: PresetSlotId) => Promise<LiveParamsSnapshot>;
  applyLiveParams: (live: LiveParamsSnapshot) => Promise<void>;
  saveSlot: (slot: PresetSlotId, live: LiveParamsSnapshot) => Promise<SaveSlotResult>;
  loadIrFromWav: (
    wav: Uint8Array,
    cabinet: number,
    options?: { confirmFactoryIrOverwrite?: boolean; distance?: number },
  ) => Promise<LoadIrResult>;
  exportBank: () => Promise<ExportBankResult | null>;
  importBank: (liveSlot: PresetSlotId) => Promise<ImportBankResult | null>;
  matchVolumes: (
    source: MatchVolumesSource,
    liveSlot: PresetSlotId,
    liveVolume?: number,
  ) => Promise<MatchVolumesResult>;
  copySlot: (
    from: CopySlotSource,
    to: PresetSlotId,
    options?: { live?: LiveParamsSnapshot; liveSlot?: PresetSlotId },
  ) => Promise<CopySlotResult>;
  library: ToneHubLibraryApi;
};

const library: ToneHubLibraryApi = {
  list: () => ipcRenderer.invoke("library:list"),
  root: () => ipcRenderer.invoke("library:root"),
  savePreset: (input) => ipcRenderer.invoke("library:savePreset", input),
  deletePreset: (id) => ipcRenderer.invoke("library:deletePreset", id),
  importIrWav: (input) => ipcRenderer.invoke("library:importIrWav", input),
  deleteIr: (id) => ipcRenderer.invoke("library:deleteIr", id),
  readIrWav: (id) => ipcRenderer.invoke("library:readIrWav", id),
  loadIrToPedal: (irId, cabinet, options) =>
    ipcRenderer.invoke("library:loadIrToPedal", irId, cabinet, options),
  restoreIrBackup: (backupId) => ipcRenderer.invoke("library:restoreIrBackup", backupId),
  saveSong: (input) => ipcRenderer.invoke("library:saveSong", input),
  deleteSong: (id) => ipcRenderer.invoke("library:deleteSong", id),
  saveShow: (input) => ipcRenderer.invoke("library:saveShow", input),
  deleteShow: (id) => ipcRenderer.invoke("library:deleteShow", id),
  exportShowAsPack: (showId) => ipcRenderer.invoke("library:exportShowAsPack", showId),
  createPack: (input) => ipcRenderer.invoke("library:createPack", input),
  exportPack: (packId) => ipcRenderer.invoke("library:exportPack", packId),
  importPack: () => ipcRenderer.invoke("library:importPack"),
  pushUndo: (snapshot) => ipcRenderer.invoke("library:pushUndo", snapshot),
  undo: (current) => ipcRenderer.invoke("library:undo", current),
  redo: (current) => ipcRenderer.invoke("library:redo", current),
  undoState: () => ipcRenderer.invoke("library:undoState"),
  compareSlots: () => ipcRenderer.invoke("library:compareSlots"),
};

const api: ToneHubDesktopApi = {
  listPorts: () => ipcRenderer.invoke("tonehub:listPorts"),
  connect: () => ipcRenderer.invoke("tonehub:connect"),
  disconnect: () => ipcRenderer.invoke("tonehub:disconnect"),
  getBank: () => ipcRenderer.invoke("tonehub:getBank"),
  writeLiveParam: (param, value) => ipcRenderer.invoke("tonehub:writeLiveParam", param, value),
  selectCabinet: (cabinet) => ipcRenderer.invoke("tonehub:selectCabinet", cabinet),
  applySlotToLive: (slot) => ipcRenderer.invoke("tonehub:applySlotToLive", slot),
  applyLiveParams: (live) => ipcRenderer.invoke("tonehub:applyLiveParams", live),
  saveSlot: (slot, live) => ipcRenderer.invoke("tonehub:saveSlot", slot, live),
  loadIrFromWav: (wav, cabinet, options) =>
    ipcRenderer.invoke("tonehub:loadIrFromWav", wav, cabinet, options),
  exportBank: () => ipcRenderer.invoke("tonehub:exportBank"),
  importBank: (liveSlot) => ipcRenderer.invoke("tonehub:importBank", liveSlot),
  matchVolumes: (source, liveSlot, liveVolume) =>
    ipcRenderer.invoke("tonehub:matchVolumes", source, liveSlot, liveVolume),
  copySlot: (from, to, options) => ipcRenderer.invoke("tonehub:copySlot", from, to, options),
  library,
};

contextBridge.exposeInMainWorld("tonehubDesktop", api);

export type { IrBackupItem, IrLibraryItem, LibraryIndex, PackLibraryItem, PresetLibraryItem, ShowLibraryItem, SlotDiffRow, SongLibraryItem };
