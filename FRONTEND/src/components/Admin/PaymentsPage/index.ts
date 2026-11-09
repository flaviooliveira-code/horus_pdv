/**
 * Arquivo: src/components/Admin/PaymentsPage/index.ts
 * Objetivo: centraliza exportações dos componentes da tela de gateways de pagamento.
 * Entradas esperadas: não recebe props; apenas reexporta módulos.
 */
export { default as ChargeFormDrawer } from "./ChargeFormDrawer";
export { default as ChargesSection } from "./ChargesSection";
export { default as GatewayCard } from "./GatewayCard";
export { default as GatewayFormDrawer } from "./GatewayFormDrawer";
export { DEFAULT_FORM, PIX_ONLY_PROVIDERS } from "./constants";
export type { GatewayFormState } from "./types";
export { needsAttention, toFormState, toPayload, upsertGateway } from "./utils";
