import { randomUUID } from "node:crypto";
import { open, rename, rm, type FileHandle } from "node:fs/promises";
import path from "node:path";
import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from "electron";

const MAX_CLIP_BYTES = 256 * 1024 * 1024;
const MAX_CHUNK_BYTES = 1024 * 1024;

type ExportJob = {
  readonly file: FileHandle;
  readonly temporary: string;
  readonly destination: string;
  readonly expectedBytes: number;
  readonly onDestroyed: () => void;
  bytes: number;
  writing: boolean;
};

async function closeExport(job: ExportJob, commit: boolean): Promise<void> {
  try {
    if (commit) await job.file.sync();
  } finally {
    await job.file.close();
  }
  if (commit) await rename(job.temporary, job.destination);
}

async function discardExport(job: ExportJob) {
  await closeExport(job, false).catch(() => undefined);
  await rm(job.temporary, { force: true }).catch(() => undefined);
}

export function registerClipExport(ownsFrame: (event: IpcMainInvokeEvent) => boolean): void {
  const opening = new Set<number>();
  const jobs = new Map<number, ExportJob>();

  function senderId(event: IpcMainInvokeEvent): number {
    if (!ownsFrame(event)) throw new Error("Invalid clip export origin");
    return event.sender.id;
  }

  ipcMain.handle("clips:beginExport", async (event, name: string, size: number) => {
    const id = senderId(event);
    if (
      typeof name !== "string" ||
      !/^CubeControl-[0-9T-]+\.(?:mp4|webm)$/.test(name) ||
      !Number.isSafeInteger(size) || size <= 0 || size > MAX_CLIP_BYTES
    ) {
      throw new Error("Invalid video export");
    }
    if (opening.has(id) || jobs.has(id)) throw new Error("A clip is already being saved");
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) throw new Error("Missing studio window");

    opening.add(id);
    try {
      const extension = name.endsWith(".mp4") ? "mp4" : "webm";
      const choice = await dialog.showSaveDialog(window, {
        defaultPath: name,
        filters: [{ name: extension === "mp4" ? "MP4" : "WebM", extensions: [extension] }],
      });
      if (choice.canceled || !choice.filePath || event.sender.isDestroyed()) return false;
      const destination = choice.filePath;
      const temporary = path.join(path.dirname(destination), `.cubecontrol-${randomUUID()}.tmp`);
      const file = await open(temporary, "wx");
      const job: ExportJob = {
        file, temporary, destination, expectedBytes: size, bytes: 0, writing: false,
        onDestroyed: () => {
          jobs.delete(id);
          void discardExport(job);
        },
      };
      if (event.sender.isDestroyed()) {
        await discardExport(job);
        return false;
      }
      jobs.set(id, job);
      event.sender.once("destroyed", job.onDestroyed);
      return true;
    } finally {
      opening.delete(id);
    }
  });

  ipcMain.handle("clips:writeExport", async (event, chunk: Uint8Array) => {
    const job = jobs.get(senderId(event));
    if (
      !job || job.writing || !(chunk instanceof Uint8Array) || chunk.byteLength === 0 ||
      chunk.byteLength > MAX_CHUNK_BYTES || job.bytes + chunk.byteLength > job.expectedBytes
    ) {
      throw new Error("Invalid video export chunk");
    }
    job.writing = true;
    try {
      await job.file.writeFile(chunk);
      job.bytes += chunk.byteLength;
    } finally {
      job.writing = false;
    }
  });

  ipcMain.handle("clips:endExport", async (event, commit: boolean) => {
    const id = senderId(event);
    const job = jobs.get(id);
    if (!job || job.writing) throw new Error("Missing or busy video export");
    jobs.delete(id);
    event.sender.removeListener("destroyed", job.onDestroyed);
    try {
      if (commit === true && job.bytes !== job.expectedBytes) {
        await job.file.close();
        throw new Error("Incomplete video export");
      }
      await closeExport(job, commit === true);
      return commit === true ? job.destination : null;
    } finally {
      await rm(job.temporary, { force: true }).catch(() => undefined);
    }
  });
}
