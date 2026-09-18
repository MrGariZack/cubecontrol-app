import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_KEY = "cubecontrol-auth";
const LEGACY_KEY = "sb-bcknonhusblmamdltuxt-auth-token";

let allowRemove = false;

function parseStoredSession(raw: string): {
  readonly email: string | null;
  readonly hasRefresh: boolean;
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
} {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const session =
      typeof parsed.currentSession === "object" && parsed.currentSession !== null
        ? (parsed.currentSession as Record<string, unknown>)
        : parsed;
    const user =
      typeof session.user === "object" && session.user !== null
        ? (session.user as { email?: unknown })
        : null;
    const accessToken = typeof session.access_token === "string" ? session.access_token : null;
    const refreshToken = typeof session.refresh_token === "string" ? session.refresh_token : null;
    return {
      email: typeof user?.email === "string" ? user.email : null,
      hasRefresh: refreshToken !== null && refreshToken.length > 10,
      accessToken,
      refreshToken,
    };
  } catch {
    return { email: null, hasRefresh: false, accessToken: null, refreshToken: null };
  }
}

export function allowNextAuthRemove(): void {
  allowRemove = true;
}

export async function peekMobileSession(): Promise<{
  readonly email: string | null;
  readonly hasRefresh: boolean;
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
}> {
  const empty = { email: null, hasRefresh: false, accessToken: null, refreshToken: null };
  for (const key of [AUTH_KEY, LEGACY_KEY]) {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) continue;
    const parsed = parseStoredSession(raw);
    if (parsed.hasRefresh) return parsed;
  }
  return empty;
}

export async function clearMobileAuth(): Promise<void> {
  await AsyncStorage.multiRemove([AUTH_KEY, LEGACY_KEY]);
}

export const durableMobileAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    const direct = await AsyncStorage.getItem(key);
    if (direct !== null) return direct;
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacy === null) return null;
    await AsyncStorage.setItem(key, legacy);
    return legacy;
  },
  setItem: (key: string, value: string): Promise<void> => AsyncStorage.setItem(key, value),
  async removeItem(key: string): Promise<void> {
    if (!allowRemove) return;
    allowRemove = false;
    await AsyncStorage.removeItem(key);
  },
};

export { AUTH_KEY as MOBILE_AUTH_STORAGE_KEY };
