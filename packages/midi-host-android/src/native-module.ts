import type { NativeMidiPortInfo } from "@tonehub/midi-transport-native";
import { NativeModule, requireOptionalNativeModule } from "expo";

export type UsbAccessResult = {
  readonly found: boolean;
  readonly granted: boolean;
};

export type MidiBytesEvent = {
  readonly portId: string;
  readonly data: number[] | Uint8Array;
  readonly receivedAtMs: number;
};

export type DeviceDetachedEvent = {
  readonly deviceId: number;
  readonly portIds?: readonly string[];
};

type MidiHostAndroidEvents = {
  onMidiBytes(event: MidiBytesEvent): void;
  onPortsChanged(): void;
  onDeviceDetached(event: DeviceDetachedEvent): void;
  onPcmFrames(event: PcmFramesEvent): void;
  onPitchSource(event: PitchSourceEvent): void;
  onIncomingShare(event: IncomingShareEvent): void;
};

export type IncomingShareEvent = {
  readonly uri: string;
};

export type PcmFramesEvent = {
  readonly sampleRate: number;
  readonly samples: readonly number[];
};

export type PitchSourceEvent = {
  readonly kind: string;
  readonly label: string;
  readonly builtInMic: boolean;
  readonly sampleRate?: number;
  readonly channels?: number;
  readonly audioSource?: string;
  readonly deviceId?: number;
  readonly deviceType?: string;
  readonly tried?: string;
};

export type PitchInputInfo = {
  readonly id: number;
  readonly kind: string;
  readonly label: string;
  readonly builtInMic: boolean;
};

export type TunerPathProbe = {
  readonly verdict: string;
  readonly cubeUsbCount: number;
  readonly hasAudioStreaming: boolean;
  readonly hasMidiStreaming: boolean;
  readonly usbAudioInputCount: number;
  readonly cubeNamedAudioCount: number;
  readonly usbDevices: readonly Record<string, unknown>[];
  readonly audioInputs: readonly Record<string, unknown>[];
};

export type MicPermissionResult = {
  readonly granted?: boolean;
  readonly status?: string;
};

export type NativePortRecord = NativeMidiPortInfo & {
  readonly deviceId?: number;
  readonly androidPortNumber?: number;
};

declare class MidiHostAndroidNativeModule extends NativeModule<MidiHostAndroidEvents> {
  isAvailable(): boolean;
  isPitchCaptureAvailable(): boolean;
  listPorts(): Promise<NativePortRecord[]>;
  requestUsbAccess(): Promise<UsbAccessResult>;
  openInput(portId: string): Promise<void>;
  closeInput(portId: string): Promise<void>;
  openOutput(portId: string): Promise<void>;
  send(portId: string, data: Uint8Array): Promise<void>;
  closeOutput(portId: string): Promise<void>;
  closeAll(): Promise<void>;
  requestMicPermission(): Promise<MicPermissionResult>;
  listPitchInputs(): Promise<PitchInputInfo[]>;
  probeTunerPath(): Promise<TunerPathProbe>;
  startPitchCapture(deviceId: number): Promise<void>;
  stopPitchCapture(): Promise<void>;
  shareJson(fileName: string, json: string): Promise<void>;
  pickFile(mimeTypes: string[]): Promise<{ uri: string; name: string } | null>;
  writeBytesFile(fileName: string, bytes: Uint8Array): Promise<string>;
  getIncomingShareUri(): Promise<string | null>;
  readTextUri(uri: string): Promise<string>;
  readBytesUri(uri: string): Promise<Uint8Array>;
}

export const nativeMidiHost = requireOptionalNativeModule<MidiHostAndroidNativeModule>(
  "MidiHostAndroid",
);

export function isAndroidMidiHostAvailable(): boolean {
  try {
    return nativeMidiHost?.isAvailable() === true;
  } catch {
    return false;
  }
}

export function midiBytesFromNative(data: number[] | Uint8Array): Uint8Array {
  if (data instanceof Uint8Array) return data;
  return Uint8Array.from(data.map((byte) => byte & 0xff));
}
