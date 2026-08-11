import { useEffect, useRef, useState } from "react";
import type { DesktopConnectionInfo } from "../types/device";

type ConnectScreenProps = {
  readonly onConnected: (info: DesktopConnectionInfo) => void;
};

export function ConnectScreen({ onConnected }: ConnectScreenProps) {
  const [phase, setPhase] = useState<"idle" | "connecting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [portsHint, setPortsHint] = useState("");
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

  useEffect(() => {
    void window.tonehubDesktop.listPorts().then((ports) => {
      const confirmed = ports.filter((port) => port.cubeBabyMatch === "confirmed");
      setPortsHint(
        confirmed.length > 0
          ? `${confirmed.length} puerto(s) CUBE Baby USB detectado(s)`
          : "Pedal no detectado — conecta USB y cierra CubeSuite",
      );
    });
  }, []);

  async function onConnect() {
    if (phase === "connecting") return;
    setError(null);
    setPhase("connecting");
    try {
      await window.tonehubDesktop.disconnect();
      const info = await window.tonehubDesktop.connect();
      onConnected(info);
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main className="connect">
      <div ref={signalRef} className="connect__signal" />
      <div ref={brandRef}>
        <h1 className="connect__brand">CubeControl</h1>
        <p className="connect__headline">Control live para CUBE Baby</p>
        <p className="connect__support">
          Conecta por USB para editar Drive, Delay, Reverb, Mod, Cabinet y Output en tiempo real.
        </p>
        <p className="connect__hint">{portsHint}</p>
        <p className="connect__safety">
          Software no oficial · sin garantía · IR preferible en Cab 8 · exporta bank antes de
          experimentos. Ya aceptaste el aviso de riesgos en este equipo.
        </p>
      </div>
      <div className="connect__actions">
        <button
          type="button"
          className="connect__cta"
          onClick={() => void onConnect()}
          disabled={phase === "connecting"}
        >
          {phase === "connecting" ? "Conectando…" : "Conectar USB"}
        </button>
        {phase === "error" && error ? <p className="connect__error">{error}</p> : null}
      </div>
    </main>
  );
}
