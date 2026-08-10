import type { LiveParamName, PresetSlotId } from "@tonehub/cube-baby-protocol";

export type LiveParamsSnapshot = Record<LiveParamName, number>;

export type LibraryProfile = "ensayo" | "directo" | "grabacion" | "otro";

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
  /** Relative path under library/ir/ */
  readonly wavFile: string;
  readonly byteLength: number;
};

export type IrBackupItem = {
  readonly id: string;
  readonly kind: "ir-backup";
  readonly cabinet: number;
  readonly romSlot: number;
  readonly createdAt: string;
  /** Relative path under library/history/ir/ */
  readonly binFile: string;
  readonly sourceName?: string;
};

export type PackManifest = {
  readonly format: "tonehub-pack-v1";
  readonly name: string;
  readonly notes: string;
  readonly createdAt: string;
  readonly presetIds: readonly string[];
  readonly irIds: readonly string[];
  readonly bankIncluded: boolean;
};

export type PackLibraryItem = {
  readonly id: string;
  readonly kind: "pack";
  readonly name: string;
  readonly notes: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly presetIds: readonly string[];
  readonly irIds: readonly string[];
  readonly hasBank: boolean;
};

export type LibraryIndex = {
  readonly format: "tonehub-library-index-v1";
  readonly presets: PresetLibraryItem[];
  readonly irs: IrLibraryItem[];
  readonly irBackups: IrBackupItem[];
  readonly packs: PackLibraryItem[];
};

export type LiveSnapshot = {
  readonly id: string;
  readonly label: string;
  readonly createdAt: string;
  readonly params: LiveParamsSnapshot;
  readonly activeSlot: PresetSlotId;
};

export type SlotDiffRow = {
  readonly param: LiveParamName;
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly differs: boolean;
};
