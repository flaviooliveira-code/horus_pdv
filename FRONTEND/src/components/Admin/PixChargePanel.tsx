/**
 * Arquivo: src/components/Admin/PixChargePanel.tsx
 * Objetivo: mostra, na frente de caixa, o QR Code PIX gerado pelo gateway e acompanha o pagamento.
 * Entradas esperadas: cobrança atual (ou nenhuma), estados de carregamento e callbacks de gerar/cancelar.
 */
import { CircleAlert, CircleCheck, Copy, LoaderCircle, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import LoadingButton from "@/components/Loading/LoadingButton";
import { Toast } from "@/hooks/Dialog";
import { qrCodeImageSrc, type PaymentChargeDto } from "@/services/api/paymentChargeService";

type PixChargePanelProps = {
  charge: PaymentChargeDto | null;
  generating: boolean;
  cancelling: boolean;
  onGenerate: () => void;
  onCancel: () => void;
};

export default function PixChargePanel({
  charge,
  generating,
  cancelling,
  onGenerate,
  onCancel,
}: PixChargePanelProps) {
  if (!charge) {
    return (
      <div className="rounded-xl border border-dashed border-accent/40 bg-accent/10 p-3">
        <p className="text-sm text-text-secondary">
          Gere o QR Code no gateway padrão de PIX: a venda é finalizada sozinha quando o pagamento cair.
          Sem gateway, use Confirmar para registrar um PIX já recebido.
        </p>
        <LoadingButton
          type="button"
          onClick={onGenerate}
          isLoading={generating}
          loadingLabel="Gerando QR Code..."
          className="btn-primary mt-3 inline-flex h-11 w-full items-center justify-center gap-2"
        >
          <QrCode size={16} />
          Gerar QR Code PIX
        </LoadingButton>
      </div>
    );
  }

  if (charge.status === "PAID") {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3 text-sm font-semibold text-success">
        <CircleCheck size={18} aria-hidden="true" />
        PIX recebido via {charge.gatewayName}.
      </p>
    );
  }

  if (charge.status !== "PENDING") {
    const label = charge.status === "EXPIRED" ? "expirou" : charge.status === "CANCELLED" ? "foi cancelado" : "falhou";
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/10 p-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary">
          <CircleAlert size={18} aria-hidden="true" />
          O QR Code {label}.
        </p>
        <LoadingButton
          type="button"
          onClick={onGenerate}
          isLoading={generating}
          loadingLabel="Gerando QR Code..."
          className="btn-primary mt-3 inline-flex h-11 w-full items-center justify-center gap-2"
        >
          <QrCode size={16} />
          Gerar novo QR Code
        </LoadingButton>
      </div>
    );
  }

  return <PendingPix charge={charge} cancelling={cancelling} onCancel={onCancel} />;
}

function PendingPix({
  charge,
  cancelling,
  onCancel,
}: {
  charge: PaymentChargeDto;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const remaining = useCountdown(charge.expiresAt);
  const imageSrc = qrCodeImageSrc(charge.pixQrCodeImage);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(charge.pixCopyPaste);
      Toast.success("Código PIX copiado.");
    } catch {
      Toast.error("Não foi possível copiar. Selecione o código e copie manualmente.");
    }
  };

  return (
    <div className="rounded-xl border border-accent/40 bg-bg-primary p-3">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt="QR Code PIX para pagamento"
            className="h-44 w-44 shrink-0 rounded-lg border border-border-primary bg-white p-1"
          />
        ) : (
          <div className="flex h-44 w-44 shrink-0 items-center justify-center rounded-lg border border-dashed border-border-secondary text-center text-xs text-text-tertiary">
            Use o copia e cola ao lado
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-accent" role="status">
            <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
            Aguardando pagamento
          </p>
          <p className="text-xs text-text-secondary">
            {charge.gatewayName}
            {remaining ? ` · expira em ${remaining}` : ""}
          </p>
          <label className="block">
            <span className="mb-1 block text-xs text-text-secondary">PIX copia e cola</span>
            <textarea
              readOnly
              value={charge.pixCopyPaste}
              rows={3}
              onFocus={(event) => event.currentTarget.select()}
              className="input-field w-full resize-none break-all font-mono text-[11px]"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void copyCode()}
              className="btn-outline-secondary inline-flex h-10 items-center justify-center gap-1.5 px-2 text-sm"
            >
              <Copy size={14} />
              Copiar
            </button>
            <LoadingButton
              type="button"
              onClick={onCancel}
              isLoading={cancelling}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-2 text-sm font-semibold text-primary transition hover:bg-primary/15"
            >
              Cancelar PIX
            </LoadingButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Contagem regressiva mm:ss até a expiração do QR Code. */
function useCountdown(expiresAt: string | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  if (!expiresAt) return "";
  const diff = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(diff) || diff <= 0) return "";
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}h${String(minutes).padStart(2, "0")}` : `${minutes}:${seconds}`;
}
