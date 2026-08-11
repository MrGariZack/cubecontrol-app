import { useEffect, useRef } from "react";
import type { LiveParamName } from "@tonehub/cube-baby-protocol";
import { midiLog, midiWarn } from "../debug/midiLog";

/** Longer debounce = fewer SysEx under WinMM; sections still bypass via writeNow. */
const DEBOUNCE_MS = 90;

const INSTANT_PARAMS = new Set<LiveParamName>([
  "irSection",
  "delaySection",
  "toneSection",
  // Small 0–15 depth — debounce made OFF feel dead.
  "modulation",
]);

/**
 * Queues live writes so rapid knob motion does not flood USB-MIDI.
 * Section toggles bypass debounce (CubeSuite-style instant audio).
 */
export function useDebouncedLiveWrite() {
  const timers = useRef(new Map<LiveParamName, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<LiveParamName, number>());
  const chain = useRef(Promise.resolve());
  const generation = useRef(0);

  useEffect(() => {
    return () => {
      generation.current += 1;
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear();
      pending.current.clear();
    };
  }, []);

  function enqueue(op: () => Promise<void>): Promise<void> {
    const run = chain.current.then(op, op);
    chain.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function flush(): Promise<void> {
    const entries = [...pending.current.entries()];
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
    pending.current.clear();
    const gen = generation.current;
    await enqueue(async () => {
      if (gen !== generation.current) return;
      for (const [param, value] of entries) {
        if (gen !== generation.current) return;
        await window.tonehubDesktop.writeLiveParam(param, value);
      }
    });
  }

  /** Drop queued knob writes and invalidate in-flight ones (e.g. before A/B/C recall). */
  async function cancelPending(): Promise<void> {
    generation.current += 1;
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
    pending.current.clear();
    await chain.current.then(
      () => undefined,
      () => undefined,
    );
  }

  /** Immediate live write (no debounce) — used for section on/off. */
  function writeNow(param: LiveParamName, value: number): void {
    const existing = timers.current.get(param);
    if (existing !== undefined) clearTimeout(existing);
    timers.current.delete(param);
    pending.current.delete(param);
    const gen = generation.current;
    midiLog("ipc-write-now", { param, value, gen });
    void enqueue(async () => {
      if (gen !== generation.current) {
        midiLog("ipc-write-skipped-stale", { param, value, gen });
        return;
      }
      await window.tonehubDesktop.writeLiveParam(param, value);
    }).catch((error: unknown) => {
      midiWarn("ipc-write-fail", {
        param,
        value,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  function scheduleWrite(param: LiveParamName, value: number): void {
    if (INSTANT_PARAMS.has(param)) {
      writeNow(param, value);
      return;
    }
    pending.current.set(param, value);
    const existing = timers.current.get(param);
    if (existing !== undefined) clearTimeout(existing);
    const timer = setTimeout(() => {
      timers.current.delete(param);
      const next = pending.current.get(param);
      pending.current.delete(param);
      if (next === undefined) return;
      const gen = generation.current;
      midiLog("ipc-write-debounced", { param, value: next, gen });
      void enqueue(async () => {
        if (gen !== generation.current) {
          midiLog("ipc-write-skipped-stale", { param, value: next, gen });
          return;
        }
        await window.tonehubDesktop.writeLiveParam(param, next);
      }).catch((error: unknown) => {
        midiWarn("ipc-write-fail", {
          param,
          value: next,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, DEBOUNCE_MS);
    timers.current.set(param, timer);
  }

  return { scheduleWrite, writeNow, flush, cancelPending };
}
