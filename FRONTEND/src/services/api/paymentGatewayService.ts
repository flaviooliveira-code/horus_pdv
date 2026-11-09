/**
 * Arquivo: src/services/api/paymentGatewayService.ts
 * Objetivo: encapsula chamadas HTTP do cadastro de gateways de pagamento (Asaas, Mercado Pago e PagBank).
 * Entradas esperadas: recebe payloads do drawer de gateways; a API devolve credenciais apenas mascaradas.
 */
import { apiRequest } from "./apiClient";

const GATEWAY_PAGAMENTO_API_URL =
  import.meta.env.VITE_GATEWAY_PAGAMENTO_API_URL ??
  "http://localhost:5260/api/GatewayPagamento";

export type PaymentGatewayProvider = "ASAAS" | "MERCADO_PAGO" | "PAGBANK";
export type PaymentGatewayEnvironment = "PRODUCTION" | "SANDBOX";
export type PaymentGatewayStatus = "OK" | "PENDING" | "ERROR" | "DISABLED";

export type PaymentGatewayDto = {
  id: string;
  provider: PaymentGatewayProvider;
  name: string;
  environment: PaymentGatewayEnvironment;
  active: boolean;
  defaultPix: boolean;
  defaultBoleto: boolean;
  pixOnly: boolean;
  generateBoletoPix: boolean;
  accessTokenMask: string;
  publicKey: string;
  webhookSecretMask: string;
  webhookResponsibleEmail: string;
  boletoDueDays: number | null;
  finePercent: number | null;
  monthlyInterestPercent: number | null;
  status: PaymentGatewayStatus;
  lastValidatedAt: string | null;
  lastValidationMessage: string;
  createdAt: string;
  updatedAt: string;
  webhookLastEventAt: string | null;
};

export type PaymentGatewayPayload = {
  provider: PaymentGatewayProvider;
  name: string;
  environment: PaymentGatewayEnvironment;
  active: boolean;
  defaultPix: boolean;
  defaultBoleto: boolean;
  pixOnly: boolean;
  generateBoletoPix: boolean;
  /** Em branco mantém a credencial já salva. */
  accessToken: string;
  publicKey: string;
  /** Em branco mantém a assinatura já salva. */
  webhookSecret: string;
  webhookResponsibleEmail: string;
  boletoDueDays: number | null;
  finePercent: number | null;
  monthlyInterestPercent: number | null;
};

export type PaymentGatewayValidation = {
  gateway: PaymentGatewayDto;
  message: string;
};

const requireData = <T>(data: T | undefined): T => {
  if (data === undefined || data === null) {
    throw new Error("Resposta vazia da API de gateways.");
  }
  return data;
};

export const paymentGatewayService = {
  async list() {
    const response = await apiRequest<PaymentGatewayDto[]>(GATEWAY_PAGAMENTO_API_URL);
    return response.data ?? [];
  },
  async create(payload: PaymentGatewayPayload) {
    const response = await apiRequest<PaymentGatewayDto>(GATEWAY_PAGAMENTO_API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return requireData(response.data);
  },
  async update(id: string, payload: PaymentGatewayPayload) {
    const response = await apiRequest<PaymentGatewayDto>(
      `${GATEWAY_PAGAMENTO_API_URL}/${encodeURIComponent(id)}`,
      { method: "PUT", body: JSON.stringify(payload) },
    );
    return requireData(response.data);
  },
  async validate(id: string): Promise<PaymentGatewayValidation> {
    const response = await apiRequest<PaymentGatewayDto>(
      `${GATEWAY_PAGAMENTO_API_URL}/${encodeURIComponent(id)}/validate`,
      { method: "POST" },
    );
    return { gateway: requireData(response.data), message: response.message };
  },
  async remove(id: string) {
    await apiRequest<null>(`${GATEWAY_PAGAMENTO_API_URL}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};
