import { Pressable, StyleSheet, Text } from "react-native";
import { colors, fonts, HIT } from "../theme/tokens";

type Props = {
  readonly label: string;
  readonly on: boolean;
  readonly accent: string;
  readonly disabled?: boolean;
  readonly onChange: (on: boolean) => void;
};

export function SectionToggle({ label, on, accent, disabled, onChange }: Props) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled }}
      disabled={disabled}
      onPress={() => onChange(!on)}
      style={({ pressed }) => [
        styles.root,
        { borderColor: on ? accent : colors.line },
        on && { backgroundColor: accent },
        pressed && styles.pressed,
        disabled && styles.dim,
      ]}
    >
      <Text style={[styles.dot, on && styles.dotOn]}>{on ? "●" : "○"}</Text>
      <Text style={[styles.label, on && styles.labelOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: HIT,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    backgroundColor: colors.cream,
  },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  labelOn: { color: colors.onAccent },
  dot: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  dotOn: { color: colors.onAccent },
  pressed: { opacity: 0.88 },
  dim: { opacity: 0.45 },
});
