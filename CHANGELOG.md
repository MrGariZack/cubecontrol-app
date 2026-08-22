# Changelog

All notable releases of **CubeControl** (this app repo) are listed here.  
Hardware core changes live in [cubecontrol](https://github.com/MrGariZack/cubecontrol) / ToneHub.

Format: based on [Keep a Changelog](https://keepachangelog.com/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Planned
- Pack → Show import round-trip
- Signed Windows builds (Authenticode)

## [0.1.2] — 2026-08-21

### Added
- Share tones, songs, and shows as `.cubecontrol.json` between desktop and Android
- Import desktop ZIP packs (`tonehub-pack-v1`) on the phone
- Android companion: live A/B/C, tuner, library, stage, USB-OTG MIDI
- Fluid live knobs on Android (optimistic MIDI writes, drag/hold steppers)

## [0.1.1] — 2026-08-11

### Added
- In-app **Report a problem** (diagnostics ZIP + GitHub issue flow)
- Public landing site (`site/`) on GitHub Pages

### Fixed
- Pages deploy enablement on first GitHub Actions run

## [0.1.0] — 2026-08-11

### Added
- Desktop editor for CUBE Baby (live A/B/C, save, compare, bank export/import)
- Library: tones, songs, shows, stage mode, pack ZIP export/import
- Device workspace: IR load + MIC DIST, Cab 8 preferred, local IR backups
- Safety gate + in-app risk confirms (typed `CABn` for factory IR overwrite)
- ES/EN i18n (English default, language switcher)
- Open-core docs, ROADMAP, CONTRIBUTING, Windows NSIS + portable installers

### Safety
- Unofficial / experimental USB writer — see `apps/desktop/SAFETY.md`
- Builds are **unsigned** (SmartScreen expected)

[0.1.2]: https://github.com/MrGariZack/cubecontrol-app/releases/tag/v0.1.2
[0.1.1]: https://github.com/MrGariZack/cubecontrol-app/releases/tag/v0.1.1
[0.1.0]: https://github.com/MrGariZack/cubecontrol-app/releases/tag/v0.1.0
