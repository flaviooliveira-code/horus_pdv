import { Banknote, Clock3, LockKeyhole, RefreshCw, ShieldCheck, UnlockKeyhole } from "lucide-react";
import { type ClipboardEvent, type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/Admin/PageHeader";
import LoadingBar from "@/components/Loading/LoadingBar";
import TablePagination from "@/components/Pagination/TablePagination";
import { Toast, useStatusDialog } from "@/hooks/Dialog";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";
import PageLayout from "@/layout/PageLayout";
import {
  cashRegisterService,
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

function preventInvalidMoneyBeforeInput(event: FormEvent<HTMLInputElement>) {
  const data = (event.nativeEvent as InputEvent).data ?? "";
  if (data && /[^0-9,.]/.test(data)) {
    event.preventDefault();
  }
}

function SessionRow({ session }: { session: CashRegisterSessionDto }) {
  const isOpen = session.status.toLowerCase() === "aberto";
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
    </tr>
  );
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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const currentSession = cashStatus?.currentSession ?? null;
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

  const loadStatus = useCallback(async () => {
    const status = await cashRegisterService.status();
    setCashStatus(status ?? null);
    setClosingAmount(status?.currentSession?.closingAmount || "0,00");
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
      setCashStatus(status ?? null);
      Toast.success("Caixa aberto. Frente de caixa liberada para venda.");
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Não foi possível abrir o caixa.");
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
        description="Controle operacional do caixa obrigatório para iniciar vendas no PDV."
        action={
          <button
            type="button"
            onClick={refreshStatus}
            className="inline-flex items-center gap-2 rounded-xl border border-border-secondary px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
            disabled={loading || saving}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
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
          <div className="mb-4 flex items-center gap-2 text-text-primary">
            <Banknote size={18} />
            <h2 className="text-lg font-semibold">
              {hasOpenSession ? "Fechar caixa atual" : "Abrir caixa do dia"}
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

              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">Valor de fechamento</span>
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

              <button
                type="button"
                onClick={closeCashRegister}
                className="btn-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto"
                disabled={saving}
              >
                <LockKeyhole size={16} />
                Fechar caixa
              </button>
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

              <button
                type="button"
                onClick={openCashRegister}
                className="btn-success inline-flex w-full items-center justify-center gap-2 sm:w-auto"
                disabled={saving}
              >
                <UnlockKeyhole size={16} />
                Abrir caixa
              </button>
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

      <section className="card overflow-hidden rounded-2xl">
        <div className="border-b border-border-primary px-4 py-3">
          <h2 className="text-lg font-semibold text-text-primary">Histórico de caixa</h2>
          <p className="text-sm text-text-secondary">Últimas aberturas e fechamentos em memória da API.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-sm">
            <thead className="bg-bg-gray-theme text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Abertura</th>
                <th className="px-3 py-2 text-left">Fechamento</th>
                <th className="px-3 py-2 text-left">Operador</th>
                <th className="px-3 py-2 text-right">Inicial</th>
                <th className="px-3 py-2 text-right">Final</th>
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
