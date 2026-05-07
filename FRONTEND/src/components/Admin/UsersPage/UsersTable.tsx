/**
 * Arquivo: src/components/Admin/UsersPage/UsersTable.tsx
 * Objetivo: renderiza tabela/lista mobile da gestão de usuários.
 */
import { KeyRound, Pencil, Power } from "lucide-react";
import RowActionsMenu from "@/components/Admin/RowActionsMenu";
import LoadingButton from "@/components/Loading/LoadingButton";
import type { AdminUser } from "./types";
import { ROLE_LABEL, STATUS_LABEL } from "./constants";
import { formatDateTimePtBr, statusClass } from "./utils";

type UsersTableProps = {
  items: AdminUser[];
  onEdit: (user: AdminUser) => void;
  onToggleStatus: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  isActionLoading?: (user: AdminUser, action: "status" | "reset-password") => boolean;
};

export default function UsersTable({
  items,
  onEdit,
  onToggleStatus,
  onResetPassword,
  isActionLoading = () => false,
}: UsersTableProps) {
  if (items.length === 0) {
    return (
      <section className="card rounded-2xl p-6 text-center">
        <h2 className="text-base font-semibold text-text-primary">Nenhum usuário encontrado</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Ajuste os filtros para visualizar outros resultados.
        </p>
      </section>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="hidden min-w-full text-sm md:table">
        <thead>
          <tr className="bg-bg-gray-theme text-left text-text-secondary">
            <th className="px-4 py-3">Usuário</th>
            <th className="px-4 py-3">Perfil</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Último login</th>
            <th className="px-4 py-3">Segurança</th>
            <th className="px-4 py-3">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((user, index) => (
            <tr key={user.id} className="border-t border-border-primary align-top">
              <td className="px-4 py-3">
                <p className="font-semibold text-text-primary">{user.name}</p>
                <p className="text-xs text-text-secondary">{user.cpf}</p>
                <p className="text-xs text-text-secondary">{user.email}</p>
                <p className="text-xs text-text-secondary">{user.phone}</p>
              </td>
              <td className="px-4 py-3 text-text-secondary">{ROLE_LABEL[user.role]}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(user.status)}`}
                >
                  {STATUS_LABEL[user.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {formatDateTimePtBr(user.lastLoginAt)}
              </td>
              <td className="px-4 py-3">
                {user.mustChangePassword ? (
                  <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">
                    Troca pendente de senha
                  </span>
                ) : (
                  <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                    Ok
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <RowActionsMenu
                  triggerLabel="Ações do usuário"
                  forceUpwards={index === items.length - 1}
                  items={[
                    {
                      key: "edit",
                      label: "Editar",
                      icon: <Pencil size={13} />,
                      onClick: () => onEdit(user),
                    },
                    {
                      key: "status",
                      label: user.status === "ativo" ? "Inativar" : "Ativar",
                      icon: <Power size={13} />,
                      onClick: () => onToggleStatus(user),
                      loading: isActionLoading(user, "status"),
                      loadingLabel: user.status === "ativo" ? "Inativando..." : "Ativando...",
                      danger: user.status === "ativo",
                    },
                    {
                      key: "reset-password",
                      label: "Resetar senha",
                      icon: <KeyRound size={13} />,
                      onClick: () => onResetPassword(user),
                      loading: isActionLoading(user, "reset-password"),
                      loadingLabel: "Resetando...",
                    },
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-3 p-3 md:hidden">
        {items.map((user) => (
          <article key={user.id} className="rounded-xl border border-border-primary p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-text-primary">{user.name}</p>
                <p className="text-xs text-text-secondary">{user.cpf}</p>
                <p className="text-xs text-text-secondary">{user.email}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(user.status)}`}
              >
                {STATUS_LABEL[user.status]}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-text-secondary">
              <div>
                <dt>Perfil</dt>
                <dd className="font-medium text-text-primary">{ROLE_LABEL[user.role]}</dd>
              </div>
              <div>
                <dt>Último login</dt>
                <dd className="font-medium text-text-primary">
                  {formatDateTimePtBr(user.lastLoginAt)}
                </dd>
              </div>
            </dl>

            <div className="mt-3 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => onEdit(user)}
                className="btn-outline-secondary inline-flex h-9 w-9 items-center justify-center p-0"
                aria-label="Editar usuário"
              >
                <Pencil size={13} />
              </button>
              <LoadingButton
                type="button"
                onClick={() => onToggleStatus(user)}
                isLoading={isActionLoading(user, "status")}
                loadingLabel={<span className="sr-only">Alterando status</span>}
                className={`inline-flex h-9 w-9 items-center justify-center p-0 ${
                  user.status === "ativo" ? "btn-cancel" : "btn-success"
                }`}
                aria-label="Alterar status do usuário"
              >
                <Power size={13} />
              </LoadingButton>
              <LoadingButton
                type="button"
                onClick={() => onResetPassword(user)}
                isLoading={isActionLoading(user, "reset-password")}
                loadingLabel={<span className="sr-only">Resetando senha</span>}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border-primary p-0 text-text-primary transition hover:bg-hover-light"
                aria-label="Resetar senha"
              >
                <KeyRound size={13} />
              </LoadingButton>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
