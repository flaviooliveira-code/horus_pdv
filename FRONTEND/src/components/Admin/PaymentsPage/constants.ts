/**
 * Arquivo: src/components/Admin/PaymentsPage/constants.ts
 * Objetivo: centraliza rótulos, instruções e formulário padrão dos gateways de pagamento.
 * Entradas esperadas: não recebe props; exporta constantes usadas pela página e pelo drawer.
 */
import type {
  PaymentGatewayProvider,
  PaymentGatewayStatus,
} from "@/services/api/paymentGatewayService";
import type { GatewayFormState } from "./types";

export const PROVIDER_ORDER: PaymentGatewayProvider[] = ["ASAAS", "MERCADO_PAGO", "PAGBANK"];

export const PROVIDER_LABEL: Record<PaymentGatewayProvider, string> = {
  ASAAS: "Asaas",
  MERCADO_PAGO: "Mercado Pago",
  PAGBANK: "PagBank",
};

export const PROVIDER_DESCRIPTION: Record<PaymentGatewayProvider, string> = {
  ASAAS: "PIX, boleto e cartão com conciliação automática.",
  MERCADO_PAGO: "PIX e boleto pelo Mercado Pago. Use o Access Token da aplicação, não a Public Key.",
  PAGBANK: "PIX e boleto pelo PagBank. O token é conferido na primeira cobrança.",
};

export const CREDENTIAL_LABEL: Record<PaymentGatewayProvider, string> = {
  ASAAS: "API Key",
  MERCADO_PAGO: "Access Token",
  PAGBANK: "Access Token",
};

export const CREDENTIAL_HELP: Record<PaymentGatewayProvider, string> = {
  ASAAS: "Gere a API Key em Integrações › Chaves de API no painel Asaas.",
  MERCADO_PAGO:
    "Copie o Access Token em Suas integrações › Credenciais. A Public Key sozinha não autoriza cobranças.",
  PAGBANK: "Gere o token em Minha conta › Integrações no painel PagBank.",
};

/** Asaas sempre emite boleto com PIX; "Somente PIX" vale para Mercado Pago e PagBank. */
export const PIX_ONLY_PROVIDERS: PaymentGatewayProvider[] = ["MERCADO_PAGO", "PAGBANK"];

export const STATUS_LABEL: Record<PaymentGatewayStatus, string> = {
  OK: "Validado",
  PENDING: "Pendente",
  ERROR: "Erro",
  DISABLED: "Inativo",
};

export const DEFAULT_FORM: GatewayFormState = {
  provider: "ASAAS",
  name: "",
  environment: "PRODUCTION",
  active: true,
  defaultPix: true,
  defaultBoleto: false,
  pixOnly: false,
  generateBoletoPix: true,
  accessToken: "",
  publicKey: "",
  webhookSecret: "",
  webhookResponsibleEmail: "",
  boletoDueDays: "",
  finePercent: "",
  monthlyInterestPercent: "",
};
