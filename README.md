# CubeControl (tonehub-app)

Product UI **CubeControl** for CUBE Baby. **Separate** from the hardware-core repo (`../Tonehub`).

**Safety:** experimental USB writer — see [`apps/desktop/SAFETY.md`](apps/desktop/SAFETY.md). Not affiliated with M-VAVE. Use at your own risk; prefer IR uploads to Cabinet 8; export bank before risky ops.

This repo owns screens, navigation, and (soon) native MIDI plugins.  
Protocol, SysEx, IR math, and `CubeBabySession` stay in the core.

## Stack

- **Desktop first (now):** Electron + React + `@tonehub/midi-transport-node` (USB real)
- **Mobile later:** Expo + Android `NativeMidiHost` (USB). Bluetooth del CUBE Baby es solo audio/pistas — fuera de alcance MIDI.
- Core packages linked from sibling `../Tonehub/packages/*`

## Setup

Keep this folder next to the core: `Desktop/Tonehub` + `Desktop/tonehub-app`.

```sh
# 1) Build the hardware core once
cd ../Tonehub && pnpm install && pnpm build

# 2) Install and run the desktop app (dev)
cd ../tonehub-app
pnpm install
pnpm desktop
```

Cierra CubeSuite, conecta el CUBE Baby por USB y pulsa **Conectar USB**.

### Windows installers

```sh
pnpm desktop:dist
```

Salida en `%LOCALAPPDATA%\CubeControl-build\`:

- **NSIS** `.exe` — instalador con accesos directos  
- **Portable** `.exe` — sin instalación (bueno para testers)

Guía completa: [`apps/desktop/RELEASE.md`](apps/desktop/RELEASE.md).  
Seguridad: [`apps/desktop/SAFETY.md`](apps/desktop/SAFETY.md).

> Builds tempranos **no están firmados**: Windows SmartScreen puede avisar. Es normal hasta tener certificado Authenticode.

Mobile (demo fake, sin pedal):

```sh
pnpm mobile
```

## Boundary

| Here (`tonehub-app`) | Core (`Tonehub`) |
|---|---|
| UI, UX, branding, installers | Protocol + CLI research |
| `NativeMidiHost` plugins (Android/iOS) | `NativeMidiTransport` contract |
| Confirm destructive actions in UI | Device operations API |

## Product / open core

- **Open core & business boundary:** [`docs/open-core.md`](docs/open-core.md)  
  (qué es MIT/local, qué será Pro/nube, qué **nunca** escribe el pedal desde la nube)
- **Roadmap:** [`ROADMAP.md`](ROADMAP.md)
- **Contribuir:** [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Next

1. Public smoke + unsigned Windows builds for testers  
2. Stabilize Shows → A/B/C flow for first-time users  
3. Then: library sync MVP (see open-core) — not accounts-first  
4. Later: mobile stage companion; marketplace last  
