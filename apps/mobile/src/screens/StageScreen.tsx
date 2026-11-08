import { useMemo, useState } from "react";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PanResponder, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { SessionBanner } from "../components/SessionBanner";
import { useKeepAwake } from "../hooks/useKeepAwake";
import { useI18n } from "../i18n";
import { applySongMaybeIr } from "../library/applySongIr";
import { useApp } from "../store/AppStore";
import { colors, fonts, radii } from "../theme/tokens";

const SLOTS = ["A", "B", "C"] as const;

export function StageScreen() {
  const { t } = useI18n();
  const app = useApp();
  const { width } = useWindowDimensions();
  const { guide } = useLocalSearchParams<{ guide?: string }>();
  const highlighting = guide === "stage";
  const focused = useIsFocused();
  useKeepAwake(focused);
  const [writing, setWriting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [didWrite, setDidWrite] = useState(false);

  const show = app.library.shows.find((item) => item.id === app.activeShowId);
  const songs = new Map(app.library.songs.map((song) => [song.id, song]));
  const ordered = (show?.songIds ?? []).flatMap((id) => {
    const song = songs.get(id);
    return song ? [song] : [];
  });
  const index = Math.min(app.songIndex, Math.max(0, ordered.length - 1));
  const current = ordered[index];
  const next = ordered[index + 1];
  const pedalStatus = app.connection?.mode === "demo"
    ? "stage.pedalDemo"
    : app.connection ? "stage.pedalReady" : "stage.pedalOffline";
  const songDetails = [current?.bpm ? current.bpm + " BPM" : null, current?.delayNote, current?.key]
    .filter(Boolean)
    .join(" · ");
  const busy = app.busy || writing;
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      !busy && Math.abs(gesture.dx) > 28 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx < -48 && index + 1 < ordered.length) app.setSongIndex(index + 1);
      if (gesture.dx > 48 && index > 0) app.setSongIndex(index - 1);
    },
  }), [app.setSongIndex, busy, index, ordered.length]);

  function navigate(delta: number) {
    app.setSongIndex(index + delta);
    setWriteError(null);
    setDidWrite(false);
  }

  async function write(action: () => Promise<void>) {
    if (!app.connection || busy) return;
    setWriting(true);
    setWriteError(null);
    app.clearError();
    try {
      await action();
      setDidWrite(true);
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : String(error));
    } finally {
      setWriting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.titleGroup}>
              <Text style={styles.title} accessibilityRole="header">{t("nav.stage")}</Text>
              {show ? <Text style={styles.showName}>{show.name}</Text> : null}
            </View>
            <Button variant="secondary" label={t("nav.set")} style={styles.smallButton}
              onPress={() => router.navigate({ pathname: "/(tabs)/set", params: { section: "shows" } })} />
          </View>

          {highlighting ? (
            <View style={styles.guide}>
              <Text style={[styles.connectionText, styles.guideCopy]}>{t("guide.stage.body")}</Text>
              <Button variant="secondary" label={t("guide.close")} onPress={() => router.setParams({ guide: undefined })} />
            </View>
          ) : null}
          <View style={[styles.connection, app.connection && styles.connected, highlighting && styles.dim]}
            accessibilityLiveRegion="polite">
            <View style={[styles.dot, app.connection && styles.dotConnected]} />
            <Text style={styles.connectionText}>
              {t(pedalStatus)}
            </Text>
          </View>

          {current ? (
            <>
              <View style={[styles.nowCard, highlighting && styles.highlight]} {...pan.panHandlers}>
                <View style={styles.nowBar}>
                  <Text style={styles.nowLabel}>{t("stage.now")}</Text>
                  <Text style={styles.count} accessibilityLiveRegion="polite">
                    {t("stage.count", { current: index + 1, total: ordered.length })}
                  </Text>
                </View>
                <Text style={[styles.now, width < 360 && styles.nowCompact]} accessibilityRole="header">
                  {current.name}
                </Text>
                {songDetails ? <Text style={styles.meta}>{songDetails}</Text> : null}
              </View>

              <View style={[styles.nextCard, highlighting && styles.dim]}>
                <Text style={styles.label}>{t("stage.next")}</Text>
                <Text style={styles.next}>{next?.name ?? t("stage.end")}</Text>
              </View>

              <View style={[styles.row, highlighting && styles.dim]}>
                <Button variant="stage" label={t("stage.prev")} disabled={busy || index === 0}
                  onPress={() => navigate(-1)} style={styles.flexButton} />
                <Button variant="stage" label={t("stage.nextBtn")} disabled={busy || !next}
                  onPress={() => navigate(1)} style={styles.flexButton} />
              </View>

              <View style={[styles.actions, highlighting && styles.dim]}>
                <Button variant="stagePrimary" label={t("stage.applyLive")} disabled={busy || !app.connection}
                  onPress={() => void write(() => applySongMaybeIr(t, current, app.library, app))} />
                <Text style={styles.label}>{t("stage.assign")}</Text>
                <View style={styles.row}>
                  {SLOTS.map((slot) => (
                    <Button key={slot} variant="stage" label={slot} accessibilityLabel={t("stage.assign" + slot)}
                      style={styles.flexButton} disabled={busy || !app.connection}
                      onPress={() => void write(() => app.assignSongToSlot(current.id, slot))} />
                  ))}
                </View>
                <SessionBanner error={writeError ?? app.error} status={didWrite ? app.status : null} busy={busy} />
              </View>
            </>
          ) : (
            <View style={styles.nextCard}>
              <Text style={styles.next}>{t(show ? "stage.emptyShow" : "stage.empty")}</Text>
            </View>
          )}
          <Button variant="ghost" label={t("guide.title")} onPress={() => router.push("/help")} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stageBg },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  content: { width: "100%", maxWidth: 620, alignSelf: "center", gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  titleGroup: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: colors.ink, fontFamily: fonts.brand, fontSize: 24 },
  showName: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 14 },
  smallButton: { paddingHorizontal: 12 },
  guide: { padding: 12, gap: 8, borderRadius: radii.panel, backgroundColor: colors.bg1 },
  guideCopy: { flex: 0 },
  dim: { opacity: 0.46 },
  highlight: { borderColor: colors.green },
  connection: {
    flexDirection: "row", alignItems: "center", gap: 8, padding: 10,
    borderRadius: radii.control, backgroundColor: colors.bg1, borderWidth: 1, borderColor: colors.line,
  },
  connected: { borderColor: colors.greenMuted },
  dot: { width: 7, height: 7, borderRadius: radii.pill, backgroundColor: colors.warn },
  dotConnected: { backgroundColor: colors.green },
  connectionText: { flex: 1, color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13 },
  nowCard: {
    gap: 8, padding: 18, borderRadius: radii.panel, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.greenMuted,
  },
  nowBar: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
  nowLabel: { color: colors.green, fontFamily: fonts.bodyBold, fontSize: 14 },
  count: { color: colors.inkSoft, fontVariant: ["tabular-nums"], fontSize: 14 },
  now: { color: colors.stageInk, fontFamily: fonts.brand, fontSize: 34 },
  nowCompact: { fontSize: 29 },
  meta: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 15 },
  nextCard: { gap: 4, padding: 14, borderRadius: radii.panel, backgroundColor: colors.bg1 },
  label: { color: colors.inkSoft, fontFamily: fonts.bodyBold, fontSize: 13 },
  next: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 18 },
  row: { flexDirection: "row", gap: 8 },
  flexButton: { flex: 1, minWidth: 0, paddingHorizontal: 6 },
  actions: { gap: 10, padding: 12, borderRadius: radii.panel, backgroundColor: colors.bg1 },
});

export default StageScreen;
