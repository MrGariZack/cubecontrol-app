import { useEffect, useRef } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, HIT } from "../theme/tokens";

type Props = {
  readonly label: string;
  readonly value: number;
  readonly max: number;
  readonly onChange: (next: number) => void;
  readonly minusLabel: string;
  readonly plusLabel: string;
  readonly disabled?: boolean;
  readonly accent?: string;
};

const HOLD_DELAY_MS = 280;
const HOLD_EVERY_MS = 45;

function clamp(next: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(next)));
}

export function ParamStepper({
  label,
  value,
  max,
  onChange,
  minusLabel,
  plusLabel,
  disabled,
  accent,
}: Props) {
  const valueRef = useRef(value);
  const maxRef = useRef(max);
  const onChangeRef = useRef(onChange);
  const draggingRef = useRef(false);
  const trackWidthRef = useRef(1);
  const trackPageXRef = useRef(0);
  const trackRef = useRef<View>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdEveryRef = useRef<ReturnType<typeof setInterval> | null>(null);

  valueRef.current = value;
  maxRef.current = max;
  onChangeRef.current = onChange;

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (holdEveryRef.current) clearInterval(holdEveryRef.current);
    };
  }, []);

  function emit(next: number) {
    const clamped = clamp(next, maxRef.current);
    if (clamped === valueRef.current) return;
    valueRef.current = clamped;
    onChangeRef.current(clamped);
  }

  function valueFromPageX(pageX: number) {
    const width = Math.max(1, trackWidthRef.current);
    const t = Math.max(0, Math.min(1, (pageX - trackPageXRef.current) / width));
    return Math.round(t * maxRef.current);
  }

  function measureTrack() {
    trackRef.current?.measureInWindow((x, _y, width) => {
      trackPageXRef.current = x;
      if (width > 0) trackWidthRef.current = width;
    });
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        draggingRef.current = true;
        measureTrack();
        emit(valueFromPageX(event.nativeEvent.pageX));
      },
      onPanResponderMove: (event) => {
        emit(valueFromPageX(event.nativeEvent.pageX));
      },
      onPanResponderRelease: () => {
        draggingRef.current = false;
      },
      onPanResponderTerminate: () => {
        draggingRef.current = false;
      },
    }),
  ).current;

  function startHold(delta: number) {
    if (disabled) return;
    emit(valueRef.current + delta);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (holdEveryRef.current) clearInterval(holdEveryRef.current);
    holdTimerRef.current = setTimeout(() => {
      holdEveryRef.current = setInterval(() => {
        emit(valueRef.current + delta);
      }, HOLD_EVERY_MS);
    }, HOLD_DELAY_MS);
  }

  function stopHold() {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (holdEveryRef.current) clearInterval(holdEveryRef.current);
    holdTimerRef.current = null;
    holdEveryRef.current = null;
  }

  const ratio = max <= 0 ? 0 : value / max;
  const fill = accent ?? colors.green;
  const atMin = disabled || value <= 0;
  const atMax = disabled || value >= max;

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value} accessibilityLiveRegion="none">
          {value}/{max}
        </Text>
      </View>
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={minusLabel}
          disabled={atMin}
          onPressIn={() => startHold(-1)}
          onPressOut={stopHold}
          delayLongPress={10_000}
          style={({ pressed }) => [
            styles.step,
            { backgroundColor: fill },
            pressed && styles.pressed,
            atMin && styles.dim,
          ]}
        >
          <Text style={styles.stepLabel}>−</Text>
        </Pressable>
        <View
          style={styles.track}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min: 0, max, now: value }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "increment") emit(valueRef.current + 1);
            if (event.nativeEvent.actionName === "decrement") emit(valueRef.current - 1);
          }}
          onLayout={(event) => {
            trackWidthRef.current = event.nativeEvent.layout.width;
            measureTrack();
          }}
          ref={trackRef}
          {...pan.panHandlers}
        >
          <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: fill }]} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={plusLabel}
          disabled={atMax}
          onPressIn={() => startHold(1)}
          onPressOut={stopHold}
          delayLongPress={10_000}
          style={({ pressed }) => [
            styles.step,
            { backgroundColor: fill },
            pressed && styles.pressed,
            atMax && styles.dim,
          ]}
        >
          <Text style={styles.stepLabel}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 0.8, textTransform: "uppercase", color: colors.ink },
  value: { fontFamily: fonts.body, fontSize: 16, color: colors.muted },
  controls: { flexDirection: "row", alignItems: "center", gap: 10 },
  step: {
    width: HIT,
    height: HIT,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
  },
  stepLabel: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.onAccent, lineHeight: 24 },
  track: {
    flex: 1,
    height: HIT,
    backgroundColor: "rgba(0,0,0,0.28)",
    justifyContent: "center",
    overflow: "hidden",
  },
  fill: { height: 16, backgroundColor: colors.green },
  pressed: { opacity: 0.88 },
  dim: { opacity: 0.4 },
});
