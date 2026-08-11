# Contribuir a CubeControl / ToneHub

Gracias por interesarte. Esto es hardware **no oficial** y **experimental**. Lee [`apps/desktop/SAFETY.md`](apps/desktop/SAFETY.md) antes de conectar un pedal.

## Dos repos

| Repo | Rol |
|------|-----|
| **ToneHub** (core) | Protocolo, CLI, capturas, paquetes `@tonehub/*` |
| **tonehub-app** | UI CubeControl (Electron / Expo) |

Mantén ambos hermanos en el mismo directorio (`Tonehub` + `tonehub-app`).

## Qué aportaciones ayudan más

1. **Capturas USBPcap / JSONL** con README de experimento (plantilla ToneHub `research/experiments/TEMPLATE.md`)  
2. Bugs reproducibles del desktop (OS, firmware si se conoce, pasos)  
3. UX de Library / Shows (capturas de pantalla + “me trabé en…”)  
4. Traducciones / docs  

Patches grandes de “cloud” o auth: primero comenta en un issue; la capa Pro se define en [`docs/open-core.md`](docs/open-core.md).

## Setup rápido

```sh
cd ../Tonehub && pnpm install && pnpm build
cd ../tonehub-app && pnpm install && pnpm desktop
```

Cierra CubeSuite antes de conectar CubeControl.

## Reglas de seguridad en PRs

- No añadir writes SysEx nuevos sin flag `--confirm-*` / gate UI y nota de riesgo  
- Preferir Cab **8** en flujos IR de ejemplo  
- No subir dumps ROM propietarios de terceros ni secrets  
- No debilitar confirmaciones de Cab 1–7  

## Estilo de código

- TypeScript; sigue el estilo del archivo que tocas  
- UI: comodidad > densidad (ver Shows / Device workspaces)  
- Commits claros; un tema por PR cuando sea posible  

## Licencia

Desktop: MIT — [`apps/desktop/LICENSE.txt`](apps/desktop/LICENSE.txt).  
Al contribuir, aceptas que tu aporte se licencia bajo los términos del repo correspondiente.

## Conducta

Sé respetuoso. Nada de presión a “probar esto en flash sin backup”. El objetivo es músicos y reverse-engineering responsable.
