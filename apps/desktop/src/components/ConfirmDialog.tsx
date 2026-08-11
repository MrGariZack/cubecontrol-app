import { useEffect, useId, useRef, useState } from "react";
import "./confirm-dialog.css";

export type ConfirmTone = "default" | "warn" | "danger";

export type ConfirmRequest = {
  readonly title: string;
  readonly body: string;
  readonly detail?: string;
  readonly tone?: ConfirmTone;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  /** User must type this exact string (case-insensitive) to enable Confirm. */
  readonly requireTyped?: string;
};

type ConfirmDialogProps = {
  readonly request: ConfirmRequest;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

/**
 * Calm in-app confirm — replaces native `window.confirm` for destructive / IR risk flows.
 */
export function ConfirmDialog({ request, onConfirm, onCancel }: ConfirmDialogProps) {
  const titleId = useId();
  const tone = request.tone ?? "default";
  const [typed, setTyped] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const typedOk =
    request.requireTyped === undefined ||
    typed.trim().toUpperCase() === request.requireTyped.trim().toUpperCase();

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const focusTarget = request.requireTyped ? inputRef.current : cancelRef.current;
    focusTarget?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onCancel, request.requireTyped]);

  return (
    <div className="cc-confirm" role="presentation" onMouseDown={onCancel}>
      <div
        className={`cc-confirm__panel cc-confirm__panel--${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className={`cc-confirm__eyebrow cc-confirm__eyebrow--${tone}`}>
          {tone === "danger" ? "Riesgo alto" : tone === "warn" ? "Atención" : "Confirmar"}
        </p>
        <h2 id={titleId} className="cc-confirm__title">
          {request.title}
        </h2>
        <p className="cc-confirm__body">{request.body}</p>
        {request.detail ? <p className="cc-confirm__detail">{request.detail}</p> : null}
        {request.requireTyped ? (
          <label className="cc-confirm__type">
            <span>
              Escribe <code>{request.requireTyped}</code> para continuar
            </span>
            <input
              ref={inputRef}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-label={`Confirmar escribiendo ${request.requireTyped}`}
            />
          </label>
        ) : null}
        <div className="cc-confirm__actions">
          <button
            ref={cancelRef}
            type="button"
            className="cc-confirm__btn"
            onClick={onCancel}
          >
            {request.cancelLabel ?? "Cancelar"}
          </button>
          <button
            type="button"
            className={`cc-confirm__btn cc-confirm__btn--go cc-confirm__btn--${tone}`}
            disabled={!typedOk}
            onClick={onConfirm}
          >
            {request.confirmLabel ?? "Continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
