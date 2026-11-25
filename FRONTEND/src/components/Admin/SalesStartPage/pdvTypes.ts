/**
 * Arquivo: src/components/Admin/SalesStartPage/pdvTypes.ts
 * Objetivo: tipos puros, formatadores e resolvedores de busca/leitura para a frente de caixa.
 * Entradas esperadas: produtos e itens do carrinho do PDV (compatível com execução direta em Node --test).
 */

import { computeLineTotal } from "../../../utils/scaleBarcode.ts";

export type PdvProduct = {
  id: string;
  name: string;
  code: string;
  stock: number;
  salePrice: number;
  unitCost?: number;
  imageUrl?: string;
  unitType?: string;
  category?: string;
  expirationMode?: string;
  expirationDate?: string;
  expirationStatus?: "NONE" | "OK" | "EXPIRING_SOON" | "EXPIRED";
  daysUntilExpiration?: number | null;
};

export type PdvCartItem = {
  id: string;
  /** Identifica a linha quando o mesmo produto aparece mais de uma vez (etiquetas de balança ou preço avulso). */
  lineId?: string;
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number;
  expirationDate?: string;
  expirationStatus?: "NONE" | "OK" | "EXPIRING_SOON" | "EXPIRED";
  daysUntilExpiration?: number | null;
  /** Preço unitário avulso informado no caixa (ex.: produtos fatiados ou sem preço fixo). */
  unitPriceOverride?: number;
  /** Total impresso na etiqueta da balança; o servidor valida contra o preço cadastrado. */
  itemTotalOverride?: number;
};

export function getCartLineKey(item: Pick<PdvCartItem, "id" | "lineId">): string {
  return item.lineId ?? item.id;
}

/**
 * Preço de custo que qualquer perfil pode usar no caixa: só para produto vencido ou que vence em até 7 dias
 * (espelha HistoricoVendasAB.ResolveLiquidationCostPrice). Fora disso, retorna undefined.
 */
export function getLiquidationCostPrice(
  product: Pick<PdvProduct, "unitCost" | "expirationStatus">,
): number | undefined {
  const isExpiring =
    product.expirationStatus === "EXPIRED" || product.expirationStatus === "EXPIRING_SOON";
  if (!isExpiring || !product.unitCost || product.unitCost <= 0) return undefined;
  return Math.round(product.unitCost * 100) / 100;
}

export function getCartLineTotal(
  item: Pick<PdvCartItem, "quantity" | "unitPrice" | "itemTotalOverride">,
): number {
  return item.itemTotalOverride ?? computeLineTotal(item.unitPrice, item.quantity);
}

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

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function filterProductsByQuery(rawQuery: string, products: PdvProduct[]): PdvProduct[] {
  const normalized = normalizeSearchText(rawQuery);
  if (!normalized) return products;
  const terms = normalized.split(/\s+/).filter(Boolean);
  return products.filter((item) => {
    const haystack = normalizeSearchText(
      `${item.code} ${item.name} ${item.category ?? ""}`,
    );
    return terms.every((term) => haystack.includes(term));
  });
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
