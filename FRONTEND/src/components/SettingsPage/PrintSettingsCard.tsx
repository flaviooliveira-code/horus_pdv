/**
 * Arquivo: src/components/SettingsPage/PrintSettingsCard.tsx
 * Objetivo: renderiza preferencias de impressao da frente de caixa.
 */
import { Printer } from "lucide-react";

type PrintSettingsCardProps = {
  printPreviewEnabled: boolean;
  onChangePrintPreview: (enabled: boolean) => void;
};

export default function PrintSettingsCard({
  printPreviewEnabled,
  onChangePrintPreview,
}: PrintSettingsCardProps) {
  return (
    <div className="rounded-xl border border-border-primary bg-bg-primary p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Printer size={18} />
          </span>
          <div>
            <p className="text-base font-semibold text-text-primary">Impressão no PDV</p>
            <p className="mt-1 text-sm text-text-secondary">
              Defina se a prévia do cupom deve abrir automaticamente ao confirmar uma venda.
            </p>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 rounded-xl border border-border-secondary bg-bg-light p-1 sm:w-[168px]">
          <button
            type="button"
            onClick={() => onChangePrintPreview(true)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              printPreviewEnabled
                ? "bg-secondary text-text-light shadow-sm"
                : "text-text-secondary hover:bg-hover-light"
            }`}
            aria-pressed={printPreviewEnabled}
          >
            Sim
          </button>
          <button
            type="button"
            onClick={() => onChangePrintPreview(false)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              !printPreviewEnabled
                ? "bg-primary text-text-light shadow-sm"
                : "text-text-secondary hover:bg-hover-light"
            }`}
            aria-pressed={!printPreviewEnabled}
          >
            Não
          </button>
        </div>
      </div>
    </div>
  );
}
