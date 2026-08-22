import { SHARE_FORMAT, type SharePayload } from "./shareFormat";
import type { MobileLibrary, PresetLibraryItem, ShowLibraryItem, SongLibraryItem } from "./types";
import type { DelayNoteId } from "../music/delaySync";
import { isDelayNoteId } from "../music/delaySync";
import { newId, nowIso } from "./storage";

export function buildPresetShare(preset: PresetLibraryItem): SharePayload {
  return {
    format: SHARE_FORMAT,
    kind: "preset",
    name: preset.name,
    createdAt: nowIso(),
    presets: [
      {
        name: preset.name,
        notes: preset.notes,
        tags: [...preset.tags],
        profile: preset.profile,
        params: { ...preset.params },
      },
    ],
    songs: [],
    shows: [],
  };
}

export function buildSongShare(song: SongLibraryItem, preset: PresetLibraryItem): SharePayload {
  return {
    format: SHARE_FORMAT,
    kind: "song",
    name: song.name,
    createdAt: nowIso(),
    presets: [
      {
        name: preset.name,
        notes: preset.notes,
        tags: [...preset.tags],
        profile: preset.profile,
        params: { ...preset.params },
      },
    ],
    songs: [
      {
        name: song.name,
        notes: song.notes,
        tags: [...song.tags],
        presetIndex: 0,
        ...(song.bpm !== undefined ? { bpm: song.bpm } : {}),
        ...(song.delayNote ? { delayNote: song.delayNote } : {}),
        ...(song.key ? { key: song.key } : {}),
      },
    ],
    shows: [],
  };
}

export function buildShowShare(
  show: ShowLibraryItem,
  songs: readonly SongLibraryItem[],
  presets: readonly PresetLibraryItem[],
): SharePayload {
  const usedPresets: PresetLibraryItem[] = [];
  const usedSongs: SongLibraryItem[] = [];
  for (const songId of show.songIds) {
    const song = songs.find((item) => item.id === songId);
    if (!song) continue;
    if (!usedPresets.some((item) => item.id === song.presetId)) {
      const preset = presets.find((item) => item.id === song.presetId);
      if (!preset) continue;
      usedPresets.push(preset);
    }
    usedSongs.push(song);
  }
  return {
    format: SHARE_FORMAT,
    kind: "show",
    name: show.name,
    createdAt: nowIso(),
    presets: usedPresets.map((preset) => ({
      name: preset.name,
      notes: preset.notes,
      tags: [...preset.tags],
      profile: preset.profile,
      params: { ...preset.params },
    })),
    songs: usedSongs.map((song) => ({
      name: song.name,
      notes: song.notes,
      tags: [...song.tags],
      presetIndex: Math.max(
        0,
        usedPresets.findIndex((item) => item.id === song.presetId),
      ),
      ...(song.bpm !== undefined ? { bpm: song.bpm } : {}),
      ...(song.delayNote ? { delayNote: song.delayNote } : {}),
      ...(song.key ? { key: song.key } : {}),
    })),
    shows: [
      {
        name: show.name,
        notes: show.notes,
        songIndexes: usedSongs.map((_, index) => index),
      },
    ],
  };
}

export type ShareImportResult = {
  readonly name: string;
  readonly presets: number;
  readonly songs: number;
  readonly shows: number;
};

export function mergeShare(library: MobileLibrary, payload: SharePayload): MobileLibrary {
  const stamp = nowIso();
  const presets: PresetLibraryItem[] = payload.presets.map((preset) => ({
    id: newId(),
    kind: "preset",
    name: preset.name,
    notes: preset.notes,
    tags: [...preset.tags],
    profile: preset.profile,
    params: preset.params as PresetLibraryItem["params"],
    createdAt: stamp,
    updatedAt: stamp,
  }));
  const songs: SongLibraryItem[] = payload.songs.map((song) => {
    const preset = presets[song.presetIndex];
    const delayNote: DelayNoteId | undefined = isDelayNoteId(song.delayNote) ? song.delayNote : undefined;
    return {
      id: newId(),
      kind: "song",
      name: song.name,
      notes: song.notes,
      tags: [...song.tags],
      presetId: preset?.id ?? presets[0]!.id,
      ...(song.bpm !== undefined ? { bpm: song.bpm } : {}),
      ...(delayNote ? { delayNote } : {}),
      ...(song.key ? { key: song.key } : {}),
      createdAt: stamp,
      updatedAt: stamp,
    };
  });
  const shows: ShowLibraryItem[] = payload.shows.map((show) => ({
    id: newId(),
    kind: "show",
    name: show.name,
    notes: show.notes,
    songIds: show.songIndexes
      .map((index) => songs[index]?.id)
      .filter((id): id is string => typeof id === "string"),
    createdAt: stamp,
    updatedAt: stamp,
  }));
  return {
    ...library,
    presets: [...presets, ...library.presets],
    songs: [...songs, ...library.songs],
    shows: [...shows, ...library.shows],
  };
}

export function shareImportResult(payload: SharePayload): ShareImportResult {
  return {
    name: payload.name,
    presets: payload.presets.length,
    songs: payload.songs.length,
    shows: payload.shows.length,
  };
}
