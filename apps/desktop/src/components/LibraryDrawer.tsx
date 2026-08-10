import { useCallback, useEffect, useRef, useState } from "react";
import type {
  IrBackupItem,
  IrLibraryItem,
  LibraryIndex,
  LibraryProfile,
  PackLibraryItem,
  PresetLibraryItem,
} from "../../electron/library/types";
import type { LiveParamsSnapshot } from "../types/device";

type TabId = "presets" | "irs" | "backups" | "packs";

type LibraryDrawerProps = {
  readonly open: boolean;
  /** `rail` embeds in the left sidebar (Cortex-style); `drawer` is a right overlay. */
  readonly variant?: "drawer" | "rail";
  readonly busy: boolean;
  readonly irCabinet: number;
  readonly liveParams: LiveParamsSnapshot;
  readonly onClose?: () => void;
  readonly onStatus: (message: string | null) => void;
  readonly onError: (message: string | null) => void;
  readonly onApplyPreset: (params: LiveParamsSnapshot, label: string) => Promise<void>;
  readonly onCabinetApplied: (cabinet: number) => void;
  readonly onBusy: (busy: boolean) => void;
};

const PROFILES: readonly LibraryProfile[] = ["ensayo", "directo", "grabacion", "otro"];

function emptyIndex(): LibraryIndex {
  return {
    format: "tonehub-library-index-v1",
    presets: [],
    irs: [],
    irBackups: [],
    packs: [],
  };
}

