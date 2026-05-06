import { apiRequest } from "./apiClient";

const HOME_API_URL = import.meta.env.VITE_HOME_API_URL ?? "http://localhost:5260/api/Home";

export type HomeKpiDto = {
  label: string;
  value: string;
  helper: string;
  color: string;
  trend: number[];
};

export const homeService = {
  async get() {
    const response = await apiRequest<{ cards: HomeKpiDto[] }>(HOME_API_URL);
    return response.data;
  },
};
