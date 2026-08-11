import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en } from "./en";
import { es } from "./es";
import {
  DEFAULT_LOCALE,
  readStoredLocale,
  translate,
  writeStoredLocale,
  type Locale,
  type MessageParams,
  type Messages,
} from "./types";

const catalogs: Record<Locale, Messages> = { en, es };

export type TFunction = (key: string, params?: MessageParams) => string;

type I18nContextValue = {
  readonly locale: Locale;
  readonly setLocale: (locale: Locale) => void;
  readonly t: TFunction;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeStoredLocale(next);
    document.documentElement.lang = next;
  }, []);

  const t = useCallback<TFunction>(
    (key, params) => translate(catalogs[locale], key, params),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx === null) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

/** Safe t() for modules that may render before provider (falls back to EN). */
export function tDefault(key: string, params?: MessageParams): string {
  return translate(catalogs[DEFAULT_LOCALE], key, params);
}
