import { LIVE_PARAM_MAX } from "@tonehub/cube-baby-protocol";

/**
 * Cube Baby Time is 0–31 hardware steps — no factory ms table.
 * Fixed map: Time N → N * (1000/31) ms. Software TAP/BPM → nearest step.
 * Default figure: dotted eighth (¾ beat). At 136 BPM → ~331 ms → Time ~10.
 *
 * Copied from apps/desktop/src/music/delaySync.ts (shared package later).
 */
export const DELAY_TIME_MAX_BYTE = LIVE_PARAM_MAX.time;
export const DELAY_MS_PER_STEP = 1000 / DELAY_TIME_MAX_BYTE;
export const DELAY_TIME_MAX_MS = 1000;

export const DELAY_NOTE_IDS = ["1/8d", "1/4", "1/8", "1/16"] as const;
export type DelayNoteId = (typeof DELAY_NOTE_IDS)[number];

/** Dotted eighth = ¾ of the beat — the usual guitar delay figure. */
export const DEFAULT_DELAY_NOTE: DelayNoteId = "1/8d";

const BEATS: Record<DelayNoteId, number> = {
  "1/4": 1,
  "1/8": 0.5,
  "1/8d": 0.75,
  "1/16": 0.25,
};

export function isDelayNoteId(value: string | undefined): value is DelayNoteId {
  return DELAY_NOTE_IDS.some((id) => id === value);
}

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return 120;
  return Math.min(240, Math.max(40, Math.round(bpm)));
}

export function delayMsForNote(bpm: number, note: DelayNoteId): number {
  return (60_000 / clampBpm(bpm)) * BEATS[note];
}

export function timeByteToMs(time: number): number {
  const t = Math.min(DELAY_TIME_MAX_BYTE, Math.max(0, time));
  return t * DELAY_MS_PER_STEP;
}

export function msToTimeByte(ms: number): number {
  const target = Math.min(DELAY_TIME_MAX_MS, Math.max(0, ms));
  let best = 0;
  let bestErr = Number.POSITIVE_INFINITY;
  for (let t = 0; t <= DELAY_TIME_MAX_BYTE; t += 1) {
    const err = Math.abs(timeByteToMs(t) - target);
    // Prefer the longer delay on a tie — short repeats read as “too fast”.
    if (err < bestErr - 0.05 || (Math.abs(err - bestErr) <= 0.05 && t > best)) {
      best = t;
      bestErr = err;
    }
  }
  return best;
}

export function grooveTimeByte(bpm: number, note: DelayNoteId = DEFAULT_DELAY_NOTE): number {
  return msToTimeByte(delayMsForNote(bpm, note));
}

export function applyGrooveTime<T extends { readonly time: number }>(
  params: T,
  bpm: number | undefined,
  note: DelayNoteId | undefined,
): T {
  if (bpm === undefined || !Number.isFinite(bpm)) return params;
  const division = note ?? DEFAULT_DELAY_NOTE;
  return { ...params, time: grooveTimeByte(bpm, division) };
}

/** Median inter-onset BPM from tap timestamps (ms). Needs ≥2 taps. */
export function bpmFromTapTimes(timesMs: readonly number[]): number | null {
  if (timesMs.length < 2) return null;
  const intervals: number[] = [];
  for (let i = 1; i < timesMs.length; i += 1) {
    const dt = (timesMs[i] ?? 0) - (timesMs[i - 1] ?? 0);
    if (dt >= 250 && dt <= 1500) intervals.push(dt);
  }
  if (intervals.length === 0) return null;
  const sorted = [...intervals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
      : (sorted[mid] ?? 0);
  return clampBpm(60_000 / median);
}
