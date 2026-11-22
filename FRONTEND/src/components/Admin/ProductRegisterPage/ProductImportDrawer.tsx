/**
 * Arquivo: src/components/Admin/ProductRegisterPage/ProductImportDrawer.tsx
 * Objetivo: Drawer de importação em lote de produtos via planilha Excel (.xlsx) ou CSV,
 *           com download de modelo padrão, pré-visualização, validação e tratamento de conflito.
 */

import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { readSheet } from "read-excel-file/browser";
import writeXlsxFile, { type SheetData } from "write-excel-file/browser";
import LoadingButton from "@/components/Loading/LoadingButton";
import { Toast } from "@/hooks/Dialog";
import {
  type ProductConflictMode,
  type ProductImportBatchResultDto,
  type ProductImportRowPayload,
  productService,
} from "@/services/api/productService";
import {
  addDaysToIsoDate,
  evaluateProductExpiration,
  formatIsoDateBr,
  getTodayIsoDate,
} from "@/utils/productExpiration";

type ProductImportDrawerProps = {
  open: boolean;
  onClose: () => void;
  onImported: () => Promise<void> | void;
};

const HEADER_ALIASES: Record<string, keyof Omit<ProductImportRowPayload, "rowNumber">> = {
  codigo: "productCode",
  codigodoproduto: "productCode",
  productcode: "productCode",
  sku: "productCode",
  nome: "productName",
  nomedoproduto: "productName",
  produto: "productName",
  productname: "productName",
  categoria: "productCategory",
  category: "productCategory",
  productcategory: "productCategory",
  fornecedor: "productSupplier",
  productsupplier: "productSupplier",
  descricao: "productDescription",
  descricaodoproduto: "productDescription",
  productdescription: "productDescription",
  quantidade: "productQnt",
  estoque: "productQnt",
  qtd: "productQnt",
  productqnt: "productQnt",
  precocusto: "productUnitPrice",
  custo: "productUnitPrice",
  precounitario: "productUnitPrice",
  custounitario: "productUnitPrice",
  productunitprice: "productUnitPrice",
  precovenda: "productSalePrice",
  venda: "productSalePrice",
  precodevenda: "productSalePrice",
  productsaleprice: "productSalePrice",
  datavencimento: "expirationDate",
  vencimento: "expirationDate",
  validade: "expirationDate",
  expirationdate: "expirationDate",
  datafabricacao: "manufactureDate",
  fabricacao: "manufactureDate",
  manufacturedate: "manufactureDate",
  dura30dias: "shelfLifeDays",
  validadedias: "shelfLifeDays",
  diasvalidade: "shelfLifeDays",
  diasdevencimento: "shelfLifeDays",
  shelflifedays: "shelfLifeDays",
  modovencimento: "expirationMode",
  modovalidade: "expirationMode",
  expirationmode: "expirationMode",
};

function formatSpreadsheetCell(cell: unknown): string {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return cell.toISOString().slice(0, 10);
  }
  return String(cell ?? "").trim();
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function parseCsvLines(text: string): string[][] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const firstLine = lines[0];
  const delimiter = firstLine.includes(";") ? ";" : ",";
  return lines.map((line) =>
    line.split(delimiter).map((cell) => cell.trim().replace(/^"(.*)"$/, "$1")),
  );
}

function mapMatrixToPayloads(matrix: unknown[][]): ProductImportRowPayload[] {
  if (matrix.length < 2) return [];
  const rawHeaders = matrix[0] ?? [];
  const columnMap = new Map<number, keyof Omit<ProductImportRowPayload, "rowNumber">>();

  rawHeaders.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    const mapped = HEADER_ALIASES[normalized];
    if (mapped) {
      columnMap.set(index, mapped);
    }
  });

  const legacyPositionalFallback: Array<keyof Omit<ProductImportRowPayload, "rowNumber">> = [
    "productCode",
    "productName",
    "productSupplier",
    "productDescription",
    "productQnt",
    "productUnitPrice",
    "productSalePrice",
  ];

  const extendedPositionalFallback: Array<keyof Omit<ProductImportRowPayload, "rowNumber">> = [
    "productCode",
    "productName",
    "productCategory",
    "productSupplier",
    "productDescription",
    "productQnt",
    "productUnitPrice",
    "productSalePrice",
    "expirationDate",
    "manufactureDate",
    "shelfLifeDays",
  ];

  const usePositional = columnMap.size < 3;

  const payloads: ProductImportRowPayload[] = [];
  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex++) {
    const row = matrix[rowIndex] ?? [];
    const draft: ProductImportRowPayload = {
      rowNumber: rowIndex + 1,
      productCode: "",
      productName: "",
      productCategory: "",
      productSupplier: "",
      productDescription: "",
      productQnt: "",
      productUnitPrice: "",
      productSalePrice: "",
      expirationMode: "",
      manufactureDate: "",
      shelfLifeDays: "",
      expirationDate: "",
    };

    if (usePositional) {
      const fallbackColumns =
        rawHeaders.length > 7 || row.length > 7
          ? extendedPositionalFallback
          : legacyPositionalFallback;
      fallbackColumns.forEach((fieldKey, colIdx) => {
        draft[fieldKey] = formatSpreadsheetCell(row[colIdx]);
      });
    } else {
      columnMap.forEach((fieldKey, colIdx) => {
        draft[fieldKey] = formatSpreadsheetCell(row[colIdx]);
      });
    }

    const isAllEmpty =
      !draft.productCode &&
      !draft.productName &&
      !draft.productCategory &&
      !draft.productSupplier &&
      !draft.productQnt &&
      !draft.productUnitPrice &&
      !draft.productSalePrice &&
      !draft.expirationDate &&
      !draft.manufactureDate &&
      !draft.shelfLifeDays;

    if (!isAllEmpty) {
      if (!draft.productDescription) {
        draft.productDescription = draft.productName;
      }
      payloads.push(draft);
    }
  }

  return payloads;
}

