/**
 * Arquivo: src/components/Admin/UsersPage/utils.ts
 * Objetivo: utilitários para normalização e ids da tela de usuários.
 */
import type { AdminUser } from "./types";

export function statusClass(status: AdminUser["status"]) {
  return status === "ativo"
    ? "border border-success/30 bg-success/15 text-success"
    : "border border-primary/30 bg-primary/15 text-primary";
}

export function buildUserId() {
  return `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function formatDateTimePtBr(value: string) {
  if (!value || value === "-") return "Sem acesso";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem acesso";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}
