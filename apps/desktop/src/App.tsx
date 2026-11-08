import { useCallback, useEffect, useRef, useState } from "react";
import { SafetyGate } from "./components/SafetyGate";
import {
  installDemoDesktopApi,
  isMarketingDemo,
  makeDemoConnection,
} from "./demo/marketingDemo";
import { ConnectScreen } from "./screens/ConnectScreen";
import { SplashScreen } from "./screens/SplashScreen";
import { StudioScreen } from "./screens/StudioScreen";
import { useGuide } from "./help/Guide";
import { readSafetyAcceptance } from "./safety/disclaimer";
import { isLibraryOnlyConnection, makeLibraryOnlyConnection } from "./libraryOnly";
import type { DesktopConnectionInfo } from "./types/device";

const marketingDemo = isMarketingDemo();

export function App() {
  const { request: guide } = useGuide();
  const [bootDone, setBootDone] = useState(marketingDemo);
  const [safetyOk, setSafetyOk] = useState(
    () => marketingDemo || readSafetyAcceptance() !== null,
  );
  const [connection, setConnection] = useState<DesktopConnectionInfo | null>(() => {
    if (!marketingDemo) return null;
    const info = makeDemoConnection();
    installDemoDesktopApi(info);
    return info;
  });
  const connectionRef = useRef(connection);
  connectionRef.current = connection;
  /** After a manual disconnect, wait until the cable set changes before auto-connecting again. */
  const pauseAutoRef = useRef(false);
  const recordingRef = useRef(false);
  const guideHandled = useRef(0);
  const onRecordingChange = useCallback((recording: boolean) => {
    recordingRef.current = recording;
  }, []);

  useEffect(() => {
    if (!guide || !bootDone || !safetyOk || guide.sequence === guideHandled.current) return;
    guideHandled.current = guide.sequence;
    if (connection !== null) return;
    const page = guide.step.page;
    if (page !== "current" && page !== "connect" && page !== "account" && page !== "device" && page !== "editor") {
      setConnection(makeLibraryOnlyConnection());
    }
  }, [guide, bootDone, safetyOk, connection]);

  useEffect(() => {
    if (marketingDemo || !bootDone || !safetyOk) return;
    let cancelled = false;
    let generation = 0;
    let inflight = false;

    const needsPedal = () => {
      const current = connectionRef.current;
      return current === null || isLibraryOnlyConnection(current);
    };

    const attempt = async () => {
      if (cancelled || pauseAutoRef.current || inflight || !needsPedal()) return;
      const ticket = ++generation;
      let ports: Awaited<ReturnType<typeof window.tonehubDesktop.listPorts>>;
      try {
        ports = await window.tonehubDesktop.listPorts();
      } catch {
        return;
      }
      if (cancelled || ticket !== generation || pauseAutoRef.current || !needsPedal()) return;
      const matched = ports.filter(
        (port) => port.cubeBabyMatch === "confirmed" || port.cubeBabyMatch === "candidate",
      );
      const hasPair =
        matched.some((port) => port.direction === "input") &&
        matched.some((port) => port.direction === "output");
      if (!hasPair) return;
      inflight = true;
      try {
        let lastError: unknown;
        for (let tryIndex = 0; tryIndex < 3; tryIndex += 1) {
          if (cancelled || pauseAutoRef.current || !needsPedal()) return;
          try {
            const info = await window.tonehubDesktop.connect();
            if (cancelled || pauseAutoRef.current) {
              await window.tonehubDesktop.disconnect();
              return;
            }
            if (!needsPedal()) return;
            setConnection(info);
            return;
          } catch (error) {
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, 700));
          }
        }
        console.warn("auto-connect failed", lastError);
      } finally {
        inflight = false;
      }
    };

    void attempt();
    const unsubscribePorts = window.tonehubDesktop.onPortsChanged(() => {
      pauseAutoRef.current = false;
      void attempt();
    });
    const unsubscribeDetach = window.tonehubDesktop.onPedalDetached(() => {
      setConnection((current) => {
        if (current !== null && isLibraryOnlyConnection(current)) return current;
        return recordingRef.current ? makeLibraryOnlyConnection() : null;
      });
    });
    return () => {
      cancelled = true;
      unsubscribePorts();
      unsubscribeDetach();
    };
  }, [bootDone, safetyOk]);

  const onSplashDone = useCallback(() => {
    setBootDone(true);
  }, []);

  async function onDisconnect() {
    if (marketingDemo || (connection !== null && isLibraryOnlyConnection(connection))) {
      setConnection(null);
      return;
    }
    pauseAutoRef.current = true;
    await window.tonehubDesktop.disconnect();
    setConnection(null);
  }

  if (!bootDone) {
    return <SplashScreen onDone={onSplashDone} />;
  }

  if (!safetyOk) {
    return <SafetyGate onAccepted={() => setSafetyOk(true)} />;
  }

  if (connection === null) {
    return <ConnectScreen onConnected={setConnection} onOpenLibrary={() => setConnection(makeLibraryOnlyConnection())} />;
  }

  return (
    <StudioScreen
      connection={connection}
      onDisconnect={() => void onDisconnect()}
      onRecordingChange={onRecordingChange}
    />
  );
}
