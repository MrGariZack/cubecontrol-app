import { useCallback, useEffect, useRef, useState } from "react";
import { LIVE_PARAM_MODULATION_OFF, LIVE_PARAM_NAMES, type LiveParamName, type PresetSlotId } from "@tonehub/cube-baby-protocol";
import { ComparePanel } from "../components/ComparePanel";
import { CubeBabyPedal } from "../components/cube-baby/CubeBabyPedal";
import { DeviceWorkspace } from "../components/DeviceWorkspace";
import { LibraryWorkspace } from "../components/LibraryWorkspace";
import { StageMode } from "../components/StageMode";
import { StudioSidebar, type StudioNavId } from "../components/StudioSidebar";
import { StudioToolbar } from "../components/StudioToolbar";
import { TunerPanel } from "../components/TunerPanel";
import { midiLog, midiWarn } from "../debug/midiLog";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { useDebouncedLiveWrite } from "../hooks/useDebouncedLiveWrite";
import type { BankSnapshot, DesktopConnectionInfo, LiveParamsSnapshot } from "../types/device";
import type { MatchVolumesSource } from "../../electron/deviceBridge";
import type { ShowLibraryItem, SlotDiffRow, SongLibraryItem } from "../../electron/library/types";

function liveDiffersFromBankSlot(
  live: LiveParamsSnapshot,
  bank: BankSnapshot,
  slot: PresetSlotId,
): boolean {
  const stored = bank.slots.find((item) => item.slot === slot);
  if (stored === undefined) return true;
  return LIVE_PARAM_NAMES.some((name) => live[name] !== stored[name]);
}

type StudioScreenProps = {
  readonly connection: DesktopConnectionInfo;
  readonly onDisconnect: () => void;
};

function slotParams(bank: BankSnapshot, slot: PresetSlotId): LiveParamsSnapshot {
  const stored = bank.slots.find((item) => item.slot === slot);
  if (stored === undefined) {
    throw new Error(`slot ${slot} missing from bank cache`);
  }
  const { slot: _id, ...params } = stored;
  return params;
}

