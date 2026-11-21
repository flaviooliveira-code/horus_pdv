/**
 * Arquivo: src/components/Admin/ReportsPage/reportsConfig.ts
 * Objetivo: define tipos e catálogo estático de relatórios disponíveis no módulo de relatórios.
 * Entradas esperadas: não recebe props; exporta estruturas de configuração consumidas pela UI.
 */

import {
  BarChart3,
  Boxes,
  Calculator,
  FileChartColumnIncreasing,
  HandCoins,
  Landmark,
  PackageSearch,
  ShoppingCart,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ReportFilterType = "date" | "time" | "select" | "multiselect" | "checkbox";

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
  /** Só administrador, gerente e financeiro (a API responde 403 para os demais). */
  supervisorOnly?: boolean;
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

const profitViewModeOptions: ReportFilterOption[] = [
  { label: "Por Período", value: "period" },
  { label: "Por Produto", value: "product" },
];

const dreRegimeOptions: ReportFilterOption[] = [
  { label: "Regime de Competência", value: "competencia" },
  { label: "Regime de Caixa (Pagas)", value: "caixa" },
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
    id: "lucro-real",
    title: "Lucro Bruto e CMV",
    description: "Apura receita bruta, custo das mercadorias vendidas (CMV), lucro bruto e margem real por período ou produto.",
    icon: Calculator,
    supervisorOnly: true,
    filters: [
      ...periodFilters,
      { id: "viewMode", label: "Visão de análise", type: "select", options: profitViewModeOptions },
      { id: "groupBy", label: "Agrupar período por", type: "select", options: groupByOptions },
      {
        id: "paymentMethod",
        label: "Forma de pagamento",
        type: "multiselect",
        options: paymentMethodOptions,
      },
    ],
  },
  {
    id: "dre-simplificado",
    title: "DRE Simplificado (Lucro Líquido)",
    description: "Demonstração do resultado do exercício com Receita Bruta, CMV, Lucro Bruto, Despesas Operacionais e Lucro Líquido.",
    icon: Landmark,
    supervisorOnly: true,
    filters: [
      ...periodFilters,
      { id: "regime", label: "Regime contábil", type: "select", options: dreRegimeOptions },
      {
        id: "paymentMethod",
        label: "Forma de pagamento (Vendas)",
        type: "multiselect",
        options: paymentMethodOptions,
      },
    ],
  },
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
      { id: "startTime", label: "Hora inicial", type: "time" },
      { id: "endTime", label: "Hora final", type: "time" },
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

