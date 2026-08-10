import { useEffect, useRef, useState, type CSSProperties } from "react";

type Phase = "idle" | "connecting" | "connected" | "error";

type ConnectionInfo = {
  deviceName: string;
  inputPortId: string;
  outputPortId: string;
  bankSummary: string;
};

export function ConnectScreen() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portsHint, setPortsHint] = useState<string>("");

  const brandRef = useRef<HTMLDivElement>(null);
  const signalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const brand = brandRef.current;
    const signal = signalRef.current;
    if (brand) {
      brand.animate(
        [
          { opacity: 0, transform: "translateY(18px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 700, fill: "forwards", easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    }
    if (signal) {
      signal.animate([{ opacity: 0.35 }, { opacity: 0.7 }, { opacity: 0.35 }], {
        duration: 2800,
        iterations: Infinity,
        easing: "ease-in-out",
      });
    }
  }, []);

  useEffect(() => {
    void window.tonehubDesktop.listPorts().then((ports) => {
      const list = ports as Array<{ name: string; cubeBabyMatch: string; direction: string }>;
      const confirmed = list.filter((port) => port.cubeBabyMatch === "confirmed");
      setPortsHint(
        confirmed.length > 0
          ? `${confirmed.length} puerto(s) CUBE Baby USB detectado(s)`
          : "Pedal no detectado aún — conecta USB y cierra CubeSuite",
      );
    });
  }, []);

  useEffect(() => {
    return () => {
      void window.tonehubDesktop.disconnect();
    };
  }, []);

  async function onConnect() {
    if (phase === "connecting") return;
    setError(null);
    setPhase("connecting");
    try {
      await window.tonehubDesktop.disconnect();
      const info = (await window.tonehubDesktop.connect()) as ConnectionInfo;
      setConnection(info);
      setPhase("connected");
    } catch (err) {
      setConnection(null);
      setPhase("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onDisconnect() {
    await window.tonehubDesktop.disconnect();
    setConnection(null);
    setPhase("idle");
    setError(null);
  }

  return (
    <main style={styles.root}>
      <div ref={signalRef} style={styles.signal} />
      <div ref={brandRef} style={styles.brandBlock}>
        <h1 style={styles.brand}>ToneHub</h1>
        <p style={styles.headline}>Habla con tu CUBE Baby</p>
        <p style={styles.support}>
          App de escritorio sobre USB-MIDI (el mismo transporte que la CLI). Android viene después.
        </p>
        <p style={styles.portsHint}>{portsHint}</p>
      </div>

      <div style={styles.actions}>
        {phase !== "connected" ? (
          <button type="button" style={styles.cta} onClick={() => void onConnect()} disabled={phase === "connecting"}>
            {phase === "connecting" ? "Conectando…" : "Conectar USB"}
          </button>
        ) : (
          <button type="button" style={styles.secondary} onClick={() => void onDisconnect()}>
            Desconectar
          </button>
        )}

        {phase === "connected" && connection ? (
          <div style={styles.statusBlock}>
            <p style={styles.statusTitle}>{connection.deviceName}</p>
            <p style={styles.statusMeta}>
              {connection.inputPortId} → {connection.outputPortId}
            </p>
            <p style={styles.statusMeta}>{connection.bankSummary}</p>
            <p style={styles.modeTag}>PC · NodeMidiTransport · USB</p>
          </div>
        ) : null}

        {phase === "error" && error ? <p style={styles.error}>{error}</p> : null}
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    minHeight: "100vh",
    padding: "72px 36px 40px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden",
  },
  signal: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 210,
    background: "var(--signal)",
    top: -120,
    right: -140,
    opacity: 0.35,
    pointerEvents: "none",
  },
  brandBlock: {
    position: "relative",
    maxWidth: 520,
  },
  brand: {
    margin: 0,
    fontFamily: '"Syne", sans-serif',
    fontWeight: 800,
    fontSize: 64,
    lineHeight: 1.05,
    letterSpacing: "-0.03em",
    color: "var(--ink)",
  },
  headline: {
    margin: "18px 0 0",
    fontFamily: '"Syne", sans-serif',
    fontWeight: 700,
    fontSize: 30,
    lineHeight: 1.2,
    color: "var(--ink-soft)",
  },
  support: {
    margin: "12px 0 0",
    fontSize: 16,
    lineHeight: 1.5,
    color: "var(--mute)",
    maxWidth: 380,
  },
  portsHint: {
    margin: "20px 0 0",
    fontSize: 13,
    color: "var(--mute-2)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  actions: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: 18,
    maxWidth: 420,
  },
  cta: {
    border: "none",
    background: "var(--accent)",
    color: "var(--paper-bright)",
    padding: "18px 22px",
    fontWeight: 700,
    fontSize: 17,
  },
  secondary: {
    border: "1.5px solid var(--accent)",
    background: "transparent",
    color: "var(--accent)",
    padding: "16px 22px",
    fontWeight: 700,
    fontSize: 16,
  },
  statusBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  statusTitle: {
    margin: 0,
    fontFamily: '"Syne", sans-serif',
    fontWeight: 700,
    fontSize: 22,
  },
  statusMeta: {
    margin: 0,
    fontSize: 14,
    color: "var(--mute)",
  },
  modeTag: {
    margin: "8px 0 0",
    fontSize: 12,
    color: "var(--mute-2)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  error: {
    margin: 0,
    fontSize: 14,
    color: "var(--danger)",
  },
};
