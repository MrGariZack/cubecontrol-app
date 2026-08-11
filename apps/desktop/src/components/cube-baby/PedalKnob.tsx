import { useEffect, useRef, useState } from "react";
import {
  isModulationOff,
  LIVE_PARAM_MODULATION_OFF,
  type LiveParamName,
} from "@tonehub/cube-baby-protocol";

export type PedalKnobTone = "volume" | "cab" | "delay" | "drive";

type PedalKnobProps = {
  readonly param: LiveParamName;
  readonly label: string;
  readonly value: number;
  readonly max: number;
  readonly tone: PedalKnobTone;
  /** False when the footswitch section for this group is off. */
  readonly sectionOn?: boolean;
  /**
   * Forced off by a master control (e.g. Mix at 0 kills Mix/FB/Time/MOD together)
   * even if this knobs still holds a non-zero value.
   */
  readonly effectOff?: boolean;
  /**
   * MOD: center 7–8 is off (chorus left / phaser right). Default knobs use 0 as off.
   */
  readonly bipolarCenterOff?: boolean;
  readonly tunerMark?: string;
  readonly iconMark?: "play" | "stop" | "back";
  readonly disabled?: boolean;
  readonly onChange: (param: LiveParamName, value: number) => void;
};

const START = -152;
const SWEEP = 304;
/** Magnetic detent applied only on pointer-up (never mid-drag). */
const OFF_SNAP_RATIO = 0.03;

function valueToAngle(value: number, max: number): number {
  const t = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  return START + t * SWEEP;
}

function clampValue(raw: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(raw)));
}

function snapTowardOff(raw: number, max: number, bipolarCenterOff: boolean): number {
  const clamped = clampValue(raw, max);
  if (bipolarCenterOff) {
    // Snap to center OFF (8) when near 7–8.
    if (isModulationOff(clamped) || Math.abs(clamped - LIVE_PARAM_MODULATION_OFF) <= 1) {
      return LIVE_PARAM_MODULATION_OFF;
    }
    return clamped;
  }
  // Fine CubeSuite ranges (gain 0–7, type 0–8, time 0–31…): 1 is a real value — do not
  // snap it to 0. Magnetic off only on wide knobs (mix/fb/volume).
  if (max <= 31) return clamped;
  const threshold = Math.max(1, Math.round(max * OFF_SNAP_RATIO));
  if (clamped <= threshold) return 0;
  return clamped;
}

function isAtOffStop(value: number, bipolarCenterOff: boolean): boolean {
  return bipolarCenterOff ? isModulationOff(value) : value === 0;
}

