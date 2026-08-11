/**
 * MIDI diagnostics — visible in the Electron main terminal (where you run `pnpm desktop`).
 * Toggle with env CUBECONTROL_MIDI_LOG=0 to silence.
 */
const enabled = process.env.CUBECONTROL_MIDI_LOG !== "0";

export function midiLog(event: string, detail?: Record<string, unknown>): void {
  if (!enabled) return;
  const stamp = new Date().toISOString().slice(11, 23);
  if (detail === undefined) {
    console.log(`[midi ${stamp}] ${event}`);
    return;
  }
  console.log(`[midi ${stamp}] ${event}`, detail);
}

export function midiWarn(event: string, detail?: Record<string, unknown>): void {
  if (!enabled) return;
  const stamp = new Date().toISOString().slice(11, 23);
  if (detail === undefined) {
    console.warn(`[midi ${stamp}] ${event}`);
    return;
  }
  console.warn(`[midi ${stamp}] ${event}`, detail);
}
