import { LIVE_PARAM_MAX, type LiveParamName } from "@tonehub/cube-baby-protocol";

type KnobSpec = {
  readonly param: LiveParamName;
  readonly label: string;
  readonly max: number;
  readonly tone: "volume" | "cab" | "delay" | "drive";
  readonly section?: "irSection" | "delaySection" | "toneSection";
  /** Part of Mix/FB/Time/MOD cluster: Mix at 0 shows the cluster as off. */
  readonly delayTimeCluster?: boolean;
  /** MOD: center (7–8) is off; 0 is chorus, not off. */
  readonly bipolarCenterOff?: boolean;
  readonly tunerMark?: string;
  readonly iconMark?: "play" | "stop" | "back";
};

export const CUBE_BABY_KNOBS: readonly KnobSpec[] = [
  { param: "volume", label: "VOLUME", max: LIVE_PARAM_MAX.volume, tone: "volume" },
  {
    param: "cabinet",
    label: "IR CAB",
    max: LIVE_PARAM_MAX.cabinet,
    tone: "cab",
    section: "irSection",
    tunerMark: "E",
  },
  {
    param: "reverb",
    label: "REVERB",
    max: LIVE_PARAM_MAX.reverb,
    tone: "cab",
    section: "irSection",
    tunerMark: "A",
  },
  {
    param: "mix",
    label: "MIX",
    max: LIVE_PARAM_MAX.mix,
    tone: "delay",
    section: "delaySection",
    delayTimeCluster: true,
    tunerMark: "D",
  },
  {
    param: "feedback",
    label: "FB",
    max: LIVE_PARAM_MAX.feedback,
    tone: "delay",
    section: "delaySection",
    delayTimeCluster: true,
    tunerMark: "G",
  },
  {
    param: "time",
    label: "TIME",
    max: LIVE_PARAM_MAX.time,
    tone: "delay",
    section: "delaySection",
    delayTimeCluster: true,
    tunerMark: "B",
  },
  {
    // Bipolar: 0–6 chorus, 7–8 off, 9–15 phaser. Independent of Mix (delay wet).
    // Full MOD+DLY mute = footswitch B / delaySection only.
    param: "modulation",
    label: "MOD",
    max: LIVE_PARAM_MAX.modulation,
    tone: "delay",
    section: "delaySection",
    bipolarCenterOff: true,
    tunerMark: "E",
  },
  {
    param: "tone",
    label: "TONE",
    max: LIVE_PARAM_MAX.tone,
    tone: "drive",
    section: "toneSection",
    iconMark: "play",
  },
  {
    param: "gain",
    label: "GAIN",
    max: LIVE_PARAM_MAX.gain,
    tone: "drive",
    section: "toneSection",
    iconMark: "stop",
  },
  {
    param: "type",
    label: "TYPE",
    max: LIVE_PARAM_MAX.type,
    tone: "drive",
    section: "toneSection",
    iconMark: "back",
  },
];