export function PedalKnob({
  param,
  label,
  value,
  max,
  tone,
  sectionOn = true,
  effectOff = false,
  bipolarCenterOff = false,
  tunerMark,
  iconMark,
  disabled = false,
  onChange,
}: PedalKnobProps) {
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startValue: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  /** Local value while dragging so the dial never lags behind parent debounce/render. */
  const [dragValue, setDragValue] = useState<number | null>(null);

  const sourceValue = dragValue ?? value;
  const clamped = clampValue(sourceValue, max);
  const atOffStop = isAtOffStop(clamped, bipolarCenterOff);
  const visuallyOff = atOffStop || effectOff || !sectionOn;
  const angle = valueToAngle(clamped, max);

  useEffect(() => {
    // If parent value jumps while idle (slot/undo), drop any stale local drag value.
    if (!dragging) setDragValue(null);
  }, [value, dragging]);

  function emit(next: number, snap: boolean) {
    const resolved = snap
      ? snapTowardOff(next, max, bipolarCenterOff)
      : clampValue(next, max);
    const prev = dragValue ?? value;
    setDragValue(resolved);
    // Avoid flooding MIDI with identical values (was spamming modulation=0).
    if (resolved !== clampValue(prev, max)) onChange(param, resolved);
    return resolved;
  }

  function endDrag(target: HTMLElement, pointerId: number) {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== pointerId) return;
    const snapped = snapTowardOff(dragValue ?? value, max, bipolarCenterOff);
    const prev = clampValue(dragValue ?? value, max);
    setDragValue(snapped);
    if (snapped !== prev || snapped !== clampValue(value, max)) {
      onChange(param, snapped);
    }
    dragRef.current = null;
    setDragging(false);
    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
  }

  const stateClass = [
    "pedal-knob",
    `pedal-knob--${tone}`,
    disabled ? "is-disabled" : "",
    dragging ? "is-dragging" : "",
    visuallyOff ? "is-off" : "",
    !sectionOn ? "is-section-off" : "",
    effectOff && !atOffStop ? "is-effect-off" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const offReason = !sectionOn
    ? `${label}: sección apagada`
    : effectOff && !atOffStop
      ? `${label}: OFF (Mix en 0 apaga Mix/FB/Time)`
      : atOffStop
        ? bipolarCenterOff
          ? `${label}: OFF (centro 7–8)`
          : `${label}: OFF (tope mínimo)`
        : `${label}: ${clamped}`;

  return (
    <div className={stateClass} data-off={visuallyOff ? "true" : "false"} title={offReason}>
      <div className="pedal-knob__top">
        {tunerMark ? <span className="pedal-knob__tuner">{tunerMark}</span> : null}
        {iconMark === "play" ? <span className="pedal-knob__icon">▶</span> : null}
        {iconMark === "stop" ? <span className="pedal-knob__icon">■</span> : null}
        {iconMark === "back" ? <span className="pedal-knob__icon">◀</span> : null}
      </div>

      <div
        className="pedal-knob__hit"
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-valuetext={
          !sectionOn ? "sección off" : visuallyOff ? "off" : String(clamped)
        }
        tabIndex={disabled ? -1 : 0}
        onPointerDown={(event) => {
          if (disabled) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startValue: clampValue(value, max),
          };
          setDragValue(clampValue(value, max));
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (drag === null || drag.pointerId !== event.pointerId || disabled) return;
          // Fine drag for small CubeSuite ranges (gain 0–7, mod 0–15, time 0–31…).
          const sensitivity = max <= 31 ? 0.06 : 0.85;
          const next = drag.startValue - (event.clientY - drag.startY) * sensitivity;
          // No magnetic snap while dragging — keeps motion continuous.
          emit(next, false);
        }}
        onPointerUp={(event) => {
          endDrag(event.currentTarget, event.pointerId);
        }}
        onPointerCancel={(event) => {
          endDrag(event.currentTarget, event.pointerId);
        }}
        onLostPointerCapture={() => {
          if (dragRef.current === null) return;
          const snapped = snapTowardOff(dragValue ?? value, max, bipolarCenterOff);
          setDragValue(snapped);
          onChange(param, snapped);
          dragRef.current = null;
          setDragging(false);
        }}
        onWheel={(event) => {
          if (disabled || dragging) return;
          event.preventDefault();
          const step = max <= 31 ? 1 : event.shiftKey ? 8 : 2;
          const next = clampValue(value, max) + (event.deltaY > 0 ? -step : step);
          onChange(param, snapTowardOff(next, max, bipolarCenterOff));
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          const base = clampValue(value, max);
          if (event.key === "ArrowUp" || event.key === "ArrowRight") {
            onChange(param, clampValue(base + 1, max));
          } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
            onChange(param, clampValue(base - 1, max));
          } else if (event.key === "Home") {
            onChange(param, bipolarCenterOff ? LIVE_PARAM_MODULATION_OFF : 0);
          }
        }}
      >
        <div className="pedal-knob__glow" aria-hidden />
        <div
          className="pedal-knob__dial"
          aria-hidden
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <div className="pedal-knob__teeth" />
          <div className="pedal-knob__face">
            <span className="pedal-knob__pointer" />
          </div>
        </div>
        {visuallyOff ? <span className="pedal-knob__off-badge">OFF</span> : null}
      </div>

      <span className="pedal-knob__label">{label}</span>
      <span className="pedal-knob__value">
        {visuallyOff ? "OFF" : clamped}
        {effectOff && !atOffStop && sectionOn ? (
          <span className="pedal-knob__held">{clamped}</span>
        ) : null}
      </span>
    </div>
  );
}
