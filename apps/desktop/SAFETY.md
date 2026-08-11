# CubeControl — seguridad del hardware CUBE Baby

CubeControl habla con el pedal por **USB-MIDI**. No es software oficial de M-VAVE / Cuvave.
Úsalo bajo tu propia responsabilidad.

## Niveles de riesgo

| Nivel | Operaciones | Qué puede pasar |
|---|---|---|
| **Bajo** | Knobs live, cambiar slot A/B/C a live, tuner (mic del PC) | Solo RAM / audio del PC. Reversible con Undo o recall. |
| **Medio** | Guardar slot, import bank, igualar volúmenes A/B/C | Pisas presets del bank. Exporta bank JSON antes. |
| **Alto** | Cargar WAV a IR ROM, restaurar backup IR, Cab 1–7 | Escribe flash. Cab **8** = upload habitual. Cab **1–7** pueden ser IRs de fábrica. |

## Buenas prácticas

1. Cierra **CubeSuite** y cualquier app que reserve el MIDI.
2. Antes de experimentar: **Exportar bank**.
3. Sube IRs nuevos a **Cab 8** salvo que sepas lo que haces.
4. Si escribes Cab 1–7, CubeControl intenta **backup ROM local** antes; no es garantía absoluta.
5. Si un write IR falla a medias: no entres en pánico, no spamees writes; restaura desde backup o usa el CLI del hardware-core con calma.

## Limitación de responsabilidad

EL SOFTWARE SE OFRECE “TAL CUAL”, SIN GARANTÍAS. LOS AUTORES NO SE HACEN RESPONSABLES DE DAÑOS AL PEDAL, PÉRDIDA DE DATOS, IR DE FÁBRICA PISADOS, NI DE CUALQUIER OTRO PERJUICIO.

Al usar CubeControl aceptas estos términos (también se muestran en la app al primer uso).
