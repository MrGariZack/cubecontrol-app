import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useI18n } from "../i18n";
import {
  DEFAULT_DELAY_NOTE,
  DELAY_NOTE_IDS,
  clampBpm,
  delayMsForNote,
  grooveTimeByte,
  timeByteToMs,
  type DelayNoteId,
} from "../music/delaySync";
import { colors, fonts, HIT } from "../theme/tokens";
import { Button } from "./Button";

type Props = {
  readonly bpm: number;
  readonly note: DelayNoteId;
  readonly synced: boolean;
  readonly liveTime: number;
  readonly tapCount: number;
  readonly disabled?: boolean;
  readonly onTap: () => void;
  readonly onBpmChange: (bpm: number) => void;
  readonly onNoteChange: (note: DelayNoteId) => void;
};

export function DelayTapBar({
  bpm,
  note,
  synced,
  liveTime,
  tapCount,
  disabled = false,
  onTap,
  onBpmChange,
  onNoteChange,
}: Props) {
  const { t } = useI18n();
  const focused = useRef(false);
  const [draft, setDraft] = useState(String(bpm));

  useEffect(() => {
    if (!focused.current) setDraft(String(bpm));
  }, [bpm]);

  const numeric = Number(draft);
  const valid = Number.isFinite(numeric) && numeric >= 40 && numeric <= 240;
  const previewTime = valid ? grooveTimeByte(clampBpm(numeric), note) : null;
  const previewMs = valid ? delayMsForNote(clampBpm(numeric), note) : null;
  const displayTime = synced && previewTime !== null ? previewTime : liveTime;
  const displayMs = Math.round(timeByteToMs(displayTime));

  function commitDraft(raw: string) {
    if (raw === "") return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 40 || n > 240) return;
    onBpmChange(clampBpm(n));
  }

  return (
    <View style={styles.root} accessibilityLabel={t("groove.aria")}>
      <View style={styles.row}>
        <View style={styles.bpmField}>
          <Text style={styles.bpmLabel}>{t("groove.bpm")}</Text>
          <TextInput
            accessibilityLabel={t("groove.bpm")}
            keyboardType="number-pad"
            inputMode="numeric"
            editable={true}
            value={draft}
            placeholder="120"
            placeholderTextColor={colors.muted2}
            onFocus={() => {
              focused.current = true;
            }}
            onBlur={() => {
              focused.current = false;
              commitDraft(draft);
              setDraft(String(bpm));
            }}
            onChangeText={(raw) => {
              setDraft(raw);
              const n = Number(raw);
              if (Number.isFinite(n) && n >= 40 && n <= 240) onBpmChange(clampBpm(n));
            }}
            style={styles.input}
          />
        </View>
        <Button
          label={t("groove.tap")}
          loading={false}
          disabled={disabled}
          onPress={onTap}
          style={styles.tap}
        />
      </View>

      <View style={styles.notes} accessibilityRole="tablist" accessibilityLabel={t("groove.note")}>
        {DELAY_NOTE_IDS.map((id) => (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={t("live.note", { note: id })}
            accessibilityState={{ selected: id === note, disabled }}
            disabled={disabled}
            onPress={() => onNoteChange(id)}
            style={({ pressed }) => [
              styles.chip,
              id === note && styles.chipOn,
              id === DEFAULT_DELAY_NOTE && id !== note && styles.chipDefault,
              pressed && styles.pressed,
              disabled && styles.dim,
            ]}
          >
            <Text style={[styles.chipLabel, id === note && styles.chipLabelOn]}>
              {id === "1/8d" ? "1/8." : id}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.meta} accessibilityLiveRegion="polite">
        {synced && previewMs !== null
          ? t("groove.readout", {
              time: displayTime,
              ms: Math.round(previewMs),
              actual: displayMs,
            })
          : t("groove.readoutFree", { time: liveTime, actual: displayMs })}
        {tapCount > 0 ? ` · ${t("groove.taps", { n: tapCount })}` : ""}
        {!synced ? ` · ${t("groove.free")}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  bpmField: { flex: 1, gap: 4 },
  bpmLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.muted },
  input: {
    minHeight: HIT,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: 18,
    color: colors.ink,
    backgroundColor: colors.cream,
  },
  tap: { minHeight: HIT, minWidth: 88, paddingHorizontal: 16 },
  notes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: HIT,
    minWidth: HIT + 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.green,
    backgroundColor: "transparent",
  },
  chipOn: { backgroundColor: colors.green },
  chipDefault: { borderStyle: "dashed" },
  chipLabel: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.green },
  chipLabelOn: { color: colors.onAccent },
  meta: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.muted },
  pressed: { opacity: 0.88 },
  dim: { opacity: 0.45 },
});
