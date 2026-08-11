import { useCallback, useEffect, useRef, useState } from "react";

export type SpectrumFrame = {
  readonly bands: Float32Array;
  readonly rms: number;
};

/**
 * Mic → AnalyserNode frequency bands for the pedal signal scope.
 * Separate from the tuner stream (simple; both can open the same device).
 */
export function useAudioSpectrum(options: { readonly active: boolean; readonly bandCount?: number }) {
  const { active, bandCount = 48 } = options;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<SpectrumFrame>({
    bands: new Float32Array(bandCount),
    rms: 0,
  });
  const audioRef = useRef<{
    context: AudioContext;
    stream: MediaStream;
    source: MediaStreamAudioSourceNode;
    analyser: AnalyserNode;
    freq: Uint8Array<ArrayBuffer>;
    time: Float32Array<ArrayBuffer>;
    raf: number;
  } | null>(null);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio === null) {
      setListening(false);
      return;
    }
    cancelAnimationFrame(audio.raf);
    audio.source.disconnect();
    audio.analyser.disconnect();
    for (const track of audio.stream.getTracks()) track.stop();
    void audio.context.close();
    audioRef.current = null;
    setListening(false);
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }

    let cancelled = false;

    async function start() {
      setError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Sin acceso a micrófono en este entorno");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        const context = new AudioContext();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.72;
        analyser.minDecibels = -85;
        analyser.maxDecibels = -18;
        source.connect(analyser);

        const freq = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
        const time = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>;
        const bands = new Float32Array(bandCount);

        const tick = () => {
          const current = audioRef.current;
          if (current === null) return;
          current.analyser.getByteFrequencyData(current.freq);
          current.analyser.getFloatTimeDomainData(current.time);

          let sum = 0;
          for (let i = 0; i < current.time.length; i += 1) {
            const s = current.time[i] ?? 0;
            sum += s * s;
          }
          const rms = Math.sqrt(sum / current.time.length);

          // Equal log-frequency bands ~80 Hz → 8 kHz (guitar range across full rail).
          // Avoids the old t² packing that piled almost all energy on the left.
          const binCount = current.freq.length;
          const nyquist = current.context.sampleRate / 2;
          const fMin = 80;
          const fMax = Math.min(8000, nyquist * 0.85);
          for (let b = 0; b < bandCount; b += 1) {
            const t0 = b / bandCount;
            const t1 = (b + 1) / bandCount;
            const hz0 = fMin * Math.pow(fMax / fMin, t0);
            const hz1 = fMin * Math.pow(fMax / fMin, t1);
            const i0 = Math.max(0, Math.floor((hz0 / nyquist) * binCount));
            const i1 = Math.min(binCount, Math.max(i0 + 1, Math.ceil((hz1 / nyquist) * binCount)));
            let peak = 0;
            for (let i = i0; i < i1; i += 1) {
              peak = Math.max(peak, (current.freq[i] ?? 0) / 255);
            }
            // Mild high-shelf so harmonics aren't invisible vs body/bass.
            const shelf = 0.9 + 0.55 * (b / Math.max(1, bandCount - 1));
            peak = Math.min(1, peak * shelf);
            const prev = bands[b] ?? 0;
            bands[b] = peak >= prev ? peak : prev * 0.78 + peak * 0.22;
          }

          frameRef.current = { bands: bands.slice(), rms };
          current.raf = requestAnimationFrame(tick);
        };

        audioRef.current = {
          context,
          stream,
          source,
          analyser,
          freq,
          time,
          raf: requestAnimationFrame(tick),
        };
        setListening(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setListening(false);
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [active, bandCount, stop]);

  return { listening, error, frameRef };
}
