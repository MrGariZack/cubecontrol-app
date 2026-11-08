import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CubeBabySession } from "@tonehub/cube-baby-api";
import { decodeWavToMonoFloat32, IR_ROM_SLOT_SIZE } from "@tonehub/cube-baby-protocol";

export type LoadIrResult = {
  readonly cabinet: number;
  readonly persistVerified: boolean;
  readonly liveMatch: string;
};

/**
 * Load WAV into one of 8 IR ROM slots.
 * `cabinet` is the pedal Cabinet value 1..8 (ROM index = cabinet - 1).
 * Mirrors desktop `deviceBridge.loadIrFromWav`.
 */
export async function loadIrFromWav(
  session: CubeBabySession,
  wav: Uint8Array,
  cabinet: number,
  options?: {
    readonly confirmIrOverwrite?: boolean;
    readonly distance?: number;
    readonly keepBackup?: boolean;
  },
): Promise<LoadIrResult> {
  if (wav.byteLength < 44) throw new Error("WAV demasiado corto");
  if (!Number.isInteger(cabinet) || cabinet < 1 || cabinet > 8) {
    throw new Error("cabinet IR target must be 1..8");
  }
  if (options?.confirmIrOverwrite !== true) {
    throw new Error(
      "Confirma la sobrescritura del IR en el gabinete seleccionado.",
    );
  }
  const distance =
    options?.distance !== undefined && Number.isFinite(options.distance)
      ? Math.min(1, Math.max(0, options.distance))
      : 0.5;
  const slotIndex = cabinet - 1;
  if (options.keepBackup) {
    // Reject malformed WAVs before creating a pending recovery point.
    decodeWavToMonoFloat32(wav);
    const existing = await readBackup(cabinet);
    if (existing?.pending) {
      throw new Error("Restaura el respaldo del gabinete antes de volver a escribir.");
    }
    const previous = await session.dumpIrRom({ slotIndex, timeoutMs: 5_000 });
    if (previous.data.length !== IR_ROM_SLOT_SIZE) {
      throw new Error("El respaldo del sector IR está incompleto.");
    }
    await saveBackup(cabinet, { bytes: Array.from(previous.data), pending: true });
  }
  const result = await session.loadIrFromWav({
    wav,
    slotIndex,
    cabinet,
    volume: distance,
    presence: cabinet === 8 ? "upload" : "factory",
    timeoutMs: 8_000,
  });
  if (options.keepBackup) {
    const backup = await readBackup(cabinet);
    if (backup) await saveBackup(cabinet, { ...backup, pending: false });
  }
  return {
    cabinet: result.cabinet,
    persistVerified: result.persist.verified,
    liveMatch: `${result.liveMatchPrefix}/${result.liveMatchTotal}`,
  };
}

type IrBackup = { bytes: number[]; pending: boolean };

function backupKey(cabinet: number): string {
  return `cubecontrol.ir-backup.v1.${cabinet}`;
}

async function readBackup(cabinet: number): Promise<IrBackup | null> {
  const raw = await AsyncStorage.getItem(backupKey(cabinet));
  if (raw === null) return null;
  const backup = JSON.parse(raw) as Partial<IrBackup> | null;
  if (
    !backup ||
    typeof backup.pending !== "boolean" ||
    !Array.isArray(backup.bytes) ||
    backup.bytes.length !== IR_ROM_SLOT_SIZE ||
    backup.bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)
  ) {
    throw new Error("El respaldo local del gabinete es inválido.");
  }
  return { pending: backup.pending, bytes: backup.bytes };
}

async function saveBackup(cabinet: number, backup: IrBackup): Promise<void> {
  const raw = JSON.stringify(backup);
  await AsyncStorage.setItem(backupKey(cabinet), raw);
  if ((await AsyncStorage.getItem(backupKey(cabinet))) !== raw) {
    throw new Error("No se pudo verificar el respaldo local del gabinete.");
  }
}

export async function restoreIrBackup(session: CubeBabySession, cabinet: number): Promise<void> {
  if (!Number.isInteger(cabinet) || cabinet < 1 || cabinet > 8) {
    throw new Error("Selecciona un gabinete del 1 al 8.");
  }
  const backup = await readBackup(cabinet);
  if (!backup) throw new Error("No hay un respaldo local para este gabinete.");
  const result = await session.persistIrRom({
    slotIndex: cabinet - 1,
    payload: Uint8Array.from(backup.bytes),
    timeoutMs: 8_000,
  });
  if (!result.verified) {
    throw new Error("No se pudo verificar el IR restaurado. No se seleccionó el gabinete.");
  }
  await session.selectCabinet({ cabinet, timeoutMs: 8_000 });
  await saveBackup(cabinet, { ...backup, pending: false });
}
