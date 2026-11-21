/**
 * Arquivo: src/pages/Admin/CashRegisterPage.tsx
 * Objetivo: gerencia abertura, sangria, suprimento, fechamento cego, espelho Z, histórico e balanço diário do caixa.
 * Entradas esperadas: não recebe props; carrega status via API e executa ações do operador autenticado.
 */
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Clock3,
  EyeOff,
  FileText,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UnlockKeyhole,
} from "lucide-react";
import { type ClipboardEvent, type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import CashMovementModal from "@/components/Admin/CashRegisterPage/CashMovementModal";
import DailyBalanceSection from "@/components/Admin/CashRegisterPage/DailyBalanceSection";
import SessionSummaryModal from "@/components/Admin/CashRegisterPage/SessionSummaryModal";
import PageHeader from "@/components/Admin/PageHeader";
import { YesNoSegmentedControl } from "@/components/Form";
import LoadingBar from "@/components/Loading/LoadingBar";
import LoadingButton from "@/components/Loading/LoadingButton";
import TablePagination from "@/components/Pagination/TablePagination";
import { Toast, useStatusDialog } from "@/hooks/Dialog";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";
import PageLayout from "@/layout/PageLayout";
import {
  type CaixaSessionSummaryDto,
  type CashMovementDto,
  cashRegisterService,
  type CashRegisterSessionDto,
  type CashRegisterStatusDto,
} from "@/services/api/cashRegisterService";
import { getStoredAuthUser } from "@/utils/authStorage";
import { formatMoneyBr } from "@/utils/inputMasks";
import { SUPERVISORY_ROLES } from "@/utils/roles";

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

function preventInvalidMoneyBeforeInput(event: FormEvent<HTMLInputElement>) {
  const data = (event.nativeEvent as InputEvent).data ?? "";
  if (data && /[^0-9,.]/.test(data)) {
    event.preventDefault();
  }
}

function SessionRow({
  session,
  isSupervisor,
  onOpenSummary,
}: {
  session: CashRegisterSessionDto;
  isSupervisor: boolean;
  onOpenSummary: (sessionId: string) => void;
}) {
  const isOpen = session.status.toLowerCase() === "aberto";
  const canInspectSummary = !isOpen || isSupervisor;
  const diffValue = session.cashDifference;

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
        R$ {session.closingAmount || "0,00"}
      </td>
      <td className="px-3 py-3 text-right text-text-secondary">
        {session.totalSuprimentos != null && session.totalSangrias != null
          ? `+${formatMoneyBr(session.totalSuprimentos)} / -${formatMoneyBr(session.totalSangrias)}`
          : "-"}
      </td>
      <td
        className={`px-3 py-3 text-right font-semibold ${
          diffValue == null
            ? "text-text-secondary"
            : diffValue < 0
              ? "text-primary"
              : diffValue > 0
                ? "text-accent"
                : "text-success"
        }`}
      >
        {diffValue == null ? "-" : `R$ ${formatMoneyBr(diffValue)}`}
      </td>
      <td className="px-3 py-3 text-right">
        {canInspectSummary ? (
          <button
            type="button"
            onClick={() => onOpenSummary(session.id)}
            className="inline-flex items-center gap-1 rounded-lg border border-border-secondary px-2.5 py-1 text-xs font-semibold text-text-primary transition hover:bg-hover-light"
          >
            <FileText size={13} />
            Espelho Z
          </button>
        ) : (
          <span className="text-xs text-text-secondary">Sigilo ativo</span>
        )}
      </td>
    </tr>
  );
}

