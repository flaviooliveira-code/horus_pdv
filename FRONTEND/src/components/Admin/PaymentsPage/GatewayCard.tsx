/**
 * Arquivo: src/components/Admin/PaymentsPage/GatewayCard.tsx
 * Objetivo: renderiza uma conta de gateway com status, padrões, regras e ações.
 * Entradas esperadas: recebe gateway da API, estados de carregamento e callbacks de validar/editar/remover.
 */
import { CircleAlert, CircleCheck, Info, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import LoadingButton from "@/components/Loading/LoadingButton";
import type { PaymentGatewayDto } from "@/services/api/paymentGatewayService";
import { CREDENTIAL_LABEL, PROVIDER_DESCRIPTION, PROVIDER_LABEL, STATUS_LABEL } from "./constants";
import Pill from "./Pill";
import ProviderLogo from "./ProviderLogo";
import { formatDateTime, formatPercent, statusTone } from "./utils";

type GatewayCardProps = {
  gateway: PaymentGatewayDto;
  validating: boolean;
  removing: boolean;
  onValidate: () => void;
  onEdit: () => void;
  onRemove: () => void;
};

export default function GatewayCard({
  gateway,
  validating,
  removing,
  onValidate,
  onEdit,
  onRemove,
}: GatewayCardProps) {
  const modality = gateway.pixOnly
    ? "Somente PIX"
    : gateway.generateBoletoPix
      ? "Boleto + PIX"
      : "Boleto";

  return (
    <article className="p-4 sm:p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <ProviderLogo provider={gateway.provider} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="break-words text-base font-semibold text-text-primary">
                  {gateway.name}
                </h3>
                <Pill tone={gateway.environment === "PRODUCTION" ? "success" : "info"}>
                  {gateway.environment === "PRODUCTION" ? "Produção" : "Sandbox"}
                </Pill>
                <Pill tone={statusTone(gateway.status)}>{STATUS_LABEL[gateway.status]}</Pill>
                {gateway.defaultPix ? <Pill tone="brand">Padrão PIX</Pill> : null}
                {gateway.defaultBoleto ? <Pill tone="brand">Padrão boleto</Pill> : null}
              </div>
              <p className="mt-1 text-sm text-text-secondary">
                {PROVIDER_LABEL[gateway.provider]} · {PROVIDER_DESCRIPTION[gateway.provider]}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <DetailPanel title="Credenciais">
              <DetailRow
                label={CREDENTIAL_LABEL[gateway.provider]}
                value={gateway.accessTokenMask || "-"}
              />
              {gateway.provider === "MERCADO_PAGO" ? (
                <DetailRow label="Public Key" value={gateway.publicKey || "-"} />
              ) : null}
              <DetailRow label="Última validação" value={formatDateTime(gateway.lastValidatedAt)} />
              <DetailRow label="Último webhook" value={formatDateTime(gateway.webhookLastEventAt)} />
            </DetailPanel>
            <DetailPanel title="Uso">
              <DetailRow label="Modalidade" value={modality} />
              <DetailRow label="Padrão PIX" value={gateway.defaultPix ? "Sim" : "Não"} />
              <DetailRow label="Padrão boleto" value={gateway.defaultBoleto ? "Sim" : "Não"} />
            </DetailPanel>
            <DetailPanel title="Regras do boleto">
              <DetailRow
                label="Vencimento"
                value={gateway.boletoDueDays === null ? "-" : `${gateway.boletoDueDays} dias`}
              />
              <DetailRow label="Multa" value={formatPercent(gateway.finePercent)} />
              <DetailRow label="Juros ao mês" value={formatPercent(gateway.monthlyInterestPercent)} />
            </DetailPanel>
          </div>

          <ValidationMessage gateway={gateway} />
        </div>

        <div className="grid grid-cols-3 gap-2 xl:flex xl:w-36 xl:flex-col">
          <LoadingButton
            type="button"
            isLoading={validating}
            onClick={onValidate}
            className="btn-outline-secondary inline-flex items-center justify-center gap-1.5 px-3"
          >
            <ShieldCheck size={15} className="hidden sm:block" />
            Validar
          </LoadingButton>
          <button
            type="button"
            onClick={onEdit}
            className="btn-outline-secondary inline-flex items-center justify-center gap-1.5 px-3"
          >
            <Pencil size={15} className="hidden sm:block" />
            Editar
          </button>
          <LoadingButton
            type="button"
            isLoading={removing}
            onClick={onRemove}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 font-semibold text-primary transition hover:bg-primary/15"
          >
            <Trash2 size={15} className="hidden sm:block" />
            Remover
          </LoadingButton>
        </div>
      </div>
    </article>
  );
}

function ValidationMessage({ gateway }: { gateway: PaymentGatewayDto }) {
  if (!gateway.lastValidationMessage) return null;

  const config = {
    OK: { icon: CircleCheck, className: "border-success/30 bg-success/10 text-success" },
    ERROR: { icon: CircleAlert, className: "border-primary/30 bg-primary/10 text-primary" },
    PENDING: { icon: Info, className: "border-accent/40 bg-accent/10 text-accent" },
    DISABLED: { icon: Info, className: "border-border-primary bg-bg-gray-theme text-text-secondary" },
  }[gateway.status];
  const Icon = config.icon;

  return (
    <p
      className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${config.className}`}
    >
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">{gateway.lastValidationMessage}</span>
    </p>
  );
}

function DetailPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border-primary bg-bg-gray-theme/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{title}</p>
      <div className="mt-2 space-y-1.5">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
      <span className="shrink-0 text-text-secondary">{label}</span>
      <span className="truncate text-right font-semibold text-text-primary">{value}</span>
    </div>
  );
}
