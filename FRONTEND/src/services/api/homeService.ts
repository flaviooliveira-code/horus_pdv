/**
 * Arquivo: src/services/api/homeService.ts
 * Objetivo: encapsula chamadas HTTP dos indicadores e atalhos da página inicial.
 * Entradas esperadas: recebe payloads já validados pelas telas e retorna respostas tipadas da API.
 */
import { apiRequest } from "./apiClient";

const HOME_API_URL = import.meta.env.VITE_HOME_API_URL ?? "http://localhost:5260/api/Home";

export type HomeKpiDto = {
  label: string;
  value: string;
  helper: string;
  color: string;
  trend: number[];
};

export type HomeExpiringProductDto = {
  id: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitType: string;
  unitCostPrice: number;
  salePrice: number;
  unitCostFormatted: string;
  salePriceFormatted: string;
  expirationDate: string;
  expirationMode: string;
  expirationStatus: "EXPIRING_SOON" | "EXPIRED";
  daysUntilExpiration: number;
  canApplyCostPrice: boolean;
  alreadyAtCostPrice: boolean;
};

export const homeService = {
  async get() {
    const response = await apiRequest<{
      cards: HomeKpiDto[];
      expiringProducts?: HomeExpiringProductDto[];
    }>(HOME_API_URL);
    return response.data;
  },
};
