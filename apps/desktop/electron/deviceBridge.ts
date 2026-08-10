import { CubeBabySession } from "@tonehub/cube-baby-api";
import { classifyCubeBabyPort, type MidiPort } from "@tonehub/midi-core";
import { NodeMidiTransport } from "@tonehub/midi-transport-node";

export type DesktopConnectionInfo = {
  readonly deviceName: string;
  readonly inputPortId: string;
  readonly outputPortId: string;
  readonly bankSummary: string;
};

export type DesktopPortInfo = {
  readonly id: string;
  readonly direction: "input" | "output";
  readonly name: string;
  readonly cubeBabyMatch: ReturnType<typeof classifyCubeBabyPort>;
  readonly vendorId: number | null;
  readonly productId: number | null;
};

/**
 * Main-process device session over the proven Node USB-MIDI transport.
 */
export class DeviceBridge {
  #transport: NodeMidiTransport | undefined;
  #session: CubeBabySession | undefined;
  #ports: { inputPortId: string; outputPortId: string } | undefined;

  async listPorts(): Promise<DesktopPortInfo[]> {
    const transport = await this.#ensureTransport();
    const ports = await transport.listPorts();
    return ports.map((port) => this.#toPortInfo(port));
  }

  async connect(): Promise<DesktopConnectionInfo> {
    await this.disconnect();
    const transport = await this.#ensureTransport();
    const ports = await transport.listPorts();
    const input = ports.find(
      (port) => port.direction === "input" && classifyCubeBabyPort(port) === "confirmed",
    );
    const output = ports.find(
      (port) => port.direction === "output" && classifyCubeBabyPort(port) === "confirmed",
    );
    if (input === undefined || output === undefined) {
      throw new Error(
        "No se encontró CUBE Baby USB (VID/PID confirmado). Cierra CubeSuite y reconecta el cable.",
      );
    }

    const session = await CubeBabySession.open(transport, {
      inputPortId: input.id,
      outputPortId: output.id,
    });
    try {
      const identity = await session.identify({ timeoutMs: 2_000 });
      const bank = await session.readPresetBank({ timeoutMs: 2_000 });
      const slotA = bank.slots[0];
      this.#session = session;
      this.#ports = { inputPortId: input.id, outputPortId: output.id };
      return {
        deviceName: identity.reportedName,
        inputPortId: input.id,
        outputPortId: output.id,
        bankSummary: `A gain ${slotA.gain} · cab ${slotA.cabinet}`,
      };
    } catch (error) {
      await session.close();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    const session = this.#session;
    this.#session = undefined;
    this.#ports = undefined;
    if (session !== undefined) await session.close();
  }

  async dispose(): Promise<void> {
    await this.disconnect();
    const transport = this.#transport;
    this.#transport = undefined;
    if (transport !== undefined) await transport.dispose();
  }

  get connected(): boolean {
    return this.#session !== undefined && this.#session.connected;
  }

  get ports(): { inputPortId: string; outputPortId: string } | undefined {
    return this.#ports;
  }

  async #ensureTransport(): Promise<NodeMidiTransport> {
    if (this.#transport === undefined) {
      this.#transport = new NodeMidiTransport();
    }
    return this.#transport;
  }

  #toPortInfo(port: MidiPort): DesktopPortInfo {
    return {
      id: port.id,
      direction: port.direction,
      name: port.name,
      cubeBabyMatch: classifyCubeBabyPort(port),
      vendorId: port.vendorId ?? null,
      productId: port.productId ?? null,
    };
  }
}
