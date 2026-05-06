/**
 * Arquivo: src/pages/Admin/CustomerRegisterPage.tsx
 * Objetivo: controla cadastro de clientes com validação de documento, idade, endereço e contatos.
 * Entradas esperadas: não recebe props; processa estado local de formulário, lista e ações de CRUD.
 */

import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/Admin/PageHeader";
import RowActionsMenu from "@/components/Admin/RowActionsMenu";
import { DatePickerField } from "@/components/Form";
import TablePagination from "@/components/Pagination/TablePagination";
import AddressContactFields from "@/components/Register/AddressContactFields";
import { Toast, useStatusDialog } from "@/hooks/Dialog";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";
import PageLayout from "@/layout/PageLayout";
import { customerService } from "@/services/api/customerService";
import { lookupAddressByCep } from "@/utils/cepLookup";
import {
  getAgeFromBirthDate,
  isValidCnpj,
  isValidCpf,
  isValidEmail,
} from "@/utils/validators";
import { onlyDigits } from "@/utils/inputMasks";

type Customer = {
  id: string;
  customerName: string;
  document: string;
  birthDate: string;
  age: string;
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

type CustomerFormData = Omit<Customer, "id">;

const EMPTY_FORM: CustomerFormData = {
  customerName: "",
  document: "",
  birthDate: "",
  age: "",
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

function CustomerFormDrawer({
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
  value: CustomerFormData;
  loadingCep: boolean;
  onClose: () => void;
  onChange: (next: CustomerFormData) => void;
  onSave: () => void;
  onFillAddressFromCep: () => void;
}) {
  const { maskCpfOrCnpj } = useInputMasks();

  if (!open) return null;

  const setField = <K extends keyof CustomerFormData>(
    key: K,
    fieldValue: CustomerFormData[K],
  ) => {
    onChange({ ...value, [key]: fieldValue });
  };

  return (
    <div className="dept-drawer-overlay" onClick={onClose}>
      <aside className="dept-drawer-panel" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-border-primary p-5">
          <div>
            <h3 className="text-xl font-semibold text-text-primary">
              {isEditMode ? "Editar cliente" : "Novo cliente"}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Preencha os dados cadastrais e de contato do cliente.
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
            <h4 className="text-sm font-semibold text-text-secondary">Dados pessoais</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">
                  Documento (CPF/CNPJ) *
                </span>
                <input
                  value={value.document}
                  onChange={(event) => setField("document", maskCpfOrCnpj(event.target.value))}
                  className="input-field w-full"
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">Nome *</span>
                <input
                  value={value.customerName}
                  onChange={(event) => setField("customerName", event.target.value)}
                  className="input-field w-full"
                  placeholder="Nome"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">DN *</span>
                <DatePickerField
                  value={value.birthDate}
                  onChange={(nextDate) => {
                    const age = getAgeFromBirthDate(nextDate);
                    onChange({
                      ...value,
                      birthDate: nextDate,
                      age: age !== null ? String(age) : "",
                    });
                  }}
                  className="w-full"
                  placeholder="dd/mm/aaaa"
                  format="br"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">Idade *</span>
                <input value={value.age} className="input-field w-full" disabled />
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
              {isEditMode ? "Salvar cliente" : "Criar cliente"}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function CustomerRegisterPage() {
  const statusDialog = useStatusDialog();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(() => new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingCep, setLoadingCep] = useState(false);
  const [form, setForm] = useState<CustomerFormData>(EMPTY_FORM);

  useEffect(() => {
    customerService
      .list()
      .then(setCustomers)
      .catch(() => {
        Toast.error("Não foi possível carregar clientes da API.");
      });
  }, []);

  const filteredCustomers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return customers;
    return customers.filter(
      (customer) =>
        customer.customerName.toLowerCase().includes(normalized) ||
        customer.document.includes(normalized),
    );
  }, [customers, search]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedCustomers = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return filteredCustomers.slice(start, start + itemsPerPage);
  }, [filteredCustomers, itemsPerPage, safeCurrentPage]);
  const selectedCustomersOnPage = paginatedCustomers.filter((customer) =>
    selectedCustomerIds.has(customer.id),
  );
  const allCustomersOnPageSelected =
    paginatedCustomers.length > 0 && selectedCustomersOnPage.length === paginatedCustomers.length;

  const toggleCustomerSelection = (customerId: string) => {
    setSelectedCustomerIds((current) => {
      const next = new Set(current);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  const toggleCurrentPageSelection = () => {
    setSelectedCustomerIds((current) => {
      const next = new Set(current);
      if (allCustomersOnPageSelected) {
        paginatedCustomers.forEach((customer) => next.delete(customer.id));
      } else {
        paginatedCustomers.forEach((customer) => next.add(customer.id));
      }
      return next;
    });
  };

  const openCreateDrawer = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  };

  const openEditDrawer = (customer: Customer) => {
    setEditingId(customer.id);
    setForm({ ...customer });
    setDrawerOpen(true);
  };

  const handleDelete = async (customer: Customer) => {
    const confirmed = await statusDialog.confirm(
      `Deseja excluir o cliente "${customer.customerName}"?`,
    );
    if (!confirmed) return;
    try {
      await customerService.remove(customer.id);
      setCustomers((current) => current.filter((item) => item.id !== customer.id));
      setSelectedCustomerIds((current) => {
        const next = new Set(current);
        next.delete(customer.id);
        return next;
      });
      statusDialog.success("Cliente excluído com sucesso.");
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Erro ao excluir cliente.");
    }
  };

  const handleBulkDelete = async () => {
    const selectedIds = Array.from(selectedCustomerIds);
    if (selectedIds.length === 0) return;

    const confirmed = await statusDialog.confirm(
      `Excluir ${selectedIds.length} cliente(s) selecionado(s)?`,
    );
    if (!confirmed) return;

    const results = await Promise.allSettled(
      selectedIds.map(async (customerId) => {
        await customerService.remove(customerId);
        return customerId;
      }),
    );
    const removedIds = results
      .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
      .map((result) => result.value);

    if (removedIds.length > 0) {
      const removedIdSet = new Set(removedIds);
      setCustomers((current) => current.filter((customer) => !removedIdSet.has(customer.id)));
      setSelectedCustomerIds((current) => {
        const next = new Set(current);
        removedIds.forEach((customerId) => next.delete(customerId));
        return next;
      });
    }

    const failedCount = selectedIds.length - removedIds.length;
    if (failedCount > 0) {
      Toast.error(`${failedCount} cliente(s) não puderam ser excluído(s).`);
      return;
    }

    Toast.success("Clientes selecionados excluídos com sucesso.");
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
    const requiredFields: Array<keyof CustomerFormData> = [
      "customerName",
      "document",
      "birthDate",
      "age",
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

    if (form.customerName.trim().length < 3) {
      Toast.error("O nome do cliente deve ter no mínimo 3 caracteres.");
      return false;
    }

    const documentDigits = onlyDigits(form.document);
    const isCpf = documentDigits.length === 11;
    const isCnpj = documentDigits.length === 14;

    if ((!isCpf && !isCnpj) || (isCpf && !isValidCpf(form.document)) || (isCnpj && !isValidCnpj(form.document))) {
      Toast.error("Documento inválido.");
      return false;
    }

    if (!form.age) {
      Toast.error("Idade inválida.");
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
        const updated = await customerService.update(editingId, form);
        if (!updated) return;
        setCustomers((current) =>
          current.map((customer) => (customer.id === editingId ? updated : customer)),
        );
        Toast.success("Cliente atualizado com sucesso.");
      } else {
        const created = await customerService.create(form);
        if (!created) return;
        setCustomers((current) => [created, ...current]);
        Toast.success("Cliente cadastrado com sucesso.");
      }
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Erro ao salvar cliente.");
      return;
    }

    setDrawerOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  return (
    <PageLayout className="space-y-4 py-4 md:space-y-6 md:py-6 lg:py-8">
      <PageHeader
        title="Cadastro de Cliente"
        description="Cadastro e manutenção de clientes com os campos do sistema legado."
        action={
          <button type="button" onClick={openCreateDrawer} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} />
            Novo cliente
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
              setSelectedCustomerIds(new Set());
            }}
            className="input-field w-full pl-9"
            placeholder="Pesquise por nome ou CPF"
          />
        </label>
      </section>

      <section className="card overflow-hidden">
        {selectedCustomerIds.size > 0 ? (
          <div className="flex flex-col gap-2 border-b border-border-primary bg-primary/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-text-primary">
              {selectedCustomerIds.size} cliente(s) selecionado(s)
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
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-bg-primary text-left text-text-secondary">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allCustomersOnPageSelected}
                    onChange={toggleCurrentPageSelection}
                    aria-label="Selecionar clientes desta página"
                    className="h-4 w-4 rounded border-border-secondary accent-accent"
                  />
                </th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Celular</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.map((customer) => (
                <tr key={customer.id} className="border-t border-border-primary">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedCustomerIds.has(customer.id)}
                      onChange={() => toggleCustomerSelection(customer.id)}
                      aria-label={`Selecionar ${customer.customerName}`}
                      className="h-4 w-4 rounded border-border-secondary accent-accent"
                    />
                  </td>
                  <td className="px-4 py-3">{customer.customerName}</td>
                  <td className="px-4 py-3">{customer.document}</td>
                  <td className="px-4 py-3">{customer.city}</td>
                  <td className="px-4 py-3">{customer.cellphone}</td>
                  <td className="px-4 py-3">{customer.email || "-"}</td>
                  <td className="px-4 py-3">
                    <RowActionsMenu
                      items={[
                        {
                          key: "edit",
                          label: "Editar",
                          icon: <Pencil size={13} />,
                          onClick: () => openEditDrawer(customer),
                        },
                        {
                          key: "delete",
                          label: "Excluir",
                          icon: <Trash2 size={13} />,
                          onClick: () => handleDelete(customer),
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
            totalItems={filteredCustomers.length}
            currentPage={safeCurrentPage}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(value) => {
              setItemsPerPage(value);
              setCurrentPage(1);
              setSelectedCustomerIds(new Set());
            }}
          />
        </div>
      </section>

      <CustomerFormDrawer
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
