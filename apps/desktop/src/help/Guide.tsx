import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "../i18n";
import { GUIDE, type GuideChapter, type GuideStep } from "./catalog";
import "./guide.css";

type GuideRequest = { readonly step: GuideStep; readonly sequence: number; readonly focus: boolean };
type GuideValue = {
  readonly showHelp: () => void;
  readonly request: GuideRequest | null;
};
const Context = createContext<GuideValue | null>(null);
const PROGRESS_KEY = "cubecontrol.guide.v1";
const ALL_STEPS = GUIDE.flatMap((chapter) => chapter.steps);

function loadVisited(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function positionSpotlight(spotlight: HTMLDivElement, target: HTMLElement, bounds: DOMRect) {
  const gap = 7;
  let left = Math.max(0, bounds.left - gap);
  let top = Math.max(0, bounds.top - gap);
  let right = Math.min(window.innerWidth, bounds.right + gap);
  let bottom = Math.min(window.innerHeight, bounds.bottom + gap);

  // Keep the cutout inside the scroll areas that clip the highlighted control.
  for (let parent = target.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(parent);
    if (overflowX === "visible" && overflowY === "visible") continue;
    const frame = parent.getBoundingClientRect();
    const x = frame.left + parent.clientLeft;
    const y = frame.top + parent.clientTop;
    if (overflowX !== "visible") {
      left = Math.max(left, x);
      right = Math.min(right, x + parent.clientWidth);
    }
    if (overflowY !== "visible") {
      top = Math.max(top, y);
      bottom = Math.min(bottom, y + parent.clientHeight);
    }
  }

  const visible = right > left && bottom > top && bounds.right > left && bounds.bottom > top && bounds.left < right && bounds.top < bottom;
  if (spotlight.hidden === visible) spotlight.hidden = !visible;
  if (!visible) return;
  spotlight.style.transform = `translate(${left}px, ${top}px)`;
  spotlight.style.width = `${right - left}px`;
  spotlight.style.height = `${bottom - top}px`;
}

export function useGuide() {
  const value = useContext(Context);
  if (!value) throw new Error("GuideProvider is missing");
  return value;
}

export function HelpButton({ className = "guide-launch" }: { readonly className?: string }) {
  const { showHelp } = useGuide();
  const { t } = useI18n();
  return <button type="button" className={className} data-guide="help" onClick={showHelp}>{t("guide.help")}</button>;
}

export function GuideProvider({ children }: { readonly children: ReactNode }) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<GuideRequest | null>(null);
  const [fullTour, setFullTour] = useState(false);
  const [query, setQuery] = useState("");
  const [visited, setVisited] = useState(loadVisited);
  const [located, setLocated] = useState(false);
  const [side, setSide] = useState<"left" | "right">("right");
  const panel = useRef<HTMLElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const sequence = useRef(0);
  const step = request?.step;
  const chapter = step && GUIDE.find((group) => group.steps.some((entry) => entry.id === step.id));
  const tour = fullTour ? ALL_STEPS : chapter?.steps ?? [];
  const stepIndex = tour.findIndex((entry) => entry.id === step?.id);

  const showHelp = useCallback(() => {
    if (!panel.current) restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
    setRequest(null);
    setFullTour(false);
    setQuery("");
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setRequest(null);
    if (restoreFocus.current?.isConnected && restoreFocus.current.getClientRects().length > 0) {
      restoreFocus.current.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "F1") {
        event.preventDefault();
        showHelp();
      } else if (event.key === "Escape" && open && panel.current?.contains(document.activeElement)) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close, open, showHelp]);

  useEffect(() => {
    if (open && !step) panel.current?.querySelector("input")?.focus({ preventScroll: true });
  }, [open, step]);

  useEffect(() => {
    if (!request) return;
    const spotlight = spotlightRef.current;
    let target: HTMLElement | undefined;
    let frame = 0;
    let scrolled = false;
    setLocated(false);
    const selector = `[data-guide~="${request.step.id}"]`;
    const focusTarget = request.focus;
    function locate() {
      const next = [...document.querySelectorAll<HTMLElement>(selector)].find((element) =>
        !panel.current?.contains(element) &&
        element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== "hidden",
      );
      if (next !== target) {
        if (target) resizeObserver.unobserve(target);
        target?.removeAttribute("data-guide-highlight");
        target = next;
        target?.setAttribute("data-guide-highlight", "");
        if (target) resizeObserver.observe(target);
        setLocated(Boolean(target));
      }
      if (target) {
        if (!scrolled) {
          target.scrollIntoView({ block: "nearest", inline: "nearest" });
          if (focusTarget) {
            const controls = "button:enabled, input:enabled, select:enabled, a[href], [role='slider'][tabindex='0']";
            const control = target.matches(controls) ? target : target.querySelector<HTMLElement>(controls);
            control?.focus({ preventScroll: true });
          }
          scrolled = true;
        }
        const bounds = target.getBoundingClientRect();
        setSide(bounds.left + bounds.width / 2 > window.innerWidth * 0.57 ? "left" : "right");
        if (spotlight) positionSpotlight(spotlight, target, bounds);
      } else if (spotlight && !spotlight.hidden) {
        spotlight.hidden = true;
      }
    }
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(locate);
    };
    const resizeObserver = new ResizeObserver(schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    schedule();
    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      cancelAnimationFrame(frame);
      target?.removeAttribute("data-guide-highlight");
      if (spotlight) spotlight.hidden = true;
    };
  }, [request]);

  function select(entry: GuideStep, focus = false) {
    setRequest({ step: entry, sequence: ++sequence.current, focus });
    if (!visited.includes(entry.id)) {
      const next = [...visited, entry.id];
      setVisited(next);
      try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)); } catch { /* current session still works */ }
    }
  }

  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  const results = GUIDE.map((group) => {
    const steps = group.steps.filter((entry) =>
      terms.every((term) => normalize([group.title[locale], entry.title[locale], entry.body[locale]].join(" ")).includes(term)),
    );
    return { group, steps };
  }).filter(({ steps }) => steps.length > 0);

  function start(group?: GuideChapter) {
    const entries = group?.steps ?? ALL_STEPS;
    const entry = entries.find((item) => !visited.includes(item.id)) ?? entries[0];
    if (entry) {
      setFullTour(group === undefined);
      select(entry);
      panel.current?.focus({ preventScroll: true });
    }
  }

  return (
    <Context.Provider value={{ showHelp, request }}>
      {children}
      {open && step ? <div ref={spotlightRef} className="guide-spotlight" aria-hidden="true" hidden /> : null}
      {open ? (
        <aside
          ref={panel}
          className="guide-panel"
          data-side={side}
          data-mode={step ? "step" : "catalog"}
          aria-label={t("guide.title")}
          tabIndex={-1}
        >
          <header className="guide-panel__header">
            <h2>{t("guide.title")}</h2>
            <button type="button" className="guide-panel__quiet" onClick={close}>{t("guide.close")}</button>
          </header>
          {step && chapter ? (
            <>
              <div className="guide-panel__lesson" aria-live="polite">
                <p className="guide-panel__progress">
                  {chapter.title[locale]} · {t("guide.progress", { current: stepIndex + 1, total: tour.length })}
                </p>
                <h3>{step.title[locale]}</h3>
                <p>{step.body[locale]}</p>
                <p className="guide-panel__location">{t(located ? "guide.located" : "guide.unavailable")}</p>
              </div>
              <div className="guide-panel__actions">
                <button type="button" className="guide-panel__quiet" onClick={() => setRequest(null)}>{t("guide.index")}</button>
                <div className="guide-panel__paging">
                  <button type="button" disabled={stepIndex <= 0} onClick={() => {
                    const previous = tour[stepIndex - 1];
                    if (previous) select(previous);
                  }}>{t("guide.previous")}</button>
                  <button type="button" className="guide-panel__primary" onClick={() => {
                    const next = tour[stepIndex + 1];
                    if (next) select(next);
                    else setRequest(null);
                  }}>{t(stepIndex === tour.length - 1 ? "guide.done" : "guide.next")}</button>
                </div>
              </div>
              {located ? <button type="button" className="guide-panel__quiet guide-panel__reveal" onClick={() => select(step, true)}>{t("guide.reveal")}</button> : null}
            </>
          ) : (
            <>
              <p className="guide-panel__intro">{t("guide.intro")}</p>
              <button type="button" className="guide-panel__primary" onClick={() => start()}>{t("guide.fullTour")}</button>
              <label className="guide-panel__search">
                <span>{t("guide.search")}</span>
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("guide.searchHint")} />
              </label>
              <div className="guide-panel__chapters">
                {results.map(({ group, steps }) => (
                  <details key={group.id} open={terms.length > 0 ? true : undefined}>
                    <summary>
                      <span>{group.title[locale]}</span>
                      <span className="guide-panel__count">
                        {group.steps.filter((entry) => visited.includes(entry.id)).length}/{group.steps.length}
                      </span>
                    </summary>
                    <ul>
                      {steps.map((entry) => (
                        <li key={entry.id}>
                          <button type="button" className="guide-panel__topic" onClick={() => {
                            setFullTour(false);
                            select(entry);
                            panel.current?.focus({ preventScroll: true });
                          }}>{entry.title[locale]}</button>
                        </li>
                      ))}
                    </ul>
                    {terms.length === 0 ? <button type="button" className="guide-panel__quiet guide-panel__start" onClick={() => start(group)}>{t("guide.start")}</button> : null}
                  </details>
                ))}
                {results.length === 0 ? <p>{t("guide.noResults")}</p> : null}
              </div>
            </>
          )}
        </aside>
      ) : null}
    </Context.Provider>
  );
}
