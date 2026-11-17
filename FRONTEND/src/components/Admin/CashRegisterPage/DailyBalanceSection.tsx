/**
 * Arquivo: src/components/Admin/CashRegisterPage/DailyBalanceSection.tsx
 * Objetivo: consolida o Balanço Diário de caixa por data para perfis supervisores (administrador, gerente, financeiro).
 * Entradas esperadas: recebe callback para abrir Espelho Z de uma sessão do dia e token de atualização.
 */
import { CalendarCheck2, FileText, Printer, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DatePickerField } from "@/components/Form";
import { Toast } from "@/hooks/Dialog";
import {
  cashRegisterService,
  type CaixaSessionSummaryDto,
  type DailyBalanceDto,
} from "@/services/api/cashRegisterService";
import { formatMoneyBr } from "@/utils/inputMasks";

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

function buildDailyBalancePrintHtml(balance: DailyBalanceDto) {
  const sessionRows = balance.sessions
    .map(
      (session) => `
      <tr>
        <td>${escapeHtml(session.operatorName || "-")}</td>
        <td>${escapeHtml(formatDateTime(session.openedAt))}</td>
        <td>${escapeHtml(formatDateTime(session.closedAt))}</td>
        <td class="right">R$ ${formatMoneyBr(session.expectedCashAmount)}</td>
        <td class="right">R$ ${formatMoneyBr(session.countedCashAmount)}</td>
        <td class="right">R$ ${formatMoneyBr(session.cashDifference)}</td>
        <td class="right">R$ ${formatMoneyBr(session.totalSalesAmount)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Balanço Diário - ${escapeHtml(balance.date)}</title>
    <style>
      @page { size: A4 portrait; margin: 14mm; }
      body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; font-size: 12px; }
      h1 { margin: 0 0 4px; font-size: 18px; }
      .meta { color: #475569; margin-bottom: 16px; }
      .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
      .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; }
      .box-label { font-size: 11px; color: #475569; text-transform: uppercase; }
      .box-value { font-size: 15px; font-weight: 700; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
      th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; }
      .right { text-align: right; }
    </style>
  </head>
  <body>
    <h1>Horus PDV — Balanço Diário de Caixa</h1>
    <div class="meta">Data de referência: ${escapeHtml(balance.date)} • Sessões: ${balance.sessionsCount} (${balance.closedSessionsCount} fechadas, ${balance.openSessionsCount} abertas)</div>
    <div class="grid">
      <div class="box"><div class="box-label">Faturamento Total</div><div class="box-value">R$ ${formatMoneyBr(balance.totalSalesAmount)}</div></div>
      <div class="box"><div class="box-label">Vendas / Ticket Médio</div><div class="box-value">${balance.salesCount} / R$ ${formatMoneyBr(balance.ticketMedio)}</div></div>
      <div class="box"><div class="box-label">Esperado / Contado</div><div class="box-value">R$ ${formatMoneyBr(balance.totalExpectedCashAmount)} / R$ ${formatMoneyBr(balance.totalCountedCashAmount)}</div></div>
      <div class="box"><div class="box-label">Quebra / Sobra Total</div><div class="box-value">R$ ${formatMoneyBr(balance.totalCashDifference)}</div></div>
    </div>
    <table>
      <thead>
        <tr><th>Dinheiro</th><th>PIX</th><th>Cartão Débito</th><th>Cartão Crédito</th><th>Suprimentos</th><th>Sangrias</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>R$ ${formatMoneyBr(balance.salesCashTotal)}</td>
          <td>R$ ${formatMoneyBr(balance.salesPixTotal)}</td>
          <td>R$ ${formatMoneyBr(balance.salesDebitTotal)}</td>
          <td>R$ ${formatMoneyBr(balance.salesCreditTotal)}</td>
          <td>R$ ${formatMoneyBr(balance.totalSuprimentos)}</td>
          <td>R$ ${formatMoneyBr(balance.totalSangrias)}</td>
        </tr>
      </tbody>
    </table>
    <table>
      <thead>
        <tr>
          <th>Operador</th>
          <th>Abertura</th>
          <th>Fechamento</th>
          <th class="right">Esperado</th>
          <th class="right">Contado</th>
          <th class="right">Diferença</th>
          <th class="right">Vendas</th>
        </tr>
      </thead>
      <tbody>
        ${sessionRows || '<tr><td colspan="7">Nenhuma sessão registrada na data selecionada.</td></tr>'}
      </tbody>
    </table>
    <script>window.addEventListener("load", () => window.print());</script>
  </body>
</html>`;
}

export default function DailyBalanceSection({
  refreshToken,
  onSelectSessionSummary,
}: {
  refreshToken: number;
  onSelectSessionSummary: (summary: CaixaSessionSummaryDto) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(getTodayIsoDate);
  const [balance, setBalance] = useState<DailyBalanceDto | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(async (dateValue: string) => {
    setLoading(true);
    try {
      const data = await cashRegisterService.getDailyBalance(dateValue);
      setBalance(data ?? null);
    } catch (error) {
      Toast.error(
        error instanceof Error ? error.message : "Não foi possível carregar o balanço diário.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    cashRegisterService
      .getDailyBalance(selectedDate)
      .then((data) => {
        if (active) setBalance(data ?? null);
      })
      .catch(() => {
        if (active) setBalance(null);
      });
    return () => {
      active = false;
    };
  }, [selectedDate, refreshToken]);

  const handlePrintBalance = () => {
    if (!balance) return;
    const popup = window.open("", "_blank", "width=980,height=720");
    if (!popup) return;
    popup.document.open();
    popup.document.write(buildDailyBalancePrintHtml(balance));
    popup.document.close();
  };

  return (
    <section className="card overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-3 border-b border-border-primary px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <CalendarCheck2 size={20} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Balanço Diário Consolidado</h2>
            <p className="text-sm text-text-secondary">
              Totais por forma de pagamento, sangrias, suprimentos e quebra de caixa do dia.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44">
            <DatePickerField
              value={selectedDate}
              onChange={(nextDate) => {
                if (nextDate) setSelectedDate(nextDate);
              }}
              placeholder="Selecionar data"
            />
          </div>
          <button
            type="button"
            onClick={() => fetchBalance(selectedDate)}
            disabled={loading}
            className="btn-outline-secondary inline-flex items-center gap-2 text-sm"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Consultar
          </button>
          <button
            type="button"
            onClick={handlePrintBalance}
            disabled={!balance}
            className="btn-outline-secondary inline-flex items-center gap-2 text-sm"
          >
            <Printer size={15} />
            Imprimir Balanço
          </button>
        </div>
      </div>

      {balance ? (
        <div className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border-primary bg-bg-primary p-3">
              <p className="text-xs text-text-secondary">Faturamento do dia</p>
              <p className="mt-1 text-xl font-bold text-text-primary">
                R$ {formatMoneyBr(balance.totalSalesAmount)}
              </p>
              <p className="text-xs text-text-secondary">
                {balance.salesCount} vendas • Ticket médio: R$ {formatMoneyBr(balance.ticketMedio)}
              </p>
            </div>
            <div className="rounded-xl border border-border-primary bg-bg-primary p-3">
              <p className="text-xs text-text-secondary">Saldo esperado vs contado</p>
              <p className="mt-1 text-base font-bold text-text-primary">
                R$ {formatMoneyBr(balance.totalExpectedCashAmount)} / R${" "}
                {formatMoneyBr(balance.totalCountedCashAmount)}
              </p>
              <p className="text-xs text-text-secondary">
                {balance.sessionsCount} sessões ({balance.closedSessionsCount} fechadas)
              </p>
            </div>
            <div className="rounded-xl border border-border-primary bg-bg-primary p-3">
              <p className="text-xs text-text-secondary">Quebra / Sobra acumulada</p>
              <p
                className={`mt-1 text-xl font-bold ${
                  balance.totalCashDifference < 0
                    ? "text-primary"
                    : balance.totalCashDifference > 0
                      ? "text-accent"
                      : "text-success"
                }`}
              >
                R$ {formatMoneyBr(balance.totalCashDifference)}
              </p>
            </div>
            <div className="rounded-xl border border-border-primary bg-bg-primary p-3">
              <p className="text-xs text-text-secondary">Suprimentos / Sangrias</p>
              <p className="mt-1 text-base font-bold text-text-primary">
                <span className="text-success">+R$ {formatMoneyBr(balance.totalSuprimentos)}</span>{" "}
                /{" "}
                <span className="text-primary">-R$ {formatMoneyBr(balance.totalSangrias)}</span>
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border-primary px-3 py-2.5">
              <p className="text-xs text-text-secondary">Dinheiro</p>
              <p className="font-bold text-text-primary">
                R$ {formatMoneyBr(balance.salesCashTotal)}
              </p>
            </div>
            <div className="rounded-xl border border-border-primary px-3 py-2.5">
              <p className="text-xs text-text-secondary">PIX</p>
              <p className="font-bold text-text-primary">
                R$ {formatMoneyBr(balance.salesPixTotal)}
              </p>
            </div>
            <div className="rounded-xl border border-border-primary px-3 py-2.5">
              <p className="text-xs text-text-secondary">Cartão de Débito</p>
              <p className="font-bold text-text-primary">
                R$ {formatMoneyBr(balance.salesDebitTotal)}
              </p>
            </div>
            <div className="rounded-xl border border-border-primary px-3 py-2.5">
              <p className="text-xs text-text-secondary">Cartão de Crédito</p>
              <p className="font-bold text-text-primary">
                R$ {formatMoneyBr(balance.salesCreditTotal)}
              </p>
            </div>
          </div>

          {balance.sessions.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border-primary">
              <table className="min-w-[780px] w-full text-sm">
                <thead className="bg-bg-gray-theme text-xs uppercase text-text-secondary">
                  <tr>
                    <th className="px-3 py-2 text-left">Operador</th>
                    <th className="px-3 py-2 text-left">Abertura</th>
                    <th className="px-3 py-2 text-left">Fechamento</th>
                    <th className="px-3 py-2 text-right">Esperado</th>
                    <th className="px-3 py-2 text-right">Contado</th>
                    <th className="px-3 py-2 text-right">Diferença</th>
                    <th className="px-3 py-2 text-right">Vendas</th>
                    <th className="px-3 py-2 text-right">Espelho Z</th>
                  </tr>
                </thead>
                <tbody>
                  {balance.sessions.map((session) => (
                    <tr key={session.id} className="border-t border-border-primary">
                      <td className="px-3 py-2 font-medium text-text-primary">
                        {session.operatorName || "-"}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">
                        {formatDateTime(session.openedAt)}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">
                        {formatDateTime(session.closedAt)}
                      </td>
                      <td className="px-3 py-2 text-right text-text-primary">
                        R$ {formatMoneyBr(session.expectedCashAmount)}
                      </td>
                      <td className="px-3 py-2 text-right text-text-secondary">
                        R$ {formatMoneyBr(session.countedCashAmount)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold ${
                          session.cashDifference < 0
                            ? "text-primary"
                            : session.cashDifference > 0
                              ? "text-accent"
                              : "text-success"
                        }`}
                      >
                        R$ {formatMoneyBr(session.cashDifference)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-text-primary">
                        R$ {formatMoneyBr(session.totalSalesAmount)} ({session.salesCount})
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectSessionSummary(session)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border-secondary px-2.5 py-1 text-xs font-semibold text-text-primary transition hover:bg-hover-light"
                        >
                          <FileText size={13} />
                          Espelho Z
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-xl border border-border-primary bg-bg-primary px-4 py-4 text-center text-sm text-text-secondary">
              Nenhuma sessão de caixa aberta nesta data.
            </p>
          )}
        </div>
      ) : (
        <div className="p-6 text-center text-sm text-text-secondary">
          Carregando balanço diário...
        </div>
      )}
    </section>
  );
}
