/**
 * Arquivo: src/components/Admin/SalesStartPage/index.ts
 * Objetivo: reexporta componentes e tipos da frente de caixa.
 */
export { default as HighVisibilityWrapper } from "./HighVisibilityWrapper";
export { default as LastScannedCard } from "./LastScannedCard";
export { default as TotalBanner } from "./TotalBanner";
export { default as CartItemsTable } from "./CartItemsTable";
export {
  findExactProductByCode,
  filterProductsByQuery,
  formatQuantity,
  formatTotalVolumes,
  getCartLineKey,
  getCartLineTotal,
  getLiquidationCostPrice,
  normalizeQuantity,
  resolveProductSubmission,
  type PdvCartItem,
  type PdvProduct,
  type ProductSubmissionResolution,
} from "./pdvTypes";
