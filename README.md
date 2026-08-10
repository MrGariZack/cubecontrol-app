# ToneHub App

Product / lab UI for ToneHub. **Separate** from the hardware-core repo (`../Tonehub`).

This repo owns screens, navigation, and (soon) native MIDI plugins.  
Protocol, SysEx, IR math, and `CubeBabySession` stay in the core.

## Stack

- TypeScript + Expo (React Native)
- Core packages via local `file:` links to `../Tonehub/packages/*`
- Demo mode uses `FakeCubeBabyTransport` (no pedal / no native plugin yet)

## Setup

Keep this folder next to the core: `Desktop/Tonehub` + `Desktop/tonehub-app`.

```sh
# 1) Build the hardware core once
cd ../Tonehub && pnpm install && pnpm build

# 2) Install and run the app (workspace links ../Tonehub/packages/*)
cd ../tonehub-app
pnpm install
pnpm mobile
```

Then press `w` for web, or scan the QR with Expo Go.

Demo connect uses `FakeCubeBabyTransport` from the core — no USB plugin required yet.

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
