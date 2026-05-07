/**
 * Arquivo: src/pages/Admin/UsersPage.tsx
 * Objetivo: orquestra estado, filtros, paginação e ações da gestão de usuários.
 */
/* eslint-disable react-hooks/set-state-in-effect */
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import PageHeader from "@/components/Admin/PageHeader";
import {
  DeactivateUserReasonDialog,
  type AdminUser,
  type UserFormState,
  type UserRoleFilter,
  type UserStatus,
  type UserStatusFilter,
} from "@/components/Admin/UsersPage";
import { normalizeText } from "@/components/Admin/UsersPage/utils";
import TablePagination from "@/components/Pagination/TablePagination";
import { useStatusDialog } from "@/hooks/Dialog";
import LoadingBar from "@/components/Loading/LoadingBar";
import PageLayout from "@/layout/PageLayout";
import { userService } from "@/services/api/userService";
import { onlyDigits } from "@/utils/inputMasks";

const UsersFilters = lazy(() => import("@/components/Admin/UsersPage/UsersFilters"));
const UsersTable = lazy(() => import("@/components/Admin/UsersPage/UsersTable"));
const UserFormDrawer = lazy(() => import("@/components/Admin/UsersPage/UserFormDrawer"));

function defaultForm(): UserFormState {
  return {
    cpf: "",
    name: "",
    email: "",
    phone: "",
    role: "atendente",
    status: "ativo",
    password: "",
    confirmPassword: "",
  };
}

function toInputForm(user: AdminUser): UserFormState {
  return {
    cpf: user.cpf,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    password: "",
    confirmPassword: "",
  };
}

