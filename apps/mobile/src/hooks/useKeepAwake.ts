import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect, useId } from "react";

export function useKeepAwake(active: boolean): void {
  const tag = useId();
  useEffect(() => {
    if (!active) return;
    const started = activateKeepAwakeAsync(tag);
    void started.catch(() => undefined);
    return () => {
      void started.then(() => deactivateKeepAwake(tag)).catch(() => undefined);
    };
  }, [active, tag]);
}
