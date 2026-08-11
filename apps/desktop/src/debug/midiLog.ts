export type MidiLogLevel = "log" | "warn";

export type MidiLogEntry = {
  readonly at: string;
  readonly level: MidiLogLevel;
  readonly event: string;
  readonly detail?: Record<string, unknown>;
};

const MAX_ENTRIES = 500;
const buffer: MidiLogEntry[] = [];

function push(level: MidiLogLevel, event: string, detail?: Record<string, unknown>): void {
  const entry: MidiLogEntry = {
    at: new Date().toISOString(),
    level,
    event,
    ...(detail === undefined ? {} : { detail }),
  };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_ENTRIES);
  }
}

/**
 * Renderer MIDI diagnostics — DevTools console (Ctrl+Shift+I).
 * Silence with localStorage.setItem("cubecontrol.midiLog", "0") + reload.
 * Entries are kept in memory for Report a problem → diagnostic ZIP.
 */
function enabled(): boolean {
  try {
    return window.localStorage.getItem("cubecontrol.midiLog") !== "0";
  } catch {
    return true;
  }
}

export function midiLog(event: string, detail?: Record<string, unknown>): void {
  push("log", event, detail);
  if (!enabled()) return;
  const stamp = new Date().toISOString().slice(11, 23);
  if (detail === undefined) {
    console.log(`[ui-midi ${stamp}] ${event}`);
    return;
  }
  console.log(`[ui-midi ${stamp}] ${event}`, detail);
}

export function midiWarn(event: string, detail?: Record<string, unknown>): void {
  push("warn", event, detail);
  if (!enabled()) return;
  const stamp = new Date().toISOString().slice(11, 23);
  if (detail === undefined) {
    console.warn(`[ui-midi ${stamp}] ${event}`);
    return;
  }
  console.warn(`[ui-midi ${stamp}] ${event}`, detail);
}

export function getUiMidiLogSnapshot(): readonly MidiLogEntry[] {
  return [...buffer];
}

export function clearUiMidiLog(): void {
  buffer.length = 0;
}
