import { useCallback, useId, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useI18n } from "../../i18n";
import "./mic-distance-rail.css";

type MicDistanceRailProps = {
  readonly value: number;
  readonly onChange: (distance: number) => void;
  readonly disabled?: boolean;
  readonly compact?: boolean;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

/**
 * IR mic-distance — CubeSuite Distance as float 0..1 written with the IR block.
 * Visual: speaker cone → sliding capsule mic (near punch ↔ far room).
 */
export function MicDistanceRail({
  value,
  onChange,
  disabled = false,
  compact = false,
}: MicDistanceRailProps) {
  const { t } = useI18n();
  const id = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const pct = Math.round(clamp01(value) * 100);
  const dist = clamp01(value);

  const setFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (el === null || disabled) return;
      const rect = el.getBoundingClientRect();
      const styles = getComputedStyle(el);
      const insetL = Number.parseFloat(styles.getPropertyValue("--mic-inset-l")) || 62;
      const insetR = Number.parseFloat(styles.getPropertyValue("--mic-inset-r")) || 56;
      const usable = Math.max(1, rect.width - insetL - insetR);
      const x = (clientX - rect.left - insetL) / usable;
      onChange(Math.round(clamp01(x) * 100) / 100);
    },
    [disabled, onChange],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setFromClientX(event.clientX);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    setFromClientX(event.clientX);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const nudge = (delta: number) => {
    if (disabled) return;
    onChange(Math.round(clamp01(dist + delta) * 100) / 100);
  };

  return (
    <div
      className={`mic-dist${compact ? " mic-dist--compact" : ""}${disabled ? " is-disabled" : ""}`}
      role="group"
      aria-labelledby={`${id}-label`}
    >
      <div className="mic-dist__meta">
        <span id={`${id}-label`} className="mic-dist__tag">
          MIC DIST
        </span>
        <span className="mic-dist__hint">{t("mic.hint")}</span>
        <span className="mic-dist__readout" aria-live="polite">
          <span className="mic-dist__pct">{pct}</span>
          <span className="mic-dist__unit">%</span>
          <span className="mic-dist__float">{dist.toFixed(2)}</span>
        </span>
      </div>

      <div
        ref={trackRef}
        className="mic-dist__stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            nudge(-0.05);
          } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            nudge(0.05);
          } else if (event.key === "Home") {
            event.preventDefault();
            onChange(0);
          } else if (event.key === "End") {
            event.preventDefault();
            onChange(1);
          }
        }}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={t("mic.valueText", { pct, float: dist.toFixed(2) })}
        aria-label={t("mic.aria")}
      >
        <div className="mic-dist__cab" aria-hidden>
          <span className="mic-dist__cab-ring mic-dist__cab-ring--outer" />
          <span className="mic-dist__cab-ring mic-dist__cab-ring--mid" />
          <span className="mic-dist__cab-ring mic-dist__cab-ring--dust" />
          <span className="mic-dist__cab-label">{t("mic.near")}</span>
        </div>

        <div className="mic-dist__path" aria-hidden>
          <span className="mic-dist__glow" style={{ opacity: 0.18 + (1 - dist) * 0.45 }} />
          <span className="mic-dist__ticks">
            {[0, 0.25, 0.5, 0.75, 1].map((mark) => (
              <i key={mark} style={{ left: `${mark * 100}%` }} />
            ))}
          </span>
          {/* Sound pressure rings denser when near */}
          <span
            className="mic-dist__waves"
            style={{
              opacity: 0.2 + (1 - dist) * 0.55,
              transform: `translateY(-50%) scaleX(${0.55 + (1 - dist) * 0.55})`,
            }}
          />
        </div>

        <div
          className="mic-dist__mic"
          style={{ left: `calc(var(--mic-inset-l) + (100% - var(--mic-inset-l) - var(--mic-inset-r)) * ${dist})` }}
          aria-hidden
        >
          <span className="mic-dist__mic-body">
            <span className="mic-dist__mic-grill" />
          </span>
          <span className="mic-dist__mic-shadow" />
        </div>

        <div className="mic-dist__room" aria-hidden>
          <span className="mic-dist__room-haze" style={{ opacity: 0.15 + dist * 0.55 }} />
          <span className="mic-dist__cab-label mic-dist__cab-label--far">{t("mic.far")}</span>
        </div>
      </div>

      <p className="mic-dist__foot">{t("mic.foot")}</p>
    </div>
  );
}
