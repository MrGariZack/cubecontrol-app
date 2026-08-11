import type { PresetSlotId } from "@tonehub/cube-baby-protocol";

const ALL_SLOTS: readonly PresetSlotId[] = ["A", "B", "C"];

type StudioToolbarProps = {
  readonly busy: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly activeSlot: PresetSlotId;
  readonly status: string | null;
  readonly activeShowLabel?: string | null;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onSave: () => void;
  readonly onCompare: () => void;
  readonly onCopyTo: (to: PresetSlotId) => void;
  readonly onOpenShow?: () => void;
};

export function StudioToolbar({
  busy,
  canUndo,
  canRedo,
  activeSlot,
  status,
  activeShowLabel = null,
  onUndo,
  onRedo,
  onSave,
  onCompare,
  onCopyTo,
  onOpenShow,
}: StudioToolbarProps) {
  const copyTargets = ALL_SLOTS.filter((slot) => slot !== activeSlot);

  return (
    <header className="studio-toolbar">
      <div className="studio-toolbar__left">
        <button
          type="button"
          className="studio-toolbar__btn"
          disabled={busy || !canUndo}
          onClick={onUndo}
          title="Undo"
        >
          Undo
        </button>
        <button
          type="button"
          className="studio-toolbar__btn"
          disabled={busy || !canRedo}
          onClick={onRedo}
          title="Redo"
        >
          Redo
        </button>
        <span className="studio-toolbar__divider" aria-hidden />
        <button
          type="button"
          className="studio-toolbar__btn studio-toolbar__btn--primary"
          disabled={busy}
          onClick={onSave}
        >
          Save {activeSlot}
        </button>
        <span className="studio-toolbar__copy" aria-label="Copiar live a otro footswitch">
          <span className="studio-toolbar__copy-label">Copiar a</span>
          {copyTargets.map((slot) => (
            <button
              key={slot}
              type="button"
              className="studio-toolbar__btn"
              disabled={busy}
              onClick={() => onCopyTo(slot)}
              title={`Copia el tono live actual al slot ${slot} y cambia a ${slot}`}
            >
              {slot}
            </button>
          ))}
        </span>
        <button type="button" className="studio-toolbar__btn" disabled={busy} onClick={onCompare}>
          Compare
        </button>
        {activeShowLabel && onOpenShow ? (
          <button
            type="button"
            className="studio-toolbar__btn studio-toolbar__show"
            disabled={busy}
            onClick={onOpenShow}
            title="Abrir show activo"
          >
            {activeShowLabel}
          </button>
        ) : null}
      </div>
      <p className="studio-toolbar__status" aria-live="polite">
        {status ?? "Ready"}
      </p>
    </header>
  );
}
