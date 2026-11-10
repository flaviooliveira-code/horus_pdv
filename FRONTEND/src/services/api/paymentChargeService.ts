/**
 * Arquivo: src/services/api/paymentChargeService.ts
 * Objetivo: encapsula chamadas HTTP de cobranças PIX/boleto emitidas pelos gateways de pagamento.
 * Entradas esperadas: valor em centavos e pagador; a consulta individual sincroniza o status no provedor.
 */
import { apiRequest } from "./apiClient";
import type { PaymentGatewayProvider } from "./paymentGatewayService";

const COBRANCA_PAGAMENTO_API_URL =
  import.meta.env.VITE_COBRANCA_PAGAMENTO_API_URL ??
  "http://localhost:5260/api/CobrancaPagamento";

export type PaymentChargeMethod = "PIX" | "BOLETO";
export type PaymentChargeStatus = "PENDING" | "PAID" | "CANCELLED" | "EXPIRED" | "FAILED";

export type PaymentChargeDto = {
  id: string;
  gatewayId: string;
  gatewayName: string;
  provider: PaymentGatewayProvider;
  method: PaymentChargeMethod;
  amountCents: number;
  description: string;
  status: PaymentChargeStatus;
  providerStatus: string;
  pixCopyPaste: string;
  /** URL HTTPS ou PNG em Base64. */
  pixQrCodeImage: string;
  boletoUrl: string;
  boletoLine: string;
  payerName: string;
  payerDocument: string;
  saleNumber: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  lastError: string;
  createdBy: string;
  createdAt: string;
};

export type CreatePaymentChargePayload = {
  method: PaymentChargeMethod;
  amountCents: number;
  description?: string;
  gatewayId?: string;
  customerId?: string;
  payerName?: string;
  payerDocument?: string;
  payerEmail?: string;
  dueDays?: number | null;
};

export type PaymentChargeResult = {
  charge: PaymentChargeDto;
  message: string;
};

const requireCharge = (data: PaymentChargeDto | undefined) => {
  if (!data) throw new Error("Resposta vazia da API de cobranças.");
  return data;
};

/** Monta o src da imagem do QR Code, aceitando URL do provedor ou PNG em Base64. */
export const qrCodeImageSrc = (value: string) =>
  !value ? "" : value.startsWith("https://") ? value : `data:image/png;base64,${value}`;

export const paymentChargeService = {
  async list() {
    const response = await apiRequest<PaymentChargeDto[]>(COBRANCA_PAGAMENTO_API_URL);
    return response.data ?? [];
  },
  async create(payload: CreatePaymentChargePayload): Promise<PaymentChargeResult> {
    const response = await apiRequest<PaymentChargeDto>(COBRANCA_PAGAMENTO_API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { charge: requireCharge(response.data), message: response.message };
  },
  async get(id: string) {
    const response = await apiRequest<PaymentChargeDto>(
      `${COBRANCA_PAGAMENTO_API_URL}/${encodeURIComponent(id)}`,
    );
    return requireCharge(response.data);
  },
  async cancel(id: string): Promise<PaymentChargeResult> {
    const response = await apiRequest<PaymentChargeDto>(
      `${COBRANCA_PAGAMENTO_API_URL}/${encodeURIComponent(id)}/cancel`,
      { method: "POST" },
    );
    return { charge: requireCharge(response.data), message: response.message };
  },
};
