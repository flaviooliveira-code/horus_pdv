/**
 * Arquivo: src/components/Admin/PaymentsPage/ChargesSection.tsx
 * Objetivo: lista as cobranças PIX/boleto emitidas, com status, links e ações de atualizar e cancelar.
 * Entradas esperadas: cobranças da API, estados de carregamento por linha e callbacks das ações.
 */
import { Copy, ExternalLink, FileText, Plus, QrCode, RefreshCw, XCircle } from "lucide-react";
import LoadingButton from "@/components/Loading/LoadingButton";
import Skeleton from "@/components/Loading/Skeleton";
import { Toast } from "@/hooks/Dialog";
import type {
  PaymentChargeDto,
  PaymentChargeStatus,
} from "@/services/api/paymentChargeService";
import { PROVIDER_LABEL } from "./constants";
import Pill from "./Pill";
import type { Tone } from "./types";
import { formatDateTime } from "./utils";

const STATUS: Record<PaymentChargeStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Aguardando", tone: "info" },
  PAID: { label: "Pago", tone: "success" },
  CANCELLED: { label: "Cancelado", tone: "muted" },
  EXPIRED: { label: "Expirado", tone: "muted" },
  FAILED: { label: "Falhou", tone: "danger" },
};

const formatCents = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type ChargesSectionProps = {
  charges: PaymentChargeDto[];
  loading: boolean;
  syncingId: string | null;
  cancellingId: string | null;
  onCreate: () => void;
  onSync: (charge: PaymentChargeDto) => void;
  onCancel: (charge: PaymentChargeDto) => void;
};

export default function ChargesSection({
  charges,
  loading,
  syncingId,
  cancellingId,
  onCreate,
  onSync,
  onCancel,
}: ChargesSectionProps) {
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      Toast.success(`${label} copiado.`);
    } catch {
      Toast.error("Não foi possível copiar.");
    }
  };

  if (loading && !charges.length) {
    return (
      <div className="space-y-3 p-5" aria-busy="true">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>
    );
  }

  if (!charges.length) {
    return (
      <div className="flex flex-col items-center px-5 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
          <FileText size={22} />
        </span>
        <h3 className="mt-3 font-semibold text-text-primary">Nenhuma cobrança emitida</h3>
        <p className="mt-1 max-w-md text-sm text-text-secondary">
          Os PIX gerados na frente de caixa e os boletos emitidos aqui aparecem nesta lista.
        </p>
        <button type="button" onClick={onCreate} className="btn-primary mt-5 inline-flex items-center gap-2">
          <Plus size={16} />
          Nova cobrança
        </button>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border-primary">
      {charges.map((charge) => {
        const status = STATUS[charge.status];
        const MethodIcon = charge.method === "PIX" ? QrCode : FileText;
        return (
          <li key={charge.id} className="grid gap-3 p-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                <MethodIcon size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-text-primary">{formatCents(charge.amountCents)}</span>
                  <Pill tone={status.tone}>{status.label}</Pill>
                  <span className="text-xs text-text-tertiary">
                    {charge.method === "PIX" ? "PIX" : "Boleto"} · {charge.gatewayName || PROVIDER_LABEL[charge.provider]}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-text-secondary">
                  {charge.payerName}
                  {charge.payerDocument ? ` · ${charge.payerDocument}` : ""}
                  {charge.description ? ` · ${charge.description}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  Emitida {formatDateTime(charge.createdAt)}
                  {charge.createdBy ? ` por ${charge.createdBy}` : ""}
                  {charge.status === "PAID" && charge.paidAt ? ` · paga ${formatDateTime(charge.paidAt)}` : ""}
                  {charge.status === "PENDING" && charge.expiresAt ? ` · vence ${formatDateTime(charge.expiresAt)}` : ""}
                  {charge.saleNumber ? ` · venda ${charge.saleNumber}` : ""}
                </p>
                {charge.lastError ? (
                  <p className="mt-1 text-xs font-medium text-primary">{charge.lastError}</p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              {charge.boletoUrl ? (
                <a
                  href={charge.boletoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline-secondary inline-flex h-9 items-center gap-1.5 px-3 text-sm"
                >
                  <ExternalLink size={14} />
                  Boleto
                </a>
              ) : null}
              {charge.status === "PENDING" && charge.boletoLine ? (
                <button
                  type="button"
                  onClick={() => void copy(charge.boletoLine, "Linha digitável")}
                  className="btn-outline-secondary inline-flex h-9 items-center gap-1.5 px-3 text-sm"
                >
                  <Copy size={14} />
                  Linha
                </button>
              ) : null}
              {charge.status === "PENDING" && charge.pixCopyPaste ? (
                <button
                  type="button"
                  onClick={() => void copy(charge.pixCopyPaste, "PIX copia e cola")}
                  className="btn-outline-secondary inline-flex h-9 items-center gap-1.5 px-3 text-sm"
                >
                  <Copy size={14} />
                  PIX
                </button>
              ) : null}
              {charge.status === "PENDING" ? (
                <>
                  <LoadingButton
                    type="button"
                    isLoading={syncingId === charge.id}
                    onClick={() => onSync(charge)}
                    className="btn-outline-secondary inline-flex h-9 items-center gap-1.5 px-3 text-sm"
                    aria-label="Atualizar status da cobrança"
                  >
                    <RefreshCw size={14} />
                    Status
                  </LoadingButton>
                  <LoadingButton
                    type="button"
                    isLoading={cancellingId === charge.id}
                    onClick={() => onCancel(charge)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 text-sm font-semibold text-primary transition hover:bg-primary/15"
                  >
                    <XCircle size={14} />
                    Cancelar
                  </LoadingButton>
                </>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
