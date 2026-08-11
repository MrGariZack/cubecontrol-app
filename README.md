# CubeControl (tonehub-app)

**Unofficial** desktop editor for the M-VAVE / Cuvave **CUBE Baby**.  
Hardware protocol lives in the sibling core: [cubecontrol](https://github.com/MrGariZack/cubecontrol) (local folder `../Tonehub`).

| | |
|--|--|
| **Website** | https://mrgarizack.github.io/cubecontrol-app/ ([`site/`](site/)) |
| **App repo** | https://github.com/MrGariZack/cubecontrol-app |
| **Core repo** | https://github.com/MrGariZack/cubecontrol |
| **Downloads** | [Releases](https://github.com/MrGariZack/cubecontrol-app/releases) (Windows NSIS + portable) |
| **Version** | `0.1.1` — see [`CHANGELOG.md`](CHANGELOG.md) |
| **Publish guide** | [`docs/PUBLISH.md`](docs/PUBLISH.md) |

**Safety:** experimental USB writer — [`apps/desktop/SAFETY.md`](apps/desktop/SAFETY.md). Not affiliated with M-VAVE. Prefer IR uploads to **Cabinet 8**; export bank before risky ops.

## Stack

- **Desktop (now):** Electron + React + `@tonehub/midi-transport-node` (real USB)
- **Mobile later:** Expo + Android `NativeMidiHost`
- Core packages linked from sibling `../Tonehub/packages/*`

## Setup (dev)

```sh
# 1) Build the hardware core once
cd ../Tonehub && pnpm install && pnpm build

# 2) Install and run the desktop app
cd ../tonehub-app
pnpm install
pnpm desktop
```

Close CubeSuite, connect the CUBE Baby over USB, then **Connect USB**.

### Windows installers (local)

```sh
pnpm desktop:dist
```

Output: `%LOCALAPPDATA%\CubeControl-build\` — details in [`apps/desktop/RELEASE.md`](apps/desktop/RELEASE.md).

> Early builds are **unsigned**: Windows SmartScreen may warn until Authenticode.

## Product / open core

- [`docs/open-core.md`](docs/open-core.md) — MIT local vs future Pro/cloud  
- [`ROADMAP.md`](ROADMAP.md) · [`CONTRIBUTING.md`](CONTRIBUTING.md) · [`LICENSE`](LICENSE)

## License

MIT — [`LICENSE`](LICENSE). Desktop also ships [`apps/desktop/LICENSE.txt`](apps/desktop/LICENSE.txt) in the installer.