export function StudioScreen({ connection, onDisconnect }: StudioScreenProps) {
  const [activeSlot, setActiveSlot] = useState<PresetSlotId>(connection.activeSlot);
  const [params, setParams] = useState<LiveParamsSnapshot>(connection.liveParams);
  const [bank, setBank] = useState<BankSnapshot>(connection.bank);
  const [irCabinet, setIrCabinet] = useState(8);
  const [irDistance, setIrDistance] = useState(() => {
    try {
      const raw = localStorage.getItem("cubecontrol.irDistance");
      if (raw === null) return 0.5;
      const n = Number(raw);
      return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5;
    } catch {
      return 0.5;
    }
  });
  const [nav, setNav] = useState<StudioNavId>("editor");
  const [activeShow, setActiveShow] = useState<ShowLibraryItem | null>(null);
  const [activeSongIndex, setActiveSongIndex] = useState(0);
  const [librarySongs, setLibrarySongs] = useState<SongLibraryItem[]>([]);
  const [actionBusy, setActionBusy] = useState(false);
  const [loadingSlot, setLoadingSlot] = useState<PresetSlotId | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareRows, setCompareRows] = useState<SlotDiffRow[]>([]);
  const [liveDirty, setLiveDirty] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const paramsRef = useRef(params);
  const slotRef = useRef(activeSlot);
  const bankRef = useRef(bank);
  const slotApplyGen = useRef(0);
  const checkpointArmed = useRef(true);
  const { scheduleWrite, flush, cancelPending } = useDebouncedLiveWrite();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  paramsRef.current = params;
  slotRef.current = activeSlot;
  bankRef.current = bank;
  // Slot sync runs in background — only block UI for save/IR/bank mutations.
  const busy = actionBusy;

  const refreshUndoState = useCallback(async () => {
    const state = await window.tonehubDesktop.library.undoState();
    setUndoCount(state.undoCount);
    setRedoCount(state.redoCount);
  }, []);

  useEffect(() => {
    void refreshUndoState();
  }, [refreshUndoState]);

  const pushCheckpoint = useCallback(async (label: string) => {
    const state = await window.tonehubDesktop.library.pushUndo({
      label,
      params: { ...paramsRef.current },
      activeSlot: slotRef.current,
    });
    setUndoCount(state.undoCount);
    setRedoCount(state.redoCount);
    checkpointArmed.current = false;
  }, []);

  const onParamChange = useCallback(
    (param: LiveParamName, value: number) => {
      midiLog("ui-knob", { slot: slotRef.current, param, value });
      if (checkpointArmed.current) {
        checkpointArmed.current = false;
        void pushCheckpoint(`live:${param}`);
      }

      // Section bit alone sometimes ACKs without muting DSP after a slot push.
      // Off → also park wet controls on the device; On → re-assert UI wet values.
      // UI knobs keep their values while the section LED is off (restore on enable).
      if (param === "delaySection") {
        setParams((prev) => ({ ...prev, delaySection: value }));
        scheduleWrite("delaySection", value);
        if (value === 0) {
          midiLog("ui-section-bypass", {
            section: "delay",
            mix: 0,
            modulation: LIVE_PARAM_MODULATION_OFF,
          });
          scheduleWrite("mix", 0);
          // MOD off = center 8 (not 0 — 0 is full chorus).
          scheduleWrite("modulation", LIVE_PARAM_MODULATION_OFF);
        } else {
          const live = paramsRef.current;
          midiLog("ui-section-restore", {
            section: "delay",
            mix: live.mix,
            modulation: live.modulation,
          });
          scheduleWrite("mix", live.mix);
          scheduleWrite("modulation", live.modulation);
        }
        return;
      }
      if (param === "irSection") {
        setParams((prev) => ({ ...prev, irSection: value }));
        scheduleWrite("irSection", value);
        // Gate alone can ACK without muting — park wet IR path like delay does.
        if (value === 0) {
          midiLog("ui-section-bypass", { section: "ir", reverb: 0 });
          scheduleWrite("reverb", 0);
        } else {
          midiLog("ui-section-restore", {
            section: "ir",
            reverb: paramsRef.current.reverb,
          });
          scheduleWrite("reverb", paramsRef.current.reverb);
        }
        return;
      }
      if (param === "toneSection") {
        // CubeSuite 0x1c is amp-path gate (bypass), not hard silence — park drive knobs.
        setParams((prev) => ({ ...prev, toneSection: value }));
        scheduleWrite("toneSection", value);
        if (value === 0) {
          midiLog("ui-section-bypass", { section: "tone", gain: 0, tone: 0 });
          scheduleWrite("gain", 0);
          scheduleWrite("tone", 0);
        } else {
          const live = paramsRef.current;
          midiLog("ui-section-restore", {
            section: "tone",
            gain: live.gain,
            tone: live.tone,
          });
          scheduleWrite("gain", live.gain);
          scheduleWrite("tone", live.tone);
        }
        return;
      }

      setParams((prev) => ({ ...prev, [param]: value }));
      scheduleWrite(param, value);
      // Mix at 0 only kills delay wet (Mix/FB/Time). MOD is independent (center 7–8 = off).
    },
    [scheduleWrite, pushCheckpoint],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      checkpointArmed.current = true;
    }, 700);
    return () => window.clearTimeout(timer);
  }, [params]);

  async function onSelectSlot(slot: PresetSlotId) {
    if (actionBusy || slot === activeSlot) return;
    const gen = ++slotApplyGen.current;
    setError(null);
    setNav("editor");

    // UI switches instantly from bank cache; live push is coalesced in the bridge
    // (rapid A→B→C only sends the last slot) so knobs on B/C edit the audible tone.
    let nextParams: LiveParamsSnapshot;
    try {
      nextParams = slotParams(bankRef.current, slot);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }

    midiLog("ui-slot-select", { from: activeSlot, to: slot, gen });
    await cancelPending();
    await pushCheckpoint(`antes de slot ${slot}`);
    setParams(nextParams);
    setActiveSlot(slot);
    setLiveDirty(false);
    setLoadingSlot(null);
    checkpointArmed.current = true;
    setStatus(`Slot ${slot} · aplicando…`);

    void window.tonehubDesktop
      .applySlotToLive(slot)
      .then(() => {
        if (gen !== slotApplyGen.current) {
          midiLog("ui-slot-apply-stale", { slot, gen, current: slotApplyGen.current });
          return;
        }
        setStatus(`Slot ${slot}`);
        midiLog("ui-slot-apply-ok", { slot, gen });
      })
      .catch((err: unknown) => {
        if (gen !== slotApplyGen.current) return;
        const message = err instanceof Error ? err.message : String(err);
        midiWarn("ui-slot-apply-fail", { slot, gen, error: message });
        setError(message);
        setStatus(null);
      });
  }

  async function onSave() {
    if (busy) return;
    const ok = await confirm({
      title: `Guardar slot ${activeSlot}`,
      body: "Se reescribe el preset de ese footswitch en el bank del pedal.",
      tone: "warn",
      confirmLabel: `Guardar ${activeSlot}`,
    });
    if (!ok) return;
    setActionBusy(true);
    setError(null);
    setStatus(`Guardando slot ${activeSlot}…`);
    try {
      await flush();
      const result = await window.tonehubDesktop.saveSlot(activeSlot, params);
      setBank(result.bank);
      setLiveDirty(false);
      setStatus(
        result.verified
          ? `Slot ${activeSlot} guardado y verificado`
          : `Slot ${activeSlot} escrito (verify falló — revisa el pedal)`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setActionBusy(false);
    }
  }

  async function onExportBank() {
    if (busy) return;
    setActionBusy(true);
    setError(null);
    setStatus("Exportando bank A+B+C…");
    try {
      await flush();
      const result = await window.tonehubDesktop.exportBank();
      if (result === null) {
        setStatus(null);
        return;
      }
      setStatus(`Bank exportado · ${result.path}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setActionBusy(false);
    }
  }

  async function onImportBank() {
    if (busy) return;
    const ok = await confirm({
      title: "Importar bank",
      body: `Se sobrescriben A+B+C y se carga el slot ${activeSlot} a live.`,
      detail: "Elige un JSON exportado antes. Esto escribe el bank en el pedal.",
      tone: "warn",
      confirmLabel: "Elegir archivo…",
    });
    if (!ok) return;
    setActionBusy(true);
    setError(null);
    setStatus("Importando bank…");
    try {
      await flush();
      await pushCheckpoint("antes de import bank");
      const result = await window.tonehubDesktop.importBank(activeSlot);
      if (result === null) {
        setStatus(null);
        return;
      }
      setParams(result.liveParams);
      setActiveSlot(result.activeSlot);
      setBank(result.bank);
      checkpointArmed.current = true;
      setStatus(
        result.verified
          ? `Bank restaurado · live ${result.activeSlot} · ${result.path}`
          : `Bank escrito (verify falló) · ${result.path}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setActionBusy(false);
    }
  }

  function onIrDistanceChange(distance: number) {
    const next = Math.min(1, Math.max(0, distance));
    setIrDistance(next);
    try {
      localStorage.setItem("cubecontrol.irDistance", String(next));
    } catch {
      /* ignore quota */
    }
  }

  function onLoadIrClick() {
    if (busy) return;
    if (irCabinet < 1 || irCabinet > 8) {
      setError("Elige Cabinet IR 1..8");
      return;
    }
    // Must open the file picker synchronously from the click gesture.
    // confirm/prompt first (Cab 1–7) consumes the gesture and Chromium blocks .click().
    fileRef.current?.click();
  }

  async function onIrFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (file === undefined) return;

    if (irCabinet !== 8) {
      const ok = await confirm({
        title: `Sobreescribir Cab ${irCabinet}`,
        body: "Puede pisar un IR de fábrica. Cab 8 es el slot de upload seguro.",
        detail: `Archivo: ${file.name}\nROM slot ${irCabinet - 1}. Backup local no garantiza recuperación.`,
        tone: "danger",
        confirmLabel: "Seguir",
      });
      if (!ok) {
        if (fileRef.current) fileRef.current.value = "";
        setStatus("Carga IR cancelada");
        return;
      }
      const ok2 = await confirm({
        title: "Última confirmación",
        body: `Se escribirá flash ROM del Cabinet ${irCabinet}.`,
        tone: "danger",
        requireTyped: `CAB${irCabinet}`,
        confirmLabel: "Escribir IR",
      });
      if (!ok2) {
        if (fileRef.current) fileRef.current.value = "";
        setStatus("Carga IR cancelada — segunda confirmación");
        return;
      }
    }

    const romSlot = irCabinet - 1;
    setActionBusy(true);
    setError(null);
    setStatus(
      `Cargando IR «${file.name}» → Cab ${irCabinet} · dist ${Math.round(irDistance * 100)}% + backup…`,
    );
    midiLog("ir-load-start", {
      file: file.name,
      cabinet: irCabinet,
      romSlot,
      distance: irDistance,
    });
    try {
      await flush();
      await pushCheckpoint("antes de cargar IR");
      const buffer = new Uint8Array(await file.arrayBuffer());
      const result = await window.tonehubDesktop.loadIrFromWav(buffer, irCabinet, {
        confirmFactoryIrOverwrite: irCabinet !== 8,
        distance: irDistance,
      });
      setParams((prev) => ({ ...prev, cabinet: result.cabinet }));
      setNav("editor");
      checkpointArmed.current = true;
      midiLog("ir-load-done", {
        cabinet: result.cabinet,
        slotIndex: result.slotIndex,
        persistVerified: result.persistVerified,
        liveMatch: result.liveMatch,
        distance: irDistance,
      });
      setStatus(
        result.persistVerified
          ? `IR listo · Cab ${result.cabinet} · dist ${Math.round(irDistance * 100)}% · match ${result.liveMatch}`
          : `IR escrito pero verify falló · Cab ${result.cabinet} · match ${result.liveMatch}`,
      );
    } catch (err) {
      midiWarn("ir-load-fail", {
        cabinet: irCabinet,
        error: err instanceof Error ? err.message : String(err),
      });
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setActionBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onUndo() {
    if (busy || undoCount === 0) return;
    setActionBusy(true);
    setError(null);
    try {
      await flush();
      const result = await window.tonehubDesktop.library.undo({
        params: { ...params },
        activeSlot,
        label: "antes de undo",
      });
      setUndoCount(result.undoCount);
      setRedoCount(result.redoCount);
      if (result.snapshot === null) return;
      setParams(result.snapshot.params);
      setActiveSlot(result.snapshot.activeSlot);
      checkpointArmed.current = true;
      setStatus(`Undo · ${result.snapshot.label}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionBusy(false);
    }
  }

  async function onRedo() {
    if (busy || redoCount === 0) return;
    setActionBusy(true);
    setError(null);
    try {
      await flush();
      const result = await window.tonehubDesktop.library.redo({
        params: { ...params },
        activeSlot,
        label: "antes de redo",
      });
      setUndoCount(result.undoCount);
      setRedoCount(result.redoCount);
      if (result.snapshot === null) return;
      setParams(result.snapshot.params);
      setActiveSlot(result.snapshot.activeSlot);
      checkpointArmed.current = true;
      setStatus(`Redo · ${result.snapshot.label}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionBusy(false);
    }
  }

  async function refreshLiveDirty(live: LiveParamsSnapshot, slot: PresetSlotId): Promise<boolean> {
    const bank = await window.tonehubDesktop.getBank();
    const dirty = liveDiffersFromBankSlot(live, bank, slot);
    setLiveDirty(dirty);
    return dirty;
  }

  async function onCompare() {
    if (busy) return;
    setActionBusy(true);
    setError(null);
    try {
      await flush();
      // Single bank read — never parallel MIDI on the same link.
      const bank = await window.tonehubDesktop.getBank();
      const dirty = liveDiffersFromBankSlot(params, bank, activeSlot);
      setLiveDirty(dirty);
      const a = bank.slots[0];
      const b = bank.slots[1];
      const c = bank.slots[2];
      const rows = LIVE_PARAM_NAMES.map((param) => {
        const va = a[param];
        const vb = b[param];
        const vc = c[param];
        return {
          param,
          a: va,
          b: vb,
          c: vc,
          differs: !(va === vb && vb === vc),
        };
      });
      setCompareRows(rows);
      setCompareOpen(true);
      const volume = rows.find((row) => row.param === "volume");
      if (dirty) {
        setStatus(
          `Compare = bank guardado · Live ${activeSlot} tiene cambios sin Guardar`,
        );
      } else if (volume?.differs) {
        setStatus(
          `Volúmenes distintos · A ${volume.a} · B ${volume.b} · C ${volume.c}`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionBusy(false);
    }
  }

  async function onMatchVolumes(source: MatchVolumesSource) {
    if (busy) return;
    const label =
      source === "live"
        ? `volumen live (${params.volume}) en A+B+C`
        : `volumen del slot ${source} en A+B+C`;
    const ok = await confirm({
      title: "Igualar volúmenes A/B/C",
      body: `Se escribe ${label} en el bank del pedal.`,
      tone: "warn",
      confirmLabel: "Igualar",
    });
    if (!ok) return;
    setActionBusy(true);
    setError(null);
    setStatus("Igualando volúmenes A/B/C…");
    try {
      await flush();
      await pushCheckpoint("antes de igualar volúmenes");
      const result = await window.tonehubDesktop.matchVolumes(
        source,
        activeSlot,
        source === "live" ? params.volume : undefined,
      );
      setParams(result.liveParams);
      setActiveSlot(result.activeSlot);
      setBank(result.bank);
      checkpointArmed.current = true;
      const rows = await window.tonehubDesktop.library.compareSlots();
      setCompareRows(rows);
      setStatus(
        result.verified
          ? `Volúmenes igualados a ${result.volume} · A/B/C = ${result.volumes.a}/${result.volumes.b}/${result.volumes.c}`
          : `Volúmenes escritos a ${result.volume} (verify falló)`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setActionBusy(false);
    }
  }

  async function onCopyLiveTo(to: PresetSlotId) {
    if (busy || to === activeSlot) return;
    const fromSlot = activeSlot;
    const dirty = await refreshLiveDirty(params, fromSlot).catch(() => liveDirty);
    const ok = await confirm({
      title: `Live ${fromSlot} → foot ${to}`,
      body: `Escribe el slot ${to} en el bank (sin Guardar) y lo carga a live.`,
      detail:
        `El bank de ${fromSlot} no se actualiza` +
        (dirty ? " — sigues con cambios sin Guardar ahí." : "."),
      tone: "warn",
      confirmLabel: `Copiar → ${to}`,
    });
    if (!ok) return;
    setActionBusy(true);
    setError(null);
    setStatus(`Copiando live → ${to}…`);
    try {
      await flush();
      await pushCheckpoint(`antes de copiar live → ${to}`);
      const result = await window.tonehubDesktop.copySlot("live", to, {
        live: params,
        liveSlot: fromSlot,
      });
      setParams(result.liveParams);
      setActiveSlot(result.activeSlot);
      setBank(result.bank);
      checkpointArmed.current = true;
      setLiveDirty(false);
      if (compareOpen) {
        const rows = await window.tonehubDesktop.library.compareSlots();
        setCompareRows(rows);
      }
      setStatus(
        result.verified
          ? `Live → ${to} (verificado) · bank ${fromSlot} no tocado`
          : `Preset escrito en ${to} (verify falló — revisa el pedal)`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setActionBusy(false);
    }
  }

  async function onCopySlotFrom(from: PresetSlotId, to: PresetSlotId) {
    if (busy || from === to) return;
    await flush();
    const dirty =
      from === activeSlot ? await refreshLiveDirty(params, activeSlot).catch(() => liveDirty) : false;

    let source: "live" | PresetSlotId = from;
    if (dirty) {
      const useLive = await confirm({
        title: `Live ${from} sin Guardar`,
        body: `Compare muestra el bank, no lo que oyes. ¿Copiar el live a ${to}?`,
        detail: `Si quieres el bank viejo de ${from}, guárdalo antes y vuelve a Compare.`,
        tone: "warn",
        confirmLabel: `Copiar live → ${to}`,
      });
      if (!useLive) return;
      source = "live";
    } else {
      const ok = await confirm({
        title: `Bank ${from} → ${to}`,
        body: `Se sobrescribe ${to} y se carga ${to} a live.`,
        tone: "warn",
        confirmLabel: "Copiar",
      });
      if (!ok) return;
    }

    setActionBusy(true);
    setError(null);
    setStatus(`Copiando ${source === "live" ? "live" : from} → ${to}…`);
    try {
      await pushCheckpoint(`antes de copiar ${source === "live" ? "live" : from} → ${to}`);
      const result =
        source === "live"
          ? await window.tonehubDesktop.copySlot("live", to, {
              live: params,
              liveSlot: activeSlot,
            })
          : await window.tonehubDesktop.copySlot(from, to);
      setParams(result.liveParams);
      setActiveSlot(result.activeSlot);
      setBank(result.bank);
      checkpointArmed.current = true;
      setLiveDirty(false);
      const rows = await window.tonehubDesktop.library.compareSlots();
      setCompareRows(rows);
      setStatus(
        result.verified
          ? `${source === "live" ? "Live" : `Bank ${from}`} → ${to} (verificado)`
          : `Slot ${to} escrito (verify falló — revisa el pedal)`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setActionBusy(false);
    }
  }

  async function onApplyLibraryPreset(next: LiveParamsSnapshot, label: string) {
    setActionBusy(true);
    setError(null);
    try {
      await flush();
      await pushCheckpoint(label);
      await window.tonehubDesktop.applyLiveParams(next);
      setParams(next);
      checkpointArmed.current = true;
      setNav("editor");
      setStatus("Tono aplicado a live");
    } finally {
      setActionBusy(false);
    }
  }

  async function resolveSongPreset(song: SongLibraryItem): Promise<LiveParamsSnapshot> {
    const index = await window.tonehubDesktop.library.list();
    const preset = index.presets.find((p) => p.id === song.presetId);
    if (preset === undefined) throw new Error(`Tono de «${song.name}» no encontrado`);
    return preset.params;
  }

  async function onApplySong(song: SongLibraryItem) {
    setActionBusy(true);
    setError(null);
    try {
      await flush();
      await pushCheckpoint(`canción · ${song.name}`);
      const next = await resolveSongPreset(song);
      await window.tonehubDesktop.applyLiveParams(next);
      setParams(next);
      if (song.irId) {
        const cabinet = song.irCabinet ?? irCabinet;
        if (cabinet !== 8) {
          const ok = await confirm({
            title: `IR de la canción → Cab ${cabinet}`,
            body: "Puede pisar factory. Prefiere Cab 8 cuando puedas.",
            tone: "danger",
            confirmLabel: "Seguir",
          });
          if (!ok) {
            setStatus(`Canción «${song.name}» en live (IR omitido)`);
            checkpointArmed.current = true;
            return;
          }
          const ok2 = await confirm({
            title: "Última confirmación",
            body: `¿Escribir IR en Cab ${cabinet}?`,
            tone: "danger",
            requireTyped: `CAB${cabinet}`,
            confirmLabel: "Escribir IR",
          });
          if (!ok2) {
            setStatus(`Canción «${song.name}» en live (IR omitido)`);
            checkpointArmed.current = true;
            return;
          }
        }
        await window.tonehubDesktop.library.loadIrToPedal(song.irId, cabinet, {
          confirmFactoryIrOverwrite: cabinet !== 8,
          distance: song.irDistance ?? irDistance,
        });
        setParams((prev) => ({ ...prev, cabinet }));
      }
      checkpointArmed.current = true;
      setStatus(`Canción «${song.name}» aplicada`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setActionBusy(false);
    }
  }

  async function onAssignSongToSlot(song: SongLibraryItem, slot: PresetSlotId) {
    setActionBusy(true);
    setError(null);
    try {
      await flush();
      await pushCheckpoint(`${song.name} → ${slot}`);
      const next = await resolveSongPreset(song);
      const result = await window.tonehubDesktop.copySlot("live", slot, {
        live: next,
        liveSlot: activeSlot,
      });
      setBank(result.bank);
      setActiveSlot(slot);
      setParams(next);
      checkpointArmed.current = true;
      setStatus(`«${song.name}» → foot ${slot}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setActionBusy(false);
    }
  }

  async function onArmBank(slots: {
    readonly A: SongLibraryItem | null;
    readonly B: SongLibraryItem | null;
    readonly C: SongLibraryItem | null;
  }) {
    setActionBusy(true);
    setError(null);
    try {
      await flush();
      await pushCheckpoint("armar bank desde show");
      for (const slot of ["A", "B", "C"] as const) {
        const song = slots[slot];
        if (song === null) continue;
        const next = await resolveSongPreset(song);
        await window.tonehubDesktop.saveSlot(slot, next);
      }
      const bankSnap = await window.tonehubDesktop.getBank();
      setBank(bankSnap);
      const liveSong = slots[activeSlot] ?? slots.A ?? slots.B ?? slots.C;
      if (liveSong) {
        const next = await resolveSongPreset(liveSong);
        await window.tonehubDesktop.applyLiveParams(next);
        setParams(next);
      }
      checkpointArmed.current = true;
      setStatus("Bank A/B/C armado desde el show");
      setNav("editor");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setActionBusy(false);
    }
  }

  async function refreshShowContext(showId: string | null) {
    if (showId === null) {
      setActiveShow(null);
      return;
    }
    const index = await window.tonehubDesktop.library.list();
    setLibrarySongs(index.songs);
    const show = index.shows.find((s) => s.id === showId) ?? null;
    setActiveShow(show);
  }

  const toolbarStatus =
    error ??
    (loadingSlot ? `Cargando slot ${loadingSlot}…` : null) ??
    status;

  const showChip =
    activeShow === null
      ? null
      : `Show · ${activeShow.name} · ${Math.min(activeSongIndex + 1, Math.max(activeShow.songIds.length, 1))}/${activeShow.songIds.length || 0}`;

  return (
    <div className={`studio${nav === "stage" ? " studio--stage" : ""}`}>
      <StudioSidebar
        deviceName={connection.deviceName}
        activeSlot={activeSlot}
        nav={nav}
        busy={busy}
        onNav={setNav}
        onSelectSlot={(slot) => void onSelectSlot(slot)}
        onDisconnect={onDisconnect}
      />

      <div className="studio__workspace">
        {nav !== "stage" ? (
          <StudioToolbar
            busy={busy}
            canUndo={undoCount > 0}
            canRedo={redoCount > 0}
            activeSlot={activeSlot}
            status={toolbarStatus}
            activeShowLabel={showChip}
            onUndo={() => void onUndo()}
            onRedo={() => void onRedo()}
            onSave={() => void onSave()}
            onCompare={() => void onCompare()}
            onCopyTo={(to) => void onCopyLiveTo(to)}
            onOpenShow={() => setNav("library")}
          />
        ) : null}

        <div className="studio__canvas">
          <main
            className={
              nav === "tuner" || nav === "library" || nav === "stage" || nav === "device"
                ? "studio__main studio__main--wide"
                : "studio__main studio__main--pedal"
            }
          >
            {nav === "tuner" ? (
              <TunerPanel active={nav === "tuner"} />
            ) : nav === "library" ? (
              <LibraryWorkspace
                busy={busy}
                liveParams={params}
                irCabinet={irCabinet}
                irDistance={irDistance}
                activeShowId={activeShow?.id ?? null}
                activeSongIndex={activeSongIndex}
                onIrDistanceChange={onIrDistanceChange}
                onStatus={setStatus}
                onError={setError}
                onBusy={setActionBusy}
                onApplyPreset={onApplyLibraryPreset}
                onApplySong={onApplySong}
                onArmBank={onArmBank}
                onAssignSongToSlot={onAssignSongToSlot}
                onActiveShowChange={(showId, songIndex = 0) => {
                  setActiveSongIndex(songIndex);
                  void refreshShowContext(showId);
                }}
                onEnterStage={(showId) => {
                  void (async () => {
                    await refreshShowContext(showId);
                    setActiveSongIndex(0);
                    setNav("stage");
                  })();
                }}
                onCabinetApplied={(cabinet) => {
                  setParams((prev) => ({ ...prev, cabinet }));
                }}
              />
            ) : nav === "device" ? (
              <DeviceWorkspace
                busy={busy}
                irCabinet={irCabinet}
                irDistance={irDistance}
                onIrCabinetChange={setIrCabinet}
                onIrDistanceChange={onIrDistanceChange}
                onLoadIr={onLoadIrClick}
                onExportBank={() => void onExportBank()}
                onImportBank={() => void onImportBank()}
                onCompare={() => void onCompare()}
              />
            ) : nav === "stage" && activeShow ? (
              <StageMode
                show={activeShow}
                songs={librarySongs}
                songIndex={activeSongIndex}
                busy={busy}
                onSongIndexChange={setActiveSongIndex}
                onApplySong={onApplySong}
                onAssignSongToSlot={onAssignSongToSlot}
                onExit={() => setNav("library")}
              />
            ) : (
              <CubeBabyPedal
                params={params}
                activeSlot={activeSlot}
                busy={busy}
                onParamChange={onParamChange}
                onSelectSlot={(slot) => void onSelectSlot(slot)}
              />
            )}
          </main>
        </div>
      </div>

      <ComparePanel
        open={compareOpen}
        rows={compareRows}
        busy={busy}
        liveParams={params}
        liveDirty={liveDirty}
        activeSlot={activeSlot}
        onClose={() => setCompareOpen(false)}
        onMatchVolumes={(source) => void onMatchVolumes(source)}
        onCopySlot={(from, to) => void onCopySlotFrom(from, to)}
      />
      <input
        ref={fileRef}
        type="file"
        accept=".wav,audio/wav"
        hidden
        onChange={(event) => void onIrFile(event.target.files)}
      />
      {confirmDialog}
    </div>
  );
}
