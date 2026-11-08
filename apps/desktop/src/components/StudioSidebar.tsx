import type { ReactNode } from "react";
import type { PresetSlotId } from "@tonehub/cube-baby-protocol";
import { useI18n } from "../i18n";
import { HelpButton } from "../help/Guide";
import { useReportProblem } from "../report/ReportProblemContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SlotSwitcher } from "./SlotSwitcher";

export type StudioNavId = "editor" | "library" | "device" | "tuner" | "stage" | "clips";

const navIconPaths = {
  editor: "M4 6h5m4 0h7M4 12h9m4 0h3M4 18h2m4 0h10M9 4v4m4 2v4m-7 2v4",
  tuner: "M3 12h4l3-6 4 12 3-6h4",
  library: "M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  device: "M8 3v5m8-5v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4",
  clips: "M14 10l5-3v10l-5-3m0 3H4V7h10z",
} satisfies Record<Exclude<StudioNavId, "stage">, string>;

type StudioSidebarProps = {
  readonly deviceName: string;
  readonly activeSlot: PresetSlotId;
  readonly nav: StudioNavId;
  readonly busy: boolean;
  readonly onNav: (nav: StudioNavId) => void;
  readonly onSelectSlot: (slot: PresetSlotId) => void;
  readonly onDisconnect: () => void;
  readonly hasPedal?: boolean;
  readonly recording?: boolean;
  readonly children?: ReactNode;
};

export function StudioSidebar({
  deviceName,
  activeSlot,
  nav,
  busy,
  onNav,
  onSelectSlot,
  onDisconnect,
  hasPedal = true,
  recording = false,
  children,
}: StudioSidebarProps) {
  const { t } = useI18n();
  const { openReportProblem } = useReportProblem();
  const hideChrome = nav === "stage";
  if (hideChrome) return null;

  const navItems: readonly { id: keyof typeof navIconPaths; label: string; hint: string }[] = [
    { id: "editor", label: t("nav.editor"), hint: t("nav.editorHint") },
    { id: "tuner", label: t("nav.tuner"), hint: t("nav.tunerHint") },
    { id: "library", label: t("nav.library"), hint: t("nav.libraryHint") },
    { id: "device", label: t("nav.device"), hint: t("nav.deviceHint") },
    { id: "clips", label: t("nav.clips"), hint: recording ? t("clip.state.recording") : t("nav.clipsHint") },
  ];

  return (
    <aside className="studio-sidebar">
      <div className="studio-sidebar__brand" data-guide="connection">
        <span className="studio-sidebar__logo">CubeControl</span>
        <span className="studio-sidebar__device" title={deviceName}>
          <span className="studio-sidebar__pulse" aria-hidden />
          {deviceName}
        </span>
      </div>

      {hasPedal ? (
        <section className="studio-sidebar__section" data-guide="slots">
          <p className="studio-sidebar__label">{t("nav.footswitch")}</p>
          <SlotSwitcher active={activeSlot} busy={busy} onSelect={onSelectSlot} />
          <p className="studio-sidebar__slot-meta">{t("nav.liveSlot", { slot: activeSlot })}</p>
        </section>
      ) : null}

      <nav className="studio-sidebar__nav" aria-label={t("nav.aria")}>
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              nav === item.id ? "studio-sidebar__nav-btn is-active" : "studio-sidebar__nav-btn"
            }
            onClick={() => onNav(item.id)}
            aria-current={nav === item.id ? "page" : undefined}
          >
            <svg
              className="studio-sidebar__nav-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={navIconPaths[item.id]} />
            </svg>
            <span className="studio-sidebar__nav-label">
              {item.label}
              {item.id === "clips" && recording ? <span className="studio-sidebar__recording-dot" aria-hidden="true" /> : null}
            </span>
            <span className="studio-sidebar__nav-hint">{item.hint}</span>
          </button>
        ))}
      </nav>

      {children ? <div className="studio-sidebar__panel">{children}</div> : null}

      <div className="studio-sidebar__footer">
        <div className="guide-sidebar-actions" data-guide="language">
          <LanguageSwitcher compact />
          <HelpButton />
        </div>
        <button
          type="button"
          className="studio-sidebar__report"
          data-guide="report"
          disabled={busy}
          onClick={openReportProblem}
        >
          {t("report.open")}
        </button>
        <button
          type="button"
          className="studio-sidebar__disconnect"
          disabled={busy || recording}
          onClick={onDisconnect}
        >
          {hasPedal ? t("nav.disconnect") : t("nav.leaveLibrary")}
        </button>
      </div>
    </aside>
  );
}
