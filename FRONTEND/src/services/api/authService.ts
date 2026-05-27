/**
 * Arquivo: src/services/api/authService.ts
 * Objetivo: encapsula chamadas HTTP de autenticação, cadastro e recuperação de senha.
 * Entradas esperadas: recebe payloads já validados pelas telas e retorna respostas tipadas da API.
 */
import { apiRequest } from "./apiClient";
import type { AuthenticatedUser } from "@/utils/authStorage";

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL ?? "http://localhost:5260/api/Auth";

export type LoginPayload = {
  email: string;
  password: string;
  rememberMe: boolean;
  recaptchaToken?: string;
};

export type LoginResponse = {
  token: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  sessionId: string;
  user: AuthenticatedUser;
};

export type RegisterPayload = {
  cnpj: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  recaptchaToken?: string;
};

export type ForgotPasswordResponse = {
  accepted: boolean;
  maskedEmail?: string;
  resetToken?: string;
  expiresAt?: string;
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

  async updateMe(payload: { name: string; email: string; phone: string }) {
    const response = await apiRequest<AuthenticatedUser>(`${AUTH_API_URL}/me`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
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

  async forgotPassword(cnpj: string, email: string, recaptchaToken?: string) {
    const response = await apiRequest<ForgotPasswordResponse>(`${AUTH_API_URL}/forgot-password`, {
      method: "POST",
      body: JSON.stringify({ cnpj, email, recaptchaToken }),
      skipAuth: true,
    });
    return response.data;
  },

  async resetPassword(token: string, nextPassword: string, confirmPassword: string, recaptchaToken?: string) {
    await apiRequest<AuthenticatedUser>(`${AUTH_API_URL}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ token, nextPassword, confirmPassword, recaptchaToken }),
      skipAuth: true,
    });
  },

  async register(payload: RegisterPayload) {
    const response = await apiRequest<AuthenticatedUser>(`${AUTH_API_URL}/register`, {
      method: "POST",
      body: JSON.stringify(payload),
      skipAuth: true,
    });
    return response.data;
  },
};
