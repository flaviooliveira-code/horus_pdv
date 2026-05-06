import { apiRequest } from "./apiClient";

const CAIXA_API_URL = import.meta.env.VITE_CAIXA_API_URL ?? "http://localhost:5260/api/Caixa";

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
};

export type CashRegisterStatusDto = {
  state: "aberto" | "fechado" | "expirado" | string;
  canSell: boolean;
  blockReason: string;
  serverNow: string;
  currentSession?: CashRegisterSessionDto | null;
  lastSession?: CashRegisterSessionDto | null;
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
};
