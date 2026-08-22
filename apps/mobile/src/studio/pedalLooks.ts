import type { BlockId } from "./blocks";

export type PedalLook = {
  readonly chassis: string;
  readonly chassisHi: string;
  readonly chassisLo: string;
  readonly silk: string;
  readonly silkMuted: string;
  readonly model: string;
  readonly knobCap: string;
  readonly knobTick: string;
  readonly ledOn: string;
  readonly felt: string;
};

/** Boss / compact-stomp silkscreens — colors are the enclosure, not the brand. */
export const PEDAL_LOOKS: Record<BlockId, PedalLook> = {
  drive: {
    chassis: "#C85A24",
    chassisHi: "#E07838",
    chassisLo: "#8A3A14",
    silk: "#1A120C",
    silkMuted: "rgba(26, 18, 12, 0.55)",
    model: "OVERDRIVE",
    knobCap: "#1A1A1A",
    knobTick: "#F2E6D8",
    ledOn: "#FF2A22",
    felt: "#C85A24",
  },
  modulation: {
    chassis: "#2F7A48",
    chassisHi: "#3E9A5C",
    chassisLo: "#1C4A2C",
    silk: "#0C1810",
    silkMuted: "rgba(12, 24, 16, 0.55)",
    model: "CHORUS / PHASER",
    knobCap: "#1A1A1A",
    knobTick: "#E8F5EC",
    ledOn: "#FF2A22",
    felt: "#2F7A48",
  },
  delay: {
    chassis: "#2A4578",
    chassisHi: "#3D5F9A",
    chassisLo: "#172848",
    silk: "#DCE6F5",
    silkMuted: "rgba(220, 230, 245, 0.55)",
    model: "ANALOG DELAY",
    knobCap: "#141414",
    knobTick: "#F4F0E6",
    ledOn: "#FF2A22",
    felt: "#2A4578",
  },
  reverb: {
    chassis: "#2A6B5C",
    chassisHi: "#3A8A76",
    chassisLo: "#17463C",
    silk: "#E7F4EF",
    silkMuted: "rgba(231, 244, 239, 0.55)",
    model: "HALL / SPRING",
    knobCap: "#1A1A1A",
    knobTick: "#F4F0E6",
    ledOn: "#FF2A22",
    felt: "#2A6B5C",
  },
  cabinet: {
    chassis: "#5C574E",
    chassisHi: "#736C60",
    chassisLo: "#3A372F",
    silk: "#E8E2D6",
    silkMuted: "rgba(232, 226, 214, 0.55)",
    model: "IR CABINET",
    knobCap: "#1A1A1A",
    knobTick: "#F4EDE0",
    ledOn: "#FF2A22",
    felt: "#5C574E",
  },
  output: {
    chassis: "#2A2E33",
    chassisHi: "#3E444C",
    chassisLo: "#16181B",
    silk: "#D5DCE6",
    silkMuted: "rgba(213, 220, 230, 0.55)",
    model: "MASTER",
    knobCap: "#0E0E0E",
    knobTick: "#F0F0F0",
    ledOn: "#6EE7B7",
    felt: "#2A2E33",
  },
};
