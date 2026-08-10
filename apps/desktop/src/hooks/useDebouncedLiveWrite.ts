import { useEffect, useRef } from "react";
import type { LiveParamName } from "@tonehub/cube-baby-protocol";

const DEBOUNCE_MS = 60;

/**
 * Queues live writes so rapid knob motion does not flood USB-MIDI.
 */
export function useDebouncedLiveWrite() {
  const timers = useRef(new Map<LiveParamName, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<LiveParamName, number>());

  useEffect(() => {
    return () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear();
    };
  }, []);

  async function flush(): Promise<void> {
    const entries = [...pending.current.entries()];
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
    pending.current.clear();
    for (const [param, value] of entries) {
      await window.tonehubDesktop.writeLiveParam(param, value);
    }
  }

  function scheduleWrite(param: LiveParamName, value: number): void {
    pending.current.set(param, value);
    const existing = timers.current.get(param);
    if (existing !== undefined) clearTimeout(existing);
    const timer = setTimeout(() => {
      timers.current.delete(param);
      const next = pending.current.get(param);
      pending.current.delete(param);
      if (next === undefined) return;
      void window.tonehubDesktop.writeLiveParam(param, next).catch((error: unknown) => {
        console.error("writeLiveParam failed", param, error);
      });
    }, DEBOUNCE_MS);
    timers.current.set(param, timer);
  }

  return { scheduleWrite, flush };
}
