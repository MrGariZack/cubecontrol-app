import JSZip from "jszip";
import type { LibraryProfile, LiveParamsSnapshot } from "./types";
import { LIBRARY_PROFILES } from "./types";

export const PACK_FORMAT = "tonehub-pack-v1" as const;

export type PackPresetDraft = {
  readonly name: string;
  readonly notes: string;
  readonly tags: readonly string[];
  readonly profile: LibraryProfile;
  readonly params: LiveParamsSnapshot;
};

export type PackIrDraft = {
  readonly name: string;
  readonly notes: string;
  readonly tags: readonly string[];
  readonly profile: LibraryProfile;
  readonly wav: Uint8Array;
};

export type ParsedPack = {
  readonly format: typeof PACK_FORMAT;
  readonly name: string;
  readonly notes: string;
  readonly presets: readonly PackPresetDraft[];
  readonly irs: readonly PackIrDraft[];
  readonly bankIncluded: boolean;
};

export type PackImportResult = {
  readonly name: string;
  readonly presets: number;
  readonly irs: number;
  readonly bankIncluded: boolean;
};

export function isZipBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asProfile(value: unknown): LibraryProfile {
  return LIBRARY_PROFILES.includes(value as LibraryProfile) ? (value as LibraryProfile) : "otro";
}

function asParams(value: unknown): LiveParamsSnapshot | null {
  if (!isRecord(value)) return null;
  const params: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "number" && Number.isFinite(raw)) params[key] = raw;
  }
  return Object.keys(params).length > 0 ? (params as LiveParamsSnapshot) : null;
}

function zipPath(name: string): string {
  return name.replace(/\\/g, "/");
}

function findZipFile(zip: JSZip, relative: string) {
  const want = zipPath(relative).replace(/^\.\//, "");
  const exact = zip.file(want);
  if (exact) return exact;
  const suffix = `/${want}`;
  const key = Object.keys(zip.files).find((name) => {
    const n = zipPath(name);
    return n === want || n.endsWith(suffix);
  });
  return key ? zip.file(key) : null;
}

function prefixFromManifest(zip: JSZip): string {
  const keys = Object.keys(zip.files).map(zipPath);
  const manifest = keys.find((name) => name === "manifest.json" || name.endsWith("/manifest.json"));
  if (!manifest || manifest === "manifest.json") return "";
  return manifest.slice(0, -"manifest.json".length);
}

export async function parsePackZip(bytes: Uint8Array): Promise<ParsedPack> {
  const zip = await JSZip.loadAsync(bytes);
  const prefix = prefixFromManifest(zip);
  const manifestFile = findZipFile(zip, `${prefix}manifest.json`);
  if (!manifestFile) throw new Error("Pack inválido: falta manifest.json");
  const raw = JSON.parse(await manifestFile.async("string")) as unknown;
  if (!isRecord(raw) || raw.format !== PACK_FORMAT) {
    throw new Error("Formato de pack no soportado");
  }
  const presetIds = Array.isArray(raw.presetIds)
    ? raw.presetIds.filter((id): id is string => typeof id === "string")
    : [];
  const irIds = Array.isArray(raw.irIds)
    ? raw.irIds.filter((id): id is string => typeof id === "string")
    : [];

  const presets: PackPresetDraft[] = [];
  for (const presetId of presetIds) {
    const file = findZipFile(zip, `${prefix}presets/${presetId}.json`);
    if (!file) continue;
    const data = JSON.parse(await file.async("string")) as unknown;
    if (!isRecord(data)) continue;
    const params = asParams(data.params);
    if (!params) continue;
    presets.push({
      name: asString(data.name, "Tono"),
      notes: asString(data.notes),
      tags: asStringArray(data.tags),
      profile: asProfile(data.profile),
      params,
    });
  }

  const irs: PackIrDraft[] = [];
  for (const irId of irIds) {
    const metaFile = findZipFile(zip, `${prefix}ir/${irId}.json`);
    if (!metaFile) continue;
    const meta = JSON.parse(await metaFile.async("string")) as unknown;
    if (!isRecord(meta)) continue;
    const wavName = asString(meta.wavFile);
    if (!wavName) continue;
    const wavFile =
      findZipFile(zip, `${prefix}ir/${wavName}`) ?? findZipFile(zip, `${prefix}ir/${wavName.split("/").pop() ?? wavName}`);
    if (!wavFile) continue;
    const wav = new Uint8Array(await wavFile.async("uint8array"));
    if (wav.byteLength === 0) continue;
    irs.push({
      name: asString(meta.name, wavName.replace(/\.wav$/i, "") || "IR"),
      notes: asString(meta.notes),
      tags: asStringArray(meta.tags),
      profile: asProfile(meta.profile),
      wav,
    });
  }

  if (presets.length === 0 && irs.length === 0) {
    throw new Error("El pack no trae tonos ni IRs");
  }

  return {
    format: PACK_FORMAT,
    name: asString(raw.name, "Pack"),
    notes: asString(raw.notes),
    presets,
    irs,
    bankIncluded: raw.bankIncluded === true || findZipFile(zip, `${prefix}bank.json`) !== null,
  };
}