export function LibraryDrawer({
  open,
  variant = "drawer",
  busy,
  irCabinet,
  liveParams,
  onClose,
  onStatus,
  onError,
  onApplyPreset,
  onCabinetApplied,
  onBusy,
}: LibraryDrawerProps) {
  const [tab, setTab] = useState<TabId>("presets");
  const [index, setIndex] = useState<LibraryIndex>(emptyIndex());
  const [presetName, setPresetName] = useState("Mi tono");
  const [profile, setProfile] = useState<LibraryProfile>("ensayo");
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<string>>(new Set());
  const [selectedIrIds, setSelectedIrIds] = useState<Set<string>>(new Set());
  const [packName, setPackName] = useState("Pack local");
  const [includeBank, setIncludeBank] = useState(false);
  const irFileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const next = await window.tonehubDesktop.library.list();
    setIndex(next);
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh().catch((err: unknown) => {
      onError(err instanceof Error ? err.message : String(err));
    });
  }, [open, refresh, onError]);

  if (!open) return null;

  async function saveCurrentPreset() {
    onBusy(true);
    onError(null);
    try {
      const item = await window.tonehubDesktop.library.savePreset({
        name: presetName,
        profile,
        params: liveParams,
      });
      await refresh();
      onStatus(`Preset «${item.name}» guardado en biblioteca`);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      onBusy(false);
    }
  }

  async function applyPreset(item: PresetLibraryItem) {
    await onApplyPreset(item.params, `preset:${item.name}`);
    onStatus(`Aplicado «${item.name}» a live`);
  }

  async function deletePreset(id: string) {
    if (!window.confirm("¿Borrar este preset de la biblioteca local?")) return;
    onBusy(true);
    try {
      await window.tonehubDesktop.library.deletePreset(id);
      await refresh();
      onStatus("Preset eliminado");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      onBusy(false);
    }
  }

  async function onImportIrFile(files: FileList | null) {
    const file = files?.[0];
    if (file === undefined) return;
    onBusy(true);
    onError(null);
    try {
      const wav = new Uint8Array(await file.arrayBuffer());
      const item = await window.tonehubDesktop.library.importIrWav({
        name: file.name.replace(/\.wav$/i, ""),
        profile,
        wav,
      });
      await refresh();
      onStatus(`IR «${item.name}» en biblioteca`);
      setTab("irs");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      onBusy(false);
      if (irFileRef.current) irFileRef.current.value = "";
    }
  }

  async function loadIrToPedal(item: IrLibraryItem) {
    if (irCabinet !== 8) {
      const ok = window.confirm(
        `¿Cargar «${item.name}» en Cabinet ${irCabinet}?\nSe hace backup ROM antes de escribir.`,
      );
      if (!ok) return;
    }
    onBusy(true);
    onError(null);
    try {
      const result = await window.tonehubDesktop.library.loadIrToPedal(item.id, irCabinet);
      onCabinetApplied(result.cabinet);
      await refresh();
      onStatus(
        result.persistVerified
          ? `IR «${item.name}» → Cab ${result.cabinet} (backup guardado)`
          : `IR escrito (verify falló) · Cab ${result.cabinet}`,
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      onBusy(false);
    }
  }

  async function deleteIr(id: string) {
    if (!window.confirm("¿Borrar este IR de la biblioteca?")) return;
    onBusy(true);
    try {
      await window.tonehubDesktop.library.deleteIr(id);
      await refresh();
      onStatus("IR eliminado");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      onBusy(false);
    }
  }

  async function restoreBackup(item: IrBackupItem) {
    const ok = window.confirm(
      `¿Restaurar backup ROM Cab ${item.cabinet} (${item.createdAt})?\nSobrescribe el IR actual en ese slot.`,
    );
    if (!ok) return;
    onBusy(true);
    onError(null);
    try {
      const result = await window.tonehubDesktop.library.restoreIrBackup(item.id);
      onCabinetApplied(result.cabinet);
      onStatus(
        result.verified
          ? `Backup restaurado · Cab ${result.cabinet}`
          : `Backup escrito (verify falló) · Cab ${result.cabinet}`,
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      onBusy(false);
    }
  }

  function toggleId(set: Set<string>, id: string, next: (s: Set<string>) => void) {
    const copy = new Set(set);
    if (copy.has(id)) copy.delete(id);
    else copy.add(id);
    next(copy);
  }

  async function createPack() {
    if (selectedPresetIds.size === 0 && selectedIrIds.size === 0 && !includeBank) {
      onError("Selecciona presets/IRs o incluye el bank");
      return;
    }
    onBusy(true);
    onError(null);
    try {
      const pack = await window.tonehubDesktop.library.createPack({
        name: packName,
        presetIds: [...selectedPresetIds],
        irIds: [...selectedIrIds],
        includeBank,
      });
      await refresh();
      setTab("packs");
      onStatus(`Pack «${pack.name}» creado`);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      onBusy(false);
    }
  }

  async function exportPack(pack: PackLibraryItem) {
    onBusy(true);
    try {
      const result = await window.tonehubDesktop.library.exportPack(pack.id);
      if (result === null) return;
      onStatus(`Pack exportado · ${result.path}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      onBusy(false);
    }
  }

  async function importPack() {
    onBusy(true);
    onError(null);
    try {
      const result = await window.tonehubDesktop.library.importPack();
      if (result === null) return;
      await refresh();
      setTab("packs");
      onStatus(`Pack importado · ${result.pack.name}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      onBusy(false);
    }
  }

  return (
    <aside
      className={variant === "rail" ? "library-drawer library-drawer--rail" : "library-drawer"}
      aria-label="Biblioteca local"
    >
      <div className="library-drawer__head">
        <div>
          <h2 className="library-drawer__title">Library</h2>
          <p className="library-drawer__sub">Local · offline</p>
        </div>
        {variant === "drawer" && onClose ? (
          <button type="button" className="library-drawer__close" onClick={onClose}>
            Cerrar
          </button>
        ) : null}
      </div>

      <nav className="library-drawer__tabs">
        {(
          [
            ["presets", "Presets"],
            ["irs", "IRs"],
            ["backups", "Backups IR"],
            ["packs", "Packs"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "library-drawer__tab is-active" : "library-drawer__tab"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="library-drawer__body">
        {tab === "presets" ? (
          <>
            <div className="library-drawer__form">
              <input
                className="library-drawer__input"
                value={presetName}
                disabled={busy}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Nombre del preset"
              />
              <select
                className="library-drawer__input"
                value={profile}
                disabled={busy}
                onChange={(e) => setProfile(e.target.value as LibraryProfile)}
              >
                {PROFILES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="library-drawer__btn"
                disabled={busy}
                onClick={() => void saveCurrentPreset()}
              >
                Guardar live aquí
              </button>
            </div>
            <ul className="library-drawer__list">
              {index.presets.map((item) => (
                <li key={item.id} className="library-drawer__row">
                  <label className="library-drawer__check">
                    <input
                      type="checkbox"
                      checked={selectedPresetIds.has(item.id)}
                      onChange={() =>
                        toggleId(selectedPresetIds, item.id, setSelectedPresetIds)
                      }
                    />
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.profile} · {new Date(item.updatedAt).toLocaleString()}
                      </small>
                    </span>
                  </label>
                  <div className="library-drawer__row-actions">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void applyPreset(item)}
                    >
                      Aplicar
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void deletePreset(item.id)}
                    >
                      Borrar
                    </button>
                  </div>
                </li>
              ))}
              {index.presets.length === 0 ? (
                <li className="library-drawer__empty">Aún no hay presets locales.</li>
              ) : null}
            </ul>
          </>
        ) : null}

        {tab === "irs" ? (
          <>
            <div className="library-drawer__form">
              <button
                type="button"
                className="library-drawer__btn"
                disabled={busy}
                onClick={() => irFileRef.current?.click()}
              >
                Importar WAV a biblioteca
              </button>
              <p className="library-drawer__hint">Destino pedal: Cab {irCabinet}</p>
            </div>
            <ul className="library-drawer__list">
              {index.irs.map((item) => (
                <li key={item.id} className="library-drawer__row">
                  <label className="library-drawer__check">
                    <input
                      type="checkbox"
                      checked={selectedIrIds.has(item.id)}
                      onChange={() => toggleId(selectedIrIds, item.id, setSelectedIrIds)}
                    />
                    <span>
                      <strong>{item.name}</strong>
                      <small>{Math.round(item.byteLength / 1024)} KB</small>
                    </span>
                  </label>
                  <div className="library-drawer__row-actions">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void loadIrToPedal(item)}
                    >
                      → Pedal
                    </button>
                    <button type="button" disabled={busy} onClick={() => void deleteIr(item.id)}>
                      Borrar
                    </button>
                  </div>
                </li>
              ))}
              {index.irs.length === 0 ? (
                <li className="library-drawer__empty">Importa WAVs para reutilizarlos.</li>
              ) : null}
            </ul>
          </>
        ) : null}

        {tab === "backups" ? (
          <ul className="library-drawer__list">
            {index.irBackups.map((item) => (
              <li key={item.id} className="library-drawer__row">
                <span>
                  <strong>
                    Cab {item.cabinet} · ROM {item.romSlot}
                  </strong>
                  <small>
                    {new Date(item.createdAt).toLocaleString()}
                    {item.sourceName ? ` · ${item.sourceName}` : ""}
                  </small>
                </span>
                <div className="library-drawer__row-actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void restoreBackup(item)}
                  >
                    Restaurar
                  </button>
                </div>
              </li>
            ))}
            {index.irBackups.length === 0 ? (
              <li className="library-drawer__empty">
                Los backups se crean solos antes de cargar un IR.
              </li>
            ) : null}
          </ul>
        ) : null}

        {tab === "packs" ? (
          <>
            <div className="library-drawer__form">
              <input
                className="library-drawer__input"
                value={packName}
                disabled={busy}
                onChange={(e) => setPackName(e.target.value)}
                placeholder="Nombre del pack"
              />
              <label className="library-drawer__check">
                <input
                  type="checkbox"
                  checked={includeBank}
                  disabled={busy}
                  onChange={(e) => setIncludeBank(e.target.checked)}
                />
                Incluir bank A+B+C actual
              </label>
              <button
                type="button"
                className="library-drawer__btn"
                disabled={busy}
                onClick={() => void createPack()}
              >
                Crear pack ({selectedPresetIds.size}P / {selectedIrIds.size}IR)
              </button>
              <button
                type="button"
                className="library-drawer__btn library-drawer__btn--ghost"
                disabled={busy}
                onClick={() => void importPack()}
              >
                Importar ZIP
              </button>
            </div>
            <ul className="library-drawer__list">
              {index.packs.map((pack) => (
                <li key={pack.id} className="library-drawer__row">
                  <span>
                    <strong>{pack.name}</strong>
                    <small>
                      {pack.presetIds.length} presets · {pack.irIds.length} IR
                      {pack.hasBank ? " · bank" : ""}
                    </small>
                  </span>
                  <div className="library-drawer__row-actions">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void exportPack(pack)}
                    >
                      Exportar ZIP
                    </button>
                  </div>
                </li>
              ))}
              {index.packs.length === 0 ? (
                <li className="library-drawer__empty">Marca items en Presets/IRs y crea un pack.</li>
              ) : null}
            </ul>
          </>
        ) : null}
      </div>

      <input
        ref={irFileRef}
        type="file"
        accept=".wav,audio/wav"
        hidden
        onChange={(e) => void onImportIrFile(e.target.files)}
      />
    </aside>
  );
}
