/**
 * Arquivo: src/components/SettingsPage/PrintSettingsCard.tsx
 * Objetivo: renderiza preferências de impressão da frente de caixa.
  * Entradas esperadas: recebe preferência atual de prévia de impressão e callback de alteração.
*/
import { Printer } from "lucide-react";
import { YesNoSegmentedControl } from "@/components/Form";

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

        <YesNoSegmentedControl
          value={printPreviewEnabled}
          onChange={onChangePrintPreview}
          ariaLabel="Ativar prévia de impressão"
        />
      </div>
    </div>
  );
}