export default function ProductImportDrawer({
  open,
  onClose,
  onImported,
}: ProductImportDrawerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [conflictMode, setConflictMode] = useState<ProductConflictMode>("atualizar");
  const [parsedRows, setParsedRows] = useState<ProductImportRowPayload[]>([]);
  const [validationResult, setValidationResult] = useState<ProductImportBatchResultDto | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  if (!open) return null;

  const runServerValidation = async (
    rows: ProductImportRowPayload[],
    mode: ProductConflictMode,
  ) => {
    if (rows.length === 0) {
      setValidationResult(null);
      return;
    }
    setIsValidating(true);
    try {
      const result = await productService.validateImportBatch(rows, mode);
      if (result) {
        setValidationResult(result);
      }
    } catch (error) {
      Toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível validar a planilha no servidor.",
      );
    } finally {
      setIsValidating(false);
    }
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    try {
      const lower = file.name.toLowerCase();
      let matrix: unknown[][] = [];
      if (lower.endsWith(".csv")) {
        const text = await file.text();
        matrix = parseCsvLines(text);
      } else {
        const rows = await readSheet(file);
        matrix = rows as unknown[][];
      }

      const payloads = mapMatrixToPayloads(matrix);
      if (payloads.length === 0) {
        Toast.error("Nenhuma linha de produto encontrada na planilha.");
        setParsedRows([]);
        setValidationResult(null);
        return;
      }

      setParsedRows(payloads);
      await runServerValidation(payloads, conflictMode);
    } catch {
      Toast.error("Falha ao ler arquivo. Envie uma planilha .xlsx ou .csv válida.");
    }
  };

  const handleConflictModeChange = async (nextMode: ProductConflictMode) => {
    setConflictMode(nextMode);
    if (parsedRows.length > 0) {
      await runServerValidation(parsedRows, nextMode);
    }
  };

  const handleDownloadTemplate = async () => {
    const todayIso = getTodayIsoDate();
    const fixedExpIso = addDaysToIsoDate(todayIso, 120);
    const data: SheetData = [
      [
        { value: "Codigo", fontWeight: "bold" },
        { value: "Nome", fontWeight: "bold" },
        { value: "Categoria", fontWeight: "bold" },
        { value: "Fornecedor", fontWeight: "bold" },
        { value: "Descricao", fontWeight: "bold" },
        { value: "Quantidade", fontWeight: "bold" },
        { value: "PrecoCusto", fontWeight: "bold" },
        { value: "PrecoVenda", fontWeight: "bold" },
        { value: "DataVencimento", fontWeight: "bold" },
        { value: "DataFabricacao", fontWeight: "bold" },
        { value: "Dura30Dias", fontWeight: "bold" },
      ],
      [
        { type: String, value: "7891000100103" },
        { type: String, value: "Arroz Tipo 1 5kg" },
        { type: String, value: "Mercearia" },
        { type: String, value: "Distribuidora Brasil" },
        { type: String, value: "Arroz agulhinha tipo 1 pacote 5kg" },
        { type: Number, value: 50 },
        { type: String, value: "18,50" },
        { type: String, value: "26,90" },
        { type: String, value: fixedExpIso },
        { type: String, value: "" },
        { type: String, value: "" },
      ],
      [
        { type: String, value: "7891000200205" },
        { type: String, value: "Pão Caseiro Lote" },
        { type: String, value: "Padaria" },
        { type: String, value: "" },
        { type: String, value: "Produto com validade de 30 dias após fabricação" },
        { type: Number, value: 24 },
        { type: String, value: "4,50" },
        { type: String, value: "8,90" },
        { type: String, value: "" },
        { type: String, value: todayIso },
        { type: String, value: "Sim" },
      ],
    ];

    await writeXlsxFile(data).toFile("modelo-importacao-produtos-horus-pdv.xlsx");
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) {
      Toast.error("Selecione uma planilha para importar.");
      return;
    }

    setIsImporting(true);
    try {
      const result = await productService.importBatch(parsedRows, conflictMode);
      if (result) {
        setValidationResult(result);
        Toast.success(
          `Importação concluída: ${result.createdCount} criado(s), ${result.updatedCount} atualizado(s), ${result.ignoredCount} ignorado(s).`,
        );
        await onImported();
        onClose();
      }
    } catch (error) {
      Toast.error(
        error instanceof Error ? error.message : "Erro ao importar planilha de produtos.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="dept-drawer-overlay" onClick={onClose}>
      <aside
        className="dept-drawer-panel max-w-4xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border-primary p-5">
          <div>
            <h3 className="text-xl font-semibold text-text-primary">
              Importar Produtos via Planilha (Excel / CSV)
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Cadastre ou atualize o estoque e os preços de custo/venda em lote a partir de um arquivo{" "}
              <code>.xlsx</code> ou <code>.csv</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
            aria-label="Fechar importação de produtos"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <section className="card rounded-2xl p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-text-primary">
                  1. Planilha Modelo e Conflito de Código
                </h4>
                <p className="text-xs text-text-secondary">
                  Colunas esperadas: <strong>Codigo</strong>, <strong>Nome</strong>,{" "}
                  <strong>Categoria</strong>, <strong>Fornecedor</strong>,{" "}
                  <strong>Descricao</strong>, <strong>Quantidade</strong>,{" "}
                  <strong>PrecoCusto</strong>, <strong>PrecoVenda</strong>,{" "}
                  <strong>DataVencimento</strong>, <strong>DataFabricacao</strong> e{" "}
                  <strong>Dura30Dias</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="btn-outline-secondary inline-flex items-center gap-2 text-xs"
              >
                <Download size={15} />
                Baixar Modelo (.xlsx)
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-text-secondary">
                  Quando o código do produto já existir no banco:
                </span>
                <select
                  value={conflictMode}
                  onChange={(event) =>
                    handleConflictModeChange(event.target.value as ProductConflictMode)
                  }
                  className="input-field w-full"
                >
                  <option value="atualizar">
                    Atualizar produto existente (estoque, custo e preço de venda)
                  </option>
                  <option value="ignorar">Ignorar produtos com código já cadastrado</option>
                </select>
              </label>

              <div>
                <span className="mb-1 block text-xs font-medium text-text-secondary">
                  Selecionar arquivo (.xlsx ou .csv)
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-outline-secondary inline-flex w-full items-center justify-center gap-2"
                >
                  <Upload size={15} />
                  {fileName ? `Arquivo: ${fileName}` : "Escolher planilha (.xlsx ou .csv)"}
                </button>
              </div>
            </div>
          </section>

          {validationResult ? (
            <section className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="card rounded-xl p-3">
                  <span className="text-xs text-text-secondary">Total de linhas</span>
                  <p className="mt-1 text-lg font-bold text-text-primary">
                    {validationResult.totalRows}
                  </p>
                </div>
                <div className="card rounded-xl p-3">
                  <span className="text-xs text-text-secondary">Novos (Criar)</span>
                  <p className="mt-1 text-lg font-bold text-emerald-600">
                    {validationResult.createdCount}
                  </p>
                </div>
                <div className="card rounded-xl p-3">
                  <span className="text-xs text-text-secondary">
                    {conflictMode === "atualizar" ? "Atualizar" : "Ignorar"}
                  </span>
                  <p className="mt-1 text-lg font-bold text-amber-600">
                    {conflictMode === "atualizar"
                      ? validationResult.updatedCount
                      : validationResult.ignoredCount}
                  </p>
                </div>
                <div className="card rounded-xl p-3">
                  <span className="text-xs text-text-secondary">Com erro</span>
                  <p className="mt-1 text-lg font-bold text-red-600">
                    {validationResult.errorRows}
                  </p>
                </div>
              </div>

              {validationResult.rows.some(
                (item) =>
                  item.isValid &&
                  (item.expirationStatus === "EXPIRING_SOON" ||
                    item.expirationStatus === "EXPIRED"),
              ) ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200">
                  <strong>Alerta de vencimento:</strong> esta planilha contém itens já vencidos ou
                  prestes a vencer (até 7 dias). Após importar, você poderá aplicar o preço de
                  custo com 1 clique.
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="card overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-border-primary px-4 py-3">
              <h4 className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
                <FileSpreadsheet size={16} />
                Pré-visualização e Validação ({parsedRows.length} linha(s))
              </h4>
              {isValidating ? (
                <span className="text-xs text-text-secondary">Validando linhas...</span>
              ) : null}
            </div>

            {parsedRows.length === 0 ? (
              <div className="p-8 text-center text-sm text-text-secondary">
                Envie uma planilha <code>.xlsx</code> ou <code>.csv</code> para visualizar a validação
                linha a linha antes de importar.
              </div>
            ) : (
              <div className="max-h-[380px] overflow-auto">
                <table className="w-full min-w-[880px] text-xs">
                  <thead className="bg-bg-primary text-left text-text-secondary">
                    <tr>
                      <th className="px-3 py-2.5">Linha</th>
                      <th className="px-3 py-2.5">Código</th>
                      <th className="px-3 py-2.5">Produto</th>
                      <th className="px-3 py-2.5">Fornecedor</th>
                      <th className="px-3 py-2.5">Qtd</th>
                      <th className="px-3 py-2.5">Custo Unit.</th>
                      <th className="px-3 py-2.5">Preço Venda</th>
                      <th className="px-3 py-2.5">Validade</th>
                      <th className="px-3 py-2.5">Ação / Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row) => {
                      const status = validationResult?.rows.find(
                        (item) => item.rowNumber === row.rowNumber,
                      );
                      const resolvedDate = status?.expirationDate ?? "";
                      const evaluation = resolvedDate
                        ? evaluateProductExpiration(resolvedDate)
                        : null;
                      const formattedDate =
                        evaluation?.formattedDate || formatIsoDateBr(resolvedDate);

                      return (
                        <tr key={row.rowNumber} className="border-t border-border-primary">
                          <td className="px-3 py-2 font-mono">{row.rowNumber}</td>
                          <td className="px-3 py-2 font-mono">{row.productCode || "-"}</td>
                          <td className="px-3 py-2 font-medium text-text-primary">
                            <div>{row.productName || "-"}</div>
                            {(status?.productCategory || row.productCategory) ? (
                              <span className="text-[11px] font-normal text-text-tertiary">
                                {status?.productCategory || row.productCategory}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">{row.productSupplier || "-"}</td>
                          <td className="px-3 py-2">{row.productQnt || "0"}</td>
                          <td className="px-3 py-2">R$ {row.productUnitPrice || "0,00"}</td>
                          <td className="px-3 py-2">R$ {row.productSalePrice || "0,00"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {formattedDate ? (
                              <div className="space-y-0.5">
                                <span className="block font-medium text-text-primary">
                                  {formattedDate}
                                  {status?.expirationMode === "DAYS_FROM_MANUFACTURE"
                                    ? ` (${status.shelfLifeDays ?? 30}d fab.)`
                                    : ""}
                                </span>
                                {evaluation &&
                                (evaluation.status === "EXPIRED" ||
                                  evaluation.status === "EXPIRING_SOON") ? (
                                  <span
                                    className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                      evaluation.status === "EXPIRED"
                                        ? "bg-rose-500/15 text-rose-500"
                                        : "bg-amber-500/15 text-amber-500"
                                    }`}
                                  >
                                    {evaluation.label}
                                  </span>
                                ) : null}
                              </div>
                            ) : row.expirationDate || row.manufactureDate || row.shelfLifeDays ? (
                              <span className="text-text-secondary">
                                {row.expirationDate ||
                                  `${row.manufactureDate || "Hoje"} (+${row.shelfLifeDays || "30"}d)`}
                              </span>
                            ) : (
                              <span className="text-text-tertiary">Sem validade</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {status ? (
                              status.isValid ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-600">
                                  <CheckCircle2 size={12} />
                                  {status.action}
                                </span>
                              ) : (
                                <div className="space-y-0.5 text-red-600">
                                  <span className="inline-flex items-center gap-1 font-semibold">
                                    <AlertCircle size={12} />
                                    ERRO
                                  </span>
                                  <p className="text-[11px]">{status.errors.join(" ")}</p>
                                </div>
                              )
                            ) : (
                              <span className="text-text-tertiary">Pendente</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="border-t border-border-primary p-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancelar
            </button>
            <LoadingButton
              type="button"
              onClick={handleConfirmImport}
              isLoading={isImporting}
              loadingLabel="Importando..."
              disabled={
                parsedRows.length === 0 ||
                isValidating ||
                (validationResult !== null && validationResult.validRows === 0)
              }
              className="btn-primary"
            >
              Confirmar Importação
            </LoadingButton>
          </div>
        </div>
      </aside>
    </div>
  );
}
