# Publishing CubeControl

How repos, versions, and GitHub downloads (Windows + Android) fit together.

## Repositories

| Repo | GitHub | Role |
|------|--------|------|
| Hardware core (ToneHub) | https://github.com/MrGariZack/cubecontrol | Protocol, `@tonehub/*` packages, CLI |
| Product UI (CubeControl) | https://github.com/MrGariZack/cubecontrol-app | Electron desktop + future mobile |

Local layout (required for `pnpm` workspace):

```text
Desktop/
  Tonehub/          ← clone of cubecontrol
  tonehub-app/      ← clone of cubecontrol-app
```

## Versioning

- **SemVer** on the desktop package: `apps/desktop/package.json` → `version`
- Git **tags** on `cubecontrol-app`: `v0.1.0`, `v0.1.1`, …
- Root `tonehub-app/package.json` version tracks the product release for docs
- Core (`cubecontrol`) versions independently; bump when shipping protocol API breaks
- Keep [`CHANGELOG.md`](CHANGELOG.md) updated before tagging

## Downloads (testers)

1. Open **Releases** on the app repo:  
   https://github.com/MrGariZack/cubecontrol-app/releases
2. Grab:
   - `CubeControl-x.y.z-win-x64.exe` — NSIS installer  
   - `CubeControl-x.y.z-portable.exe` — portable  
   - `CubeControl-x.y.z-linux-x64.AppImage` — Linux, chmod +x and run  
   - `CubeControl-x.y.z-linux-x64.deb` — Ubuntu/Debian  
   - `CubeControl-x.y.z-android-arm64.apk` — Android sideload (USB-OTG)
3. SmartScreen may warn on Windows (unsigned until Authenticode). Android asks to allow unknown sources. Linux AppImage may need `libfuse2`. See [`apps/desktop/RELEASE.md`](../apps/desktop/RELEASE.md).

## Ship a release (maintainers)

### A) Local installers (smoke)

```sh
cd ../Tonehub && pnpm install && pnpm build
cd ../tonehub-app && pnpm install && pnpm desktop:dist
```

Artifacts: `%LOCALAPPDATA%\CubeControl-build\`

### B) GitHub Release (CI)

1. Bump `apps/desktop/package.json` `version` (and CHANGELOG).
2. Commit + push `master`.
3. Tag and push:

```sh
git tag v0.1.0
git push origin master
git push origin v0.1.0
```

4. Workflow [`.github/workflows/release-windows.yml`](.github/workflows/release-windows.yml) builds Windows, **Linux AppImage/.deb**, and the Android APK, then attaches them to the GitHub Release for that tag.

Requires: both repos **public** (recommended), Actions enabled, and `contents: write` on the app repo.
The workflow checks out **both** `cubecontrol` and `cubecontrol-app` as siblings.
If the core stays private, add a repo secret `CORE_CHECKOUT_TOKEN` (PAT with read access to `cubecontrol`).

### Android signing (once)

CI **will not** ship a debug-signed APK. Create a keystore on your PC (do not commit it):

```powershell
cd apps/mobile
powershell -File scripts/create-release-keystore.ps1
```

Add these repository secrets (`Settings → Secrets and variables → Actions`):

| Secret | Value |
|--------|--------|
| `ANDROID_KEYSTORE_BASE64` | one-line Base64 of the `.jks` (the script prints it) |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | `cubecontrol` (unless you changed it) |
| `ANDROID_KEY_PASSWORD` | key password |

Keep an offline backup of the `.jks`. If you lose it, testers have to uninstall to install a new APK.

To attach an APK to an **existing** tag (e.g. `v0.1.3`) after secrets are in place: Actions → **Release** → Run workflow → `attach_tag` = `v0.1.3`.

### First-time GitHub CLI (optional)

```sh
gh auth login
gh release list --repo MrGariZack/cubecontrol-app
```

## Visibility checklist

- [ ] Both repos public (or shared with testers)
- [ ] README links to Downloads / Safety / sibling repo
- [ ] LICENSE MIT at repo root
- [ ] `v0.1.0` tag + Release with `.exe`, `.AppImage` / `.deb`, and `.apk` assets
- [ ] SAFETY.md linked from Release notes

## What is not automated yet

- Authenticode signing / notarization  
- Auto-update inside the app  
- Play Store listing (APK is GitHub Releases only)  
- npm publish of `@tonehub/*` (still workspace-linked from the sibling clone)
