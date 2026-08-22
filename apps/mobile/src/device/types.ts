import type { CubeBabySession } from "@tonehub/cube-baby-api";
import type { CubeBabyPresetBank, PresetSlotId } from "@tonehub/cube-baby-protocol";
import type { LiveParamsSnapshot } from "../library/types";

export type ConnectionMode = "usb" | "demo";

export type DeviceConnection = {
  readonly mode: ConnectionMode;
  readonly session: CubeBabySession;
  readonly deviceName: string;
  readonly inputPortId: string;
  readonly outputPortId: string;
  readonly bankSummary: string;
  readonly live: LiveParamsSnapshot;
  readonly bank: CubeBabyPresetBank;
  readonly slot: PresetSlotId;
  close: () => Promise<void>;
  /** USB unplug (no-op in demo). */
  onDetached: (listener: () => void) => () => void;
};

export class UsbHostUnavailableError extends Error {
  readonly code = "USB_HOST_UNAVAILABLE" as const;
  constructor(message: string) {
    super(message);
    this.name = "UsbHostUnavailableError";
  }
}

export class UsbDeviceNotFoundError extends Error {
  readonly code = "USB_DEVICE_NOT_FOUND" as const;
  constructor(message: string) {
    super(message);
    this.name = "UsbDeviceNotFoundError";
  }
}

export class UsbPermissionDeniedError extends Error {
  readonly code = "USB_PERMISSION_DENIED" as const;
  constructor(message: string) {
    super(message);
    this.name = "UsbPermissionDeniedError";
  }
}
