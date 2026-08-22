import {
  LIVE_PARAM_NAMES,
  PRESET_SLOT_BYTE_LENGTH,
  type CubeBabyPresetBank,
  type LiveParamName,
  type PresetSlotId,
} from "@tonehub/cube-baby-protocol";
import type { CubeBabySession } from "@tonehub/cube-baby-api";
import type { LiveParamsSnapshot } from "../library/types";
import { bankFileFromBytes, bytesFromBankFile } from "./bankFile";
import { slotIndexOf } from "./live";

const BANK_READ_TIMEOUT_MS = 2_000;
const BANK_RESTORE_TIMEOUT_MS = 5_000;

export type CopySlotSource = "live" | PresetSlotId;

export type SaveSlotResult = {
  readonly slot: PresetSlotId;
  readonly verified: boolean;
  readonly bank: CubeBabyPresetBank;
};

export type CopySlotResult = {
  readonly verified: boolean;
  readonly from: CopySlotSource;
  readonly to: PresetSlotId;
  readonly activeSlot: PresetSlotId;
  readonly liveParams: LiveParamsSnapshot;
  readonly bank: CubeBabyPresetBank;
};

function assertLiveInts(live: LiveParamsSnapshot): void {
  for (const name of LIVE_PARAM_NAMES) {
    const value = live[name];
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error(`live.${name} must be an integer 0..255`);
    }
  }
}

export function liveFromSlot(bank: CubeBabyPresetBank, slotIndex: number): LiveParamsSnapshot {
  const saved = bank.slots[slotIndex];
  if (saved === undefined) throw new Error("slot missing after bank write");
  return {
    type: saved.type,
    gain: saved.gain,
    tone: saved.tone,
    reverb: saved.reverb,
    feedback: saved.feedback,
    volume: saved.volume,
    time: saved.time,
    mix: saved.mix,
    modulation: saved.modulation,
    cabinet: saved.cabinet,
    irSection: saved.irSection,
    delaySection: saved.delaySection,
    toneSection: saved.toneSection,
  };
}

function fieldsMatch(saved: LiveParamsSnapshot, live: LiveParamsSnapshot): boolean {
  return LIVE_PARAM_NAMES.every((name) => saved[name] === live[name]);
}

/**
 * Persist current live params into one bank slot (keeps trailing bytes 13–15).
 * Uses restoreBank so the full A+B+C image is rewritten and verified.
 * Mirrors desktop `deviceBridge.saveSlot`.
 */
export async function saveSlot(
  session: CubeBabySession,
  slotId: PresetSlotId,
  live: LiveParamsSnapshot,
): Promise<SaveSlotResult> {
  assertLiveInts(live);
  const slotIndex = slotIndexOf(slotId);
  const bank = await session.readPresetBank({ timeoutMs: BANK_READ_TIMEOUT_MS });
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
    timeoutMs: BANK_RESTORE_TIMEOUT_MS,
  });
  const nextBank = await session.readPresetBank({ timeoutMs: BANK_READ_TIMEOUT_MS });
  const saved = liveFromSlot(nextBank, slotIndex);
  const verified = restore.verified && fieldsMatch(saved, live);
  return { slot: slotId, verified, bank: nextBank };
}

/**
 * Clone a full preset into another footswitch slot, then load the destination to live.
 * `from: "live"` uses current live params (bytes 0–12) + trailing from `liveSlot` in the bank.
 * Mirrors desktop `deviceBridge.copySlot`.
 */
export async function copySlot(
  session: CubeBabySession,
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
    if (options?.live === undefined) throw new Error("copySlot from live requiere live params");
    assertLiveInts(options.live);
  }

  const bank = await session.readPresetBank({ timeoutMs: BANK_READ_TIMEOUT_MS });
  const destIndex = slotIndexOf(to);
  const destStart = destIndex * PRESET_SLOT_BYTE_LENGTH;
  const written = bank.raw.slice();
  const destSlice = written.subarray(destStart, destStart + PRESET_SLOT_BYTE_LENGTH);

  if (from === "live") {
    const live = options?.live;
    if (live === undefined) throw new Error("copySlot from live requiere live params");
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
    timeoutMs: BANK_RESTORE_TIMEOUT_MS,
  });
  const nextBank = await session.readPresetBank({ timeoutMs: BANK_READ_TIMEOUT_MS });
  return {
    verified: restore.verified,
    from,
    to,
    activeSlot: to,
    liveParams: liveFromSlot(nextBank, destIndex),
    bank: nextBank,
  };
}

