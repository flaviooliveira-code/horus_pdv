/**
 * Arquivo: src/components/Admin/ReportsPage/OperationalExpensesDrawer.tsx
 * Objetivo: gerencia lançamento, edição e exclusão de despesas operacionais para compor o DRE Simplificado.
 * Entradas esperadas: recebe controle de abertura e callback de fechamento.
 */
import { Pencil, Plus, Receipt, Trash2, X } from "lucide-react";
import { type ClipboardEvent, type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { DatePickerField, SearchableSelectField } from "@/components/Form";
import LoadingButton from "@/components/Loading/LoadingButton";
import { Toast, useStatusDialog } from "@/hooks/Dialog";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";
import {
  reportService,
  type OperationalExpenseDto,
  type OperationalExpensePayload,
} from "@/services/api/reportService";

const EXPENSE_CATEGORIES = [
  "Aluguel e Condomínio",
  "Energia, Água e Internet",
  "Folha e Encargos",
  "Impostos e Taxas",
  "Manutenção e Limpeza",
  "Marketing e Vendas",
  "Sistemas e Contabilidade",
  "Operacional Geral",
];

const PAYMENT_METHODS = ["PIX", "Dinheiro", "Boleto", "Transferência", "Cartão de Débito", "Cartão de Crédito"];

function getTodayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function createEmptyExpense(): OperationalExpensePayload {
  const today = getTodayIso();
  return {
    description: "",
    category: "Operacional Geral",
    amount: "0,00",
    competenceDate: today,
    dueDate: today,
    paidDate: today,
    status: "Pago",
    paymentMethod: "PIX",
    observation: "",
  };
}

function parseMoneyBr(raw: string) {
  const cleaned = (raw || "").replace(/R\$/gi, "").trim();
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function OperationalExpensesDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { maskMoneyBr } = useInputMasks();
  const statusDialog = useStatusDialog();
  const [expenses, setExpenses] = useState<OperationalExpenseDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OperationalExpensePayload>(createEmptyExpense);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const items = await reportService.listExpenses();
      setExpenses(items);
    } catch {
      Toast.error("Não foi possível carregar as despesas operacionais.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadExpenses();
  }, [open, loadExpenses]);

  const totalAmount = useMemo(
    () =>
      expenses
        .reduce((acc, item) => acc + parseMoneyBr(item.amount), 0)
        .toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [expenses],
  );

  if (!open) return null;

  const setField = <K extends keyof OperationalExpensePayload>(
    key: K,
    value: OperationalExpensePayload[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handlePasteAmount = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    setField("amount", maskMoneyBr(event.clipboardData.getData("text")));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(createEmptyExpense());
  };

  const handleEdit = (item: OperationalExpenseDto) => {
    setEditingId(item.id);
    setForm({
      description: item.description,
      category: item.category,
      amount: item.amount,
      competenceDate: item.competenceDate,
      dueDate: item.dueDate,
      paidDate: item.paidDate ?? item.competenceDate,
      status: item.status,
      paymentMethod: item.paymentMethod,
      observation: item.observation,
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.description.trim().length < 3) {
      Toast.error("Informe uma descrição com pelo menos 3 caracteres.");
      return;
    }
    if (parseMoneyBr(form.amount) <= 0) {
      Toast.error("Informe um valor maior que zero.");
      return;
    }

    setSaving(true);
    try {
      const payload: OperationalExpensePayload = {
        ...form,
        paidDate: form.status === "Pago" ? form.paidDate || form.competenceDate : null,
      };

      if (editingId) {
        const updated = await reportService.updateExpense(editingId, payload);
        if (updated) {
          setExpenses((current) => current.map((item) => (item.id === editingId ? updated : item)));
        }
        Toast.success("Despesa operacional atualizada.");
      } else {
        const created = await reportService.createExpense(payload);
        if (created) {
          setExpenses((current) => [created, ...current]);
        }
        Toast.success("Despesa operacional registrada.");
      }
      resetForm();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Erro ao salvar despesa operacional.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: OperationalExpenseDto) => {
    const confirmed = await statusDialog.confirm(`Excluir a despesa "${item.description}"?`);
    if (!confirmed) return;

    try {
      await reportService.removeExpense(item.id);
      setExpenses((current) => current.filter((row) => row.id !== item.id));
      Toast.success("Despesa operacional removida.");
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Erro ao excluir despesa.");
    }
  };

  return (
    <div className="dept-drawer-overlay" onClick={onClose}>
      <aside className="dept-drawer-panel max-w-3xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-border-primary p-5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Receipt size={20} />
            </span>
            <div>
              <h3 className="text-xl font-semibold text-text-primary">Despesas Operacionais (DRE)</h3>
              <p className="text-sm text-text-secondary">
                Cadastre aluguel, energia, folha e demais despesas para apuração do lucro líquido.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
            aria-label="Fechar despesas operacionais"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <form onSubmit={handleSubmit} className="card rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-text-primary">
                {editingId ? "Editar despesa operacional" : "Nova despesa operacional"}
              </h4>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Cancelar edição
                </button>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-text-secondary">Descrição *</span>
                <input
                  value={form.description}
                  onChange={(event) => setField("description", event.target.value)}
                  className="input-field w-full"
                  placeholder="Ex.: Conta de Energia Elétrica, Aluguel Salão Comercial"
                />
              </label>

              <SearchableSelectField
                label="Categoria *"
                value={form.category}
                options={EXPENSE_CATEGORIES}
                onChange={(nextValue) => setField("category", nextValue)}
                getOptionValue={(opt) => opt}
                getOptionLabel={(opt) => opt}
                placeholder="Selecione a categoria"
                emptyMessage="Nenhuma categoria encontrada."
              />

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-text-secondary">Valor (R$) *</span>
                <input
                  value={form.amount}
                  inputMode="numeric"
                  onPaste={handlePasteAmount}
                  onChange={(event) => setField("amount", maskMoneyBr(event.target.value))}
                  className="input-field w-full"
                  placeholder="0,00"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-text-secondary">
                  Data de Competência
                </span>
                <DatePickerField
                  value={form.competenceDate}
                  onChange={(nextValue) => setField("competenceDate", nextValue)}
                  className="w-full"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-text-secondary">
                  Data de Vencimento
                </span>
                <DatePickerField
                  value={form.dueDate}
                  onChange={(nextValue) => setField("dueDate", nextValue)}
                  className="w-full"
                />
              </label>

              <SearchableSelectField
                label="Status"
                value={form.status}
                options={["Pago", "Pendente"]}
                onChange={(nextValue) => setField("status", nextValue)}
                getOptionValue={(opt) => opt}
                getOptionLabel={(opt) => opt}
                placeholder="Status"
                emptyMessage="Status não encontrado."
              />

              <SearchableSelectField
                label="Forma de Pagamento"
                value={form.paymentMethod}
                options={PAYMENT_METHODS}
                onChange={(nextValue) => setField("paymentMethod", nextValue)}
                getOptionValue={(opt) => opt}
                getOptionLabel={(opt) => opt}
                placeholder="Forma de pagamento"
                emptyMessage="Nenhuma opção."
              />

              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-text-secondary">Observação</span>
                <input
                  value={form.observation}
                  onChange={(event) => setField("observation", event.target.value)}
                  className="input-field w-full"
                  placeholder="Número do documento, fornecedor ou observação contábil"
                />
              </label>
            </div>

            <div className="flex justify-end">
              <LoadingButton
                type="submit"
                isLoading={saving}
                loadingLabel="Salvando..."
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus size={16} />
                {editingId ? "Atualizar despesa" : "Adicionar despesa"}
              </LoadingButton>
            </div>
          </form>

          <section className="card overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-border-primary px-4 py-3">
              <div>
                <h4 className="text-sm font-semibold text-text-primary">
                  Despesas lançadas ({expenses.length})
                </h4>
                <p className="text-xs text-text-secondary">Total acumulado: R$ {totalAmount}</p>
              </div>
            </div>

            {loading ? (
              <p className="p-6 text-center text-sm text-text-secondary">Carregando despesas...</p>
            ) : expenses.length === 0 ? (
              <p className="p-6 text-center text-sm text-text-secondary">
                Nenhuma despesa operacional cadastrada.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="bg-bg-primary text-left text-xs uppercase text-text-secondary">
                    <tr>
                      <th className="px-3 py-2">Descrição</th>
                      <th className="px-3 py-2">Categoria</th>
                      <th className="px-3 py-2">Competência</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                      <th className="px-3 py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((item) => (
                      <tr key={item.id} className="border-t border-border-primary">
                        <td className="px-3 py-2.5 font-medium text-text-primary">
                          {item.description}
                        </td>
                        <td className="px-3 py-2.5 text-text-secondary">{item.category}</td>
                        <td className="px-3 py-2.5 text-text-secondary">{item.competenceDate}</td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                              item.status === "Pago"
                                ? "border-success/30 bg-success/15 text-success"
                                : "border-accent/30 bg-accent/15 text-accent"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-text-primary">
                          R$ {item.amount}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEdit(item)}
                              className="rounded-lg p-1.5 text-text-secondary hover:bg-hover-light hover:text-text-primary"
                              aria-label={`Editar ${item.description}`}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              className="rounded-lg p-1.5 text-primary hover:bg-primary/10"
                              aria-label={`Excluir ${item.description}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {statusDialog.Dialog}
      </aside>
    </div>
  );
}
