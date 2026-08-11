import type { ReactNode } from "react";
import type { PresetSlotId } from "@tonehub/cube-baby-protocol";
import { SlotSwitcher } from "./SlotSwitcher";

export type StudioNavId = "editor" | "library" | "device" | "tuner" | "stage";

type StudioSidebarProps = {
  readonly deviceName: string;
  readonly activeSlot: PresetSlotId;
  readonly nav: StudioNavId;
  readonly busy: boolean;
  readonly onNav: (nav: StudioNavId) => void;
  readonly onSelectSlot: (slot: PresetSlotId) => void;
  readonly onDisconnect: () => void;
  readonly children?: ReactNode;
};

const NAV_ITEMS: readonly { id: StudioNavId; label: string; hint: string }[] = [
  { id: "editor", label: "Editor", hint: "Pedal y knobs" },
  { id: "tuner", label: "Tuner", hint: "Afinar" },
  { id: "library", label: "Library", hint: "Tonos · shows" },
  { id: "device", label: "Device", hint: "Bank e IR" },
];

export function StudioSidebar({
  deviceName,
  activeSlot,
  nav,
  busy,
  onNav,
  onSelectSlot,
  onDisconnect,
  children,
}: StudioSidebarProps) {
  const hideChrome = nav === "stage";
  if (hideChrome) return null;

  return (
    <aside className="studio-sidebar">
      <div className="studio-sidebar__brand">
        <span className="studio-sidebar__logo">CubeControl</span>
        <span className="studio-sidebar__device" title={deviceName}>
          <span className="studio-sidebar__pulse" aria-hidden />
          {deviceName}
        </span>
      </div>

      <section className="studio-sidebar__section">
        <p className="studio-sidebar__label">Footswitch</p>
        <SlotSwitcher active={activeSlot} busy={busy} onSelect={onSelectSlot} />
        <p className="studio-sidebar__slot-meta">Live · slot {activeSlot}</p>
      </section>

      <nav className="studio-sidebar__nav" aria-label="Navegación estudio">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              nav === item.id ? "studio-sidebar__nav-btn is-active" : "studio-sidebar__nav-btn"
            }
            onClick={() => onNav(item.id)}
          >
            <span className="studio-sidebar__nav-label">{item.label}</span>
            <span className="studio-sidebar__nav-hint">{item.hint}</span>
          </button>
        ))}
      </nav>

      {children ? <div className="studio-sidebar__panel">{children}</div> : null}

      <div className="studio-sidebar__footer">
        <button
          type="button"
          className="studio-sidebar__disconnect"
          disabled={busy}
          onClick={onDisconnect}
        >
          Disconnect
        </button>
      </div>
    </aside>
  );
}
