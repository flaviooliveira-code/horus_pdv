/**
 * Arquivo: src/services/api/cashRegisterService.ts
 * Objetivo: encapsula chamadas HTTP de abertura, fechamento, sangria, suprimento e balanço diário de caixa.
 * Entradas esperadas: recebe payloads já validados pelas telas e retorna respostas tipadas da API.
 */
import { apiRequest } from "./apiClient";

const CAIXA_API_URL = import.meta.env.VITE_CAIXA_API_URL ?? "http://localhost:5260/api/Caixa";

export type CashRegisterSessionDto = {
  id: string;
  status: string;
  openedAt: string;
  closedAt?: string | null;
  openingAmount: string;
  closingAmount: string;
  expectedAmount?: string;
  differenceAmount?: string;
  differenceStatus?: "CONFERIDO" | "SOBRA" | "QUEBRA" | string;
  totalCashSales?: string;
  totalSupplies?: string;
  totalWithdrawals?: string;
  operatorName: string;
  closedByName: string;
  note: string;
  elapsedMinutes: number;
};

export type CashRegisterMovementDto = {
  id: string;
  caixaSessaoId: string;
  tipo: "ABERTURA" | "SUPRIMENTO" | "SANGRIA" | "VENDA" | "FECHAMENTO" | string;
  formaPagamento: string;
  valor: string;
  descricao: string;
  operatorId: string;
  operatorName: string;
  createdAt: string;
};

export type CashRegisterPaymentBreakdownDto = {
  formaPagamento: string;
  quantidadeVendas: number;
  totalVendido: string;
  percentual: number;
};

export type CashRegisterDailyBalanceDto = {
  caixaSessaoId: string;
  status: string;
  openedAt: string;
  closedAt?: string | null;
  operatorName: string;
  openingAmount: string;
  totalCashSales: string;
  totalPixSales: string;
  totalDebitSales: string;
  totalCreditSales: string;
  totalOtherSales: string;
  totalSalesAmount: string;
  totalSalesCount: number;
  averageTicket: string;
  totalSupplies: string;
  totalWithdrawals: string;
  expectedCashAmount: string;
  countedCashAmount?: string | null;
  differenceAmount: string;
  differenceStatus: "CONFERIDO" | "SOBRA" | "QUEBRA" | string;
  paymentBreakdown: CashRegisterPaymentBreakdownDto[];
};

export type CashRegisterStatusDto = {
  state: "aberto" | "fechado" | "expirado" | string;
  canSell: boolean;
  blockReason: string;
  serverNow: string;
  currentSession?: CashRegisterSessionDto | null;
  lastSession?: CashRegisterSessionDto | null;
  currentBalance?: CashRegisterDailyBalanceDto | null;
  movements?: CashRegisterMovementDto[];
  history: CashRegisterSessionDto[];
};

export const cashRegisterService = {
  async status() {
    const response = await apiRequest<CashRegisterStatusDto>(`${CAIXA_API_URL}/status`);
    return response.data;
  },
  async open(openingAmount: string) {
    const response = await apiRequest<CashRegisterStatusDto>(`${CAIXA_API_URL}/abrir`, {
      method: "POST",
      body: JSON.stringify({ openingAmount }),
    });
    return response.data;
  },
  async close(closingAmount: string, note = "") {
    const response = await apiRequest<CashRegisterStatusDto>(`${CAIXA_API_URL}/fechar`, {
      method: "POST",
      body: JSON.stringify({ closingAmount, note }),
    });
    return response.data;
  },
  async registerSangria(amount: string, reason: string) {
    const response = await apiRequest<CashRegisterStatusDto>(`${CAIXA_API_URL}/sangria`, {
      method: "POST",
      body: JSON.stringify({ amount, reason }),
    });
    return response.data;
  },
  async registerSuprimento(amount: string, reason: string) {
    const response = await apiRequest<CashRegisterStatusDto>(`${CAIXA_API_URL}/suprimento`, {
      method: "POST",
      body: JSON.stringify({ amount, reason }),
    });
    return response.data;
  },
  async getDailyBalance(sessionId?: string) {
    const query = sessionId ? `?sessaoId=${encodeURIComponent(sessionId)}` : "";
    const response = await apiRequest<CashRegisterDailyBalanceDto | null>(
      `${CAIXA_API_URL}/balanco${query}`,
    );
    return response.data;
  },
  async listMovements(sessionId?: string) {
    const query = sessionId ? `?sessaoId=${encodeURIComponent(sessionId)}` : "";
    const response = await apiRequest<CashRegisterMovementDto[]>(
      `${CAIXA_API_URL}/movimentacoes${query}`,
    );
    return response.data ?? [];
  },
};

