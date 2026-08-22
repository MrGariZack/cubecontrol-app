import type { PresetSlotId } from "@tonehub/cube-baby-protocol";
import { StyleSheet, Text, View } from "react-native";
import { useI18n } from "../i18n";
import { colors, fonts } from "../theme/tokens";
import { Button } from "./Button";

const ALL_SLOTS: readonly PresetSlotId[] = ["A", "B", "C"];

type Props = {
  readonly busy: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly activeSlot: PresetSlotId;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onSave: () => void;
  readonly onCopyTo: (to: PresetSlotId) => void;
};

export function LiveToolbar({
  busy,
  canUndo,
  canRedo,
  activeSlot,
  onUndo,
  onRedo,
  onSave,
  onCopyTo,
}: Props) {
  const { t } = useI18n();

  return (
    <View style={styles.root} accessibilityLabel={t("toolbar.aria")}>
      <View style={styles.row}>
        <Button
          variant="secondary"
          label={t("toolbar.undo")}
          disabled={busy || !canUndo}
          onPress={onUndo}
          style={styles.btn}
        />
        <Button
          variant="secondary"
          label={t("toolbar.redo")}
          disabled={busy || !canRedo}
          onPress={onRedo}
          style={styles.btn}
        />
        <Button
          label={t("toolbar.saveSlot", { slot: activeSlot })}
          disabled={busy}
          onPress={onSave}
          style={styles.save}
        />
      </View>
      <View style={styles.copyRow} accessibilityLabel={t("toolbar.copyAria")}>
        <Text style={styles.copyLabel}>{t("toolbar.copyTo")}</Text>
        {ALL_SLOTS.map((slot) => (
          <Button
            key={slot}
            variant="secondary"
            label={slot}
            accessibilityLabel={t("toolbar.copyTitle", { slot })}
            disabled={busy || slot === activeSlot}
            onPress={() => onCopyTo(slot)}
            style={styles.copyBtn}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: { flexGrow: 1, minWidth: 88, paddingHorizontal: 12 },
  save: { flexGrow: 2, minWidth: 120, paddingHorizontal: 12 },
  copyRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  copyLabel: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink, marginRight: 4 },
  copyBtn: { minWidth: 52, paddingHorizontal: 12 },
});
