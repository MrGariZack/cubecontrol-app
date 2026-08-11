import { useCallback, useEffect, useMemo, useState } from "react";
import type { PresetSlotId } from "@tonehub/cube-baby-protocol";
import type {
  IrLibraryItem,
  LibraryIndex,
  LibraryProfile,
  PresetLibraryItem,
  ShowLibraryItem,
  SongLibraryItem,
} from "../../electron/library/types";
import { FAVORITE_TAG } from "../../electron/library/types";
import type { LiveParamsSnapshot } from "../types/device";
import { MicDistanceRail } from "./cube-baby/MicDistanceRail";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import "./library-workspace.css";

export type LibrarySection = "tones" | "songs" | "shows" | "more";

type LibraryWorkspaceProps = {
  readonly busy: boolean;
  readonly liveParams: LiveParamsSnapshot;
  readonly irCabinet: number;
  readonly irDistance: number;
  readonly activeShowId: string | null;
  readonly activeSongIndex: number;
  readonly onIrDistanceChange: (d: number) => void;
  readonly onStatus: (message: string | null) => void;
  readonly onError: (message: string | null) => void;
  readonly onBusy: (busy: boolean) => void;
  readonly onApplyPreset: (params: LiveParamsSnapshot, label: string) => Promise<void>;
  readonly onApplySong: (song: SongLibraryItem) => Promise<void>;
  readonly onArmBank: (slots: {
    readonly A: SongLibraryItem | null;
    readonly B: SongLibraryItem | null;
    readonly C: SongLibraryItem | null;
  }) => Promise<void>;
  readonly onAssignSongToSlot: (song: SongLibraryItem, slot: PresetSlotId) => Promise<void>;
  readonly onActiveShowChange: (showId: string | null, songIndex?: number) => void;
  readonly onEnterStage: (showId: string) => void;
  readonly onCabinetApplied: (cabinet: number) => void;
};

const PROFILES: readonly LibraryProfile[] = ["ensayo", "directo", "grabacion", "otro"];

function emptyIndex(): LibraryIndex {
  return {
    format: "tonehub-library-index-v1",
    presets: [],
    irs: [],
    irBackups: [],
    packs: [],
    songs: [],
    shows: [],
  };
}

function isFavorite(tags: readonly string[]): boolean {
  return tags.includes(FAVORITE_TAG);
}

