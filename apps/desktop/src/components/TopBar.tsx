import type { PresetSlotId } from "@tonehub/cube-baby-protocol";
import { SlotSwitcher } from "./SlotSwitcher";

/** Pedal Cabinet 1..8 → ROM IR slots 0..7 (Cab 8 = upload). */
const IR_CABINETS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

type TopBarProps = {
  readonly deviceName: string;
  readonly activeSlot: PresetSlotId;
  readonly irCabinet: number;
  readonly slotBusy: boolean;
  readonly actionBusy: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly onSelectSlot: (slot: PresetSlotId) => void;
  readonly onIrCabinetChange: (cabinet: number) => void;
  readonly onSave: () => void;
  readonly onExportBank: () => void;
  readonly onImportBank: () => void;
  readonly onLoadIr: () => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onLibrary: () => void;
  readonly onCompare: () => void;
  readonly onDisconnect: () => void;
};

export function TopBar({
  deviceName,
  activeSlot,
  irCabinet,
  slotBusy,
  actionBusy,
  canUndo,
  canRedo,
  onSelectSlot,
  onIrCabinetChange,
  onSave,
  onExportBank,
  onImportBank,
  onLoadIr,
  onUndo,
  onRedo,
  onLibrary,
  onCompare,
  onDisconnect,
}: TopBarProps) {
  const busy = slotBusy || actionBusy;
  return (
    <header className="top-bar">
      <div className="top-bar__brand">
        <span className="top-bar__logo">CubeControl</span>
        <span className="top-bar__device">{deviceName}</span>
      </div>
      <SlotSwitcher active={activeSlot} busy={busy} onSelect={onSelectSlot} />
      <div className="top-bar__actions">
        <button
          type="button"
          className="top-bar__action"
          disabled={busy || !canUndo}
          onClick={onUndo}
          title="Deshacer live"
        >
          Undo
        </button>
        <button
          type="button"
          className="top-bar__action"
          disabled={busy || !canRedo}
          onClick={onRedo}
          title="Rehacer live"
        >
          Redo
        </button>
        <button type="button" className="top-bar__action" disabled={busy} onClick={onCompare}>
          Compare
        </button>
        <button type="button" className="top-bar__action" disabled={busy} onClick={onLibrary}>
          Biblioteca
        </button>
        <button type="button" className="top-bar__action" disabled={busy} onClick={onSave}>
          Guardar {activeSlot}
        </button>
        <button type="button" className="top-bar__action" disabled={busy} onClick={onExportBank}>
          Exportar
        </button>
        <button type="button" className="top-bar__action" disabled={busy} onClick={onImportBank}>
          Importar
        </button>
        <label className="top-bar__ir">
          <span className="top-bar__ir-label">IR → Cab</span>
          <select
            className="top-bar__ir-select"
            value={irCabinet}
            disabled={busy}
            onChange={(event) => onIrCabinetChange(Number(event.target.value))}
            aria-label="Cabinet / slot IR destino"
          >
            {IR_CABINETS.map((cabinet) => (
              <option key={cabinet} value={cabinet}>
                {cabinet}
                {cabinet === 8 ? " (upload)" : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="top-bar__action" disabled={busy} onClick={onLoadIr}>
          Cargar IR
        </button>
        <button type="button" className="top-bar__disconnect" disabled={busy} onClick={onDisconnect}>
          Desconectar
        </button>
      </div>
    </header>
  );
}
