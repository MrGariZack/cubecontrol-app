export type Locale = "en" | "es";

export const LOCALES: readonly Locale[] = ["en", "es"] as const;

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

export const DEFAULT_LOCALE: Locale = "es";
export const LOCALE_STORAGE_KEY = "cubecontrol.locale";

export type MessageParams = Record<string, string | number>;

export type Messages = Record<string, string>;

export function translate(messages: Messages, key: string, params?: MessageParams): string {
  const template = messages[key] ?? key;
  if (params === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    return value === undefined ? `{${name}}` : String(value);
  });
}