function toggleFavoriteTag(tags: readonly string[]): string[] {
  return isFavorite(tags)
    ? tags.filter((t) => t !== FAVORITE_TAG)
    : [...tags, FAVORITE_TAG];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

type SaveSheet = {
  readonly mode: "new" | "update";
  readonly id?: string;
  readonly name: string;
  readonly profile: LibraryProfile;
  readonly notes: string;
  readonly tags: string;
};

export function LibraryWorkspace(props: LibraryWorkspaceProps) {
  const {
    busy,
    liveParams,
    irCabinet,
    irDistance,
    activeShowId,
    activeSongIndex,
    onIrDistanceChange,
    onStatus,
    onError,
    onBusy,
    onApplyPreset,
    onApplySong,
    onArmBank,
    onAssignSongToSlot,
    onActiveShowChange,
    onEnterStage,
    onCabinetApplied,
  } = props;

  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [section, setSection] = useState<LibrarySection>("tones");
  const [index, setIndex] = useState<LibraryIndex>(emptyIndex());
  const [query, setQuery] = useState("");
  const [profileFilter, setProfileFilter] = useState<LibraryProfile | "all" | "favorites">("all");
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [selectedShowId, setSelectedShowId] = useState<string | null>(null);
  const [saveSheet, setSaveSheet] = useState<SaveSheet | null>(null);
  const [songDraft, setSongDraft] = useState<{
    step: 1 | 2;
    name: string;
    presetId: string;
    irId: string;
    notes: string;
    id?: string;
  } | null>(null);
  const [armSlots, setArmSlots] = useState<{
    A: string | null;
    B: string | null;
    C: string | null;
  }>({ A: null, B: null, C: null });
  const [armOpen, setArmOpen] = useState(false);
  const [dragSongId, setDragSongId] = useState<string | null>(null);
  const [moreTab, setMoreTab] = useState<"irs" | "backups" | "export">("irs");

  const refresh = useCallback(async () => {
    const next = await window.tonehubDesktop.library.list();
    setIndex(next);
  }, []);

  useEffect(() => {
    void refresh().catch((err: unknown) => {
      onError(err instanceof Error ? err.message : String(err));
    });
  }, [refresh, onError]);

  useEffect(() => {
    if (activeShowId) setSelectedShowId(activeShowId);
  }, [activeShowId]);

  const filteredPresets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return index.presets.filter((p) => {
      if (profileFilter === "favorites" && !isFavorite(p.tags)) return false;
      if (profileFilter !== "all" && profileFilter !== "favorites" && p.profile !== profileFilter) {
        return false;
      }
      if (q === "") return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.notes.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [index.presets, query, profileFilter]);

  const filteredSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return index.songs.filter((s) => {
      if (q === "") return true;
      return s.name.toLowerCase().includes(q) || s.notes.toLowerCase().includes(q);
    });
  }, [index.songs, query]);

  const selectedShow = index.shows.find((s) => s.id === selectedShowId) ?? null;
  const selectedPreset = index.presets.find((p) => p.id === selectedPresetId) ?? null;
  const selectedSong = index.songs.find((s) => s.id === selectedSongId) ?? null;

  async function runBusy(fn: () => Promise<void>) {
    onBusy(true);
    onError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      onBusy(false);
    }
  }

  async function persistPreset(sheet: SaveSheet) {
    await runBusy(async () => {
      const tags = sheet.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const item = await window.tonehubDesktop.library.savePreset({
        name: sheet.name,
        profile: sheet.profile,
        notes: sheet.notes,
        tags,
        params: liveParams,
        ...(sheet.mode === "update" && sheet.id ? { id: sheet.id } : {}),
      });
      setSelectedPresetId(item.id);
      setSaveSheet(null);
      onStatus(
        sheet.mode === "update" ? `Tono actualizado · ${item.name}` : `Tono guardado · ${item.name}`,
      );
    });
  }

  async function toggleFavorite(preset: PresetLibraryItem) {
    await runBusy(async () => {
      await window.tonehubDesktop.library.savePreset({
        id: preset.id,
        name: preset.name,
        notes: preset.notes,
        tags: toggleFavoriteTag(preset.tags),
        profile: preset.profile,
        params: preset.params,
      });
    });
  }

  async function deletePreset(id: string) {
    const ok = await confirm({
      title: "Borrar tono",
      body: "Se elimina de la biblioteca local. El pedal no se toca.",
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    await runBusy(async () => {
      await window.tonehubDesktop.library.deletePreset(id);
      if (selectedPresetId === id) setSelectedPresetId(null);
      onStatus("Tono eliminado");
    });
  }

  async function saveSongFromDraft() {
    if (songDraft === null || songDraft.presetId === "") return;
    await runBusy(async () => {
      const item = await window.tonehubDesktop.library.saveSong({
        name: songDraft.name,
        notes: songDraft.notes,
        presetId: songDraft.presetId,
        ...(songDraft.irId ? { irId: songDraft.irId, irCabinet, irDistance } : {}),
        ...(songDraft.id ? { id: songDraft.id } : {}),
      });
      setSongDraft(null);
      setSelectedSongId(item.id);
      setSection("songs");
      onStatus(`Canción lista · ${item.name}`);
    });
  }

  async function deleteSong(id: string) {
    const ok = await confirm({
      title: "Borrar canción",
      body: "Se elimina de la biblioteca. Los shows que la referencien quedarán con hueco.",
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    await runBusy(async () => {
      await window.tonehubDesktop.library.deleteSong(id);
      if (selectedSongId === id) setSelectedSongId(null);
      onStatus("Canción eliminada");
    });
  }

  async function createShow() {
    await runBusy(async () => {
      const item = await window.tonehubDesktop.library.saveShow({
        name: `Show ${index.shows.length + 1}`,
        songIds: [],
      });
      setSelectedShowId(item.id);
      onActiveShowChange(item.id, 0);
      onStatus(`Show creado · ${item.name}`);
    });
  }

  async function updateShowSongs(show: ShowLibraryItem, songIds: string[]) {
    await runBusy(async () => {
      await window.tonehubDesktop.library.saveShow({
        id: show.id,
        name: show.name,
        notes: show.notes,
        songIds,
      });
    });
  }

  async function renameShow(show: ShowLibraryItem, name: string) {
    await runBusy(async () => {
      await window.tonehubDesktop.library.saveShow({
        id: show.id,
        name,
        notes: show.notes,
        songIds: [...show.songIds],
      });
    });
  }

  async function deleteShow(id: string) {
    const ok = await confirm({
      title: "Borrar show",
      body: "Se elimina el cue sheet local. Las canciones no se borran.",
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    await runBusy(async () => {
      await window.tonehubDesktop.library.deleteShow(id);
      if (selectedShowId === id) setSelectedShowId(null);
      if (activeShowId === id) onActiveShowChange(null);
      onStatus("Show eliminado");
    });
  }

  function onDropReorder(targetId: string) {
    if (selectedShow === null || dragSongId === null || dragSongId === targetId) {
      setDragSongId(null);
      return;
    }
    const ids = [...selectedShow.songIds];
    const from = ids.indexOf(dragSongId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) {
      setDragSongId(null);
      return;
    }
    ids.splice(from, 1);
    ids.splice(to, 0, dragSongId);
    setDragSongId(null);
    void updateShowSongs(selectedShow, ids);
  }

  async function confirmArm() {
    const resolve = (id: string | null) =>
      id === null ? null : (index.songs.find((s) => s.id === id) ?? null);
    await onArmBank({
      A: resolve(armSlots.A),
      B: resolve(armSlots.B),
      C: resolve(armSlots.C),
    });
    setArmOpen(false);
  }

  async function importIrFile(file: File | undefined) {
    if (file === undefined) return;
    await runBusy(async () => {
      const wav = new Uint8Array(await file.arrayBuffer());
      const item = await window.tonehubDesktop.library.importIrWav({
        name: file.name.replace(/\.wav$/i, ""),
        wav,
        profile: "otro",
      });
      onStatus(`IR importado · ${item.name}`);
    });
  }

  async function loadIr(item: IrLibraryItem) {
    if (irCabinet !== 8) {
      const ok = await confirm({
        title: `«${item.name}» → Cab ${irCabinet}`,
        body: "Puede pisar IR de fábrica. Prefiere Cab 8.",
        tone: "danger",
        confirmLabel: "Seguir",
      });
      if (!ok) return;
      const ok2 = await confirm({
        title: "Última confirmación",
        body: `¿Sobreescribir Cab ${irCabinet}?`,
        tone: "danger",
        requireTyped: `CAB${irCabinet}`,
        confirmLabel: "Escribir IR",
      });
      if (!ok2) return;
    }
    await runBusy(async () => {
      const result = await window.tonehubDesktop.library.loadIrToPedal(item.id, irCabinet, {
        confirmFactoryIrOverwrite: irCabinet !== 8,
        distance: irDistance,
      });
      onCabinetApplied(result.cabinet);
      onStatus(`IR → Cab ${result.cabinet} · dist ${Math.round(irDistance * 100)}%`);
    });
  }

  async function exportShow() {
    if (selectedShow === null) return;
    await runBusy(async () => {
      const pack = await window.tonehubDesktop.library.exportShowAsPack(selectedShow.id);
      const exported = await window.tonehubDesktop.library.exportPack(pack.id);
      onStatus(exported ? `Show exportado · ${exported.path}` : "Exportación cancelada");
    });
  }

  return (
    <div className="lib-ws" aria-label="Biblioteca CubeControl">
      <header className="lib-ws__top">
        <div className="lib-ws__brand">
          <h1 className="lib-ws__title">Biblioteca</h1>
          <p className="lib-ws__subtitle">Tonos, canciones y shows — sin apiñar el pedal</p>
        </div>
        <nav className="lib-ws__nav" aria-label="Secciones biblioteca">
          {(
            [
              ["tones", "Tonos"],
              ["songs", "Canciones"],
              ["shows", "Shows"],
              ["more", "Más"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={section === id ? "lib-ws__nav-btn is-active" : "lib-ws__nav-btn"}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="lib-ws__body" aria-live="polite">
        {section === "tones" ? (
          <>
            <aside className="lib-ws__list-pane">
              <label className="lib-ws__search">
                <span className="visually-hidden">Buscar tonos</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar tonos…"
                  disabled={busy}
                />
              </label>
              <div className="lib-ws__chips" role="group" aria-label="Filtros">
                <button
                  type="button"
                  className={profileFilter === "all" ? "lib-ws__chip is-on" : "lib-ws__chip"}
                  onClick={() => setProfileFilter("all")}
                >
                  Todos
                </button>
                <button
                  type="button"
                  className={profileFilter === "favorites" ? "lib-ws__chip is-on" : "lib-ws__chip"}
                  onClick={() => setProfileFilter("favorites")}
                >
                  Favoritos
                </button>
                {PROFILES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={profileFilter === p ? "lib-ws__chip is-on" : "lib-ws__chip"}
                    onClick={() => setProfileFilter(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <ul className="lib-ws__rows">
                {filteredPresets.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={
                        selectedPresetId === p.id ? "lib-ws__row is-selected" : "lib-ws__row"
                      }
                      onClick={() => setSelectedPresetId(p.id)}
                    >
                      <span className="lib-ws__row-title">
                        {isFavorite(p.tags) ? "★ " : ""}
                        {p.name}
                      </span>
                      <span className="lib-ws__row-meta">
                        {p.profile} · {formatDate(p.updatedAt)}
                      </span>
                    </button>
                  </li>
                ))}
                {filteredPresets.length === 0 ? (
                  <li className="lib-ws__empty">Ningún tono coincide</li>
                ) : null}
              </ul>
              <div className="lib-ws__list-actions">
                <button
                  type="button"
                  className="lib-ws__primary"
                  disabled={busy}
                  onClick={() =>
                    setSaveSheet({
                      mode: "new",
                      name: "Mi tono",
                      profile: "ensayo",
                      notes: "",
                      tags: "",
                    })
                  }
                >
                  Guardar live aquí
                </button>
              </div>
            </aside>
            <main className="lib-ws__detail">
              {selectedPreset === null ? (
                <p className="lib-ws__placeholder">
                  Elige un tono o guarda el live actual. Un solo clic para aplicar al pedal.
                </p>
              ) : (
                <div className="lib-ws__detail-card">
                  <h2 className="lib-ws__detail-title">{selectedPreset.name}</h2>
                  <p className="lib-ws__detail-meta">
                    {selectedPreset.profile}
                    {selectedPreset.notes ? ` · ${selectedPreset.notes}` : ""}
                  </p>
                  <div className="lib-ws__detail-actions">
                    <button
                      type="button"
                      className="lib-ws__primary lib-ws__primary--lg"
                      disabled={busy}
                      onClick={() =>
                        void onApplyPreset(selectedPreset.params, `tono · ${selectedPreset.name}`)
                      }
                    >
                      Aplicar al live
                    </button>
                    <button
                      type="button"
                      className="lib-ws__ghost"
                      disabled={busy}
                      onClick={() => void toggleFavorite(selectedPreset)}
                    >
                      {isFavorite(selectedPreset.tags) ? "Quitar favorito" : "Favorito"}
                    </button>
                    <button
                      type="button"
                      className="lib-ws__ghost"
                      disabled={busy}
                      onClick={() =>
                        setSaveSheet({
                          mode: "update",
                          id: selectedPreset.id,
                          name: selectedPreset.name,
                          profile: selectedPreset.profile,
                          notes: selectedPreset.notes,
                          tags: selectedPreset.tags.filter((t) => t !== FAVORITE_TAG).join(", "),
                        })
                      }
                    >
                      Actualizar con live
                    </button>
                    <button
                      type="button"
                      className="lib-ws__danger"
                      disabled={busy}
                      onClick={() => void deletePreset(selectedPreset.id)}
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              )}
            </main>
          </>
        ) : null}

        {section === "songs" ? (
          <>
            <aside className="lib-ws__list-pane">
              <label className="lib-ws__search">
                <span className="visually-hidden">Buscar canciones</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar canciones…"
                  disabled={busy}
                />
              </label>
              <ul className="lib-ws__rows">
                {filteredSongs.map((s) => {
                  const tone = index.presets.find((p) => p.id === s.presetId);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        className={
                          selectedSongId === s.id ? "lib-ws__row is-selected" : "lib-ws__row"
                        }
                        onClick={() => setSelectedSongId(s.id)}
                      >
                        <span className="lib-ws__row-title">{s.name}</span>
                        <span className="lib-ws__row-meta">{tone?.name ?? "tono ausente"}</span>
                      </button>
                    </li>
                  );
                })}
                {filteredSongs.length === 0 ? (
                  <li className="lib-ws__empty">Crea una canción desde un tono</li>
                ) : null}
              </ul>
              <div className="lib-ws__list-actions">
                <button
                  type="button"
                  className="lib-ws__primary"
                  disabled={busy || index.presets.length === 0}
                  onClick={() =>
                    setSongDraft({
                      step: 1,
                      name: "Nueva canción",
                      presetId: index.presets[0]?.id ?? "",
                      irId: "",
                      notes: "",
                    })
                  }
                >
                  Nueva canción
                </button>
              </div>
            </aside>
            <main className="lib-ws__detail">
              {songDraft !== null ? (
                <div className="lib-ws__detail-card">
                  <h2 className="lib-ws__detail-title">
                    {songDraft.step === 1 ? "1 · Elige el tono" : "2 · IR opcional"}
                  </h2>
                  {songDraft.step === 1 ? (
                    <>
                      <label className="lib-ws__field">
                        Nombre
                        <input
                          value={songDraft.name}
                          onChange={(e) => setSongDraft({ ...songDraft, name: e.target.value })}
                        />
                      </label>
                      <ul className="lib-ws__pick">
                        {index.presets.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              className={
                                songDraft.presetId === p.id
                                  ? "lib-ws__row is-selected"
                                  : "lib-ws__row"
                              }
                              onClick={() => setSongDraft({ ...songDraft, presetId: p.id })}
                            >
                              <span className="lib-ws__row-title">{p.name}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div className="lib-ws__detail-actions">
                        <button
                          type="button"
                          className="lib-ws__primary"
                          onClick={() => setSongDraft({ ...songDraft, step: 2 })}
                        >
                          Siguiente
                        </button>
                        <button
                          type="button"
                          className="lib-ws__ghost"
                          onClick={() => setSongDraft(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="lib-ws__detail-meta">
                        Puedes saltar el IR. Distance se guarda con la canción.
                      </p>
                      <ul className="lib-ws__pick">
                        <li>
                          <button
                            type="button"
                            className={
                              songDraft.irId === "" ? "lib-ws__row is-selected" : "lib-ws__row"
                            }
                            onClick={() => setSongDraft({ ...songDraft, irId: "" })}
                          >
                            <span className="lib-ws__row-title">Sin IR</span>
                          </button>
                        </li>
                        {index.irs.map((ir) => (
                          <li key={ir.id}>
                            <button
                              type="button"
                              className={
                                songDraft.irId === ir.id
                                  ? "lib-ws__row is-selected"
                                  : "lib-ws__row"
                              }
                              onClick={() => setSongDraft({ ...songDraft, irId: ir.id })}
                            >
                              <span className="lib-ws__row-title">{ir.name}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      {songDraft.irId ? (
                        <MicDistanceRail
                          compact
                          value={irDistance}
                          onChange={onIrDistanceChange}
                          disabled={busy}
                        />
                      ) : null}
                      <div className="lib-ws__detail-actions">
                        <button
                          type="button"
                          className="lib-ws__primary lib-ws__primary--lg"
                          disabled={busy}
                          onClick={() => void saveSongFromDraft()}
                        >
                          Guardar canción
                        </button>
                        <button
                          type="button"
                          className="lib-ws__ghost"
                          onClick={() => setSongDraft({ ...songDraft, step: 1 })}
                        >
                          Atrás
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : selectedSong === null ? (
                <p className="lib-ws__placeholder">
                  Una canción une un tono (y opcionalmente un IR) para tu setlist.
                </p>
              ) : (
                <div className="lib-ws__detail-card">
                  <h2 className="lib-ws__detail-title">{selectedSong.name}</h2>
                  <p className="lib-ws__detail-meta">
                    Tono:{" "}
                    {index.presets.find((p) => p.id === selectedSong.presetId)?.name ?? "—"}
                    {selectedSong.irId
                      ? ` · IR: ${index.irs.find((i) => i.id === selectedSong.irId)?.name ?? "—"}`
                      : ""}
                  </p>
                  <div className="lib-ws__detail-actions">
                    <button
                      type="button"
                      className="lib-ws__primary lib-ws__primary--lg"
                      disabled={busy}
                      onClick={() => void onApplySong(selectedSong)}
                    >
                      Aplicar canción
                    </button>
                    <button
                      type="button"
                      className="lib-ws__ghost"
                      disabled={busy}
                      onClick={() => void onAssignSongToSlot(selectedSong, "A")}
                    >
                      → Foot A
                    </button>
                    <button
                      type="button"
                      className="lib-ws__ghost"
                      disabled={busy}
                      onClick={() => void onAssignSongToSlot(selectedSong, "B")}
                    >
                      → Foot B
                    </button>
                    <button
                      type="button"
                      className="lib-ws__ghost"
                      disabled={busy}
                      onClick={() => void onAssignSongToSlot(selectedSong, "C")}
                    >
                      → Foot C
                    </button>
                    <button
                      type="button"
                      className="lib-ws__danger"
                      disabled={busy}
                      onClick={() => void deleteSong(selectedSong.id)}
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              )}
            </main>
          </>
        ) : null}

        {section === "shows" ? (
          <>
            <aside className="lib-ws__list-pane">
              <ul className="lib-ws__rows">
                {index.shows.map((show) => (
                  <li key={show.id}>
                    <button
                      type="button"
                      className={
                        selectedShowId === show.id ? "lib-ws__row is-selected" : "lib-ws__row"
                      }
                      onClick={() => {
                        setSelectedShowId(show.id);
                        onActiveShowChange(show.id, 0);
                      }}
                    >
                      <span className="lib-ws__row-title">{show.name}</span>
                      <span className="lib-ws__row-meta">{show.songIds.length} temas</span>
                    </button>
                  </li>
                ))}
                {index.shows.length === 0 ? (
                  <li className="lib-ws__empty">Crea un show para armar el set</li>
                ) : null}
              </ul>
              <div className="lib-ws__list-actions">
                <button
                  type="button"
                  className="lib-ws__primary"
                  disabled={busy}
                  onClick={() => void createShow()}
                >
                  Nuevo show
                </button>
              </div>
            </aside>
            <main className="lib-ws__detail">
              {selectedShow === null ? (
                <p className="lib-ws__placeholder">
                  El show es tu cue sheet. Ordénalo, arma A/B/C y entra a escenario.
                </p>
              ) : armOpen ? (
                <div className="lib-ws__detail-card">
                  <h2 className="lib-ws__detail-title">Armar bank A · B · C</h2>
                  <p className="lib-ws__detail-meta">
                    Elige una canción del show para cada footswitch.
                  </p>
                  <div className="lib-ws__arm">
                    {(["A", "B", "C"] as const).map((slot) => (
                      <label key={slot} className="lib-ws__arm-slot">
                        <span className="lib-ws__arm-letter">Foot {slot}</span>
                        <select
                          value={armSlots[slot] ?? ""}
                          disabled={busy}
                          onChange={(e) =>
                            setArmSlots({
                              ...armSlots,
                              [slot]: e.target.value === "" ? null : e.target.value,
                            })
                          }
                        >
                          <option value="">— vacío —</option>
                          {selectedShow.songIds.map((sid) => {
                            const song = index.songs.find((s) => s.id === sid);
                            return (
                              <option key={sid} value={sid}>
                                {song?.name ?? sid.slice(0, 8)}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                    ))}
                  </div>
                  <div className="lib-ws__detail-actions">
                    <button
                      type="button"
                      className="lib-ws__primary lib-ws__primary--lg"
                      disabled={busy}
                      onClick={() => void confirmArm()}
                    >
                      Escribir al pedal
                    </button>
                    <button
                      type="button"
                      className="lib-ws__ghost"
                      onClick={() => setArmOpen(false)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="lib-ws__detail-card lib-ws__detail-card--wide">
                  <div className="lib-ws__show-head">
                    <input
                      className="lib-ws__show-name"
                      defaultValue={selectedShow.name}
                      key={selectedShow.id + selectedShow.updatedAt}
                      disabled={busy}
                      aria-label="Nombre del show"
                      onBlur={(e) => {
                        const name = e.target.value.trim();
                        if (name && name !== selectedShow.name) {
                          void renameShow(selectedShow, name);
                        }
                      }}
                    />
                    <div className="lib-ws__detail-actions lib-ws__detail-actions--inline">
                      <button
                        type="button"
                        className="lib-ws__primary"
                        disabled={busy || selectedShow.songIds.length === 0}
                        onClick={() => onEnterStage(selectedShow.id)}
                      >
                        Modo escenario
                      </button>
                      <button
                        type="button"
                        className="lib-ws__ghost"
                        disabled={busy || selectedShow.songIds.length === 0}
                        onClick={() => {
                          setArmSlots({
                            A: selectedShow.songIds[0] ?? null,
                            B: selectedShow.songIds[1] ?? null,
                            C: selectedShow.songIds[2] ?? null,
                          });
                          setArmOpen(true);
                        }}
                      >
                        Armar A/B/C
                      </button>
                      <button
                        type="button"
                        className="lib-ws__ghost"
                        disabled={busy}
                        onClick={() => void exportShow()}
                      >
                        Exportar ZIP
                      </button>
                      <button
                        type="button"
                        className="lib-ws__danger"
                        disabled={busy}
                        onClick={() => void deleteShow(selectedShow.id)}
                      >
                        Borrar show
                      </button>
                    </div>
                  </div>

                  <ol className="lib-ws__cue" aria-label="Cue sheet">
                    {selectedShow.songIds.map((sid, i) => {
                      const song = index.songs.find((s) => s.id === sid);
                      const active = activeShowId === selectedShow.id && activeSongIndex === i;
                      return (
                        <li
                          key={`${sid}-${i}`}
                          className={active ? "lib-ws__cue-row is-active" : "lib-ws__cue-row"}
                          draggable={!busy}
                          onDragStart={() => setDragSongId(sid)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => onDropReorder(sid)}
                        >
                          <span className="lib-ws__cue-num" aria-hidden>
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <button
                            type="button"
                            className="lib-ws__cue-title"
                            disabled={busy || !song}
                            onClick={() => {
                              onActiveShowChange(selectedShow.id, i);
                              if (song) void onApplySong(song);
                            }}
                          >
                            {song?.name ?? "Canción eliminada"}
                          </button>
                          <span className="lib-ws__cue-handle" title="Arrastra para reordenar">
                            ⋮⋮
                          </span>
                          <button
                            type="button"
                            className="lib-ws__cue-remove"
                            aria-label={`Quitar ${song?.name ?? "canción"} del show`}
                            disabled={busy}
                            onClick={() =>
                              void updateShowSongs(
                                selectedShow,
                                selectedShow.songIds.filter((_, idx) => idx !== i),
                              )
                            }
                          >
                            Quitar
                          </button>
                        </li>
                      );
                    })}
                  </ol>

                  <div className="lib-ws__add-song">
                    <p className="lib-ws__detail-meta">Añadir canción al show</p>
                    <div className="lib-ws__add-song-list">
                      {index.songs
                        .filter((s) => !selectedShow.songIds.includes(s.id))
                        .map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="lib-ws__ghost"
                            disabled={busy}
                            onClick={() =>
                              void updateShowSongs(selectedShow, [...selectedShow.songIds, s.id])
                            }
                          >
                            + {s.name}
                          </button>
                        ))}
                      {index.songs.every((s) => selectedShow.songIds.includes(s.id)) ? (
                        <span className="lib-ws__empty">Todas las canciones ya están en el show</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </main>
          </>
        ) : null}

        {section === "more" ? (
          <main className="lib-ws__detail lib-ws__detail--solo">
            <div className="lib-ws__chips" role="tablist" aria-label="Más herramientas">
              {(
                [
                  ["irs", "IRs"],
                  ["backups", "Backups IR"],
                  ["export", "Packs"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={moreTab === id}
                  className={moreTab === id ? "lib-ws__chip is-on" : "lib-ws__chip"}
                  onClick={() => setMoreTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {moreTab === "irs" ? (
              <div className="lib-ws__detail-card">
                <h2 className="lib-ws__detail-title">Impulse responses</h2>
                <MicDistanceRail
                  compact
                  value={irDistance}
                  onChange={onIrDistanceChange}
                  disabled={busy}
                />
                <label className="lib-ws__primary lib-ws__file">
                  Importar WAV
                  <input
                    type="file"
                    accept=".wav,audio/wav"
                    hidden
                    disabled={busy}
                    onChange={(e) => void importIrFile(e.target.files?.[0])}
                  />
                </label>
                <ul className="lib-ws__rows lib-ws__rows--flat">
                  {index.irs.map((ir) => (
                    <li key={ir.id} className="lib-ws__flat-row">
                      <span>{ir.name}</span>
                      <button
                        type="button"
                        className="lib-ws__ghost"
                        disabled={busy}
                        onClick={() => void loadIr(ir)}
                      >
                        → Pedal Cab {irCabinet}
                      </button>
                      <button
                        type="button"
                        className="lib-ws__danger"
                        disabled={busy}
                        onClick={() =>
                          void runBusy(async () => {
                            await window.tonehubDesktop.library.deleteIr(ir.id);
                            onStatus("IR eliminado");
                          })
                        }
                      >
                        Borrar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {moreTab === "backups" ? (
              <div className="lib-ws__detail-card">
                <h2 className="lib-ws__detail-title">Backups ROM</h2>
                <ul className="lib-ws__rows lib-ws__rows--flat">
                  {index.irBackups.map((b) => (
                    <li key={b.id} className="lib-ws__flat-row">
                      <span>
                        Cab {b.cabinet} · {formatDate(b.createdAt)}
                        {b.sourceName ? ` · ${b.sourceName}` : ""}
                      </span>
                      <button
                        type="button"
                        className="lib-ws__ghost"
                        disabled={busy}
                        onClick={() =>
                          void runBusy(async () => {
                            const ok = await confirm({
                              title: `Restaurar Cab ${b.cabinet}`,
                              body: "Sobrescribe el IR actual en ese cabinet del pedal.",
                              detail: b.sourceName
                                ? `Backup · ${b.sourceName}`
                                : formatDate(b.createdAt),
                              tone: "danger",
                              requireTyped: `CAB${b.cabinet}`,
                              confirmLabel: "Restaurar",
                            });
                            if (!ok) return;
                            const result =
                              await window.tonehubDesktop.library.restoreIrBackup(b.id);
                            onCabinetApplied(result.cabinet);
                            onStatus(`Backup restaurado · Cab ${result.cabinet}`);
                          })
                        }
                      >
                        Restaurar
                      </button>
                    </li>
                  ))}
                  {index.irBackups.length === 0 ? (
                    <li className="lib-ws__empty">Aún no hay backups</li>
                  ) : null}
                </ul>
              </div>
            ) : null}
            {moreTab === "export" ? (
              <div className="lib-ws__detail-card">
                <h2 className="lib-ws__detail-title">Packs</h2>
                <p className="lib-ws__detail-meta">
                  Preferimos exportar desde un Show. Aquí puedes importar un ZIP antiguo.
                </p>
                <button
                  type="button"
                  className="lib-ws__primary"
                  disabled={busy}
                  onClick={() =>
                    void runBusy(async () => {
                      const result = await window.tonehubDesktop.library.importPack();
                      onStatus(result ? `Pack importado · ${result.pack.name}` : "Cancelado");
                    })
                  }
                >
                  Importar pack ZIP
                </button>
                <ul className="lib-ws__rows lib-ws__rows--flat">
                  {index.packs.map((pack) => (
                    <li key={pack.id} className="lib-ws__flat-row">
                      <span>{pack.name}</span>
                      <button
                        type="button"
                        className="lib-ws__ghost"
                        disabled={busy}
                        onClick={() =>
                          void runBusy(async () => {
                            const exported = await window.tonehubDesktop.library.exportPack(
                              pack.id,
                            );
                            onStatus(
                              exported ? `Exportado · ${exported.path}` : "Cancelado",
                            );
                          })
                        }
                      >
                        Exportar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </main>
        ) : null}
      </div>

      {saveSheet !== null ? (
        <div className="lib-ws__sheet" role="dialog" aria-modal="true" aria-label="Guardar tono">
          <div className="lib-ws__sheet-card">
            <h2 className="lib-ws__detail-title">
              {saveSheet.mode === "update" ? "Actualizar tono" : "Guardar tono live"}
            </h2>
            <label className="lib-ws__field">
              Nombre
              <input
                value={saveSheet.name}
                onChange={(e) => setSaveSheet({ ...saveSheet, name: e.target.value })}
              />
            </label>
            <label className="lib-ws__field">
              Perfil
              <select
                value={saveSheet.profile}
                onChange={(e) =>
                  setSaveSheet({
                    ...saveSheet,
                    profile: e.target.value as LibraryProfile,
                  })
                }
              >
                {PROFILES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <details className="lib-ws__more-details">
              <summary>Más detalles</summary>
              <label className="lib-ws__field">
                Notas
                <input
                  value={saveSheet.notes}
                  onChange={(e) => setSaveSheet({ ...saveSheet, notes: e.target.value })}
                />
              </label>
              <label className="lib-ws__field">
                Tags (coma)
                <input
                  value={saveSheet.tags}
                  onChange={(e) => setSaveSheet({ ...saveSheet, tags: e.target.value })}
                />
              </label>
            </details>
            <div className="lib-ws__detail-actions">
              <button
                type="button"
                className="lib-ws__primary lib-ws__primary--lg"
                disabled={busy}
                onClick={() => void persistPreset(saveSheet)}
              >
                {saveSheet.mode === "update" ? "Actualizar" : "Guardar"}
              </button>
              <button
                type="button"
                className="lib-ws__ghost"
                onClick={() => setSaveSheet(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmDialog}
    </div>
  );
}
