import { CubeBabySession } from "@tonehub/cube-baby-api";
import {
  LIVE_PARAM_NAMES,
  PRESET_SLOT_BYTE_LENGTH,
  type CubeBabyPresetBank,
  type CubeBabyPresetSlot,
  type LiveParamName,
  type PresetSlotId,
} from "@tonehub/cube-baby-protocol";
import { classifyCubeBabyPort, type MidiPort } from "@tonehub/midi-core";
import { NodeMidiTransport } from "@tonehub/midi-transport-node";
import { bankFileFromBytes, bytesFromBankFile } from "./bankFile.js";

export type DesktopConnectionInfo = {
  readonly deviceName: string;
  readonly inputPortId: string;
  readonly outputPortId: string;
  readonly bankSummary: string;
  readonly activeSlot: PresetSlotId;
  readonly liveParams: LiveParamsSnapshot;
  readonly bank: BankSnapshot;
};

export type LiveParamsSnapshot = Record<LiveParamName, number>;

export type BankSlotSnapshot = {
  readonly slot: PresetSlotId;
} & LiveParamsSnapshot;

export type BankSnapshot = {
  readonly slots: readonly [BankSlotSnapshot, BankSlotSnapshot, BankSlotSnapshot];
};

export type DesktopPortInfo = {
  readonly id: string;
  readonly direction: "input" | "output";
  readonly name: string;
  readonly cubeBabyMatch: ReturnType<typeof classifyCubeBabyPort>;
  readonly vendorId: number | null;
  readonly productId: number | null;
};

export type SaveSlotResult = {
  readonly slot: PresetSlotId;
  readonly verified: boolean;
  readonly bank: BankSnapshot;
};

export type LoadIrResult = {
  readonly slotIndex: number;
  readonly cabinet: number;
  readonly persistVerified: boolean;
  readonly liveMatch: string;
};

export type ExportBankResult = {
  readonly path: string;
  readonly dataHex: string;
};

export type ImportBankResult = {
  readonly path: string;
  readonly verified: boolean;
  readonly activeSlot: PresetSlotId;
  readonly liveParams: LiveParamsSnapshot;
  readonly bank: BankSnapshot;
};

export type MatchVolumesSource = PresetSlotId | "live";

export type MatchVolumesResult = {
  readonly verified: boolean;
  readonly source: MatchVolumesSource;
  readonly volume: number;
  readonly volumes: { readonly a: number; readonly b: number; readonly c: number };
  readonly activeSlot: PresetSlotId;
  readonly liveParams: LiveParamsSnapshot;
  readonly bank: BankSnapshot;
};

const VOLUME_BYTE_OFFSET = LIVE_PARAM_NAMES.indexOf("volume");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slotToLiveParams(slot: CubeBabyPresetSlot): LiveParamsSnapshot {
  return {
    type: slot.type,
    gain: slot.gain,
    tone: slot.tone,
    reverb: slot.reverb,
    feedback: slot.feedback,
    volume: slot.volume,
    time: slot.time,
    mix: slot.mix,
    modulation: slot.modulation,
    cabinet: slot.cabinet,
    irSection: slot.irSection,
    delaySection: slot.delaySection,
    toneSection: slot.toneSection,
  };
}

/**
 * Main-process device session over the proven Node USB-MIDI transport.
 */
export class DeviceBridge {
  #transport: NodeMidiTransport | undefined;
  #session: CubeBabySession | undefined;
  #ports: { inputPortId: string; outputPortId: string } | undefined;

