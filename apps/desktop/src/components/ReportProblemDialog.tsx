import { useId, useState } from "react";
import { getUiMidiLogSnapshot } from "../debug/midiLog";
import { useI18n } from "../i18n";
import { SAFETY_ACCEPTANCE_VERSION, readSafetyAcceptance } from "../safety/disclaimer";
import "./report-problem.css";

const ISSUES_NEW =
  "https://github.com/MrGariZack/cubecontrol-app/issues/new?template=bug_report.md";

type ReportProblemDialogProps = {
  readonly onClose: () => void;
};

function entriesToJsonl(): string {
  const entries = getUiMidiLogSnapshot();
  return entries.map((e) => JSON.stringify(e)).join("\n") + (entries.length ? "\n" : "");
}

export function ReportProblemDialog({ onClose }: ReportProblemDialogProps) {
  const { t, locale } = useI18n();
  const titleId = useId();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastZip, setLastZip] = useState<string | null>(null);

  async function buildMetaExtra(): Promise<Record<string, unknown>> {
    let ports: unknown = [];
    try {
      ports = await window.tonehubDesktop.listPorts();
    } catch {
      ports = [{ error: "listPorts failed" }];
    }
    const safety = readSafetyAcceptance();
    return {
      safetyAcceptanceVersion: SAFETY_ACCEPTANCE_VERSION,
      safetyAcceptedAt: safety?.acceptedAt ?? null,
      midiLogUiCount: getUiMidiLogSnapshot().length,
      ports,
    };
  }

  async function onExportZip() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const result = await window.tonehubDesktop.diagnostics.exportBundle({
        notes,
        locale,
        uiMidiLogJsonl: entriesToJsonl(),
        metaExtra: await buildMetaExtra(),
      });
      if (result === null) {
        setStatus(t("report.cancelled"));
        return;
      }
      setLastZip(result.path);
      setStatus(t("report.exported", { path: result.path }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onCopySummary() {
    setBusy(true);
    setError(null);
    try {
      const meta = await buildMetaExtra();
      const text = [
        "CubeControl bug report",
        `Locale: ${locale}`,
        `Notes: ${notes.trim() || "(none)"}`,
        `UI MIDI log lines: ${getUiMidiLogSnapshot().length}`,
        `Safety: ${String(meta.safetyAcceptedAt ?? "not accepted")}`,
        "",
        "Please attach the diagnostics ZIP from Report a problem.",
        ISSUES_NEW,
      ].join("\n");
      await navigator.clipboard.writeText(text);
      setStatus(t("report.copied"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onOpenGithub() {
    setBusy(true);
    setError(null);
    try {
      await window.tonehubDesktop.diagnostics.openExternal(ISSUES_NEW);
      setStatus(t("report.githubOpened"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onReveal() {
    if (lastZip === null) return;
    await window.tonehubDesktop.diagnostics.revealInFolder(lastZip);
  }

  return (
    <div className="report-problem" role="presentation" onMouseDown={onClose}>
      <div
        className="report-problem__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="report-problem__eyebrow">{t("report.eyebrow")}</p>
        <h2 id={titleId} className="report-problem__title">
          {t("report.title")}
        </h2>
        <p className="report-problem__lead">{t("report.lead")}</p>

        <label className="report-problem__field">
          <span>{t("report.notesLabel")}</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={5}
            placeholder={t("report.notesPh")}
            disabled={busy}
          />
        </label>

        <ol className="report-problem__steps">
          <li>{t("report.step1")}</li>
          <li>{t("report.step2")}</li>
          <li>{t("report.step3")}</li>
        </ol>

        <div className="report-problem__actions">
          <button
            type="button"
            className="report-problem__btn report-problem__btn--primary"
            disabled={busy}
            onClick={() => void onExportZip()}
          >
            {t("report.exportZip")}
          </button>
          <button
            type="button"
            className="report-problem__btn"
            disabled={busy || lastZip === null}
            onClick={() => void onReveal()}
          >
            {t("report.reveal")}
          </button>
          <button
            type="button"
            className="report-problem__btn"
            disabled={busy}
            onClick={() => void onCopySummary()}
          >
            {t("report.copy")}
          </button>
          <button
            type="button"
            className="report-problem__btn"
            disabled={busy}
            onClick={() => void onOpenGithub()}
          >
            {t("report.github")}
          </button>
          <button type="button" className="report-problem__btn" disabled={busy} onClick={onClose}>
            {t("common.close")}
          </button>
        </div>

        {status ? <p className="report-problem__status">{status}</p> : null}
        {error ? <p className="report-problem__error">{error}</p> : null}
        <p className="report-problem__privacy">{t("report.privacy")}</p>
      </div>
    </div>
  );
}
