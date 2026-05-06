import { apiRequest } from "./apiClient";
import type { AuthenticatedUser } from "@/utils/authStorage";

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL ?? "http://localhost:5260/api/Auth";

export type LoginPayload = {
  email: string;
  password: string;
  rememberMe: boolean;
};

export type LoginResponse = {
  token: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  sessionId: string;
  user: AuthenticatedUser;
};

export const authService = {
  async login(payload: LoginPayload) {
    const response = await apiRequest<LoginResponse>(`${AUTH_API_URL}/login`, {
      method: "POST",
      body: JSON.stringify(payload),
      skipAuth: true,
    });
    return response.data;
  },

  async me() {
    const response = await apiRequest<AuthenticatedUser>(`${AUTH_API_URL}/me`);
    return response.data;
  },

  async logout() {
    await apiRequest<object>(`${AUTH_API_URL}/logout`, { method: "POST" });
  },

  async changePassword(currentPassword: string, nextPassword: string) {
    await apiRequest<object>(`${AUTH_API_URL}/change-password`, {
      method: "POST",
      body: JSON.stringify({ currentPassword, nextPassword }),
    });
  },
};
