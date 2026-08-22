# `@tonehub/midi-host-android`

Expo **dev client** module that implements [`NativeMidiHost`](../../../Tonehub/packages/midi-transport-native/README.md) with Android `MidiManager` + USB-OTG.

No funciona en **Expo Go**. El teléfono es el host USB; el CUBE Baby habla USB-MIDI (VID `301A`, PID `5555`). Bluetooth queda fuera.

## Qué hace

- Lista puertos USB-MIDI (`MidiDevice` / `MidiInputPort` / `MidiOutputPort`)
- Entrega **chunks crudos** (SysEx fragmentado) — no ensambla mensajes
- `device_filter.xml` + `ACTION_USB_DEVICE_ATTACHED` (permiso USB al enchufar)
- Filtra CUBE Baby por VID/PID cuando el host lo expone
- Al desenchufar, cierra el dispositivo y emite un error claro

## Development build (Android)

Desde `apps/mobile`, con un teléfono físico (el emulador no es host OTG):

```sh
pnpm --filter @tonehub/mobile exec expo prebuild --platform android
pnpm --filter @tonehub/mobile exec expo run:android
# o, ya generado el nativo:
pnpm --filter @tonehub/mobile android
```

Luego `expo start --dev-client` y abre el cliente instalado. El plugin vive en `app.json` → `@tonehub/midi-host-android`.

### Permisos / USB

No hay un `android.permission.USB` de runtime. Android pide permiso USB con:

1. Intent `USB_DEVICE_ATTACHED` + `res/xml/cube_baby_usb_device_filter.xml` (VID `0x301A` = 12314)
2. `UsbManager.requestPermission` si el dispositivo ya está enchufado

Acepta el diálogo USB. Usa un **cable OTG con datos** (muchos USB-C solo cargan). Cierra CubeSuite u otra app MIDI — un solo cliente.

## API JS (app)

En `apps/mobile/src/device/usbConnect.ts`:

```ts
import { listPorts, connectUsb, close } from "../device/usbConnect";

const ports = await listPorts();
const session = await connectUsb(); // identify + bank
await close();
```

`connectUsb()` / `close()` mantienen una conexión activa. Si se desenchufa el pedal, `onDetached` avisa con copy de cable OTG.

El host nativo también exporta `AndroidMidiHost` (contrato `NativeMidiHost`) para `NativeMidiTransport`.
