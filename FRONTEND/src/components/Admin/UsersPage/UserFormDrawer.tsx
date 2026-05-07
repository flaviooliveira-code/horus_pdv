/**
 * Arquivo: src/components/Admin/UsersPage/UserFormDrawer.tsx
 * Objetivo: renderiza drawer de criação/edição de usuário no padrão do sistema.
 */
import { ShieldCheck, UserPlus, X } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { SearchableSelectField } from "@/components/Form";
import LoadingButton from "@/components/Loading/LoadingButton";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";
import type { UserRole, UserStatus } from "./types";

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "administrador", label: "Administrador" },
  { value: "gerente", label: "Gerente" },
  { value: "atendente", label: "Atendente" },
  { value: "financeiro", label: "Financeiro" },
];

const STATUS_OPTIONS: Array<{ value: UserStatus; label: string }> = [
  { value: "ativo", label: "Ativo" },
  { value: "inativo", label: "Inativo" },
];

export type UserFormState = {
  cpf: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  password: string;
  confirmPassword: string;
};

type UserFormDrawerProps = {
  open: boolean;
  isEditMode: boolean;
  form: UserFormState;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  onChange: (next: UserFormState) => void;
};

export default function UserFormDrawer({
  open,
  isEditMode,
  form,
  isSaving,
  onClose,
  onSave,
  onChange,
}: UserFormDrawerProps) {
  const { maskCpf, maskPhoneBr } = useInputMasks();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  if (!open) return null;

  const setField = <K extends keyof UserFormState>(key: K, value: UserFormState[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <div className="dept-drawer-overlay" onClick={onClose}>
      <aside className="dept-drawer-panel" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-border-primary p-5">
          <div>
            <h3 className="text-xl font-semibold text-text-primary">
              {isEditMode ? "Editar usuário" : "Novo usuário"}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              {isEditMode
                ? "Atualize dados de acesso, perfil e status."
                : "Cadastre um novo usuário com senha inicial definida pelo administrador."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
            aria-label="Fechar formulário de usuário"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <section className="card rounded-2xl p-4">
            <h4 className="text-sm font-semibold text-text-secondary">Dados do usuário</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">CPF</span>
                <input
                  value={form.cpf}
                  onChange={(event) => setField("cpf", maskCpf(event.target.value))}
                  className="input-field w-full"
                  placeholder="000.000.000-00"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">Nome</span>
                <input
                  value={form.name}
                  onChange={(event) => setField("name", event.target.value)}
                  className="input-field w-full"
                  placeholder="Nome completo"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">Telefone</span>
                <input
                  value={form.phone}
                  onChange={(event) => setField("phone", maskPhoneBr(event.target.value))}
                  className="input-field w-full"
                  placeholder="(00) 00000-0000"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">E-mail</span>
                <input
                  value={form.email}
                  onChange={(event) => setField("email", event.target.value)}
                  className="input-field w-full"
                  placeholder="usuario@empresa.com"
                />
              </label>

              <SearchableSelectField
                label="Perfil"
                value={form.role}
                options={ROLE_OPTIONS}
                onChange={(nextValue) => setField("role", nextValue as UserRole)}
                getOptionValue={(option) => option.value}
                getOptionLabel={(option) => option.label}
                placeholder="Selecione o perfil"
              />

              <SearchableSelectField
                label="Status"
                value={form.status}
                options={STATUS_OPTIONS}
                onChange={(nextValue) => setField("status", nextValue as UserStatus)}
                getOptionValue={(option) => option.value}
                getOptionLabel={(option) => option.label}
                placeholder="Selecione o status"
              />
            </div>
          </section>

          <section className="card rounded-2xl p-4">
            <h4 className="text-sm font-semibold text-text-secondary">Credenciais</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">
                  {isEditMode ? "Nova senha (opcional)" : "Senha inicial"}
                </span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) => setField("password", event.target.value)}
                    className="input-field w-full pr-10"
                    placeholder="Mínimo 8 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 rounded-md p-1 text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">Confirmar senha</span>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={(event) => setField("confirmPassword", event.target.value)}
                    className="input-field w-full pr-10"
                    placeholder="Repita a senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 rounded-md p-1 text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
                    aria-label={
                      showConfirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"
                    }
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-border-primary bg-bg-gray-theme p-3 text-xs text-text-secondary">
            <p className="inline-flex items-center gap-1 font-semibold text-text-primary">
              <ShieldCheck size={14} />
              Boas práticas
            </p>
            <p className="mt-1">
              Usuários criados devem alterar senha no primeiro acesso. Perfis administrativos
              devem ser concedidos com mínimo privilégio necessário.
            </p>
          </section>
        </div>

        <div className="border-t border-border-primary p-4">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancelar
            </button>
            <LoadingButton
              type="button"
              onClick={onSave}
              isLoading={isSaving}
              loadingLabel="Salvando..."
              className="btn-primary inline-flex items-center justify-center gap-1.5"
            >
              <UserPlus size={15} />
              {isEditMode ? "Salvar usuário" : "Criar usuário"}
            </LoadingButton>
          </div>
        </div>
      </aside>
    </div>
  );
}
