import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * File-backed auth storage for Electron. Supabase wipes the session when a
 * token refresh fails (paused project, 521/522). For CubeControl that is
 * only a sync login, so we keep tokens on disk unless the user signs out.
 */
export class DurableFileAuthStorage {
  readonly #file: string;
  #allowRemove = false;

  constructor(file: string) {
    this.#file = file;
  }

  allowNextRemove(): void {
    this.#allowRemove = true;
  }

  async getItem(key: string): Promise<string | null> {
    const bag = await this.#read();
    if (bag[key]) return bag[key];
    for (const [storedKey, value] of Object.entries(bag)) {
      if (storedKey === key) continue;
      if (!parseStoredSession(value).hasRefresh) continue;
      bag[key] = value;
      await this.#write(bag);
      return value;
    }
    return null;
  }

  async setItem(key: string, value: string): Promise<void> {
    const bag = await this.#read();
    bag[key] = value;
    await this.#write(bag);
  }

  async removeItem(key: string): Promise<void> {
    if (!this.#allowRemove) return;
    this.#allowRemove = false;
    const bag = await this.#read();
    delete bag[key];
    await this.#write(bag);
  }

  async forceClear(): Promise<void> {
    await this.#write({});
  }

  async peek(): Promise<{
    readonly email: string | null;
    readonly hasRefresh: boolean;
    readonly accessToken: string | null;
    readonly refreshToken: string | null;
  }> {
    const bag = await this.#read();
    for (const value of Object.values(bag)) {
      const parsed = parseStoredSession(value);
      if (parsed.hasRefresh) return parsed;
    }
    return { email: null, hasRefresh: false, accessToken: null, refreshToken: null };
  }

  async #read(): Promise<Record<string, string>> {
    try {
      const raw = JSON.parse(await readFile(this.#file, "utf8")) as unknown;
      if (typeof raw !== "object" || raw === null) return {};
      const bag: Record<string, string> = {};
      for (const [key, value] of Object.entries(raw)) {
        if (typeof value === "string") bag[key] = value;
      }
      return bag;
    } catch {
      return {};
    }
  }

  async #write(bag: Record<string, string>): Promise<void> {
    await mkdir(path.dirname(this.#file), { recursive: true });
    await writeFile(this.#file, JSON.stringify(bag), "utf8");
  }
}

export function parseStoredSession(raw: string): {
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
