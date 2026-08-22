import type {
  NativeMidiHost,
  NativeMidiInputHandle,
  NativeMidiOutputHandle,
  NativeMidiPortInfo,
} from "@tonehub/midi-transport-native";
import {
  isAndroidMidiHostAvailable,
  midiBytesFromNative,
  nativeMidiHost,
  type DeviceDetachedEvent,
} from "./native-module";

const DEV_CLIENT_HINT =
  "USB-OTG requiere un development build (Expo dev client), no Expo Go. Compila con `pnpm --filter @tonehub/mobile android:device`.";

function requireNative() {
  if (nativeMidiHost == null) {
    throw new Error(DEV_CLIENT_HINT);
  }
  return nativeMidiHost;
}

/**
 * `NativeMidiHost` over Android `MidiManager`. Delivers raw MIDI byte chunks
 * (SysEx may be fragmented) — `@tonehub/midi-core` reassembles them.
 */
export class AndroidMidiHost implements NativeMidiHost {
  readonly #inputCallbacks = new Map<
    string,
    (data: Uint8Array, receivedAtMs: number) => void
  >();
  readonly #portListeners = new Set<() => void>();
  readonly #detachListeners = new Set<(event: DeviceDetachedEvent) => void>();
  readonly #openedInputs = new Set<string>();
  readonly #openedOutputs = new Set<string>();
  #unsubBytes: (() => void) | undefined;
  #unsubPorts: (() => void) | undefined;
  #unsubDetach: (() => void) | undefined;
  #listening = false;

  static isAvailable(): boolean {
    return isAndroidMidiHostAvailable();
  }

  async listPorts(): Promise<readonly NativeMidiPortInfo[]> {
    const native = requireNative();
    const ports = await native.listPorts();
    return ports.map((port) => ({
      id: port.id,
      direction: port.direction,
      name: port.name,
      ...(port.manufacturer ? { manufacturer: port.manufacturer } : {}),
      ...(port.vendorId === undefined ? {} : { vendorId: port.vendorId }),
      ...(port.productId === undefined ? {} : { productId: port.productId }),
      state: port.state ?? "connected",
    }));
  }

  async requestUsbAccess(): Promise<{ found: boolean; granted: boolean }> {
    return requireNative().requestUsbAccess();
  }

  async openInput(
    portId: string,
    onBytes: (data: Uint8Array, receivedAtMs: number) => void,
  ): Promise<NativeMidiInputHandle> {
    const native = requireNative();
    this.#ensureListeners();
    this.#inputCallbacks.set(portId, onBytes);
    try {
      await native.openInput(portId);
      this.#openedInputs.add(portId);
    } catch (error) {
      this.#inputCallbacks.delete(portId);
      throw error;
    }
    return {
      close: async () => {
        this.#inputCallbacks.delete(portId);
        this.#openedInputs.delete(portId);
        await native.closeInput(portId);
      },
    };
  }

  async openOutput(portId: string): Promise<NativeMidiOutputHandle> {
    const native = requireNative();
    this.#ensureListeners();
    await native.openOutput(portId);
    this.#openedOutputs.add(portId);
    return {
      send: async (data) => {
        await native.send(portId, data);
      },
      close: async () => {
        this.#openedOutputs.delete(portId);
        await native.closeOutput(portId);
      },
    };
  }

  onPortsChanged(listener: () => void): () => void {
    this.#ensureListeners();
    this.#portListeners.add(listener);
    return () => {
      this.#portListeners.delete(listener);
    };
  }

  onDeviceDetached(listener: (event: DeviceDetachedEvent) => void): () => void {
    this.#ensureListeners();
    this.#detachListeners.add(listener);
    return () => {
      this.#detachListeners.delete(listener);
    };
  }

  async dispose(): Promise<void> {
    const native = nativeMidiHost;
    const inputs = [...this.#openedInputs];
    const outputs = [...this.#openedOutputs];
    this.#openedInputs.clear();
    this.#openedOutputs.clear();
    this.#inputCallbacks.clear();
    this.#portListeners.clear();
    this.#detachListeners.clear();
    this.#unsubBytes?.();
    this.#unsubPorts?.();
    this.#unsubDetach?.();
    this.#unsubBytes = undefined;
    this.#unsubPorts = undefined;
    this.#unsubDetach = undefined;
    this.#listening = false;
    if (native == null) return;
    for (const portId of inputs) {
      await native.closeInput(portId).catch(() => undefined);
    }
    for (const portId of outputs) {
      await native.closeOutput(portId).catch(() => undefined);
    }
  }

  #ensureListeners(): void {
    if (this.#listening || nativeMidiHost == null) return;
    this.#listening = true;
    const bytesSub = nativeMidiHost.addListener("onMidiBytes", (event) => {
      const callback = this.#inputCallbacks.get(event.portId);
      callback?.(midiBytesFromNative(event.data), event.receivedAtMs);
    });
    const portsSub = nativeMidiHost.addListener("onPortsChanged", () => {
      for (const listener of this.#portListeners) listener();
    });
    const detachSub = nativeMidiHost.addListener("onDeviceDetached", (event) => {
      for (const listener of this.#detachListeners) listener(event);
      for (const listener of this.#portListeners) listener();
    });
    this.#unsubBytes = () => bytesSub.remove();
    this.#unsubPorts = () => portsSub.remove();
    this.#unsubDetach = () => detachSub.remove();
  }
}

export { isAndroidMidiHostAvailable };
