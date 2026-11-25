/**
 * Arquivo: src/pages/Admin/ProductRegisterPage.tsx
 * Objetivo: gerencia cadastro rápido de produtos com categorias, busca por código de barras, duplicação e atalhos.
 * Entradas esperadas: não recebe props; opera com estado local de lista, filtros de categoria e formulário em drawer.
 */

import { Copy, FileSpreadsheet, Pencil, Plus, Search, Tag, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/Admin/PageHeader";
import ProductFormDrawer, {
  type ProductFormData,
  type ProductFormItem,
  type QuickSupplierDraft,
} from "@/components/Admin/ProductRegisterPage/ProductFormDrawer";
import ProductImportDrawer from "@/components/Admin/ProductRegisterPage/ProductImportDrawer";
import RowActionsMenu from "@/components/Admin/RowActionsMenu";
import LoadingButton from "@/components/Loading/LoadingButton";
import TablePagination from "@/components/Pagination/TablePagination";
import { Toast, useStatusDialog } from "@/hooks/Dialog";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";
import PageLayout from "@/layout/PageLayout";
import { productService } from "@/services/api/productService";
import { supplierService, type SupplierPayload } from "@/services/api/supplierService";
import { formatQuantityPtBr } from "@/utils/scaleBarcode";

const EMPTY_FORM: ProductFormData = {
  productImageUrl: "",
  productImageName: "",
  productName: "",
  productCode: "",
  productSupplier: "",
  productCategory: "",
  productDescription: "",
  productQnt: "",
  productUnitPrice: "",
  productSalePrice: "",
  totalPriceOnProduct: "",
  unitType: "UN",
};

const DEFAULT_SUGGESTED_CATEGORIES = [
  "Bebidas",
  "Mercearia",
  "Padaria",
  "Hortifruti",
  "Laticínios",
  "Doces e Biscoitos",
  "Salgadinhos e Snacks",
  "Limpeza",
  "Higiene Pessoal",
  "Outros",
];

function normalizeProduct(item: {
  id: string;
  productImageUrl: string;
  productImageName: string;
  productName: string;
  productCode: string;
  productSupplier: string;
  productCategory?: string;
  productDescription: string;
  productQnt: string;
  productUnitPrice: string;
  productSalePrice: string;
  totalPriceOnProduct: string;
  unitType?: string;
}): ProductFormItem {
  return {
    ...item,
    productCategory: item.productCategory ?? "",
    unitType: item.unitType === "KG" ? "KG" : "UN",
  };
}

export default function ProductRegisterPage() {
  const statusDialog = useStatusDialog();
  const { parseMoneyBr } = useInputMasks();
  const [products, setProducts] = useState<ProductFormItem[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() => new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [importDrawerOpen, setImportDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deletingProductIds, setDeletingProductIds] = useState<Set<string>>(() => new Set());
  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM);
  const [pinCategory, setPinCategory] = useState(false);
  const [focusResetToken, setFocusResetToken] = useState(0);

  const loadProducts = useCallback(async () => {
    try {
      const items = await productService.list();
      setProducts(items.map(normalizeProduct));
    } catch {
      Toast.error("Não foi possível carregar produtos da API.");
    }
  }, []);

  useEffect(() => {
    productService
      .list()
      .then((items) => setProducts(items.map(normalizeProduct)))
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

  const existingCategories = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((product) => {
      const cat = product.productCategory.trim();
      if (!cat) return;
      map.set(cat, (map.get(cat) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [products]);

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    const addUnique = (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      list.push(trimmed);
    };
    existingCategories.forEach(([name]) => addUnique(name));
    DEFAULT_SUGGESTED_CATEGORIES.forEach(addUnique);
    return list;
  }, [existingCategories]);

  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return products.filter((product) => {
      if (selectedCategoryFilter === "__NONE__" && product.productCategory.trim()) {
        return false;
      }
      if (
        selectedCategoryFilter !== "ALL" &&
        selectedCategoryFilter !== "__NONE__" &&
        product.productCategory.trim().toLowerCase() !== selectedCategoryFilter.toLowerCase()
      ) {
        return false;
      }

      if (!normalized) return true;
      return (
        product.productName.toLowerCase().includes(normalized) ||
        product.productCode.toLowerCase().includes(normalized) ||
        product.productCategory.toLowerCase().includes(normalized) ||
        product.productSupplier.toLowerCase().includes(normalized)
      );
    });
  }, [products, search, selectedCategoryFilter]);

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

  const openCreateDrawer = useCallback(() => {
    setEditingId(null);
    setForm((current) => ({
      ...EMPTY_FORM,
      productCategory:
        pinCategory
          ? current.productCategory
          : selectedCategoryFilter !== "ALL" && selectedCategoryFilter !== "__NONE__"
            ? selectedCategoryFilter
            : "",
    }));
    setFocusResetToken((token) => token + 1);
    setDrawerOpen(true);
  }, [pinCategory, selectedCategoryFilter]);

  const openEditDrawer = useCallback((product: ProductFormItem) => {
    setEditingId(product.id);
    setForm({
      ...product,
      productCategory: product.productCategory ?? "",
      unitType: product.unitType === "KG" ? "KG" : "UN",
    });
    setFocusResetToken((token) => token + 1);
    setDrawerOpen(true);
  }, []);

  const openDuplicateDrawer = useCallback((product: ProductFormItem) => {
    setEditingId(null);
    setForm({
      ...product,
      productCode: "",
      productName: `${product.productName} (cópia)`,
      productCategory: product.productCategory ?? "",
      unitType: product.unitType === "KG" ? "KG" : "UN",
    });
    setFocusResetToken((token) => token + 1);
    setDrawerOpen(true);
    Toast.info("Produto duplicado. Informe o novo código/nome e salve.");
  }, []);

  useEffect(() => {
    const handleGlobalShortcut = (event: KeyboardEvent) => {
      if (drawerOpen || importDrawerOpen) return;
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
    window.addEventListener("keydown", handleGlobalShortcut);
    return () => window.removeEventListener("keydown", handleGlobalShortcut);
  }, [drawerOpen, importDrawerOpen, openCreateDrawer]);

  const handleDelete = async (product: ProductFormItem) => {
    const confirmed = await statusDialog.confirm(
      `Deseja excluir o produto "${product.productName}"?`,
    );
    if (!confirmed) return;
    setDeletingProductIds((current) => new Set(current).add(product.id));
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
    } finally {
      setDeletingProductIds((current) => {
        const next = new Set(current);
        next.delete(product.id);
        return next;
      });
    }
  };

  const handleBulkDelete = async () => {
    const selectedIds = Array.from(selectedProductIds);
    if (selectedIds.length === 0) return;

    const confirmed = await statusDialog.confirm(
      `Excluir ${selectedIds.length} produto(s) selecionado(s)?`,
    );
    if (!confirmed) return;

    setBulkDeleting(true);
    setDeletingProductIds((current) => new Set([...current, ...selectedIds]));
    const results = await Promise.allSettled(
      selectedIds.map(async (productId) => {
        await productService.remove(productId);
        return productId;
      }),
    );
    setBulkDeleting(false);
    setDeletingProductIds((current) => {
      const next = new Set(current);
      selectedIds.forEach((productId) => next.delete(productId));
      return next;
    });
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

  const validateForm = useCallback(() => {
    if (form.productName.trim().length < 2) {
      Toast.error("Informe o nome do produto (mínimo 2 caracteres).");
      return false;
    }

    if (form.productSalePrice.trim()) {
      const salePrice = parseMoneyBr(form.productSalePrice);
      if (!Number.isFinite(salePrice) || salePrice < 0) {
        Toast.error("O preço de venda não pode ser negativo.");
        return false;
      }
    }

    if (form.productQnt.trim()) {
      const qnt = Number(String(form.productQnt).replace(",", "."));
      if (!Number.isFinite(qnt) || qnt < 0) {
        Toast.error("A quantidade em estoque não pode ser negativa.");
        return false;
      }
    }

    return true;
  }, [form.productName, form.productQnt, form.productSalePrice, parseMoneyBr]);

  const handleSave = useCallback(
    async (options?: { keepOpen?: boolean }) => {
      if (!validateForm()) return;

      const payload: ProductFormData = {
        ...form,
        productName: form.productName.trim(),
        productCode: form.productCode.trim(),
        productCategory: form.productCategory.trim(),
        productSupplier: form.productSupplier.trim(),
        productDescription: form.productDescription.trim(),
        productQnt: form.productQnt.trim() || "0",
        productUnitPrice: form.productUnitPrice.trim() || "0,00",
        productSalePrice: form.productSalePrice.trim() || "0,00",
      };

      setSaving(true);
      try {
        if (editingId) {
          const updated = await productService.update(editingId, payload);
          if (!updated) return;
          const normalizedUpdated = normalizeProduct(updated);
          setProducts((current) =>
            current.map((product) => (product.id === editingId ? normalizedUpdated : product)),
          );
          Toast.success("Produto atualizado com sucesso.");
        } else {
          const created = await productService.create(payload);
          if (!created) return;
          const normalizedCreated = normalizeProduct(created);
          setProducts((current) => [normalizedCreated, ...current]);
          Toast.success(
            !payload.productCode
              ? `Produto cadastrado com código interno ${normalizedCreated.productCode}.`
              : "Produto cadastrado com sucesso.",
          );
        }
      } catch (error) {
        Toast.error(error instanceof Error ? error.message : "Erro ao salvar produto.");
        return;
      } finally {
        setSaving(false);
      }

      if (options?.keepOpen && !editingId) {
        setForm({
          ...EMPTY_FORM,
          productCategory: pinCategory ? payload.productCategory : "",
        });
        setFocusResetToken((token) => token + 1);
        return;
      }

      setDrawerOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    },
    [editingId, form, pinCategory, validateForm],
  );

  const uncategorizedCount = useMemo(
    () => products.filter((product) => !product.productCategory.trim()).length,
    [products],
  );

  return (
    <PageLayout className="space-y-4 py-4 md:space-y-6 md:py-6 lg:py-8">
      <PageHeader
        title="Cadastro de Produto"
        description="Cadastre produtos formais ou informais com busca automática por código de barras e agrupamento por categorias."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setImportDrawerOpen(true)}
              className="btn-outline-secondary inline-flex items-center gap-2"
            >
              <FileSpreadsheet size={16} />
              Importar Planilha
            </button>
            <button
              type="button"
              onClick={openCreateDrawer}
              className="btn-primary inline-flex items-center gap-2"
              title="Atalho: F2 ou Alt+N"
            >
              <Plus size={16} />
              Novo produto (F2)
            </button>
          </div>
        }
      />

      <section className="card space-y-3 p-4 md:p-5">
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
            placeholder="Pesquise por nome, código, categoria ou fornecedor"
          />
        </label>

        {existingCategories.length > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setSelectedCategoryFilter("ALL");
                setCurrentPage(1);
              }}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition ${
                selectedCategoryFilter === "ALL"
                  ? "border-accent bg-accent text-white"
                  : "border-border-secondary bg-bg-primary text-text-secondary hover:bg-hover-light"
              }`}
            >
              Todas ({products.length})
            </button>
            {existingCategories.map(([category, count]) => (
              <button
                key={category}
                type="button"
                onClick={() => {
                  setSelectedCategoryFilter(category);
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  selectedCategoryFilter === category
                    ? "border-accent bg-accent text-white"
                    : "border-border-secondary bg-bg-primary text-text-secondary hover:bg-hover-light"
                }`}
              >
                <Tag size={11} />
                {category} ({count})
              </button>
            ))}
            {uncategorizedCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryFilter("__NONE__");
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  selectedCategoryFilter === "__NONE__"
                    ? "border-accent bg-accent text-white"
                    : "border-border-secondary bg-bg-primary text-text-secondary hover:bg-hover-light"
                }`}
              >
                Sem categoria ({uncategorizedCount})
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="card overflow-hidden">
        {selectedProductIds.size > 0 ? (
          <div className="flex flex-col gap-2 border-b border-border-primary bg-primary/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-text-primary">
              {selectedProductIds.size} produto(s) selecionado(s)
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
          <table className="w-full min-w-[980px] text-sm">
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
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Fornecedor</th>
                <th className="px-4 py-3">Estoque</th>
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
                  <td className="px-4 py-3 font-medium text-text-primary">{product.productName}</td>
                  <td className="px-4 py-3">
                    {product.productCategory ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                        <Tag size={11} />
                        {product.productCategory}
                      </span>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{product.productCode}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {product.productSupplier || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {formatQuantityPtBr(Number(String(product.productQnt).replace(",", ".")))} {product.unitType}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {parseMoneyBr(product.productSalePrice) > 0 ? (
                      product.productSalePrice
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                        Avulso no caixa
                      </span>
                    )}
                  </td>
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
                          key: "duplicate",
                          label: "Duplicar",
                          icon: <Copy size={13} />,
                          onClick: () => openDuplicateDrawer(product),
                        },
                        {
                          key: "delete",
                          label: "Excluir",
                          icon: <Trash2 size={13} />,
                          onClick: () => handleDelete(product),
                          loading: deletingProductIds.has(product.id),
                          loadingLabel: "Excluindo...",
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
        key={`${editingId ?? "new"}-${focusResetToken}`}
        open={drawerOpen}
        isEditMode={editingId !== null}
        editingId={editingId}
        value={form}
        isSaving={saving}
        focusResetToken={focusResetToken}
        pinCategory={pinCategory}
        onTogglePinCategory={() => setPinCategory((current) => !current)}
        onClose={() => setDrawerOpen(false)}
        onChange={setForm}
        onSave={handleSave}
        onEditExisting={openEditDrawer}
        existingProducts={products}
        categoryOptions={categoryOptions}
        supplierOptions={supplierOptions}
        onCreateSupplier={handleCreateSupplier}
      />
      <ProductImportDrawer
        open={importDrawerOpen}
        onClose={() => setImportDrawerOpen(false)}
        onImported={loadProducts}
      />
      {statusDialog.Dialog}
    </PageLayout>
  );
}
