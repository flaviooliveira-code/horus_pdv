/**
 * Arquivo: src/components/Admin/ReportsPage/reportsConfig.ts
 * Objetivo: define tipos e catálogo estático de relatórios disponíveis no módulo de relatórios.
 * Entradas esperadas: não recebe props; exporta estruturas de configuração consumidas pela UI.
 */

import {
  BarChart3,
  Boxes,
  FileChartColumnIncreasing,
  HandCoins,
  PackageSearch,
  ShoppingCart,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ReportFilterType = "date" | "select" | "multiselect" | "checkbox";

export type ReportFilterOption = {
  label: string;
  value: string;
};

export type ReportFilter = {
  id: string;
  label: string;
  type: ReportFilterType;
  options?: ReportFilterOption[];
};

export type ReportDefinition = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  filters: ReportFilter[];
};

const periodFilters: ReportFilter[] = [
  { id: "startDate", label: "Data inicial", type: "date" },
  { id: "endDate", label: "Data final", type: "date" },
];

const groupByOptions: ReportFilterOption[] = [
  { label: "Diário", value: "daily" },
  { label: "Semanal", value: "weekly" },
  { label: "Mensal", value: "monthly" },
];

const paymentMethodOptions: ReportFilterOption[] = [
  { label: "Todos", value: "all" },
  { label: "Dinheiro", value: "cash" },
  { label: "PIX", value: "pix" },
  { label: "Cartão de Débito", value: "debit" },
  { label: "Cartão de Crédito", value: "credit" },
];

const categoryOptions: ReportFilterOption[] = [
  { label: "Todas", value: "all" },
  { label: "Bebidas", value: "bebidas" },
  { label: "Alimentos", value: "alimentos" },
  { label: "Limpeza", value: "limpeza" },
  { label: "Higiene", value: "higiene" },
];

export const reportCatalog: ReportDefinition[] = [
  {
    id: "vendas-periodo",
    title: "Vendas por Período",
    description: "Consolida faturamento, ticket médio e quantidade de vendas no período.",
    icon: FileChartColumnIncreasing,
    filters: [
      ...periodFilters,
      { id: "groupBy", label: "Agrupar por", type: "select", options: groupByOptions },
      {
        id: "paymentMethod",
        label: "Forma de pagamento",
        type: "multiselect",
        options: paymentMethodOptions,
      },
    ],
  },
  {
    id: "historico-vendas",
    title: "Histórico de Vendas",
    description: "Lista detalhada das vendas com cliente, itens e forma de pagamento.",
    icon: ShoppingCart,
    filters: [
      ...periodFilters,
      { id: "paymentMethod", label: "Forma de pagamento", type: "select", options: paymentMethodOptions },
      { id: "onlyCanceled", label: "Incluir canceladas", type: "checkbox" },
    ],
  },
  {
    id: "produtos-mais-vendidos",
    title: "Produtos Mais Vendidos",
    description: "Ranking de produtos por quantidade vendida e faturamento.",
    icon: TrendingUp,
    filters: [
      ...periodFilters,
      { id: "category", label: "Categoria", type: "select", options: categoryOptions },
      { id: "groupBy", label: "Agrupar por", type: "select", options: groupByOptions },
    ],
  },
  {
    id: "clientes-frequentes",
    title: "Clientes Mais Frequentes",
    description: "Mostra clientes com maior recorrência de compra e gasto médio.",
    icon: Users,
    filters: [
      ...periodFilters,
      { id: "paymentMethod", label: "Forma de pagamento", type: "select", options: paymentMethodOptions },
    ],
  },
  {
    id: "estoque-critico",
    title: "Estoque Crítico",
    description: "Identifica produtos abaixo do estoque mínimo para reposição.",
    icon: PackageSearch,
    filters: [
      { id: "category", label: "Categoria", type: "select", options: categoryOptions },
      { id: "onlyOutOfStock", label: "Somente sem estoque", type: "checkbox" },
    ],
  },
  {
    id: "compras-fornecedor",
    title: "Compras por Fornecedor",
    description: "Resumo de compras e custo por fornecedor para análise de margem.",
    icon: HandCoins,
    filters: [
      ...periodFilters,
      { id: "category", label: "Categoria", type: "select", options: categoryOptions },
    ],
  },
  {
    id: "movimento-estoque",
    title: "Movimento de Estoque",
    description: "Entradas e saídas por produto para acompanhar giro e rupturas.",
    icon: Boxes,
    filters: [
      ...periodFilters,
      { id: "category", label: "Categoria", type: "select", options: categoryOptions },
      { id: "groupBy", label: "Agrupar por", type: "select", options: groupByOptions },
    ],
  },
  {
    id: "desempenho-caixa",
    title: "Desempenho de Caixa",
    description: "Analisa abertura, fechamento e variação por operador de caixa.",
    icon: BarChart3,
    filters: [
      ...periodFilters,
      { id: "paymentMethod", label: "Forma de pagamento", type: "select", options: paymentMethodOptions },
    ],
  },
];
