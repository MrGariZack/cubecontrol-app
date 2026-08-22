import { CubeBabySession } from "@tonehub/cube-baby-api";
import { FAKE_INPUT, FAKE_OUTPUT, FakeCubeBabyTransport } from "@tonehub/cube-baby-api/testing";
import { bankSummary, slotToLive } from "./live";
import type { DeviceConnection } from "./types";

/**
 * Offline path: FakeCubeBabyTransport so Live / Set / Escenario work without a pedal.
 * USB-OTG uses `connectUsb()` instead.
 */
export async function connectDemoSession(): Promise<DeviceConnection> {
  const transport = new FakeCubeBabyTransport();
  const session = await CubeBabySession.open(transport, {
    inputPortId: FAKE_INPUT.id,
    outputPortId: FAKE_OUTPUT.id,
  });

  try {
    const identity = await session.identify({ timeoutMs: 500 });
    const bank = await session.readPresetBank({ timeoutMs: 500 });
    const live = slotToLive(bank.slots[0]);

    return {
      mode: "demo",
      session,
      deviceName: identity.reportedName,
      inputPortId: FAKE_INPUT.id,
      outputPortId: FAKE_OUTPUT.id,
      bankSummary: bankSummary(bank),
      live,
      bank,
      slot: "A",
      close: async () => {
        await session.close();
        await transport.dispose();
      },
      onDetached: () => () => undefined,
    };
  } catch (error) {
    await session.close();
    await transport.dispose();
    throw error;
  }
}
