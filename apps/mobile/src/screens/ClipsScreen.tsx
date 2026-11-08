import { LIVE_PARAM_MAX, type LiveParamName } from "@tonehub/cube-baby-protocol";
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType } from "expo-camera";
import { File, Paths } from "expo-file-system";
import { requireOptionalNativeModule } from "expo-modules-core";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { BackHandler, Linking, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { useI18n } from "../i18n";
import { useApp } from "../store/AppStore";
import { colors, fonts, radii } from "../theme/tokens";

const DIALS = [
  "volume", "cabinet", "reverb", "mix", "feedback", "time", "modulation", "tone", "gain",
] as const satisfies readonly LiveParamName[];
const renderer = requireOptionalNativeModule<{
  render(source: string, slot: string, values: number[]): Promise<string>;
  saveToGallery(source: string, name: string): Promise<boolean>;
  setLandscape(landscape: boolean): Promise<void>;
}>("CubeControlClipRenderer");

export function ClipsScreen() {
  const { t } = useI18n();
  const { live, slot } = useApp();
  const [cameraPermission, requestCamera] = useCameraPermissions();
  const [micPermission, requestMic] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [preview, setPreview] = useState(false);
  const [ready, setReady] = useState(false);
  const [overlay, setOverlay] = useState(true);
  const [landscape, setLandscape] = useState(false);
  const [phase, setPhase] = useState<"idle" | "recording" | "stopping" | "rendering">("idle");
  const [take, setTake] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const camera = useRef<CameraView>(null);
  const recording = useRef(false);
  const waiting = phase !== "idle" || saving;

  useEffect(() => {
    if (!waiting) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, [waiting]);

  useEffect(() => () => {
    void renderer?.setLandscape(false).catch(() => undefined);
  }, []);

  async function changeFraming() {
    if (!renderer || waiting) return;
    try {
      await renderer.setLandscape(!landscape);
      setLandscape(!landscape);
    } catch {
      setMessage(t("clips.orientationError"));
    }
  }

  async function openPreview() {
    setMessage(null);
    try {
      const cam = cameraPermission?.granted ? cameraPermission : await requestCamera();
      const mic = micPermission?.granted ? micPermission : await requestMic();
      if (!cam.granted || !mic.granted) {
        setMessage(t("clips.permissions"));
        return;
      }
      setReady(false);
      setPreview(true);
    } catch {
      setMessage(t("clips.cameraError"));
    }
  }

  async function record() {
    if (!ready || !camera.current || recording.current || waiting) return;
    recording.current = true;
    setMessage(null);
    setPhase("recording");
    const values = live ? DIALS.map((dial) => live[dial] / Math.max(1, LIVE_PARAM_MAX[dial])) : null;
    let raw: string | undefined;
    try {
      raw = (await camera.current.recordAsync({ maxDuration: 300 }))?.uri;
      if (!raw) throw new Error("No video was recorded");
      setPreview(false);
      setSaved(false);
      if (overlay && values && renderer) {
        setPhase("rendering");
        const composed = await renderer.render(raw, slot, values);
        setTake(composed);
        try { new File(raw).delete(); } catch { /* cache can be cleaned by Android */ }
      } else {
        setTake(raw);
      }
    } catch {
      setMessage(t(raw ? "clips.overlayError" : "clips.cameraError"));
      if (raw) setTake(raw);
    } finally {
      recording.current = false;
      setPhase("idle");
    }
  }

  function stop() {
    if (phase !== "recording") return;
    setPhase("stopping");
    camera.current?.stopRecording();
  }

  async function save() {
    if (!take || saved || saving) return;
    setSaving(true);
    try {
      const name = "CubeControl-" + new Date().toISOString().replaceAll(":", "-") + ".mp4";
      const inGallery = await renderer?.saveToGallery(take, name);
      if (!inGallery) new File(take).copy(new File(Paths.document, name));
      setSaved(true);
      setMessage(t("clips.saved"));
    } catch {
      setMessage(t("clips.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    if (!take) return;
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing unavailable");
      await Sharing.shareAsync(take, { mimeType: "video/mp4", dialogTitle: t("clips.share") });
    } catch {
      setMessage(t("clips.shareError"));
    }
  }

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">{t("clips.title")}</Text>
          <Button variant="ghost" label={t("guide.close")} disabled={waiting} onPress={leave} />
        </View>
        <Text style={styles.copy}>{t("clips.intro")}</Text>
        {Platform.OS !== "android" ? <Text style={styles.copy}>{t("clips.unavailable")}</Text> : (
          <>
            {take ? <ClipReview uri={take} landscape={landscape} /> : preview ? (
              <CameraView key={facing} ref={camera} mode="video" videoQuality="720p" facing={facing}
                style={[styles.camera, landscape && styles.wide]}
                onCameraReady={() => setReady(true)}
                onMountError={() => {
                  setPreview(false);
                  setMessage(t("clips.cameraError"));
                }} />
            ) : null}
            {phase === "recording" ? <Button label={t("clips.stop")} onPress={stop} /> : waiting ? (
              <Text accessibilityLiveRegion="polite" style={styles.copy}>{t("clips.processing")}</Text>
            ) : take ? (
              <View style={styles.stack}>
                <Button label={t("clips.save")} disabled={saved} onPress={() => void save()} />
                <Button variant="secondary" label={t("clips.share")} onPress={() => void share()} />
                <Button variant="ghost" label={t("clips.new")} onPress={() => {
                  setTake(null);
                  setSaved(false);
                  setMessage(null);
                }} />
              </View>
            ) : preview ? (
              <View style={styles.stack}>
                <Button label={t("clips.record")} disabled={!ready} onPress={() => void record()} />
                <Button variant="secondary" label={t("clips.flip")} onPress={() => {
                  setReady(false);
                  setFacing(facing === "back" ? "front" : "back");
                }} />
              </View>
            ) : (
              <Button label={t("clips.preview")} onPress={() => void openPreview()} />
            )}
            {!take && !waiting ? (
              <View style={styles.card}>
                <View style={styles.row}>
                  <Text style={[styles.copy, styles.fill]}>{t("clips.overlay")}</Text>
                  <Switch value={overlay && Boolean(live && renderer)} disabled={!live || !renderer}
                    accessibilityLabel={t("clips.overlay")} onValueChange={setOverlay} />
                </View>
                <Text style={styles.copy}>{t(live && renderer ? "clips.overlayHint" : "clips.overlayUnavailable")}</Text>
                {renderer && !preview ? (
                  <Button variant="secondary" label={t(landscape ? "clips.portrait" : "clips.landscape")}
                    onPress={() => void changeFraming()} />
                ) : null}
                <Text style={styles.copy}>{t("clips.audio")}</Text>
              </View>
            ) : null}
            {message ? <Text style={styles.copy} accessibilityLiveRegion="polite">{message}</Text> : null}
            {(cameraPermission && !cameraPermission.granted && !cameraPermission.canAskAgain) ||
              (micPermission && !micPermission.granted && !micPermission.canAskAgain) ? (
              <Button variant="secondary" label={t("clips.settings")} onPress={() => void Linking.openSettings()} />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ClipReview({ uri, landscape }: { readonly uri: string; readonly landscape: boolean }) {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} style={[styles.camera, landscape && styles.wide]} nativeControls contentFit="contain" />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { width: "100%", maxWidth: 620, alignSelf: "center", padding: 16, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, color: colors.ink, fontFamily: fonts.brand, fontSize: 27 },
  copy: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  fill: { flex: 1 },
  camera: { height: 420, aspectRatio: 9 / 16, maxWidth: "100%", alignSelf: "center", borderRadius: radii.panel, overflow: "hidden" },
  wide: { width: "100%", height: undefined, aspectRatio: 16 / 9, maxHeight: 290 },
  stack: { gap: 8 },
  card: { padding: 14, gap: 10, backgroundColor: colors.bg1, borderRadius: radii.panel },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
});
