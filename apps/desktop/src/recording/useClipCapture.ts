import { useCallback, useEffect, useRef, useState } from "react";

const MAX_SECONDS = 5 * 60;
const MAX_BYTES = 224 * 1024 * 1024;

type Phase = "idle" | "opening" | "preview" | "recording" | "finishing";
type Take = { url: string; name: string; blob: Blob };

function stopTracks(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop();
}

function makeRecorder(stream: MediaStream) {
  const formats = [
    "video/mp4;codecs=avc1.42001f,mp4a.40.2",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const mimeType of formats) {
    if (!MediaRecorder.isTypeSupported(mimeType)) continue;
    try {
      return new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
        audioBitsPerSecond: 192_000,
      });
    } catch {
      // Try the next supported container when the encoder cannot be initialized.
    }
  }
  throw new Error("clip.unsupported");
}

function inputError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "clip.permission";
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return "clip.noDevice";
    if (error.name === "NotReadableError" || error.name === "AbortError") return "clip.deviceBusy";
  }
  return "clip.inputError";
}

export function useClipCapture() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [sourceName, setSourceName] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState("");
  const [take, setTake] = useState<Take | null>(null);
  const preview = useRef<{
    stream: MediaStream;
    video: HTMLVideoElement;
    audio: AudioContext | null;
    analyser: AnalyserNode | null;
    samples: Float32Array<ArrayBuffer>;
  } | null>(null);
  const opening = useRef(0);
  const media = useRef<{ recorder: MediaRecorder; canvasTrack: MediaStreamTrack } | null>(null);
  const timer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const inputs = await navigator.mediaDevices?.enumerateDevices();
      setDevices(inputs?.filter((device) => device.kind === "audioinput" || device.kind === "videoinput") ?? []);
    } catch {
      // Device labels can be unavailable until permission is granted.
    }
  }, []);

  const releasePreview = useCallback(() => {
    opening.current += 1;
    const input = preview.current;
    preview.current = null;
    if (input === null) return;
    input.video.srcObject = null;
    stopTracks(input.stream);
    if (input.audio !== null) void input.audio.close().catch(() => undefined);
  }, []);

  const stop = useCallback(() => {
    const recorder = media.current?.recorder;
    if (!recorder || recorder.state === "inactive") return;
    setPhase("finishing");
    recorder.stop();
  }, []);

  const closePreview = useCallback(() => {
    if (media.current) return;
    releasePreview();
    setPhase("idle");
  }, [releasePreview]);

  useEffect(() => {
    void refresh();
    const inputs = navigator.mediaDevices;
    inputs?.addEventListener("devicechange", refresh);
    return () => {
      inputs?.removeEventListener("devicechange", refresh);
      if (timer.current !== null) window.clearInterval(timer.current);
      const session = media.current;
      if (session !== null) {
        session.recorder.ondataavailable = null;
        session.recorder.onstop = null;
        session.recorder.onerror = null;
        if (session.recorder.state !== "inactive") session.recorder.stop();
        session.canvasTrack.stop();
        media.current = null;
      }
      releasePreview();
    };
  }, [refresh, releasePreview]);

  useEffect(() => () => { if (take) URL.revokeObjectURL(take.url); }, [take]);

  useEffect(() => {
    function onHidden() {
      if (!document.hidden || !media.current) return;
      setNotice("clip.hidden");
      stop();
    }
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [stop]);

  async function openPreview(audioId: string, cameraId: string) {
    releasePreview();
    const request = opening.current;
    setNotice("");
    setPhase("opening");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setPhase("idle");
      setNotice("clip.unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(audioId ? { deviceId: { exact: audioId } } : {}),
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: {
          ...(cameraId ? { deviceId: { exact: cameraId } } : {}),
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
      });
      if (opening.current !== request) {
        stopTracks(stream);
        return;
      }
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      const input: NonNullable<typeof preview.current> = {
        stream, video, audio: null, analyser: null, samples: new Float32Array(1024),
      };
      preview.current = input;
      for (const track of stream.getTracks()) {
        track.addEventListener("ended", () => {
          if (preview.current !== input) return;
          setNotice("clip.deviceLost");
          if (media.current) stop();
          else closePreview();
        }, { once: true });
      }
      await video.play();
      if (opening.current !== request) return;
      try {
        input.audio = new AudioContext();
        input.analyser = input.audio.createAnalyser();
        input.analyser.fftSize = input.samples.length;
        input.audio.createMediaStreamSource(stream).connect(input.analyser);
        void input.audio.resume().catch(() => undefined);
      } catch {
        // Audio is recorded directly from the selected device even without a meter.
      }
      setSourceName(stream.getAudioTracks()[0]?.label ?? "");
      setPhase("preview");
      void refresh();
    } catch (error) {
      if (opening.current !== request) return;
      releasePreview();
      setPhase("idle");
      setNotice(inputError(error));
    }
  }

  function record(canvas: HTMLCanvasElement) {
    const input = preview.current;
    const audioTrack = input?.stream.getAudioTracks()[0];
    const cameraTrack = input?.stream.getVideoTracks()[0];
    if (media.current || !input || audioTrack?.readyState !== "live" || cameraTrack?.readyState !== "live") return;
    let canvasTrack: MediaStreamTrack | undefined;
    try {
      canvasTrack = canvas.captureStream(30).getVideoTracks()[0];
      if (!canvasTrack) throw new Error("clip.unsupported");
      const output = makeRecorder(new MediaStream([canvasTrack, audioTrack]));
      const session = { recorder: output, canvasTrack };
      const chunks: Blob[] = [];
      let size = 0;
      let failed = false;
      const started = performance.now();
      media.current = session;
      setElapsed(0);
      setNotice("");
      output.ondataavailable = ({ data }) => {
        if (data.size > 0) {
          chunks.push(data);
          size += data.size;
        }
        if (size >= MAX_BYTES && output.state === "recording") {
          setNotice("clip.limit");
          stop();
        }
      };
      output.onerror = () => {
        failed = true;
        setNotice("clip.recordError");
      };
      output.onstop = () => {
        if (timer.current !== null) window.clearInterval(timer.current);
        timer.current = null;
        session.canvasTrack.stop();
        media.current = null;
        releasePreview();
        setPhase("idle");
        const type = output.mimeType || chunks[0]?.type || "video/webm";
        if (size === 0) {
          setNotice("clip.emptyTake");
          return;
        }
        const blob = new Blob(chunks, { type });
        const suffix = type.startsWith("video/mp4") ? "mp4" : "webm";
        const date = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
        setTake({ url: URL.createObjectURL(blob), name: `CubeControl-${date}.${suffix}`, blob });
        if (failed) setNotice("clip.partial");
      };
      output.start(1000);
      setPhase("recording");
      timer.current = window.setInterval(() => {
        const seconds = Math.floor((performance.now() - started) / 1000);
        setElapsed(seconds);
        if (seconds >= MAX_SECONDS) {
          setNotice("clip.limit");
          stop();
        }
      }, 250);
    } catch {
      canvasTrack?.stop();
      media.current = null;
      setNotice("clip.recordError");
    }
  }

  const peak = useCallback((): number => {
    const input = preview.current;
    if (!input?.analyser) return 0;
    input.analyser.getFloatTimeDomainData(input.samples);
    let max = 0;
    for (const sample of input.samples) max = Math.max(max, Math.abs(sample));
    return max;
  }, []);

  return {
    phase, devices, sourceName, elapsed, notice, take, preview,
    openPreview, closePreview, record, stop, peak,
  };
}
