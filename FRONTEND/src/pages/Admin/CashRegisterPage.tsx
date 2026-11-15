/**
 * Arquivo: src/pages/Admin/CashRegisterPage.tsx
 * Objetivo: gerencia abertura, fechamento cego, sangria, suprimento, balanço diário e histórico operacional do caixa.
 * Entradas esperadas: não recebe props; carrega status via API e executa ações do operador autenticado.
 */
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Calculator,
  Clock3,
  LockKeyhole,
  Printer,
  RefreshCw,
  ShieldCheck,
  UnlockKeyhole,
  Wallet,
} from "lucide-react";
import { type ClipboardEvent, type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/Admin/PageHeader";
import LoadingBar from "@/components/Loading/LoadingBar";
import LoadingButton from "@/components/Loading/LoadingButton";
import TablePagination from "@/components/Pagination/TablePagination";
import { Toast, useStatusDialog } from "@/hooks/Dialog";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";
import PageLayout from "@/layout/PageLayout";
import {
  cashRegisterService,
  type CashRegisterDailyBalanceDto,
  type CashRegisterMovementDto,
  type CashRegisterSessionDto,
  type CashRegisterStatusDto,
} from "@/services/api/cashRegisterService";

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

function formatElapsed(minutes: number) {
  if (minutes < 1) return "menos de 1 min";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes} min`;
  return `${hours}h ${String(remainingMinutes).padStart(2, "0")}min`;
}

function parseMoneyBr(value?: string | null) {
  if (!value) return 0;
  const cleaned = value.replace(/R\$/gi, "").trim();
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoneyBr(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function preventInvalidMoneyBeforeInput(event: FormEvent<HTMLInputElement>) {
  const data = (event.nativeEvent as InputEvent).data ?? "";
  if (data && /[^0-9,.]/.test(data)) {
    event.preventDefault();
  }
}

function differenceBadgeTone(status?: string) {
  const normalized = (status ?? "CONFERIDO").toUpperCase();
  if (normalized === "SOBRA") return "border-accent/30 bg-accent/15 text-accent";
  if (normalized === "QUEBRA") return "border-primary/30 bg-primary/15 text-primary";
  return "border-success/30 bg-success/15 text-success";
}

function movementBadgeTone(tipo?: string) {
  const normalized = (tipo ?? "").toUpperCase();
  if (normalized === "SANGRIA") return "border-primary/30 bg-primary/15 text-primary";
  if (normalized === "SUPRIMENTO") return "border-success/30 bg-success/15 text-success";
  if (normalized === "VENDA") return "border-accent/30 bg-accent/15 text-accent";
  return "border-secondary/30 bg-secondary/10 text-secondary";
}

function SessionRow({ session }: { session: CashRegisterSessionDto }) {
  const isOpen = session.status.toLowerCase() === "aberto";
  const diffStatus = session.differenceStatus || "CONFERIDO";
  return (
    <tr className="border-b border-border-primary">
      <td className="px-3 py-3">
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
            isOpen
              ? "border-success/30 bg-success/15 text-success"
              : "border-secondary/30 bg-secondary/10 text-secondary"
          }`}
        >
          {session.status}
        </span>
      </td>
      <td className="px-3 py-3 text-text-primary">{formatDateTime(session.openedAt)}</td>
      <td className="px-3 py-3 text-text-secondary">{formatDateTime(session.closedAt)}</td>
      <td className="px-3 py-3 text-text-secondary">{session.operatorName || "-"}</td>
      <td className="px-3 py-3 text-right font-semibold text-text-primary">
        R$ {session.openingAmount || "0,00"}
      </td>
      <td className="px-3 py-3 text-right text-text-secondary">
        R$ {session.expectedAmount || session.openingAmount || "0,00"}
      </td>
      <td className="px-3 py-3 text-right text-text-secondary">
        R$ {session.closingAmount || "0,00"}
      </td>
      <td className="px-3 py-3 text-right">
        {isOpen ? (
          <span className="text-xs text-text-secondary">Em andamento</span>
        ) : (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${differenceBadgeTone(diffStatus)}`}
          >
            {diffStatus} (R$ {session.differenceAmount || "0,00"})
          </span>
        )}
      </td>
    </tr>
  );
}

function MovementRow({ movement }: { movement: CashRegisterMovementDto }) {
  return (
    <tr className="border-b border-border-primary">
      <td className="px-3 py-2.5">
        <span
          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${movementBadgeTone(movement.tipo)}`}
        >
          {movement.tipo}
        </span>
      </td>
      <td className="px-3 py-2.5 text-text-primary">{formatDateTime(movement.createdAt)}</td>
      <td className="px-3 py-2.5 text-text-secondary">{movement.formaPagamento || "Dinheiro"}</td>
      <td className="px-3 py-2.5 text-text-secondary">{movement.descricao || "-"}</td>
      <td className="px-3 py-2.5 text-text-secondary">{movement.operatorName || "-"}</td>
      <td className="px-3 py-2.5 text-right font-semibold text-text-primary">
        R$ {movement.valor || "0,00"}
      </td>
    </tr>
  );
}

