import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { SyncPanel } from "./SyncPanel";
import "./account-menu.css";

type SyncStatus = {
  readonly signedIn: boolean;
  readonly email: string | null;
};

export function AccountMenu() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await window.tonehubDesktop?.sync?.status();
      setStatus(next ? { signedIn: next.signedIn, email: next.email } : null);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const api = window.tonehubDesktop?.sync;
    if (!api) return;
    const unsubSynced = api.onSynced(() => void refresh());
    const unsubSigned = api.onSignedIn(() => void refresh());
    return () => {
      unsubSynced();
      unsubSigned();
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    void refresh();
    function onPointer(event: MouseEvent) {
      const root = rootRef.current;
      if (root && !root.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, refresh]);

  const signedIn = status?.signedIn === true;

  return (
    <div ref={rootRef} className="account-menu">
      <button
        type="button"
        className={`account-menu__btn${signedIn ? " is-on" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={signedIn ? (status?.email ?? t("account.aria")) : t("account.aria")}
        title={signedIn ? (status?.email ?? t("account.aria")) : t("account.aria")}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" className="account-menu__icon" aria-hidden>
          <circle cx="12" cy="8" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M5.2 19.2c1.1-3.2 3.5-4.8 6.8-4.8s5.7 1.6 6.8 4.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        {signedIn ? <span className="account-menu__dot" aria-hidden /> : null}
      </button>
      {open ? (
        <div className="account-menu__pop" role="dialog" aria-label={t("account.aria")}>
          <SyncPanel />
        </div>
      ) : null}
    </div>
  );
}
