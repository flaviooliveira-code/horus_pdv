/**
 * Arquivo: src/components/Admin/CashRegisterPage/SessionSummaryModal.tsx
 * Objetivo: exibe o Espelho Z detalhado da sessão de caixa (quebra/sobra, vendas por pagamento, ticket médio, movimentações e impressão).
 * Entradas esperadas: recebe CaixaSessionSummaryDto e callback de fechamento do modal.
 */
import { FileText, Printer, X } from "lucide-react";
import type { CaixaSessionSummaryDto } from "@/services/api/cashRegisterService";
import { formatMoneyBr } from "@/utils/inputMasks";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPaymentLabel(method: string) {
  const key = method.toLowerCase();
  if (key === "dinheiro") return "Dinheiro";
  if (key === "pix") return "PIX";
  if (key === "debito") return "Cartão de Débito";
  if (key === "credito") return "Cartão de Crédito";
  return method || "-";
}

function buildThermalEspelhoZHtml(summary: CaixaSessionSummaryDto) {
  const movementRows = summary.movements
    .map(
      (mov) => `
      <div class="mov-row">
        <div><strong>${escapeHtml(mov.tipo)}</strong> • ${escapeHtml(formatDateTime(mov.dataHora))}</div>
        <div class="line">
          <span>${escapeHtml(mov.descricao || formatPaymentLabel(mov.formaPagamento))}</span>
          <span>R$ ${formatMoneyBr(mov.valor)}</span>
        </div>
      </div>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Espelho Z - ${escapeHtml(summary.id)}</title>
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #020617; font: 12px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      .receipt { width: 72mm; margin: 0 auto; }
      .center { text-align: center; }
      .bold { font-weight: 800; }
      .divider { border-top: 1px dashed #475569; margin: 8px 0; }
      .line { display: flex; justify-content: space-between; gap: 6px; }
      .mov-row { margin-top: 5px; font-size: 11px; }
    </style>
  </head>
  <body>
    <main class="receipt">
      <div class="center bold">HORUS PDV - ESPELHO Z</div>
      <div class="center">FECHAMENTO DE CAIXA</div>
      <div class="divider"></div>
      <div>Sessão: ${escapeHtml(summary.id)}</div>
      <div>Operador: ${escapeHtml(summary.operatorName || "-")}</div>
      <div>Fechado por: ${escapeHtml(summary.closedByName || "-")}</div>
      <div>Abertura: ${escapeHtml(formatDateTime(summary.openedAt))}</div>
      <div>Fechamento: ${escapeHtml(formatDateTime(summary.closedAt))}</div>
      <div>Modo: ${summary.blindClosing ? "Fechamento Cego" : "Conferência Aberta"}</div>
      <div class="divider"></div>
      <div class="bold">GAVETA (DINHEIRO)</div>
      <div class="line"><span>Valor inicial</span><span>R$ ${formatMoneyBr(summary.openingAmountDecimal)}</span></div>
      <div class="line"><span>(+) Vendas dinheiro</span><span>R$ ${formatMoneyBr(summary.salesCashTotal)}</span></div>
      <div class="line"><span>(+) Suprimentos</span><span>R$ ${formatMoneyBr(summary.totalSuprimentos)}</span></div>
      <div class="line"><span>(-) Sangrias</span><span>R$ ${formatMoneyBr(summary.totalSangrias)}</span></div>
      <div class="line"><span>(-) Devoluções</span><span>R$ ${formatMoneyBr(summary.cashReturns)}</span></div>
      <div class="line bold"><span>Saldo esperado</span><span>R$ ${formatMoneyBr(summary.expectedCashAmount)}</span></div>
      <div class="line bold"><span>Valor contado</span><span>R$ ${formatMoneyBr(summary.countedCashAmount)}</span></div>
      <div class="line bold"><span>Diferença (${escapeHtml(summary.differenceStatus)})</span><span>R$ ${formatMoneyBr(summary.cashDifference)}</span></div>
      <div class="divider"></div>
      <div class="bold">VENDAS POR PAGAMENTO</div>
      <div class="line"><span>Dinheiro</span><span>R$ ${formatMoneyBr(summary.salesCashTotal)}</span></div>
      <div class="line"><span>PIX</span><span>R$ ${formatMoneyBr(summary.salesPixTotal)}</span></div>
      <div class="line"><span>Débito</span><span>R$ ${formatMoneyBr(summary.salesDebitTotal)}</span></div>
      <div class="line"><span>Crédito</span><span>R$ ${formatMoneyBr(summary.salesCreditTotal)}</span></div>
      <div class="line bold"><span>Total faturado (${summary.salesCount} vendas)</span><span>R$ ${formatMoneyBr(summary.totalSalesAmount)}</span></div>
      <div class="line"><span>Ticket médio</span><span>R$ ${formatMoneyBr(summary.ticketMedio)}</span></div>
      ${summary.movements.length > 0 ? `<div class="divider"></div><div class="bold">MOVIMENTAÇÕES</div>${movementRows}` : ""}
      ${summary.note ? `<div class="divider"></div><div>Obs.: ${escapeHtml(summary.note)}</div>` : ""}
      <div class="divider"></div>
      <div class="center">Conferido em ${escapeHtml(new Date().toLocaleString("pt-BR"))}</div>
    </main>
    <script>window.addEventListener("load", () => window.print());</script>
  </body>
</html>`;
}

function buildA4EspelhoZHtml(summary: CaixaSessionSummaryDto) {
  const movementRows = summary.movements
    .map(
      (mov) => `
      <tr>
        <td>${escapeHtml(formatDateTime(mov.dataHora))}</td>
        <td>${escapeHtml(mov.tipo)}</td>
        <td>${escapeHtml(formatPaymentLabel(mov.formaPagamento))}</td>
        <td>${escapeHtml(mov.descricao || "-")}</td>
        <td>${escapeHtml(mov.usuarioName || "-")}</td>
        <td class="right">R$ ${formatMoneyBr(mov.valor)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Espelho Z - ${escapeHtml(summary.id)}</title>
    <style>
      @page { size: A4 portrait; margin: 14mm; }
      body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; font-size: 12px; }
      h1 { margin: 0 0 4px; font-size: 18px; }
      .meta { color: #475569; margin-bottom: 16px; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
      .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; }
      .box-label { font-size: 11px; color: #475569; text-transform: uppercase; }
      .box-value { font-size: 16px; font-weight: 700; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
      th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; }
      .right { text-align: right; }
    </style>
  </head>
  <body>
    <h1>Horus PDV — Espelho Z (Fechamento de Caixa)</h1>
    <div class="meta">
      Sessão: ${escapeHtml(summary.id)} • Operador: ${escapeHtml(summary.operatorName || "-")} •
      Abertura: ${escapeHtml(formatDateTime(summary.openedAt))} • Fechamento: ${escapeHtml(formatDateTime(summary.closedAt))}
    </div>
    <div class="grid">
      <div class="box"><div class="box-label">Saldo Esperado (Gaveta)</div><div class="box-value">R$ ${formatMoneyBr(summary.expectedCashAmount)}</div></div>
      <div class="box"><div class="box-label">Valor Contado (Gaveta)</div><div class="box-value">R$ ${formatMoneyBr(summary.countedCashAmount)}</div></div>
      <div class="box"><div class="box-label">Quebra / Sobra (${escapeHtml(summary.differenceStatus)})</div><div class="box-value">R$ ${formatMoneyBr(summary.cashDifference)}</div></div>
      <div class="box"><div class="box-label">Total Faturado (${summary.salesCount} vendas)</div><div class="box-value">R$ ${formatMoneyBr(summary.totalSalesAmount)}</div></div>
      <div class="box"><div class="box-label">Ticket Médio</div><div class="box-value">R$ ${formatMoneyBr(summary.ticketMedio)}</div></div>
      <div class="box"><div class="box-label">Suprimentos / Sangrias</div><div class="box-value">+R$ ${formatMoneyBr(summary.totalSuprimentos)} / -R$ ${formatMoneyBr(summary.totalSangrias)}</div></div>
    </div>
    <table>
      <thead>
        <tr><th>Forma de Pagamento</th><th class="right">Esperado / Vendido</th></tr>
      </thead>
      <tbody>
        <tr><td>Dinheiro</td><td class="right">R$ ${formatMoneyBr(summary.salesCashTotal)}</td></tr>
        <tr><td>PIX</td><td class="right">R$ ${formatMoneyBr(summary.salesPixTotal)}</td></tr>
        <tr><td>Cartão de Débito</td><td class="right">R$ ${formatMoneyBr(summary.salesDebitTotal)}</td></tr>
        <tr><td>Cartão de Crédito</td><td class="right">R$ ${formatMoneyBr(summary.salesCreditTotal)}</td></tr>
      </tbody>
    </table>
    <table>
      <thead>
        <tr><th>Data/Hora</th><th>Tipo</th><th>Pagamento</th><th>Descrição</th><th>Usuário</th><th class="right">Valor</th></tr>
      </thead>
      <tbody>
        ${movementRows || '<tr><td colspan="6">Nenhuma movimentação registrada.</td></tr>'}
      </tbody>
    </table>
    <script>window.addEventListener("load", () => window.print());</script>
  </body>
</html>`;
}

export default function SessionSummaryModal({
  summary,
  onClose,
}: {
  summary: CaixaSessionSummaryDto;
  onClose: () => void;
}) {
  const isShortage = summary.cashDifference < 0;
  const isSurplus = summary.cashDifference > 0;
  const diffColorClass = isShortage
    ? "border-primary/30 bg-primary/10 text-primary"
    : isSurplus
      ? "border-accent/30 bg-accent/10 text-accent"
      : "border-success/30 bg-success/10 text-success";

  const handlePrint = (format: "thermal" | "a4") => {
    const popup = window.open(
      "",
      "_blank",
      format === "thermal" ? "width=420,height=720" : "width=960,height=720",
    );
    if (!popup) return;
    popup.document.open();
    popup.document.write(
      format === "thermal"
        ? buildThermalEspelhoZHtml(summary)
        : buildA4EspelhoZHtml(summary),
    );
    popup.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-layer-modal flex items-center justify-center bg-black/55 px-3 py-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-summary-modal-title"
    >
      <div className="card flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border-primary px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 id="session-summary-modal-title" className="text-lg font-bold text-text-primary">
                Espelho Z — Fechamento de Caixa
              </h3>
              <span className="rounded-full border border-border-primary bg-bg-primary px-2.5 py-0.5 text-xs font-semibold text-text-secondary">
                {summary.blindClosing ? "Fechamento Cego" : "Conferência Aberta"}
              </span>
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              Sessão {summary.id} • Operador: {summary.operatorName || "-"} • Abertura:{" "}
              {formatDateTime(summary.openedAt)} • Fechamento: {formatDateTime(summary.closedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar Espelho Z"
            className="rounded-lg p-1.5 text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border-primary bg-bg-primary p-3">
              <p className="text-xs text-text-secondary">Saldo esperado em gaveta</p>
              <p className="mt-1 text-lg font-bold text-text-primary">
                R$ {formatMoneyBr(summary.expectedCashAmount)}
              </p>
            </div>
            <div className="rounded-xl border border-border-primary bg-bg-primary p-3">
              <p className="text-xs text-text-secondary">Valor contado em dinheiro</p>
              <p className="mt-1 text-lg font-bold text-text-primary">
                R$ {formatMoneyBr(summary.countedCashAmount)}
              </p>
            </div>
            <div className={`rounded-xl border p-3 ${diffColorClass}`}>
              <p className="text-xs font-semibold uppercase">
                Diferença ({summary.differenceStatus})
              </p>
              <p className="mt-1 text-lg font-bold">
                R$ {formatMoneyBr(summary.cashDifference)}
              </p>
            </div>
            <div className="rounded-xl border border-border-primary bg-bg-primary p-3">
              <p className="text-xs text-text-secondary">
                Faturamento ({summary.salesCount} vendas)
              </p>
              <p className="mt-1 text-lg font-bold text-text-primary">
                R$ {formatMoneyBr(summary.totalSalesAmount)}
              </p>
              <p className="text-xs text-text-secondary">
                Ticket médio: R$ {formatMoneyBr(summary.ticketMedio)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border-primary p-4">
              <h4 className="mb-3 text-sm font-semibold text-text-primary">
                Composição da Gaveta (Dinheiro)
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Fundo inicial</span>
                  <span className="font-medium text-text-primary">
                    R$ {formatMoneyBr(summary.openingAmountDecimal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">(+) Vendas em dinheiro</span>
                  <span className="font-medium text-success">
                    R$ {formatMoneyBr(summary.salesCashTotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">(+) Suprimentos</span>
                  <span className="font-medium text-success">
                    R$ {formatMoneyBr(summary.totalSuprimentos)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">(-) Sangrias</span>
                  <span className="font-medium text-primary">
                    R$ {formatMoneyBr(summary.totalSangrias)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">(-) Devoluções em dinheiro</span>
                  <span className="font-medium text-primary">
                    R$ {formatMoneyBr(summary.cashReturns)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border-primary p-4">
              <h4 className="mb-3 text-sm font-semibold text-text-primary">
                Totais por Forma de Pagamento
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Dinheiro</span>
                  <span className="font-semibold text-text-primary">
                    R$ {formatMoneyBr(summary.salesCashTotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">PIX</span>
                  <span className="font-semibold text-text-primary">
                    R$ {formatMoneyBr(summary.salesPixTotal)}
                    {summary.countedPixAmount != null
                      ? ` (contado: R$ ${formatMoneyBr(summary.countedPixAmount)})`
                      : ""}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Cartão de Débito</span>
                  <span className="font-semibold text-text-primary">
                    R$ {formatMoneyBr(summary.salesDebitTotal)}
                    {summary.countedDebitAmount != null
                      ? ` (contado: R$ ${formatMoneyBr(summary.countedDebitAmount)})`
                      : ""}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Cartão de Crédito</span>
                  <span className="font-semibold text-text-primary">
                    R$ {formatMoneyBr(summary.salesCreditTotal)}
                    {summary.countedCreditAmount != null
                      ? ` (contado: R$ ${formatMoneyBr(summary.countedCreditAmount)})`
                      : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border-primary overflow-hidden">
            <div className="border-b border-border-primary bg-bg-gray-theme px-4 py-2.5">
              <h4 className="text-sm font-semibold text-text-primary">
                Extrato de Movimentações da Sessão
              </h4>
            </div>
            <div className="max-h-60 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg-primary text-xs uppercase text-text-secondary">
                  <tr>
                    <th className="px-3 py-2 text-left">Data/Hora</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">Pagamento</th>
                    <th className="px-3 py-2 text-left">Descrição</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.movements.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-text-secondary">
                        Nenhuma movimentação registrada nesta sessão.
                      </td>
                    </tr>
                  ) : (
                    summary.movements.map((mov) => (
                      <tr key={mov.id} className="border-t border-border-primary">
                        <td className="px-3 py-2 text-text-secondary">
                          {formatDateTime(mov.dataHora)}
                        </td>
                        <td className="px-3 py-2 font-semibold text-text-primary">{mov.tipo}</td>
                        <td className="px-3 py-2 text-text-secondary">
                          {formatPaymentLabel(mov.formaPagamento)}
                        </td>
                        <td className="px-3 py-2 text-text-secondary">{mov.descricao || "-"}</td>
                        <td className="px-3 py-2 text-right font-semibold text-text-primary">
                          R$ {formatMoneyBr(mov.valor)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-primary px-5 py-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handlePrint("thermal")}
              className="btn-outline-secondary inline-flex items-center gap-2 text-sm"
            >
              <Printer size={16} />
              Imprimir Cupom (80mm)
            </button>
            <button
              type="button"
              onClick={() => handlePrint("a4")}
              className="btn-outline-secondary inline-flex items-center gap-2 text-sm"
            >
              <FileText size={16} />
              Imprimir Espelho Z (A4)
            </button>
          </div>
          <button type="button" onClick={onClose} className="btn-primary">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
