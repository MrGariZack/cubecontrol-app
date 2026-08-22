import { StatusBar } from "expo-status-bar";
import { useIsFocused } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { SessionBanner } from "../components/SessionBanner";
import { useKeepAwake } from "../hooks/useKeepAwake";
import { useI18n, type TFunction } from "../i18n";
import { GUITAR_STRINGS, nearestGuitarString } from "../tuner/pitchMath";
import { usePitchTuner, type TunerRange } from "../tuner/usePitchTuner";
import type { PitchInputInfo } from "@tonehub/midi-host-android";
import { colors, fonts, HIT } from "../theme/tokens";

type TunerMode = "chromatic" | "guitar";

const CENTS_SPAN = 50;
const IN_TUNE_CENTS = 5;

function clampCents(cents: number): number {
  return Math.max(-CENTS_SPAN, Math.min(CENTS_SPAN, cents));
}

function isCubeLabel(label: string): boolean {
  return /cube|cuvave|m-?vave/i.test(label);
}

function friendlyInputLabel(item: PitchInputInfo, t: TFunction): string {
  if (isCubeLabel(item.label)) return t("tuner.inputCube");
  if (item.kind === "usb") return item.label.trim() || t("tuner.inputUsb");
  if (item.kind === "headset" || item.kind === "line") return t("tuner.inputJack");
  if (item.builtInMic) return t("tuner.inputMic");
  return item.label.trim() || t("tuner.inputUsb");
}

