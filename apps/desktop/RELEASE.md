# CubeControl — release / installers (Windows)

## Artefactos

Tras `pnpm dist` en este paquete (o `pnpm desktop:dist` desde la raíz del monorepo):

Salida por defecto: `%LOCALAPPDATA%\CubeControl-build\` (evita bloqueos EPERM en Desktop/OneDrive).

| Archivo | Uso |
|---|---|
| `CubeControl-0.1.0-win-x64.exe` | Instalador **NSIS** (elige carpeta, accesos directos) |
| `CubeControl-0.1.0-portable.exe` | **Portable** — no instala; ideal para testers |

También verás `win-unpacked/` (app descomprimida para depurar).

## Cómo generar (maintainers)

Requisitos: Windows x64, Node 22+, pnpm, repo core `../Tonehub` al lado.

```sh
# 1) Core compilado
cd ../../Tonehub
pnpm install
pnpm build

# 2) App + instaladores
cd ../tonehub-app
pnpm install
pnpm desktop:dist
```

Solo portable:

```sh
pnpm --filter @tonehub/desktop dist:portable
```

Solo carpeta unpacked (smoke rápido):

```sh
pnpm --filter @tonehub/desktop dist:dir
# luego: %LOCALAPPDATA%\CubeControl-build\win-unpacked\CubeControl.exe
```

## Instrucciones para testers

1. Cierra **CubeSuite** y cualquier app que use el MIDI del CUBE Baby.
2. Conecta el pedal por **USB**.
3. Ejecuta el instalador o el portable.
4. Windows puede mostrar **SmartScreen** (“Windows protegió tu PC”) porque el build **no está firmado** todavía:
   - *Más información* → *Ejecutar de todas formas*.
5. Acepta el aviso de riesgos de CubeControl.
6. Pulsa **Conectar USB**.

Lee [`SAFETY.md`](./SAFETY.md) antes de escribir IR a Cab 1–7.

## Qué NO incluye aún

- Firma de código Authenticode (quita SmartScreen; requiere certificado de pago).
- Auto-update.
- Builds macOS / Linux (el MIDI nativo está validado sobre todo en Windows).

## Checklist pre-release

- [ ] `pnpm typecheck` OK en tonehub-app
- [ ] `pnpm build` OK en Tonehub (core)
- [ ] Smoke físico: connect → knobs → save slot → export bank
- [ ] IR a **Cab 8** + verify en UI
- [ ] Safety gate aparece en PC limpio / tras reset
- [ ] Portable arranca sin instalar
- [ ] NSIS instala, crea acceso directo y desinstala limpio
