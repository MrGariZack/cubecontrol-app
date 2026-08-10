import type { LiveParamName, PresetSlotId } from "@tonehub/cube-baby-protocol";

export type LiveParamsSnapshot = Record<LiveParamName, number>;

export type BankSlotSnapshot = {
  readonly slot: PresetSlotId;
} & LiveParamsSnapshot;

export type BankSnapshot = {
  readonly slots: readonly [BankSlotSnapshot, BankSlotSnapshot, BankSlotSnapshot];
};

export type DesktopConnectionInfo = {
  readonly deviceName: string;
  readonly inputPortId: string;
  readonly outputPortId: string;
  readonly bankSummary: string;
  readonly activeSlot: PresetSlotId;
  readonly liveParams: LiveParamsSnapshot;
  readonly bank: BankSnapshot;
};
