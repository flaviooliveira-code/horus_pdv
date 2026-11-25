/**
 * Arquivo: src/pages/Admin/SupplierRegisterPage.tsx
 * Objetivo: gerencia cadastro de fornecedores com dados fiscais, endereço e contatos.
 * Entradas esperadas: não recebe props; processa lista local, formulário em drawer e validações de cadastro.
 */

import { AlertTriangle, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "@/components/Admin/PageHeader";
import RowActionsMenu from "@/components/Admin/RowActionsMenu";
import LoadingButton from "@/components/Loading/LoadingButton";
import TablePagination from "@/components/Pagination/TablePagination";
import AddressContactFields from "@/components/Register/AddressContactFields";
import { Toast, useStatusDialog } from "@/hooks/Dialog";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";
import PageLayout from "@/layout/PageLayout";
import { supplierService } from "@/services/api/supplierService";
import { lookupAddressByCep } from "@/utils/cepLookup";
import { onlyDigits } from "@/utils/inputMasks";
import { isValidCnpj, isValidEmail } from "@/utils/validators";

type Supplier = {
  id: string;
  companyName: string;
  fantasyName: string;
  cnpj: string;
  cep: string;
  city: string;
  state: string;
  address: string;
  neighborhood: string;
  streetComplement: string;
  number: string;
  referencePoint: string;
  telephone: string;
  cellphone: string;
  email: string;
};

type SupplierFormData = Omit<Supplier, "id">;

const EMPTY_FORM: SupplierFormData = {
  companyName: "",
  fantasyName: "",
  cnpj: "",
  cep: "",
  city: "",
  state: "",
  address: "",
  neighborhood: "",
  streetComplement: "",
  number: "",
  referencePoint: "",
  telephone: "",
  cellphone: "",
  email: "",
};

function getSupplierMissingFields(supplier: SupplierFormData): string[] {
  const missing: string[] = [];
  if (!supplier.cnpj.trim()) missing.push("CNPJ");
  if (!supplier.cellphone.trim() && !supplier.telephone.trim()) missing.push("Contato");
  if (!supplier.address.trim() && !supplier.city.trim()) missing.push("Endereço");
  return missing;
}

function SupplierFormDrawer({
  open,
  isEditMode,
  value,
  isSaving,
  loadingCep,
  onClose,
  onChange,
  onSave,
  onFillAddressFromCep,
}: {
  open: boolean;
  isEditMode: boolean;
  value: SupplierFormData;
  isSaving: boolean;
  loadingCep: boolean;
  onClose: () => void;
  onChange: (next: SupplierFormData) => void;
  onSave: () => void;
  onFillAddressFromCep: () => void;
}) {
  const { maskCnpj } = useInputMasks();
  const fantasyNameInputRef = useRef<HTMLInputElement | null>(null);
  const missingFields = useMemo(() => getSupplierMissingFields(value), [value]);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => fantasyNameInputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === "Enter" || event.key.toLowerCase() === "s")) {
        event.preventDefault();
        onSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, onSave]);

  if (!open) return null;

  const setField = <K extends keyof SupplierFormData>(
    key: K,
    fieldValue: SupplierFormData[K],
  ) => {
    onChange({ ...value, [key]: fieldValue });
  };

  return (
    <div className="dept-drawer-overlay" onClick={onClose}>
      <aside className="dept-drawer-panel" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-border-primary p-5">
          <div>
            <h3 className="text-xl font-semibold text-text-primary">
              {isEditMode ? "Editar fornecedor" : "Novo fornecedor"}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Apenas o nome é obrigatório. CNPJ, endereço e contato são opcionais para fornecedores informais.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
            aria-label="Fechar formulário"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {missingFields.length > 0 ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <p>
                <strong>Cadastro incompleto ({missingFields.join(", ")}):</strong> você pode salvar assim mesmo e completar depois.
              </p>
            </div>
          ) : null}

          <section className="card rounded-2xl p-4">
            <h4 className="text-sm font-semibold text-text-secondary">Dados do fornecedor</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">Nome / Nome Fantasia *</span>
                <input
                  ref={fantasyNameInputRef}
                  value={value.fantasyName}
                  onChange={(event) => setField("fantasyName", event.target.value)}
                  className="input-field w-full"
                  placeholder="Ex.: Zé das Frutas ou Distribuidora Central"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">Razão Social (opcional)</span>
                <input
                  value={value.companyName}
                  onChange={(event) => setField("companyName", event.target.value)}
                  className="input-field w-full"
                  placeholder="Razão Social (se houver)"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1.5 block text-sm text-text-secondary">CNPJ (opcional)</span>
                <input
                  value={value.cnpj}
                  onChange={(event) => setField("cnpj", maskCnpj(event.target.value))}
                  className="input-field w-full"
                  placeholder="00.000.000/0000-00"
                />
              </label>
            </div>
          </section>

          <AddressContactFields
            value={{
              cep: value.cep,
              city: value.city,
              state: value.state,
              address: value.address,
              neighborhood: value.neighborhood,
              streetComplement: value.streetComplement,
              number: value.number,
              referencePoint: value.referencePoint,
              telephone: value.telephone,
              cellphone: value.cellphone,
              email: value.email,
            }}
            loadingCep={loadingCep}
            optionalFields
            onFillAddressFromCep={onFillAddressFromCep}
            onChange={(field, fieldValue) => setField(field, fieldValue)}
          />
        </div>

        <div className="border-t border-border-primary p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-text-tertiary">
              Ctrl+Enter ou Ctrl+S para salvar · Esc para fechar
            </span>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
              <button type="button" onClick={onClose} className="btn-cancel">
                Cancelar
              </button>
              <LoadingButton
                type="button"
                onClick={onSave}
                isLoading={isSaving}
                loadingLabel="Salvando..."
                className="btn-primary"
              >
                {isEditMode ? "Salvar fornecedor" : "Criar fornecedor"}
              </LoadingButton>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function SupplierRegisterPage() {
  const statusDialog = useStatusDialog();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(() => new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deletingSupplierIds, setDeletingSupplierIds] = useState<Set<string>>(() => new Set());
  const [loadingCep, setLoadingCep] = useState(false);
  const [form, setForm] = useState<SupplierFormData>(EMPTY_FORM);

  useEffect(() => {
    supplierService
      .list()
      .then(setSuppliers)
      .catch(() => {
        Toast.error("Não foi possível carregar fornecedores da API.");
      });
  }, []);

  const filteredSuppliers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return suppliers;
    return suppliers.filter(
      (supplier) =>
        supplier.companyName.toLowerCase().includes(normalized) ||
        supplier.fantasyName.toLowerCase().includes(normalized) ||
        supplier.cnpj.includes(normalized),
    );
  }, [suppliers, search]);

  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedSuppliers = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return filteredSuppliers.slice(start, start + itemsPerPage);
  }, [filteredSuppliers, itemsPerPage, safeCurrentPage]);
  const selectedSuppliersOnPage = paginatedSuppliers.filter((supplier) =>
    selectedSupplierIds.has(supplier.id),
  );
  const allSuppliersOnPageSelected =
    paginatedSuppliers.length > 0 && selectedSuppliersOnPage.length === paginatedSuppliers.length;

  const toggleSupplierSelection = (supplierId: string) => {
    setSelectedSupplierIds((current) => {
      const next = new Set(current);
      if (next.has(supplierId)) {
        next.delete(supplierId);
      } else {
        next.add(supplierId);
      }
      return next;
    });
  };

  const toggleCurrentPageSelection = () => {
    setSelectedSupplierIds((current) => {
      const next = new Set(current);
      if (allSuppliersOnPageSelected) {
        paginatedSuppliers.forEach((supplier) => next.delete(supplier.id));
      } else {
        paginatedSuppliers.forEach((supplier) => next.add(supplier.id));
      }
      return next;
    });
  };

  const openCreateDrawer = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  };

  const openEditDrawer = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setForm({ ...supplier });
    setDrawerOpen(true);
  };

  const handleDelete = async (supplier: Supplier) => {
    const confirmed = await statusDialog.confirm(
      `Deseja excluir o fornecedor "${supplier.fantasyName}"?`,
    );
    if (!confirmed) return;
    setDeletingSupplierIds((current) => new Set(current).add(supplier.id));
    try {
      await supplierService.remove(supplier.id);
      setSuppliers((current) => current.filter((item) => item.id !== supplier.id));
      setSelectedSupplierIds((current) => {
        const next = new Set(current);
        next.delete(supplier.id);
        return next;
      });
      statusDialog.success("Fornecedor excluído com sucesso.");
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Erro ao excluir fornecedor.");
    } finally {
      setDeletingSupplierIds((current) => {
        const next = new Set(current);
        next.delete(supplier.id);
        return next;
      });
    }
  };

  const handleBulkDelete = async () => {
    const selectedIds = Array.from(selectedSupplierIds);
    if (selectedIds.length === 0) return;

    const confirmed = await statusDialog.confirm(
      `Excluir ${selectedIds.length} fornecedor(es) selecionado(s)?`,
    );
    if (!confirmed) return;

    setBulkDeleting(true);
    setDeletingSupplierIds((current) => new Set([...current, ...selectedIds]));
    const results = await Promise.allSettled(
      selectedIds.map(async (supplierId) => {
        await supplierService.remove(supplierId);
        return supplierId;
      }),
    );
    setBulkDeleting(false);
    setDeletingSupplierIds((current) => {
      const next = new Set(current);
      selectedIds.forEach((supplierId) => next.delete(supplierId));
      return next;
    });
    const removedIds = results
      .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
      .map((result) => result.value);

    if (removedIds.length > 0) {
      const removedIdSet = new Set(removedIds);
      setSuppliers((current) => current.filter((supplier) => !removedIdSet.has(supplier.id)));
      setSelectedSupplierIds((current) => {
        const next = new Set(current);
        removedIds.forEach((supplierId) => next.delete(supplierId));
        return next;
      });
    }

    const failedCount = selectedIds.length - removedIds.length;
    if (failedCount > 0) {
      Toast.error(`${failedCount} fornecedor(es) não puderam ser excluído(s).`);
      return;
    }

    Toast.success("Fornecedores selecionados excluídos com sucesso.");
  };

  const fillAddressFromCep = async () => {
    if (onlyDigits(form.cep).length !== 8) {
      Toast.error("CEP inválido.");
      return;
    }
    setLoadingCep(true);
    const result = await lookupAddressByCep(form.cep);
    setLoadingCep(false);

    if (!result.success) {
      Toast.error("CEP não encontrado.");
      return;
    }

    setForm((current) => ({
      ...current,
      address: result.data.endereco || current.address,
      neighborhood: result.data.bairro || current.neighborhood,
      city: result.data.cidade || current.city,
      state: result.data.estado || current.state,
      streetComplement: result.data.complemento || current.streetComplement,
    }));
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (drawerOpen) return;
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if (event.key === "F2" || (event.altKey && event.key.toLowerCase() === "n" && !isTyping)) {
        event.preventDefault();
        openCreateDrawer();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [drawerOpen]);

  const validateForm = () => {
    const fantasyName = form.fantasyName.trim();
    const companyName = form.companyName.trim();

    if (fantasyName.length < 2 && companyName.length < 2) {
      Toast.error("Informe pelo menos o nome fantasia ou a razão social (mínimo 2 caracteres).");
      return false;
    }

    if (onlyDigits(form.cnpj).length > 0 && !isValidCnpj(form.cnpj)) {
      Toast.error("CNPJ inválido. Deixe em branco se o fornecedor for informal.");
      return false;
    }

    if (!isValidEmail(form.email)) {
      Toast.error("E-mail inválido.");
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const missingFields = getSupplierMissingFields(form);
    setSaving(true);
    try {
      if (editingId) {
        const updated = await supplierService.update(editingId, form);
        if (!updated) return;
        setSuppliers((current) =>
          current.map((supplier) => (supplier.id === editingId ? updated : supplier)),
        );
        Toast.success(
          missingFields.length > 0
            ? `Fornecedor atualizado (faltam: ${missingFields.join(", ")}).`
            : "Fornecedor atualizado com sucesso.",
        );
      } else {
        const created = await supplierService.create(form);
        if (!created) return;
        setSuppliers((current) => [created, ...current]);
        Toast.success(
          missingFields.length > 0
            ? `Fornecedor cadastrado (faltam: ${missingFields.join(", ")}).`
            : "Fornecedor cadastrado com sucesso.",
        );
      }
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Erro ao salvar fornecedor.");
      return;
    } finally {
      setSaving(false);
    }

    setDrawerOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  return (
    <PageLayout className="space-y-4 py-4 md:space-y-6 md:py-6 lg:py-8">
      <PageHeader
        title="Cadastro de Fornecedor"
        description="Cadastre fornecedores formais ou informais — apenas o nome é obrigatório."
        action={
          <button
            type="button"
            onClick={openCreateDrawer}
            className="btn-primary inline-flex items-center gap-2"
            title="Atalho: F2 ou Alt+N"
          >
            <Plus size={16} />
            Novo fornecedor (F2)
          </button>
        }
      />

      <section className="card p-4 md:p-5">
        <label className="relative mx-auto block w-full max-w-xl">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setCurrentPage(1);
              setSelectedSupplierIds(new Set());
            }}
            className="input-field w-full pl-9"
            placeholder="Pesquise por nome ou CNPJ"
          />
        </label>
      </section>

      <section className="card overflow-hidden">
        {selectedSupplierIds.size > 0 ? (
          <div className="flex flex-col gap-2 border-b border-border-primary bg-primary/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-text-primary">
              {selectedSupplierIds.size} fornecedor(es) selecionado(s)
            </p>
            <LoadingButton
              type="button"
              onClick={handleBulkDelete}
              isLoading={bulkDeleting}
              loadingLabel="Excluindo..."
              className="btn-cancel inline-flex items-center justify-center gap-2"
            >
              <Trash2 size={15} />
              Excluir selecionados
            </LoadingButton>
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-bg-primary text-left text-text-secondary">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSuppliersOnPageSelected}
                    onChange={toggleCurrentPageSelection}
                    aria-label="Selecionar fornecedores desta página"
                    className="h-4 w-4 rounded border-border-secondary accent-accent"
                  />
                </th>
                <th className="px-4 py-3">Nome Fantasia</th>
                <th className="px-4 py-3">Razão Social</th>
                <th className="px-4 py-3">CNPJ</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSuppliers.map((supplier) => {
                const missing = getSupplierMissingFields(supplier);
                return (
                  <tr key={supplier.id} className="border-t border-border-primary">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedSupplierIds.has(supplier.id)}
                        onChange={() => toggleSupplierSelection(supplier.id)}
                        aria-label={`Selecionar ${supplier.fantasyName || supplier.companyName}`}
                        className="h-4 w-4 rounded border-border-secondary accent-accent"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-text-primary">
                          {supplier.fantasyName || supplier.companyName}
                        </span>
                        {missing.length > 0 ? (
                          <span
                            title={`Faltam informações opcionais: ${missing.join(", ")}`}
                            className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"
                          >
                            <AlertTriangle size={11} />
                            Incompleto
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{supplier.companyName || "—"}</td>
                    <td className="px-4 py-3 text-text-secondary">{supplier.cnpj || "—"}</td>
                    <td className="px-4 py-3 text-text-secondary">{supplier.city || "—"}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {supplier.cellphone || supplier.telephone || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <RowActionsMenu
                        items={[
                          {
                            key: "edit",
                            label: "Editar",
                            icon: <Pencil size={13} />,
                            onClick: () => openEditDrawer(supplier),
                          },
                          {
                            key: "delete",
                            label: "Excluir",
                            icon: <Trash2 size={13} />,
                            onClick: () => handleDelete(supplier),
                            loading: deletingSupplierIds.has(supplier.id),
                            loadingLabel: "Excluindo...",
                            danger: true,
                          },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-4">
          <TablePagination
            totalItems={filteredSuppliers.length}
            currentPage={safeCurrentPage}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(value) => {
              setItemsPerPage(value);
              setCurrentPage(1);
              setSelectedSupplierIds(new Set());
            }}
          />
        </div>
      </section>

      <SupplierFormDrawer
        open={drawerOpen}
        isEditMode={editingId !== null}
        value={form}
        isSaving={saving}
        loadingCep={loadingCep}
        onClose={() => setDrawerOpen(false)}
        onChange={setForm}
        onSave={handleSave}
        onFillAddressFromCep={fillAddressFromCep}
      />
      {statusDialog.Dialog}
    </PageLayout>
  );
}
