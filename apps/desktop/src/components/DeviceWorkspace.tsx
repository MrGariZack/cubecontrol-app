import { clearSafetyAcceptance } from "../safety/disclaimer";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { useI18n } from "../i18n";
import { MicDistanceRail } from "./cube-baby/MicDistanceRail";
import "./device-workspace.css";

/** Pedal Cabinet 1..8 → ROM IR slots 0..7 (Cab 8 = upload). */
const IR_CABINETS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

type DeviceWorkspaceProps = {
  readonly busy: boolean;
  readonly irCabinet: number;
  readonly irDistance: number;
  readonly onIrCabinetChange: (cabinet: number) => void;
  readonly onIrDistanceChange: (distance: number) => void;
  readonly onLoadIr: () => void;
  readonly onExportBank: () => void;
  readonly onImportBank: () => void;
  readonly onCompare: () => void;
};

/**
 * Full-canvas Device tools (Bank + IR) — same comfort shell as Library, not the sidebar rail.
 */
export function DeviceWorkspace({
  busy,
  irCabinet,
  irDistance,
  onIrCabinetChange,
  onIrDistanceChange,
  onLoadIr,
  onExportBank,
  onImportBank,
  onCompare,
}: DeviceWorkspaceProps) {
  const { t } = useI18n();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  return (
    <div className="dev-ws" aria-label={t("device.aria")}>
      <header className="dev-ws__top">
        <div>
          <h1 className="dev-ws__title">{t("nav.device")}</h1>
          <p className="dev-ws__subtitle">{t("device.subtitle")}</p>
        </div>
      </header>

      <div className="dev-ws__grid">
        <section className="dev-ws__card" aria-labelledby="dev-bank-heading">
          <h2 id="dev-bank-heading" className="dev-ws__card-title">
            Bank
          </h2>
          <p className="dev-ws__card-copy">{t("device.bank.copy")}</p>
          <div className="dev-ws__actions">
            <button
              type="button"
              className="dev-ws__btn dev-ws__btn--primary"
              disabled={busy}
              onClick={onExportBank}
            >
              {t("device.bank.export")}
            </button>
            <button
              type="button"
              className="dev-ws__btn"
              disabled={busy}
              onClick={onImportBank}
            >
              {t("device.bank.import")}
            </button>
          </div>
        </section>

        <section className="dev-ws__card dev-ws__card--ir" aria-labelledby="dev-ir-heading">
          <h2 id="dev-ir-heading" className="dev-ws__card-title">
            {t("device.ir.title")}
          </h2>
          <p className="dev-ws__card-copy">{t("device.ir.copy")}</p>

          <label className="dev-ws__field">
            <span>{t("device.ir.cabinet")}</span>
            <select
              value={irCabinet}
              disabled={busy}
              aria-label={t("device.ir.cabinetAria")}
              onChange={(event) => onIrCabinetChange(Number(event.target.value))}
            >
              {IR_CABINETS.map((cabinet) => (
                <option key={cabinet} value={cabinet}>
                  Cab {cabinet}
                  {cabinet === 8 ? t("device.ir.safe") : t("device.ir.risk")}
                </option>
              ))}
            </select>
          </label>

          <div className="dev-ws__dist">
            <MicDistanceRail
              value={irDistance}
              onChange={onIrDistanceChange}
              disabled={busy}
            />
          </div>

          <div className="dev-ws__actions">
            <button
              type="button"
              className="dev-ws__btn dev-ws__btn--primary dev-ws__btn--lg"
              disabled={busy}
              onClick={onLoadIr}
            >
              {t("device.ir.load")}
            </button>
          </div>
        </section>

        <section className="dev-ws__card" aria-labelledby="dev-levels-heading">
          <h2 id="dev-levels-heading" className="dev-ws__card-title">
            {t("device.levels.title")}
          </h2>
          <p className="dev-ws__card-copy">{t("device.levels.copy")}</p>
          <div className="dev-ws__actions">
            <button
              type="button"
              className="dev-ws__btn dev-ws__btn--primary"
              disabled={busy}
              onClick={onCompare}
            >
              {t("device.levels.compare")}
            </button>
          </div>
        </section>

        <section className="dev-ws__card dev-ws__card--warn" aria-labelledby="dev-safety-heading">
          <h2 id="dev-safety-heading" className="dev-ws__card-title">
            {t("device.safety.title")}
          </h2>
          <ul className="dev-ws__checklist">
            <li>{t("device.safety.live")}</li>
            <li>{t("device.safety.bank")}</li>
            <li>{t("device.safety.ir")}</li>
          </ul>
          <p className="dev-ws__card-copy">{t("device.safety.copy")}</p>
          <div className="dev-ws__actions">
            <button
              type="button"
              className="dev-ws__btn"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  const ok = await confirm({
                    title: t("device.safety.resetTitle"),
                    body: t("device.safety.resetBody"),
                    confirmLabel: t("common.reset"),
                  });
                  if (!ok) return;
                  clearSafetyAcceptance();
                })();
              }}
            >
              {t("device.safety.resetCta")}
            </button>
          </div>
        </section>
      </div>
      {confirmDialog}
    </div>
  );
}
