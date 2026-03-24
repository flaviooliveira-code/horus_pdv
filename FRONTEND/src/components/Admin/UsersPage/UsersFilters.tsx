/**
 * Arquivo: src/components/Admin/UsersPage/UsersFilters.tsx
 * Objetivo: renderiza filtros de busca/perfil/status da gestão de usuários.
 */
import { RotateCcw } from "lucide-react";
import type { UserRoleFilter, UserStatusFilter } from "./types";

type UsersFiltersProps = {
  searchTerm: string;
  roleFilter: UserRoleFilter;
  statusFilter: UserStatusFilter;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  showResetFeedback: boolean;
  onSearchChange: (value: string) => void;
  onRoleChange: (value: UserRoleFilter) => void;
  onStatusChange: (value: UserStatusFilter) => void;
  onResetFilters: () => void;
};

export default function UsersFilters({
  searchTerm,
  roleFilter,
  statusFilter,
  hasActiveFilters,
  activeFilterCount,
  showResetFeedback,
  onSearchChange,
  onRoleChange,
  onStatusChange,
  onResetFilters,
}: UsersFiltersProps) {
  return (
    <section className="card rounded-2xl p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <label>
          <span className="mb-1.5 block text-sm text-text-secondary">Buscar</span>
          <input
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Nome, e-mail ou telefone"
            className="input-field w-full"
          />
        </label>

        <label>
          <span className="mb-1.5 block text-sm text-text-secondary">Perfil</span>
          <select
            value={roleFilter}
            onChange={(event) => onRoleChange(event.target.value as UserRoleFilter)}
            className="select-field w-full"
          >
            <option value="todos">Todos</option>
            <option value="administrador">Administrador</option>
            <option value="gerente">Gerente</option>
            <option value="atendente">Atendente</option>
            <option value="financeiro">Financeiro</option>
          </select>
        </label>

        <label>
          <span className="mb-1.5 block text-sm text-text-secondary">Status</span>
          <select
            value={statusFilter}
            onChange={(event) => onStatusChange(event.target.value as UserStatusFilter)}
            className="select-field w-full"
          >
            <option value="todos">Todos</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={onResetFilters}
            disabled={!hasActiveFilters}
            className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
              hasActiveFilters
                ? "border-secondary/30 bg-secondary/8 text-secondary hover:bg-secondary/14"
                : "cursor-not-allowed border-border-primary bg-bg-gray-theme text-text-tertiary"
            }`}
          >
            <RotateCcw size={15} />
            {hasActiveFilters ? `Limpar filtros (${activeFilterCount})` : "Limpar filtros"}
          </button>
        </div>
      </div>

      {showResetFeedback && (
        <p className="mt-2 text-xs font-medium text-success">
          Filtros limpos com sucesso.
        </p>
      )}
    </section>
  );
}
