import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import PageHeader from "@/components/Admin/PageHeader";
import RowActionsMenu from "@/components/Admin/RowActionsMenu";
import { Toast, useStatusDialog } from "@/hooks/Dialog";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";
import PageLayout from "@/layout/PageLayout";

type Product = {
  id: string;
  productImageUrl: string;
  productImageName: string;
  productName: string;
  productCode: string;
  productSupplier: string;
  productDescription: string;
  productQnt: string;
  productUnitPrice: string;
  productSalePrice: string;
  totalPriceOnProduct: string;
};

type ProductFormData = Omit<Product, "id">;

const SUPPLIER_OPTIONS = [
  "Distribuidora Alfa",
  "Atacado Vitória",
  "Mundo Embalagens",
];

const EMPTY_FORM: ProductFormData = {
  productImageUrl: "",
  productImageName: "",
  productName: "",
  productCode: "",
  productSupplier: "",
  productDescription: "",
  productQnt: "",
  productUnitPrice: "",
  productSalePrice: "",
  totalPriceOnProduct: "",
};

const INITIAL_PRODUCTS: Product[] = [
  {
    id: "pr-001",
    productImageUrl: "",
    productImageName: "",
    productName: "Café Tradicional 500g",
    productCode: "CAF500",
    productSupplier: "Distribuidora Alfa",
    productDescription: "Café torrado e moído 500g",
    productQnt: "120",
    productUnitPrice: "14,90",
    productSalePrice: "18,90",
    totalPriceOnProduct: "1.788,00",
  },
];

