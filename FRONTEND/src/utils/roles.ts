/**
 * Arquivo: src/utils/roles.ts
 * Objetivo: centraliza as regras de perfil usadas pelas telas (espelha HorusRoles e as restrições da API).
 * Entradas esperadas: recebe o perfil do usuário autenticado (AuthenticatedUser.role).
 */
import { getStoredAuthUser } from "./authStorage";

/** Perfis que veem saldo esperado de caixa aberto e relatórios contábeis (lucro, CMV, DRE). */
export const SUPERVISORY_ROLES = new Set(["administrador", "gerente", "financeiro"]);

/** Perfis que podem lançar despesas operacionais (DespesasController). */
export const EXPENSE_MANAGER_ROLES = new Set(["administrador", "gerente"]);

/** Perfis que podem alterar no caixa o preço de produto com preço cadastrado (espelha HistoricoVendasAB). */
export const PRICE_OVERRIDE_ROLES = new Set(["administrador", "gerente"]);

export function normalizeRole(role?: string | null) {
  return (role ?? "").trim().toLowerCase();
}

export function isSupervisorRole(role?: string | null) {
  return SUPERVISORY_ROLES.has(normalizeRole(role));
}

export function canManageExpenses(role?: string | null) {
  return EXPENSE_MANAGER_ROLES.has(normalizeRole(role));
}

export function canOverrideFixedPrice(role?: string | null) {
  return PRICE_OVERRIDE_ROLES.has(normalizeRole(role));
}

export function getStoredUserRole() {
  return typeof window === "undefined" ? "" : normalizeRole(getStoredAuthUser()?.role);
}
