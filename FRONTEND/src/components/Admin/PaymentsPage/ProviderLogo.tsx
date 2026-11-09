/**
 * Arquivo: src/components/Admin/PaymentsPage/ProviderLogo.tsx
 * Objetivo: mostra as iniciais do provedor como marca visual neutra do gateway.
 * Entradas esperadas: recebe o provedor do gateway.
 */
import type { PaymentGatewayProvider } from "@/services/api/paymentGatewayService";
import { PROVIDER_LABEL } from "./constants";

export default function ProviderLogo({ provider }: { provider: PaymentGatewayProvider }) {
  const initials = PROVIDER_LABEL[provider]
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-secondary/30 bg-secondary/10 text-sm font-bold text-secondary"
    >
      {initials}
    </span>
  );
}
