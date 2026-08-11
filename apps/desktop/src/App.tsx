import { useCallback, useEffect, useState } from "react";
import { SafetyGate } from "./components/SafetyGate";
import {
  installDemoDesktopApi,
  isMarketingDemo,
  makeDemoConnection,
} from "./demo/marketingDemo";
import { ConnectScreen } from "./screens/ConnectScreen";
import { SplashScreen } from "./screens/SplashScreen";
import { StudioScreen } from "./screens/StudioScreen";
import { readSafetyAcceptance } from "./safety/disclaimer";
import type { DesktopConnectionInfo } from "./types/device";

const marketingDemo = isMarketingDemo();

export function App() {
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

  useEffect(() => {
    if (marketingDemo) return;
    return () => {
      void window.tonehubDesktop.disconnect();
    };
  }, []);

  const onSplashDone = useCallback(() => {
    setBootDone(true);
  }, []);

  async function onDisconnect() {
    if (marketingDemo) {
      setConnection(null);
      return;
    }
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
