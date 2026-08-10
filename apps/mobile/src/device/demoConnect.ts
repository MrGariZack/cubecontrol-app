import { CubeBabySession } from "@tonehub/cube-baby-api";
import {
  FAKE_INPUT,
  FAKE_OUTPUT,
  FakeCubeBabyTransport,
} from "@tonehub/cube-baby-api/testing";

export type DemoConnection = {
  readonly mode: "demo";
  readonly deviceName: string;
  readonly inputPortId: string;
  readonly outputPortId: string;
  readonly bankSummary: string;
  close: () => Promise<void>;
};

/**
 * Lab path until Android/iOS NativeMidiHost exists.
 * Uses the core fake device so UI can exercise CubeBabySession offline.
 */
export async function connectDemoSession(): Promise<DemoConnection> {
  const transport = new FakeCubeBabyTransport();
  const session = await CubeBabySession.open(transport, {
    inputPortId: FAKE_INPUT.id,
    outputPortId: FAKE_OUTPUT.id,
  });

  try {
    const identity = await session.identify({ timeoutMs: 500 });
    const bank = await session.readPresetBank({ timeoutMs: 500 });
    const slotA = bank.slots[0];

    return {
      mode: "demo",
      deviceName: identity.reportedName,
      inputPortId: FAKE_INPUT.id,
      outputPortId: FAKE_OUTPUT.id,
      bankSummary: `A gain ${slotA.gain} · cab ${slotA.cabinet}`,
      close: async () => {
        await session.close();
        await transport.dispose();
      },
    };
  } catch (error) {
    await session.close();
    await transport.dispose();
    throw error;
  }
}
