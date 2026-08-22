/**
 * Android file VIEW/SEND arrives as content:// or file://.
 * Expo Router would otherwise treat that as a route → "Unmatched Route".
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (looksLikeShareOpen(path)) return "/";
    return path || "/";
  } catch {
    return "/";
  }
}

function looksLikeShareOpen(path: string): boolean {
  const lower = path.trim().toLowerCase();
  if (!lower) return false;
  if (lower.startsWith("content:") || lower.startsWith("file:")) return true;
  if (lower.includes(".json") || lower.includes(".cubecontrol") || lower.includes(".zip")) return true;
  if (lower.includes("com.android.providers") || lower.includes("/document/")) return true;
  if (lower.includes("msf:") || lower.includes("raw%3a") || lower.includes("raw:")) return true;
  return false;
}
