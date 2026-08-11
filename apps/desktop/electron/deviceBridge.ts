import { CubeBabySession } from "@tonehub/cube-baby-api";
import {
  clampLiveParamValue,
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
import { midiLog, midiWarn } from "./midiLog.js";

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

export type CopySlotSource = PresetSlotId | "live";

export type CopySlotResult = {
  readonly verified: boolean;
  readonly from: CopySlotSource;
  readonly to: PresetSlotId;
  readonly activeSlot: PresetSlotId;
  readonly liveParams: LiveParamsSnapshot;
  readonly bank: BankSnapshot;
};

const VOLUME_BYTE_OFFSET = LIVE_PARAM_NAMES.indexOf("volume");
/** Gap between multi-byte live pushes (undo / explicit recall). */
const LIVE_WRITE_GAP_MS = 45;
/** Short ACK wait — long timeouts stall the whole MIDI gate after a dropped SysEx. */
/** Includes identity prelude (~80ms) used on live writes (CLI exp. 024). */
const LIVE_ACK_TIMEOUT_MS = 1_500;
/** Section toggles first so audio cuts before knobs drain. */
const LIVE_DRAIN_PRIORITY: readonly LiveParamName[] = [
  "irSection",
  "delaySection",
  "toneSection",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMidiTransportFault(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /rtmidi|MidiOutWinMM|WinMM|sysex|MIDI WinMM/i.test(message);
}

function slotIndexOf(slotId: PresetSlotId): number {
  return slotId === "A" ? 0 : slotId === "B" ? 1 : 2;
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
  /** Extra serialization for desktop IPC (knob debounce + slot recall + bank reads). */
  #midiGate: Promise<unknown> = Promise.resolve();
  /** Last bank snapshot (CubeSuite-style local A/B/C cache). */
  #bankCache: BankSnapshot | undefined;
  /** Coalesce rapid A/B/C applies — only the latest desired slot is pushed. */
  #desiredLiveSlot: PresetSlotId | undefined;
  #lastPushedSlot: PresetSlotId | undefined;
  /**
   * Bumped synchronously on every user live edit so an in-flight bank→live push
   * aborts instead of overwriting section toggles / knobs.
   */
  #liveEpoch = 0;
  /** Latest-wins coalescing — rapid knobs must not enqueue historical values. */
  #pendingLive = new Map<LiveParamName, number>();
  /** Last value successfully written per param (skip no-op spam). */
  #lastLiveWritten = new Map<LiveParamName, number>();

  async #serialMidi<T>(op: () => Promise<T>): Promise<T> {
    const run = this.#midiGate.then(op, op);
    this.#midiGate = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async #failMidiSession(error: unknown): Promise<never> {
    midiWarn("session-fault", {
      error: error instanceof Error ? error.message : String(error),
    });
    try {
      await this.disconnect();
    } catch {
      // ignore cleanup errors
    }
    throw new Error(
      "Puerto MIDI bloqueado (WinMM). Cierra CubeSuite, desconecta/reconecta el cable y vuelve a Conectar.",
      { cause: error instanceof Error ? error : undefined },
    );
  }

  #pickPendingLiveParam(): LiveParamName | undefined {
    for (const name of LIVE_DRAIN_PRIORITY) {
      if (this.#pendingLive.has(name)) return name;
    }
    const first = this.#pendingLive.keys().next();
    return first.done ? undefined : first.value;
  }

  #slotIndex(slot?: PresetSlotId): number {
    const id = slot ?? this.#desiredLiveSlot ?? "A";
    return id === "A" ? 0 : id === "B" ? 1 : 2;
  }

  async #writeLiveRaw(
    session: CubeBabySession,
    param: LiveParamName,
    value: number,
  ): Promise<void> {
    const t0 = Date.now();
    const slotIndex = this.#slotIndex();
    try {
      if (param === "cabinet") {
        await session.selectCabinet({
          cabinet: value,
          slotIndex,
          timeoutMs: LIVE_ACK_TIMEOUT_MS,
          nudge: false,
        });
      } else {
        // Match CLI experiment 024: identity prelude helps WinMM/live DSP apply.
        // Do NOT nudge sections (1↔0): if the device only latches the first byte,
        // an "off" nudge would force delay ON and leave it stuck.
        await session.writeLiveParam({
          param,
          value,
          slotIndex,
          handshake: true,
          timeoutMs: LIVE_ACK_TIMEOUT_MS,
        });
      }
      this.#lastLiveWritten.set(param, value);
      midiLog("live-write-ok", {
        param,
        value,
        slotIndex,
        ms: Date.now() - t0,
        handshake: true,
      });
    } catch (error) {
      midiWarn("live-write-fail", {
        param,
        value,
        slotIndex,
        ms: Date.now() - t0,
        error: error instanceof Error ? error.message : String(error),
      });
      if (isMidiTransportFault(error)) {
        await this.#failMidiSession(error);
      }
      throw error;
    }
  }

  async #drainPendingLive(): Promise<void> {
    const session = this.#requireSession();
    while (this.#pendingLive.size > 0) {
      const param = this.#pickPendingLiveParam();
      if (param === undefined) return;
      const value = this.#pendingLive.get(param);
      this.#pendingLive.delete(param);
      if (value === undefined) continue;
      const isSection =
        param === "delaySection" || param === "irSection" || param === "toneSection";
      // Never skip section toggles — DSP may be out of sync with last ACK'd value.
      // Never skip modulation either: Mix→0 parks mod=0, and "knob full left" must
      // reach the pedal even if lastLiveWritten already says 0 (slot seed / desync).
      if (!isSection && param !== "modulation" && this.#lastLiveWritten.get(param) === value) {
        midiLog("live-write-skip-dup", { param, value });
        continue;
      }
      await this.#writeLiveRaw(session, param, value);
    }
  }

  #slotParamsFromCache(slotId: PresetSlotId): LiveParamsSnapshot | undefined {
    const slot = this.#bankCache?.slots.find((item) => item.slot === slotId);
    if (slot === undefined) return undefined;
    const { slot: _slot, ...params } = slot;
    const clamped = {} as LiveParamsSnapshot;
    for (const name of LIVE_PARAM_NAMES) {
      clamped[name] = clampLiveParamValue(name, params[name]);
    }
    return clamped;
  }

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
      const bank = this.#toBankSnapshot(bankRaw);
      this.#bankCache = bank;
      this.#desiredLiveSlot = "A";
      const slotA = bank.slots[0];
      // Soft recall A so UI and audible live match after connect (paced, single burst).
      this.#desiredLiveSlot = "A";
      const liveParams = await this.#pushSlotToLive("A", this.#liveEpoch);
      this.#lastPushedSlot = "A";
      midiLog("connect-ok", {
        device: identity.reportedName,
        gain: liveParams.gain,
        modulation: liveParams.modulation,
      });

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
    this.#bankCache = undefined;
    this.#desiredLiveSlot = undefined;
    this.#lastPushedSlot = undefined;
    this.#liveEpoch = 0;
    this.#pendingLive.clear();
    this.#lastLiveWritten.clear();
    if (session !== undefined) await session.close();
  }

  async dispose(): Promise<void> {
    await this.disconnect();
    const transport = this.#transport;
    this.#transport = undefined;
    if (transport !== undefined) await transport.dispose();
  }

  async getBank(): Promise<BankSnapshot> {
    return this.#serialMidi(async () => {
      const session = this.#requireSession();
      const bank = await this.#toBankSnapshot(await session.readPresetBank({ timeoutMs: 2_000 }));
      this.#bankCache = bank;
      return bank;
    });
  }

  async writeLiveParam(param: LiveParamName, value: number): Promise<void> {
    if (!(LIVE_PARAM_NAMES as readonly string[]).includes(param)) {
      throw new Error(`unknown live param: ${param}`);
    }
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error("value must be an integer 0..255");
    }
    // CubeSuite ceilings (e.g. modulation 0–15). Wider values do nothing useful on device.
    const clamped = clampLiveParamValue(param, value);
    // Invalidate any bank→live push (undo) so it cannot overwrite this edit.
    this.#liveEpoch += 1;
    this.#lastPushedSlot = undefined;
    // Latest value wins — collapsing rapid knobs prevents WinMM queue death.
    this.#pendingLive.set(param, clamped);
    midiLog("live-queue", {
      param,
      value: clamped,
      raw: value,
      pending: this.#pendingLive.size,
      epoch: this.#liveEpoch,
    });
    return this.#serialMidi(async () => {
      await this.#drainPendingLive();
    });
  }

  async selectCabinet(cabinet: number): Promise<void> {
    if (!Number.isInteger(cabinet) || cabinet < 0 || cabinet > 8) {
      throw new Error("cabinet must be 0..8");
    }
    this.#liveEpoch += 1;
    this.#lastPushedSlot = undefined;
    this.#pendingLive.set("cabinet", cabinet);
    return this.#serialMidi(async () => {
      await this.#drainPendingLive();
    });
  }

  /**
   * Push one bank slot into live RAM. Rapid A/B/C clicks coalesce to the latest slot.
   */
  async applySlotToLive(slot: PresetSlotId): Promise<LiveParamsSnapshot> {
    this.#desiredLiveSlot = slot;
    this.#pendingLive.clear();
    this.#lastLiveWritten.clear();
    midiLog("slot-apply-request", { slot, epoch: this.#liveEpoch });
    return this.#serialMidi(async () => {
      let live: LiveParamsSnapshot | undefined;
      // Drain until the desired slot is stable (A→B→C only pushes C).
      for (;;) {
        const target = this.#desiredLiveSlot ?? slot;
        const epoch = this.#liveEpoch;
        midiLog("slot-apply-push", { target, epoch });
        live = await this.#pushSlotToLive(target, epoch);
        if (this.#liveEpoch !== epoch) {
          midiLog("slot-apply-aborted-by-edit", { target, epoch, now: this.#liveEpoch });
          break;
        }
        if (this.#desiredLiveSlot === target) {
          this.#lastPushedSlot = target;
          // Seed last-written so the next section toggle is not skipped as a dup,
          // and so wet-bypass writes still go out after a slot recall.
          for (const name of LIVE_PARAM_NAMES) {
            this.#lastLiveWritten.set(name, live[name]);
          }
          midiLog("slot-apply-done", {
            target,
            delaySection: live.delaySection,
            mix: live.mix,
            modulation: live.modulation,
          });
          break;
        }
        midiLog("slot-apply-coalesce", { from: target, to: this.#desiredLiveSlot });
      }
      if (live === undefined) {
        throw new Error(`slot ${slot} apply produced no live snapshot`);
      }
      return live;
    });
  }

  /** Push an arbitrary live snapshot to the pedal (undo / library recall). */
  async applyLiveParams(live: LiveParamsSnapshot): Promise<void> {
    for (const name of LIVE_PARAM_NAMES) {
      const value = live[name];
      if (!Number.isInteger(value) || value < 0 || value > 255) {
        throw new Error(`live.${name} must be an integer 0..255`);
      }
    }
    this.#liveEpoch += 1;
    this.#lastPushedSlot = undefined;
    this.#pendingLive.clear();
    const epoch = this.#liveEpoch;
    return this.#serialMidi(async () => {
      const session = this.#requireSession();
      const slotIndex = this.#slotIndex();
      try {
        for (const name of LIVE_PARAM_NAMES) {
          if (name === "cabinet") continue;
          if (this.#liveEpoch !== epoch) return;
          await session.writeLiveParam({
            param: name,
            value: live[name],
            slotIndex,
            handshake: false,
            timeoutMs: LIVE_ACK_TIMEOUT_MS,
          });
          await sleep(LIVE_WRITE_GAP_MS);
        }
        if (this.#liveEpoch !== epoch) return;
        await session.selectCabinet({
          cabinet: live.cabinet,
          slotIndex,
          timeoutMs: LIVE_ACK_TIMEOUT_MS,
          nudge: false,
        });
      } catch (error) {
        if (isMidiTransportFault(error)) {
          await this.#failMidiSession(error);
        }
        throw error;
      }
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
    const slotIndex = slotIndexOf(slotId);
    for (const name of LIVE_PARAM_NAMES) {
      const value = live[name];
      if (!Number.isInteger(value) || value < 0 || value > 255) {
        throw new Error(`live.${name} must be an integer 0..255`);
      }
    }

    return this.#serialMidi(async () => {
      const session = this.#requireSession();
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
      const nextBank = this.#toBankSnapshot(await session.readPresetBank({ timeoutMs: 2_000 }));
      this.#bankCache = nextBank;
      this.#lastPushedSlot = slotId;
      this.#desiredLiveSlot = slotId;
      // Trust slot field match even if full 48-byte image differs on trailing pad.
      const saved = nextBank.slots[slotIndex];
      const fieldsOk =
        saved !== undefined &&
        LIVE_PARAM_NAMES.every((name) => saved[name] === live[name]);
      if (!restore.verified || !fieldsOk) {
        midiWarn("save-slot-verify", {
          slot: slotId,
          bankVerified: restore.verified,
          fieldsOk,
        });
      }
      return {
        slot: slotId,
        verified: fieldsOk,
        bank: nextBank,
      };
    });
  }

  /**
   * Clone a full preset into another footswitch slot, then load the destination to live.
   * `from: "live"` uses current live params (bytes 0–12) + trailing from `liveSlot` in the bank.
   * `from: A|B|C` copies all 16 bank bytes of that slot.
   */
  async copySlot(
    from: CopySlotSource,
    to: PresetSlotId,
    options?: {
      readonly live?: LiveParamsSnapshot;
      readonly liveSlot?: PresetSlotId;
    },
  ): Promise<CopySlotResult> {
    if (from !== "live" && from === to) {
      throw new Error("origen y destino deben ser slots distintos");
    }
    if (from === "live") {
      const live = options?.live;
      if (live === undefined) {
        throw new Error("copySlot from live requiere live params");
      }
      for (const name of LIVE_PARAM_NAMES) {
        const value = live[name];
        if (!Number.isInteger(value) || value < 0 || value > 255) {
          throw new Error(`live.${name} must be an integer 0..255`);
        }
      }
    }

    return this.#serialMidi(async () => {
      const session = this.#requireSession();
      const bank = await session.readPresetBank({ timeoutMs: 2_000 });
      const destIndex = slotIndexOf(to);
      const destStart = destIndex * PRESET_SLOT_BYTE_LENGTH;
      const written = bank.raw.slice();
      const destSlice = written.subarray(destStart, destStart + PRESET_SLOT_BYTE_LENGTH);

      if (from === "live") {
        const live = options?.live;
        if (live === undefined) {
          throw new Error("copySlot from live requiere live params");
        }
        const trailingSlotId = options?.liveSlot ?? to;
        const trailingIndex = slotIndexOf(trailingSlotId);
        const trailingStart = trailingIndex * PRESET_SLOT_BYTE_LENGTH;
        for (let offset = 0; offset < LIVE_PARAM_NAMES.length; offset += 1) {
          const name = LIVE_PARAM_NAMES[offset];
          if (name === undefined) continue;
          destSlice[offset] = live[name];
        }
        for (let offset = LIVE_PARAM_NAMES.length; offset < PRESET_SLOT_BYTE_LENGTH; offset += 1) {
          destSlice[offset] = bank.raw[trailingStart + offset] ?? 0;
        }
      } else {
        const sourceIndex = slotIndexOf(from);
        const sourceStart = sourceIndex * PRESET_SLOT_BYTE_LENGTH;
        destSlice.set(bank.raw.subarray(sourceStart, sourceStart + PRESET_SLOT_BYTE_LENGTH));
      }

      const restore = await session.restoreBank({
        data: written,
        liveSlotIndex: destIndex,
        timeoutMs: 5_000,
      });
      const nextBank = this.#toBankSnapshot(await session.readPresetBank({ timeoutMs: 2_000 }));
      this.#bankCache = nextBank;
      this.#lastPushedSlot = to;
      this.#desiredLiveSlot = to;
      const liveSlotData = nextBank.slots[destIndex];
      if (liveSlotData === undefined) {
        throw new Error("slot missing after copySlot");
      }
      const { slot: _slotId, ...liveParams } = liveSlotData;
      return {
        verified: restore.verified,
        from,
        to,
        activeSlot: to,
        liveParams,
        bank: nextBank,
      };
    });
  }

  /**
   * Load WAV into one of 8 IR ROM slots.
   * `cabinet` is the pedal Cabinet value 1..8 (ROM index = cabinet - 1).
   */
  async loadIrFromWav(
    wav: Uint8Array,
    cabinet: number,
    options?: {
      readonly confirmFactoryIrOverwrite?: boolean;
      /** CubeSuite Distance — float 0..1 (ROM volume + live 0x768 header). */
      readonly distance?: number;
    },
  ): Promise<LoadIrResult> {
    const session = this.#requireSession();
    if (wav.byteLength < 44) {
      throw new Error("WAV demasiado corto");
    }
    if (!Number.isInteger(cabinet) || cabinet < 1 || cabinet > 8) {
      throw new Error("cabinet IR target must be 1..8");
    }
    // Cab 1–7 often hold factory IRs — require an explicit UI confirmation token.
    if (cabinet !== 8 && options?.confirmFactoryIrOverwrite !== true) {
      throw new Error(
        "Escritura a Cab 1–7 bloqueada: confirma explícitamente el riesgo de pisar IR de fábrica (usa Cab 8 si puedes).",
      );
    }
    const distance =
      options?.distance !== undefined && Number.isFinite(options.distance)
        ? Math.min(1, Math.max(0, options.distance))
        : 0.5;
    const slotIndex = cabinet - 1;
    const result = await session.loadIrFromWav({
      wav,
      slotIndex,
      cabinet,
      volume: distance,
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
    if (source === "live") {
      if (liveVolume === undefined || !Number.isInteger(liveVolume) || liveVolume < 0 || liveVolume > 255) {
        throw new Error("volume live debe ser entero 0..255");
      }
    }

    return this.#serialMidi(async () => {
      const session = this.#requireSession();
      const bank = await session.readPresetBank({ timeoutMs: 2_000 });
      let volume: number;
      if (source === "live") {
        volume = liveVolume as number;
      } else {
        const slot = bank.slots.find((item) => item.slot === source);
        if (slot === undefined) throw new Error(`slot ${source} missing from bank`);
        volume = slot.volume;
      }

      const written = bank.raw.slice();
      for (let slotIndex = 0; slotIndex < 3; slotIndex += 1) {
        written[slotIndex * PRESET_SLOT_BYTE_LENGTH + VOLUME_BYTE_OFFSET] = volume;
      }
      const liveSlotIndex = slotIndexOf(liveSlot);
      const restore = await session.restoreBank({
        data: written,
        liveSlotIndex,
        timeoutMs: 5_000,
      });
      const snapshot = this.#toBankSnapshot(await session.readPresetBank({ timeoutMs: 2_000 }));
      this.#bankCache = snapshot;
      this.#lastPushedSlot = liveSlot;
      this.#desiredLiveSlot = liveSlot;
      const liveSlotData = snapshot.slots[liveSlotIndex];
      if (liveSlotData === undefined) {
        throw new Error("slot missing after matchVolumes");
      }
      const { slot: _slotId, ...liveParams } = liveSlotData;
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
        liveParams,
        bank: snapshot,
      };
    });
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
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText) as unknown;
    } catch {
      throw new Error("archivo bank no es JSON válido");
    }
    const data = bytesFromBankFile(parsed);
    const liveSlotIndex = slotIndexOf(liveSlot);

    return this.#serialMidi(async () => {
      const session = this.#requireSession();
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
      const bank = this.#toBankSnapshot(nextBank);
      this.#bankCache = bank;
      this.#lastPushedSlot = liveSlot;
      this.#desiredLiveSlot = liveSlot;
      return {
        verified: restore.verified,
        activeSlot: liveSlot,
        liveParams: slotToLiveParams(slot),
        bank,
      };
    });
  }

  get connected(): boolean {
    return this.#session !== undefined && this.#session.connected;
  }

  get ports(): { inputPortId: string; outputPortId: string } | undefined {
    return this.#ports;
  }

  async #pushSlotToLive(
    slotId: PresetSlotId,
    epoch: number,
  ): Promise<LiveParamsSnapshot> {
    const session = this.#requireSession();
    // Prefer cache (CubeSuite model). Refresh only on miss.
    let live = this.#slotParamsFromCache(slotId);
    if (live === undefined) {
      const bank = this.#toBankSnapshot(await session.readPresetBank({ timeoutMs: 2_000 }));
      this.#bankCache = bank;
      live = this.#slotParamsFromCache(slotId);
      if (live === undefined) {
        throw new Error(`slot ${slotId} missing from bank`);
      }
    }

    // Paced single-writer push into that slot's live band (slotIndex*16 + field).
    try {
      const slotIndex = this.#slotIndex(slotId);
      let first = true;
      for (const name of LIVE_PARAM_NAMES) {
        if (name === "cabinet") continue;
        if (this.#liveEpoch !== epoch) {
          return live;
        }
        await session.writeLiveParam({
          param: name,
          value: live[name],
          slotIndex,
          handshake: first,
          timeoutMs: LIVE_ACK_TIMEOUT_MS,
        });
        first = false;
        await sleep(LIVE_WRITE_GAP_MS);
      }
      if (this.#liveEpoch !== epoch) {
        return live;
      }
      await session.selectCabinet({
        cabinet: live.cabinet,
        slotIndex,
        timeoutMs: LIVE_ACK_TIMEOUT_MS,
        nudge: false,
      });
    } catch (error) {
      if (isMidiTransportFault(error)) {
        await this.#failMidiSession(error);
      }
      throw error;
    }
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
