# ToneHub App

Product / lab UI for ToneHub. **Separate** from the hardware-core repo (`../Tonehub`).

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

# 2) Install and run the desktop app
cd ../tonehub-app
pnpm install
pnpm desktop
```

Cierra CubeSuite, conecta el CUBE Baby por USB y pulsa **Conectar USB**.

Mobile (demo fake, sin pedal):

```sh
pnpm mobile
```

## Boundary

| Here (`tonehub-app`) | Core (`Tonehub`) |
|---|---|
| UI, UX, branding | Protocol + CLI research |
| `NativeMidiHost` plugins (Android/iOS) | `NativeMidiTransport` contract |
| Confirm destructive actions in UI | Device operations API |

## Next

1. Android `NativeMidiHost` (MidiManager) wired to `NativeMidiTransport`
2. Lab screens: bank A/B/C, live knobs, load IR
3. Later: accounts / cloud / community
