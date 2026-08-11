# CubeControl · Open core (one-pager)

**Estado:** borrador de producto (pre-lanzamiento público).  
**No afiliado** a M-VAVE / Cuvave / CubeSuite. Uso del pedal = riesgo del usuario → [`apps/desktop/SAFETY.md`](../apps/desktop/SAFETY.md).

## Tesis

1. **Open source** atrae músicos, captura confianza (USB + flash ROM) y acelera el mapa de protocolo.
2. **Nube / móvil de pago** no venden “knobs online”; venden **no perder el setlist** y **llevar Shows al bolo**.
3. El plus que CubeSuite no tiene — **Tono → Canción → Show → A/B/C / Escenario** — es el núcleo del negocio.

```text
[ Core open · local ]          [ Cloud / Pro · cuenta ]
  Protocolo + desktop            Sync library
  Shows / bank / IR local        Share links · backup
  Research CLI                   Companion móvil (escenario)
                                 (más tarde) marketplace
```

## Qué es gratis y open (MIT)

Alineado con la licencia actual del desktop ([`LICENSE.txt`](../apps/desktop/LICENSE.txt)):

| Pieza | Repo / área | Notas |
|-------|-------------|--------|
| Protocolo SysEx, IR math, sesión MIDI | `Tonehub` (hardware core) | Sin UI, sin auth |
| CLI de investigación / capturas | `Tonehub` | Flags `--confirm-*` |
| CubeControl desktop local | `tonehub-app` | Editor, tuner, Device, Library **offline** |
| Shows / canciones / tonos **en disco** | Library local | Sin cuenta |
| Armar A/B/C, modo escenario **local** | Desktop | USB en esa máquina |
| Backup IR local + SAFETY gates | Desktop | Cab 8 preferido |

**Principio:** si funciona **solo con el PC y el pedal**, debe poder seguir siendo open.

## Qué es Pro / nube (no open, o servicio hosted)

| Pieza | Por qué se cobra |
|-------|------------------|
| Cuenta + **sync** de tonos / canciones / shows entre dispositivos | Continuidad |
| Backup cloud de library (+ IRs bajo demanda) | No perder el set |
| Enlaces para **compartir** un show/pack | Viral + utilidad |
| **Companion móvil** (escenario, armar bank vía bridge desktop o MIDI móvil cuando madure) | Valor en el bolo |
| Historial / versiones de shows | Pro workflow |
| (Más tarde) marketplace / packs de comunidad con comisión | Escala |

El código del **cliente** que habla con la API puede ser open en parte; el **servicio, datos y billing** son el producto de pago.

## Qué **nunca** va a la nube (seguridad del pedal)

Estas operaciones tocan hardware / flash. Deben ejecutarse **en el dispositivo del usuario**, con confirmaciones locales:

- Escritura live / bank al CUBE Baby  
- Persistencia IR ROM (Cab 1–8), erase, restore desde backup  
- Cualquier SysEx mutante del protocolo  

La nube puede **guardar** un WAV o un bank JSON que el usuario subió; **no** puede “pulsar flash” en el pedal sin el cliente local.  
Sync ≠ telemetría de writes a ciegas.

## Licencia (propuesta operativa)

| Capa | Licencia |
|------|----------|
| Core `Tonehub` + desktop open | **MIT** (como hoy) + aviso SAFETY / no afiliación |
| Apps / SDKs cloud Pro | Propietario o “source available” según fase |
| Contenido de usuarios (presets/IRs) | El usuario retiene derechos; ToS de share/marketplace aparte |

Al publicar repos: LICENSE en raíz de cada repo, NOTICE de terceros, y enlace a SAFETY en el README.

## Posicionamiento vs CubeSuite

| | CubeSuite | CubeControl (open) | CubeControl Cloud/Pro |
|--|-----------|--------------------|------------------------|
| Control live A/B/C | Sí | Sí | Vía cliente local |
| Librería / setlists | No | Sí (local) | Sync + share |
| Escenario | No | Sí (desktop) | + móvil |
| IR Distance / backup | Limitado / opaco | Explícito + backup local | Metadatos en sync |

## Métricas de que “ya toca nube”

No abrir cuentas hasta que:

1. Flujo tono → canción → show → armar A/B/C sea usable por un desconocido en &lt;10 min  
2. Hay smoke de desktop + builds Windows para testers  
3. SAFETY y Cab 8 están claros en UI y README  

Luego: **MVP sync library** (sin marketplace).

## Una frase de pitch

> CubeControl es el control open del CUBE Baby con setlists de verdad; la nube es opcional para no perder tu show entre el ensayo y el bolo.
