/**
 * Arquivo: src/components/Admin/ReportsPage/ReportCardsGrid.tsx
 * Objetivo: mostra catálogo de cards de relatório com busca textual e seleção de item.
 * Entradas esperadas: recebe lista de relatórios, termo de busca e callbacks de alteração/seleção.
 */

import { Search } from "lucide-react";
import type { ReportDefinition } from "./reportsConfig";

type ReportCardsGridProps = {
  reports: ReportDefinition[];
  search: string;
  onSearchChange: (value: string) => void;
  onSelectReport: (report: ReportDefinition) => void;
};

export default function ReportCardsGrid({
  reports,
  search,
  onSearchChange,
  onSelectReport,
}: ReportCardsGridProps) {
  return (
    <div className="space-y-5">
      <div className="card px-4 py-4 md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text-primary md:text-2xl">
              Catálogo de relatórios
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              Consulte indicadores operacionais, financeiros e comerciais do PDV.
            </p>
          </div>

          <label className="relative block w-full md:w-[360px]">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar relatório..."
              className="input-field w-full pl-9"
            />
          </label>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="card px-4 py-10 text-center">
          <p className="text-sm font-medium text-text-primary">Nenhum relatório encontrado</p>
          <p className="mt-1 text-sm text-text-secondary">
            Ajuste o termo de busca para localizar os relatórios disponíveis.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {reports.map((report) => {
            const Icon = report.icon;
            return (
              <button
                key={report.id}
                type="button"
                onClick={() => onSelectReport(report)}
                className="card flex min-h-[132px] w-full items-start gap-3 px-6 py-5 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Icon size={18} />
                </span>
                <div className="min-w-0 space-y-2">
                  <p className="font-display text-xl font-semibold leading-snug text-text-primary">
                    {report.title}
                  </p>
                  <p className="line-clamp-2 text-base leading-relaxed text-text-secondary">
                    {report.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
