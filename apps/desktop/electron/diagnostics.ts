import { app, BrowserWindow, dialog, shell } from "electron";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getMainMidiLogSnapshot } from "./midiLog.js";

export type DiagnosticsExportInput = {
  readonly notes: string;
  readonly locale: string;
  readonly uiMidiLogJsonl: string;
  readonly metaExtra?: Record<string, unknown>;
};

function stamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function toJsonl(entries: readonly { readonly at: string; readonly level: string; readonly event: string; readonly detail?: Record<string, unknown> }[]): string {
  return entries.map((e) => JSON.stringify(e)).join("\n") + (entries.length ? "\n" : "");
}

/**
 * Build a shareable diagnostic ZIP (no IR WAVs / no secrets).
 */
export async function exportDiagnosticsBundle(
  event: Electron.IpcMainInvokeEvent,
  input: DiagnosticsExportInput,
): Promise<{ path: string } | null> {
  const win = BrowserWindow.fromWebContents(event.sender);
  const defaultName = `CubeControl-diagnostics-${stamp()}.zip`;
  const options = {
    title: "Export CubeControl diagnostics",
    defaultPath: defaultName,
    filters: [{ name: "Zip", extensions: ["zip"] }],
  };
  const choice =
    win === null ? await dialog.showSaveDialog(options) : await dialog.showSaveDialog(win, options);
  if (choice.canceled || choice.filePath === undefined) return null;

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  const meta = {
    format: "cubecontrol-diagnostics-v1",
    createdAt: new Date().toISOString(),
    app: {
      name: app.getName(),
      version: app.getVersion(),
      locale: input.locale,
    },
    runtime: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      osType: os.type(),
    },
    paths: {
      userData: app.getPath("userData"),
    },
    ...(input.metaExtra ?? {}),
  };

  zip.file(
    "README.txt",
    [
      "CubeControl diagnostic bundle",
      "============================",
      "",
      "Attach this ZIP when reporting a bug (GitHub Issues, Discord, email).",
      "It does NOT include IR WAV files or bank JSON by default.",
      "",
      "Contents:",
      "  meta.json          — app / OS versions",
      "  user-notes.txt     — what you typed in Report a problem",
      "  ui-midi-log.jsonl  — recent UI MIDI / action log",
      "  main-midi-log.jsonl — recent main-process MIDI log",
      "",
      "Repo: https://github.com/MrGariZack/cubecontrol-app/issues",
      "",
    ].join("\n"),
  );
  zip.file("meta.json", `${JSON.stringify(meta, null, 2)}\n`);
  zip.file("user-notes.txt", `${input.notes.trim() || "(no notes)"}\n`);
  zip.file("ui-midi-log.jsonl", input.uiMidiLogJsonl);
  zip.file("main-midi-log.jsonl", toJsonl(getMainMidiLogSnapshot()));

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const dest = choice.filePath.endsWith(".zip") ? choice.filePath : `${choice.filePath}.zip`;
  await writeFile(dest, buffer);
  return { path: dest };
}

export async function openExternalUrl(url: string): Promise<void> {
  await shell.openExternal(url);
}

export function revealInFolder(filePath: string): void {
  shell.showItemInFolder(path.resolve(filePath));
}
