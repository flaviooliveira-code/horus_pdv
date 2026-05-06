import type { ReportFilterValues, ReportResultColumn, ReportResultRow } from "@/components/Admin/ReportsPage/reportResultTypes";
import { apiRequest } from "./apiClient";

const RELATORIOS_API_URL =
  import.meta.env.VITE_RELATORIOS_API_URL ?? "http://localhost:5260/api/Relatorio";

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
};
