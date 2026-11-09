/**
 * Arquivo: src/components/Admin/PaymentsPage/utils.ts
 * Objetivo: converte dados entre API e formulário de gateways e formata valores de exibição.
 * Entradas esperadas: recebe gateway da API ou estado do formulário.
 */
import type {
  PaymentGatewayDto,
  PaymentGatewayPayload,
  PaymentGatewayStatus,
} from "@/services/api/paymentGatewayService";
import type { GatewayFormState, Tone } from "./types";

const toOptionalNumber = (value: string) => {
  const text = value.trim().replace(",", ".");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
};

const toText = (value: number | null) => (value === null ? "" : String(value).replace(".", ","));

export const toFormState = (gateway: PaymentGatewayDto): GatewayFormState => ({
  provider: gateway.provider,
  name: gateway.name,
  environment: gateway.environment,
  active: gateway.active,
  defaultPix: gateway.defaultPix,
  defaultBoleto: gateway.defaultBoleto,
  pixOnly: gateway.pixOnly,
  generateBoletoPix: gateway.generateBoletoPix,
  accessToken: "",
  publicKey: gateway.publicKey,
  webhookSecret: "",
  webhookResponsibleEmail: gateway.webhookResponsibleEmail,
  boletoDueDays: toText(gateway.boletoDueDays),
  finePercent: toText(gateway.finePercent),
  monthlyInterestPercent: toText(gateway.monthlyInterestPercent),
});

export const toPayload = (form: GatewayFormState): PaymentGatewayPayload => ({
  provider: form.provider,
  name: form.name.trim(),
  environment: form.environment,
  active: form.active,
  defaultPix: form.defaultPix,
  defaultBoleto: form.defaultBoleto,
  pixOnly: form.pixOnly,
  generateBoletoPix: form.generateBoletoPix,
  accessToken: form.accessToken.trim(),
  publicKey: form.publicKey.trim(),
  webhookSecret: form.webhookSecret.trim(),
  webhookResponsibleEmail: form.webhookResponsibleEmail.trim(),
  boletoDueDays: toOptionalNumber(form.boletoDueDays),
  finePercent: toOptionalNumber(form.finePercent),
  monthlyInterestPercent: toOptionalNumber(form.monthlyInterestPercent),
});

/** Insere ou substitui o gateway e tira o padrão PIX/boleto dos demais, como a API faz. */
export const upsertGateway = (gateways: PaymentGatewayDto[], next: PaymentGatewayDto) => {
  const others = gateways
    .filter((gateway) => gateway.id !== next.id)
    .map((gateway) => ({
      ...gateway,
      defaultPix: next.defaultPix ? false : gateway.defaultPix,
      defaultBoleto: next.defaultBoleto ? false : gateway.defaultBoleto,
    }));
  const index = gateways.findIndex((gateway) => gateway.id === next.id);
  if (index < 0) return [next, ...others];
  others.splice(index, 0, next);
  return others;
};

export const statusTone = (status: PaymentGatewayStatus): Tone => {
  if (status === "OK") return "success";
  if (status === "ERROR") return "danger";
  if (status === "DISABLED") return "muted";
  return "info";
};

export const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
};

export const formatPercent = (value: number | null) =>
  value === null ? "-" : `${String(value).replace(".", ",")}%`;

export const needsAttention = (gateway: PaymentGatewayDto) =>
  !gateway.active || gateway.status === "ERROR" || gateway.status === "PENDING";
