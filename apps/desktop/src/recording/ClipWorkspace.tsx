import { useEffect, useRef, useState } from "react";
import type { PresetSlotId } from "@tonehub/cube-baby-protocol";
import { useI18n } from "../i18n";
import type { LiveParamsSnapshot } from "../types/device";
import { CLIP_FORMATS, drawClipFrame, type ClipFormat } from "./composition";
import { useClipCapture } from "./useClipCapture";
import "./clip-workspace.css";

const EXPORT_CHUNK_BYTES = 1024 * 1024;

type Props = {
  readonly active: boolean;
  readonly hasPedal: boolean;
  readonly params: LiveParamsSnapshot;
  readonly slot: PresetSlotId;
  readonly onRecordingChange: (recording: boolean) => void;
};

export function ClipWorkspace({ active, hasPedal, params, slot, onRecordingChange }: Props) {
  const { t } = useI18n();
  const capture = useClipCapture();
  const { phase, closePreview, preview, peak } = capture;
  const [audioId, setAudioId] = useState("");
  const [cameraId, setCameraId] = useState("");
  const [format, setFormat] = useState<ClipFormat>("landscape");
  const [includePedal, setIncludePedal] = useState(true);
  const [level, setLevel] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const capturing = phase === "recording" || phase === "finishing";
  const drawing = phase === "preview" || capturing;
  const composition = useRef({ params, slot, showPedal: includePedal && hasPedal });
  composition.current = { params, slot, showPedal: includePedal && hasPedal };

  useEffect(() => {
    onRecordingChange(capturing);
    return () => onRecordingChange(false);
  }, [capturing, onRecordingChange]);

  useEffect(() => {
    if (!active && !capturing) closePreview();
  }, [active, capturing, closePreview]);

  useEffect(() => {
    if (!capturing && !saving) return;
    function onClose(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = true;
    }
    window.addEventListener("beforeunload", onClose);
    return () => window.removeEventListener("beforeunload", onClose);
  }, [capturing, saving]);

  useEffect(() => {
    if (!active && !capturing) return;
    const ctx = canvas.current?.getContext("2d", { alpha: false });
    if (!ctx) return;
    let frame = 0;
    let lastDraw = -Infinity;
    let lastMeter = -Infinity;
    function tick(now: number) {
      if (!ctx) return;
      if (now - lastDraw >= 1000 / 30 - 1) {
        const scene = composition.current;
        drawClipFrame(ctx, preview.current?.video ?? null, format, scene.showPedal ? scene : null);
        lastDraw = now;
      }
      if (drawing && active && now - lastMeter >= 90) {
        setLevel(peak());
        lastMeter = now;
      }
      if (drawing) frame = requestAnimationFrame(tick);
    }
    tick(performance.now());
    return () => cancelAnimationFrame(frame);
  }, [active, capturing, drawing, format, hasPedal, includePedal, params, peak, preview, slot]);

  const changeInput = (setter: (value: string) => void, value: string) => {
    closePreview();
    setter(value);
  };
  const exporter = window.tonehubDesktop?.clipExport;

  async function saveTake() {
    const take = capture.take;
    if (!take || !exporter || saving) return;
    setSaving(true);
    setSaveStatus("");
    let opened = false;
    try {
      opened = await exporter.begin(take.name, take.blob.size);
      if (!opened) return;
      for (let offset = 0; offset < take.blob.size; offset += EXPORT_CHUNK_BYTES) {
        const chunk = await take.blob.slice(offset, offset + EXPORT_CHUNK_BYTES).arrayBuffer();
        await exporter.write(new Uint8Array(chunk));
      }
      const path = await exporter.end(true);
      opened = false;
      setSaveStatus(path ? "clip.saved" : "clip.saveError");
    } catch {
      if (opened) await exporter.end(false).catch(() => undefined);
      setSaveStatus("clip.saveError");
    } finally {
      setSaving(false);
    }
  }

  const busy = phase === "opening" || capturing || saving;
  const result = phase === "idle" ? capture.take : null;
  const output = CLIP_FORMATS[format];
  const clock = `${Math.floor(capture.elapsed / 60).toString().padStart(2, "0")}:${(capture.elapsed % 60).toString().padStart(2, "0")}`;

  return (
    <section className="clip-workspace" hidden={!active} aria-labelledby="clip-heading">
      <header className="clip-workspace__header">
        <div>
          <h1 id="clip-heading">{t("clip.title")}</h1>
          <p>{t("clip.intro")}</p>
        </div>
        <div className="clip-workspace__readout" data-recording={capturing}>
          <span className="clip-workspace__indicator" aria-hidden="true" />
          <span role="status">{t(`clip.state.${result ? "review" : phase}`)}</span>
          {capturing ? <time>{clock}</time> : null}
        </div>
      </header>

      <div className="clip-workspace__body">
        <div className="clip-workspace__monitor">
          <div className="clip-workspace__frame">
            <canvas
              ref={canvas}
              width={output.width}
              height={output.height}
              hidden={Boolean(result)}
              aria-label={t("clip.preview")}
            />
            {result ? <video src={result.url} controls playsInline aria-label={t("clip.review")} /> : null}
            {!result && !drawing ? <span className="clip-workspace__placeholder">{t("clip.cameraOff")}</span> : null}
          </div>
          <div className="clip-workspace__transport" data-guide="clip-record clip-save">
            {phase === "recording" ? (
              <button className="clip-workspace__button" type="button" onClick={capture.stop}>{t("clip.stop")}</button>
            ) : phase === "preview" ? (
              <>
                <button className="clip-workspace__button clip-workspace__button--record" type="button" disabled={saving} onClick={() => {
                  setSaveStatus("");
                  if (canvas.current) capture.record(canvas.current);
                }}>
                  {t("clip.record")}
                </button>
                <button className="clip-workspace__button" type="button" onClick={closePreview}>{t("clip.closePreview")}</button>
              </>
            ) : (
              <button
                className={`clip-workspace__button${result ? "" : " clip-workspace__button--primary"}`}
                type="button"
                disabled={busy}
                onClick={() => {
                  setSaveStatus("");
                  void capture.openPreview(audioId, cameraId);
                }}
              >
                {t(result ? "clip.newTake" : "clip.enablePreview")}
              </button>
            )}
            {capture.take && exporter ? (
              <button className="clip-workspace__button clip-workspace__button--primary" type="button" disabled={capturing || saving} onClick={() => void saveTake()}>
                {saving ? t("clip.saving") : t("clip.save", { format: capture.take.name.endsWith(".mp4") ? "MP4" : "WebM" })}
              </button>
            ) : capture.take ? (
              <a className="clip-workspace__button" href={capture.take.url} download={capture.take.name}>
                {t("clip.download", { format: capture.take.name.endsWith(".mp4") ? "MP4" : "WebM" })}
              </a>
            ) : null}
          </div>
          {capture.notice ? <p className="clip-workspace__notice" role="alert">{t(capture.notice)}</p> : null}
          {saveStatus ? (
            <p className={saveStatus === "clip.saved" ? "clip-workspace__hint" : "clip-workspace__notice"} role="status">
              {t(saveStatus)}
            </p>
          ) : null}
        </div>

        <fieldset className="clip-workspace__setup" data-guide="clip-input" disabled={busy}>
          <legend>{t("clip.setup")}</legend>
          <label className="clip-workspace__field">
            <span>{t("clip.audio")}</span>
            <select value={audioId} onChange={(e) => changeInput(setAudioId, e.target.value)}>
              <option value="">{t("clip.defaultInput")}</option>
              {capture.devices.filter((device) => device.kind === "audioinput" && device.deviceId && device.deviceId !== "default").map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>{device.label || t("clip.inputNumber", { number: index + 1 })}</option>
              ))}
            </select>
          </label>
          <p className="clip-workspace__hint">{drawing && capture.sourceName ? t("clip.currentInput", { name: capture.sourceName }) : t("clip.audioHint")}</p>
          <div className="clip-workspace__meter">
            <span>{t("clip.level")}</span>
            <meter min={0} max={1} value={drawing ? Math.min(1, Math.sqrt(level)) : 0} aria-label={t("clip.level")} />
          </div>
          <label className="clip-workspace__field">
            <span>{t("clip.camera")}</span>
            <select value={cameraId} onChange={(e) => changeInput(setCameraId, e.target.value)}>
              <option value="">{t("clip.defaultInput")}</option>
              {capture.devices.filter((device) => device.kind === "videoinput" && device.deviceId && device.deviceId !== "default").map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>{device.label || t("clip.inputNumber", { number: index + 1 })}</option>
              ))}
            </select>
          </label>
          <label className="clip-workspace__field">
            <span>{t("clip.format")}</span>
            <select value={format} onChange={(e) => setFormat(e.target.value === "portrait" ? "portrait" : "landscape")}>
              <option value="landscape">{t("clip.landscape")}</option>
              <option value="portrait">{t("clip.portrait")}</option>
            </select>
          </label>
          <label className="clip-workspace__check">
            <input type="checkbox" checked={includePedal && hasPedal} disabled={!hasPedal} onChange={(e) => setIncludePedal(e.target.checked)} />
            {t("clip.overlay")}
          </label>
          <p className="clip-workspace__hint">{t(hasPedal ? "clip.overlayHint" : "clip.connectHint")}</p>
          <p className="clip-workspace__hint clip-workspace__limit">{t("clip.local")}</p>
        </fieldset>
      </div>
    </section>
  );
}
