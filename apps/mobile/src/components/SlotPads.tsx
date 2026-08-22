import type { PresetSlotId } from "@tonehub/cube-baby-protocol";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, HIT } from "../theme/tokens";

const SLOTS: readonly PresetSlotId[] = ["A", "B", "C"];

type Props = {
  readonly slot: PresetSlotId;
  readonly onSelect: (slot: PresetSlotId) => void;
  readonly labels: Record<PresetSlotId, string>;
  readonly ledLabel: string;
  readonly disabled?: boolean;
};

export function SlotPads({ slot, onSelect, labels, ledLabel, disabled }: Props) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {SLOTS.map((id) => {
        const active = id === slot;
        return (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityLabel={labels[id]}
            accessibilityState={{ selected: active, disabled }}
            accessibilityHint={ledLabel.replace("{slot}", id)}
            disabled={disabled}
            onPress={() => onSelect(id)}
            style={({ pressed }) => [
              styles.pad,
              active && styles.padOn,
              pressed && styles.pressed,
              disabled && styles.dim,
            ]}
          >
            <View style={[styles.led, active && styles.ledOn]} />
            <Text style={[styles.letter, active && styles.letterOn]}>{id}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },
  pad: {
    flex: 1,
    minHeight: 96,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  padOn: { backgroundColor: colors.green, borderColor: colors.green },
  led: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.muted,
  },
  ledOn: { backgroundColor: colors.onAccent },
  letter: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.inkSoft,
    minHeight: HIT / 2,
  },
  letterOn: { color: colors.onAccent },
  pressed: { opacity: 0.9 },
  dim: { opacity: 0.5 },
});
