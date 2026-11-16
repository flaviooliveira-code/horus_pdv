/**
 * Arquivo: src/components/SettingsPage/AccessibilitySettingsCard.tsx
 * Objetivo: renderiza preferências de acessibilidade (Alta Visibilidade F7) e foco contínuo do leitor HID no PDV.
 * Entradas esperadas: valores atuais e callbacks de alteração.
 */
import { Eye, ScanBarcode } from "lucide-react";
import { YesNoSegmentedControl } from "@/components/Form";

type AccessibilitySettingsCardProps = {
  highVisibilityEnabled: boolean;
  onChangeHighVisibility: (enabled: boolean) => void;
  scannerAutoFocusEnabled: boolean;
  onChangeScannerAutoFocus: (enabled: boolean) => void;
};

export default function AccessibilitySettingsCard({
  highVisibilityEnabled,
  onChangeHighVisibility,
  scannerAutoFocusEnabled,
  onChangeScannerAutoFocus,
}: AccessibilitySettingsCardProps) {
  return (
    <div className="space-y-4 rounded-xl border border-border-primary bg-bg-primary p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Eye size={18} />
          </span>
          <div>
            <p className="text-base font-semibold text-text-primary">
              Modo Alta Visibilidade no PDV (F7)
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Amplia a tipografia da frente de caixa em 50% com contraste WCAG AAA para leitura à
              distância de balcão e baixa visão.
            </p>
          </div>
        </div>

        <YesNoSegmentedControl
          value={highVisibilityEnabled}
          onChange={onChangeHighVisibility}
          ariaLabel="Ativar modo alta visibilidade no PDV"
        />
      </div>

      <div className="border-t border-border-primary pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <ScanBarcode size={18} />
            </span>
            <div>
              <p className="text-base font-semibold text-text-primary">
                Manter foco no leitor de código de barras (HID)
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Mantém o campo de produto pronto para bipes contínuos e captura leituras rápidas
                mesmo fora do campo.
              </p>
            </div>
          </div>

          <YesNoSegmentedControl
            value={scannerAutoFocusEnabled}
            onChange={onChangeScannerAutoFocus}
            ariaLabel="Ativar foco contínuo no leitor de código de barras"
          />
        </div>
      </div>
    </div>
  );
}
