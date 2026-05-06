/**
 * Arquivo: src/pages/Admin/SupplierRegisterPage.tsx
 * Objetivo: gerencia cadastro de fornecedores com dados fiscais, endereço e contatos.
 * Entradas esperadas: não recebe props; processa lista local, formulário em drawer e validações de cadastro.
 */

import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/Admin/PageHeader";
import RowActionsMenu from "@/components/Admin/RowActionsMenu";
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

function SupplierFormDrawer({
  open,
  isEditMode,
  value,
  loadingCep,
  onClose,
  onChange,
  onSave,
  onFillAddressFromCep,
}: {
  open: boolean;
  isEditMode: boolean;
  value: SupplierFormData;
  loadingCep: boolean;
  onClose: () => void;
  onChange: (next: SupplierFormData) => void;
  onSave: () => void;
  onFillAddressFromCep: () => void;
}) {
  const { maskCnpj } = useInputMasks();
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
              Cadastre dados fiscais, endereço e contatos do fornecedor.
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
          <section className="card rounded-2xl p-4">
            <h4 className="text-sm font-semibold text-text-secondary">Dados do fornecedor</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">Razão Social *</span>
                <input
                  value={value.companyName}
                  onChange={(event) => setField("companyName", event.target.value)}
                  className="input-field w-full"
                  placeholder="Razão Social"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">Nome Fantasia *</span>
                <input
                  value={value.fantasyName}
                  onChange={(event) => setField("fantasyName", event.target.value)}
                  className="input-field w-full"
                  placeholder="Nome Fantasia"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1.5 block text-sm text-text-secondary">CNPJ *</span>
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
            onFillAddressFromCep={onFillAddressFromCep}
            onChange={(field, fieldValue) => setField(field, fieldValue)}
          />
        </div>

        <div className="border-t border-border-primary p-4">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancelar
            </button>
            <button type="button" onClick={onSave} className="btn-primary">
              {isEditMode ? "Salvar fornecedor" : "Criar fornecedor"}
            </button>
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
    }
  };

  const handleBulkDelete = async () => {
    const selectedIds = Array.from(selectedSupplierIds);
    if (selectedIds.length === 0) return;

    const confirmed = await statusDialog.confirm(
      `Excluir ${selectedIds.length} fornecedor(es) selecionado(s)?`,
    );
    if (!confirmed) return;

    const results = await Promise.allSettled(
      selectedIds.map(async (supplierId) => {
        await supplierService.remove(supplierId);
        return supplierId;
      }),
    );
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

  const validateForm = () => {
    const requiredFields: Array<keyof SupplierFormData> = [
      "companyName",
      "fantasyName",
      "cnpj",
      "cep",
      "city",
      "state",
      "address",
      "neighborhood",
      "number",
      "cellphone",
    ];

    const missing = requiredFields.some((field) => !String(form[field]).trim());
    if (missing) {
      Toast.error("Preencha os campos obrigatórios.");
      return false;
    }

    if (form.companyName.trim().length < 3) {
      Toast.error("A razão social deve ter no mínimo 3 caracteres.");
      return false;
    }

    if (form.fantasyName.trim().length < 3) {
      Toast.error("O nome fantasia deve ter no mínimo 3 caracteres.");
      return false;
    }

    if (!isValidCnpj(form.cnpj)) {
      Toast.error("CNPJ inválido.");
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

    try {
      if (editingId) {
        const updated = await supplierService.update(editingId, form);
        if (!updated) return;
        setSuppliers((current) =>
          current.map((supplier) => (supplier.id === editingId ? updated : supplier)),
        );
        Toast.success("Fornecedor atualizado com sucesso.");
      } else {
        const created = await supplierService.create(form);
        if (!created) return;
        setSuppliers((current) => [created, ...current]);
        Toast.success("Fornecedor cadastrado com sucesso.");
      }
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Erro ao salvar fornecedor.");
      return;
    }

    setDrawerOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  return (
    <PageLayout className="space-y-4 py-4 md:space-y-6 md:py-6 lg:py-8">
      <PageHeader
        title="Cadastro de Fornecedor"
        description="Cadastro e manutenção de fornecedores com os campos do sistema legado."
        action={
          <button type="button" onClick={openCreateDrawer} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} />
            Novo fornecedor
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
            <button
              type="button"
              onClick={handleBulkDelete}
              className="btn-cancel inline-flex items-center justify-center gap-2"
            >
              <Trash2 size={15} />
              Excluir selecionados
            </button>
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
                <th className="px-4 py-3">Razão Social</th>
                <th className="px-4 py-3">Nome Fantasia</th>
                <th className="px-4 py-3">CNPJ</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSuppliers.map((supplier) => (
                <tr key={supplier.id} className="border-t border-border-primary">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedSupplierIds.has(supplier.id)}
                      onChange={() => toggleSupplierSelection(supplier.id)}
                      aria-label={`Selecionar ${supplier.fantasyName}`}
                      className="h-4 w-4 rounded border-border-secondary accent-accent"
                    />
                  </td>
                  <td className="px-4 py-3">{supplier.companyName}</td>
                  <td className="px-4 py-3">{supplier.fantasyName}</td>
                  <td className="px-4 py-3">{supplier.cnpj}</td>
                  <td className="px-4 py-3">{supplier.city}</td>
                  <td className="px-4 py-3">{supplier.cellphone || supplier.telephone}</td>
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
                          danger: true,
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
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
