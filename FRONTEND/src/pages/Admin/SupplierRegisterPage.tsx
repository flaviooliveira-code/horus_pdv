import { Edit, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import PageHeader from "@/components/Admin/PageHeader";
import AddressContactFields from "@/components/Register/AddressContactFields";
import { Toast } from "@/hooks/Dialog";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";
import PageLayout from "@/layout/PageLayout";
import { lookupAddressByCep } from "@/utils/cepLookup";
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

const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: "fr-001",
    companyName: "Distribuidora Alfa LTDA",
    fantasyName: "Distribuidora Alfa",
    cnpj: "12.345.678/0001-95",
    cep: "01001-000",
    city: "São Paulo",
    state: "SP",
    address: "Praça da Sé",
    neighborhood: "Sé",
    streetComplement: "",
    number: "100",
    referencePoint: "",
    telephone: "(11) 3322-1100",
    cellphone: "(11) 98888-3344",
    email: "comercial@alfa.com.br",
  },
];

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
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingCep, setLoadingCep] = useState(false);
  const [form, setForm] = useState<SupplierFormData>(EMPTY_FORM);

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

  const fillAddressFromCep = async () => {
    if (form.cep.replace(/\D/g, "").length !== 8) {
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

  const handleSave = () => {
    if (!validateForm()) return;

    if (editingId) {
      setSuppliers((current) =>
        current.map((supplier) =>
          supplier.id === editingId ? { ...supplier, ...form } : supplier,
        ),
      );
      Toast.success("Fornecedor atualizado com sucesso.");
    } else {
      const created: Supplier = {
        id: `fr-${Date.now()}`,
        ...form,
      };
      setSuppliers((current) => [created, ...current]);
      Toast.success("Fornecedor cadastrado com sucesso.");
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
        <label className="relative block max-w-xl">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input-field w-full pl-9"
            placeholder="Pesquise por nome ou CNPJ"
          />
        </label>
      </section>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-bg-primary text-left text-text-secondary">
              <tr>
                <th className="px-4 py-3">Razão Social</th>
                <th className="px-4 py-3">Nome Fantasia</th>
                <th className="px-4 py-3">CNPJ</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="border-t border-border-primary">
                  <td className="px-4 py-3">{supplier.companyName}</td>
                  <td className="px-4 py-3">{supplier.fantasyName}</td>
                  <td className="px-4 py-3">{supplier.cnpj}</td>
                  <td className="px-4 py-3">{supplier.city}</td>
                  <td className="px-4 py-3">{supplier.cellphone || supplier.telephone}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openEditDrawer(supplier)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border-secondary px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-accent/10 hover:text-text-primary"
                    >
                      <Edit size={13} />
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </PageLayout>
  );
}
