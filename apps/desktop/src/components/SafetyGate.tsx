import { useState } from "react";
import { useI18n } from "../i18n";
import { writeSafetyAcceptance } from "../safety/disclaimer";
import { LanguageSwitcher } from "./LanguageSwitcher";
import "./safety-gate.css";

type SafetyGateProps = {
  readonly onAccepted: () => void;
};

const TIER_IDS = ["live", "bank", "ir"] as const;

export function SafetyGate({ onAccepted }: SafetyGateProps) {
  const { t } = useI18n();
  const [readRisks, setReadRisks] = useState(false);
  const [ownRisk, setOwnRisk] = useState(false);
  const [noOfficial, setNoOfficial] = useState(false);

  const canContinue = readRisks && ownRisk && noOfficial;

  function accept() {
    if (!canContinue) return;
    writeSafetyAcceptance();
    onAccepted();
  }

  return (
    <main className="safety-gate">
      <div className="safety-gate__card">
        <div className="safety-gate__lang">
          <LanguageSwitcher />
        </div>
        <p className="safety-gate__eyebrow">{t("safety.eyebrow")}</p>
        <h1 className="safety-gate__title">{t("safety.title")}</h1>
        <p className="safety-gate__lead">{t("safety.lead")}</p>

        <ul className="safety-gate__tiers">
          {TIER_IDS.map((id) => (
            <li key={id} className={`safety-gate__tier safety-gate__tier--${id}`}>
              <span className="safety-gate__tier-level">{t(`safety.tier.${id}.level`)}</span>
              <strong>{t(`safety.tier.${id}.title`)}</strong>
              <p>{t(`safety.tier.${id}.body`)}</p>
            </li>
          ))}
        </ul>

        <ul className="safety-gate__bullets">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <li key={n}>{t(`safety.bullet.${n}`)}</li>
          ))}
        </ul>

        <div className="safety-gate__checks">
          <label>
            <input
              type="checkbox"
              checked={readRisks}
              onChange={(e) => setReadRisks(e.target.checked)}
            />
            {t("safety.check.risks")}
          </label>
          <label>
            <input
              type="checkbox"
              checked={ownRisk}
              onChange={(e) => setOwnRisk(e.target.checked)}
            />
            {t("safety.check.own")}
          </label>
          <label>
            <input
              type="checkbox"
              checked={noOfficial}
              onChange={(e) => setNoOfficial(e.target.checked)}
            />
            {t("safety.check.cab8")}
          </label>
        </div>

        <button
          type="button"
          className="safety-gate__cta"
          disabled={!canContinue}
          onClick={accept}
        >
          {t("safety.cta")}
        </button>
        <p className="safety-gate__foot">{t("safety.foot")}</p>
      </div>
    </main>
  );
}