  async listPorts(): Promise<DesktopPortInfo[]> {
    const transport = await this.#ensureTransport();
    const ports = await transport.listPorts();
    return ports.map((port) => this.#toPortInfo(port));
  }

  async connect(): Promise<DesktopConnectionInfo> {
    await this.disconnect();
    const transport = await this.#ensureTransport();
    const ports = await transport.listPorts();
    const input = ports.find(
      (port) => port.direction === "input" && classifyCubeBabyPort(port) === "confirmed",
    );
    const output = ports.find(
      (port) => port.direction === "output" && classifyCubeBabyPort(port) === "confirmed",
    );
    if (input === undefined || output === undefined) {
      throw new Error(
        "No se encontró CUBE Baby USB (VID/PID confirmado). Cierra CubeSuite y reconecta el cable.",
      );
    }

    const session = await CubeBabySession.open(transport, {
      inputPortId: input.id,
      outputPortId: output.id,
    });
    try {
      const identity = await session.identify({ timeoutMs: 2_000 });
      this.#session = session;
      this.#ports = { inputPortId: input.id, outputPortId: output.id };

      const bankRaw = await session.readPresetBank({ timeoutMs: 2_000 });
      const liveParams = await this.#pushSlotToLive("A");
      const bank = this.#toBankSnapshot(bankRaw);
      const slotA = bank.slots[0];

      return {
        deviceName: identity.reportedName,
        inputPortId: input.id,
        outputPortId: output.id,
        bankSummary: `A gain ${slotA.gain} · cab ${slotA.cabinet}`,
        activeSlot: "A",
        liveParams,
        bank,
      };
    } catch (error) {
      this.#session = undefined;
      this.#ports = undefined;
      await session.close();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    const session = this.#session;
    this.#session = undefined;
    this.#ports = undefined;
    if (session !== undefined) await session.close();
  }

  async dispose(): Promise<void> {
    await this.disconnect();
    const transport = this.#transport;
    this.#transport = undefined;
    if (transport !== undefined) await transport.dispose();
  }

  async getBank(): Promise<BankSnapshot> {
    const session = this.#requireSession();
    const bank = await session.readPresetBank({ timeoutMs: 2_000 });
    return this.#toBankSnapshot(bank);
  }

  async writeLiveParam(param: LiveParamName, value: number): Promise<void> {
    if (!(LIVE_PARAM_NAMES as readonly string[]).includes(param)) {
      throw new Error(`unknown live param: ${param}`);
    }
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error("value must be an integer 0..255");
    }
    const session = this.#requireSession();
    if (param === "cabinet") {
      await session.selectCabinet({ cabinet: value, timeoutMs: 2_000, nudge: true });
      return;
    }
    await session.writeLiveParam({
      param,
      value,
      handshake: false,
      timeoutMs: 1_500,
    });
  }

  async selectCabinet(cabinet: number): Promise<void> {
    if (!Number.isInteger(cabinet) || cabinet < 0 || cabinet > 8) {
      throw new Error("cabinet must be 0..8");
    }
    const session = this.#requireSession();
    await session.selectCabinet({ cabinet, timeoutMs: 2_000, nudge: true });
  }

  async applySlotToLive(slot: PresetSlotId): Promise<LiveParamsSnapshot> {
    return this.#pushSlotToLive(slot);
  }

  /** Push an arbitrary live snapshot to the pedal (undo / library recall). */
  async applyLiveParams(live: LiveParamsSnapshot): Promise<void> {
    const session = this.#requireSession();
    for (const name of LIVE_PARAM_NAMES) {
      const value = live[name];
      if (!Number.isInteger(value) || value < 0 || value > 255) {
        throw new Error(`live.${name} must be an integer 0..255`);
      }
    }
    for (const name of LIVE_PARAM_NAMES) {
      if (name === "cabinet") continue;
      await session.writeLiveParam({
        param: name,
        value: live[name],
        handshake: false,
        timeoutMs: 1_500,
      });
      await sleep(35);
    }
    await session.selectCabinet({
      cabinet: live.cabinet,
      timeoutMs: 2_000,
      nudge: true,
    });
  }

  async dumpIrRomSlot(slotIndex: number): Promise<Uint8Array> {
    const session = this.#requireSession();
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 7) {
      throw new Error("slotIndex must be 0..7");
    }
    const dumped = await session.dumpIrRom({ slotIndex, timeoutMs: 5_000 });
    return dumped.data.slice();
  }