function ProductFormDrawer({
  open,
  isEditMode,
  value,
  onClose,
  onChange,
  onSave,
}: {
  open: boolean;
  isEditMode: boolean;
  value: ProductFormData;
  onClose: () => void;
  onChange: (next: ProductFormData) => void;
  onSave: () => void;
}) {
  const { maskMoneyBr, parseMoneyBr, formatMoneyBr } = useInputMasks();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  if (!open) return null;

  const setField = <K extends keyof ProductFormData>(
    key: K,
    fieldValue: ProductFormData[K],
  ) => {
    const next = { ...value, [key]: fieldValue };
    const quantity = Number(next.productQnt || 0);
    const unitPrice = parseMoneyBr(next.productUnitPrice);
    next.totalPriceOnProduct = quantity > 0 ? formatMoneyBr(quantity * unitPrice) : "";
    onChange(next);
  };

  const applyImage = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      onChange({
        ...value,
        productImageName: file.name,
        productImageUrl: result,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="dept-drawer-overlay" onClick={onClose}>
      <aside className="dept-drawer-panel" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-border-primary p-5">
          <div>
            <h3 className="text-xl font-semibold text-text-primary">
              {isEditMode ? "Editar produto" : "Novo produto"}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Cadastre produto com fornecedor, preços e quantidade.
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
            <h4 className="text-sm font-semibold text-text-secondary">Dados do produto</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-1.5 block text-sm text-text-secondary">Imagem do Produto</span>
                <div
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDragActive(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragActive(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsDragActive(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDragActive(false);
                    applyImage(event.dataTransfer.files?.[0] ?? null);
                  }}
                  className={`flex flex-col items-center justify-center rounded-xl border border-dashed p-4 transition ${
                    isDragActive
                      ? "border-accent bg-accent/10"
                      : "border-border-secondary bg-bg-primary/50"
                  }`}
                >
                  <div className="mb-3 h-24 w-24 overflow-hidden rounded-2xl border border-border-primary bg-bg-light shadow-sm">
                    {value.productImageUrl ? (
                      <img
                        src={value.productImageUrl}
                        alt="Pré-visualização do produto"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-center text-sm font-medium text-text-tertiary">
                        Sem imagem
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => applyImage(event.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    className="btn-outline-secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Arraste e solte ou clique para enviar
                  </button>
                  {value.productImageName ? (
                    <span className="mt-2 text-xs text-text-secondary">
                      Arquivo: {value.productImageName}
                    </span>
                  ) : null}
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">Nome do Produto *</span>
                <input
                  value={value.productName}
                  onChange={(event) => setField("productName", event.target.value)}
                  className="input-field w-full"
                  placeholder="Nome do Produto"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">Código do Produto *</span>
                <input
                  value={value.productCode}
                  onChange={(event) => setField("productCode", event.target.value)}
                  className="input-field w-full"
                  placeholder="Código"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1.5 block text-sm text-text-secondary">Fornecedor *</span>
                <select
                  value={value.productSupplier}
                  onChange={(event) => setField("productSupplier", event.target.value)}
                  className="select-field w-full"
                >
                  <option value="">Selecionar Fornecedor</option>
                  {SUPPLIER_OPTIONS.map((supplier) => (
                    <option key={supplier} value={supplier}>
                      {supplier}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1.5 block text-sm text-text-secondary">
                  Descrição do Produto *
                </span>
                <textarea
                  value={value.productDescription}
                  onChange={(event) => setField("productDescription", event.target.value)}
                  className="input-field min-h-[96px] w-full"
                  placeholder="Descrição do Produto"
                />
              </label>
            </div>
          </section>

          <section className="card rounded-2xl p-4">
            <h4 className="text-sm font-semibold text-text-secondary">Preço e estoque</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">
                  Quantidade do Produto *
                </span>
                <input
                  value={value.productQnt}
                  onChange={(event) =>
                    setField("productQnt", event.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  className="input-field w-full"
                  placeholder="Quantidade"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">
                  Preço Unitário do Produto *
                </span>
                <input
                  value={value.productUnitPrice}
                  onChange={(event) =>
                    setField("productUnitPrice", maskMoneyBr(event.target.value))
                  }
                  className="input-field w-full"
                  placeholder="0,00"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">
                  Preço de Venda do Produto *
                </span>
                <input
                  value={value.productSalePrice}
                  onChange={(event) =>
                    setField("productSalePrice", maskMoneyBr(event.target.value))
                  }
                  className="input-field w-full"
                  placeholder="0,00"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">
                  Preço Total em Produto *
                </span>
                <input
                  value={value.totalPriceOnProduct}
                  className="input-field w-full"
                  placeholder="0,00"
                  disabled
                />
              </label>
            </div>
          </section>
        </div>

        <div className="border-t border-border-primary p-4">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancelar
            </button>
            <button type="button" onClick={onSave} className="btn-primary">
              {isEditMode ? "Salvar produto" : "Criar produto"}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function ProductRegisterPage() {
  const statusDialog = useStatusDialog();
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM);

  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter(
      (product) =>
        product.productName.toLowerCase().includes(normalized) ||
        product.productCode.toLowerCase().includes(normalized),
    );
  }, [products, search]);

  const openCreateDrawer = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  };

  const openEditDrawer = (product: Product) => {
    setEditingId(product.id);
    setForm({ ...product });
    setDrawerOpen(true);
  };

  const handleDelete = async (product: Product) => {
    const confirmed = await statusDialog.confirm(
      `Deseja excluir o produto "${product.productName}"?`,
    );
    if (!confirmed) return;
    setProducts((current) => current.filter((item) => item.id !== product.id));
    statusDialog.success("Produto excluído com sucesso.");
  };

  const validateForm = () => {
    const requiredFields: Array<keyof ProductFormData> = [
      "productName",
      "productCode",
      "productSupplier",
      "productDescription",
      "productQnt",
      "productUnitPrice",
      "productSalePrice",
      "totalPriceOnProduct",
    ];

    const missing = requiredFields.some((field) => !String(form[field]).trim());
    if (missing) {
      Toast.error("Preencha os campos obrigatórios.");
      return false;
    }

    if (form.productName.trim().length < 3) {
      Toast.error("O nome do produto deve ter no mínimo 3 caracteres.");
      return false;
    }

    if (Number(form.productQnt) < 1) {
      Toast.error("A quantidade do produto deve ser maior que 0.");
      return false;
    }

    if (!form.productSupplier) {
      Toast.error("Selecione um fornecedor.");
      return false;
    }

    return true;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    if (editingId) {
      setProducts((current) =>
        current.map((product) =>
          product.id === editingId ? { ...product, ...form } : product,
        ),
      );
      Toast.success("Produto atualizado com sucesso.");
    } else {
      const created: Product = {
        id: `pr-${Date.now()}`,
        ...form,
      };
      setProducts((current) => [created, ...current]);
      Toast.success("Produto cadastrado com sucesso.");
    }

    setDrawerOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  return (
    <PageLayout className="space-y-4 py-4 md:space-y-6 md:py-6 lg:py-8">
      <PageHeader
        title="Cadastro de Produto"
        description="Cadastro e manutenção de produtos com os campos do sistema legado."
        action={
          <button type="button" onClick={openCreateDrawer} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} />
            Novo produto
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
            onChange={(event) => setSearch(event.target.value)}
            className="input-field w-full pl-9"
            placeholder="Pesquise por nome ou código do produto"
          />
        </label>
      </section>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-bg-primary text-left text-text-secondary">
              <tr>
                <th className="px-4 py-3">Imagem</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Fornecedor</th>
                <th className="px-4 py-3">Quantidade</th>
                <th className="px-4 py-3">Preço Venda</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id} className="border-t border-border-primary">
                  <td className="px-4 py-3">
                    <div className="h-12 w-12 overflow-hidden rounded-lg border border-border-primary bg-bg-light">
                      {product.productImageUrl ? (
                        <img
                          src={product.productImageUrl}
                          alt={product.productName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-text-tertiary">
                          Sem
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">{product.productName}</td>
                  <td className="px-4 py-3">{product.productCode}</td>
                  <td className="px-4 py-3">{product.productSupplier}</td>
                  <td className="px-4 py-3">{product.productQnt}</td>
                  <td className="px-4 py-3">{product.productSalePrice}</td>
                  <td className="px-4 py-3">
                    <RowActionsMenu
                      items={[
                        {
                          key: "edit",
                          label: "Editar",
                          icon: <Pencil size={13} />,
                          onClick: () => openEditDrawer(product),
                        },
                        {
                          key: "delete",
                          label: "Excluir",
                          icon: <Trash2 size={13} />,
                          onClick: () => handleDelete(product),
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
      </section>

      <ProductFormDrawer
        open={drawerOpen}
        isEditMode={editingId !== null}
        value={form}
        onClose={() => setDrawerOpen(false)}
        onChange={setForm}
        onSave={handleSave}
      />
      {statusDialog.Dialog}
    </PageLayout>
  );
}
