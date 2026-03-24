/**
 * Arquivo: src/pages/Admin/SalesHistoryPage.tsx
 * Objetivo: exibe histórico de vendas com busca local e ação de impressão por registro.
 * Entradas esperadas: não recebe props; processa filtro textual e renderiza dados mockados da listagem.
 */

import { FileText, Search } from "lucide-react";
import { useMemo, useState } from "react";
import PageHeader from "@/components/Admin/PageHeader";
import RowActionsMenu from "@/components/Admin/RowActionsMenu";
import { Toast } from "@/hooks/Dialog";
import PageLayout from "@/layout/PageLayout";

type SaleHistoryRow = {
  saleNumber: string;
  customerName: string;
  customerCpf: string;
  productCode: string;
  productName: string;
  quantity: number;
  saleDate: string;
};

const SALES_HISTORY: SaleHistoryRow[] = [
  {
    saleNumber: "15039",
    customerName: "Ana Martins",
    customerCpf: "123.456.789-09",
    productCode: "CAF500",
    productName: "Café Tradicional 500g",
    quantity: 3,
    saleDate: "21/03/2026 14:12:08",
  },
  {
    saleNumber: "15038",
    customerName: "Lucas Souza",
    customerCpf: "427.632.180-01",
    productCode: "ACH400",
    productName: "Achocolatado 400g",
    quantity: 1,
    saleDate: "21/03/2026 13:42:11",
  },
  {
    saleNumber: "15037",
    customerName: "Beatriz Lima",
    customerCpf: "064.822.390-16",
    productCode: "ARR5KG",
    productName: "Arroz Tipo 1 5kg",
    quantity: 2,
    saleDate: "21/03/2026 12:55:46",
  },
];

export default function SalesHistoryPage() {
  const [search, setSearch] = useState("");

  const filteredSales = useMemo(() => {
    // Busca local por número da venda ou nome do cliente.
    const normalized = search.trim().toLowerCase();
    if (!normalized) return SALES_HISTORY;

    return SALES_HISTORY.filter(
      (sale) =>
        sale.saleNumber.toLowerCase().includes(normalized) ||
        sale.customerName.toLowerCase().includes(normalized),
    );
  }, [search]);

  return (
    <PageLayout className="space-y-4 py-4 md:space-y-6 md:py-6 lg:py-8">
      <PageHeader
        title="Histórico de Vendas"
        description="Consulta de vendas com detalhes por cliente e itens vendidos."
      />

      <section className="card p-4 md:p-5">
        <label className="relative mx-auto block w-full max-w-xl">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input-field w-full pl-9"
            placeholder="Pesquise pelo número da venda ou cliente"
          />
        </label>
      </section>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-bg-primary text-left text-text-secondary">
              <tr>
                <th className="px-4 py-3">Número da Venda</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">CPF</th>
                <th className="px-4 py-3">Código do Produto</th>
                <th className="px-4 py-3">Nome do Produto</th>
                <th className="px-4 py-3">QNT</th>
                <th className="px-4 py-3">Data da Venda</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((sale) => (
                <tr key={`${sale.saleNumber}-${sale.productCode}`} className="border-t border-border-primary">
                  <td className="px-4 py-3 font-semibold text-text-primary">{sale.saleNumber}</td>
                  <td className="px-4 py-3">{sale.customerName}</td>
                  <td className="px-4 py-3">{sale.customerCpf}</td>
                  <td className="px-4 py-3">{sale.productCode}</td>
                  <td className="px-4 py-3">{sale.productName}</td>
                  <td className="px-4 py-3">{sale.quantity}</td>
                  <td className="px-4 py-3">{sale.saleDate}</td>
                  <td className="px-4 py-3">
                    <RowActionsMenu
                      items={[
                        {
                          key: "print",
                          label: "Imprimir venda",
                          icon: <FileText size={13} />,
                          onClick: () =>
                            Toast.info(
                              `Ação de impressão da venda ${sale.saleNumber} será integrada com a API.`,
                            ),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageLayout>
  );
}
