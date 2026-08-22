import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "../i18n";
import { colors, fonts, HIT } from "../theme/tokens";
import { Button } from "./Button";

const TIER_IDS = ["live", "bank", "ir"] as const;

const TIER_ACCENT: Record<(typeof TIER_IDS)[number], string> = {
  live: colors.green,
  bank: colors.warn,
  ir: colors.error,
};

type Props = {
  readonly onAccepted: () => void;
  readonly onCancel?: () => void;
};

export function SafetyGate({ onAccepted, onCancel }: Props) {
  const { t } = useI18n();
  const [readRisks, setReadRisks] = useState(false);
  const [ownRisk, setOwnRisk] = useState(false);
  const [noOfficial, setNoOfficial] = useState(false);
  const canContinue = readRisks && ownRisk && noOfficial;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>{t("safety.eyebrow")}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {t("safety.title")}
        </Text>
        <Text style={styles.lead}>{t("safety.lead")}</Text>

        {TIER_IDS.map((id) => (
          <View key={id} style={[styles.tier, { borderLeftColor: TIER_ACCENT[id] }]}>
            <Text style={styles.tierLevel}>{t(`safety.tier.${id}.level`)}</Text>
            <Text style={styles.tierTitle}>{t(`safety.tier.${id}.title`)}</Text>
            <Text style={styles.tierBody}>{t(`safety.tier.${id}.body`)}</Text>
          </View>
        ))}

        {[1, 2, 3, 4, 5, 6].map((n) => (
          <Text key={n} style={styles.bullet}>
            · {t(`safety.bullet.${n}`)}
          </Text>
        ))}

        <CheckRow
          label={t("safety.check.risks")}
          checked={readRisks}
          onChange={setReadRisks}
        />
        <CheckRow label={t("safety.check.own")} checked={ownRisk} onChange={setOwnRisk} />
        <CheckRow
          label={t("safety.check.cab8")}
          checked={noOfficial}
          onChange={setNoOfficial}
        />

        <Button label={t("safety.cta")} disabled={!canContinue} onPress={onAccepted} />
        {onCancel ? (
          <Button variant="ghost" label={t("common.cancel")} onPress={onCancel} />
        ) : null}
        <Text style={styles.foot}>{t("safety.foot")}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (next: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      style={styles.check}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <Text style={styles.tick}>✓</Text> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 22, paddingBottom: 32, gap: 12 },
  eyebrow: {
    fontFamily: fonts.body,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.muted2,
    marginTop: 8,
  },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, marginTop: 4 },
  lead: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.muted },
  tier: { padding: 12, gap: 4, backgroundColor: colors.surface, borderLeftWidth: 4 },
  tierLevel: { fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 0.6, color: colors.muted2 },
  tierTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  tierBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.muted },
  bullet: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  check: { flexDirection: "row", alignItems: "flex-start", gap: 12, minHeight: HIT, paddingVertical: 6 },
  box: {
    width: 24,
    height: 24,
    marginTop: 2,
    borderWidth: 1.5,
    borderColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
  },
  boxOn: { backgroundColor: colors.green },
  tick: { color: colors.onAccent, fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 16 },
  checkLabel: { flex: 1, fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.ink },
  foot: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted2 },
});
