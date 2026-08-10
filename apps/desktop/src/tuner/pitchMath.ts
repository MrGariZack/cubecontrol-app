const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"] as const;

export type NoteName = (typeof NOTE_NAMES)[number];

export type DetectedNote = {
  readonly frequency: number;
  readonly midi: number;
  readonly name: NoteName;
  readonly octave: number;
  readonly cents: number;
  readonly targetHz: number;
};

/** Standard guitar strings (Cube Baby tuner letters E A D G B E). */
export const GUITAR_STRINGS = [
  { id: "E2", label: "E", midi: 40, hz: 82.4069 },
  { id: "A2", label: "A", midi: 45, hz: 110.0 },
  { id: "D3", label: "D", midi: 50, hz: 146.832 },
  { id: "G3", label: "G", midi: 55, hz: 196.0 },
  { id: "B3", label: "B", midi: 59, hz: 246.942 },
  { id: "E4", label: "E", midi: 64, hz: 329.628 },
] as const;

export function midiToHz(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - 69) / 12);
}

export function hzToMidi(hz: number, a4 = 440): number {
  return 69 + 12 * Math.log2(hz / a4);
}

export function analyzePitch(frequency: number, a4 = 440): DetectedNote {
  const midiFloat = hzToMidi(frequency, a4);
  const midi = Math.round(midiFloat);
  const cents = (midiFloat - midi) * 100;
  const name = NOTE_NAMES[((midi % 12) + 12) % 12] ?? "C";
  const octave = Math.floor(midi / 12) - 1;
  return {
    frequency,
    midi,
    name,
    octave,
    cents,
    targetHz: midiToHz(midi, a4),
  };
}

export function centsBetween(hz: number, targetHz: number): number {
  return 1200 * Math.log2(hz / targetHz);
}

export type OctaveLane = {
  readonly offset: -1 | 0 | 1;
  readonly label: string;
  readonly midi: number;
  readonly hz: number;
  readonly cents: number;
  readonly inTune: boolean;
};

/** Lanes for octaver checks: root, −1 oct, +1 oct. */
export function octaveLanes(
  frequency: number,
  rootMidi: number,
  a4 = 440,
  inTuneCents = 8,
): readonly OctaveLane[] {
  return ([-1, 0, 1] as const).map((offset) => {
    const midi = rootMidi + offset * 12;
    const hz = midiToHz(midi, a4);
    const cents = centsBetween(frequency, hz);
    return {
      offset,
      label: offset === 0 ? "Root" : offset < 0 ? "−1 oct" : "+1 oct",
      midi,
      hz,
      cents,
      inTune: Math.abs(cents) <= inTuneCents,
    };
  });
}

/**
 * Reduce common ±1 octave jumps by preferring continuity with the last stable pitch
 * and keeping the result inside an instrument window.
 */
export function stabilizeOctave(
  rawHz: number,
  previousHz: number | null,
  minHz: number,
  maxHz: number,
): number {
  let hz = rawHz;
  // Fold into instrument window by octaves.
  while (hz > 0 && hz < minHz) hz *= 2;
  while (hz > maxHz) hz /= 2;

  if (previousHz !== null && previousHz > 0) {
    const candidates = [hz, hz * 2, hz / 2].filter((f) => f >= minHz * 0.9 && f <= maxHz * 1.1);
    let best = hz;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const ratio = candidate / previousHz;
      const octaves = Math.abs(Math.log2(ratio));
      // Prefer near-continuous pitch; penalize large leaps.
      const score = octaves + Math.abs(centsBetween(candidate, previousHz)) / 1200;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    hz = best;
  }

  return hz;
}

export type GuitarString = (typeof GUITAR_STRINGS)[number];

export function nearestGuitarString(midi: number): GuitarString {
  let best: GuitarString = GUITAR_STRINGS[0]!;
  let bestDist = Math.abs(midi - best.midi);
  for (const string of GUITAR_STRINGS) {
    const dist = Math.abs(midi - string.midi);
    if (dist < bestDist) {
      best = string;
      bestDist = dist;
    }
  }
  return best;
}
