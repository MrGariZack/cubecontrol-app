/**
 * Renderer MIDI diagnostics — DevTools console (Ctrl+Shift+I).
 * Silence with localStorage.setItem("cubecontrol.midiLog", "0") + reload.
 */
function enabled(): boolean {
  try {
    return window.localStorage.getItem("cubecontrol.midiLog") !== "0";
  } catch {
    return true;
  }
}

export function midiLog(event: string, detail?: Record<string, unknown>): void {
  if (!enabled()) return;
  const stamp = new Date().toISOString().slice(11, 23);
  if (detail === undefined) {
    console.log(`[ui-midi ${stamp}] ${event}`);
    return;
  }
  console.log(`[ui-midi ${stamp}] ${event}`, detail);
}

export function midiWarn(event: string, detail?: Record<string, unknown>): void {
  if (!enabled()) return;
  const stamp = new Date().toISOString().slice(11, 23);
  if (detail === undefined) {
    console.warn(`[ui-midi ${stamp}] ${event}`);
    return;
  }
  console.warn(`[ui-midi ${stamp}] ${event}`, detail);
}
