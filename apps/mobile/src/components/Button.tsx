import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, fonts, HIT } from "../theme/tokens";

type Variant = "primary" | "secondary" | "ghost" | "stage" | "stagePrimary";

type Props = Omit<PressableProps, "style"> & {
  readonly label: string;
  readonly variant?: Variant;
  readonly loading?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly children?: ReactNode;
};

export function Button({
  label,
  variant = "primary",
  loading = false,
  disabled,
  style,
  children,
  ...rest
}: Props) {
  const palette = palettes[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) || loading, busy: loading }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.bg, borderColor: palette.border, borderWidth: palette.borderWidth },
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        children ?? <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const palettes: Record<Variant, { bg: string; fg: string; border: string; borderWidth: number }> = {
  primary: { bg: colors.green, fg: colors.onAccent, border: colors.green, borderWidth: 0 },
  secondary: { bg: "transparent", fg: colors.green, border: colors.line, borderWidth: 1 },
  ghost: { bg: "transparent", fg: colors.inkSoft, border: "transparent", borderWidth: 0 },
  stage: { bg: colors.stagePad, fg: colors.stageInk, border: colors.stageLine, borderWidth: 1 },
  stagePrimary: { bg: colors.green, fg: colors.onAccent, border: colors.green, borderWidth: 0 },
};

const styles = StyleSheet.create({
  base: {
    minHeight: HIT,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    letterSpacing: 0.2,
  },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.45 },
});
