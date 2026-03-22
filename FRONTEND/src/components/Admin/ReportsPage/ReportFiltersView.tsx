import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileSpreadsheet, FileText } from "lucide-react";
import { DatePickerField } from "@/components/Form";
import TablePagination from "@/components/Pagination/TablePagination";
import type { ReportFilter, ReportDefinition } from "./reportsConfig";
import type {
  ReportFilterValues,
  ReportResultColumn,
  ReportResultRow,
} from "./reportResultTypes";
import { generateReportResult } from "./reportMockResults";

type FilterValue = string | string[] | boolean;

type ReportFiltersViewProps = {
  report: ReportDefinition;
  onBack: () => void;
};

function getTodayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDaysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createInitialFilterValues(filters: ReportFilter[]): ReportFilterValues {
  return filters.reduce<ReportFilterValues>((accumulator, filter) => {
    if (filter.type === "checkbox") {
      accumulator[filter.id] = false;
      return accumulator;
    }

    if (filter.type === "multiselect") {
      accumulator[filter.id] = [];
      return accumulator;
    }

    if (filter.type === "date") {
      accumulator[filter.id] = filter.id.toLowerCase().includes("start")
        ? getDaysAgoIso(30)
        : getTodayIso();
      return accumulator;
    }

    const defaultOption = filter.options?.[0]?.value ?? "";
    accumulator[filter.id] = defaultOption;
    return accumulator;
  }, {});
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toLowerCase();
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTableCellValue(value: unknown): string | number {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return value.toLocaleString("pt-BR");
  if (typeof value !== "string") return String(value);

  const trimmedValue = value.trim();
  const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  const isoDateTimeLocalPattern =
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/;

  const dateMatch = trimmedValue.match(isoDatePattern);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("pt-BR");
    }
  }

  const localDateTimeMatch = trimmedValue.match(isoDateTimeLocalPattern);
  if (localDateTimeMatch) {
    const [, year, month, day, hour, minute, second] = localDateTimeMatch;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second ?? "0"),
    );
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("pt-BR", {
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }

  return value;
}

