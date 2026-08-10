# `@tonehub/midi-host-android` (deferred)

Priority is **desktop USB** first (`apps/desktop` + `NodeMidiTransport`).

Later: implement `NativeMidiHost` with Android `MidiManager` for USB-MIDI.
CUBE Baby Bluetooth is audio/tracks only — not used for SysEx control.

Until then, `apps/mobile` stays on **demo mode** (`FakeCubeBabyTransport`).
