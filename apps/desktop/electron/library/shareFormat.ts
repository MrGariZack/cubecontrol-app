/**
 * Keep in sync with apps/mobile/src/library/shareFormat.ts
 */
export const SHARE_FORMAT = "tonehub-share-v1" as const;
export const SHARE_EXT = "cubecontrol.json";

export type ShareKind = "preset" | "song" | "show";

export type ShareProfile = "ensayo" | "directo" | "grabacion" | "otro";

export type SharePreset = {
  readonly name: string;
  readonly notes: string;
  readonly tags: readonly string[];
  readonly profile: ShareProfile;
  readonly params: Record<string, number>;
};

export type ShareSong = {
  readonly name: string;
  readonly notes: string;
  readonly tags: readonly string[];
  readonly presetIndex: number;
  readonly bpm?: number;
  readonly delayNote?: string;
  readonly key?: string;
};

export type ShareShow = {
  readonly name: string;
  readonly notes: string;
  readonly songIndexes: readonly number[];
};

export type SharePayload = {
  readonly format: typeof SHARE_FORMAT;
  readonly kind: ShareKind;
  readonly name: string;
  readonly createdAt: string;
  readonly presets: readonly SharePreset[];
  readonly songs: readonly ShareSong[];
  readonly shows: readonly ShareShow[];
};

const PROFILES: readonly ShareProfile[] = ["ensayo", "directo", "grabacion", "otro"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asProfile(value: unknown): ShareProfile {
  return PROFILES.includes(value as ShareProfile) ? (value as ShareProfile) : "otro";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asPreset(value: unknown): SharePreset | null {
  if (!isRecord(value) || !isRecord(value.params)) return null;
  const params: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value.params)) {
    if (typeof raw === "number" && Number.isFinite(raw)) params[key] = raw;
  }
  if (Object.keys(params).length === 0) return null;
  return {
    name: asString(value.name, "Tono"),
    notes: asString(value.notes),
    tags: asStringArray(value.tags),
    profile: asProfile(value.profile),
    params,
  };
}

export function parseSharePayload(raw: unknown): SharePayload | null {
  const data = typeof raw === "string" ? safeJson(raw) : raw;
  if (!isRecord(data) || data.format !== SHARE_FORMAT) return null;
  const kind = data.kind;
  if (kind !== "preset" && kind !== "song" && kind !== "show") return null;
  const presets = Array.isArray(data.presets)
    ? data.presets.map(asPreset).filter((item): item is SharePreset => item !== null)
    : [];
  if (presets.length === 0) return null;
  const songs: ShareSong[] = Array.isArray(data.songs)
    ? data.songs.flatMap((item) => {
        if (!isRecord(item) || typeof item.presetIndex !== "number") return [];
        const presetIndex = Math.floor(item.presetIndex);
        if (presetIndex < 0 || presetIndex >= presets.length) return [];
        return [
          {
            name: asString(item.name, "Canción"),
            notes: asString(item.notes),
            tags: asStringArray(item.tags),
            presetIndex,
            ...(typeof item.bpm === "number" ? { bpm: item.bpm } : {}),
            ...(typeof item.delayNote === "string" ? { delayNote: item.delayNote } : {}),
            ...(typeof item.key === "string" ? { key: item.key } : {}),
          },
        ];
      })
    : [];
  const shows: ShareShow[] = Array.isArray(data.shows)
    ? data.shows.flatMap((item) => {
        if (!isRecord(item) || !Array.isArray(item.songIndexes)) return [];
        const songIndexes = item.songIndexes.filter(
          (index): index is number => typeof index === "number" && index >= 0 && index < songs.length,
        );
        return [
          {
            name: asString(item.name, "Show"),
            notes: asString(item.notes),
            songIndexes,
          },
        ];
      })
    : [];
  return {
    format: SHARE_FORMAT,
    kind,
    name: asString(data.name, "CubeControl"),
    createdAt: asString(data.createdAt, new Date().toISOString()),
    presets,
    songs,
    shows,
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text.replace(/^\uFEFF/, "").trim()) as unknown;
  } catch {
    return null;
  }
}

export function shareFileName(name: string): string {
  const base =
    name
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "cubecontrol";
  return `${base}.${SHARE_EXT}`;
}
