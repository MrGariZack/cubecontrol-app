import {
  LIVE_PARAM_MAX,
  type LiveParamName,
  type PresetSlotId,
} from "@tonehub/cube-baby-protocol";
import type { LiveParamsSnapshot } from "../../types/device";
import { PedalKnob } from "./PedalKnob";
import { SignalScope } from "./SignalScope";
import "./cube-baby-pedal.css";

type CubeBabyPedalProps = {
  readonly params: LiveParamsSnapshot;
  readonly activeSlot: PresetSlotId;
  readonly busy?: boolean;
  /** Spectrum / mini-game — off on splash and other non-studio embeds. */
  readonly showScope?: boolean;
  readonly onParamChange: (param: LiveParamName, value: number) => void;
  readonly onSelectSlot: (slot: PresetSlotId) => void;
};

type KnobSpec = {
  readonly param: LiveParamName;
  readonly label: string;
  readonly max: number;
  readonly tone: "volume" | "cab" | "delay" | "drive";
  readonly section?: "irSection" | "delaySection" | "toneSection";
  /** Part of Mix/FB/Time/MOD cluster: Mix at 0 shows the cluster as off. */
  readonly delayTimeCluster?: boolean;
  /** MOD: center (7–8) is off; 0 is chorus, not off. */
  readonly bipolarCenterOff?: boolean;
  readonly tunerMark?: string;
  readonly iconMark?: "play" | "stop" | "back";
};

const KNOBS: readonly KnobSpec[] = [
  { param: "volume", label: "VOLUME", max: LIVE_PARAM_MAX.volume, tone: "volume" },
  {
    param: "cabinet",
    label: "IR CAB",
    max: LIVE_PARAM_MAX.cabinet,
    tone: "cab",
    section: "irSection",
    tunerMark: "E",
  },
  {
    param: "reverb",
    label: "REVERB",
    max: LIVE_PARAM_MAX.reverb,
    tone: "cab",
    section: "irSection",
    tunerMark: "A",
  },
  {
    param: "mix",
    label: "MIX",
    max: LIVE_PARAM_MAX.mix,
    tone: "delay",
    section: "delaySection",
    delayTimeCluster: true,
    tunerMark: "D",
  },
  {
    param: "feedback",
    label: "FB",
    max: LIVE_PARAM_MAX.feedback,
    tone: "delay",
    section: "delaySection",
    delayTimeCluster: true,
    tunerMark: "G",
  },
  {
    param: "time",
    label: "TIME",
    max: LIVE_PARAM_MAX.time,
    tone: "delay",
    section: "delaySection",
    delayTimeCluster: true,
    tunerMark: "B",
  },
  {
    // Bipolar: 0–6 chorus, 7–8 off, 9–15 phaser. Independent of Mix (delay wet).
    // Full MOD+DLY mute = footswitch B / delaySection only.
    param: "modulation",
    label: "MOD",
    max: LIVE_PARAM_MAX.modulation,
    tone: "delay",
    section: "delaySection",
    bipolarCenterOff: true,
    tunerMark: "E",
  },
  {
    param: "tone",
    label: "TONE",
    max: LIVE_PARAM_MAX.tone,
    tone: "drive",
    section: "toneSection",
    iconMark: "play",
  },
  {
    param: "gain",
    label: "GAIN",
    max: LIVE_PARAM_MAX.gain,
    tone: "drive",
    section: "toneSection",
    iconMark: "stop",
  },
  {
    param: "type",
    label: "TYPE",
    max: LIVE_PARAM_MAX.type,
    tone: "drive",
    section: "toneSection",
    iconMark: "back",
  },
];

