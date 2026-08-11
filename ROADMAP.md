# Roadmap CubeControl

Orden deliberado: **desktop estable open → sync → móvil escenario → marketplace**.  
Detalle de negocio: [`docs/open-core.md`](docs/open-core.md). Seguridad: [`apps/desktop/SAFETY.md`](apps/desktop/SAFETY.md).

## Ahora (v0.x · local open)

- [x] Pedal virtual + live params por slot A/B/C  
- [x] Library offline: tonos, canciones, shows, cue sheet, modo escenario  
- [x] Device workspace: bank export/import, IR + MIC DIST, compare  
- [x] IR backup local + gates Cab 1–7  
- [x] README / LICENSE / CONTRIBUTING / open-core listos para repo público  
- [x] i18n ES/EN + publish docs / CI release Windows  
- [x] Smoke público + instaladores en GitHub Releases (`v0.1.0` / `v0.1.1`)  
- [ ] Pulir UX Shows (comodidad) con feedback real de 2–3 músicos  

## Siguiente (v0.2 · open polish)

- [x] Diálogos in-app calmados para riesgo IR (menos `confirm()` nativo)  
- [x] i18n ES/EN (inglés por defecto + selector)  
- [ ] Import “pack → show”  
- [ ] Tests de library store (songs/shows)  
- [x] Documentar protocolo Distance / live bands en ToneHub research index  

## Nube MVP (v0.3 · Pro early)

Solo cuando el desktop local sea obvio para un desconocido:

- [ ] Cuenta (email / OAuth)  
- [ ] Sync de **metadatos** library (tonos, canciones, shows)  
- [ ] Upload opcional de WAV / bank JSON  
- [ ] Share link de un show (read-only pack)  
- [ ] Cliente desktop: “iniciar sesión / sync ahora”  

**Fuera de MVP nube:** flash remoto del pedal, marketplace, equipos.

## Móvil companion (v0.4 · Pro)

- [ ] App escenario (tema actual / siguiente / →A·B·C)  
- [ ] Hablar con library sync; writes al pedal vía desktop bridge o MIDI nativo cuando sea fiable  
- [ ] No clonar el editor de knobs completo el día 1  

## Más tarde

- [ ] Marketplace / comunidad de packs  
- [ ] Firmado Authenticode / notarización  
- [ ] Android `NativeMidiHost` de verdad  
- [ ] Cuentas de banda (varios shows compartidos)  

## No-goals (explícitos)

- Sustituir el bank hardware de 3 footswitches  
- Cloud que escriba SysEx sin el cliente local  
- “Accounts first” antes de setlists locales sólidos  
