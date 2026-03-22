import type {
  ReportFilterValues,
  ReportResultColumn,
  ReportResultRow,
} from "./reportResultTypes";

type ReportResultPayload = {
  columns: ReportResultColumn[];
  rows: ReportResultRow[];
};

function resolveLabel(value: string, map: Record<string, string>) {
  return map[value] ?? value;
}

function getFilterString(filters: ReportFilterValues, key: string, fallback = "all") {
  const value = filters[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function getFilterArray(filters: ReportFilterValues, key: string) {
  const value = filters[key];
  return Array.isArray(value) ? value : [];
}

function getPeriodLabel(filters: ReportFilterValues) {
  const startDate = getFilterString(filters, "startDate", "");
  const endDate = getFilterString(filters, "endDate", "");
  if (!startDate || !endDate) return "Período não informado";
  return `${startDate} a ${endDate}`;
}

const paymentMethodLabel: Record<string, string> = {
  all: "Todos",
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Cartão de Débito",
  credit: "Cartão de Crédito",
};

const categoryLabel: Record<string, string> = {
  all: "Todas",
  bebidas: "Bebidas",
  alimentos: "Alimentos",
  limpeza: "Limpeza",
  higiene: "Higiene",
};

export function generateReportResult(
  reportId: string,
  filters: ReportFilterValues,
): ReportResultPayload {
  const period = getPeriodLabel(filters);
  const payment = resolveLabel(getFilterString(filters, "paymentMethod"), paymentMethodLabel);
  const category = resolveLabel(getFilterString(filters, "category"), categoryLabel);
  const paymentListRaw = getFilterArray(filters, "paymentMethod");
  const paymentList =
    paymentListRaw.length > 0
      ? paymentListRaw.map((item) => resolveLabel(item, paymentMethodLabel))
      : ["Dinheiro", "PIX", "Cartão de Débito", "Cartão de Crédito"];

  switch (reportId) {
    case "vendas-periodo":
      return {
        columns: [
          { key: "periodo", label: "Período" },
          { key: "formaPagamento", label: "Forma de Pagamento" },
          { key: "quantidadeVendas", label: "Qtd. Vendas" },
          { key: "faturamento", label: "Faturamento" },
          { key: "ticketMedio", label: "Ticket Médio" },
        ],
        rows: paymentList.map((item, index) => ({
          periodo: period,
          formaPagamento: item,
          quantidadeVendas: 62 - index * 7,
          faturamento: `R$ ${(18350 - index * 2100).toLocaleString("pt-BR")},00`,
          ticketMedio: `R$ ${(296 - index * 12).toLocaleString("pt-BR")},00`,
        })),
      };

    case "historico-vendas":
      return {
        columns: [
          { key: "numeroVenda", label: "Número da Venda" },
          { key: "cliente", label: "Cliente" },
          { key: "produto", label: "Produto" },
          { key: "qtd", label: "QNT" },
          { key: "formaPagamento", label: "Pagamento" },
          { key: "data", label: "Data" },
          { key: "status", label: "Status" },
        ],
        rows: [
          {
            numeroVenda: "15039",
            cliente: "Ana Martins",
            produto: "Café Tradicional 500g",
            qtd: 3,
            formaPagamento: payment,
            data: "2026-03-21 14:12:08",
            status: "Concluída",
          },
          {
            numeroVenda: "15038",
            cliente: "Lucas Souza",
            produto: "Achocolatado 400g",
            qtd: 1,
            formaPagamento: payment,
            data: "2026-03-21 13:42:11",
            status: filters.onlyCanceled === true ? "Cancelada" : "Concluída",
          },
        ],
      };

    case "produtos-mais-vendidos":
      return {
        columns: [
          { key: "categoria", label: "Categoria" },
          { key: "produto", label: "Produto" },
          { key: "codigo", label: "Código" },
          { key: "qtdVendida", label: "Qtd. Vendida" },
          { key: "faturamento", label: "Faturamento" },
        ],
        rows: [
          {
            categoria: category,
            produto: "Café Tradicional 500g",
            codigo: "CAF500",
            qtdVendida: 214,
            faturamento: "R$ 4.044,60",
          },
          {
            categoria: category,
            produto: "Arroz Tipo 1 5kg",
            codigo: "ARR5KG",
            qtdVendida: 167,
            faturamento: "R$ 5.510,90",
          },
          {
            categoria: category,
            produto: "Achocolatado 400g",
            codigo: "ACH400",
            qtdVendida: 149,
            faturamento: "R$ 2.666,10",
          },
        ],
      };

    case "clientes-frequentes":
      return {
        columns: [
          { key: "cliente", label: "Cliente" },
          { key: "cpf", label: "CPF" },
          { key: "compras", label: "Compras" },
          { key: "gastoTotal", label: "Gasto Total" },
          { key: "ticketMedio", label: "Ticket Médio" },
        ],
        rows: [
          {
            cliente: "Ana Martins",
            cpf: "123.456.789-09",
            compras: 24,
            gastoTotal: "R$ 3.905,20",
            ticketMedio: "R$ 162,71",
          },
          {
            cliente: "Carlos Oliveira",
            cpf: "502.340.660-25",
            compras: 19,
            gastoTotal: "R$ 2.911,45",
            ticketMedio: "R$ 153,23",
          },
        ],
      };

    case "estoque-critico":
      return {
        columns: [
          { key: "categoria", label: "Categoria" },
          { key: "produto", label: "Produto" },
          { key: "codigo", label: "Código" },
          { key: "estoqueAtual", label: "Estoque Atual" },
          { key: "estoqueMinimo", label: "Estoque Mínimo" },
          { key: "status", label: "Status" },
        ],
        rows: [
          {
            categoria: category,
            produto: "Detergente 500ml",
            codigo: "DET500",
            estoqueAtual: 2,
            estoqueMinimo: 10,
            status: "Crítico",
          },
          {
            categoria: category,
            produto: "Papel Higiênico c/4",
            codigo: "PHC4",
            estoqueAtual: filters.onlyOutOfStock === true ? 0 : 4,
            estoqueMinimo: 12,
            status: filters.onlyOutOfStock === true ? "Sem estoque" : "Crítico",
          },
        ],
      };

    case "compras-fornecedor":
      return {
        columns: [
          { key: "fornecedor", label: "Fornecedor" },
          { key: "categoria", label: "Categoria" },
          { key: "pedidos", label: "Pedidos" },
          { key: "custoTotal", label: "Custo Total" },
          { key: "ticketMedio", label: "Ticket Médio" },
        ],
        rows: [
          {
            fornecedor: "Distribuidora Alfa",
            categoria: category,
            pedidos: 12,
            custoTotal: "R$ 12.800,00",
            ticketMedio: "R$ 1.066,67",
          },
          {
            fornecedor: "Atacado Vitória",
            categoria: category,
            pedidos: 9,
            custoTotal: "R$ 8.450,00",
            ticketMedio: "R$ 938,89",
          },
        ],
      };

    case "movimento-estoque":
      return {
        columns: [
          { key: "periodo", label: "Período" },
          { key: "produto", label: "Produto" },
          { key: "categoria", label: "Categoria" },
          { key: "entradas", label: "Entradas" },
          { key: "saidas", label: "Saídas" },
          { key: "saldo", label: "Saldo" },
        ],
        rows: [
          {
            periodo: period,
            produto: "Arroz Tipo 1 5kg",
            categoria: category,
            entradas: 80,
            saidas: 67,
            saldo: 13,
          },
          {
            periodo: period,
            produto: "Café Tradicional 500g",
            categoria: category,
            entradas: 120,
            saidas: 98,
            saldo: 22,
          },
        ],
      };

    case "desempenho-caixa":
      return {
        columns: [
          { key: "operador", label: "Operador" },
          { key: "abertura", label: "Abertura" },
          { key: "fechamento", label: "Fechamento" },
          { key: "vendas", label: "Vendas" },
          { key: "total", label: "Total Movimentado" },
          { key: "pagamento", label: "Pagamento" },
        ],
        rows: [
          {
            operador: "Maria Silva",
            abertura: "08:00",
            fechamento: "17:30",
            vendas: 64,
            total: "R$ 8.430,90",
            pagamento: payment,
          },
          {
            operador: "João Pereira",
            abertura: "10:00",
            fechamento: "19:00",
            vendas: 52,
            total: "R$ 6.918,40",
            pagamento: payment,
          },
        ],
      };

    default:
      return {
        columns: [],
        rows: [],
      };
  }
}
