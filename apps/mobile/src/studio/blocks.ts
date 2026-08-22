import { LIVE_PARAM_MAX, type LiveParamName } from "@tonehub/cube-baby-protocol";

export type BlockId = "drive" | "delay" | "reverb" | "modulation" | "cabinet" | "output";

export type LiveBlockDef = {
  readonly id: BlockId;
  readonly accent: string;
  readonly knobs: readonly LiveParamName[];
  readonly toggle?: LiveParamName;
};

/** Same grouping as desktop `studio/blocks.ts` — labels live in i18n. */
export const LIVE_BLOCKS: readonly LiveBlockDef[] = [
  {
    id: "drive",
    accent: "#E36B2C",
    knobs: ["type", "gain", "tone"],
    toggle: "toneSection",
  },
  {
    id: "modulation",
    accent: "#3D8F5A",
    knobs: ["modulation"],
  },
  {
    id: "delay",
    accent: "#3A5BA0",
    knobs: ["time", "feedback", "mix"],
    toggle: "delaySection",
  },
  {
    id: "reverb",
    accent: "#2E8A7A",
    knobs: ["reverb"],
  },
  {
    id: "cabinet",
    accent: "#8A8175",
    knobs: ["cabinet"],
    toggle: "irSection",
  },
  {
    id: "output",
    accent: "#9AA4B2",
    knobs: ["volume"],
  },
];

export function knobMax(param: LiveParamName): number {
  return LIVE_PARAM_MAX[param];
}
