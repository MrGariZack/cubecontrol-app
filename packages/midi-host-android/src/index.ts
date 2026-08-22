import { AndroidMidiHost, isAndroidMidiHostAvailable } from "./android-midi-host";

export { AndroidMidiHost, isAndroidMidiHostAvailable };
export { midiBytesFromNative, nativeMidiHost } from "./native-module";
export type {
  DeviceDetachedEvent,
  MidiBytesEvent,
  MicPermissionResult,
  NativePortRecord,
  PcmFramesEvent,
  PitchInputInfo,
  PitchSourceEvent,
  TunerPathProbe,
  UsbAccessResult,
} from "./native-module";

/** Factory used by the mobile device seam (`create` / `AndroidMidiHost`). */
export function create(): AndroidMidiHost {
  return new AndroidMidiHost();
}
