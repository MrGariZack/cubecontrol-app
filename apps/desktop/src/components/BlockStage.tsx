import type { LiveParamName } from "@tonehub/cube-baby-protocol";
import { getBlock, type BlockId } from "../studio/blocks";
import type { LiveParamsSnapshot } from "../types/device";
import { Knob } from "./Knob";
import { SectionToggle } from "./SectionToggle";

type BlockStageProps = {
  readonly blockId: BlockId;
  readonly params: LiveParamsSnapshot;
  readonly onParamChange: (param: LiveParamName, value: number) => void;
};

export function BlockStage({ blockId, params, onParamChange }: BlockStageProps) {
  const block = getBlock(blockId);

  return (
    <section className="block-stage" aria-label={block.label}>
      <header className="block-stage__header">
        <p className="block-stage__eyebrow">Selected block</p>
        <h2 className="block-stage__title">{block.label}</h2>
        <span
          className="block-stage__accent-bar"
          style={{ background: block.accent }}
          aria-hidden
        />
      </header>

      <div className="block-stage__knobs">
        {block.knobs.map((knob) => (
          <Knob
            key={knob.param}
            label={knob.label}
            value={params[knob.param]}
            max={knob.max}
            accent={block.accent}
            onChange={(value) => onParamChange(knob.param, value)}
          />
        ))}
      </div>

      {block.toggle ? (
        <div className="block-stage__toggles">
          <SectionToggle
            label={block.toggle.label}
            on={(params[block.toggle.param] ?? 0) > 0}
            accent={block.accent}
            onChange={(on) => {
              const toggle = block.toggle;
              if (toggle === undefined) return;
              onParamChange(toggle.param, on ? 1 : 0);
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
