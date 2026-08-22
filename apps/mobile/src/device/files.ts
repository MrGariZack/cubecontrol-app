import { Alert, Share } from "react-native";
import { nativeMidiHost } from "@tonehub/midi-host-android";

export class FilesNativeMissingError extends Error {
  readonly code = "FILES_NATIVE_MISSING" as const;
  constructor() {
    super(
      "Este APK no incluye el selector de archivos. Recompila el APK (pnpm android:device) para exportar bank o cargar IR.",
    );
    this.name = "FilesNativeMissingError";
  }
}

export function alertFilesError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  Alert.alert("CubeControl", message);
}

export type PickedFile = {
  readonly uri: string;
  readonly name: string;
};

type NativeFiles = {
  pickFile?: (mimeTypes: string[]) => Promise<PickedFile | null>;
  readBytesUri?: (path: string) => Promise<Uint8Array | number[]>;
  readTextUri?: (path: string) => Promise<string>;
  writeBytesFile?: (fileName: string, bytes: Uint8Array) => Promise<string>;
  shareJson?: (name: string, body: string) => Promise<void>;
};

function host(): NativeFiles | null {
  return nativeMidiHost as NativeFiles | null;
}

function asFilesError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  if (
    message.includes("native module") ||
    message.includes("ExpoDocumentPicker") ||
    message.includes("ExponentFileSystem") ||
    message.includes("ExpoSharing")
  ) {
    throw new FilesNativeMissingError();
  }
  throw err instanceof Error ? err : new Error(message);
}

async function pickWithNative(mimeTypes: string[], fallbackName: string): Promise<PickedFile | null> {
  const pick = host()?.pickFile;
  if (!pick) throw new FilesNativeMissingError();
  try {
    const result = await pick(mimeTypes);
    if (!result) return null;
    return { uri: result.uri, name: result.name || fallbackName };
  } catch (err) {
    asFilesError(err);
  }
}

export async function pickJsonFile(): Promise<PickedFile | null> {
  return pickWithNative(["application/json", "text/plain", "*/*"], "bank.json");
}

export async function pickWavFile(): Promise<PickedFile | null> {
  return pickWithNative(["audio/wav", "audio/x-wav", "audio/*", "*/*"], "ir.wav");
}

export async function pickShareFile(): Promise<PickedFile | null> {
  return pickWithNative(["*/*"], "share.cubecontrol.json");
}

export async function readUriText(uri: string): Promise<string> {
  const readText = host()?.readTextUri;
  if (readText) {
    try {
      return await readText(uri);
    } catch {
      // Fall through.
    }
  }
  const bytes = await readUriBytes(uri);
  return new TextDecoder("utf-8").decode(bytes);
}

export async function readUriBytes(uri: string): Promise<Uint8Array> {
  const readBytes = host()?.readBytesUri;
  if (!readBytes) throw new FilesNativeMissingError();
  try {
    const data = await readBytes(uri);
    return data instanceof Uint8Array ? data : Uint8Array.from(data);
  } catch (err) {
    asFilesError(err);
  }
}

export async function writeLibraryWav(fileName: string, bytes: Uint8Array): Promise<string> {
  const write = host()?.writeBytesFile;
  if (!write) throw new FilesNativeMissingError();
  try {
    return await write(fileName, bytes);
  } catch (err) {
    asFilesError(err);
  }
}

export async function shareJsonFile(fileName: string, json: string): Promise<void> {
  const shareJson = host()?.shareJson;
  if (shareJson) {
    await shareJson(fileName, json);
    return;
  }
  const result = await Share.share({
    title: fileName,
    message: json,
  });
  if (result.action === Share.dismissedAction) return;
}
