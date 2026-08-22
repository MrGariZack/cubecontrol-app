import type { PitchInputInfo } from "@tonehub/midi-host-android";

export function looksLikeCube(label: string): boolean {
  return /cube|cuvave|m-?vave|301a/i.test(label);
}

/** Cube USB → other USB → line/headset → built-in mic. Never a random "other". */
export function preferredPitchInputId(inputs: readonly PitchInputInfo[]): number {
  const cube = inputs.find((item) => looksLikeCube(item.label));
  if (cube) return cube.id;
  const usb = inputs.find((item) => item.kind === "usb");
  if (usb) return usb.id;
  const line = inputs.find((item) => item.kind === "line" || item.kind === "headset");
  if (line) return line.id;
  const mic = inputs.find((item) => item.builtInMic || item.kind === "mic");
  if (mic) return mic.id;
  return inputs[0]?.id ?? -1;
}
