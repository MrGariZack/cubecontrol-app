type SectionToggleProps = {
  readonly label: string;
  readonly on: boolean;
  readonly accent: string;
  readonly onChange: (on: boolean) => void;
};

export function SectionToggle({ label, on, accent, onChange }: SectionToggleProps) {
  return (
    <button
      type="button"
      className={`section-toggle${on ? " section-toggle--on" : ""}`}
      style={{ ["--toggle-accent" as string]: accent }}
      onClick={() => onChange(!on)}
      aria-pressed={on}
    >
      <span className="section-toggle__dot" />
      {label}
    </button>
  );
}
