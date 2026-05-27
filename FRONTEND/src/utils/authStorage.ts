/**
 * Arquivo: src/utils/authStorage.ts
 * Objetivo: centralizar token JWT e usuario autenticado do Hórus PDV no navegador.
  * Entradas esperadas: recebe token e dados do usuário autenticado para persistência local segura no navegador.
*/
export const AUTH_TOKEN_STORAGE_KEY = "horuspdv.auth.token";
export const AUTH_USER_STORAGE_KEY = "horuspdv.auth.user";
export const AUTH_REMEMBER_STORAGE_KEY = "horuspdv.auth.remember";

export type AuthenticatedUser = {
  id: string;
  companyId: string;
  cpf: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt: string;
  mustChangePassword: boolean;
};

export function getAuthToken() {
  return (
    window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ||
    window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
  );
}

export function getStoredAuthUser() {
  const raw =
    window.sessionStorage.getItem(AUTH_USER_STORAGE_KEY) ||
    window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthenticatedUser;
  } catch {
    window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    window.sessionStorage.removeItem(AUTH_USER_STORAGE_KEY);
    return null;
  }
}

export function setAuthSession(token: string, user: AuthenticatedUser, remember = true) {
  const primaryStorage = remember ? window.localStorage : window.sessionStorage;
  const secondaryStorage = remember ? window.sessionStorage : window.localStorage;
  secondaryStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  secondaryStorage.removeItem(AUTH_USER_STORAGE_KEY);
  primaryStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  primaryStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
  window.localStorage.setItem(AUTH_REMEMBER_STORAGE_KEY, remember ? "1" : "0");
  window.dispatchEvent(new CustomEvent("horuspdv-auth-change", { detail: { user } }));
}

export function clearAuthSession() {
  const hadSession = Boolean(getAuthToken() || getStoredAuthUser());
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_REMEMBER_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_USER_STORAGE_KEY);
  window.localStorage.removeItem("horuspdv.authenticated");
  if (hadSession) {
    window.dispatchEvent(new CustomEvent("horuspdv-auth-change"));
  }
}

export function isTokenExpired(token: string | null) {
  if (!token) return true;
  const [, payload] = token.split(".");
  if (!payload) return true;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(window.atob(normalized)) as { exp?: number };
    if (!decoded.exp) return true;
    return decoded.exp <= Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}
