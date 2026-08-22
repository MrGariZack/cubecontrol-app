import { readUriBytes, readUriText } from "../device/files";
import { isZipBytes, parsePackZip, type ParsedPack } from "./packFormat";
import { parseSharePayload, type SharePayload } from "./shareFormat";

export type IncomingCubeFile =
  | { readonly kind: "share"; readonly payload: SharePayload }
  | { readonly kind: "pack"; readonly pack: ParsedPack };

function utf8FromBytes(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

export async function loadIncomingCubeFile(uri: string): Promise<IncomingCubeFile> {
  const bytes = await readUriBytes(uri);
  if (isZipBytes(bytes)) {
    return { kind: "pack", pack: await parsePackZip(bytes) };
  }
  let text: string;
  try {
    text = utf8FromBytes(bytes);
  } catch {
    text = await readUriText(uri);
  }
  const payload = parseSharePayload(text);
  if (!payload) {
    throw new Error("Este archivo no es un tono, canción, show o pack ZIP de CubeControl.");
  }
  return { kind: "share", payload };
}

export function isShareCandidate(url: string): boolean {
  const lower = url.trim().toLowerCase();
  if (!lower) return false;
  if (lower.startsWith("content:") || lower.startsWith("file:") || lower === "inline:json") {
    return true;
  }
  return (
    lower.includes(".json") ||
    lower.includes(".cubecontrol") ||
    lower.includes(".zip")
  );
}
