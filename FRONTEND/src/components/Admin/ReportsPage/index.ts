/**
 * Arquivo: src/components/Admin/ReportsPage/index.ts
 * Objetivo: concentra exportações públicas da feature de relatórios.
 * Entradas esperadas: não recebe props; atua como barril de reexportação.
 */

export { default as ReportCardsGrid } from "./ReportCardsGrid";
export { default as ReportFiltersView } from "./ReportFiltersView";
export { reportCatalog, type ReportDefinition } from "./reportsConfig";
