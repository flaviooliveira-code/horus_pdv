import { useMemo, useState } from "react";
import PageHeader from "@/components/Admin/PageHeader";
import {
  ReportCardsGrid,
  ReportFiltersView,
  reportCatalog,
  type ReportDefinition,
} from "@/components/Admin/ReportsPage";
import PageLayout from "@/layout/PageLayout";

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportDefinition | null>(null);
  const [search, setSearch] = useState("");
  const availableReports = useMemo(() => reportCatalog, []);

  const filteredReports = useMemo(() => {
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
        <ReportFiltersView report={activeReport} onBack={() => setActiveReport(null)} />
      ) : (
        <>
          <PageHeader
            title="Relatórios"
            description="Acompanhe faturamento, estoque, vendas e indicadores comerciais do PDV."
          />
          <ReportCardsGrid
            reports={filteredReports}
            search={search}
            onSearchChange={setSearch}
            onSelectReport={setActiveReport}
          />
        </>
      )}
    </PageLayout>
  );
}
