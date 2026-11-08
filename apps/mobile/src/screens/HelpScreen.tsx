import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { useI18n } from "../i18n";
import { useApp } from "../store/AppStore";
import { colors, fonts, radii } from "../theme/tokens";

const TOPICS = [
  { id: "connect", route: "/" },
  { id: "editor", route: "/(tabs)/live" },
  { id: "tempo", route: "/(tabs)/live" },
  { id: "tuner", route: "/(tabs)/tuner" },
  { id: "tones", route: "/(tabs)/set", section: "tones" },
  { id: "songs", route: "/(tabs)/set", section: "songs" },
  { id: "shows", route: "/(tabs)/set", section: "shows" },
  { id: "stage", route: "/(tabs)/stage" },
  { id: "bank", route: "/(tabs)/device" },
  { id: "ir", route: "/(tabs)/device" },
  { id: "share", route: "/(tabs)/set", section: "more" },
  { id: "sync", route: "/(tabs)/set" },
  { id: "clips", route: "/clips" },
] as const;
const PROGRESS_KEY = "cubecontrol.android.help.v1";
const fold = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function HelpScreen() {
  const { t } = useI18n();
  const { openLibrary, shellOpen } = useApp();
  const [query, setQuery] = useState("");
  const [step, setStep] = useState<number | null>(null);
  const [visited, setVisited] = useState<readonly number[]>([]);
  const [practice, setPractice] = useState<number | null>(null);
  const topic = step === null ? null : TOPICS[step];
  const practiceSong = practice === 4 ? "guide.sampleSong2" : "guide.sampleSong";
  const nextUnvisited = TOPICS.findIndex((_, index) => !visited.includes(index));
  const search = fold(query.trim());
  const results = TOPICS.flatMap((entry, index) => {
    const title = t("guide." + entry.id + ".title");
    const body = t("guide." + entry.id + ".body");
    return fold(title + " " + body).includes(search) ? [{ entry, index, title }] : [];
  });

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(PROGRESS_KEY).then((value) => {
      if (!mounted || !value) return;
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) setVisited((old) => [...new Set([
        ...old, ...parsed.filter((index) => Number.isInteger(index) && index >= 0 && index < TOPICS.length),
      ])]);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  function go(index: number) {
    setStep(index);
    setPractice(null);
    if (!visited.includes(index)) {
      const updated = [...visited, index];
      setVisited(updated);
      void AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(updated)).catch(() => undefined);
    }
  }

  function close() {
    if (step !== null || practice !== null) {
      setStep(null);
      setPractice(null);
    } else if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  function openTopic(entry: typeof TOPICS[number]) {
    if (entry.route.startsWith("/(tabs)") && !shellOpen) openLibrary();
    if (entry.id === "stage") router.replace({ pathname: entry.route, params: { guide: "stage" } });
    else if ("section" in entry) router.replace({ pathname: entry.route, params: { section: entry.section } });
    else router.replace(entry.route);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">{t("guide.title")}</Text>
          <Button variant="ghost" label={t(step !== null || practice !== null ? "guide.index" : "guide.close")} onPress={close} />
        </View>
        {topic && step !== null ? (
          <View style={styles.focus}>
            <Text style={styles.count}>{t("guide.progress", { current: step + 1, total: TOPICS.length })}</Text>
            <Text style={styles.lesson} accessibilityRole="header">{t("guide." + topic.id + ".title")}</Text>
            <Text style={styles.copy}>{t("guide." + topic.id + ".body")}</Text>
            <Button variant="secondary" label={t("guide.open")} onPress={() => openTopic(topic)} />
            <View style={styles.row}>
              <Button variant="ghost" label={t("stage.prev")} disabled={step === 0} onPress={() => go(step - 1)} />
              <Button label={t(step + 1 < TOPICS.length ? "stage.nextBtn" : "guide.done")}
                onPress={() => step + 1 < TOPICS.length ? go(step + 1) : setStep(null)} />
            </View>
          </View>
        ) : practice !== null ? (
          <View style={styles.focus}>
            <Text style={styles.lesson}>{t("guide.practice")}</Text>
            <Text style={styles.copy}>{t("guide.practiceHint")}</Text>
            {practice >= 1 ? <Text style={styles.count}>{t("guide.sampleShow")}</Text> : null}
            {practice === 1 || practice === 2 ? <Text style={styles.copy}>{t("guide.sampleSong")}</Text> : null}
            {practice >= 3 ? (
              <>
                <Text style={styles.lesson}>{t(practiceSong)}</Text>
                <Text style={styles.copy}>{practice === 3 ? t("stage.next") + " · " + t("guide.sampleSong2") : t("stage.end")}</Text>
              </>
            ) : null}
            <Button label={t(["lib.newShow", "lib.addSongToShow", "lib.stageMode", "stage.nextBtn", "guide.done"][practice] ?? "guide.done")}
              onPress={() => setPractice(practice < 4 ? practice + 1 : null)} />
          </View>
        ) : (
          <>
            <Text style={styles.copy}>{t("guide.intro")}</Text>
            <Button label={t("guide.start")} onPress={() => go(Math.max(0, nextUnvisited))} />
            <Button variant="secondary" label={t("guide.practice")} onPress={() => setPractice(0)} />
            <TextInput style={styles.search} value={query} onChangeText={setQuery}
              placeholder={t("guide.search")} placeholderTextColor={colors.muted}
              accessibilityLabel={t("guide.search")} returnKeyType="search" />
            {results.map(({ entry, index, title }) => (
              <Button key={entry.id} variant="secondary" label={title} onPress={() => go(index)} />
            ))}
            {results.length === 0 ? <Text style={styles.copy}>{t("guide.noResults")}</Text> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { width: "100%", maxWidth: 620, alignSelf: "center", padding: 16, gap: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, color: colors.ink, fontFamily: fonts.brand, fontSize: 27 },
  copy: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  focus: { padding: 16, gap: 14, backgroundColor: colors.surface, borderRadius: radii.panel, borderWidth: 1, borderColor: colors.green },
  lesson: { color: colors.ink, fontFamily: fonts.brand, fontSize: 23 },
  count: { color: colors.green, fontFamily: fonts.bodyBold, fontSize: 13 },
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
  search: { minHeight: 48, paddingHorizontal: 14, color: colors.ink, backgroundColor: colors.surface, borderRadius: radii.control, fontSize: 16 },
});