export default function CashRegisterPage() {
  const { maskMoneyBr } = useInputMasks();
  const statusDialog = useStatusDialog();
  const authUser = getStoredAuthUser();
  const userRole = (authUser?.role ?? "").trim().toLowerCase();
  const isSupervisor = SUPERVISORY_ROLES.has(userRole);

  const [cashStatus, setCashStatus] = useState<CashRegisterStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("0,00");
  const [closingAmount, setClosingAmount] = useState("0,00");
  const [countedPixAmount, setCountedPixAmount] = useState("");
  const [countedDebitAmount, setCountedDebitAmount] = useState("");
  const [countedCreditAmount, setCountedCreditAmount] = useState("");
  const [showMethodCounts, setShowMethodCounts] = useState(false);
  const [blindClosing, setBlindClosing] = useState(true);
  const [closingNote, setClosingNote] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [movementModalMode, setMovementModalMode] = useState<"sangria" | "suprimento" | null>(null);
  const [activeSummary, setActiveSummary] = useState<CaixaSessionSummaryDto | null>(null);
  const [dailyRefreshToken, setDailyRefreshToken] = useState(0);

  const currentSession = cashStatus?.currentSession ?? null;
  const canSell = cashStatus?.canSell === true;
  const hasOpenSession = currentSession !== null;

  const stateTone = useMemo(() => {
    if (canSell) return "border-success/30 bg-success/10 text-success";
    if (cashStatus?.state === "expirado") return "border-primary/30 bg-primary/10 text-primary";
    return "border-accent/30 bg-accent/10 text-accent";
  }, [canSell, cashStatus?.state]);

  const historyRows = useMemo(() => cashStatus?.history ?? [], [cashStatus?.history]);
  const currentMovements = useMemo<CashMovementDto[]>(
    () => cashStatus?.currentMovements ?? [],
    [cashStatus?.currentMovements],
  );
  const totalPages = Math.max(1, Math.ceil(historyRows.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedHistoryRows = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return historyRows.slice(start, start + itemsPerPage);
  }, [historyRows, itemsPerPage, safeCurrentPage]);

  const applyStatusResponse = useCallback((status: CashRegisterStatusDto | null | undefined) => {
    setCashStatus(status ?? null);
    setClosingAmount(status?.currentSession?.closingAmount || "0,00");
  }, []);

  const loadStatus = useCallback(async () => {
    const status = await cashRegisterService.status();
    applyStatusResponse(status);
  }, [applyStatusResponse]);

  useEffect(() => {
    let active = true;
    cashRegisterService
      .status()
      .then((status) => {
        if (active) applyStatusResponse(status);
      })
      .catch(() => {
        if (active) Toast.error("Não foi possível carregar o status do caixa.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyStatusResponse]);

  const updateOpeningAmount = (value: string) => setOpeningAmount(maskMoneyBr(value));
  const updateClosingAmount = (value: string) => setClosingAmount(maskMoneyBr(value));

  const pasteOpeningAmount = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    updateOpeningAmount(event.clipboardData.getData("text"));
  };

  const pasteClosingAmount = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    updateClosingAmount(event.clipboardData.getData("text"));
  };

  const openCashRegister = async () => {
    setSaving(true);
    try {
      const status = await cashRegisterService.open(openingAmount);
      applyStatusResponse(status);
      setDailyRefreshToken((token) => token + 1);
      Toast.success("Caixa aberto. Frente de caixa liberada para venda.");
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Não foi possível abrir o caixa.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitMovement = async (amount: string, description: string) => {
    if (!movementModalMode) return;
    setSaving(true);
    try {
      if (movementModalMode === "sangria") {
        await cashRegisterService.sangria(amount, description);
        Toast.success("Sangria registrada com sucesso.");
      } else {
        await cashRegisterService.suprimento(amount, description);
        Toast.success("Suprimento registrado com sucesso.");
      }
      setMovementModalMode(null);
      await loadStatus();
      setDailyRefreshToken((token) => token + 1);
    } catch (error) {
      Toast.error(
        error instanceof Error ? error.message : "Não foi possível registrar a movimentação.",
      );
    } finally {
      setSaving(false);
    }
  };

  const closeCashRegister = async () => {
    const confirmed = await statusDialog.confirm("Fechar o caixa atual?");
    if (!confirmed) return;

    setSaving(true);
    try {
      const summary = await cashRegisterService.closeDetailed({
        closingAmount,
        countedPixAmount: countedPixAmount.trim() ? countedPixAmount : null,
        countedDebitAmount: countedDebitAmount.trim() ? countedDebitAmount : null,
        countedCreditAmount: countedCreditAmount.trim() ? countedCreditAmount : null,
        blindClosing,
        note: closingNote,
      });

      setClosingNote("");
      setCountedPixAmount("");
      setCountedDebitAmount("");
      setCountedCreditAmount("");
      setShowMethodCounts(false);
      await loadStatus();
      setDailyRefreshToken((token) => token + 1);
      if (summary) {
        setActiveSummary(summary);
      }
      Toast.success("Caixa fechado. Vendas bloqueadas até nova abertura.");
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Não foi possível fechar o caixa.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSessionSummary = async (sessionId: string) => {
    try {
      const summary = await cashRegisterService.getSessionSummary(sessionId);
      if (summary) {
        setActiveSummary(summary);
      }
    } catch (error) {
      Toast.error(
        error instanceof Error ? error.message : "Não foi possível abrir o Espelho Z da sessão.",
      );
    }
  };

  const refreshStatus = async () => {
    setLoading(true);
    try {
      await loadStatus();
      setDailyRefreshToken((token) => token + 1);
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
        description="Controle operacional do caixa com sangria, suprimento, fechamento cego e balanço diário."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {hasOpenSession ? (
              <>
                <button
                  type="button"
                  onClick={() => setMovementModalMode("suprimento")}
                  disabled={loading || saving || !canSell}
                  className="btn-success inline-flex items-center gap-2 text-sm"
                >
                  <ArrowUpCircle size={16} />
                  Suprimento
                </button>
                <button
                  type="button"
                  onClick={() => setMovementModalMode("sangria")}
                  disabled={loading || saving || !canSell}
                  className="btn-cancel inline-flex items-center gap-2 text-sm"
                >
                  <ArrowDownCircle size={16} />
                  Sangria
                </button>
              </>
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

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="card rounded-2xl p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-text-primary">
            <div className="flex items-center gap-2">
              <Banknote size={18} />
              <h2 className="text-lg font-semibold">
                {hasOpenSession ? "Fechar caixa atual" : "Abrir caixa do dia"}
              </h2>
            </div>
            {hasOpenSession && !isSupervisor ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                <EyeOff size={13} />
                Conferência cega ativa
              </span>
            ) : null}
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
                  <p className="text-xs text-text-secondary">Tempo aberto</p>
                  <p className="mt-1 text-lg font-bold text-text-primary">
                    {formatElapsed(currentSession.elapsedMinutes)}
                  </p>
                </div>
                <div className="rounded-xl border border-border-primary bg-bg-primary p-3">
                  <p className="text-xs text-text-secondary">Status</p>
                  <p className="mt-1 text-lg font-bold text-text-primary">
                    {canSell ? "Regular" : "Exige fechamento"}
                  </p>
                </div>
              </div>

              {isSupervisor && currentSession.expectedCashAmount != null ? (
                <div className="grid gap-3 rounded-xl border border-accent/25 bg-accent/5 p-3 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-text-secondary">Esperado em gaveta</p>
                    <p className="text-base font-bold text-text-primary">
                      R$ {formatMoneyBr(currentSession.expectedCashAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">Suprimentos</p>
                    <p className="text-base font-bold text-success">
                      +R$ {formatMoneyBr(currentSession.totalSuprimentos ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">Sangrias</p>
                    <p className="text-base font-bold text-primary">
                      -R$ {formatMoneyBr(currentSession.totalSangrias ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">Vendas ({currentSession.salesCount ?? 0})</p>
                    <p className="text-base font-bold text-text-primary">
                      R${" "}
                      {formatMoneyBr(
                        (currentSession.salesCashTotal ?? 0) +
                          (currentSession.salesPixTotal ?? 0) +
                          (currentSession.salesDebitTotal ?? 0) +
                          (currentSession.salesCreditTotal ?? 0),
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border-primary bg-bg-primary px-3 py-2.5 text-xs text-text-secondary">
                  Fechamento cego: informe o total em dinheiro contado na gaveta. A apuração de sobra
                  ou quebra de caixa será exibida no Espelho Z após a confirmação.
                </div>
              )}

              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">
                  Valor de fechamento
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

              <div>
                <button
                  type="button"
                  onClick={() => setShowMethodCounts((prev) => !prev)}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  {showMethodCounts
                    ? "Ocultar conferência por forma de pagamento"
                    : "+ Conferir valores de PIX / Cartões (opcional)"}
                </button>

                {showMethodCounts ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="block">
                      <span className="mb-1 block text-xs text-text-secondary">PIX contado</span>
                      <input
                        value={countedPixAmount}
                        inputMode="numeric"
                        pattern="[0-9,.]*"
                        onBeforeInput={preventInvalidMoneyBeforeInput}
                        onChange={(event) => setCountedPixAmount(maskMoneyBr(event.target.value))}
                        className="input-field w-full"
                        placeholder="0,00"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-text-secondary">Débito contado</span>
                      <input
                        value={countedDebitAmount}
                        inputMode="numeric"
                        pattern="[0-9,.]*"
                        onBeforeInput={preventInvalidMoneyBeforeInput}
                        onChange={(event) => setCountedDebitAmount(maskMoneyBr(event.target.value))}
                        className="input-field w-full"
                        placeholder="0,00"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-text-secondary">Crédito contado</span>
                      <input
                        value={countedCreditAmount}
                        inputMode="numeric"
                        pattern="[0-9,.]*"
                        onBeforeInput={preventInvalidMoneyBeforeInput}
                        onChange={(event) =>
                          setCountedCreditAmount(maskMoneyBr(event.target.value))
                        }
                        className="input-field w-full"
                        placeholder="0,00"
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              {isSupervisor ? (
                <div className="flex flex-col gap-2 rounded-xl border border-border-primary bg-bg-primary p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      Registrar como fechamento cego auditável
                    </p>
                    <p className="text-xs text-text-secondary">
                      Registra a conferência de caixa sem exibir divergência prévia ao operador.
                    </p>
                  </div>
                  <YesNoSegmentedControl
                    value={blindClosing}
                    onChange={setBlindClosing}
                    ariaLabel="Registrar como fechamento cego auditável"
                  />
                </div>
              ) : null}

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

        <aside className="card rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2 text-text-primary">
            <ShieldCheck size={18} />
            <h2 className="text-lg font-semibold">Regras aplicadas</h2>
          </div>
          <div className="space-y-3 text-sm text-text-secondary">
            <p>Venda só é confirmada se existir caixa aberto no dia.</p>
            <p>Caixa aberto por mais de 24 horas bloqueia novas vendas.</p>
            <p>Caixa vencido precisa ser fechado antes de uma nova abertura.</p>
            <p>Sangrias não podem exceder o saldo em dinheiro disponível na gaveta.</p>
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

      {hasOpenSession ? (
        <section className="card overflow-hidden rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-primary px-4 py-3">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Movimentações da sessão atual
              </h2>
              <p className="text-sm text-text-secondary">
                {isSupervisor
                  ? "Aberturas, suprimentos, sangrias e vendas vinculadas ao caixa em aberto."
                  : "Abertura, suprimentos e sangrias lançadas nesta sessão."}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[700px] w-full text-sm">
              <thead className="bg-bg-gray-theme text-xs uppercase text-text-secondary">
                <tr>
                  <th className="px-3 py-2 text-left">Data/Hora</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Descrição</th>
                  <th className="px-3 py-2 text-left">Usuário</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {currentMovements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-text-secondary">
                      Nenhuma movimentação registrada nesta sessão até o momento.
                    </td>
                  </tr>
                ) : (
                  currentMovements.map((mov) => (
                    <tr key={mov.id} className="border-t border-border-primary">
                      <td className="px-3 py-2.5 text-text-secondary">
                        {formatDateTime(mov.dataHora)}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-text-primary">{mov.tipo}</td>
                      <td className="px-3 py-2.5 text-text-secondary">{mov.descricao || "-"}</td>
                      <td className="px-3 py-2.5 text-text-secondary">
                        {mov.usuarioName || "-"}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-semibold ${
                          mov.tipo === "SANGRIA" || mov.tipo === "DEVOLUCAO"
                            ? "text-primary"
                            : "text-success"
                        }`}
                      >
                        {mov.tipo === "SANGRIA" || mov.tipo === "DEVOLUCAO" ? "-" : "+"}R${" "}
                        {formatMoneyBr(mov.valor)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="card overflow-hidden rounded-2xl">
        <div className="border-b border-border-primary px-4 py-3">
          <h2 className="text-lg font-semibold text-text-primary">Histórico de caixa</h2>
          <p className="text-sm text-text-secondary">
            Sessões de abertura e fechamento com apuração de quebra/sobra e Espelho Z.
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
                <th className="px-3 py-2 text-right">Final</th>
                <th className="px-3 py-2 text-right">Sup. / Sangria</th>
                <th className="px-3 py-2 text-right">Quebra / Sobra</th>
                <th className="px-3 py-2 text-right">Espelho Z</th>
              </tr>
            </thead>
            <tbody>
              {paginatedHistoryRows.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  isSupervisor={isSupervisor}
                  onOpenSummary={handleOpenSessionSummary}
                />
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

      {isSupervisor ? (
        <DailyBalanceSection
          refreshToken={dailyRefreshToken}
          onSelectSessionSummary={(summary) => setActiveSummary(summary)}
        />
      ) : null}

      {movementModalMode ? (
        <CashMovementModal
          key={movementModalMode}
          mode={movementModalMode}
          isSubmitting={saving}
          onClose={() => setMovementModalMode(null)}
          onSubmit={handleSubmitMovement}
        />
      ) : null}

      {activeSummary ? (
        <SessionSummaryModal
          summary={activeSummary}
          onClose={() => setActiveSummary(null)}
        />
      ) : null}

      {statusDialog.Dialog}
    </PageLayout>
  );
}
