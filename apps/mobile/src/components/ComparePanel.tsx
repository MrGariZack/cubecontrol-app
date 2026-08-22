import { LIVE_PARAM_MAX, type PresetSlotId } from "@tonehub/cube-baby-protocol";
import type { MatchVolumesSource, SlotDiffRow } from "../device/bank";
import type { LiveParamsSnapshot } from "../library/types";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { useI18n } from "../i18n";
import { colors, fonts, HIT } from "../theme/tokens";

const SLOT_PAIRS: readonly { from: PresetSlotId; to: PresetSlotId }[] = [
  { from: "A", to: "B" },
  { from: "A", to: "C" },
  { from: "B", to: "A" },
  { from: "B", to: "C" },
  { from: "C", to: "A" },
  { from: "C", to: "B" },
];

type Props = {
  readonly rows: readonly SlotDiffRow[];
  readonly busy: boolean;
  readonly liveParams: LiveParamsSnapshot;
  readonly liveDirty: boolean;
  readonly activeSlot: PresetSlotId;
  readonly onClose: () => void;
  readonly onMatchVolumes: (source: MatchVolumesSource) => void;
  readonly onCopySlot: (from: PresetSlotId, to: PresetSlotId) => void;
};

export function ComparePanel({
  rows,
  busy,
  liveParams,
  liveDirty,
  activeSlot,
  onClose,
  onMatchVolumes,
  onCopySlot,
}: Props) {
  const { t } = useI18n();
  const volumeRow = rows.find((row) => row.param === "volume");
  const otherRows = rows.filter((row) => row.param !== "volume");
  const ordered = volumeRow === undefined ? rows : [volumeRow, ...otherRows];
  const diffs = rows.filter((row) => row.differs);
  const volumeDiffers = volumeRow?.differs ?? false;
  const liveVolume = liveParams.volume;
  const volMax = LIVE_PARAM_MAX.volume;

  return (
    <View style={styles.root} accessibilityLabel={t("compare.aria")}>
      <View style={styles.head}>
        <Text style={styles.title}>Compare A / B / C</Text>
        <Button variant="ghost" label={t("compare.close")} disabled={busy} onPress={onClose} />
      </View>
      <Text style={styles.hint}>{t("compare.explain")}</Text>
      {liveDirty ? <Text style={styles.dirty}>{t("compare.dirty", { slot: activeSlot })}</Text> : null}

      {volumeRow ? (
        <View style={[styles.vol, volumeDiffers ? styles.volWarn : styles.volOk]}>
          <Text style={styles.volHead}>
            {t("compare.volumes")} · {volumeDiffers ? t("compare.volDiff") : t("compare.volSame")}
          </Text>
          {(
            [
              ["A", volumeRow.a],
              ["B", volumeRow.b],
              ["C", volumeRow.c],
              [`Live (${activeSlot})${liveDirty ? " *" : ""}`, liveVolume],
            ] as const
          ).map(([label, value]) => (
            <View key={label} style={styles.meter}>
              <Text style={styles.meterLabel}>{label}</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round((value / volMax) * 100)}%` }]} />
              </View>
              <Text style={styles.meterValue}>{value}</Text>
            </View>
          ))}
          <View style={styles.actions}>
            <Button
              variant="secondary"
              label={t("compare.equalA", { v: volumeRow.a })}
              disabled={busy}
              onPress={() => onMatchVolumes("A")}
            />
            <Button
              variant="secondary"
              label={t("compare.equalB", { v: volumeRow.b })}
              disabled={busy}
              onPress={() => onMatchVolumes("B")}
            />
            <Button
              variant="secondary"
              label={t("compare.equalC", { v: volumeRow.c })}
              disabled={busy}
              onPress={() => onMatchVolumes("C")}
            />
            <Button
              label={t("compare.equalLive", { v: liveVolume })}
              disabled={busy}
              onPress={() => onMatchVolumes("live")}
            />
          </View>
        </View>
      ) : null}

      <Text style={styles.subHead}>{t("compare.copyPreset")}</Text>
      <Text style={styles.hint}>{t("compare.copyHint")}</Text>
      <View style={styles.copyRow}>
        {SLOT_PAIRS.map(({ from, to }) => (
          <Button
            key={`${from}-${to}`}
            variant="secondary"
            label={liveDirty && from === activeSlot ? `${from}→${to} *` : `${from}→${to}`}
            disabled={busy}
            onPress={() => onCopySlot(from, to)}
            style={styles.copyBtn}
          />
        ))}
      </View>

      <Text style={styles.meta}>
        {diffs.length === 0 ? t("compare.identical") : t("compare.diffCount", { n: diffs.length })}
      </Text>

      <ScrollView horizontal style={styles.tableWrap}>
        <View>
          <View style={styles.tr}>
            {["Param", "A", "B", "C", `Live (${activeSlot})`].map((h) => (
              <Text key={h} style={[styles.td, styles.th]}>
                {h}
              </Text>
            ))}
          </View>
          {ordered.map((row) => {
            const liveValue = liveParams[row.param as keyof LiveParamsSnapshot];
            const bankActive = activeSlot === "A" ? row.a : activeSlot === "B" ? row.b : row.c;
            return (
              <View key={row.param} style={[styles.tr, row.differs && styles.trDiff]}>
                <Text style={styles.td}>{row.param}</Text>
                <Text style={styles.td}>{row.a}</Text>
                <Text style={styles.td}>{row.b}</Text>
                <Text style={styles.td}>{row.c}</Text>
                <Text style={[styles.td, liveValue !== bankActive && styles.liveDiff]}>{liveValue}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const COL = 88;

const styles = StyleSheet.create({
  root: { gap: 12, padding: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, flex: 1 },
  hint: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.muted },
  dirty: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.error },
  vol: { gap: 8, padding: 12 },
  volWarn: { backgroundColor: "rgba(239, 139, 126, 0.16)" },
  volOk: { backgroundColor: colors.cream },
  volHead: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  meter: { flexDirection: "row", alignItems: "center", gap: 8 },
  meterLabel: { width: 88, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  track: { flex: 1, height: 10, backgroundColor: colors.surface2, overflow: "hidden" },
  fill: { height: 10, backgroundColor: colors.green },
  meterValue: { width: 36, fontFamily: fonts.body, fontSize: 14, color: colors.muted, textAlign: "right" },
  actions: { gap: 8 },
  subHead: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  copyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  copyBtn: { minWidth: HIT + 24, paddingHorizontal: 10 },
  meta: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  tableWrap: { maxHeight: 280 },
  tr: { flexDirection: "row" },
  trDiff: { backgroundColor: "rgba(239, 139, 126, 0.12)" },
  th: { fontFamily: fonts.bodyBold },
  td: { width: COL, paddingVertical: 6, fontFamily: fonts.body, fontSize: 13, color: colors.ink },
  liveDiff: { color: colors.error, fontFamily: fonts.bodyBold },
});
