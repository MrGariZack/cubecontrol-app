import { BLOCKS, type BlockId } from "../studio/blocks";

type SignalChainProps = {
  readonly active: BlockId;
  readonly onSelect: (id: BlockId) => void;
};

export function SignalChain({ active, onSelect }: SignalChainProps) {
  return (
    <nav className="signal-chain" aria-label="Cadena de señal">
      {BLOCKS.map((block, index) => (
        <div key={block.id} className="signal-chain__item">
          {index > 0 ? <span className="signal-chain__arrow" aria-hidden /> : null}
          <button
            type="button"
            className={`signal-chain__block${active === block.id ? " signal-chain__block--active" : ""}`}
            style={{ ["--block-accent" as string]: block.accent }}
            onClick={() => onSelect(block.id)}
          >
            <span className="signal-chain__short">{block.short}</span>
            <span className="signal-chain__name">{block.label}</span>
          </button>
        </div>
      ))}
    </nav>
  );
}
