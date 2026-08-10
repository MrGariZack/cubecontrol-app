/** Pedal Cabinet 1..8 → ROM IR slots 0..7 (Cab 8 = upload). */
const IR_CABINETS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

type DevicePanelProps = {
  readonly busy: boolean;
  readonly irCabinet: number;
  readonly onIrCabinetChange: (cabinet: number) => void;
  readonly onLoadIr: () => void;
  readonly onExportBank: () => void;
  readonly onImportBank: () => void;
  readonly onCompare: () => void;
};

export function DevicePanel({
  busy,
  irCabinet,
  onIrCabinetChange,
  onLoadIr,
  onExportBank,
  onImportBank,
  onCompare,
}: DevicePanelProps) {
  return (
    <div className="device-panel">
      <p className="device-panel__title">Device tools</p>
      <p className="device-panel__copy">
        Bank A+B+C, carga de IR con backup ROM, y compare de niveles.
      </p>

      <div className="device-panel__group">
        <span className="device-panel__label">Bank</span>
        <button type="button" className="device-panel__btn" disabled={busy} onClick={onExportBank}>
          Export bank
        </button>
        <button type="button" className="device-panel__btn" disabled={busy} onClick={onImportBank}>
          Import bank
        </button>
      </div>

      <div className="device-panel__group">
        <span className="device-panel__label">Impulse response</span>
        <label className="device-panel__ir">
          <span>Target cab</span>
          <select
            value={irCabinet}
            disabled={busy}
            onChange={(event) => onIrCabinetChange(Number(event.target.value))}
          >
            {IR_CABINETS.map((cabinet) => (
              <option key={cabinet} value={cabinet}>
                Cab {cabinet}
                {cabinet === 8 ? " · upload" : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="device-panel__btn" disabled={busy} onClick={onLoadIr}>
          Load IR WAV
        </button>
      </div>

      <div className="device-panel__group">
        <span className="device-panel__label">Levels</span>
        <button type="button" className="device-panel__btn" disabled={busy} onClick={onCompare}>
          Compare / match volume
        </button>
      </div>
    </div>
  );
}
