import type { PresetSlotId } from "@tonehub/cube-baby-protocol";
import type { MatchVolumesSource } from "../../electron/deviceBridge";
import type { SlotDiffRow } from "../../electron/library/types";
import { useI18n } from "../i18n";
import type { LiveParamsSnapshot } from "../types/device";

const SLOT_PAIRS: readonly { from: PresetSlotId; to: PresetSlotId }[] = [
  { from: "A", to: "B" },
  { from: "A", to: "C" },
  { from: "B", to: "A" },
  { from: "B", to: "C" },
  { from: "C", to: "A" },
  { from: "C", to: "B" },
];

type ComparePanelProps = {
  readonly open: boolean;
  readonly rows: readonly SlotDiffRow[];
  readonly busy: boolean;
  readonly liveParams: LiveParamsSnapshot;
  readonly liveDirty: boolean;
  readonly activeSlot: PresetSlotId;
  readonly onClose: () => void;
  readonly onMatchVolumes: (source: MatchVolumesSource) => void;
  readonly onCopySlot: (from: PresetSlotId, to: PresetSlotId) => void;
};

export function ComparePanel({
  open,
  rows,
  busy,
  liveParams,
  liveDirty,
  activeSlot,
  onClose,
  onMatchVolumes,
  onCopySlot,
}: ComparePanelProps) {
  const { t } = useI18n();
  if (!open) return null;

  const volumeRow = rows.find((row) => row.param === "volume");
  const otherRows = rows.filter((row) => row.param !== "volume");
  const ordered = volumeRow === undefined ? rows : [volumeRow, ...otherRows];
  const diffs = rows.filter((row) => row.differs);
  const volumeDiffers = volumeRow?.differs ?? false;
  const liveVolume = liveParams.volume;

  return (
    <div className="compare-panel" role="dialog" aria-label={t("compare.aria")}>
      <div className="compare-panel__head">
        <h2 className="compare-panel__title">Compare A / B / C</h2>
        <button type="button" className="compare-panel__close" onClick={onClose} disabled={busy}>
          {t("compare.close")}
        </button>
      </div>

      <p className="compare-panel__hint">{t("compare.explain")}</p>

      {liveDirty ? (
        <p className="compare-panel__dirty" role="status">
          {t("compare.dirty", { slot: activeSlot })}
        </p>
      ) : null}

      {volumeRow ? (
        <section
          className={
            volumeDiffers ? "compare-panel__volume is-warn" : "compare-panel__volume is-ok"
          }
        >
          <div className="compare-panel__volume-head">
            <strong>Volumen</strong>
            <span>{volumeDiffers ? t("compare.volDiff") : t("compare.volSame")}</span>
          </div>
          <div className="compare-panel__volume-meters" aria-label={t("compare.volumes")}>
            {(
              [
                ["A", volumeRow.a],
                ["B", volumeRow.b],
                ["C", volumeRow.c],
              ] as const
            ).map(([slot, value]) => (
              <div key={slot} className="compare-panel__meter">
                <span className="compare-panel__meter-label">{slot}</span>
                <div className="compare-panel__meter-track">
                  <div
                    className="compare-panel__meter-fill"
                    style={{ width: `${Math.round((value / 255) * 100)}%` }}
                  />
                </div>
                <span className="compare-panel__meter-value">{value}</span>
              </div>
            ))}
            <div className="compare-panel__meter compare-panel__meter--live">
              <span className="compare-panel__meter-label">
                Live ({activeSlot})
                {liveDirty ? " *" : ""}
              </span>
              <div className="compare-panel__meter-track">
                <div
                  className="compare-panel__meter-fill"
                  style={{ width: `${Math.round((liveVolume / 255) * 100)}%` }}
                />
              </div>
              <span className="compare-panel__meter-value">{liveVolume}</span>
            </div>
          </div>
          <div className="compare-panel__volume-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => onMatchVolumes("A")}
              title={t("compare.matchA")}
            >
              {t("compare.equalA", { v: volumeRow.a })}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onMatchVolumes("B")}
              title={t("compare.matchB")}
            >
              {t("compare.equalB", { v: volumeRow.b })}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onMatchVolumes("C")}
              title={t("compare.matchC")}
            >
              {t("compare.equalC", { v: volumeRow.c })}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onMatchVolumes("live")}
              title={t("compare.matchLive")}
            >
              {t("compare.equalLive", { v: liveVolume })}
            </button>
          </div>
        </section>
      ) : null}

      <section className="compare-panel__copy">
        <div className="compare-panel__copy-head">
          <strong>{t("compare.copyPreset")}</strong>
          <span>{t("compare.copyHint")}</span>
        </div>
        <div className="compare-panel__copy-actions">
          {SLOT_PAIRS.map(({ from, to }) => (
            <button
              key={`${from}-${to}`}
              type="button"
              disabled={busy}
              onClick={() => onCopySlot(from, to)}
              title={
                liveDirty && from === activeSlot
                  ? t("compare.copyDirtyTitle", { from, to })
                  : t("compare.copyBankTitle", { from, to })
              }
            >
              {from}→{to}
              {liveDirty && from === activeSlot ? " *" : ""}
            </button>
          ))}
        </div>
      </section>

      <p className="compare-panel__sub">
        {diffs.length === 0
          ? t("compare.identical")
          : t("compare.diffCount", { n: diffs.length })}
      </p>
      <table className="compare-panel__table">
        <thead>
          <tr>
            <th>Param</th>
            <th>A</th>
            <th>B</th>
            <th>C</th>
            <th>Live ({activeSlot})</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((row) => {
            const liveValue = liveParams[row.param as keyof LiveParamsSnapshot];
            const bankActive =
              activeSlot === "A" ? row.a : activeSlot === "B" ? row.b : row.c;
            const liveDiffers = liveValue !== bankActive;
            return (
              <tr
                key={row.param}
                className={
                  row.param === "volume"
                    ? row.differs
                      ? "is-diff is-volume"
                      : "is-volume"
                    : row.differs
                      ? "is-diff"
                      : undefined
                }
              >
                <td>{row.param}</td>
                <td>{row.a}</td>
                <td>{row.b}</td>
                <td>{row.c}</td>
                <td className={liveDiffers ? "is-live-diff" : undefined}>{liveValue}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
