/**
 * Arquivo: src/components/SettingsPage/ThemeSettingsCard.tsx
 * Objetivo: renderiza card de preferência visual para alternância de tema.
 * Entradas esperadas: tema atual e callback de alternância.
 */
import { Moon, Sun } from "lucide-react";

type ThemeMode = "light" | "dark";

type ThemeSettingsCardProps = {
  themeMode: ThemeMode;
  onToggleTheme: () => void;
};

export default function ThemeSettingsCard({
  themeMode,
  onToggleTheme,
}: ThemeSettingsCardProps) {
  // Flag derivada para simplificar renderização visual do switch.
  const isDark = themeMode === "dark";

  return (
    <div className="rounded-xl border border-border-primary bg-bg-primary p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="text-base font-semibold text-text-primary">Tema</p>
          <p className="mt-1 text-sm text-text-secondary">
            Escolha entre modo claro e escuro. Esta preferência é salva no seu navegador.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          onClick={onToggleTheme}
          className={`relative inline-flex h-9 w-16 shrink-0 items-center self-start rounded-full border transition sm:self-center ${
            isDark
              ? "border-secondary/40 bg-secondary/25"
              : "border-border-secondary bg-bg-light"
          }`}
          aria-label="Alternar tema claro e escuro"
        >
          <span
            className={`absolute left-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-bg-light text-text-primary shadow-sm transition-transform ${
              isDark ? "translate-x-7" : "translate-x-0"
            }`}
          >
            {isDark ? <Moon size={14} /> : <Sun size={14} />}
          </span>
        </button>
      </div>
    </div>
  );
}
