import { useCallback, useEffect, useState } from "react";
import { SafetyGate } from "./components/SafetyGate";
import { ConnectScreen } from "./screens/ConnectScreen";
import { SplashScreen } from "./screens/SplashScreen";
import { StudioScreen } from "./screens/StudioScreen";
import { readSafetyAcceptance } from "./safety/disclaimer";
import type { DesktopConnectionInfo } from "./types/device";

export function App() {
  const [bootDone, setBootDone] = useState(false);
  const [safetyOk, setSafetyOk] = useState(() => readSafetyAcceptance() !== null);
  const [connection, setConnection] = useState<DesktopConnectionInfo | null>(null);

  useEffect(() => {
    return () => {
      void window.tonehubDesktop.disconnect();
    };
  }, []);

  const onSplashDone = useCallback(() => {
    setBootDone(true);
  }, []);

  async function onDisconnect() {
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
    return <ConnectScreen onConnected={setConnection} />;
  }

  return <StudioScreen connection={connection} onDisconnect={() => void onDisconnect()} />;
}
