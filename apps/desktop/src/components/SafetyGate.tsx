import { useState } from "react";
import {
  SAFETY_BULLETS,
  SAFETY_RISK_TIERS,
  writeSafetyAcceptance,
} from "../safety/disclaimer";
import "./safety-gate.css";

type SafetyGateProps = {
  readonly onAccepted: () => void;
};

export function SafetyGate({ onAccepted }: SafetyGateProps) {
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
        <p className="safety-gate__eyebrow">Antes de conectar el pedal</p>
        <h1 className="safety-gate__title">Uso bajo tu responsabilidad</h1>
        <p className="safety-gate__lead">
          CubeControl puede leer y escribir el CUBE Baby por USB-MIDI. La mayoría de ediciones
          live son seguras; las escrituras a bank e IR ROM pueden borrar datos del pedal.
        </p>

        <ul className="safety-gate__tiers">
          {SAFETY_RISK_TIERS.map((tier) => (
            <li key={tier.id} className={`safety-gate__tier safety-gate__tier--${tier.id}`}>
              <span className="safety-gate__tier-level">{tier.level}</span>
              <strong>{tier.title}</strong>
              <p>{tier.body}</p>
            </li>
          ))}
        </ul>

        <ul className="safety-gate__bullets">
          {SAFETY_BULLETS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <div className="safety-gate__checks">
          <label>
            <input
              type="checkbox"
              checked={readRisks}
              onChange={(e) => setReadRisks(e.target.checked)}
            />
            He leído los niveles de riesgo (live / bank / IR ROM).
          </label>
          <label>
            <input
              type="checkbox"
              checked={ownRisk}
              onChange={(e) => setOwnRisk(e.target.checked)}
            />
            Acepto usar CubeControl bajo mi propia responsabilidad; no hay garantía ni soporte
            oficial del fabricante.
          </label>
          <label>
            <input
              type="checkbox"
              checked={noOfficial}
              onChange={(e) => setNoOfficial(e.target.checked)}
            />
            Entiendo que preferiré Cab 8 para IRs nuevos y haré backup de bank antes de
            experimentos arriesgados.
          </label>
        </div>

        <button
          type="button"
          className="safety-gate__cta"
          disabled={!canContinue}
          onClick={accept}
        >
          Entiendo los riesgos — continuar
        </button>
        <p className="safety-gate__foot">
          Este aviso se guarda en este equipo. Si actualizamos el texto de seguridad, volverá a
          pedirse aceptación.
        </p>
      </div>
    </main>
  );
}
