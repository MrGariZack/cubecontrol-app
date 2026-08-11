import { clearSafetyAcceptance } from "../safety/disclaimer";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
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
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  return (
    <div className="dev-ws" aria-label="Device · Bank e IR">
      <header className="dev-ws__top">
        <div>
          <h1 className="dev-ws__title">Device</h1>
          <p className="dev-ws__subtitle">
            Bank A+B+C, impulso (IR) y herramientas de hardware — con aire, sin apiñar el menú
          </p>
        </div>
      </header>

      <div className="dev-ws__grid">
        <section className="dev-ws__card" aria-labelledby="dev-bank-heading">
          <h2 id="dev-bank-heading" className="dev-ws__card-title">
            Bank
          </h2>
          <p className="dev-ws__card-copy">
            Exporta o restaura los tres footswitches (A+B+C) como archivo JSON en tu PC.
          </p>
          <div className="dev-ws__actions">
            <button
              type="button"
              className="dev-ws__btn dev-ws__btn--primary"
              disabled={busy}
              onClick={onExportBank}
            >
              Exportar bank
            </button>
            <button
              type="button"
              className="dev-ws__btn"
              disabled={busy}
              onClick={onImportBank}
            >
              Importar bank
            </button>
          </div>
        </section>

        <section className="dev-ws__card dev-ws__card--ir" aria-labelledby="dev-ir-heading">
          <h2 id="dev-ir-heading" className="dev-ws__card-title">
            Impulse response
          </h2>
          <p className="dev-ws__card-copy">
            Carga un WAV al cabinet elegido. Cab 8 es el slot de upload seguro; 1–7 pueden ser de
            fábrica.
          </p>

          <label className="dev-ws__field">
            <span>Cabinet destino</span>
            <select
              value={irCabinet}
              disabled={busy}
              aria-label="Cabinet IR destino"
              onChange={(event) => onIrCabinetChange(Number(event.target.value))}
            >
              {IR_CABINETS.map((cabinet) => (
                <option key={cabinet} value={cabinet}>
                  Cab {cabinet}
                  {cabinet === 8 ? " · upload seguro" : " · riesgo factory"}
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
              Cargar IR WAV
            </button>
          </div>
        </section>

        <section className="dev-ws__card" aria-labelledby="dev-levels-heading">
          <h2 id="dev-levels-heading" className="dev-ws__card-title">
            Niveles
          </h2>
          <p className="dev-ws__card-copy">
            Compara A/B/C y iguala volúmenes entre footswitches cuando el set suena desparejo.
          </p>
          <div className="dev-ws__actions">
            <button
              type="button"
              className="dev-ws__btn dev-ws__btn--primary"
              disabled={busy}
              onClick={onCompare}
            >
              Compare / match volume
            </button>
          </div>
        </section>

        <section className="dev-ws__card dev-ws__card--warn" aria-labelledby="dev-safety-heading">
          <h2 id="dev-safety-heading" className="dev-ws__card-title">
            Seguridad
          </h2>
          <ul className="dev-ws__checklist">
            <li>Live / knobs = riesgo bajo</li>
            <li>Bank export/import = medio</li>
            <li>IR ROM Cab 1–7 = alto (preferir Cab 8)</li>
          </ul>
          <p className="dev-ws__card-copy">
            Producto no oficial. Sin garantía. Detalle en <code>SAFETY.md</code>.
          </p>
          <div className="dev-ws__actions">
            <button
              type="button"
              className="dev-ws__btn"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  const ok = await confirm({
                    title: "Reset safety notice",
                    body: "El aviso de riesgos volverá a mostrarse al reiniciar CubeControl.",
                    confirmLabel: "Restablecer",
                  });
                  if (!ok) return;
                  clearSafetyAcceptance();
                })();
              }}
            >
              Reset safety notice
            </button>
          </div>
        </section>
      </div>
      {confirmDialog}
    </div>
  );
}
