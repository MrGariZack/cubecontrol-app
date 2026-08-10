import { useEffect, useMemo, useState } from "react";
import {
  GUITAR_STRINGS,
  nearestGuitarString,
  octaveLanes,
  type DetectedNote,
} from "../tuner/pitchMath";
import { usePitchTuner, type TunerRange } from "../tuner/usePitchTuner";
import "./tuner-panel.css";

export type TunerMode = "chromatic" | "guitar" | "octave";

type TunerPanelProps = {
  readonly active: boolean;
};

function centsToNeedle(cents: number): number {
  return Math.max(-50, Math.min(50, cents));
}

function inTune(cents: number, window = 5): boolean {
  return Math.abs(cents) <= window;
}

export function TunerPanel({ active }: TunerPanelProps) {
  const [mode, setMode] = useState<TunerMode>("chromatic");
  const [a4, setA4] = useState(440);
  const [range, setRange] = useState<TunerRange>("guitar");
  const [lockedRootMidi, setLockedRootMidi] = useState<number | null>(null);
  const [autoLock, setAutoLock] = useState(true);

  const tuner = usePitchTuner({ active, a4, range });
  const note = tuner.reading?.note ?? null;

  useEffect(() => {
    if (!autoLock || mode !== "octave" || note === null) return;
    if (Math.abs(note.cents) > 6) return;
    if (lockedRootMidi !== null) {
      // Keep lock unless note name changes by more than a semitone class for a while — stay sticky.
      return;
    }
    setLockedRootMidi(note.midi);
  }, [autoLock, lockedRootMidi, mode, note]);

  const guitar = useMemo(() => {
    if (note === null) return null;
    const string = nearestGuitarString(note.midi);
    const cents = (note.midi + note.cents / 100 - string.midi) * 100;
    return { string, cents };
  }, [note]);

  const lanes = useMemo(() => {
    if (note === null || lockedRootMidi === null) return null;
    return octaveLanes(note.frequency, lockedRootMidi, a4, 8);
  }, [a4, lockedRootMidi, note]);

  const activeLane = lanes?.find((lane) => Math.abs(lane.cents) <= 50) ?? null;

  return (
    <section className="tuner" aria-label="Tuner CubeControl">
      <header className="tuner__head">
        <div>
          <h2 className="tuner__title">Tuner</h2>
          <p className="tuner__sub">McLeod · audio interface / mic · octavas estables</p>
        </div>
        <div className="tuner__modes" role="tablist" aria-label="Modo tuner">
          {(
            [
              ["chromatic", "Cromático"],
              ["guitar", "Guitarra"],
              ["octave", "Octavar"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              className={mode === id ? "tuner__mode is-active" : "tuner__mode"}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="tuner__controls">
        <label className="tuner__field">
          <span>Entrada</span>
          <select
            value={deviceIdOrEmpty(tuner.deviceId)}
            onChange={(event) => tuner.setDeviceId(event.target.value)}
          >
            {tuner.devices.length === 0 ? <option value="">Micrófono por defecto</option> : null}
            {tuner.devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Input ${device.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
        </label>

        <label className="tuner__field">
          <span>Rango</span>
          <select value={range} onChange={(event) => setRange(event.target.value as TunerRange)}>
            <option value="guitar">Guitarra</option>
            <option value="bass">Bajo / octava grave</option>
            <option value="wide">Amplio (octavar)</option>
          </select>
        </label>

        <label className="tuner__field">
          <span>A4</span>
          <input
            type="number"
            min={415}
            max={466}
            step={1}
            value={a4}
            onChange={(event) => setA4(Number(event.target.value) || 440)}
          />
        </label>

        <button
          type="button"
          className={tuner.listening ? "tuner__listen is-on" : "tuner__listen"}
          onClick={() => {
            if (tuner.listening) tuner.stop();
            else void tuner.start();
          }}
        >
          {tuner.listening ? "Escuchando" : "Iniciar mic"}
        </button>
      </div>

      {tuner.error ? <p className="tuner__error">{tuner.error}</p> : null}

      <div className="tuner__stage">
        <Needle cents={note?.cents ?? 0} live={note !== null} />

        <div className="tuner__note-block">
          {note ? (
            <>
              <div className="tuner__note-row">
                <span className="tuner__note">{note.name}</span>
                <span className="tuner__octave">{note.octave}</span>
              </div>
              <p className="tuner__hz">
                {note.frequency.toFixed(2)} Hz · target {note.targetHz.toFixed(2)} Hz
              </p>
              <p className={`tuner__cents${inTune(note.cents) ? " is-ok" : ""}`}>
                {note.cents >= 0 ? "+" : ""}
                {note.cents.toFixed(1)} cents
                {inTune(note.cents) ? " · afinado" : note.cents > 0 ? " · agudo" : " · grave"}
              </p>
              <ClarityBar clarity={tuner.reading?.clarity ?? 0} />
            </>
          ) : (
            <p className="tuner__waiting">
              {tuner.listening ? "Toca una nota limpia…" : "Activa el mic para afinar"}
            </p>
          )}
        </div>
      </div>

      {mode === "guitar" ? <GuitarStrip note={note} guitar={guitar} /> : null}

      {mode === "octave" ? (
        <div className="tuner__octave-panel">
          <div className="tuner__octave-tools">
            <label className="tuner__check">
              <input
                type="checkbox"
                checked={autoLock}
                onChange={(event) => setAutoLock(event.target.checked)}
              />
              Auto-lock raíz
            </label>
            <button
              type="button"
              className="tuner__ghost"
              disabled={note === null}
              onClick={() => {
                if (note) setLockedRootMidi(note.midi);
              }}
            >
              Lock nota actual
            </button>
            <button
              type="button"
              className="tuner__ghost"
              disabled={lockedRootMidi === null}
              onClick={() => setLockedRootMidi(null)}
            >
              Clear lock
            </button>
            {lockedRootMidi !== null ? (
              <span className="tuner__lock">
                Root MIDI {lockedRootMidi} · {noteNameFromMidi(lockedRootMidi)}
              </span>
            ) : (
              <span className="tuner__lock">Sin raíz — toca y bloquea</span>
            )}
          </div>

          <div className="tuner__lanes">
            {([-1, 0, 1] as const).map((offset) => {
              const lane = lanes?.find((item) => item.offset === offset);
              const hot = activeLane?.offset === offset;
              return (
                <div
                  key={offset}
                  className={`tuner__lane${hot ? " is-hot" : ""}${lane?.inTune ? " is-ok" : ""}`}
                >
                  <span className="tuner__lane-label">{lane?.label ?? labelFor(offset)}</span>
                  <span className="tuner__lane-note">
                    {lane ? noteNameFromMidi(lane.midi) : "—"}
                  </span>
                  <div className="tuner__lane-meter">
                    <div
                      className="tuner__lane-fill"
                      style={{
                        transform: `translateX(${centsToNeedle(lane?.cents ?? 0)}%)`,
                      }}
                    />
                  </div>
                  <span className="tuner__lane-cents">
                    {lane ? `${lane.cents >= 0 ? "+" : ""}${lane.cents.toFixed(1)}¢` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="tuner__octave-hint">
            Útil con octavadores: bloquea la nota base y verifica −1 / root / +1 sin perder la
            octava.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function deviceIdOrEmpty(id: string): string {
  return id;
}

function labelFor(offset: -1 | 0 | 1): string {
  if (offset === 0) return "Root";
  return offset < 0 ? "−1 oct" : "+1 oct";
}

function noteNameFromMidi(midi: number): string {
  const names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const name = names[((midi % 12) + 12) % 12] ?? "C";
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

function Needle({ cents, live }: { readonly cents: number; readonly live: boolean }) {
  const x = centsToNeedle(cents);
  return (
    <div className={`tuner__needle-wrap${live ? " is-live" : ""}`} aria-hidden>
      <div className="tuner__scale">
        <span>-50</span>
        <span>-25</span>
        <span>0</span>
        <span>+25</span>
        <span>+50</span>
      </div>
      <div className="tuner__track">
        <div className="tuner__center" />
        <div
          className={`tuner__needle${inTune(cents) && live ? " is-ok" : ""}`}
          style={{ left: `${50 + x}%` }}
        />
      </div>
    </div>
  );
}

function ClarityBar({ clarity }: { readonly clarity: number }) {
  return (
    <div className="tuner__clarity" title="Claridad de pitch">
      <div className="tuner__clarity-fill" style={{ width: `${Math.round(clarity * 100)}%` }} />
    </div>
  );
}

function GuitarStrip({
  note,
  guitar,
}: {
  readonly note: DetectedNote | null;
  readonly guitar: { string: (typeof GUITAR_STRINGS)[number]; cents: number } | null;
}) {
  return (
    <div className="tuner__guitar" aria-label="Cuerdas EADGBE">
      {GUITAR_STRINGS.map((string) => {
        const active = guitar?.string.id === string.id;
        return (
          <div key={string.id} className={`tuner__string${active ? " is-active" : ""}`}>
            <span className="tuner__string-letter">{string.label}</span>
            <span className="tuner__string-id">{string.id}</span>
            {active && note ? (
              <span className={`tuner__string-cents${inTune(guitar.cents) ? " is-ok" : ""}`}>
                {guitar.cents >= 0 ? "+" : ""}
                {guitar.cents.toFixed(0)}¢
              </span>
            ) : (
              <span className="tuner__string-cents"> </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
