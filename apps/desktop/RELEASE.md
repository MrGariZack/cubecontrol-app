# CubeControl — release / installers

## Artefactos

| Archivo | Uso |
|---|---|
| `CubeControl-0.1.3-win-x64.exe` | Instalador **NSIS** Windows |
| `CubeControl-0.1.3-portable.exe` | **Portable** Windows — no instala |
| `CubeControl-0.1.3-linux-x64.AppImage` | Linux x64 — marcar ejecutable y abrir |
| `CubeControl-0.1.3-linux-x64.deb` | Ubuntu/Debian — `sudo apt install ./…deb` |

Windows: `%LOCALAPPDATA%\CubeControl-build\` (evita bloqueos EPERM en Desktop/OneDrive).  
Linux: `apps/desktop/out/` (`pnpm desktop:dist:linux`).

También verás `win-unpacked/` / `linux-unpacked/` para depurar.

## Cómo generar (maintainers)

Requisitos: Node 22+, pnpm, repo core `../Tonehub` al lado. Windows para `.exe`; Ubuntu/CI para AppImage/`.deb`.

```sh
cd ../../Tonehub
pnpm install
pnpm build
cd ../tonehub-app
pnpm install
pnpm desktop:dist          # Windows
pnpm desktop:dist:linux    # Linux
```

Solo portable Windows: `pnpm --filter @tonehub/desktop dist:portable`  
Solo carpeta unpacked: `pnpm --filter @tonehub/desktop dist:dir`

## Linux (testers)

1. Baja `CubeControl-*-linux-x64.AppImage`.
2. `chmod +x CubeControl-*-linux-x64.AppImage && ./CubeControl-*-linux-x64.AppImage`
3. Si pide FUSE: `sudo apt install libfuse2` (Ubuntu 24: `libfuse2t64`).
4. Conecta el CUBE por USB. El `.deb` instala la regla udev. Con AppImage, si **Conectar USB** no ve el pedal:

```sh
sudo tee /etc/udev/rules.d/99-cube-baby.rules >/dev/null <<'EOF'
SUBSYSTEM=="usb", ATTR{idVendor}=="301a", ATTR{idProduct}=="5555", MODE="0666", TAG+="uaccess"
KERNEL=="hidraw*", ATTRS{idVendor}=="301a", ATTRS{idProduct}=="5555", MODE="0666", TAG+="uaccess"
EOF
sudo udevadm control --reload-rules && sudo udevadm trigger
```

Reconecta el pedal. Acepta el aviso de riesgos y pulsa **Conectar USB**.

## Windows (testers)

1. Cierra **CubeSuite** y cualquier app que use el MIDI del CUBE Baby.
2. Conecta el pedal por **USB**.
3. Ejecuta el instalador o el portable.
4. Windows puede mostrar **SmartScreen** (“Windows protegió tu PC”) porque el build **no está firmado** todavía:
   - *Más información* → *Ejecutar de todas formas*.
5. Acepta el aviso de riesgos de CubeControl.
6. Pulsa **Conectar USB**.

Lee [`SAFETY.md`](./SAFETY.md) antes de escribir IR a Cab 1–7.

## Qué NO incluye aún

- Firma de código Authenticode / firma Linux.
- Auto-update.
- Builds macOS / Linux ARM.

## Checklist pre-release

- [ ] `pnpm typecheck` OK en tonehub-app
- [ ] `pnpm build` OK en Tonehub (core)
- [ ] Smoke físico: connect → knobs → save slot → export bank
- [ ] IR a **Cab 8** + verify en UI
- [ ] Safety gate aparece en PC limpio / tras reset
- [ ] Portable Windows arranca sin instalar
- [ ] NSIS instala, crea acceso directo y desinstala limpio
- [ ] AppImage Linux abre y (con udev) ve el pedal
