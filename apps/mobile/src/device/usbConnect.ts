/**
 * USB-OTG seam for `@tonehub/midi-host-android` (MidiManager plugin).
 *
 * Public JS API: `listPorts()`, `connectUsb()`, `close()`, `isUsbHostAvailable()`.
 * Native: `create()` → `AndroidMidiHost` implements `NativeMidiHost` (raw byte chunks).
 * CUBE Baby USB VID 0x301A / PID 0x5555. No BLE.
 */
import { CubeBabySession } from "@tonehub/cube-baby-api";
import { classifyCubeBabyPort, type MidiPort } from "@tonehub/midi-core";
import { create as createAndroidMidiHost, isAndroidMidiHostAvailable } from "@tonehub/midi-host-android";
import { NativeMidiTransport } from "@tonehub/midi-transport-native";
import { Platform } from "react-native";
import { bankSummary, slotToLive } from "./live";
import {
  UsbDeviceNotFoundError,
  UsbHostUnavailableError,
  UsbPermissionDeniedError,
  type DeviceConnection,
} from "./types";

const IDENTIFY_TIMEOUT_MS = 3_000;

export const OTG_HELP =
  "El teléfono es el host USB. Hace falta un cable OTG con datos (no solo carga). Cierra CubeSuite u otra app MIDI y acepta el permiso USB.";

export const OTG_MISSING =
  "No se encontró CUBE Baby por USB-OTG. Usa un cable OTG con datos (no solo carga), acepta el permiso USB del teléfono y cierra CubeSuite u otra app MIDI.";

export const OTG_UNPLUGGED =
  "El CUBE Baby se desconectó. Revisa el cable OTG de datos y vuelve a conectar. Cierra CubeSuite si estaba abierto.";

export const OTG_DEV_CLIENT =
  "USB-OTG requiere un development build (Expo dev client), no Expo Go. Compila con `pnpm --filter @tonehub/mobile android:device`.";

export const OTG_IOS =
  "En iPhone el USB host requiere un adaptador (USB-C OTG o Camera Connection Kit) y un host CoreMIDI. En v1 usa Probar demo. Sin Bluetooth.";

let activeClose: (() => Promise<void>) | null = null;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isUsbHostAvailable(): boolean {
  try {
    return isAndroidMidiHostAvailable();
  } catch {
    return false;
  }
}

export function pickCubeBabyPorts(
  ports: readonly MidiPort[],
): { input: MidiPort; output: MidiPort } | null {
  const rank = (port: MidiPort): number => {
    const match = classifyCubeBabyPort(port);
    if (match === "confirmed") return 2;
    if (match === "candidate") return 1;
    return 0;
  };
  const rankedIn = ports
    .filter((port) => port.direction === "input")
    .slice()
    .sort((a, b) => rank(b) - rank(a));
  const rankedOut = ports
    .filter((port) => port.direction === "output")
    .slice()
    .sort((a, b) => rank(b) - rank(a));
  const input = rankedIn.find((port) => rank(port) > 0) ?? (rankedIn.length === 1 ? rankedIn[0] : undefined);
  const output = rankedOut.find((port) => rank(port) > 0) ?? (rankedOut.length === 1 ? rankedOut[0] : undefined);
  if (input === undefined || output === undefined) return null;
  return { input, output };
}

/** True when a CUBE Baby MIDI pair is already enumerated (no open session). */
export async function probeUsbPedal(): Promise<boolean> {
  if (!isUsbHostAvailable()) return false;
  const ports = await listPorts();
  return pickCubeBabyPorts(ports) !== null;
}

export async function listPorts(): Promise<readonly MidiPort[]> {
  if (!isUsbHostAvailable()) return [];
  const host = createAndroidMidiHost();
  try {
    const ports = await host.listPorts();
    return ports.map((port) => ({
      id: port.id,
      direction: port.direction,
      name: port.name,
      state: port.state ?? "connected",
      ...(port.manufacturer ? { manufacturer: port.manufacturer } : {}),
      ...(port.vendorId === undefined ? {} : { vendorId: port.vendorId }),
      ...(port.productId === undefined ? {} : { productId: port.productId }),
    }));
  } catch {
    return [];
  } finally {
    await host.dispose().catch(() => undefined);
  }
}

export async function close(): Promise<void> {
  const fn = activeClose;
  activeClose = null;
  if (fn) await fn().catch(() => undefined);
}

export async function connectUsb(): Promise<DeviceConnection> {
  await close();

  if (!isUsbHostAvailable()) {
    throw new UsbHostUnavailableError(Platform.OS === "ios" ? OTG_IOS : OTG_DEV_CLIENT);
  }

  const host = createAndroidMidiHost();
  const transport = new NativeMidiTransport(host);
  const detachListeners = new Set<() => void>();
  let unsubDetach: (() => void) | undefined;
  let session: CubeBabySession | undefined;

  const teardown = async () => {
    unsubDetach?.();
    unsubDetach = undefined;
    detachListeners.clear();
    if (activeClose === teardown) activeClose = null;
    await session?.close().catch(() => undefined);
    session = undefined;
    try {
      await transport.dispose();
    } catch {
      await host.dispose().catch(() => undefined);
    }
  };

  try {
    const access = await host.requestUsbAccess();
    if (access.found && !access.granted) {
      throw new UsbPermissionDeniedError(
        "Permiso USB denegado. Acepta el diálogo USB-OTG, usa un cable con datos (no solo carga) y cierra CubeSuite.",
      );
    }

    let pair: { input: MidiPort; output: MidiPort } | null = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const ports = await transport.listPorts();
      pair = pickCubeBabyPorts(ports);
      if (pair) break;
      await delay(350);
    }
    if (pair === null) {
      throw new UsbDeviceNotFoundError(OTG_MISSING);
    }

    session = await CubeBabySession.open(transport, {
      inputPortId: pair.input.id,
      outputPortId: pair.output.id,
    });

    const identity = await session.identify({ timeoutMs: IDENTIFY_TIMEOUT_MS });
    const bank = await session.readPresetBank({ timeoutMs: IDENTIFY_TIMEOUT_MS });
    const live = slotToLive(bank.slots[0]);

    unsubDetach = host.onDeviceDetached(() => {
      const listeners = [...detachListeners];
      void teardown().then(() => {
        for (const listener of listeners) listener();
      });
    });
    activeClose = teardown;

    return {
      mode: "usb",
      session,
      deviceName: identity.reportedName,
      inputPortId: pair.input.id,
      outputPortId: pair.output.id,
      bankSummary: bankSummary(bank),
      live,
      bank,
      slot: "A",
      close: teardown,
      onDetached: (listener) => {
        detachListeners.add(listener);
        return () => {
          detachListeners.delete(listener);
        };
      },
    };
  } catch (error) {
    await teardown();
    if (
      error instanceof UsbHostUnavailableError ||
      error instanceof UsbDeviceNotFoundError ||
      error instanceof UsbPermissionDeniedError
    ) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new UsbDeviceNotFoundError(
      `El CUBE Baby no respondió por USB-MIDI. Cierra CubeSuite u otra app MIDI y usa un cable OTG con datos. (${message})`,
    );
  }
}
