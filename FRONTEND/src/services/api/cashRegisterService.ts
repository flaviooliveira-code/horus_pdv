/**
 * Arquivo: src/services/api/cashRegisterService.ts
 * Objetivo: encapsula chamadas HTTP de abertura, sangria, suprimento, fechamento cego, espelho Z e balanço diário.
 * Entradas esperadas: recebe payloads já validados pelas telas e retorna respostas tipadas da API.
 */
import { apiRequest } from "./apiClient";

const CAIXA_API_URL = import.meta.env.VITE_CAIXA_API_URL ?? "http://localhost:5260/api/Caixa";

export type CashMovementType =
  | "ABERTURA"
  | "SANGRIA"
  | "SUPRIMENTO"
  | "VENDA"
  | "DEVOLUCAO"
  | string;

export type CashMovementDto = {
  id: string;
  companyId: string;
  caixaSessaoId: string;
  tipo: CashMovementType;
  formaPagamento: string;
  valor: number;
  descricao: string;
  saleNumber?: string | null;
  usuarioId: string;
  usuarioName: string;
  dataHora: string;
};

export type CashRegisterSessionDto = {
  id: string;
  status: string;
  openedAt: string;
  closedAt?: string | null;
  openingAmount: string;
  closingAmount: string;
  operatorName: string;
  closedByName: string;
  note: string;
  elapsedMinutes: number;
  expectedCashAmount?: number | null;
  countedCashAmount?: number | null;
  cashDifference?: number | null;
  salesCashTotal?: number | null;
  salesPixTotal?: number | null;
  salesDebitTotal?: number | null;
  salesCreditTotal?: number | null;
  totalSuprimentos?: number | null;
  totalSangrias?: number | null;
  salesCount?: number | null;
  blindClosing?: boolean;
};

export type CashRegisterStatusDto = {
  state: "aberto" | "fechado" | "expirado" | string;
  canSell: boolean;
  blockReason: string;
  serverNow: string;
  currentSession?: CashRegisterSessionDto | null;
  lastSession?: CashRegisterSessionDto | null;
  history: CashRegisterSessionDto[];
  currentMovements?: CashMovementDto[];
};

export type CloseCashRegisterPayload = {
  closingAmount: string | number;
  countedPixAmount?: string | number | null;
  countedDebitAmount?: string | number | null;
  countedCreditAmount?: string | number | null;
  blindClosing?: boolean;
  note?: string;
};

export type CaixaSessionSummaryDto = {
  id: string;
  status: string;
  openedAt: string;
  closedAt?: string | null;
  openingAmount: string;
  closingAmount: string;
  openingAmountDecimal: number;
  operatorName: string;
  closedByName: string;
  note: string;
  elapsedMinutes: number;
  blindClosing: boolean;
  expectedCashAmount: number;
  countedCashAmount: number;
  cashDifference: number;
  differenceStatus: "EXATO" | "SOBRA" | "QUEBRA" | "ABERTO" | string;
  salesCashTotal: number;
  salesPixTotal: number;
  salesDebitTotal: number;
  salesCreditTotal: number;
  countedPixAmount?: number | null;
  countedDebitAmount?: number | null;
  countedCreditAmount?: number | null;
  totalSalesAmount: number;
  salesCount: number;
  ticketMedio: number;
  totalSuprimentos: number;
  totalSangrias: number;
  cashReturns: number;
  movements: CashMovementDto[];
};

export type DailyBalanceDto = {
  date: string;
  sessionsCount: number;
  openSessionsCount: number;
  closedSessionsCount: number;
  totalOpeningAmount: number;
  totalExpectedCashAmount: number;
  totalCountedCashAmount: number;
  totalCashDifference: number;
  totalSuprimentos: number;
  totalSangrias: number;
  totalCashReturns: number;
  salesCashTotal: number;
  salesPixTotal: number;
  salesDebitTotal: number;
  salesCreditTotal: number;
  totalSalesAmount: number;
  salesCount: number;
  ticketMedio: number;
  sessions: CaixaSessionSummaryDto[];
};

export const cashRegisterService = {
  async status() {
    const response = await apiRequest<CashRegisterStatusDto>(`${CAIXA_API_URL}/status`);
    return response.data;
  },
  async open(openingAmount: string | number) {
    const response = await apiRequest<CashRegisterStatusDto>(`${CAIXA_API_URL}/abrir`, {
      method: "POST",
      body: JSON.stringify({ openingAmount }),
    });
    return response.data;
  },
  async sangria(amount: string | number, description: string) {
    const response = await apiRequest<CashMovementDto>(`${CAIXA_API_URL}/sangria`, {
      method: "POST",
      body: JSON.stringify({ amount, description }),
    });
    return response.data;
  },
  async suprimento(amount: string | number, description: string) {
    const response = await apiRequest<CashMovementDto>(`${CAIXA_API_URL}/suprimento`, {
      method: "POST",
      body: JSON.stringify({ amount, description }),
    });
    return response.data;
  },
  async close(closingAmount: string, note = "") {
    return this.closeDetailed({ closingAmount, note });
  },
  async closeDetailed(payload: CloseCashRegisterPayload) {
    const response = await apiRequest<CaixaSessionSummaryDto>(`${CAIXA_API_URL}/fechar`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.data;
  },
  async getSessionSummary(sessionId: string) {
    const response = await apiRequest<CaixaSessionSummaryDto>(
      `${CAIXA_API_URL}/sessao/${encodeURIComponent(sessionId)}/resumo`,
    );
    return response.data;
  },
  async getDailyBalance(date?: string) {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    const response = await apiRequest<DailyBalanceDto>(`${CAIXA_API_URL}/balanco-diario${query}`);
    return response.data;
  },
};
