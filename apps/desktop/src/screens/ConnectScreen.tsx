import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { HelpButton } from "../help/Guide";
import type { DesktopConnectionInfo } from "../types/device";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { AccountMenu } from "../components/AccountMenu";
import { useReportProblem } from "../report/ReportProblemContext";

type ConnectScreenProps = {
  readonly onConnected: (info: DesktopConnectionInfo) => void;
  readonly onOpenLibrary: () => void;
};

export function ConnectScreen({ onConnected, onOpenLibrary }: ConnectScreenProps) {
  const { t, locale } = useI18n();
  const { openReportProblem } = useReportProblem();
  const [phase, setPhase] = useState<"idle" | "connecting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [portsHint, setPortsHint] = useState("");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const brandRef = useRef<HTMLDivElement>(null);
  const signalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    brandRef.current?.animate(
      [
        { opacity: 0, transform: "translateY(18px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 700, fill: "forwards", easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    signalRef.current?.animate([{ opacity: 0.35 }, { opacity: 0.7 }, { opacity: 0.35 }], {
      duration: 2800,
      iterations: Infinity,
      easing: "ease-in-out",
    });
  }, []);

  async function onConnect() {
    if (phaseRef.current === "connecting") return;
    phaseRef.current = "connecting";
    setError(null);
    setPhase("connecting");
    try {
      await window.tonehubDesktop.disconnect();
      const info = await window.tonehubDesktop.connect();
      onConnected(info);
    } catch (err) {
      phaseRef.current = "error";
      setPhase("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    let cancelled = false;
    let generation = 0;

    const refresh = async () => {
      const ticket = ++generation;
      const ports = await window.tonehubDesktop.listPorts();
      if (cancelled || ticket !== generation) return;
      const matched = ports.filter(
        (port) => port.cubeBabyMatch === "confirmed" || port.cubeBabyMatch === "candidate",
      );
      setPortsHint(
        matched.length > 0
          ? t("connect.portsFound", { count: matched.length })
          : t("connect.portsMissing"),
      );
    };

    void refresh();
    const unsubscribe = window.tonehubDesktop.onPortsChanged(() => {
      void refresh();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [t, locale]);

  return (
    <main className="connect">
      <div className="connect__lang" data-guide="language">
        <AccountMenu />
        <LanguageSwitcher />
        <HelpButton />
      </div>
      <div ref={signalRef} className="connect__signal" />
      <div ref={brandRef}>
        <h1 className="connect__brand">CubeControl</h1>
        <p className="connect__headline">{t("connect.headline")}</p>
        <p className="connect__support">{t("connect.support")}</p>
        <p className="connect__hint">{portsHint}</p>
        <p className="connect__safety">{t("connect.safety")}</p>
      </div>
      <div className="connect__actions" data-guide="connection">
        <button
          type="button"
          className="connect__cta"
          onClick={() => void onConnect()}
          disabled={phase === "connecting"}
        >
          {phase === "connecting" ? t("connect.connecting") : t("connect.cta")}
        </button>
        <button
          type="button"
          className="connect__cta connect__cta--secondary"
          onClick={onOpenLibrary}
          disabled={phase === "connecting"}
        >
          {t("connect.ctaLibrary")}
        </button>
        <p className="connect__library-hint">{t("connect.libraryHint")}</p>
        <button
          type="button"
          className="connect__report"
          data-guide="report"
          onClick={openReportProblem}
          disabled={phase === "connecting"}
        >
          {t("report.open")}
        </button>
        {phase === "error" && error ? <p className="connect__error">{error}</p> : null}
      </div>
    </main>
  );
}
