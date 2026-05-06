/**
 * Arquivo: src/services/api/apiClient.ts
 * Objetivo: centralizar chamadas HTTP para a API .NET do Hórus PDV.
 */
import { clearAuthSession, getAuthToken } from "@/utils/authStorage";

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  details?: string;
  data?: T;
};

type ApiRequestOptions = RequestInit & {
  skipAuth?: boolean;
};

export async function apiRequest<T>(
  endpointUrl: string,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
  const { skipAuth, headers, ...requestOptions } = options;
  const token = skipAuth ? null : getAuthToken();
  const response = await fetch(endpointUrl, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...requestOptions,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as ApiResponse<T>)
    : ({
        success: response.ok,
        message: response.ok ? "Operação concluída." : "Erro ao comunicar com a API.",
      } as ApiResponse<T>);

  if (response.status === 401) {
    clearAuthSession();
  }

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "Erro ao comunicar com a API.");
  }

  return payload;
}
