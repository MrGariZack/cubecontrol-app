/**
 * Device-layer seam. Screens and AppStore import only from here.
 *
 * USB (single path):
 *   connect("usb") → connectUsb() → create()/AndroidMidiHost
 *   → NativeMidiTransport → CubeBabySession
 *
 * Demo:
 *   connect("demo") → FakeCubeBabyTransport → CubeBabySession
 *
 * Native MidiManager lives in `@tonehub/midi-host-android`. Do not call it
 * from UI. No BLE. iOS shares this UI; USB host is Android-only until a
 * CoreMIDI NativeMidiHost exists.
 */
export { connectDemoSession as connectDemo } from "./demoConnect";
export {
  close,
  connectUsb,
  isUsbHostAvailable,
  listPorts,
  pickCubeBabyPorts,
  probeUsbPedal,
  OTG_DEV_CLIENT,
  OTG_HELP,
  OTG_IOS,
  OTG_MISSING,
  OTG_UNPLUGGED,
} from "./usbConnect";
export {
  UsbDeviceNotFoundError,
  UsbHostUnavailableError,
  UsbPermissionDeniedError,
  type ConnectionMode,
  type DeviceConnection,
} from "./types";
