import type { PresetSlotId } from "@tonehub/cube-baby-protocol";
import type { MatchVolumesSource } from "../../electron/deviceBridge";
import type { SlotDiffRow } from "../../electron/library/types";

type ComparePanelProps = {
  readonly open: boolean;
  readonly rows: readonly SlotDiffRow[];
  readonly busy: boolean;
  readonly liveVolume: number;
  readonly activeSlot: PresetSlotId;
  readonly onClose: () => void;
  readonly onMatchVolumes: (source: MatchVolumesSource) => void;
};

export function ComparePanel({
  open,
  rows,
  busy,
  liveVolume,
  activeSlot,
  onClose,
  onMatchVolumes,
}: ComparePanelProps) {
  if (!open) return null;

  const volumeRow = rows.find((row) => row.param === "volume");
  const otherRows = rows.filter((row) => row.param !== "volume");
  const ordered = volumeRow === undefined ? rows : [volumeRow, ...otherRows];
  const diffs = rows.filter((row) => row.differs);
  const volumeDiffers = volumeRow?.differs ?? false;

  return (
    <div className="compare-panel" role="dialog" aria-label="Comparar slots A B C">
      <div className="compare-panel__head">
        <h2 className="compare-panel__title">Compare A / B / C</h2>
        <button type="button" className="compare-panel__close" onClick={onClose} disabled={busy}>
          Cerrar
        </button>
      </div>

      {volumeRow ? (
        <section
          className={
            volumeDiffers ? "compare-panel__volume is-warn" : "compare-panel__volume is-ok"
          }
        >
          <div className="compare-panel__volume-head">
            <strong>Volumen</strong>
            <span>
              {volumeDiffers
                ? "Los 3 slots no están al mismo nivel — al cambiar A/B/C se nota el salto."
                : "A, B y C tienen el mismo volumen en el bank."}
            </span>
          </div>
          <div className="compare-panel__volume-meters" aria-label="Volúmenes A B C">
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
              <span className="compare-panel__meter-label">Live ({activeSlot})</span>
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
              title="Copia el volumen del slot A a B y C"
            >
              Igualar a A ({volumeRow.a})
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onMatchVolumes("B")}
              title="Copia el volumen del slot B a A y C"
            >
              Igualar a B ({volumeRow.b})
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onMatchVolumes("C")}
              title="Copia el volumen del slot C a A y B"
            >
              Igualar a C ({volumeRow.c})
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onMatchVolumes("live")}
              title="Escribe el volumen live actual en A, B y C"
            >
              Igualar a live ({liveVolume})
            </button>
          </div>
        </section>
      ) : null}

      <p className="compare-panel__sub">
        {diffs.length === 0
          ? "Los tres slots son idénticos en live params."
          : `${diffs.length} parámetros difieren entre slots.`}
      </p>
      <table className="compare-panel__table">
        <thead>
          <tr>
            <th>Param</th>
            <th>A</th>
            <th>B</th>
            <th>C</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((row) => (
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
