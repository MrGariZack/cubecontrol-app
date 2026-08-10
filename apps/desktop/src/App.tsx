import { useCallback, useEffect, useState } from "react";
import { ConnectScreen } from "./screens/ConnectScreen";
import { SplashScreen } from "./screens/SplashScreen";
import { StudioScreen } from "./screens/StudioScreen";
import type { DesktopConnectionInfo } from "./types/device";

export function App() {
  const [bootDone, setBootDone] = useState(false);
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

  if (connection === null) {
    return <ConnectScreen onConnected={setConnection} />;
  }

  return <StudioScreen connection={connection} onDisconnect={() => void onDisconnect()} />;
}
