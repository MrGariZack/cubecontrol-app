# Publishing CubeControl

How repos, versions, and Windows downloads fit together.

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
2. Grab either:
   - `CubeControl-x.y.z-win-x64.exe` — NSIS installer  
   - `CubeControl-x.y.z-portable.exe` — portable
3. SmartScreen may warn (builds are unsigned until Authenticode). See [`apps/desktop/RELEASE.md`](apps/desktop/RELEASE.md).

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

4. Workflow [`.github/workflows/release-windows.yml`](.github/workflows/release-windows.yml) builds Windows artifacts and attaches them to the GitHub Release for that tag.

Requires: repos **public** (or Actions enabled) and permission for `contents: write` on the app repo. The workflow checks out **both** `cubecontrol` and `cubecontrol-app` as siblings.

### First-time GitHub CLI (optional)

```sh
gh auth login
gh release list --repo MrGariZack/cubecontrol-app
```

## Visibility checklist

- [ ] Both repos public (or shared with testers)
- [ ] README links to Downloads / Safety / sibling repo
- [ ] LICENSE MIT at repo root
- [ ] `v0.1.0` tag + Release with `.exe` assets
- [ ] SAFETY.md linked from Release notes

## What is not automated yet

- Authenticode signing / notarization  
- Auto-update inside the app  
- npm publish of `@tonehub/*` (still workspace-linked from the sibling clone)
