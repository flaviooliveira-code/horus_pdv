/**
 * Arquivo: src/components/Form/YesNoSegmentedControl.tsx
 * Objetivo: renderiza controle binário Sim/Não padronizado para preferências.
  * Entradas esperadas: recebe valor booleano, callback de alteração e textos opcionais para Sim/Não.
*/

type YesNoSegmentedControlProps = {
  value: boolean;
  onChange: (nextValue: boolean) => void;
  disabled?: boolean;
  yesLabel?: string;
  noLabel?: string;
  ariaLabel: string;
  className?: string;
};

export default function YesNoSegmentedControl({
  value,
  onChange,
  disabled = false,
  yesLabel = "Sim",
  noLabel = "Não",
  ariaLabel,
  className = "",
}: YesNoSegmentedControlProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`grid w-full grid-cols-2 rounded-2xl border border-border-secondary bg-bg-light p-1 sm:w-[168px] ${className}`.trim()}
    >
      <button
        type="button"
        onClick={() => onChange(true)}
        disabled={disabled}
        className={`min-h-11 rounded-xl px-4 text-sm font-semibold transition ${
          value
            ? "bg-secondary text-text-light shadow-sm"
            : "text-text-secondary hover:bg-hover-light"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        aria-pressed={value}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        disabled={disabled}
        className={`min-h-11 rounded-xl px-4 text-sm font-semibold transition ${
          !value
            ? "bg-primary text-text-light shadow-sm"
            : "text-text-secondary hover:bg-hover-light"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        aria-pressed={!value}
      >
        {noLabel}
      </button>
    </div>
  );
}