function exportToExcel(
  title: string,
  columns: ReportResultColumn[],
  rows: ReportResultRow[],
) {
  const header = columns
    .map((column) => `<th>${escapeHtml(column.label)}</th>`)
    .join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => `<td>${escapeHtml(row[column.key] ?? "-")}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  const html = `
    <html>
      <head><meta charset="UTF-8" /></head>
      <body>
        <h3>${escapeHtml(title)}</h3>
        <table border="1" cellspacing="0" cellpadding="6">
          <thead><tr>${header}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob([html], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitizeFileName(title)}.xls`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportToPdf(
  title: string,
  columns: ReportResultColumn[],
  rows: ReportResultRow[],
) {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");
  if (!popup) return;

  const header = columns
    .map((column) => `<th>${escapeHtml(column.label)}</th>`)
    .join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => `<td>${escapeHtml(row[column.key] ?? "-")}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; color: #0f172a; }
          h2 { margin: 0 0 12px; }
          p { margin: 0 0 16px; font-size: 12px; color: #475569; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
          th { background: #f1f5f9; }
        </style>
      </head>
      <body>
        <h2>${escapeHtml(title)}</h2>
        <p>Gerado em ${new Date().toLocaleString("pt-BR")}</p>
        <table>
          <thead><tr>${header}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </body>
    </html>
  `);

  popup.document.close();
  popup.focus();
  popup.print();
}

export default function ReportFiltersView({ report, onBack }: ReportFiltersViewProps) {
  const initialValues = useMemo(() => createInitialFilterValues(report.filters), [report.filters]);

  const [values, setValues] = useState<ReportFilterValues>(initialValues);
  const [submittedValues, setSubmittedValues] = useState<ReportFilterValues>(initialValues);
  const [resultColumns, setResultColumns] = useState<ReportResultColumn[]>([]);
  const [resultRows, setResultRows] = useState<ReportResultRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    setValues(initialValues);
    setSubmittedValues(initialValues);
    setResultColumns([]);
    setResultRows([]);
    setHasGenerated(false);
    setCurrentPage(1);
  }, [initialValues]);

  const handleChange = (filterId: string, nextValue: FilterValue) => {
    setValues((current) => ({ ...current, [filterId]: nextValue }));
  };

  const handleMultiToggle = (filterId: string, optionValue: string) => {
    setValues((current) => {
      const currentValue = current[filterId];
      const currentArray = Array.isArray(currentValue) ? currentValue : [];
      const nextArray = currentArray.includes(optionValue)
        ? currentArray.filter((item) => item !== optionValue)
        : [...currentArray, optionValue];

      return { ...current, [filterId]: nextArray };
    });
  };

  const handleReset = () => {
    setValues(initialValues);
    setSubmittedValues(initialValues);
    setResultColumns([]);
    setResultRows([]);
    setHasGenerated(false);
    setCurrentPage(1);
  };

  const handleGenerateReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    await new Promise((resolve) => window.setTimeout(resolve, 250));
    const result = generateReportResult(report.id, values);

    setSubmittedValues({ ...values });
    setResultColumns(result.columns);
    setResultRows(result.rows);
    setHasGenerated(true);
    setCurrentPage(1);
    setIsLoading(false);
  };

  const totalPages = Math.max(1, Math.ceil(resultRows.length / Math.max(1, rowsPerPage)));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedRows = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * rowsPerPage;
    return resultRows.slice(startIndex, startIndex + rowsPerPage);
  }, [resultRows, rowsPerPage, safeCurrentPage]);

  const appliedFilters = useMemo(() => {
    if (!hasGenerated) return [] as string[];

    return report.filters.reduce<string[]>((accumulator, filter) => {
      const value = submittedValues[filter.id];

      if (filter.type === "checkbox") {
        if (value === true) accumulator.push(`${filter.label}: Sim`);
        return accumulator;
      }

      if (filter.type === "multiselect") {
        if (!Array.isArray(value) || value.length === 0) return accumulator;

        const labels = value.map((item) => {
          return filter.options?.find((option) => option.value === item)?.label ?? item;
        });

        accumulator.push(`${filter.label}: ${labels.join(", ")}`);
        return accumulator;
      }

      if (typeof value !== "string" || value.length === 0 || value === "all") {
        return accumulator;
      }

      if (filter.type === "date") {
        accumulator.push(`${filter.label}: ${formatTableCellValue(value)}`);
        return accumulator;
      }

      const selectedLabel = filter.options?.find((option) => option.value === value)?.label ?? value;
      accumulator.push(`${filter.label}: ${selectedLabel}`);
      return accumulator;
    }, []);
  }, [hasGenerated, report.filters, submittedValues]);

  const canExport = hasGenerated && resultRows.length > 0;

  return (
    <div className="space-y-4">
      <div className="card px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              className="mb-3 inline-flex items-center gap-1.5 rounded-xl border border-border-primary bg-bg-primary px-3 py-1.5 text-xs font-semibold text-text-primary shadow-sm transition hover:border-accent/40 hover:bg-orange-50 hover:text-accent focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(255,107,0,0.12)]"
              onClick={onBack}
            >
              <ArrowLeft size={14} />
              Voltar para relatórios
            </button>
            <h2 className="text-3xl font-semibold text-text-primary">{report.title}</h2>
            <p className="mt-1 text-sm text-text-secondary">{report.description}</p>
          </div>

          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            Filtros do relatório
          </span>
        </div>
      </div>

      <form className="card p-6" onSubmit={handleGenerateReport}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {report.filters.map((filter) => {
            if (filter.type === "checkbox") {
              const checked = Boolean(values[filter.id]);
              return (
                <label
                  key={filter.id}
                  className="flex items-center gap-2 rounded-xl border border-border-primary bg-bg-primary px-3 py-3"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => handleChange(filter.id, event.currentTarget.checked)}
                  />
                  <span className="text-sm font-medium text-text-primary">{filter.label}</span>
                </label>
              );
            }

            if (filter.type === "multiselect") {
              const selectedValues = Array.isArray(values[filter.id]) ? (values[filter.id] as string[]) : [];

              return (
                <div
                  key={filter.id}
                  className="rounded-xl border border-border-primary bg-bg-primary px-3 py-3"
                >
                  <p className="mb-2 text-sm font-semibold text-text-primary">{filter.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {filter.options?.map((option) => {
                      const selected = selectedValues.includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleMultiToggle(filter.id, option.value)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                            selected
                              ? "border-accent bg-accent text-white"
                              : "border-border-secondary bg-bg-light text-text-secondary hover:border-accent/50"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            if (filter.type === "date") {
              const value = typeof values[filter.id] === "string" ? (values[filter.id] as string) : "";
              return (
                <label key={filter.id} className="space-y-1">
                  <span className="text-sm font-semibold text-text-primary">{filter.label}</span>
                  <DatePickerField
                    value={value}
                    onChange={(nextValue) => handleChange(filter.id, nextValue)}
                    className="w-full"
                  />
                </label>
              );
            }

            const selectedValue = typeof values[filter.id] === "string" ? (values[filter.id] as string) : "";
            return (
              <label key={filter.id} className="space-y-1">
                <span className="text-sm font-semibold text-text-primary">{filter.label}</span>
                <select
                  value={selectedValue}
                  onChange={(event) => handleChange(filter.id, event.target.value)}
                  className="select-field w-full"
                >
                  {filter.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button type="submit" className="btn-success" disabled={isLoading}>
            {isLoading ? "Gerando..." : "Gerar relatório"}
          </button>
          <button type="button" className="btn-outline-secondary" onClick={handleReset}>
            Limpar filtros
          </button>
        </div>
      </form>

      {hasGenerated && (
        <div className="card space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-text-primary">Resultado do relatório</h3>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportToExcel(`Relatorio - ${report.title}`, resultColumns, resultRows)}
                disabled={!canExport}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border-primary bg-bg-light px-3 py-2 text-xs font-semibold text-text-primary transition hover:border-accent/40 hover:text-accent"
              >
                <FileSpreadsheet size={14} />
                Exportar Excel
              </button>
              <button
                type="button"
                onClick={() => exportToPdf(`Relatorio - ${report.title}`, resultColumns, resultRows)}
                disabled={!canExport}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border-primary bg-bg-light px-3 py-2 text-xs font-semibold text-text-primary transition hover:border-accent/40 hover:text-accent"
              >
                <FileText size={14} />
                Exportar PDF
              </button>
            </div>
          </div>

          {appliedFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {appliedFilters.map((filterLabel) => (
                <span
                  key={filterLabel}
                  className="rounded-full border border-border-primary bg-bg-primary px-2.5 py-1 text-xs font-semibold text-text-secondary"
                >
                  {filterLabel}
                </span>
              ))}
            </div>
          )}

          {resultRows.length === 0 ? (
            <div className="rounded-xl border border-border-primary bg-bg-primary px-4 py-10 text-center text-sm text-text-secondary">
              Nenhum dado encontrado para os filtros aplicados.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-border-primary bg-bg-light">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-bg-primary">
                    <tr>
                      {resultColumns.map((column) => (
                        <th
                          key={column.key}
                          className="border-b border-border-primary px-3 py-2 text-left font-semibold text-text-primary"
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedRows.map((row, index) => (
                      <tr
                        key={`${safeCurrentPage}-${index}`}
                        className="bg-bg-light transition-colors hover:bg-accent/8"
                      >
                        {resultColumns.map((column) => (
                          <td
                            key={`${column.key}-${safeCurrentPage}-${index}`}
                            className="border-b border-border-primary px-3 py-2 text-text-secondary"
                          >
                            {formatTableCellValue(row[column.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <TablePagination
                totalItems={resultRows.length}
                currentPage={safeCurrentPage}
                itemsPerPage={rowsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(value) => {
                  setRowsPerPage(value);
                  setCurrentPage(1);
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