function uniqueInputs(inputs: readonly PitchInputInfo[]): PitchInputInfo[] {
  const seen = new Set<string>();
  const out: PitchInputInfo[] = [];
  for (const item of inputs) {
    const key = isCubeLabel(item.label)
      ? "cube"
      : item.builtInMic
        ? "mic"
        : `${item.kind}:${item.label.trim().toLowerCase() || item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function centsToPercent(cents: number): number {
  return 50 + (clampCents(cents) / CENTS_SPAN) * 50;
}

export function TunerScreen() {
  const { t } = useI18n();
  const focused = useIsFocused();
  const [mode, setMode] = useState<TunerMode>("chromatic");
  const [a4, setA4] = useState(440);
  const [range, setRange] = useState<TunerRange>("guitar");
  const [a4Draft, setA4Draft] = useState("440");
  const tuner = usePitchTuner({ active: focused, a4, range });
  const note = tuner.reading?.note ?? null;
  const inputs = useMemo(() => uniqueInputs(tuner.inputs), [tuner.inputs]);

  useKeepAwake(tuner.listening);

  const guitar = useMemo(() => {
    if (note === null) return null;
    const string = nearestGuitarString(note.midi);
    const cents = (note.midi + note.cents / 100 - string.midi) * 100;
    return { string, cents };
  }, [note]);

  const cents = mode === "guitar" && guitar ? guitar.cents : (note?.cents ?? 0);
  const live = note !== null;
  const inTune = live && Math.abs(cents) <= IN_TUNE_CENTS;
  const error =
    tuner.error === "TUNER_NATIVE_MISSING"
      ? t("tuner.nativeMissing")
      : tuner.error === "TUNER_MIC_DENIED"
        ? t("tuner.micDenied")
        : tuner.error;
  const sourceName = tuner.source
    ? friendlyInputLabel(
        {
          id: tuner.source.deviceId ?? 0,
          kind: tuner.source.kind,
          label: tuner.source.label,
          builtInMic: tuner.source.builtInMic,
        },
        t,
      )
    : null;
  const signalWidth = Math.min(100, tuner.level.rms * 1200);
  const status = !live
    ? null
    : inTune
      ? t("tuner.inTune")
      : cents > 0
        ? t("tuner.sharp")
        : t("tuner.flat");
  const centsLabel = `${cents >= 0 ? "+" : ""}${Math.round(cents)} ¢`;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} accessibilityRole="header">
          {t("nav.tuner")}
        </Text>
        <SessionBanner error={error} status={null} busy={false} />

        <View
          style={[styles.stage, inTune && styles.stageOk, live && !inTune && styles.stageLive]}
          accessibilityLiveRegion="polite"
          accessibilityLabel={live ? `${note.name} ${status ?? ""} ${centsLabel}` : t("tuner.playNote")}
        >
          <View style={styles.ends}>
            <Text style={[styles.end, live && cents < -IN_TUNE_CENTS && styles.endHotFlat]}>
              ♭  {t("tuner.flat")}
            </Text>
            <Text style={[styles.end, live && cents > IN_TUNE_CENTS && styles.endHotSharp]}>
              {t("tuner.sharp")}  ♯
            </Text>
          </View>

          <View style={styles.track}>
            <View style={styles.okZone} />
            <View style={styles.center} />
            {live ? (
              <View
                style={[
                  styles.needle,
                  { left: `${centsToPercent(cents)}%` },
                  inTune ? styles.needleOk : cents < 0 ? styles.needleFlat : styles.needleSharp,
                ]}
              />
            ) : null}
          </View>
          <View style={styles.scale}>
            <Text style={styles.tick}>-50</Text>
            <Text style={styles.tick}>0</Text>
            <Text style={styles.tick}>+50</Text>
          </View>

          {live ? (
            <>
              <Text style={[styles.note, inTune && styles.noteOk]}>
                {mode === "guitar" && guitar ? guitar.string.label : note.name}
                {mode === "chromatic" ? note.octave : ""}
              </Text>
              <Text
                style={[
                  styles.status,
                  inTune ? styles.statusOk : cents < 0 ? styles.statusFlat : styles.statusSharp,
                ]}
              >
                {status}
              </Text>
              <Text style={[styles.cents, inTune && styles.centsOk]}>{centsLabel}</Text>
              {mode === "guitar" ? (
                <View style={styles.strings}>
                  {GUITAR_STRINGS.map((string) => (
                    <View
                      key={string.id}
                      style={[
                        styles.stringPad,
                        guitar?.string.id === string.id && styles.stringPadOn,
                        guitar?.string.id === string.id && inTune && styles.stringPadOk,
                      ]}
                    >
                      <Text
                        style={[
                          styles.string,
                          guitar?.string.id === string.id && styles.stringOn,
                        ]}
                      >
                        {string.label}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.play}>
              {tuner.listening ? t("tuner.playNote") : t("tuner.enableMic")}
            </Text>
          )}
        </View>

        <View
          style={styles.meterTrack}
          accessibilityLabel={t("tuner.signal")}
          accessibilityValue={{ now: Math.round(signalWidth) }}
        >
          <View
            style={[styles.meterFill, { width: `${signalWidth}%` }, tuner.level.rms >= 0.004 && styles.meterOk]}
          />
        </View>

        <View style={styles.modes} accessibilityRole="tablist">
          {(["chromatic", "guitar"] as const).map((id) => (
            <Button
              key={id}
              variant={mode === id ? "primary" : "secondary"}
              label={t(id === "chromatic" ? "tuner.chromatic" : "tuner.guitar")}
              onPress={() => setMode(id)}
              style={styles.mode}
            />
          ))}
        </View>

        {sourceName ? (
          <Text style={styles.meta}>
            {tuner.source?.builtInMic
              ? t("tuner.sourceMic")
              : t("tuner.inputLine", { name: sourceName })}
          </Text>
        ) : null}

        {inputs.length > 1 ? (
          <View style={styles.row} accessibilityLabel={t("tuner.input")}>
            {inputs.map((item) => (
              <Button
                key={item.id}
                variant={item.id === tuner.inputId ? "primary" : "secondary"}
                label={friendlyInputLabel(item, t)}
                onPress={() => tuner.selectInput(item.id)}
                style={styles.mode}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.row}>
          {(["guitar", "bass", "wide"] as const).map((id) => (
            <Button
              key={id}
              variant={range === id ? "primary" : "secondary"}
              label={t(id === "guitar" ? "tuner.guitar" : id === "bass" ? "tuner.bass" : "tuner.wide")}
              onPress={() => setRange(id)}
              style={styles.mode}
            />
          ))}
        </View>

        <View style={styles.a4Row}>
          <Text style={styles.label}>A4</Text>
          <TextInput
            accessibilityLabel="A4"
            keyboardType="number-pad"
            value={a4Draft}
            onChangeText={(raw) => {
              setA4Draft(raw);
              const n = Number(raw);
              if (Number.isFinite(n) && n >= 415 && n <= 466) setA4(Math.round(n));
            }}
            style={styles.input}
          />
          <Button
            variant={tuner.listening ? "primary" : "secondary"}
            label={tuner.listening ? t("tuner.listening") : t("tuner.startMic")}
            onPress={() => {
              if (tuner.listening) tuner.stop();
              else void tuner.start();
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 22, paddingBottom: 28, gap: 14 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  modes: { flexDirection: "row", gap: 8 },
  mode: { flex: 1, paddingHorizontal: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  a4Row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  input: {
    width: 72,
    minHeight: HIT,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingHorizontal: 8,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.cream,
  },
  stage: {
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 14,
    backgroundColor: colors.bg1,
    borderWidth: 1,
    borderColor: colors.line,
  },
  stageLive: {
    borderColor: "rgba(239, 139, 126, 0.35)",
  },
  stageOk: {
    backgroundColor: colors.greenMuted,
    borderColor: colors.green,
  },
  ends: { flexDirection: "row", justifyContent: "space-between" },
  end: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.muted },
  endHotFlat: { color: colors.warn },
  endHotSharp: { color: colors.error },
  track: {
    height: 28,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    position: "relative",
    overflow: "hidden",
  },
  okZone: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: `${50 - (IN_TUNE_CENTS / CENTS_SPAN) * 50}%`,
    width: `${(IN_TUNE_CENTS / CENTS_SPAN) * 100}%`,
    backgroundColor: "rgba(46, 196, 182, 0.22)",
  },
  center: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    marginLeft: -1,
    width: 2,
    backgroundColor: colors.green,
  },
  needle: {
    position: "absolute",
    top: 2,
    bottom: 2,
    width: 6,
    marginLeft: -3,
    backgroundColor: colors.ink,
  },
  needleOk: { backgroundColor: colors.ok },
  needleFlat: { backgroundColor: colors.warn },
  needleSharp: { backgroundColor: colors.error },
  scale: { flexDirection: "row", justifyContent: "space-between" },
  tick: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  note: {
    fontFamily: fonts.display,
    fontSize: 72,
    color: colors.ink,
    textAlign: "center",
    marginTop: 4,
  },
  noteOk: { color: colors.ok },
  status: {
    fontFamily: fonts.display,
    fontSize: 28,
    textAlign: "center",
    letterSpacing: 1,
  },
  statusOk: { color: colors.ok },
  statusFlat: { color: colors.warn },
  statusSharp: { color: colors.error },
  cents: {
    fontFamily: fonts.bodyBold,
    fontSize: 20,
    color: colors.inkSoft,
    textAlign: "center",
  },
  centsOk: { color: colors.ok },
  strings: { flexDirection: "row", gap: 6, marginTop: 4 },
  stringPad: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  stringPadOn: { borderColor: colors.green },
  stringPadOk: { backgroundColor: colors.greenMuted },
  string: { fontFamily: fonts.display, fontSize: 18, color: colors.muted2 },
  stringOn: { color: colors.ink },
  meta: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  play: {
    fontFamily: fonts.body,
    fontSize: 18,
    lineHeight: 26,
    color: colors.muted,
    textAlign: "center",
    paddingVertical: 28,
  },
  meterTrack: {
    height: 6,
    backgroundColor: colors.surface2,
    overflow: "hidden",
  },
  meterFill: {
    height: 6,
    backgroundColor: colors.muted,
  },
  meterOk: { backgroundColor: colors.green },
});

export default TunerScreen;
