import { Outfit_500Medium, Outfit_700Bold, useFonts as useOutfit } from "@expo-google-fonts/outfit";
import { Syne_700Bold, Syne_800ExtraBold, useFonts as useSyne } from "@expo-google-fonts/syne";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { connectDemoSession, type DemoConnection } from "../device/demoConnect";

type Phase = "idle" | "connecting" | "connected" | "error";

export function ConnectScreen() {
  const [syneLoaded] = useSyne({ Syne_700Bold, Syne_800ExtraBold });
  const [outfitLoaded] = useOutfit({ Outfit_500Medium, Outfit_700Bold });
  const fontsReady = syneLoaded && outfitLoaded;

  const [phase, setPhase] = useState<Phase>("idle");
  const [connection, setConnection] = useState<DemoConnection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const brandOpacity = useRef(new Animated.Value(0)).current;
  const brandY = useRef(new Animated.Value(18)).current;
  const ctaScale = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (!fontsReady) return;
    Animated.parallel([
      Animated.timing(brandOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(brandY, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 1400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [fontsReady, brandOpacity, brandY, pulse]);

  useEffect(() => {
    return () => {
      void connection?.close();
    };
  }, [connection]);

  async function onConnect() {
    if (phase === "connecting") return;
    setError(null);
    setPhase("connecting");
    Animated.sequence([
      Animated.timing(ctaScale, { toValue: 0.96, duration: 90, useNativeDriver: true }),
      Animated.timing(ctaScale, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();

    try {
      await connection?.close();
      const next = await connectDemoSession();
      setConnection(next);
      setPhase("connected");
    } catch (err) {
      setConnection(null);
      setPhase("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onDisconnect() {
    await connection?.close();
    setConnection(null);
    setPhase("idle");
    setError(null);
  }

  if (!fontsReady) {
    return (
      <View style={styles.root}>
        <ActivityIndicator color="#1F6B5C" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Animated.View style={[styles.signal, { opacity: pulse }]} />

      <Animated.View style={{ opacity: brandOpacity, transform: [{ translateY: brandY }] }}>
        <Text style={styles.brand}>CubeControl</Text>
        <Text style={styles.headline}>Habla con tu CUBE Baby</Text>
        <Text style={styles.support}>
          Laboratorio UI sobre el hardware-core. Hoy: sesión demo sin pedal.
        </Text>
      </Animated.View>

      <View style={styles.actions}>
        {phase !== "connected" ? (
          <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void onConnect()}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
              disabled={phase === "connecting"}
            >
              {phase === "connecting" ? (
                <ActivityIndicator color="#F4F7F5" />
              ) : (
                <Text style={styles.ctaLabel}>Conectar (demo)</Text>
              )}
            </Pressable>
          </Animated.View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => void onDisconnect()}
            style={({ pressed }) => [styles.secondary, pressed && styles.ctaPressed]}
          >
            <Text style={styles.secondaryLabel}>Desconectar</Text>
          </Pressable>
        )}

        {phase === "connected" && connection ? (
          <View style={styles.statusBlock}>
            <Text style={styles.statusTitle}>{connection.deviceName}</Text>
            <Text style={styles.statusMeta}>
              {connection.inputPortId} → {connection.outputPortId}
            </Text>
            <Text style={styles.statusMeta}>{connection.bankSummary}</Text>
            <Text style={styles.modeTag}>modo demo · FakeCubeBabyTransport</Text>
          </View>
        ) : null}

        {phase === "error" && error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#E8EEEA",
    paddingHorizontal: 28,
    paddingTop: 72,
    paddingBottom: 40,
    justifyContent: "space-between",
  },
  signal: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: "#9FD0C2",
    top: -120,
    right: -140,
  },
  brand: {
    fontFamily: "Syne_800ExtraBold",
    fontSize: 56,
    lineHeight: 60,
    color: "#10231F",
    letterSpacing: -1.2,
  },
  headline: {
    marginTop: 18,
    fontFamily: "Syne_700Bold",
    fontSize: 28,
    lineHeight: 34,
    color: "#1A3530",
  },
  support: {
    marginTop: 12,
    maxWidth: 340,
    fontFamily: "Outfit_500Medium",
    fontSize: 16,
    lineHeight: 24,
    color: "#3D564F",
  },
  actions: {
    gap: 18,
  },
  cta: {
    alignSelf: "stretch",
    backgroundColor: "#1F6B5C",
    paddingVertical: 18,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 58,
  },
  ctaPressed: {
    opacity: 0.88,
  },
  ctaLabel: {
    fontFamily: "Outfit_700Bold",
    fontSize: 17,
    color: "#F4F7F5",
    letterSpacing: 0.2,
  },
  secondary: {
    alignSelf: "stretch",
    borderWidth: 1.5,
    borderColor: "#1F6B5C",
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryLabel: {
    fontFamily: "Outfit_700Bold",
    fontSize: 16,
    color: "#1F6B5C",
  },
  statusBlock: {
    gap: 4,
  },
  statusTitle: {
    fontFamily: "Syne_700Bold",
    fontSize: 22,
    color: "#10231F",
  },
  statusMeta: {
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
    color: "#3D564F",
  },
  modeTag: {
    marginTop: 8,
    fontFamily: "Outfit_500Medium",
    fontSize: 12,
    color: "#5C7A72",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  error: {
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
    color: "#8B2E2E",
  },
});
