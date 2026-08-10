import type { LiveParamName } from "@tonehub/cube-baby-protocol";

export type BlockId = "drive" | "delay" | "reverb" | "modulation" | "cabinet" | "output";

export type KnobDef = {
  readonly param: LiveParamName;
  readonly label: string;
  readonly max: number;
};

export type BlockDef = {
  readonly id: BlockId;
  readonly label: string;
  readonly short: string;
  readonly accent: string;
  readonly knobs: readonly KnobDef[];
  readonly toggle?: {
    readonly param: LiveParamName;
    readonly label: string;
  };
};

export const BLOCKS: readonly BlockDef[] = [
  {
    id: "drive",
    label: "Drive",
    short: "DRV",
    accent: "#2EC4B6",
    knobs: [
      { param: "type", label: "Type", max: 255 },
      { param: "gain", label: "Gain", max: 255 },
      { param: "tone", label: "Tone", max: 255 },
    ],
    toggle: { param: "toneSection", label: "Tone sec" },
  },
  {
    id: "delay",
    label: "Delay",
    short: "DLY",
    accent: "#7C9CFF",
    knobs: [
      { param: "time", label: "Time", max: 255 },
      { param: "feedback", label: "Feedback", max: 255 },
      { param: "mix", label: "Mix", max: 255 },
    ],
    toggle: { param: "delaySection", label: "Delay sec" },
  },
  {
    id: "reverb",
    label: "Reverb",
    short: "RVB",
    accent: "#5AD1C3",
    knobs: [{ param: "reverb", label: "Reverb", max: 255 }],
  },
  {
    id: "modulation",
    label: "Modulation",
    short: "MOD",
    accent: "#4F8CFF",
    knobs: [{ param: "modulation", label: "Depth", max: 255 }],
  },
  {
    id: "cabinet",
    label: "Cabinet",
    short: "CAB",
    accent: "#9AA4B2",
    knobs: [{ param: "cabinet", label: "Cabinet", max: 8 }],
    toggle: { param: "irSection", label: "IR sec" },
  },
  {
    id: "output",
    label: "Output",
    short: "OUT",
    accent: "#6EE7B7",
    knobs: [{ param: "volume", label: "Volume", max: 255 }],
  },
];

export function getBlock(id: BlockId): BlockDef {
  const block = BLOCKS.find((item) => item.id === id);
  if (block === undefined) throw new Error(`unknown block ${id}`);
  return block;
}
