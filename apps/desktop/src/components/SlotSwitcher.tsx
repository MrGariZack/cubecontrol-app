import type { PresetSlotId } from "@tonehub/cube-baby-protocol";

const SLOTS: readonly PresetSlotId[] = ["A", "B", "C"];

type SlotSwitcherProps = {
  readonly active: PresetSlotId;
  readonly busy: boolean;
  readonly onSelect: (slot: PresetSlotId) => void;
};

export function SlotSwitcher({ active, busy, onSelect }: SlotSwitcherProps) {
  return (
    <div className="slot-switcher" role="group" aria-label="Preset slots">
      {SLOTS.map((slot) => (
        <button
          key={slot}
          type="button"
          className={`slot-switcher__btn${active === slot ? " slot-switcher__btn--active" : ""}`}
          disabled={busy}
          onClick={() => onSelect(slot)}
        >
          {slot}
        </button>
      ))}
    </div>
  );
}
