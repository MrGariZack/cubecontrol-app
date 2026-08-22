import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useScopeSpectrum } from "../audio/useScopeSpectrum";
import { useI18n } from "../i18n";
import { colors, fonts } from "../theme/tokens";

const WALL = 0.38;
const JUMP_CLEAR = 0.48;
const SPEED = 0.000055;
const GRAVITY = 0.0000028;
const JUMP_V = 0.00115;
const TOUCH_RISE = 0.07;
const TOUCH_LEVEL = 0.3;
const BAR_MAX = 38;
const RAIL_H = 52;

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

type Props = {
  readonly active: boolean;
};

export function SignalScopeHud({ active }: Props) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(true);
  const [play, setPlay] = useState(true);
  const [laps, setLaps] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: 32 }, () => 0.06));
  const [cube, setCube] = useState({ x: 0.02, y: 0, blocked: false, celebrating: false });
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
  const { listening, frameRef } = useScopeSpectrum(active && enabled);

  useEffect(() => {
    let raf = 0;
    const tick = (ts: number) => {
      const frame = frameRef.current;
      const bands = frame.bands;
      const n = bands.length;
      const live = listening;
      const next: number[] = [];
      for (let i = 0; i < n; i += 1) {
        const raw = live ? (bands[i] ?? 0) : 0;
        const idle = 0.05 + 0.03 * Math.sin(ts / 900 + i * 0.35);
        next.push(Math.max(0.04, live ? raw : idle));
      }

      const run = runRef.current;
      const dt = lastTsRef.current === 0 ? 16 : Math.min(40, ts - lastTsRef.current);
      lastTsRef.current = ts;

      if (playRef.current && live) {
        const bi = Math.min(n - 1, Math.max(0, Math.floor(run.x * (n - 0.001))));
        const local = bands[bi] ?? 0;
        const ahead = bands[Math.min(n - 1, bi + 1)] ?? 0;
        const wallAhead = Math.max(local, ahead);
        const localRise = local - run.lastLocal;
        run.lastLocal = local;
        const onGround = run.y <= 0.001;
        const barTouchesCube = local >= TOUCH_LEVEL && run.y * 0.9 < local && local < run.y + 0.55;
        if (onGround && barTouchesCube && localRise >= TOUCH_RISE) {
          run.vy = JUMP_V * (0.75 + Math.min(1, local * 1.4));
        }
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
        run.x += (0.02 - run.x) * 0.04;
        run.y *= 0.9;
        run.blocked = false;
      }

      setLevels(next);
      setCube({
        x: run.x,
        y: run.y,
        blocked: run.blocked,
        celebrating: ts < run.celebrateUntil,
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frameRef, listening]);

  if (!enabled) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("scope.title")}
        onPress={() => setEnabled(true)}
        style={styles.collapsed}
      />
    );
  }

  const cubeColor = cube.celebrating ? "#FFD678" : cube.blocked ? "#EF8B7E" : "#2EC4B6";

  return (
    <View style={styles.hud} pointerEvents="box-none" accessibilityLabel={t("scope.title")}>
      <View style={styles.rail} pointerEvents="none">
        {levels.map((level, i) => (
          <View key={i} style={styles.barSlot}>
            <View
              style={[
                styles.bar,
                {
                  height: Math.max(3, level * BAR_MAX),
                  backgroundColor: barColor(i, levels.length, level),
                },
              ]}
            />
          </View>
        ))}
        {play ? (
          <View
            pointerEvents="none"
            style={[
              styles.cube,
              {
                left: `${Math.round(cube.x * 92 + 2)}%`,
                bottom: 6 + cube.y * 28,
                backgroundColor: cubeColor,
                borderColor: cube.blocked ? "#C45A4A" : "#1A8A80",
              },
            ]}
          />
        ) : null}
      </View>
      <View style={styles.meta} pointerEvents="box-none">
        <Text style={styles.tag}>SCOPE</Text>
        <Text style={styles.hz} numberOfLines={1}>
          {play ? t("scope.cubeLap", { n: laps }) : "80 Hz — 8 kHz"}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setPlay((v) => !v)}
          style={[styles.chip, play && styles.chipOn]}
        >
          <Text style={styles.chipText}>{play ? "RUN" : "IDLE"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setEnabled(false)}
          style={styles.chip}
        >
          <Text style={styles.chipText}>×</Text>
        </Pressable>
      </View>
    </View>
  );
}

function barColor(index: number, total: number, level: number): string {
  const pos = index / Math.max(1, total - 1);
  const r = Math.floor(40 + pos * 40 + level * 120);
  const g = Math.floor(160 + (1 - pos) * 40 + level * 60);
  const b = Math.floor(170 - pos * 80 + level * 40);
  return `rgba(${r},${g},${b},0.85)`;
}

const styles = StyleSheet.create({
  hud: {
    height: RAIL_H + 18,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(7, 9, 12, 0.62)",
    borderWidth: 1,
    borderColor: "rgba(46, 196, 182, 0.22)",
  },
  collapsed: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(46, 196, 182, 0.35)",
  },
  rail: {
    height: RAIL_H,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingBottom: 4,
    gap: 2,
  },
  barSlot: {
    flex: 1,
    height: BAR_MAX,
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
  cube: {
    position: "absolute",
    width: 10,
    height: 10,
    borderWidth: 1,
    transform: [{ rotate: "45deg" }],
  },
  meta: {
    position: "absolute",
    top: 4,
    left: 8,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tag: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.green,
  },
  hz: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.muted,
  },
  chip: {
    minWidth: 28,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(46, 196, 182, 0.35)",
    backgroundColor: "rgba(46, 196, 182, 0.08)",
  },
  chipOn: { backgroundColor: "rgba(46, 196, 182, 0.2)" },
  chipText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.green,
    textAlign: "center",
  },
});
