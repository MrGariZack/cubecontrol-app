import AsyncStorage from "@react-native-async-storage/async-storage";

/** Bump when the legal/safety text changes so users must re-accept. */
export const SAFETY_ACCEPTANCE_VERSION = "cubecontrol-safety-v1";

const STORAGE_KEY = "cubecontrol.safety.acceptance";

export type SafetyAcceptance = {
  readonly version: string;
  readonly acceptedAt: string;
};

export const SAFETY_RISK_TIERS = [
  {
    id: "live",
    level: "Bajo",
    title: "Parámetros live (knobs / A-B-C recall)",
    body: "Cambian el sonido en RAM. En general son reversibles (Undo, recall de slot). Riesgo bajo de daño permanente.",
  },
  {
    id: "bank",
    level: "Medio",
    title: "Guardar slot / copiar entre A-B-C / importar bank / igualar volúmenes",
    body: "Reescriben presets A/B/C en el bank del pedal (copiar sobrescribe el footswitch destino). Puedes perder tonos si no exportaste backup. No toca IRs de fábrica.",
  },
  {
    id: "ir",
    level: "Alto",
    title: "Cargar o restaurar IR en ROM (sobre todo Cab 1–7)",
    body: "Escribe memoria flash del pedal. Cab 8 es el slot de upload habitual. Sobreescribir Cab 1–7 puede pisar IRs de fábrica; CubeControl intenta backup local, pero no garantiza recuperación perfecta.",
  },
] as const;

export const SAFETY_BULLETS = [
  "CubeControl es software experimental / hobby, sin garantía de ningún tipo.",
  "Úsalo bajo tu propia responsabilidad. Los autores no se hacen responsables de daños al CUBE Baby, pérdida de IRs/presets, ni lucro cesante.",
  "Cierra CubeSuite y cualquier otra app que use el puerto MIDI antes de conectar.",
  "Exporta un bank JSON antes de experimentar. Prefiere IR → Cab 8.",
  "Si un write IR falla a mitad, no desconectes a la brava: reintenta restore desde backup o usa herramientas del core con calma.",
  "No es un producto oficial de M-VAVE / Cuvave / Valeton.",
] as const;

export class SafetyRequiredError extends Error {
  readonly code = "SAFETY_REQUIRED" as const;
  constructor(message = "Hay que aceptar el aviso de seguridad") {
    super(message);
    this.name = "SafetyRequiredError";
  }
}

export async function readSafetyAcceptance(): Promise<SafetyAcceptance | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as SafetyAcceptance;
    if (parsed.version !== SAFETY_ACCEPTANCE_VERSION) return null;
    if (typeof parsed.acceptedAt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeSafetyAcceptance(): Promise<SafetyAcceptance> {
  const acceptance: SafetyAcceptance = {
    version: SAFETY_ACCEPTANCE_VERSION,
    acceptedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(acceptance));
  return acceptance;
}

export async function clearSafetyAcceptance(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
