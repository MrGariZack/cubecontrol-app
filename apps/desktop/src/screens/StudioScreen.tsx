import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveParamName, PresetSlotId } from "@tonehub/cube-baby-protocol";
import { ComparePanel } from "../components/ComparePanel";
import { CubeBabyPedal } from "../components/cube-baby/CubeBabyPedal";
import { DevicePanel } from "../components/DevicePanel";
import { LibraryDrawer } from "../components/LibraryDrawer";
import { StudioSidebar, type StudioNavId } from "../components/StudioSidebar";
import { StudioToolbar } from "../components/StudioToolbar";
import { TunerPanel } from "../components/TunerPanel";
import { useDebouncedLiveWrite } from "../hooks/useDebouncedLiveWrite";
import type { DesktopConnectionInfo, LiveParamsSnapshot } from "../types/device";
import type { MatchVolumesSource } from "../../electron/deviceBridge";
import type { SlotDiffRow } from "../../electron/library/types";

type StudioScreenProps = {
  readonly connection: DesktopConnectionInfo;
  readonly onDisconnect: () => void;
};

export function StudioScreen({ connection, onDisconnect }: StudioScreenProps) {
  const [activeSlot, setActiveSlot] = useState<PresetSlotId>(connection.activeSlot);
  const [params, setParams] = useState<LiveParamsSnapshot>(connection.liveParams);
  const [irCabinet, setIrCabinet] = useState(8);
  const [nav, setNav] = useState<StudioNavId>("editor");
  const [slotBusy, setSlotBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [loadingSlot, setLoadingSlot] = useState<PresetSlotId | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareRows, setCompareRows] = useState<SlotDiffRow[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const paramsRef = useRef(params);
  const slotRef = useRef(activeSlot);
  const checkpointArmed = useRef(true);
  const { scheduleWrite, flush } = useDebouncedLiveWrite();

  paramsRef.current = params;
  slotRef.current = activeSlot;
  const busy = slotBusy || actionBusy;

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
      if (checkpointArmed.current) {
        checkpointArmed.current = false;
        void pushCheckpoint(`live:${param}`);
      }
      setParams((prev) => ({ ...prev, [param]: value }));
      scheduleWrite(param, value);
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
    if (busy || slot === activeSlot) return;
    setSlotBusy(true);
    setLoadingSlot(slot);
    setError(null);
    try {
      await flush();
      await pushCheckpoint(`antes de slot ${slot}`);
      const live = await window.tonehubDesktop.applySlotToLive(slot);
      setParams(live);
      setActiveSlot(slot);
      checkpointArmed.current = true;
      setStatus(`Slot ${slot} en live`);
      setNav("editor");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSlotBusy(false);
      setLoadingSlot(null);
    }
  }

  async function onSave() {
    if (busy) return;
    const ok = window.confirm(
      `¿Guardar el tono live actual en el slot ${activeSlot} del pedal?\nEsto reescribe ese preset en el bank.`,
    );
    if (!ok) return;
    setActionBusy(true);
    setError(null);
    setStatus(`Guardando slot ${activeSlot}…`);
    try {
      await flush();
      const result = await window.tonehubDesktop.saveSlot(activeSlot, params);
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
    const ok = window.confirm(
      `¿Restaurar un archivo bank al pedal?\nSe sobrescriben los slots A+B+C y se carga el slot ${activeSlot} a live.`,
    );
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

  function onLoadIrClick() {
    if (busy) return;
    if (irCabinet < 1 || irCabinet > 8) {
      setError("Elige Cabinet IR 1..8");
      return;
    }
    if (irCabinet !== 8) {
      const ok = window.confirm(
        `¿Sobreescribir el IR en Cabinet ${irCabinet}?\n` +
          `CubeControl guarda un backup ROM antes de escribir.\n` +
          `(ROM slot ${irCabinet - 1}). Cabinet 8 es el slot de upload habitual.`,
      );
      if (!ok) return;
    }
    fileRef.current?.click();
  }

  async function onIrFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (file === undefined) return;
    const romSlot = irCabinet - 1;
    setActionBusy(true);
    setError(null);
    setStatus(`Cargando IR «${file.name}» → Cabinet ${irCabinet} (ROM ${romSlot}) + backup…`);
    try {
      await flush();
      await pushCheckpoint("antes de cargar IR");
      const buffer = new Uint8Array(await file.arrayBuffer());
      const result = await window.tonehubDesktop.loadIrFromWav(buffer, irCabinet);
      setParams((prev) => ({ ...prev, cabinet: result.cabinet }));
      setNav("editor");
      checkpointArmed.current = true;
      setStatus(
        result.persistVerified
          ? `IR listo · Cab ${result.cabinet} · ROM ${result.slotIndex} · backup local · match ${result.liveMatch}`
          : `IR escrito pero verify falló · Cab ${result.cabinet} · match ${result.liveMatch}`,
      );
    } catch (err) {
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

  async function onCompare() {
    if (busy) return;
    setActionBusy(true);
    setError(null);
    try {
      await flush();
      const rows = await window.tonehubDesktop.library.compareSlots();
      setCompareRows(rows);
      setCompareOpen(true);
      const volume = rows.find((row) => row.param === "volume");
      if (volume?.differs) {
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
    const ok = window.confirm(
      `¿Igualar el volumen de los tres slots?\nSe escribe ${label} en el bank del pedal.`,
    );
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
      setStatus("Preset aplicado a live");
    } finally {
      setActionBusy(false);
    }
  }

  const toolbarStatus =
    error ??
    (loadingSlot ? `Cargando slot ${loadingSlot}…` : null) ??
    status;

  return (
    <div className="studio">
      <StudioSidebar
        deviceName={connection.deviceName}
        activeSlot={activeSlot}
        nav={nav}
        busy={busy}
        onNav={setNav}
        onSelectSlot={(slot) => void onSelectSlot(slot)}
        onDisconnect={onDisconnect}
      >
        {nav === "library" ? (
          <LibraryDrawer
            open
            variant="rail"
            busy={busy}
            irCabinet={irCabinet}
            liveParams={params}
            onStatus={setStatus}
            onError={setError}
            onApplyPreset={onApplyLibraryPreset}
            onCabinetApplied={(cabinet) => {
              setParams((prev) => ({ ...prev, cabinet }));
              setNav("editor");
            }}
            onBusy={setActionBusy}
          />
        ) : null}
        {nav === "device" ? (
          <DevicePanel
            busy={busy}
            irCabinet={irCabinet}
            onIrCabinetChange={setIrCabinet}
            onLoadIr={onLoadIrClick}
            onExportBank={() => void onExportBank()}
            onImportBank={() => void onImportBank()}
            onCompare={() => void onCompare()}
          />
        ) : null}
      </StudioSidebar>

      <div className="studio__workspace">
        <StudioToolbar
          busy={busy}
          canUndo={undoCount > 0}
          canRedo={redoCount > 0}
          activeSlot={activeSlot}
          status={toolbarStatus}
          onUndo={() => void onUndo()}
          onRedo={() => void onRedo()}
          onSave={() => void onSave()}
          onCompare={() => void onCompare()}
        />

        <div className="studio__canvas">
          <main
            className={
              nav === "tuner" ? "studio__main studio__main--tuner" : "studio__main studio__main--pedal"
            }
          >
            {nav === "tuner" ? (
              <TunerPanel active={nav === "tuner"} />
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
        liveVolume={params.volume}
        activeSlot={activeSlot}
        onClose={() => setCompareOpen(false)}
        onMatchVolumes={(source) => void onMatchVolumes(source)}
      />
      <input
        ref={fileRef}
        type="file"
        accept=".wav,audio/wav"
        hidden
        onChange={(event) => void onIrFile(event.target.files)}
      />
    </div>
  );
}
