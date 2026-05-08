/**
 * Arquivo: src/components/Admin/UsersPage/constants.ts
 * Objetivo: concentra labels da tela de usuários.
  * Entradas esperadas: não recebe props; exporta constantes textuais e opções usadas pela feature.
*/
import type { UserRole, UserStatus } from "./types";

export const ROLE_LABEL: Record<UserRole, string> = {
  administrador: "Administrador",
  gerente: "Gerente",
  atendente: "Atendente",
  financeiro: "Financeiro",
};

export const STATUS_LABEL: Record<UserStatus, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
};
