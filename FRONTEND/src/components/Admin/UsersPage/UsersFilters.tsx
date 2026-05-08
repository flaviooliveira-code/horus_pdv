/**
 * Arquivo: src/components/Admin/UsersPage/UsersFilters.tsx
 * Objetivo: renderiza filtros de busca/perfil/status da gestão de usuários.
  * Entradas esperadas: recebe filtros atuais, opções de perfil/status e callbacks de alteração.
*/
import { RotateCcw } from "lucide-react";
import { SearchableSelectField } from "@/components/Form";
import type { UserRoleFilter, UserStatusFilter } from "./types";

const ROLE_FILTER_OPTIONS: Array<{ value: UserRoleFilter; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "administrador", label: "Administrador" },
  { value: "gerente", label: "Gerente" },
  { value: "atendente", label: "Atendente" },
  { value: "financeiro", label: "Financeiro" },
];

const STATUS_FILTER_OPTIONS: Array<{ value: UserStatusFilter; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "ativo", label: "Ativo" },
  { value: "inativo", label: "Inativo" },
];

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

        <SearchableSelectField
          label="Perfil"
          value={roleFilter}
          options={ROLE_FILTER_OPTIONS}
          onChange={(nextValue) => onRoleChange(nextValue as UserRoleFilter)}
          getOptionValue={(option) => option.value}
          getOptionLabel={(option) => option.label}
          placeholder="Filtrar perfil"
        />

        <SearchableSelectField
          label="Status"
          value={statusFilter}
          options={STATUS_FILTER_OPTIONS}
          onChange={(nextValue) => onStatusChange(nextValue as UserStatusFilter)}
          getOptionValue={(option) => option.value}
          getOptionLabel={(option) => option.label}
          placeholder="Filtrar status"
        />

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
