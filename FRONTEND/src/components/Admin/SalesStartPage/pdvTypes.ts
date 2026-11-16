/**
 * Arquivo: src/components/Admin/SalesStartPage/pdvTypes.ts
 * Objetivo: tipos puros, formatadores e resolvedores de busca/leitura para a frente de caixa.
 * Entradas esperadas: produtos e itens do carrinho do PDV (compatível com execução direta em Node --test).
 */

export type PdvProduct = {
  id: string;
  name: string;
  code: string;
  stock: number;
  salePrice: number;
  imageUrl?: string;
};

export type PdvCartItem = {
  id: string;
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type ProductSubmissionResolution =
  | { type: "add"; product: PdvProduct }
  | { type: "select_option"; product: PdvProduct }
  | { type: "not_found" };

export function normalizeQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 0;
  return Math.round(quantity * 1000) / 1000;
}

export function formatQuantity(quantity: number): string {
  const normalized = normalizeQuantity(quantity);
  if (Number.isInteger(normalized)) {
    return String(normalized);
  }
  return normalized.toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

export function formatTotalVolumes(total: number): string {
  const normalized = normalizeQuantity(total);
  if (normalized <= 0) return "0000";
  if (Number.isInteger(normalized)) {
    return String(normalized).padStart(4, "0");
  }
  return normalized.toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

export function findExactProductByCode(rawQuery: string, products: PdvProduct[]): PdvProduct | null {
  const normalized = rawQuery.trim().toLowerCase();
  if (!normalized) return null;
  return products.find((item) => item.code.trim().toLowerCase() === normalized) ?? null;
}

export function filterProductsByQuery(rawQuery: string, products: PdvProduct[]): PdvProduct[] {
  const normalized = rawQuery.trim().toLowerCase();
  if (!normalized) return products;
  return products.filter(
    (item) =>
      item.name.toLowerCase().includes(normalized) ||
      item.code.toLowerCase().includes(normalized),
  );
}

export function resolveProductSubmission(params: {
  query: string;
  products: PdvProduct[];
  selectedProduct: PdvProduct | null;
  showProductOptions: boolean;
  highlightedProductIndex: number;
  allowFuzzyFallback: boolean;
}): ProductSubmissionResolution {
  const trimmed = params.query.trim();
  const normalized = trimmed.toLowerCase();

  if (
    params.selectedProduct &&
    (normalized === "" ||
      params.selectedProduct.name.trim().toLowerCase() === normalized ||
      params.selectedProduct.code.trim().toLowerCase() === normalized)
  ) {
    return { type: "add", product: params.selectedProduct };
  }

  const exactCode = findExactProductByCode(trimmed, params.products);
  if (exactCode) {
    return { type: "add", product: exactCode };
  }

  const filtered = filterProductsByQuery(trimmed, params.products);
  if (
    params.showProductOptions &&
    !params.allowFuzzyFallback &&
    params.highlightedProductIndex >= 0 &&
    params.highlightedProductIndex < filtered.length
  ) {
    return { type: "select_option", product: filtered[params.highlightedProductIndex] };
  }

  if (params.allowFuzzyFallback && normalized.length > 0) {
    const exactName = filtered.find((item) => item.name.trim().toLowerCase() === normalized);
    if (exactName) {
      return { type: "add", product: exactName };
    }
    if (filtered.length > 0) {
      return { type: "add", product: filtered[0] };
    }
  }

  return { type: "not_found" };
}
