import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  LIBRARY_FORMAT,
  emptyLibrary,
  type IrLibraryItem,
  type MobileLibrary,
  type PresetLibraryItem,
  type ShowLibraryItem,
  type SongLibraryItem,
} from "./types";

export const LIBRARY_STORAGE_KEY = "cubecontrol.mobile.library.v2";
const LEGACY_KEY = "cubecontrol.mobile.library.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function isDemoId(id: string): boolean {
  return id.startsWith("tone-demo") || id.startsWith("song-demo") || id.startsWith("show-demo");
}

function migrateV1(raw: Record<string, unknown>): MobileLibrary | null {
  if (!Array.isArray(raw.tones) || !Array.isArray(raw.songs) || !Array.isArray(raw.shows)) {
    return null;
  }
  const presets: PresetLibraryItem[] = raw.tones.flatMap((item) => {
    const row = isRecord(item) ? item : {};
    const id = asString(row.id, newId());
    if (isDemoId(id)) return [];
    return [
      {
        id,
        kind: "preset" as const,
        name: asString(row.name, "Tono"),
        notes: asString(row.notes),
        tags: [],
        profile: "otro" as const,
        createdAt: asString(row.createdAt, nowIso()),
        updatedAt: asString(row.updatedAt, nowIso()),
        params: (isRecord(row.params) ? row.params : {}) as PresetLibraryItem["params"],
      },
    ];
  });
  const songs: SongLibraryItem[] = raw.songs.flatMap((item) => {
    const row = isRecord(item) ? item : {};
    const id = asString(row.id, newId());
    if (isDemoId(id) || isDemoId(asString(row.toneId))) return [];
    const irUri = asString(row.irUri);
    return [
      {
        id,
        kind: "song" as const,
        name: asString(row.name, "Canción"),
        notes: "",
        tags: [],
        presetId: asString(row.toneId),
        ...(typeof row.bpm === "number" ? { bpm: row.bpm } : {}),
        ...(typeof row.delayNote === "string" ? { delayNote: row.delayNote as SongLibraryItem["delayNote"] } : {}),
        createdAt: asString(row.createdAt, nowIso()),
        updatedAt: asString(row.updatedAt, nowIso()),
        ...(irUri ? { irId: `migrated-${id}` } : {}),
      },
    ];
  });
  const irs: IrLibraryItem[] = [];
  for (const item of raw.songs) {
    const row = isRecord(item) ? item : {};
    const id = asString(row.id);
    if (isDemoId(id)) continue;
    const uri = asString(row.irUri);
    if (!uri) continue;
    irs.push({
      id: `migrated-${id}`,
      kind: "ir",
      name: asString(row.irName, "IR"),
      notes: "",
      tags: [],
      profile: "otro",
      createdAt: asString(row.createdAt, nowIso()),
      updatedAt: asString(row.updatedAt, nowIso()),
      uri,
    });
  }
  const shows: ShowLibraryItem[] = raw.shows.flatMap((item) => {
    const row = isRecord(item) ? item : {};
    const id = asString(row.id, newId());
    if (isDemoId(id)) return [];
    return [
      {
        id,
        kind: "show" as const,
        name: asString(row.name, "Show"),
        notes: "",
        songIds: Array.isArray(row.songIds)
          ? row.songIds.map((songId) => String(songId)).filter((songId) => !isDemoId(songId))
          : [],
        createdAt: asString(row.createdAt, nowIso()),
        updatedAt: asString(row.updatedAt, nowIso()),
      },
    ];
  });
  return { format: LIBRARY_FORMAT, presets, songs, shows, irs };
}

function parseLibrary(raw: unknown): MobileLibrary | null {
  if (!isRecord(raw)) return null;
  if (raw.format === LIBRARY_FORMAT) {
    if (!Array.isArray(raw.presets) || !Array.isArray(raw.songs) || !Array.isArray(raw.shows)) {
      return null;
    }
    return {
      format: LIBRARY_FORMAT,
      presets: raw.presets as PresetLibraryItem[],
      songs: raw.songs as SongLibraryItem[],
      shows: raw.shows as ShowLibraryItem[],
      irs: Array.isArray(raw.irs) ? (raw.irs as IrLibraryItem[]) : [],
    };
  }
  if (raw.format === "cubecontrol-mobile-library-v1") {
    return migrateV1(raw);
  }
  return null;
}

export async function loadLibrary(): Promise<MobileLibrary> {
  try {
    const raw = await AsyncStorage.getItem(LIBRARY_STORAGE_KEY);
    if (raw) {
      const parsed = parseLibrary(JSON.parse(raw) as unknown);
      if (parsed) return parsed;
    }
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = parseLibrary(JSON.parse(legacy) as unknown);
      if (parsed) {
        await saveLibrary(parsed);
        return parsed;
      }
    }
  } catch {
    /* corrupt JSON → empty */
  }
  const seeded = emptyLibrary();
  await saveLibrary(seeded);
  return seeded;
}

export async function saveLibrary(library: MobileLibrary): Promise<void> {
  await AsyncStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