  async persistIrRomSector(slotIndex: number, sector: Uint8Array): Promise<boolean> {
    const session = this.#requireSession();
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 7) {
      throw new Error("slotIndex must be 0..7");
    }
    const result = await session.persistIrRom({
      payload: sector,
      slotIndex,
      padSector: true,
      timeoutMs: 8_000,
    });
    return result.verified;
  }

  /**
   * Persist current live params into one bank slot (keeps trailing bytes 13–15).
   * Uses restoreBank so the full A+B+C image is rewritten and verified.
   */
  async saveSlot(slotId: PresetSlotId, live: LiveParamsSnapshot): Promise<SaveSlotResult> {
    const session = this.#requireSession();
    const slotIndex = slotId === "A" ? 0 : slotId === "B" ? 1 : 2;
    for (const name of LIVE_PARAM_NAMES) {
      const value = live[name];
      if (!Number.isInteger(value) || value < 0 || value > 255) {
        throw new Error(`live.${name} must be an integer 0..255`);
      }
    }

    const bank = await session.readPresetBank({ timeoutMs: 2_000 });
    const written = bank.raw.slice();
    const start = slotIndex * PRESET_SLOT_BYTE_LENGTH;
    for (let offset = 0; offset < LIVE_PARAM_NAMES.length; offset += 1) {
      const name = LIVE_PARAM_NAMES[offset];
      if (name === undefined) continue;
      written[start + offset] = live[name];
    }

    const restore = await session.restoreBank({
      data: written,
      liveSlotIndex: slotIndex,
      timeoutMs: 5_000,
    });
    const nextBank = await session.readPresetBank({ timeoutMs: 2_000 });
    return {
      slot: slotId,
      verified: restore.verified,
      bank: this.#toBankSnapshot(nextBank),
    };
  }

  /**
   * Load WAV into one of 8 IR ROM slots.
   * `cabinet` is the pedal Cabinet value 1..8 (ROM index = cabinet - 1).
   */
  async loadIrFromWav(wav: Uint8Array, cabinet: number): Promise<LoadIrResult> {
    const session = this.#requireSession();
    if (wav.byteLength < 44) {
      throw new Error("WAV demasiado corto");
    }
    if (!Number.isInteger(cabinet) || cabinet < 1 || cabinet > 8) {
      throw new Error("cabinet IR target must be 1..8");
    }
    const slotIndex = cabinet - 1;
    const result = await session.loadIrFromWav({
      wav,
      slotIndex,
      cabinet,
      volume: 0.5,
      presence: cabinet === 8 ? "upload" : "factory",
      timeoutMs: 8_000,
    });
    return {
      slotIndex: result.slotIndex,
      cabinet: result.cabinet,
      persistVerified: result.persist.verified,
      liveMatch: `${result.liveMatchPrefix}/${result.liveMatchTotal}`,
    };
  }

  /** Read bank bytes + JSON document (tonehub-cube-baby-bank-v1). */
  async readBankFileDocument(): Promise<{ readonly json: string; readonly dataHex: string }> {
    const session = this.#requireSession();
    const bank = await session.readPresetBank({ timeoutMs: 2_000 });
    const document = bankFileFromBytes(bank.raw, Date.now());
    return {
      json: `${JSON.stringify(document, null, 2)}\n`,
      dataHex: document.dataHex,
    };
  }

  /**
   * Copy one volume value into bank slots A+B+C so footswitches stay level-matched.
   * Source `"live"` uses the provided live volume; otherwise reads that slot from the bank.
   */
  async matchVolumes(
    source: MatchVolumesSource,
    liveSlot: PresetSlotId,
    liveVolume?: number,
  ): Promise<MatchVolumesResult> {
    if (VOLUME_BYTE_OFFSET < 0) {
      throw new Error("offset de volume no disponible");
    }
    const session = this.#requireSession();
    const bank = await session.readPresetBank({ timeoutMs: 2_000 });
    let volume: number;
    if (source === "live") {
      if (liveVolume === undefined || !Number.isInteger(liveVolume) || liveVolume < 0 || liveVolume > 255) {
        throw new Error("volume live debe ser entero 0..255");
      }
      volume = liveVolume;
    } else {
      const slot = bank.slots.find((item) => item.slot === source);
      if (slot === undefined) throw new Error(`slot ${source} missing from bank`);
      volume = slot.volume;
    }

    const written = bank.raw.slice();
    for (let slotIndex = 0; slotIndex < 3; slotIndex += 1) {
      written[slotIndex * PRESET_SLOT_BYTE_LENGTH + VOLUME_BYTE_OFFSET] = volume;
    }
    const liveSlotIndex = liveSlot === "A" ? 0 : liveSlot === "B" ? 1 : 2;
    const restore = await session.restoreBank({
      data: written,
      liveSlotIndex,
      timeoutMs: 5_000,
    });
    const nextBank = await session.readPresetBank({ timeoutMs: 2_000 });
    const liveSlotData = nextBank.slots[liveSlotIndex];
    if (liveSlotData === undefined) {
      throw new Error("slot missing after matchVolumes");
    }
    const snapshot = this.#toBankSnapshot(nextBank);
    return {
      verified: restore.verified,
      source,
      volume,
      volumes: {
        a: snapshot.slots[0].volume,
        b: snapshot.slots[1].volume,
        c: snapshot.slots[2].volume,
      },
      activeSlot: liveSlot,
      liveParams: slotToLiveParams(liveSlotData),
      bank: snapshot,
    };
  }

  /** Restore full bank from tonehub-cube-baby-bank-v1 JSON and push liveSlot to live RAM. */
  async restoreBankFromJson(
    jsonText: string,
    liveSlot: PresetSlotId,
  ): Promise<{
    readonly verified: boolean;
    readonly activeSlot: PresetSlotId;
    readonly liveParams: LiveParamsSnapshot;
    readonly bank: BankSnapshot;
  }> {
    const session = this.#requireSession();
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText) as unknown;
    } catch {
      throw new Error("archivo bank no es JSON válido");
    }
    const data = bytesFromBankFile(parsed);
    const liveSlotIndex = liveSlot === "A" ? 0 : liveSlot === "B" ? 1 : 2;
    const restore = await session.restoreBank({
      data,
      liveSlotIndex,
      timeoutMs: 5_000,
    });
    const nextBank = await session.readPresetBank({ timeoutMs: 2_000 });
    const slot = nextBank.slots[liveSlotIndex];
    if (slot === undefined) {
      throw new Error("slot missing after restore");
    }
    return {
      verified: restore.verified,
      activeSlot: liveSlot,
      liveParams: slotToLiveParams(slot),
      bank: this.#toBankSnapshot(nextBank),
    };
  }

  get connected(): boolean {
    return this.#session !== undefined && this.#session.connected;
  }

  get ports(): { inputPortId: string; outputPortId: string } | undefined {
    return this.#ports;
  }

  async #pushSlotToLive(slotId: PresetSlotId): Promise<LiveParamsSnapshot> {
    const session = this.#requireSession();
    const bank = await session.readPresetBank({ timeoutMs: 2_000 });
    const slot = bank.slots.find((item) => item.slot === slotId);
    if (slot === undefined) {
      throw new Error(`slot ${slotId} missing from bank`);
    }
    const live = slotToLiveParams(slot);

    for (const name of LIVE_PARAM_NAMES) {
      if (name === "cabinet") continue;
      await session.writeLiveParam({
        param: name,
        value: live[name],
        handshake: false,
        timeoutMs: 1_500,
      });
      await sleep(35);
    }
    await session.selectCabinet({
      cabinet: live.cabinet,
      timeoutMs: 2_000,
      nudge: true,
    });
    return live;
  }

  #requireSession(): CubeBabySession {
    if (this.#session === undefined || !this.#session.connected) {
      throw new Error("CUBE Baby no conectado");
    }
    return this.#session;
  }

  async #ensureTransport(): Promise<NodeMidiTransport> {
    if (this.#transport === undefined) {
      this.#transport = new NodeMidiTransport();
    }
    return this.#transport;
  }

  #toBankSnapshot(bank: CubeBabyPresetBank): BankSnapshot {
    const slots = bank.slots.map((slot) => ({
      slot: slot.slot,
      ...slotToLiveParams(slot),
    })) as [BankSlotSnapshot, BankSlotSnapshot, BankSlotSnapshot];
    return { slots };
  }

  #toPortInfo(port: MidiPort): DesktopPortInfo {
    return {
      id: port.id,
      direction: port.direction,
      name: port.name,
      cubeBabyMatch: classifyCubeBabyPort(port),
      vendorId: port.vendorId ?? null,
      productId: port.productId ?? null,
    };
  }
}
