import { useCallback, useEffect, useRef, useState } from "react";
import { PitchDetector } from "pitchy";
import {
  nativeMidiHost,
  type PitchInputInfo,
  type PitchSourceEvent,
  type TunerPathProbe,
} from "@tonehub/midi-host-android";
import { analyzePitch, stabilizeOctave, type DetectedNote } from "./pitchMath";

export type TunerRange = "guitar" | "bass" | "wide";

export type TunerReading = {
  readonly note: DetectedNote;
  readonly clarity: number;
  readonly rms: number;
};

const RANGES: Record<TunerRange, { minHz: number; maxHz: number }> = {
  guitar: { minHz: 70, maxHz: 1200 },
  bass: { minHz: 28, maxHz: 450 },
  wide: { minHz: 40, maxHz: 2000 },
};

const CLARITY_MIN = 0.88;
const RMS_MIN = 0.004;
const BUFFER_SIZE = 2048;

function micAllowed(result: unknown): boolean {
  if (result == null || typeof result !== "object") return false;
  const rec = result as Record<string, unknown>;
  if (rec.granted === true || rec.status === "granted") return true;
  const nested = rec.RECORD_AUDIO;
  if (nested && typeof nested === "object") {
    const inner = nested as Record<string, unknown>;
    return inner.granted === true || inner.status === "granted";
  }
  return false;
}

function looksLikeCube(label: string): boolean {
  return /cube|cuvave|m-?vave|301a/i.test(label);
}

function preferredInputId(inputs: readonly PitchInputInfo[]): number {
  const cube = inputs.find((item) => looksLikeCube(item.label));
  if (cube) return cube.id;
  const usb = inputs.find((item) => item.kind === "usb");
  if (usb) return usb.id;
  const line = inputs.find((item) => !item.builtInMic);
  return line?.id ?? inputs[0]?.id ?? -1;
}

export function usePitchTuner(options: {
  readonly active: boolean;
  readonly a4: number;
  readonly range: TunerRange;
}) {
  const { active, a4, range } = options;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<TunerReading | null>(null);
  const [inputs, setInputs] = useState<readonly PitchInputInfo[]>([]);
  const [inputId, setInputId] = useState(-1);
  const [source, setSource] = useState<PitchSourceEvent | null>(null);
  const [level, setLevel] = useState({ rms: 0, clarity: 0, hz: 0 });
  const [probe, setProbe] = useState<TunerPathProbe | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  const detectorRef = useRef(PitchDetector.forFloat32Array(BUFFER_SIZE));
  const bufferRef = useRef(new Float32Array(BUFFER_SIZE));
  const prevHzRef = useRef<number | null>(null);
  const a4Ref = useRef(a4);
  const rangeRef = useRef(range);
  const inputIdRef = useRef(inputId);
  a4Ref.current = a4;
  rangeRef.current = range;
  inputIdRef.current = inputId;

  const stop = useCallback(() => {
    void nativeMidiHost?.stopPitchCapture().catch(() => undefined);
    prevHzRef.current = null;
    setListening(false);
    setReading(null);
    setLevel({ rms: 0, clarity: 0, hz: 0 });
  }, []);

  const refreshInputs = useCallback(async () => {
    if (nativeMidiHost == null || typeof nativeMidiHost.listPitchInputs !== "function") {
      setInputs([]);
      return;
    }
    try {
      const next = await nativeMidiHost.listPitchInputs();
      setInputs(next);
      setInputId((current) => {
        if (current >= 0 && next.some((item) => item.id === current)) return current;
        return preferredInputId(next);
      });
    } catch {
      setInputs([]);
    }
  }, []);

  const runProbe = useCallback(async () => {
    setProbeError(null);
    if (nativeMidiHost == null || typeof nativeMidiHost.probeTunerPath !== "function") {
      setProbeError("PROBE_NATIVE_MISSING");
      return;
    }
    try {
      const next = await nativeMidiHost.probeTunerPath();
      setProbe(next);
    } catch (err) {
      setProbeError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const start = useCallback(async () => {
    stop();
    setError(null);
    if (nativeMidiHost == null || typeof nativeMidiHost.startPitchCapture !== "function") {
      setError("TUNER_NATIVE_MISSING");
      return;
    }
    try {
      const permission = await nativeMidiHost.requestMicPermission();
      if (!micAllowed(permission)) {
        setError("TUNER_MIC_DENIED");
        return;
      }
      let id = inputIdRef.current;
      try {
        const next = await nativeMidiHost.listPitchInputs();
        setInputs(next);
        if (id < 0 || !next.some((item) => item.id === id)) {
          id = preferredInputId(next);
          setInputId(id);
          inputIdRef.current = id;
        }
      } catch {
        /* native picker missing — still try default capture */
      }
      await nativeMidiHost.startPitchCapture(id);
      setListening(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setListening(false);
    }
  }, [stop]);

  useEffect(() => {
    if (nativeMidiHost == null) return;
    const pcm = nativeMidiHost.addListener("onPcmFrames", (event) => {
      const incoming = event.samples;
      if (incoming.length < BUFFER_SIZE) return;
      const buffer = bufferRef.current;
      for (let i = 0; i < BUFFER_SIZE; i += 1) {
        buffer[i] = incoming[i] ?? 0;
      }
      let sum = 0;
      for (let i = 0; i < BUFFER_SIZE; i += 1) {
        const s = buffer[i] ?? 0;
        sum += s * s;
      }
      const rms = Math.sqrt(sum / BUFFER_SIZE);
      const [rawHz, clarity] = detectorRef.current.findPitch(buffer, event.sampleRate);
      const window = RANGES[rangeRef.current];
      setLevel({
        rms,
        clarity: Number.isFinite(clarity) ? clarity : 0,
        hz: Number.isFinite(rawHz) ? rawHz : 0,
      });
      if (rms >= RMS_MIN && clarity >= CLARITY_MIN && Number.isFinite(rawHz) && rawHz > 0) {
        const stable = stabilizeOctave(rawHz, prevHzRef.current, window.minHz, window.maxHz);
        prevHzRef.current = stable;
        setReading({
          note: analyzePitch(stable, a4Ref.current),
          clarity,
          rms,
        });
      } else if (rms < RMS_MIN * 0.6) {
        prevHzRef.current = null;
        setReading(null);
      }
    });
    const src = nativeMidiHost.addListener("onPitchSource", (event) => {
      setSource(event);
    });
    return () => {
      pcm.remove();
      src.remove();
    };
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }
    void start();
    return () => stop();
  }, [active, start, stop]);

  const selectInput = useCallback(
    (id: number) => {
      setInputId(id);
      inputIdRef.current = id;
      if (listening) void start();
    },
    [listening, start],
  );

  return {
    listening,
    error,
    reading,
    inputs,
    inputId,
    source,
    level,
    probe,
    probeError,
    start,
    stop,
    selectInput,
    refreshInputs,
    runProbe,
  };
}
