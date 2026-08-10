import { useCallback, useRef } from "react";

type KnobProps = {
  readonly label: string;
  readonly value: number;
  readonly max: number;
  readonly accent: string;
  readonly onChange: (value: number) => void;
};

const SIZE = 112;
const START = -135;
const SWEEP = 270;

export function Knob({ label, value, max, accent, onChange }: KnobProps) {
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);
  const clamped = Math.max(0, Math.min(max, value));
  const t = max === 0 ? 0 : clamped / max;
  const angle = START + t * SWEEP;

  const commitFromDelta = useCallback(
    (deltaY: number, startValue: number) => {
      const sensitivity = max <= 8 ? 0.04 : 0.8;
      const next = Math.round(startValue - deltaY * sensitivity);
      onChange(Math.max(0, Math.min(max, next)));
    },
    [max, onChange],
  );

  return (
    <div className="knob">
      <div
        className="knob__dial"
        style={{ ["--knob-accent" as string]: accent }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { startY: event.clientY, startValue: clamped };
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (drag === null) return;
          commitFromDelta(event.clientY - drag.startY, drag.startValue);
        }}
        onPointerUp={(event) => {
          dragRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onWheel={(event) => {
          event.preventDefault();
          const step = max <= 8 ? 1 : event.shiftKey ? 8 : 2;
          const next = clamped + (event.deltaY > 0 ? -step : step);
          onChange(Math.max(0, Math.min(max, next)));
        }}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamped}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowRight") {
            onChange(Math.min(max, clamped + 1));
          } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
            onChange(Math.max(0, clamped - 1));
          }
        }}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={42}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={8}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={42}
            fill="none"
            stroke={accent}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={`${t * 198} 198`}
            transform={`rotate(${START + 90} ${SIZE / 2} ${SIZE / 2})`}
          />
          <line
            x1={SIZE / 2}
            y1={SIZE / 2}
            x2={SIZE / 2}
            y2={22}
            stroke="#F2E6D4"
            strokeWidth={3}
            strokeLinecap="round"
            transform={`rotate(${angle} ${SIZE / 2} ${SIZE / 2})`}
          />
          <circle cx={SIZE / 2} cy={SIZE / 2} r={28} fill="#1A1D21" stroke="rgba(255,255,255,0.06)" />
        </svg>
      </div>
      <div className="knob__value">{clamped}</div>
      <div className="knob__label">{label}</div>
    </div>
  );
}
