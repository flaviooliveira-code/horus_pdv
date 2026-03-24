/**
 * Arquivo: src/components/Admin/UsersPage/types.ts
 * Objetivo: centraliza tipos da tela de usuários administrativos.
 */
export type UserRole = "administrador" | "gerente" | "atendente" | "financeiro";
export type UserStatus = "ativo" | "inativo";

export type AdminUser = {
  id: string;
  cpf: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string;
  mustChangePassword: boolean;
};

export type UserRoleFilter = UserRole | "todos";
export type UserStatusFilter = UserStatus | "todos";
