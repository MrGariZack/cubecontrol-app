# CubeControl (tonehub-app)

**Unofficial** desktop editor for the M-VAVE / Cuvave **CUBE Baby**.  
Hardware protocol lives in the sibling core: [cubecontrol](https://github.com/MrGariZack/cubecontrol) (local folder `../Tonehub`).

| | |
|--|--|
| **Website** | https://mrgarizack.github.io/cubecontrol-app/ ([`site/`](site/)) |
| **Telegram** | [CubeControl App](https://t.me/+fOVYVdn8-85mY2Zh) |
| **App repo** | https://github.com/MrGariZack/cubecontrol-app |
| **Core repo** | https://github.com/MrGariZack/cubecontrol |
| **Downloads** | [Releases](https://github.com/MrGariZack/cubecontrol-app/releases) (Windows, Linux AppImage, Android APK) |
| **Version** | `0.1.4` — see [`CHANGELOG.md`](CHANGELOG.md) |
| **Publish guide** | [`docs/PUBLISH.md`](docs/PUBLISH.md) |

**Safety:** experimental USB writer — [`apps/desktop/SAFETY.md`](apps/desktop/SAFETY.md). Not affiliated with M-VAVE. IR uploads overwrite the selected cabinet. Export the bank before experimenting.

## Stack

- **Desktop:** Electron + React + `@tonehub/midi-transport-node` (real USB)
- **Android:** Expo companion + USB-OTG `NativeMidiHost`
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

### Interactive help

Choose **Help** or press **F1** in the desktop app. Search for a feature, take a
short chapter, or follow the full tour. The guide opens the relevant screen and
highlights available controls. See the [desktop feature review](docs/desktop-feature-review.md)
for coverage and checks that still require connected equipment or an account.

### Record a performance

Open **Clips** in the desktop studio. Choose the camera, framing, and audio input.
Select the pedal's USB audio input if your system lists one. Otherwise, connect
the pedal's audio output to an interface and select that input. Enable the preview
and play a few notes to check the level before recording.

The virtual pedal reflects the slot and settings shown in CubeControl. You can
return to the editor during a take. Stop, play back the video, and save it to disk.
Takes are recorded locally at 720p in landscape or portrait, up to five minutes.

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
