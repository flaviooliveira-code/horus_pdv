/**
 * Arquivo: src/pages/Admin/ProductRegisterPage.tsx
 * Objetivo: gerencia cadastro de produtos com formulário em drawer, busca e ações de editar/remover.
 * Entradas esperadas: não recebe props; opera com estado local de lista e formulário de produto.
 */

import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { type ClipboardEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "@/components/Admin/PageHeader";
import RowActionsMenu from "@/components/Admin/RowActionsMenu";
import { SearchableSelectField } from "@/components/Form";
import TablePagination from "@/components/Pagination/TablePagination";
import AddressContactFields from "@/components/Register/AddressContactFields";
import { Toast, useStatusDialog } from "@/hooks/Dialog";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";
import PageLayout from "@/layout/PageLayout";
import { productService } from "@/services/api/productService";
import { supplierService, type SupplierPayload } from "@/services/api/supplierService";
import { lookupAddressByCep } from "@/utils/cepLookup";
import { onlyDigits } from "@/utils/inputMasks";
import { isValidCnpj, isValidEmail } from "@/utils/validators";

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

type QuickSupplierDraft = SupplierPayload;

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

const EMPTY_SUPPLIER_DRAFT: QuickSupplierDraft = {
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

function preventNonDigitBeforeInput(event: FormEvent<HTMLInputElement>) {
  const data = (event.nativeEvent as InputEvent).data ?? "";
  if (data && /\D/.test(data)) {
    event.preventDefault();
  }
}

function ProductFormDrawer({
  open,
  isEditMode,
  value,
  onClose,
  onChange,
  onSave,
  supplierOptions,
  onCreateSupplier,
}: {
  open: boolean;
  isEditMode: boolean;
  value: ProductFormData;
  onClose: () => void;
  onChange: (next: ProductFormData) => void;
  onSave: () => void;
  supplierOptions: string[];
  onCreateSupplier: (draft: QuickSupplierDraft) => Promise<string | null>;
}) {
  const {
    maskCnpj,
    maskMoneyBr,
    parseMoneyBr,
    formatMoneyBr,
    sanitizeIntegerInput,
  } = useInputMasks();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierDraft, setSupplierDraft] = useState<QuickSupplierDraft>(EMPTY_SUPPLIER_DRAFT);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [loadingSupplierCep, setLoadingSupplierCep] = useState(false);
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

  const setMoneyField = (
    key: "productUnitPrice" | "productSalePrice",
    fieldValue: string,
  ) => {
    setField(key, maskMoneyBr(fieldValue));
  };

  const pasteMoneyField = (
    event: ClipboardEvent<HTMLInputElement>,
    key: "productUnitPrice" | "productSalePrice",
  ) => {
    event.preventDefault();
    setMoneyField(key, event.clipboardData.getData("text"));
  };

  const openSupplierModal = (searchTerm = "") => {
    const name = searchTerm || value.productSupplier;
    setSupplierDraft({
      ...EMPTY_SUPPLIER_DRAFT,
      companyName: name,
      fantasyName: name,
    });
    setSupplierModalOpen(true);
  };

  const setSupplierField = <K extends keyof QuickSupplierDraft>(
    key: K,
    fieldValue: QuickSupplierDraft[K],
  ) => {
    setSupplierDraft((current) => ({ ...current, [key]: fieldValue }));
  };

  const fillSupplierAddressFromCep = async () => {
    if (onlyDigits(supplierDraft.cep).length !== 8) {
      Toast.error("CEP inválido.");
      return;
    }

    setLoadingSupplierCep(true);
    const result = await lookupAddressByCep(supplierDraft.cep);
    setLoadingSupplierCep(false);

    if (!result.success) {
      Toast.error("CEP não encontrado.");
      return;
    }

    setSupplierDraft((current) => ({
      ...current,
      address: result.data.endereco || current.address,
      neighborhood: result.data.bairro || current.neighborhood,
      city: result.data.cidade || current.city,
      state: result.data.estado || current.state,
      streetComplement: result.data.complemento || current.streetComplement,
    }));
  };

  const validateSupplierDraft = () => {
    const requiredFields: Array<keyof QuickSupplierDraft> = [
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

    const missing = requiredFields.some((field) => !String(supplierDraft[field]).trim());
    if (missing) {
      Toast.error("Preencha os campos obrigatórios do fornecedor.");
      return false;
    }

    if (supplierDraft.companyName.trim().length < 3) {
      Toast.error("A razão social deve ter no mínimo 3 caracteres.");
      return false;
    }

    if (supplierDraft.fantasyName.trim().length < 3) {
      Toast.error("O nome fantasia deve ter no mínimo 3 caracteres.");
      return false;
    }

    if (!isValidCnpj(supplierDraft.cnpj)) {
      Toast.error("CNPJ inválido.");
      return false;
    }

    if (!isValidEmail(supplierDraft.email)) {
      Toast.error("E-mail inválido.");
      return false;
    }

    return true;
  };

  const submitSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateSupplierDraft()) return;

    setSavingSupplier(true);
    try {
      const createdName = await onCreateSupplier(supplierDraft);
      if (createdName) {
        setField("productSupplier", createdName);
        setSupplierModalOpen(false);
        setSupplierDraft(EMPTY_SUPPLIER_DRAFT);
      }
    } finally {
      setSavingSupplier(false);
    }
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
              <SearchableSelectField
                label="Fornecedor *"
                value={value.productSupplier}
                options={supplierOptions}
                onChange={(nextValue) => setField("productSupplier", nextValue)}
                getOptionValue={(supplier) => supplier}
                getOptionLabel={(supplier) => supplier}
                placeholder="Pesquisar fornecedor"
                emptyMessage="Nenhum fornecedor encontrado."
                createActionLabel="Cadastrar fornecedor"
                onCreateOption={openSupplierModal}
                className="md:col-span-2"
              />
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
                  inputMode="numeric"
                  onChange={(event) =>
                    setField("productQnt", sanitizeIntegerInput(event.target.value).slice(0, 8))
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
                  inputMode="numeric"
                  pattern="[0-9,.]*"
                  onBeforeInput={preventNonDigitBeforeInput}
                  onPaste={(event) => pasteMoneyField(event, "productUnitPrice")}
                  onChange={(event) => setMoneyField("productUnitPrice", event.target.value)}
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
                  inputMode="numeric"
                  pattern="[0-9,.]*"
                  onBeforeInput={preventNonDigitBeforeInput}
                  onPaste={(event) => pasteMoneyField(event, "productSalePrice")}
                  onChange={(event) => setMoneyField("productSalePrice", event.target.value)}
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

      {supplierModalOpen ? (
        <div
          className="fixed inset-0 z-layer-dialog flex items-center justify-center bg-black/50 px-3 backdrop-blur-sm"
          onClick={(event) => event.stopPropagation()}
        >
          <form
            onSubmit={submitSupplier}
            className="w-full max-w-4xl rounded-2xl border border-border-primary bg-bg-light shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border-primary px-4 py-3">
              <div>
                <h3 className="text-base font-semibold text-text-primary">
                  Cadastrar fornecedor
                </h3>
                <p className="text-sm text-text-secondary">
                  O fornecedor criado será selecionado neste produto.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSupplierModalOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-hover-light"
                aria-label="Fechar cadastro de fornecedor"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
              <section className="card rounded-2xl p-4">
                <h4 className="text-sm font-semibold text-text-secondary">Dados do fornecedor</h4>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <label className="block">
                    <span className="mb-1.5 block text-sm text-text-secondary">Razão social *</span>
                    <input
                      value={supplierDraft.companyName}
                      onChange={(event) => setSupplierField("companyName", event.target.value)}
                      className="input-field w-full"
                      placeholder="Razão social"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm text-text-secondary">Nome fantasia *</span>
                    <input
                      value={supplierDraft.fantasyName}
                      onChange={(event) => setSupplierField("fantasyName", event.target.value)}
                      className="input-field w-full"
                      placeholder="Nome fantasia"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm text-text-secondary">CNPJ *</span>
                    <input
                      value={supplierDraft.cnpj}
                      onChange={(event) => setSupplierField("cnpj", maskCnpj(event.target.value))}
                      className="input-field w-full"
                      placeholder="00.000.000/0000-00"
                    />
                  </label>
                </div>
              </section>

              <AddressContactFields
                value={{
                  cep: supplierDraft.cep,
                  city: supplierDraft.city,
                  state: supplierDraft.state,
                  address: supplierDraft.address,
                  neighborhood: supplierDraft.neighborhood,
                  streetComplement: supplierDraft.streetComplement,
                  number: supplierDraft.number,
                  referencePoint: supplierDraft.referencePoint,
                  telephone: supplierDraft.telephone,
                  cellphone: supplierDraft.cellphone,
                  email: supplierDraft.email,
                }}
                loadingCep={loadingSupplierCep}
                onFillAddressFromCep={fillSupplierAddressFromCep}
                onChange={(field, fieldValue) => setSupplierField(field, fieldValue)}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border-primary px-4 py-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSupplierModalOpen(false)}
                className="btn-cancel"
              >
                Cancelar
              </button>
              <button type="submit" disabled={savingSupplier} className="btn-primary">
                {savingSupplier ? "Salvando..." : "Salvar fornecedor"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default function ProductRegisterPage() {
  const statusDialog = useStatusDialog();
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() => new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM);

  useEffect(() => {
    productService
      .list()
      .then(setProducts)
      .catch(() => {
        Toast.error("Não foi possível carregar produtos da API.");
      });
    supplierService
      .list()
      .then((items) =>
        setSupplierOptions(
          items
            .map((item) => item.fantasyName || item.companyName)
            .filter((supplierName) => supplierName.trim().length > 0),
        ),
      )
      .catch(() => setSupplierOptions([]));
  }, []);

  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter(
      (product) =>
        product.productName.toLowerCase().includes(normalized) ||
        product.productCode.toLowerCase().includes(normalized),
    );
  }, [products, search]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProducts = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, itemsPerPage, safeCurrentPage]);
  const selectedProductsOnPage = paginatedProducts.filter((product) =>
    selectedProductIds.has(product.id),
  );
  const allProductsOnPageSelected =
    paginatedProducts.length > 0 && selectedProductsOnPage.length === paginatedProducts.length;

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleCurrentPageSelection = () => {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (allProductsOnPageSelected) {
        paginatedProducts.forEach((product) => next.delete(product.id));
      } else {
        paginatedProducts.forEach((product) => next.add(product.id));
      }
      return next;
    });
  };

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
    try {
      await productService.remove(product.id);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setSelectedProductIds((current) => {
        const next = new Set(current);
        next.delete(product.id);
        return next;
      });
      statusDialog.success("Produto excluído com sucesso.");
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Erro ao excluir produto.");
    }
  };

  const handleBulkDelete = async () => {
    const selectedIds = Array.from(selectedProductIds);
    if (selectedIds.length === 0) return;

    const confirmed = await statusDialog.confirm(
      `Excluir ${selectedIds.length} produto(s) selecionado(s)?`,
    );
    if (!confirmed) return;

    const results = await Promise.allSettled(
      selectedIds.map(async (productId) => {
        await productService.remove(productId);
        return productId;
      }),
    );
    const removedIds = results
      .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
      .map((result) => result.value);

    if (removedIds.length > 0) {
      const removedIdSet = new Set(removedIds);
      setProducts((current) => current.filter((product) => !removedIdSet.has(product.id)));
      setSelectedProductIds((current) => {
        const next = new Set(current);
        removedIds.forEach((productId) => next.delete(productId));
        return next;
      });
    }

    const failedCount = selectedIds.length - removedIds.length;
    if (failedCount > 0) {
      Toast.error(`${failedCount} produto(s) não puderam ser excluído(s).`);
      return;
    }

    Toast.success("Produtos selecionados excluídos com sucesso.");
  };

  const handleCreateSupplier = async (draft: QuickSupplierDraft) => {
    const payload: SupplierPayload = {
      companyName: draft.companyName.trim(),
      fantasyName: draft.fantasyName.trim(),
      cnpj: draft.cnpj.trim(),
      cep: draft.cep.trim(),
      city: draft.city.trim(),
      state: draft.state.trim(),
      address: draft.address.trim(),
      neighborhood: draft.neighborhood.trim(),
      streetComplement: draft.streetComplement.trim(),
      number: draft.number.trim(),
      referencePoint: draft.referencePoint.trim(),
      telephone: draft.telephone.trim(),
      cellphone: draft.cellphone.trim(),
      email: draft.email.trim(),
    };

    try {
      const created = await supplierService.create(payload);
      if (!created) return null;

      const supplierName = created.fantasyName || created.companyName;
      setSupplierOptions((current) =>
        current.includes(supplierName) ? current : [supplierName, ...current],
      );
      Toast.success("Fornecedor cadastrado com sucesso.");
      return supplierName;
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Erro ao cadastrar fornecedor.");
      return null;
    }
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

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      if (editingId) {
        const updated = await productService.update(editingId, form);
        if (!updated) return;
        setProducts((current) =>
          current.map((product) => (product.id === editingId ? updated : product)),
        );
        Toast.success("Produto atualizado com sucesso.");
      } else {
        const created = await productService.create(form);
        if (!created) return;
        setProducts((current) => [created, ...current]);
        Toast.success("Produto cadastrado com sucesso.");
      }
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Erro ao salvar produto.");
      return;
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
            onChange={(event) => {
              setSearch(event.target.value);
              setCurrentPage(1);
              setSelectedProductIds(new Set());
            }}
            className="input-field w-full pl-9"
            placeholder="Pesquise por nome ou código do produto"
          />
        </label>
      </section>

      <section className="card overflow-hidden">
        {selectedProductIds.size > 0 ? (
          <div className="flex flex-col gap-2 border-b border-border-primary bg-primary/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-text-primary">
              {selectedProductIds.size} produto(s) selecionado(s)
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
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-bg-primary text-left text-text-secondary">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allProductsOnPageSelected}
                    onChange={toggleCurrentPageSelection}
                    aria-label="Selecionar produtos desta página"
                    className="h-4 w-4 rounded border-border-secondary accent-accent"
                  />
                </th>
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
              {paginatedProducts.map((product) => (
                <tr key={product.id} className="border-t border-border-primary">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.has(product.id)}
                      onChange={() => toggleProductSelection(product.id)}
                      aria-label={`Selecionar ${product.productName}`}
                      className="h-4 w-4 rounded border-border-secondary accent-accent"
                    />
                  </td>
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
        <div className="px-4 py-4">
          <TablePagination
            totalItems={filteredProducts.length}
            currentPage={safeCurrentPage}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(value) => {
              setItemsPerPage(value);
              setCurrentPage(1);
              setSelectedProductIds(new Set());
            }}
          />
        </div>
      </section>

      <ProductFormDrawer
        open={drawerOpen}
        isEditMode={editingId !== null}
        value={form}
        onClose={() => setDrawerOpen(false)}
        onChange={setForm}
        onSave={handleSave}
        supplierOptions={supplierOptions}
        onCreateSupplier={handleCreateSupplier}
      />
      {statusDialog.Dialog}
    </PageLayout>
  );
}
