import { useRef, useState } from "react";
import {
  DELAY_NOTE_IDS,
  DEFAULT_DELAY_NOTE,
  bpmFromTapTimes,
  clampBpm,
  delayMsForNote,
  grooveTimeByte,
  timeByteToMs,
  type DelayNoteId,
} from "../music/delaySync";
import { useI18n } from "../i18n";
import "./delay-tap-bar.css";

const TAP_WINDOW = 8;

type DelayTapBarProps = {
  readonly bpm: number | "";
  readonly note: DelayNoteId;
  readonly synced: boolean;
  readonly liveTime: number;
  readonly disabled?: boolean;
  readonly onBpmChange: (bpm: number | "") => void;
  readonly onNoteChange: (note: DelayNoteId) => void;
  /** Write Time to the pedal and keep tempo sync on. */
  readonly onApplyTime: (time: number) => void;
};

/**
 * Industry-standard delay tempo: TAP + BPM + note subdivision → Time byte.
 * Helix / TimeLine / DD-500 pattern — no mic, no calibration lab.
 */
export function DelayTapBar({
  bpm,
  note,
  synced,
  liveTime,
  disabled = false,
  onBpmChange,
  onNoteChange,
  onApplyTime,
}: DelayTapBarProps) {
  const { t } = useI18n();
  const tapsRef = useRef<number[]>([]);
  const [tapCount, setTapCount] = useState(0);

  const numeric = typeof bpm === "number" ? bpm : null;
  const previewTime = numeric === null ? null : grooveTimeByte(numeric, note);
  const previewMs = numeric === null ? null : delayMsForNote(numeric, note);
  const displayTime = synced && previewTime !== null ? previewTime : liveTime;
  const displayMs = Math.round(timeByteToMs(displayTime));

  function writeFrom(nextBpm: number, nextNote: DelayNoteId) {
    onApplyTime(grooveTimeByte(nextBpm, nextNote));
  }

  function onTap() {
    const at = performance.now();
    const next = [...tapsRef.current, at].slice(-TAP_WINDOW);
    tapsRef.current = next;
    setTapCount(next.length);
    const guessed = bpmFromTapTimes(next);
    if (guessed === null) return;
    onBpmChange(guessed);
    writeFrom(guessed, note);
  }

  function onBpmInput(raw: string) {
    if (raw === "") {
      onBpmChange("");
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onBpmChange(n);
    if (n >= 40 && n <= 240) writeFrom(clampBpm(n), note);
  }

  function onPickNote(next: DelayNoteId) {
    onNoteChange(next);
    if (numeric !== null) writeFrom(numeric, next);
  }

  return (
    <section className="delay-tap" aria-label={t("groove.aria")}>
      <div className="delay-tap__row">
        <label className="delay-tap__field">
          {t("groove.bpm")}
          <input
            type="number"
            min={40}
            max={240}
            inputMode="numeric"
            disabled={disabled}
            value={bpm}
            placeholder="120"
            onChange={(e) => onBpmInput(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="delay-tap__tap"
          disabled={disabled}
          onClick={onTap}
        >
          {t("groove.tap")}
        </button>
        <div className="delay-tap__notes" role="group" aria-label={t("groove.note")}>
          {DELAY_NOTE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={
                note === id
                  ? "delay-tap__chip is-active"
                  : id === DEFAULT_DELAY_NOTE
                    ? "delay-tap__chip is-default"
                    : "delay-tap__chip"
              }
              disabled={disabled}
              onClick={() => onPickNote(id)}
            >
              {id === "1/8d" ? "1/8." : id}
            </button>
          ))}
        </div>
      </div>
      <p className="delay-tap__meta">
        {synced && previewMs !== null
          ? t("groove.readout", {
              time: displayTime,
              ms: Math.round(previewMs),
              actual: displayMs,
            })
          : t("groove.readoutFree", { time: liveTime, actual: displayMs })}
        {tapCount > 0 ? ` · ${t("groove.taps", { n: tapCount })}` : ""}
        {!synced ? ` · ${t("groove.free")}` : ""}
      </p>
    </section>
  );
}
