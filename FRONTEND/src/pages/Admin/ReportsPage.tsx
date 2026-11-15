/**
 * Arquivo: src/pages/Admin/ReportsPage.tsx
 * Objetivo: orquestra catálogo de relatórios e fluxo de filtros/resultado para o relatório selecionado.
 * Entradas esperadas: não recebe props; gerencia estado local de busca e seleção de relatório.
 */

import { Receipt } from "lucide-react";
import { useMemo, useState } from "react";
import PageHeader from "@/components/Admin/PageHeader";
import {
  OperationalExpensesDrawer,
  ReportCardsGrid,
  ReportFiltersView,
  reportCatalog,
  type ReportDefinition,
} from "@/components/Admin/ReportsPage";
import PageLayout from "@/layout/PageLayout";

export default function ReportsPage() {
  // Guarda relatório selecionado para alternar entre catálogo e tela de filtros.
  const [activeReport, setActiveReport] = useState<ReportDefinition | null>(null);
  const [expensesDrawerOpen, setExpensesDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const availableReports = useMemo(() => reportCatalog, []);

  const filteredReports = useMemo(() => {
    // Filtro textual aplicado em título e descrição.
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return availableReports;

    return availableReports.filter((report) => {
      return (
        report.title.toLowerCase().includes(normalizedSearch) ||
        report.description.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [search, availableReports]);

  return (
    <PageLayout className="space-y-4 py-4 md:space-y-6 md:py-6 lg:py-8">
      {activeReport ? (
        <ReportFiltersView
          report={activeReport}
          onBack={() => setActiveReport(null)}
          onOpenExpenses={() => setExpensesDrawerOpen(true)}
        />
      ) : (
        <>
          <PageHeader
            title="Relatórios"
            description="Acompanhe faturamento, lucro bruto, CMV, DRE simplificado, estoque e indicadores comerciais do PDV."
            action={
              <button
                type="button"
                onClick={() => setExpensesDrawerOpen(true)}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <Receipt size={16} />
                Despesas Operacionais (DRE)
              </button>
            }
          />
          <ReportCardsGrid
            reports={filteredReports}
            search={search}
            onSearchChange={setSearch}
            onSelectReport={setActiveReport}
          />
        </>
      )}

      <OperationalExpensesDrawer
        open={expensesDrawerOpen}
        onClose={() => setExpensesDrawerOpen(false)}
      />
    </PageLayout>
  );
}

