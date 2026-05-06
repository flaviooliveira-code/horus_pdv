import type { MarketModuleConfig, MarketModuleRecordPayload } from "@/components/Admin/MarketModulePage";
import { apiRequest } from "./apiClient";

const MODULOS_MERCADO_API_URL =
  import.meta.env.VITE_MODULOS_MERCADO_API_URL ?? "http://localhost:5260/api/ModuloMercado";

export const marketModuleService = {
  async get(id: string) {
    const response = await apiRequest<MarketModuleConfig>(`${MODULOS_MERCADO_API_URL}/${id}`);
    return response.data;
  },
  async createRecord(id: string, payload: MarketModuleRecordPayload) {
    const response = await apiRequest<MarketModuleConfig>(`${MODULOS_MERCADO_API_URL}/${id}/registros`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.data;
  },
  async updateRecord(id: string, recordId: string, payload: MarketModuleRecordPayload) {
    const response = await apiRequest<MarketModuleConfig>(
      `${MODULOS_MERCADO_API_URL}/${id}/registros/${recordId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );
    return response.data;
  },
  async removeRecord(id: string, recordId: string) {
    const response = await apiRequest<MarketModuleConfig>(
      `${MODULOS_MERCADO_API_URL}/${id}/registros/${recordId}`,
      { method: "DELETE" },
    );
    return response.data;
  },
};
