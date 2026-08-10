import { useCallback, useEffect, useRef, useState } from "react";
import { PitchDetector } from "pitchy";
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
const BUFFER_SIZE = 4096;

export function usePitchTuner(options: {
  readonly active: boolean;
  readonly a4: number;
  readonly range: TunerRange;
}) {
  const { active, a4, range } = options;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<TunerReading | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");

  const audioRef = useRef<{
    context: AudioContext;
    stream: MediaStream;
    source: MediaStreamAudioSourceNode;
    highpass: BiquadFilterNode;
    lowpass: BiquadFilterNode;
    analyser: AnalyserNode;
    detector: PitchDetector<Float32Array>;
    buffer: Float32Array<ArrayBuffer>;
    raf: number;
    prevHz: number | null;
  } | null>(null);

  const a4Ref = useRef(a4);
  const rangeRef = useRef(range);
  a4Ref.current = a4;
  rangeRef.current = range;

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio === null) {
      setListening(false);
      return;
    }
    cancelAnimationFrame(audio.raf);
    audio.source.disconnect();
    audio.highpass.disconnect();
    audio.lowpass.disconnect();
    audio.analyser.disconnect();
    for (const track of audio.stream.getTracks()) track.stop();
    void audio.context.close();
    audioRef.current = null;
    setListening(false);
    setReading(null);
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const list = await navigator.mediaDevices.enumerateDevices();
    const inputs = list.filter((d) => d.kind === "audioinput");
    setDevices(inputs);
    setDeviceId((current) => {
      if (current !== "" && inputs.some((d) => d.deviceId === current)) return current;
      return inputs[0]?.deviceId ?? "";
    });
  }, []);

  const start = useCallback(async () => {
    stop();
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Este entorno no permite capturar audio");
      }

      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      };
      if (deviceId !== "") {
        audioConstraints.deviceId = { exact: deviceId };
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);

      const bounds = RANGES[rangeRef.current];
      const highpass = context.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = Math.max(20, bounds.minHz * 0.55);
      highpass.Q.value = 0.7;

      const lowpass = context.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = Math.min(context.sampleRate / 2 - 100, bounds.maxHz * 1.35);
      lowpass.Q.value = 0.7;

      const analyser = context.createAnalyser();
      analyser.fftSize = BUFFER_SIZE;
      analyser.smoothingTimeConstant = 0.2;

      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(analyser);

      const detector = PitchDetector.forFloat32Array(analyser.fftSize);
      const buffer = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>;

      const audio = {
        context,
        stream,
        source,
        highpass,
        lowpass,
        analyser,
        detector,
        buffer,
        raf: 0,
        prevHz: null as number | null,
      };
      audioRef.current = audio;

      const tick = () => {
        const current = audioRef.current;
        if (current === null) return;
        current.analyser.getFloatTimeDomainData(current.buffer);

        let sum = 0;
        for (let i = 0; i < current.buffer.length; i += 1) {
          const s = current.buffer[i] ?? 0;
          sum += s * s;
        }
        const rms = Math.sqrt(sum / current.buffer.length);
        const [rawHz, clarity] = current.detector.findPitch(
          current.buffer,
          current.context.sampleRate,
        );
        const window = RANGES[rangeRef.current];

        if (rms >= RMS_MIN && clarity >= CLARITY_MIN && Number.isFinite(rawHz) && rawHz > 0) {
          const stable = stabilizeOctave(rawHz, current.prevHz, window.minHz, window.maxHz);
          current.prevHz = stable;
          setReading({
            note: analyzePitch(stable, a4Ref.current),
            clarity,
            rms,
          });
        } else if (rms < RMS_MIN * 0.6) {
          current.prevHz = null;
          setReading(null);
        }

        current.raf = requestAnimationFrame(tick);
      };

      if (context.state === "suspended") await context.resume();
      audio.raf = requestAnimationFrame(tick);
      setListening(true);
      await refreshDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setListening(false);
    }
  }, [deviceId, refreshDevices, stop]);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }
    void start();
    return () => stop();
  }, [active, deviceId, range, start, stop]);

  useEffect(() => {
    void refreshDevices();
  }, [refreshDevices]);

  return {
    listening,
    error,
    reading,
    devices,
    deviceId,
    setDeviceId,
    start,
    stop,
    refreshDevices,
  };
}
