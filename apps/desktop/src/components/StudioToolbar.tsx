type StudioToolbarProps = {
  readonly busy: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly activeSlot: string;
  readonly status: string | null;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onSave: () => void;
  readonly onCompare: () => void;
};

export function StudioToolbar({
  busy,
  canUndo,
  canRedo,
  activeSlot,
  status,
  onUndo,
  onRedo,
  onSave,
  onCompare,
}: StudioToolbarProps) {
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
        <button type="button" className="studio-toolbar__btn" disabled={busy} onClick={onCompare}>
          Compare
        </button>
      </div>
      <p className="studio-toolbar__status">{status ?? "Ready"}</p>
    </header>
  );
}
