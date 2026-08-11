import { useEffect, useRef, useState } from "react";
import { useAudioSpectrum } from "../../audio/useAudioSpectrum";
import { useI18n } from "../../i18n";
import "./signal-scope.css";

type SignalScopeProps = {
  /** When false, mic stays off (e.g. tuner page owns audio). */
  readonly active?: boolean;
};

type CubeRun = {
  x: number;
  y: number;
  vy: number;
  laps: number;
  blocked: boolean;
  celebrateUntil: number;
  lastLocal: number;
  stuckMs: number;
};

/** Bar level that counts as a wall the cube must clear. */
const WALL = 0.38;
/** Jump height (0..1) needed to clear a full wall. */
const JUMP_CLEAR = 0.48;
const SPEED = 0.000055;
const GRAVITY = 0.0000028;
const JUMP_V = 0.00115;
/** Local band must rise this much while touching the cube to trampoline. */
const TOUCH_RISE = 0.07;
/** Bar must reach this height under the cube to count as "touching". */
const TOUCH_LEVEL = 0.3;

/**
 * OLED-style frequency rail above the virtual pedal — with a tiny cube runner.
 */
export function SignalScope({ active = true }: SignalScopeProps) {
  const { t, locale } = useI18n();
  const [enabled, setEnabled] = useState(true);
  const [play, setPlay] = useState(true);
  const [laps, setLaps] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaksRef = useRef<Float32Array | null>(null);
  const runRef = useRef<CubeRun>({
    x: 0.02,
    y: 0,
    vy: 0,
    laps: 0,
    blocked: false,
    celebrateUntil: 0,
    lastLocal: 0,
    stuckMs: 0,
  });
  const playRef = useRef(play);
  playRef.current = play;
  const lastTsRef = useRef(0);

  const { listening, error, frameRef } = useAudioSpectrum({
    active: active && enabled,
    bandCount: 56,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;

    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const drawCube = (
      cx: number,
      cy: number,
      size: number,
      blocked: boolean,
      celebrating: boolean,
      t: number,
    ) => {
      const wobble = blocked ? Math.sin(t / 40) * 2.2 * dpr : 0;
      const s = size;
      const x = cx + wobble;
      const y = cy;

      // Soft shadow
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(x, y + s * 0.55, s * 0.55, s * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();

      // Isometric cube — teal face (brand accent)
      const hx = s * 0.55;
      const hy = s * 0.32;
      const top = celebrating
        ? "rgba(255, 214, 120, 0.95)"
        : blocked
          ? "rgba(255, 140, 120, 0.92)"
          : "rgba(180, 240, 230, 0.95)";
      const left = celebrating
        ? "rgba(220, 150, 60, 0.9)"
        : blocked
          ? "rgba(180, 70, 70, 0.88)"
          : "rgba(30, 140, 130, 0.95)";
      const right = celebrating
        ? "rgba(190, 120, 40, 0.9)"
        : blocked
          ? "rgba(140, 50, 50, 0.9)"
          : "rgba(20, 100, 95, 0.95)";

      ctx.beginPath();
      ctx.moveTo(x, y - hy);
      ctx.lineTo(x + hx, y - hy * 0.35);
      ctx.lineTo(x, y + hy * 0.3);
      ctx.lineTo(x - hx, y - hy * 0.35);
      ctx.closePath();
      ctx.fillStyle = top;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x - hx, y - hy * 0.35);
      ctx.lineTo(x, y + hy * 0.3);
      ctx.lineTo(x, y + hy * 0.3 + s * 0.55);
      ctx.lineTo(x - hx, y - hy * 0.35 + s * 0.55);
      ctx.closePath();
      ctx.fillStyle = left;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x + hx, y - hy * 0.35);
      ctx.lineTo(x, y + hy * 0.3);
      ctx.lineTo(x, y + hy * 0.3 + s * 0.55);
      ctx.lineTo(x + hx, y - hy * 0.35 + s * 0.55);
      ctx.closePath();
      ctx.fillStyle = right;
      ctx.fill();

      // Tiny "eye" dots
      ctx.fillStyle = "rgba(8, 12, 14, 0.75)";
      ctx.fillRect(x - s * 0.12, y - hy * 0.05, 2.2 * dpr, 2.2 * dpr);
      ctx.fillRect(x + s * 0.04, y - hy * 0.05, 2.2 * dpr, 2.2 * dpr);
    };

    const drawGoal = (gx: number, baseY: number, pulse: number) => {
      const poleH = 22 * dpr + pulse * 4 * dpr;
      ctx.strokeStyle = "rgba(238, 241, 245, 0.55)";
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.moveTo(gx, baseY);
      ctx.lineTo(gx, baseY - poleH);
      ctx.stroke();

      ctx.fillStyle = `rgba(46, 196, 182, ${0.55 + pulse * 0.4})`;
      ctx.beginPath();
      ctx.moveTo(gx, baseY - poleH);
      ctx.lineTo(gx + 14 * dpr, baseY - poleH + 5 * dpr);
      ctx.lineTo(gx, baseY - poleH + 10 * dpr);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(238, 241, 245, 0.4)";
      ctx.font = `${9 * dpr}px "IBM Plex Mono", Consolas, monospace`;
      ctx.textAlign = "right";
      ctx.fillText("META", gx - 4 * dpr, baseY - poleH + 8 * dpr);
    };

    const draw = (ts: number) => {
      const parent = canvas.parentElement;
      const cssW = parent?.clientWidth ?? 640;
      const cssH = 88;
      if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
        canvas.width = Math.floor(cssW * dpr);
        canvas.height = Math.floor(cssH * dpr);
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "rgba(18, 24, 30, 0.92)");
      bg.addColorStop(1, "rgba(6, 9, 12, 0.96)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const frame = frameRef.current;
      const bands = frame.bands;
      const n = bands.length;
      if (peaksRef.current === null || peaksRef.current.length !== n) {
        peaksRef.current = new Float32Array(n);
      }
      const peaks = peaksRef.current;
      const gap = 1.5 * dpr;
      const barW = Math.max(dpr, (w - gap * (n + 1)) / n);
      const floor = 0.04;
      const live = listening && !error;
      const baseY = h - 5 * dpr;
      const padL = gap + barW * 0.5;
      const padR = w - gap - barW * 0.5;
      const trackW = padR - padL;

      for (let i = 0; i < n; i += 1) {
        const raw = live ? (bands[i] ?? 0) : 0;
        const idle = 0.04 + 0.03 * Math.sin(ts / 900 + i * 0.35);
        const level = Math.max(floor, live ? raw : idle);
        peaks[i] = Math.max(level, (peaks[i] ?? 0) * 0.965);

        const x = gap + i * (barW + gap);
        const barH = level * (h * 0.72);
        const y = h - barH - 6 * dpr;

        const pos = i / Math.max(1, n - 1);
        const r = Math.floor(40 + pos * 40 + level * 120);
        const g = Math.floor(160 + (1 - pos) * 40 + level * 60);
        const b = Math.floor(170 - pos * 80 + level * 40);
        const grad = ctx.createLinearGradient(x, y, x, h);
        grad.addColorStop(0, `rgba(${r},${g},${b},0.95)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0.15)`);
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barW, barH);

        const peakH = (peaks[i] ?? 0) * (h * 0.72);
        const py = h - peakH - 6 * dpr;
        ctx.fillStyle = `rgba(238, 241, 245, ${0.25 + level * 0.45})`;
        ctx.fillRect(x, py, barW, 1.5 * dpr);
      }

      // Game tick
      const run = runRef.current;
      const dt = lastTsRef.current === 0 ? 16 : Math.min(40, ts - lastTsRef.current);
      lastTsRef.current = ts;

      if (playRef.current && live) {
        // Sample only the bar(s) under / just ahead of the cube — never global RMS.
        const bi = Math.min(n - 1, Math.max(0, Math.floor(run.x * (n - 0.001))));
        const nextBi = Math.min(n - 1, bi + 1);
        const local = bands[bi] ?? 0;
        const ahead = bands[nextBi] ?? 0;
        const wallAhead = Math.max(local, ahead);
        const localRise = local - run.lastLocal;
        run.lastLocal = local;

        // Jump only if a bar is physically under the cube and rising into it.
        const onGround = run.y <= 0.001;
        const barTouchesCube =
          local >= TOUCH_LEVEL && run.y * 0.9 < local && local < run.y + 0.55;
        if (onGround && barTouchesCube && localRise >= TOUCH_RISE) {
          run.vy = JUMP_V * (0.75 + Math.min(1, local * 1.4));
        }
        // Blocked against a wall: only a rise in THAT wall launches over.
        if (run.blocked && localRise >= TOUCH_RISE * 0.85 && wallAhead >= WALL) {
          run.vy = Math.max(run.vy, JUMP_V * (0.9 + Math.min(0.5, local)));
        }

        run.vy -= GRAVITY * dt;
        run.y = Math.max(0, run.y + run.vy * dt);
        if (run.y <= 0) {
          run.y = 0;
          run.vy = 0;
        }

        const clears = run.y >= JUMP_CLEAR * Math.min(1, wallAhead / WALL) || wallAhead < WALL;
        run.blocked = wallAhead >= WALL && !clears;

        if (run.blocked) {
          run.stuckMs += dt;
          // Last resort: only the bar under the cube, never room noise / left bass.
          if (run.stuckMs > 1800 && localRise > 0.04 && local > 0.25) {
            run.vy = JUMP_V * 0.85;
            run.stuckMs = 0;
          }
        } else {
          run.stuckMs = 0;
          run.x += SPEED * dt;
        }

        if (run.x >= 0.97) {
          run.x = 0.02;
          run.y = 0;
          run.vy = 0;
          run.lastLocal = 0;
          run.laps += 1;
          run.celebrateUntil = ts + 900;
          setLaps(run.laps);
        }
      } else if (!playRef.current) {
        // Park cube near start when idle
        run.x += (0.02 - run.x) * 0.04;
        run.y *= 0.9;
        run.blocked = false;
      }

      const celebrating = ts < run.celebrateUntil;
      const pulse = celebrating ? 0.5 + 0.5 * Math.sin(ts / 50) : 0.25 + 0.1 * Math.sin(ts / 400);
      drawGoal(padR - 2 * dpr, baseY, pulse);

      if (playRef.current) {
        const cubeX = padL + run.x * trackW;
        const jumpPx = run.y * h * 0.55;
        const cubeY = baseY - 10 * dpr - jumpPx;
        drawCube(cubeX, cubeY, 11 * dpr, run.blocked, celebrating, ts);

        if (celebrating) {
          ctx.fillStyle = `rgba(255, 214, 120, ${0.55 + pulse * 0.4})`;
          ctx.font = `bold ${11 * dpr}px "IBM Plex Mono", Consolas, monospace`;
          ctx.textAlign = "center";
          ctx.fillText(t("scope.lap", { n: run.laps }), w / 2, 18 * dpr);
        } else if (run.blocked) {
          ctx.fillStyle = "rgba(255, 160, 140, 0.55)";
          ctx.font = `${9 * dpr}px "IBM Plex Mono", Consolas, monospace`;
          ctx.textAlign = "center";
          ctx.fillText(t("scope.blocked"), cubeX, cubeY - 16 * dpr);
        }
      }

      // Scan sheen
      const sheenX = ((ts / 18) % (w + 80)) - 40;
      const sheen = ctx.createLinearGradient(sheenX, 0, sheenX + 60 * dpr, 0);
      sheen.addColorStop(0, "rgba(255,255,255,0)");
      sheen.addColorStop(0.5, "rgba(46, 196, 182, 0.08)");
      sheen.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(46, 196, 182, 0.35)";
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.moveTo(8 * dpr, baseY);
      ctx.lineTo(w - 8 * dpr, baseY);
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [error, frameRef, listening, locale, t]);

  return (
    <div className="signal-scope" aria-label={t("scope.title")}>
      <div className="signal-scope__meta">
        <span className="signal-scope__tag">SCOPE</span>
        <span className="signal-scope__hz">
          {play ? t("scope.cubeLap", { n: laps }) : "20 Hz — 8 kHz"}
        </span>
        <button
          type="button"
          className={play ? "signal-scope__btn is-on" : "signal-scope__btn"}
          onClick={() => setPlay((v) => !v)}
          title={t("scope.hint")}
        >
          {play ? "RUN" : "IDLE"}
        </button>
        <button
          type="button"
          className={enabled ? "signal-scope__btn is-on" : "signal-scope__btn"}
          onClick={() => setEnabled((v) => !v)}
        >
          {enabled ? (listening ? "LIVE" : error ? "MIC?" : "…") : "OFF"}
        </button>
      </div>
      <div className="signal-scope__panel">
        <canvas ref={canvasRef} className="signal-scope__canvas" />
        {error ? (
          <p className="signal-scope__error">{t("scope.micDenied", { error })}</p>
        ) : null}
      </div>
    </div>
  );
}
