/**
 * Arquivo: src/services/api/reportService.ts
 * Objetivo: encapsula chamadas HTTP de geração de relatórios operacionais e gestão de despesas operacionais (DRE).
 * Entradas esperadas: recebe payloads já validados pelas telas e retorna respostas tipadas da API.
 */
import type { ReportFilterValues, ReportResultColumn, ReportResultRow } from "@/components/Admin/ReportsPage/reportResultTypes";
import { apiRequest } from "./apiClient";

const RELATORIOS_API_URL =
  import.meta.env.VITE_RELATORIOS_API_URL ?? "http://localhost:5260/api/Relatorio";
const DESPESAS_API_URL =
  import.meta.env.VITE_DESPESAS_API_URL ?? "http://localhost:5260/api/Despesas";

export type OperationalExpenseDto = {
  id: string;
  description: string;
  category: string;
  amount: string;
  competenceDate: string;
  dueDate: string;
  paidDate?: string | null;
  status: "Pago" | "Pendente" | string;
  paymentMethod: string;
  observation: string;
};

export type OperationalExpensePayload = Omit<OperationalExpenseDto, "id">;

export const reportService = {
  async generate(reportId: string, filters: ReportFilterValues) {
    const response = await apiRequest<{
      columns: ReportResultColumn[];
      rows: ReportResultRow[];
    }>(`${RELATORIOS_API_URL}/Gerar`, {
      method: "POST",
      body: JSON.stringify({ reportId, filters }),
    });
    return response.data ?? { columns: [], rows: [] };
  },
  async listExpenses() {
    const response = await apiRequest<OperationalExpenseDto[]>(DESPESAS_API_URL);
    return response.data ?? [];
  },
  async createExpense(payload: OperationalExpensePayload) {
    const response = await apiRequest<OperationalExpenseDto>(DESPESAS_API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.data;
  },
  async updateExpense(id: string, payload: OperationalExpensePayload) {
    const response = await apiRequest<OperationalExpenseDto>(`${DESPESAS_API_URL}/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return response.data;
  },
  async removeExpense(id: string) {
    await apiRequest<object>(`${DESPESAS_API_URL}/${id}`, { method: "DELETE" });
  },
};

