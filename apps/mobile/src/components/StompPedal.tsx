import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, HIT } from "../theme/tokens";
import type { PedalLook } from "../studio/pedalLooks";

export type PedalKnobPreview = {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly max: number;
};

type Props = {
  readonly look: PedalLook;
  readonly title: string;
  readonly selected: boolean;
  readonly engaged: boolean;
  readonly canBypass: boolean;
  readonly knobs: readonly PedalKnobPreview[];
  readonly disabled?: boolean;
  readonly onSelect: () => void;
  readonly onBypass?: () => void;
};

export function StompPedal({
  look,
  title,
  selected,
  engaged,
  canBypass,
  knobs,
  disabled,
  onSelect,
  onBypass,
}: Props) {
  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: look.chassis,
          borderColor: selected ? look.chassisHi : look.chassisLo,
        },
        selected && styles.shellOpen,
        !engaged && styles.bypassed,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={`${title}. ${look.model}`}
        disabled={disabled}
        onPress={onSelect}
        style={({ pressed }) => [styles.face, pressed && styles.pressed]}
      >
        <View style={[styles.lip, { backgroundColor: look.chassisHi }]} />
        <View style={[styles.screw, styles.screwTl]} />
        <View style={[styles.screw, styles.screwTr]} />
        <View style={[styles.screw, styles.screwBl]} />
        <View style={[styles.screw, styles.screwBr]} />

        <View style={styles.knobRow}>
          {knobs.map((knob) => (
            <PedalKnobDot
              key={knob.id}
              value={knob.value}
              max={knob.max}
              cap={look.knobCap}
              tick={look.knobTick}
            />
          ))}
        </View>

        <Text style={[styles.title, { color: look.silk }]} numberOfLines={1}>
          {title}
        </Text>

        <View style={styles.deck}>
          <View
            style={[
              styles.led,
              { backgroundColor: engaged ? look.ledOn : "rgba(0,0,0,0.45)" },
              engaged && styles.ledOn,
            ]}
          />
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel={title}
            accessibilityState={{ checked: engaged, disabled: disabled || !canBypass }}
            disabled={disabled || !canBypass}
            onPress={onBypass}
            hitSlop={6}
            style={({ pressed }) => [
              styles.foot,
              pressed && styles.pressed,
              (!canBypass || disabled) && styles.footLocked,
            ]}
          >
            <View style={styles.footRing} />
            <View style={styles.footCap} />
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
}

function PedalKnobDot({
  value,
  max,
  cap,
  tick,
}: {
  readonly value: number;
  readonly max: number;
  readonly cap: string;
  readonly tick: string;
}) {
  const ratio = max <= 0 ? 0 : value / max;
  const angle = -135 + ratio * 270;
  return (
    <View style={[styles.knob, { backgroundColor: cap }]}>
      <View style={[styles.knobPointer, { transform: [{ rotate: `${angle}deg` }] }]}>
        <View style={[styles.knobTick, { backgroundColor: tick }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    minWidth: 0,
    borderRadius: 10,
    borderWidth: 2,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  face: { paddingBottom: 8 },
  shellOpen: {
    elevation: 8,
    shadowOpacity: 0.5,
  },
  bypassed: { opacity: 0.62 },
  pressed: { opacity: 0.92 },
  lip: { height: 5, opacity: 0.55 },
  screw: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#2A2A2A",
    borderWidth: 1,
    borderColor: "#4A4A4A",
    zIndex: 2,
  },
  screwTl: { top: 7, left: 7 },
  screwTr: { top: 7, right: 7 },
  screwBl: { bottom: 7, left: 7 },
  screwBr: { bottom: 7, right: 7 },
  knobRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#0A0A0A",
    alignItems: "center",
    justifyContent: "center",
  },
  knobPointer: {
    position: "absolute",
    width: 22,
    height: 22,
    alignItems: "center",
  },
  knobTick: {
    width: 2,
    height: 7,
    marginTop: 2,
    borderRadius: 1,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 15,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    textAlign: "center",
    marginTop: 4,
  },
  deck: {
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  led: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.45)",
  },
  ledOn: {
    shadowColor: "#FF2A22",
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 3,
  },
  foot: {
    width: HIT,
    height: HIT,
    alignItems: "center",
    justifyContent: "center",
  },
  footLocked: { opacity: 0.85 },
  footRing: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#C5C0B6",
    borderWidth: 2,
    borderColor: "#8A8580",
  },
  footCap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#4A4A4A",
    borderWidth: 2,
    borderColor: "#2A2A2A",
  },
});
