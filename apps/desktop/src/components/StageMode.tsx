import { useEffect } from "react";
import type { PresetSlotId } from "@tonehub/cube-baby-protocol";
import type { ShowLibraryItem, SongLibraryItem } from "../../electron/library/types";
import { useI18n } from "../i18n";
import "./stage-mode.css";

type StageModeProps = {
  readonly show: ShowLibraryItem;
  readonly songs: readonly SongLibraryItem[];
  readonly songIndex: number;
  readonly busy: boolean;
  readonly onSongIndexChange: (index: number) => void;
  readonly onApplySong: (song: SongLibraryItem) => Promise<void>;
  readonly onAssignSongToSlot: (song: SongLibraryItem, slot: PresetSlotId) => Promise<void>;
  readonly onExit: () => void;
};

export function StageMode({
  show,
  songs,
  songIndex,
  busy,
  onSongIndexChange,
  onApplySong,
  onAssignSongToSlot,
  onExit,
}: StageModeProps) {
  const { t } = useI18n();
  const ordered = show.songIds
    .map((id) => songs.find((s) => s.id === id))
    .filter((s): s is SongLibraryItem => s !== undefined);
  const current = ordered[songIndex] ?? ordered[0] ?? null;
  const next = ordered[songIndex + 1] ?? null;
  const prev = ordered[songIndex - 1] ?? null;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (busy) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onExit();
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        if (songIndex < ordered.length - 1) onSongIndexChange(songIndex + 1);
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        if (songIndex > 0) onSongIndexChange(songIndex - 1);
        return;
      }
      if (event.key === "Enter" && current) {
        event.preventDefault();
        void onApplySong(current);
        return;
      }
      const slot = event.key.toUpperCase();
      if ((slot === "A" || slot === "B" || slot === "C") && current) {
        event.preventDefault();
        void onAssignSongToSlot(current, slot);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    busy,
    current,
    onApplySong,
    onAssignSongToSlot,
    onExit,
    onSongIndexChange,
    ordered.length,
    songIndex,
  ]);

  return (
    <div className="stage" role="application" aria-label={t("stage.title", { name: show.name })}>
      <header className="stage__bar">
        <p className="stage__show">{show.name}</p>
        <p className="stage__count" aria-live="polite">
          {ordered.length === 0
            ? t("stage.noTracks")
            : `${Math.min(songIndex + 1, ordered.length)} / ${ordered.length}`}
        </p>
        <button type="button" className="stage__exit" onClick={onExit} disabled={busy}>
          {t("stage.exit")}
        </button>
      </header>

      <div className="stage__center">
        {current === null ? (
          <p className="stage__empty">{t("stage.empty")}</p>
        ) : (
          <>
            <p className="stage__now-label">{t("stage.now")}</p>
            <h1 className="stage__now">{current.name}</h1>
            {current.bpm !== undefined ? (
              <p className="stage__next">
                {current.bpm} BPM
                {current.delayNote ? ` · ${current.delayNote}` : ""}
                {current.key ? ` · ${current.key}` : ""}
              </p>
            ) : null}
            {next ? (
              <p className="stage__next">
                {t("stage.next")} <span>{next.name}</span>
              </p>
            ) : (
              <p className="stage__next">{t("stage.end")}</p>
            )}
          </>
        )}
      </div>

      <div className="stage__controls">
        <button
          type="button"
          className="stage__btn"
          disabled={busy || !prev}
          onClick={() => onSongIndexChange(Math.max(0, songIndex - 1))}
        >
          {t("stage.prev")}
        </button>
        <button
          type="button"
          className="stage__btn stage__btn--primary"
          disabled={busy || !current}
          onClick={() => current && void onApplySong(current)}
        >
          {t("stage.applyLive")}
        </button>
        <button
          type="button"
          className="stage__btn"
          disabled={busy || !current}
          onClick={() => current && void onAssignSongToSlot(current, "A")}
          aria-label={t("stage.assignFoot", { slot: "A" })}
        >
          → A
        </button>
        <button
          type="button"
          className="stage__btn"
          disabled={busy || !current}
          onClick={() => current && void onAssignSongToSlot(current, "B")}
          aria-label={t("stage.assignFoot", { slot: "B" })}
        >
          → B
        </button>
        <button
          type="button"
          className="stage__btn"
          disabled={busy || !current}
          onClick={() => current && void onAssignSongToSlot(current, "C")}
          aria-label={t("stage.assignFoot", { slot: "C" })}
        >
          → C
        </button>
        <button
          type="button"
          className="stage__btn"
          disabled={busy || !next}
          onClick={() => onSongIndexChange(Math.min(ordered.length - 1, songIndex + 1))}
        >
          {t("stage.nextBtn")}
        </button>
      </div>

      <p className="stage__hints">{t("stage.keys")}</p>
    </div>
  );
}