export default function UserAccountsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter>("todos");
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [showResetFeedback, setShowResetFeedback] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>(defaultForm);
  const [pendingDeactivateUser, setPendingDeactivateUser] = useState<AdminUser | null>(null);
  const [deactivationReason, setDeactivationReason] = useState("");

  const statusDialog = useStatusDialog();
  const isEditMode = editingUserId !== null;
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim().length > 0) count += 1;
    if (roleFilter !== "todos") count += 1;
    if (statusFilter !== "todos") count += 1;
    return count;
  }, [searchTerm, roleFilter, statusFilter]);
  const hasActiveFilters = activeFilterCount > 0;

  useEffect(() => {
    userService.list().then(setUsers).catch(() => setUsers([]));
  }, []);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);

    return users.filter((user) => {
      const roleMatches = roleFilter === "todos" || user.role === roleFilter;
      const statusMatches = statusFilter === "todos" || user.status === statusFilter;
      const searchable = normalizeText(
        `${user.cpf} ${user.name} ${user.email} ${user.phone}`,
      );
      const searchMatches =
        normalizedSearch.length === 0 || searchable.includes(normalizedSearch);
      return roleMatches && statusMatches && searchMatches;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredUsers, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, statusFilter]);

  useEffect(() => {
    setIsLoading(true);
    const timeoutId = window.setTimeout(() => setIsLoading(false), 140);
    return () => window.clearTimeout(timeoutId);
  }, [filteredUsers, currentPage, itemsPerPage]);

  useEffect(() => {
    if (!showResetFeedback) return;
    const timeoutId = window.setTimeout(() => setShowResetFeedback(false), 1400);
    return () => window.clearTimeout(timeoutId);
  }, [showResetFeedback]);

  const resetFilters = () => {
    if (!hasActiveFilters) return;
    setSearchTerm("");
    setRoleFilter("todos");
    setStatusFilter("todos");
    setCurrentPage(1);
    setShowResetFeedback(true);
  };

  const openCreateDrawer = () => {
    setEditingUserId(null);
    setForm(defaultForm());
    setDrawerOpen(true);
  };

  const openEditDrawer = (user: AdminUser) => {
    setEditingUserId(user.id);
    setForm(toInputForm(user));
    setDrawerOpen(true);
  };

  const resetPassword = async (user: AdminUser) => {
    const confirmed = await statusDialog.confirm(
      `Resetar senha de ${user.name} para uma senha provisória?`,
    );
    if (!confirmed) return;

    try {
      const result = await userService.resetPassword(user.id);
      if (!result) return;
      setUsers((current) => current.map((item) => (item.id === user.id ? result.user : item)));
      statusDialog.success(`Senha de ${user.name} resetada. Senha provisória: ${result.password}`);
    } catch (error) {
      statusDialog.error(error instanceof Error ? error.message : "Erro ao resetar senha.");
    }
  };

  const toggleStatus = async (user: AdminUser) => {
    if (user.status === "ativo") {
      setPendingDeactivateUser(user);
      setDeactivationReason("");
      return;
    }

    const nextStatus: UserStatus = "ativo";
    const confirmed = await statusDialog.confirm(`Deseja realmente ativar usuário ${user.name}?`, {
      confirmIntent: "success",
    });
    if (!confirmed) return;

    try {
      const updated = await userService.updateStatus(user.id, nextStatus);
      if (updated) {
        setUsers((current) => current.map((item) => (item.id === user.id ? updated : item)));
      }
      statusDialog.success(`Usuário ${user.name} ativado.`);
    } catch (error) {
      statusDialog.error(error instanceof Error ? error.message : "Erro ao ativar usuário.");
    }
  };

  const handleConfirmDeactivateUser = async () => {
    if (!pendingDeactivateUser) return;
    const reasonLength = deactivationReason.trim().length;
    if (reasonLength < 10) return;

    try {
      const updated = await userService.updateStatus(pendingDeactivateUser.id, "inativo");
      if (updated) {
        setUsers((current) =>
          current.map((item) => (item.id === pendingDeactivateUser.id ? updated : item)),
        );
      }
      statusDialog.success(
        `Usuário ${pendingDeactivateUser.name} inativado com justificativa registrada.`,
      );
    } catch (error) {
      statusDialog.error(error instanceof Error ? error.message : "Erro ao inativar usuário.");
    }
    setPendingDeactivateUser(null);
    setDeactivationReason("");
  };

  const validateForm = () => {
    const cpfDigits = onlyDigits(form.cpf);
    if (cpfDigits.length !== 11) return "Informe um CPF válido.";
    if (!form.name.trim()) return "Informe o nome.";
    if (!form.email.trim()) return "Informe o e-mail.";
    if (!form.email.includes("@")) return "Informe um e-mail válido.";

    const duplicateEmail = users.some(
      (item) =>
        normalizeText(item.email) === normalizeText(form.email) &&
        item.id !== editingUserId,
    );
    if (duplicateEmail) return "Já existe usuário com este e-mail.";
    const duplicateCpf = users.some(
      (item) => onlyDigits(item.cpf) === cpfDigits && item.id !== editingUserId,
    );
    if (duplicateCpf) return "Já existe usuário com este CPF.";

    if (!isEditMode || form.password.length > 0) {
      if (form.password.length < 8) return "A senha deve ter no mínimo 8 caracteres.";
      if (form.password !== form.confirmPassword) return "Confirmação de senha inválida.";
    }

    return null;
  };

  const saveUser = async () => {
    const validationError = validateForm();
    if (validationError) {
      statusDialog.error(validationError);
      return;
    }

    setIsSavingUser(true);
    try {
      if (isEditMode && editingUserId) {
        const updated = await userService.update(editingUserId, form);
        if (!updated) return;
        setUsers((current) => current.map((item) => (item.id === editingUserId ? updated : item)));
        statusDialog.success("Usuário atualizado com sucesso.");
      } else {
        const created = await userService.create(form);
        if (!created) return;
        setUsers((current) => [created, ...current]);
        statusDialog.success("Usuário criado com sucesso.");
      }
    } catch (error) {
      statusDialog.error(error instanceof Error ? error.message : "Erro ao salvar usuário.");
      return;
    } finally {
      setIsSavingUser(false);
    }

    setDrawerOpen(false);
    setEditingUserId(null);
    setForm(defaultForm());
  };

  return (
    <PageLayout className="space-y-4 py-4 md:py-6 lg:py-8" size="wide">
      <PageHeader
        title="Usuários"
        description="Cadastre e gerencie acessos ao painel administrativo."
        action={
          <button
            type="button"
            onClick={openCreateDrawer}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} />
            Novo usuário
          </button>
        }
      />

      <Suspense fallback={<LoadingBar />}>
        <UsersFilters
          searchTerm={searchTerm}
          roleFilter={roleFilter}
          statusFilter={statusFilter}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          showResetFeedback={showResetFeedback}
          onSearchChange={setSearchTerm}
          onRoleChange={setRoleFilter}
          onStatusChange={setStatusFilter}
          onResetFilters={resetFilters}
        />
      </Suspense>

      <section className="card overflow-hidden rounded-2xl">
        {isLoading ? (
          <div className="p-5">
            <LoadingBar />
          </div>
        ) : (
          <>
            <Suspense fallback={<LoadingBar />}>
              <UsersTable
                items={paginatedUsers}
                onEdit={openEditDrawer}
                onToggleStatus={toggleStatus}
                onResetPassword={resetPassword}
              />
            </Suspense>
            <div className="px-4 py-4">
              <TablePagination
                totalItems={filteredUsers.length}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            </div>
          </>
        )}
      </section>

      <Suspense fallback={null}>
        <UserFormDrawer
          open={drawerOpen}
          isEditMode={isEditMode}
          form={form}
          onChange={setForm}
          onClose={() => setDrawerOpen(false)}
          onSave={saveUser}
          isSaving={isSavingUser}
        />
      </Suspense>

      <DeactivateUserReasonDialog
        open={Boolean(pendingDeactivateUser)}
        userName={pendingDeactivateUser?.name ?? ""}
        reason={deactivationReason}
        requiredChars={10}
        onReasonChange={setDeactivationReason}
        onClose={() => {
          setPendingDeactivateUser(null);
          setDeactivationReason("");
        }}
        onConfirm={handleConfirmDeactivateUser}
      />
      {statusDialog.Dialog}
    </PageLayout>
  );
}
