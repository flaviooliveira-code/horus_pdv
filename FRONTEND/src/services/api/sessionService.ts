import type { ActiveSession } from "@/components/SettingsPage";
import { apiRequest } from "./apiClient";

const SESSOES_API_URL =
  import.meta.env.VITE_SESSOES_API_URL ?? "http://localhost:5260/api/Sessao";

export const sessionService = {
  async list() {
    const response = await apiRequest<ActiveSession[]>(SESSOES_API_URL);
    return response.data ?? [];
  },
  async terminate(sessionId: string) {
    const response = await apiRequest<ActiveSession[]>(`${SESSOES_API_URL}/${sessionId}`, {
      method: "DELETE",
    });
    return response.data ?? [];
  },
  async terminateOthers() {
    const response = await apiRequest<ActiveSession[]>(`${SESSOES_API_URL}/outras`, {
      method: "DELETE",
    });
    return response.data ?? [];
  },
};
