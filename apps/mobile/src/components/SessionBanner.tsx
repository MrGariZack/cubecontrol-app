import { StyleSheet, Text, View } from "react-native";
import { useI18n } from "../i18n";
import { colors, fonts } from "../theme/tokens";

const TONE_MISSING = "TONE_MISSING:";

export function formatAppError(error: string | null, t: (key: string, params?: Record<string, string | number>) => string): string | null {
  if (!error) return null;
  if (error.startsWith(TONE_MISSING)) {
    return t("lib.toneMissing", { name: error.slice(TONE_MISSING.length) });
  }
  return error;
}

export function SessionBanner({
  error,
  status,
  busy,
  dark = false,
}: {
  readonly error: string | null;
  readonly status: string | null;
  readonly busy: boolean;
  readonly dark?: boolean;
}) {
  const { t } = useI18n();
  const formatted = formatAppError(error, t);
  if (!formatted && !status && !busy) return null;

  return (
    <View
      style={[styles.wrap, dark && styles.wrapDark]}
      accessibilityLiveRegion="polite"
    >
      {formatted ? (
        <Text style={[styles.error, dark && styles.errorDark]}>{formatted}</Text>
      ) : null}
      {!formatted && busy ? (
        <Text style={[styles.meta, dark && styles.metaDark]}>{t("live.busy")}</Text>
      ) : null}
      {!formatted && !busy && status ? (
        <Text style={[styles.ok, dark && styles.okDark]}>{t("live.applied", { name: status })}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 22 },
  wrapDark: {},
  error: { fontFamily: fonts.body, fontSize: 16, color: colors.error },
  errorDark: { color: colors.error },
  meta: { fontFamily: fonts.body, fontSize: 16, color: colors.muted },
  metaDark: { color: colors.muted },
  ok: { fontFamily: fonts.body, fontSize: 16, color: colors.ok },
  okDark: { color: colors.ok },
});
