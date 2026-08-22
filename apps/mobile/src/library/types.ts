import type { LiveParamName } from "@tonehub/cube-baby-protocol";
import type { DelayNoteId } from "../music/delaySync";

export type LiveParamsSnapshot = Record<LiveParamName, number>;

export type LibraryProfile = "ensayo" | "directo" | "grabacion" | "otro";

export const FAVORITE_TAG = "favorite";
export const LIBRARY_FORMAT = "cubecontrol-mobile-library-v2";
export const LIBRARY_PROFILES: readonly LibraryProfile[] = ["ensayo", "directo", "grabacion", "otro"];

export type PresetLibraryItem = {
  readonly id: string;
  readonly kind: "preset";
  readonly name: string;
  readonly notes: string;
  readonly tags: readonly string[];
  readonly profile: LibraryProfile;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly params: LiveParamsSnapshot;
};

export type IrLibraryItem = {
  readonly id: string;
  readonly kind: "ir";
  readonly name: string;
  readonly notes: string;
  readonly tags: readonly string[];
  readonly profile: LibraryProfile;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly uri: string;
};

export type SongLibraryItem = {
  readonly id: string;
  readonly kind: "song";
  readonly name: string;
  readonly notes: string;
  readonly tags: readonly string[];
  readonly presetId: string;
  readonly irId?: string;
  readonly irCabinet?: number;
  readonly irDistance?: number;
  readonly key?: string;
  readonly bpm?: number;
  readonly delayNote?: DelayNoteId;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ShowLibraryItem = {
  readonly id: string;
  readonly kind: "show";
  readonly name: string;
  readonly notes: string;
  readonly songIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type MobileLibrary = {
  readonly format: typeof LIBRARY_FORMAT;
  readonly presets: PresetLibraryItem[];
  readonly songs: SongLibraryItem[];
  readonly shows: ShowLibraryItem[];
  readonly irs: IrLibraryItem[];
};

export function isFavorite(tags: readonly string[]): boolean {
  return tags.includes(FAVORITE_TAG);
}

export function toggleFavoriteTag(tags: readonly string[]): string[] {
  return isFavorite(tags) ? tags.filter((tag) => tag !== FAVORITE_TAG) : [...tags, FAVORITE_TAG];
}

export function emptyLibrary(): MobileLibrary {
  return { format: LIBRARY_FORMAT, presets: [], songs: [], shows: [], irs: [] };
}
