/** CubeControl tokens — same dark studio as desktop `styles.css`.
 *  Brand TTF (Syne / Outfit) live in assets/fonts and copy on Android prebuild
 *  via plugins/withBrandFonts.js (expo-font native is excluded). Until that
 *  APK is installed, fall back to system families so Metro never blanks text.
 */
export const colors = {
  /** Desktop --accent */
  green: "#2EC4B6",
  greenMuted: "rgba(46, 196, 182, 0.18)",
  /** Desktop --bg-0 */
  bg: "#07090C",
  /** Desktop --bg-1 */
  bg1: "#0E1116",
  /** Desktop --ink */
  ink: "#EEF1F5",
  /** Desktop --ink-soft */
  inkSoft: "#A9B3C1",
  /** Desktop --mute */
  muted: "#6D7888",
  muted2: "#6D7888",
  /** Cards / inputs — desktop --bg-2 */
  cream: "#161B22",
  surface: "#161B22",
  surface2: "#1E2530",
  /** Text on accent buttons — desktop connect CTA */
  onAccent: "#041512",
  /** Desktop --danger */
  error: "#EF8B7E",
  ok: "#6EE7B7",
  warn: "#C4A35A",
  line: "rgba(255, 255, 255, 0.10)",
  stageBg: "#07090C",
  stageInk: "#EEF1F5",
  stageMuted: "#A9B3C1",
  stagePad: "#161B22",
  stageLine: "rgba(255, 255, 255, 0.10)",
} as const;

export const fonts = {
  brand: "sans-serif-black",
  display: "sans-serif-medium",
  body: "sans-serif",
  bodyBold: "sans-serif-medium",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

/** Minimum TalkBack / touch target (pt). */
export const HIT = 44;

export const typeScale = {
  body: 16,
  bodyLine: 24,
  title: 28,
  brand: 52,
  stageNow: 52,
} as const;
