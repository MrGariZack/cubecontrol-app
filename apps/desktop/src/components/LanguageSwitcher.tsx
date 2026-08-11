import { LOCALES, LOCALE_LABELS, useI18n, type Locale } from "../i18n";
import "./language-switcher.css";

type LanguageSwitcherProps = {
  readonly compact?: boolean;
};

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className={`lang-switch${compact ? " lang-switch--compact" : ""}`}>
      <span className="lang-switch__label">{t("lang.switch")}</span>
      <select
        className="lang-switch__select"
        value={locale}
        aria-label={t("lang.switch")}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
