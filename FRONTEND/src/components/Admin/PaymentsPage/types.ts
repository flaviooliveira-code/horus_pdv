/**
 * Arquivo: src/components/Admin/PaymentsPage/types.ts
 * Objetivo: tipa o estado do formulário de gateways de pagamento.
 * Entradas esperadas: não recebe props; campos numéricos ficam como texto até o envio.
 */
import type {
  PaymentGatewayEnvironment,
  PaymentGatewayProvider,
} from "@/services/api/paymentGatewayService";

export type GatewayFormState = {
  provider: PaymentGatewayProvider;
  name: string;
  environment: PaymentGatewayEnvironment;
  active: boolean;
  defaultPix: boolean;
  defaultBoleto: boolean;
  pixOnly: boolean;
  generateBoletoPix: boolean;
  accessToken: string;
  publicKey: string;
  webhookSecret: string;
  webhookResponsibleEmail: string;
  boletoDueDays: string;
  finePercent: string;
  monthlyInterestPercent: string;
};

export type Tone = "success" | "danger" | "info" | "muted" | "brand";