const VOLUME_BYTE_OFFSET = LIVE_PARAM_NAMES.indexOf("volume");

export type MatchVolumesSource = PresetSlotId | "live";

export type SlotDiffRow = {
  readonly param: LiveParamName;
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly differs: boolean;
};

export type MatchVolumesResult = {
  readonly verified: boolean;
  readonly source: MatchVolumesSource;
  readonly volume: number;
  readonly volumes: { readonly a: number; readonly b: number; readonly c: number };
  readonly activeSlot: PresetSlotId;
  readonly liveParams: LiveParamsSnapshot;
  readonly bank: CubeBabyPresetBank;
};

export type RestoreBankResult = {
  readonly verified: boolean;
  readonly activeSlot: PresetSlotId;
  readonly liveParams: LiveParamsSnapshot;
  readonly bank: CubeBabyPresetBank;
};

export function compareSlots(bank: CubeBabyPresetBank): SlotDiffRow[] {
  const a = bank.slots[0];
  const b = bank.slots[1];
  const c = bank.slots[2];
  return LIVE_PARAM_NAMES.map((param) => {
    const va = a[param];
    const vb = b[param];
    const vc = c[param];
    return { param, a: va, b: vb, c: vc, differs: !(va === vb && vb === vc) };
  });
}

export async function exportBankJson(session: CubeBabySession): Promise<string> {
  const bank = await session.readPresetBank({ timeoutMs: BANK_READ_TIMEOUT_MS });
  const document = bankFileFromBytes(bank.raw, Date.now());
  return `${JSON.stringify(document, null, 2)}\n`;
}

export async function restoreBankFromJson(
  session: CubeBabySession,
  jsonText: string,
  liveSlot: PresetSlotId,
): Promise<RestoreBankResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText) as unknown;
  } catch {
    throw new Error("archivo bank no es JSON válido");
  }
  const data = bytesFromBankFile(parsed);
  const liveSlotIndex = slotIndexOf(liveSlot);
  const restore = await session.restoreBank({
    data,
    liveSlotIndex,
    timeoutMs: BANK_RESTORE_TIMEOUT_MS,
  });
  const nextBank = await session.readPresetBank({ timeoutMs: BANK_READ_TIMEOUT_MS });
  return {
    verified: restore.verified,
    activeSlot: liveSlot,
    liveParams: liveFromSlot(nextBank, liveSlotIndex),
    bank: nextBank,
  };
}

export async function matchVolumes(
  session: CubeBabySession,
  source: MatchVolumesSource,
  liveSlot: PresetSlotId,
  liveVolume?: number,
): Promise<MatchVolumesResult> {
  if (VOLUME_BYTE_OFFSET < 0) throw new Error("offset de volume no disponible");
  if (source === "live") {
    if (liveVolume === undefined || !Number.isInteger(liveVolume) || liveVolume < 0 || liveVolume > 255) {
      throw new Error("volume live debe ser entero 0..255");
    }
  }
  const bank = await session.readPresetBank({ timeoutMs: BANK_READ_TIMEOUT_MS });
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
    timeoutMs: BANK_RESTORE_TIMEOUT_MS,
  });
  const nextBank = await session.readPresetBank({ timeoutMs: BANK_READ_TIMEOUT_MS });
  return {
    verified: restore.verified,
    source,
    volume,
    volumes: {
      a: nextBank.slots[0].volume,
      b: nextBank.slots[1].volume,
      c: nextBank.slots[2].volume,
    },
    activeSlot: liveSlot,
    liveParams: liveFromSlot(nextBank, liveSlotIndex),
    bank: nextBank,
  };
}
