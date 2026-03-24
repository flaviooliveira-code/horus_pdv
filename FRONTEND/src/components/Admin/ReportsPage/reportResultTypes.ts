/**
 * Arquivo: src/components/Admin/ReportsPage/reportResultTypes.ts
 * Objetivo: centraliza tipos de saída e estrutura de filtros para resultados de relatório.
 * Entradas esperadas: não recebe props; expõe aliases de tipos reutilizados pelos componentes.
 */

export type ReportFilterValues = Record<string, string | string[] | boolean>;

export type ReportResultColumn = {
  key: string;
  label: string;
};

export type ReportResultRow = Record<string, string | number>;
