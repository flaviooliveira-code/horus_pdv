/**
 * Arquivo: src/pages/Admin/SalesHistoryPage.tsx
 * Objetivo: exibe histórico de vendas com busca local e ação de impressão por registro.
 * Entradas esperadas: não recebe props; processa filtro textual e renderiza dados vindos da API.
 */

import { FileText, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/Admin/PageHeader";
import RowActionsMenu from "@/components/Admin/RowActionsMenu";
import TablePagination from "@/components/Pagination/TablePagination";
import { Toast } from "@/hooks/Dialog";
import PageLayout from "@/layout/PageLayout";
import { salesHistoryService } from "@/services/api/salesHistoryService";

type SaleHistoryRow = {
  saleNumber: string;
  customerName: string;
  customerCpf: string;
  productCode: string;
  productName: string;
  quantity: number;
  saleDate: string;
};

export default function SalesHistoryPage() {
  const [search, setSearch] = useState("");
  const [salesHistory, setSalesHistory] = useState<SaleHistoryRow[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    salesHistoryService.list().then(setSalesHistory).catch(() => setSalesHistory([]));
  }, []);

  const filteredSales = useMemo(() => {
    // Busca local por número da venda ou nome do cliente.
    const normalized = search.trim().toLowerCase();
    if (!normalized) return salesHistory;

    return salesHistory.filter(
      (sale) =>
        sale.saleNumber.toLowerCase().includes(normalized) ||
        sale.customerName.toLowerCase().includes(normalized),
    );
  }, [salesHistory, search]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedSales = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return filteredSales.slice(start, start + itemsPerPage);
  }, [filteredSales, itemsPerPage, safeCurrentPage]);

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
            onChange={(event) => {
              setSearch(event.target.value);
              setCurrentPage(1);
            }}
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
              {paginatedSales.map((sale) => (
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
                          onClick: async () => {
                            try {
                              await salesHistoryService.print(sale.saleNumber);
                              Toast.success(
                                `Impressão da venda ${sale.saleNumber} enviada para processamento.`,
                              );
                            } catch (error) {
                              Toast.error(
                                error instanceof Error ? error.message : "Erro ao imprimir venda.",
                              );
                            }
                          },
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
            totalItems={filteredSales.length}
            currentPage={safeCurrentPage}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(value) => {
              setItemsPerPage(value);
              setCurrentPage(1);
            }}
          />
        </div>
      </section>
    </PageLayout>
  );
}