function printDailyBalanceReport(balance: CashRegisterDailyBalanceDto, movements: CashRegisterMovementDto[]) {
  const popup = window.open("", "_blank", "width=840,height=720");
  if (!popup) {
    Toast.error("Permita a abertura de pop-ups para imprimir o espelho de caixa.");
    return;
  }

  const breakdownHtml = (balance.paymentBreakdown ?? [])
    .map(
      (item) => `
        <tr>
          <td>${item.formaPagamento}</td>
          <td style="text-align:center">${item.quantidadeVendas}</td>
          <td style="text-align:right">R$ ${item.totalVendido}</td>
          <td style="text-align:right">${item.percentual.toFixed(2)}%</td>
        </tr>`,
    )
    .join("");

  const movementsHtml = movements
    .slice(0, 30)
    .map(
      (mov) => `
        <tr>
          <td>${mov.tipo}</td>
          <td>${formatDateTime(mov.createdAt)}</td>
          <td>${mov.formaPagamento || "Dinheiro"}</td>
          <td>${mov.descricao || "-"}</td>
          <td style="text-align:right">R$ ${mov.valor}</td>
        </tr>`,
    )
    .join("");

  popup.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Espelho de Fechamento e Balanço de Caixa</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
          h1 { font-size: 20px; margin: 0 0 4px; }
          p.sub { color: #4b5563; font-size: 13px; margin: 0 0 18px; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
          .box { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; }
          .box span { display: block; font-size: 11px; color: #6b7280; text-transform: uppercase; }
          .box strong { display: block; font-size: 16px; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 18px; font-size: 13px; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 8px; text-align: left; }
          th { background: #f3f4f6; font-size: 11px; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <h1>Hórus PDV — Espelho de Caixa e Balanço Diário</h1>
        <p class="sub">
          Sessão: ${balance.caixaSessaoId} • Operador: ${balance.operatorName || "-"} •
          Abertura: ${formatDateTime(balance.openedAt)} •
          Fechamento: ${formatDateTime(balance.closedAt)}
        </p>
        <div class="grid">
          <div class="box"><span>Fundo Inicial</span><strong>R$ ${balance.openingAmount}</strong></div>
          <div class="box"><span>Vendas em Dinheiro</span><strong>R$ ${balance.totalCashSales}</strong></div>
          <div class="box"><span>Suprimentos / Sangrias</span><strong>+R$ ${balance.totalSupplies} / -R$ ${balance.totalWithdrawals}</strong></div>
          <div class="box"><span>Saldo Esperado (Gaveta)</span><strong>R$ ${balance.expectedCashAmount}</strong></div>
          <div class="box"><span>Valor Informado</span><strong>R$ ${balance.countedCashAmount ?? balance.expectedCashAmount}</strong></div>
          <div class="box"><span>Conferência (${balance.differenceStatus})</span><strong>R$ ${balance.differenceAmount}</strong></div>
        </div>
        <h3>Faturamento por Forma de Pagamento (${balance.totalSalesCount} vendas • Total R$ ${balance.totalSalesAmount})</h3>
        <table>
          <thead>
            <tr>
              <th>Forma de Pagamento</th>
              <th style="text-align:center">Qtd. Vendas</th>
              <th style="text-align:right">Total Vendido</th>
              <th style="text-align:right">Participação</th>
            </tr>
          </thead>
          <tbody>${breakdownHtml}</tbody>
        </table>
        <h3>Movimentações da Sessão</h3>
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Data/Hora</th>
              <th>Pagamento</th>
              <th>Descrição</th>
              <th style="text-align:right">Valor</th>
            </tr>
          </thead>
          <tbody>${movementsHtml}</tbody>
        </table>
        <script>window.onload = () => { window.print(); };</script>
      </body>
    </html>
  `);
  popup.document.close();
}

export default function CashRegisterPage() {
  const { maskMoneyBr } = useInputMasks();
  const statusDialog = useStatusDialog();
  const [cashStatus, setCashStatus] = useState<CashRegisterStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("0,00");
  const [closingAmount, setClosingAmount] = useState("0,00");
  const [closingNote, setClosingNote] = useState("");
  const [movementType, setMovementType] = useState<"SANGRIA" | "SUPRIMENTO">("SANGRIA");
  const [movementAmount, setMovementAmount] = useState("0,00");
  const [movementReason, setMovementReason] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const currentSession = cashStatus?.currentSession ?? null;
  const currentBalance = cashStatus?.currentBalance ?? null;
  const movements = useMemo(() => cashStatus?.movements ?? [], [cashStatus?.movements]);
  const canSell = cashStatus?.canSell === true;
  const hasOpenSession = currentSession !== null;

  const stateTone = useMemo(() => {
    if (canSell) return "border-success/30 bg-success/10 text-success";
    if (cashStatus?.state === "expirado") return "border-primary/30 bg-primary/10 text-primary";
    return "border-accent/30 bg-accent/10 text-accent";
  }, [canSell, cashStatus?.state]);

  const historyRows = useMemo(() => cashStatus?.history ?? [], [cashStatus?.history]);
  const totalPages = Math.max(1, Math.ceil(historyRows.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedHistoryRows = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return historyRows.slice(start, start + itemsPerPage);
  }, [historyRows, itemsPerPage, safeCurrentPage]);

  const expectedCashNumber = useMemo(
    () => parseMoneyBr(currentBalance?.expectedCashAmount ?? currentSession?.expectedAmount ?? currentSession?.openingAmount),
    [currentBalance?.expectedCashAmount, currentSession?.expectedAmount, currentSession?.openingAmount],
  );

  const countedCashNumber = useMemo(() => parseMoneyBr(closingAmount), [closingAmount]);
  const closingDifferenceNumber = useMemo(
    () => Math.round((countedCashNumber - expectedCashNumber) * 100) / 100,
    [countedCashNumber, expectedCashNumber],
  );
  const closingDifferenceStatus = useMemo(() => {
    if (closingDifferenceNumber > 0) return "SOBRA";
    if (closingDifferenceNumber < 0) return "QUEBRA";
    return "CONFERIDO";
  }, [closingDifferenceNumber]);

  const loadStatus = useCallback(async () => {
    const status = await cashRegisterService.status();
    setCashStatus(status ?? null);
    setClosingAmount(
      status?.currentBalance?.expectedCashAmount ||
        status?.currentSession?.expectedAmount ||
        status?.currentSession?.closingAmount ||
        "0,00",
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStatus()
      .catch(() => {
        Toast.error("Não foi possível carregar o status do caixa.");
      })
      .finally(() => setLoading(false));
  }, [loadStatus]);

  const updateOpeningAmount = (value: string) => setOpeningAmount(maskMoneyBr(value));
  const updateClosingAmount = (value: string) => setClosingAmount(maskMoneyBr(value));
  const updateMovementAmount = (value: string) => setMovementAmount(maskMoneyBr(value));

  const pasteOpeningAmount = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    updateOpeningAmount(event.clipboardData.getData("text"));
  };

  const pasteClosingAmount = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    updateClosingAmount(event.clipboardData.getData("text"));
  };

  const pasteMovementAmount = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    updateMovementAmount(event.clipboardData.getData("text"));
  };

  const openCashRegister = async () => {
    setSaving(true);
    try {
      const status = await cashRegisterService.open(openingAmount);
      setCashStatus(status ?? null);
      setClosingAmount(status?.currentBalance?.expectedCashAmount || openingAmount || "0,00");
      Toast.success("Caixa aberto. Frente de caixa liberada para venda.");
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Não foi possível abrir o caixa.");
    } finally {
      setSaving(false);
    }
  };

  const registerCashMovement = async () => {
    if (parseMoneyBr(movementAmount) <= 0) {
      Toast.error("Informe um valor maior que zero para registrar a movimentação.");
      return;
    }

    setSaving(true);
    try {
      const status =
        movementType === "SANGRIA"
          ? await cashRegisterService.registerSangria(movementAmount, movementReason)
          : await cashRegisterService.registerSuprimento(movementAmount, movementReason);

      setCashStatus(status ?? null);
      setClosingAmount(status?.currentBalance?.expectedCashAmount || closingAmount);
      setMovementAmount("0,00");
      setMovementReason("");
      Toast.success(
        movementType === "SANGRIA"
          ? "Sangria registrada no caixa com sucesso."
          : "Suprimento registrado no caixa com sucesso.",
      );
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Não foi possível registrar a movimentação.");
    } finally {
      setSaving(false);
    }
  };

  const closeCashRegister = async () => {
    const confirmed = await statusDialog.confirm("Fechar o caixa atual?");
    if (!confirmed) return;

    setSaving(true);
    try {
      const status = await cashRegisterService.close(closingAmount, closingNote);
      setCashStatus(status ?? null);
      setClosingNote("");
      Toast.success("Caixa fechado. Vendas bloqueadas até nova abertura.");
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Não foi possível fechar o caixa.");
    } finally {
      setSaving(false);
    }
  };

  const refreshStatus = async () => {
    setLoading(true);
    try {
      await loadStatus();
      Toast.success("Status do caixa atualizado.");
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o caixa.");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !cashStatus) {
    return (
      <div className="flex min-h-[360px] items-center justify-center text-text-secondary">
        <LoadingBar />
      </div>
    );
  }

  return (
    <PageLayout size="wide" className="space-y-4 py-4 md:space-y-6 md:py-6 lg:py-8">
      <PageHeader
        title="Abertura e Fechamento de Caixa"
        description="Controle operacional de abertura, sangria, suprimento, fechamento cego e balanço diário do PDV."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {currentBalance ? (
              <button
                type="button"
                onClick={() => printDailyBalanceReport(currentBalance, movements)}
                className="inline-flex items-center gap-2 rounded-xl border border-border-secondary px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
              >
                <Printer size={16} />
                Imprimir balanço
              </button>
            ) : null}
            <button
              type="button"
              onClick={refreshStatus}
              className="inline-flex items-center gap-2 rounded-xl border border-border-secondary px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
              disabled={loading || saving}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        }
      />

      <section className={`rounded-2xl border p-4 ${stateTone}`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bg-light/80">
              {canSell ? <UnlockKeyhole size={20} /> : <LockKeyhole size={20} />}
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide">
                {canSell ? "Caixa aberto para venda" : "Venda bloqueada"}
              </p>
              <h2 className="text-xl font-bold text-text-primary">
                {canSell
                  ? `Aberto por ${formatElapsed(currentSession?.elapsedMinutes ?? 0)}`
                  : cashStatus?.blockReason || "Abra o caixa para liberar o PDV."}
              </h2>
              {currentSession ? (
                <p className="mt-1 text-sm text-text-secondary">
                  Operador: {currentSession.operatorName || "-"} • Abertura:{" "}
                  {formatDateTime(currentSession.openedAt)}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {currentBalance ? (
        <section className="card rounded-2xl p-4 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-text-primary">
              <Wallet size={18} />
              <h2 className="text-lg font-semibold">
                Balanço Diário do Caixa ({currentBalance.status})
              </h2>
            </div>
            <span className="text-xs font-medium text-text-secondary">
              {currentBalance.totalSalesCount} venda(s) na sessão • Ticket médio: R${" "}
              {currentBalance.averageTicket}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-border-primary bg-bg-primary p-3">
              <p className="text-xs text-text-secondary">Fundo inicial</p>
              <p className="mt-1 text-lg font-bold text-text-primary">
                R$ {currentBalance.openingAmount}
              </p>
            </div>
            <div className="rounded-xl border border-border-primary bg-bg-primary p-3">
              <p className="text-xs text-text-secondary">Vendas em dinheiro</p>
              <p className="mt-1 text-lg font-bold text-success">
                + R$ {currentBalance.totalCashSales}
              </p>
            </div>
            <div className="rounded-xl border border-border-primary bg-bg-primary p-3">
              <p className="text-xs text-text-secondary">Suprimentos / Sangrias</p>
              <p className="mt-1 text-sm font-bold text-text-primary">
                <span className="text-success">+R$ {currentBalance.totalSupplies}</span>
                {" / "}
                <span className="text-primary">-R$ {currentBalance.totalWithdrawals}</span>
              </p>
            </div>
            <div className="rounded-xl border border-border-primary bg-bg-primary p-3">
              <p className="text-xs text-text-secondary">Saldo esperado em gaveta</p>
              <p className="mt-1 text-lg font-bold text-text-primary">
                R$ {currentBalance.expectedCashAmount}
              </p>
            </div>
            <div className="rounded-xl border border-border-primary bg-bg-primary p-3">
              <p className="text-xs text-text-secondary">Faturamento total da sessão</p>
              <p className="mt-1 text-lg font-bold text-accent">
                R$ {currentBalance.totalSalesAmount}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(currentBalance.paymentBreakdown ?? []).map((item) => (
              <div
                key={item.formaPagamento}
                className="flex items-center justify-between rounded-xl border border-border-primary bg-bg-light px-3.5 py-2.5 text-sm"
              >
                <div>
                  <p className="font-semibold text-text-primary">{item.formaPagamento}</p>
                  <p className="text-xs text-text-secondary">
                    {item.quantidadeVendas} venda(s) ({item.percentual.toFixed(1)}%)
                  </p>
                </div>
                <p className="font-bold text-text-primary">R$ {item.totalVendido}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <div className="card rounded-2xl p-4">
            <div className="mb-4 flex items-center gap-2 text-text-primary">
              <Banknote size={18} />
              <h2 className="text-lg font-semibold">
                {hasOpenSession ? "Fechar caixa atual (Conferência)" : "Abrir caixa do dia"}
              </h2>
            </div>

            {hasOpenSession ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border-primary bg-bg-primary p-3">
                    <p className="text-xs text-text-secondary">Valor inicial</p>
                    <p className="mt-1 text-lg font-bold text-text-primary">
                      R$ {currentSession.openingAmount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border-primary bg-bg-primary p-3">
                    <p className="text-xs text-text-secondary">Saldo esperado em gaveta</p>
                    <p className="mt-1 text-lg font-bold text-text-primary">
                      R$ {currentBalance?.expectedCashAmount ?? currentSession.openingAmount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border-primary bg-bg-primary p-3">
                    <p className="text-xs text-text-secondary">Diferença projetada</p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-bold text-text-primary">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${differenceBadgeTone(closingDifferenceStatus)}`}
                      >
                        {closingDifferenceStatus}
                      </span>
                      <span>R$ {formatMoneyBr(closingDifferenceNumber)}</span>
                    </p>
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-sm text-text-secondary">
                    Valor de fechamento (contado em gaveta)
                  </span>
                  <input
                    value={closingAmount}
                    inputMode="numeric"
                    pattern="[0-9,.]*"
                    onBeforeInput={preventInvalidMoneyBeforeInput}
                    onPaste={pasteClosingAmount}
                    onChange={(event) => updateClosingAmount(event.target.value)}
                    className="input-field w-full"
                    placeholder="0,00"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm text-text-secondary">Observação</span>
                  <textarea
                    value={closingNote}
                    onChange={(event) => setClosingNote(event.target.value)}
                    className="input-field min-h-24 w-full resize-y"
                    placeholder="Diferenças, sangria, conferência ou observação do fechamento"
                  />
                </label>

                <LoadingButton
                  type="button"
                  onClick={closeCashRegister}
                  isLoading={saving}
                  loadingLabel="Fechando..."
                  className="btn-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto"
                >
                  <LockKeyhole size={16} />
                  Fechar caixa
                </LoadingButton>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm text-text-secondary">Valor inicial</span>
                  <input
                    value={openingAmount}
                    inputMode="numeric"
                    pattern="[0-9,.]*"
                    onBeforeInput={preventInvalidMoneyBeforeInput}
                    onPaste={pasteOpeningAmount}
                    onChange={(event) => updateOpeningAmount(event.target.value)}
                    className="input-field w-full"
                    placeholder="0,00"
                  />
                </label>

                <LoadingButton
                  type="button"
                  onClick={openCashRegister}
                  isLoading={saving}
                  loadingLabel="Abrindo..."
                  className="btn-success inline-flex w-full items-center justify-center gap-2 sm:w-auto"
                >
                  <UnlockKeyhole size={16} />
                  Abrir caixa
                </LoadingButton>
              </div>
            )}
          </div>

          {hasOpenSession ? (
            <div className="card rounded-2xl p-4">
              <div className="mb-4 flex items-center gap-2 text-text-primary">
                <Calculator size={18} />
                <h2 className="text-lg font-semibold">Sangria e Suprimento de Caixa</h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 mb-4">
                <button
                  type="button"
                  onClick={() => setMovementType("SANGRIA")}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-semibold transition ${
                    movementType === "SANGRIA"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border-primary bg-bg-primary text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <ArrowDownCircle size={18} />
                  <div>
                    <p>Sangria (Retirada)</p>
                    <p className="text-xs font-normal opacity-80">Retirar numerário da gaveta</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setMovementType("SUPRIMENTO")}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-semibold transition ${
                    movementType === "SUPRIMENTO"
                      ? "border-success bg-success/10 text-success"
                      : "border-border-primary bg-bg-primary text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <ArrowUpCircle size={18} />
                  <div>
                    <p>Suprimento (Reforço)</p>
                    <p className="text-xs font-normal opacity-80">Adicionar troco na gaveta</p>
                  </div>
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-end">
                <label className="block">
                  <span className="mb-1.5 block text-sm text-text-secondary">Valor (R$)</span>
                  <input
                    value={movementAmount}
                    inputMode="numeric"
                    pattern="[0-9,.]*"
                    onBeforeInput={preventInvalidMoneyBeforeInput}
                    onPaste={pasteMovementAmount}
                    onChange={(event) => updateMovementAmount(event.target.value)}
                    className="input-field w-full"
                    placeholder="0,00"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm text-text-secondary">Motivo / Justificativa</span>
                  <input
                    value={movementReason}
                    onChange={(event) => setMovementReason(event.target.value)}
                    className="input-field w-full"
                    placeholder={
                      movementType === "SANGRIA"
                        ? "Ex.: Depósito no cofre, pagamento de despesa urgente"
                        : "Ex.: Reforço de moedas e cédulas para troco"
                    }
                  />
                </label>
                <LoadingButton
                  type="button"
                  onClick={registerCashMovement}
                  isLoading={saving}
                  loadingLabel="Salvando..."
                  className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5"
                >
                  Registrar {movementType === "SANGRIA" ? "sangria" : "suprimento"}
                </LoadingButton>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="card rounded-2xl p-4 h-fit">
          <div className="mb-3 flex items-center gap-2 text-text-primary">
            <ShieldCheck size={18} />
            <h2 className="text-lg font-semibold">Regras aplicadas</h2>
          </div>
          <div className="space-y-3 text-sm text-text-secondary">
            <p>Venda só é confirmada se existir caixa aberto no dia.</p>
            <p>Caixa aberto por mais de 24 horas bloqueia novas vendas.</p>
            <p>Sangrias validam o saldo em espécie disponível na gaveta.</p>
            <p>No fechamento, o sistema apura automaticamente quebras ou sobras de caixa.</p>
          </div>
          <div className="mt-4 rounded-xl border border-border-primary bg-bg-primary p-3 text-sm">
            <div className="flex items-center gap-2 text-text-primary">
              <Clock3 size={16} />
              <span className="font-semibold">Última movimentação</span>
            </div>
            <p className="mt-2 text-text-secondary">
              {cashStatus?.lastSession
                ? `${cashStatus.lastSession.status} em ${formatDateTime(
                    cashStatus.lastSession.closedAt || cashStatus.lastSession.openedAt,
                  )}`
                : "Nenhuma movimentação registrada."}
            </p>
          </div>
        </aside>
      </section>

      {movements.length > 0 ? (
        <section className="card overflow-hidden rounded-2xl">
          <div className="border-b border-border-primary px-4 py-3">
            <h2 className="text-lg font-semibold text-text-primary">Movimentações da sessão</h2>
            <p className="text-sm text-text-secondary">
              Registro cronológico de abertura, vendas, suprimentos, sangrias e fechamento.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[820px] w-full text-sm">
              <thead className="bg-bg-gray-theme text-xs uppercase text-text-secondary">
                <tr>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Data/Hora</th>
                  <th className="px-3 py-2 text-left">Forma Pagto.</th>
                  <th className="px-3 py-2 text-left">Descrição</th>
                  <th className="px-3 py-2 text-left">Operador</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {movements.slice(0, 20).map((mov) => (
                  <MovementRow key={mov.id} movement={mov} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="card overflow-hidden rounded-2xl">
        <div className="border-b border-border-primary px-4 py-3">
          <h2 className="text-lg font-semibold text-text-primary">Histórico de caixa</h2>
          <p className="text-sm text-text-secondary">
            Últimas aberturas e fechamentos com conferência de saldo esperado e diferenças.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full text-sm">
            <thead className="bg-bg-gray-theme text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Abertura</th>
                <th className="px-3 py-2 text-left">Fechamento</th>
                <th className="px-3 py-2 text-left">Operador</th>
                <th className="px-3 py-2 text-right">Inicial</th>
                <th className="px-3 py-2 text-right">Esperado</th>
                <th className="px-3 py-2 text-right">Final</th>
                <th className="px-3 py-2 text-right">Conferência</th>
              </tr>
            </thead>
            <tbody>
              {paginatedHistoryRows.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-4">
          <TablePagination
            totalItems={historyRows.length}
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

      {statusDialog.Dialog}
    </PageLayout>
  );
}