export function CubeBabyPedal({
  params,
  activeSlot,
  busy = false,
  showScope = true,
  onParamChange,
  onSelectSlot,
}: CubeBabyPedalProps) {
  function toggleSection(param: "irSection" | "delaySection" | "toneSection") {
    if (busy) return;
    onParamChange(param, params[param] > 0 ? 0 : 1);
  }

  return (
    <div className="cube-stage" aria-label="CUBE Baby virtual">
      {showScope ? <SignalScope /> : null}
      <div className="cube-jacks" aria-hidden>
        <span className="cube-jacks__jack" />
        <span className="cube-jacks__switch" />
        <span className="cube-jacks__jack" />
      </div>

      <div className="cube-baby">
        <div className="cube-baby__bezel" aria-hidden />
        <div className="cube-baby__screw cube-baby__screw--tl" aria-hidden />
        <div className="cube-baby__screw cube-baby__screw--tr" aria-hidden />
        <div className="cube-baby__screw cube-baby__screw--bl" aria-hidden />
        <div className="cube-baby__screw cube-baby__screw--br" aria-hidden />

        <header className="cube-baby__header">
          <span className="cube-baby__brand">M-VAVE</span>
          <div className="cube-baby__status">
            <span className="cube-baby__batt" title="Battery" aria-hidden />
            <span className="cube-baby__bt is-on" title="USB / link" aria-hidden />
          </div>
        </header>

        <div className="cube-baby__knobs" role="group" aria-label="Controles">
          {KNOBS.map((knob) => {
            const sectionOn =
              knob.section === undefined ? true : params[knob.section] > 0;
            // Mix is the master for the delay-time cluster (Mix / FB / Time).
            const effectOff = Boolean(knob.delayTimeCluster) && params.mix === 0;
            return (
              <PedalKnob
                key={knob.param}
                param={knob.param}
                label={knob.label}
                value={params[knob.param]}
                max={knob.max}
                tone={knob.tone}
                sectionOn={sectionOn}
                effectOff={effectOff}
                bipolarCenterOff={Boolean(knob.bipolarCenterOff)}
                {...(knob.tunerMark === undefined ? {} : { tunerMark: knob.tunerMark })}
                {...(knob.iconMark === undefined ? {} : { iconMark: knob.iconMark })}
                disabled={busy}
                onChange={onParamChange}
              />
            );
          })}
        </div>

        <div className="cube-baby__deck">
          <Footswitch
            slot="A"
            active={activeSlot === "A"}
            leftLabel="IR CAB"
            rightLabel="REVERB"
            ledOn={params.irSection > 0}
            ledTone="cab"
            disabled={busy}
            onSelect={() => onSelectSlot("A")}
            onToggleLed={() => toggleSection("irSection")}
          />
          <div className="cube-baby__bridge" aria-hidden>
            <span>EDIT/PRESET</span>
            <span>HOLD BT</span>
          </div>
          <Footswitch
            slot="B"
            active={activeSlot === "B"}
            leftLabel="DELAY"
            rightLabel="MOD"
            ledOn={params.delaySection > 0}
            ledTone="delay"
            disabled={busy}
            onSelect={() => onSelectSlot("B")}
            onToggleLed={() => toggleSection("delaySection")}
          />
          <div className="cube-baby__bridge" aria-hidden>
            <span>LIVE/PRESET</span>
            <span>HOLD TUNER</span>
          </div>
          <Footswitch
            slot="C"
            active={activeSlot === "C"}
            leftLabel="TONE"
            rightLabel="AMP"
            ledOn={params.toneSection > 0}
            ledTone="drive"
            disabled={busy}
            onSelect={() => onSelectSlot("C")}
            onToggleLed={() => toggleSection("toneSection")}
          />
        </div>
      </div>
    </div>
  );
}

type FootswitchProps = {
  readonly slot: PresetSlotId;
  readonly active: boolean;
  readonly leftLabel: string;
  readonly rightLabel: string;
  readonly ledOn: boolean;
  readonly ledTone: "cab" | "delay" | "drive";
  readonly disabled: boolean;
  readonly onSelect: () => void;
  readonly onToggleLed: () => void;
};

function Footswitch({
  slot,
  active,
  leftLabel,
  rightLabel,
  ledOn,
  ledTone,
  disabled,
  onSelect,
  onToggleLed,
}: FootswitchProps) {
  // Active pad would be a no-op for slot change — use it to toggle this foot's
  // section (Delay on B, Tone on C). Matches how users try to mute while on B/C.
  function onPadClick() {
    if (active) onToggleLed();
    else onSelect();
  }

  return (
    <div className={`cube-fs${active ? " is-active" : ""}`}>
      <div className="cube-fs__arc">
        <button
          type="button"
          className="cube-fs__arc-label"
          disabled={disabled}
          onClick={onToggleLed}
        >
          {leftLabel}
        </button>
        <button
          type="button"
          className={`cube-fs__led cube-fs__led--${ledTone}${ledOn ? " is-on" : ""}`}
          aria-label={`${leftLabel}/${rightLabel} section ${ledOn ? "on" : "off"}`}
          disabled={disabled}
          onClick={onToggleLed}
        />
        <button
          type="button"
          className="cube-fs__arc-label"
          disabled={disabled}
          onClick={onToggleLed}
        >
          {rightLabel}
        </button>
      </div>
      <button
        type="button"
        className="cube-fs__switch"
        disabled={disabled}
        aria-pressed={active}
        aria-label={
          active
            ? `Footswitch ${slot}: toggle ${leftLabel}/${rightLabel}`
            : `Footswitch ${slot}`
        }
        onClick={onPadClick}
      >
        <span className="cube-fs__metal" aria-hidden />
      </button>
      <span className="cube-fs__name">{slot}</span>
    </div>
  );
}
