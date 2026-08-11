/**
 * MIDI diagnostics — visible in the Electron main terminal (where you run `pnpm desktop`).
 * Toggle with env CUBECONTROL_MIDI_LOG=0 to silence.
 * Ring buffer is included in Report a problem diagnostic ZIPs.
 */

export type MainMidiLogEntry = {
  readonly at: string;
  readonly level: "log" | "warn";
  readonly event: string;
  readonly detail?: Record<string, unknown>;
};

const MAX_ENTRIES = 500;
const buffer: MainMidiLogEntry[] = [];
const enabled = process.env.CUBECONTROL_MIDI_LOG !== "0";

function push(level: "log" | "warn", event: string, detail?: Record<string, unknown>): void {
  buffer.push({
    at: new Date().toISOString(),
    level,
    event,
    ...(detail === undefined ? {} : { detail }),
  });
  if (buffer.length > MAX_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_ENTRIES);
  }
}

export function midiLog(event: string, detail?: Record<string, unknown>): void {
  push("log", event, detail);
  if (!enabled) return;
  const stamp = new Date().toISOString().slice(11, 23);
  if (detail === undefined) {
    console.log(`[midi ${stamp}] ${event}`);
    return;
  }
  console.log(`[midi ${stamp}] ${event}`, detail);
}

export function midiWarn(event: string, detail?: Record<string, unknown>): void {
  push("warn", event, detail);
  if (!enabled) return;
  const stamp = new Date().toISOString().slice(11, 23);
  if (detail === undefined) {
    console.warn(`[midi ${stamp}] ${event}`);
    return;
  }
  console.warn(`[midi ${stamp}] ${event}`, detail);
}

export function getMainMidiLogSnapshot(): readonly MainMidiLogEntry[] {
  return [...buffer];
}
