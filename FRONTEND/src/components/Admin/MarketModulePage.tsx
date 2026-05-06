/**
 * Arquivo: src/components/Admin/MarketModulePage.tsx
 * Objetivo: renderizar módulos operacionais conectados à API para gestão avançada do PDV.
 * Entradas esperadas: configuração visual do módulo com KPIs, registros, fluxos e alertas.
 */
import { CheckCircle2, CircleAlert, Clock3, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { type ClipboardEvent, type FormEvent, useMemo, useState } from "react";
import PageHeader from "@/components/Admin/PageHeader";
import { SearchableSelectField } from "@/components/Form";
import RowActionsMenu from "@/components/Admin/RowActionsMenu";
import { Toast, useStatusDialog } from "@/hooks/Dialog";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";
import PageLayout from "@/layout/PageLayout";

export type MarketModuleKpi = {
  label: string;
  value: string;
  hint: string;
  tone: "secondary" | "success" | "accent" | "primary";
};

export type MarketModuleRecord = {
  id: string;
  title: string;
  description: string;
  status: string;
  amount?: string;
  meta: string;
};

export type MarketModuleConfig = {
  id: string;
  title: string;
  description: string;
  primaryAction: string;
  statusLabel: string;
  statusValue: string;
  kpis: MarketModuleKpi[];
  recordsTitle: string;
  records: MarketModuleRecord[];
  workflowTitle: string;
  workflow: string[];
  alerts: string[];
};

export type MarketModuleRecordPayload = {
  title: string;
  description: string;
  status: string;
  amount: string;
  meta: string;
};

type MarketModulePageProps = {
  config: MarketModuleConfig;
  onRefresh: () => Promise<void>;
  onCreate: (payload: MarketModuleRecordPayload) => Promise<void>;
  onUpdate: (recordId: string, payload: MarketModuleRecordPayload) => Promise<void>;
  onDelete: (recordId: string) => Promise<void>;
};

const toneClass: Record<MarketModuleKpi["tone"], string> = {
  secondary: "bg-secondary/10 text-secondary border-secondary/20",
  success: "bg-success/10 text-success border-success/20",
  accent: "bg-accent/10 text-accent border-accent/20",
  primary: "bg-primary/10 text-primary border-primary/20",
};

const emptyForm: MarketModuleRecordPayload = {
  title: "",
  description: "",
  status: "Ativo",
  amount: "",
  meta: "",
};

function getStatusClass(status: string) {
  const normalized = status
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  if (
    normalized.includes("ativo") ||
    normalized.includes("concluido") ||
    normalized.includes("auditado")
  ) {
    return "border-success/30 bg-success/15 text-success";
  }

  if (normalized.includes("cancelado") || normalized.includes("inativo")) {
    return "border-primary/30 bg-primary/15 text-primary";
  }

  if (normalized.includes("pendente") || normalized.includes("analise")) {
    return "border-accent/30 bg-accent/15 text-accent";
  }

  return "border-secondary/30 bg-secondary/10 text-secondary";
}

function toPayload(record: MarketModuleRecord): MarketModuleRecordPayload {
  return {
    title: record.title,
    description: record.description,
    status: record.status,
    amount: record.amount ?? "",
    meta: record.meta,
  };
}

function preventNonDigitBeforeInput(event: FormEvent<HTMLInputElement>) {
  const data = (event.nativeEvent as InputEvent).data ?? "";
  if (data && /\D/.test(data)) {
    event.preventDefault();
  }
}

export default function MarketModulePage({
  config,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
}: MarketModulePageProps) {
  const statusDialog = useStatusDialog();
  const { maskCurrencyBr } = useInputMasks();
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MarketModuleRecord | null>(null);
  const [form, setForm] = useState<MarketModuleRecordPayload>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(() => new Set());

  const formTitle = editingRecord ? "Editar registro" : config.primaryAction;
  const selectedRecords = config.records.filter((record) => selectedRecordIds.has(record.id));
  const allRecordsSelected =
    config.records.length > 0 && selectedRecords.length === config.records.length;
  const statusOptions = useMemo(
    () =>
      ["Ativo", "Pendente", "Em análise", "Concluído", "Auditado", "Cancelado"].map(
        (status) => ({ value: status, label: status }),
      ),
    [],
  );

  const openCreateForm = () => {
    setEditingRecord(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEditForm = (record: MarketModuleRecord) => {
    setEditingRecord(record);
    setForm(toPayload(record));
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingRecord(null);
    setForm(emptyForm);
  };

  const updateField = (field: keyof MarketModuleRecordPayload, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateAmount = (value: string) => {
    updateField("amount", maskCurrencyBr(value));
  };

  const pasteAmount = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    updateAmount(event.clipboardData.getData("text"));
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.title.trim().length < 3) {
      Toast.error("Informe um título com pelo menos 3 caracteres.");
      return;
    }

    setSaving(true);
    try {
      if (editingRecord) {
        await onUpdate(editingRecord.id, form);
        Toast.success("Registro atualizado com sucesso.");
      } else {
        await onCreate(form);
        Toast.success("Registro criado com sucesso.");
      }
      closeForm();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Não foi possível salvar o registro.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: MarketModuleRecord) => {
    const confirmed = await statusDialog.confirm(`Excluir o registro "${record.title}"?`);
    if (!confirmed) return;

    try {
      await onDelete(record.id);
      setSelectedRecordIds((current) => {
        const next = new Set(current);
        next.delete(record.id);
        return next;
      });
      Toast.success("Registro excluído com sucesso.");
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Não foi possível excluir o registro.");
    }
  };

  const toggleRecordSelection = (recordId: string) => {
    setSelectedRecordIds((current) => {
      const next = new Set(current);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  const toggleAllRecordsSelection = () => {
    setSelectedRecordIds((current) => {
      const next = new Set(current);
      if (allRecordsSelected) {
        config.records.forEach((record) => next.delete(record.id));
      } else {
        config.records.forEach((record) => next.add(record.id));
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const selectedIds = Array.from(selectedRecordIds);
    if (selectedIds.length === 0) return;

    const confirmed = await statusDialog.confirm(
      `Excluir ${selectedIds.length} registro(s) selecionado(s)?`,
    );
    if (!confirmed) return;

    const removedIds: string[] = [];
    for (const recordId of selectedIds) {
      try {
        await onDelete(recordId);
        removedIds.push(recordId);
      } catch {
        // A mensagem final consolida falhas sem interromper os demais registros.
      }
    }

    if (removedIds.length > 0) {
      setSelectedRecordIds((current) => {
        const next = new Set(current);
        removedIds.forEach((recordId) => next.delete(recordId));
        return next;
      });
    }

    const failedCount = selectedIds.length - removedIds.length;
    if (failedCount > 0) {
      Toast.error(`${failedCount} registro(s) não puderam ser excluído(s).`);
      return;
    }

    Toast.success("Registros selecionados excluídos com sucesso.");
  };

  const handleStatusChange = async (record: MarketModuleRecord, nextStatus: string) => {
    try {
      await onUpdate(record.id, { ...toPayload(record), status: nextStatus });
      Toast.success(`Status alterado para ${nextStatus}.`);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Não foi possível alterar o status.");
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
      Toast.success("Dados atualizados.");
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Não foi possível atualizar os dados.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <PageLayout size="wide" className="space-y-4 py-4 md:space-y-6 md:py-6 lg:py-8">
      <PageHeader
        title={config.title}
        description={config.description}
        action={
          <button type="button" onClick={openCreateForm} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} />
            {config.primaryAction}
          </button>
        }
      />

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {config.kpis.map((kpi) => (
            <article key={kpi.label} className="card rounded-2xl p-4">
              <div
                className={`mb-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass[kpi.tone]}`}
              >
                {kpi.label}
              </div>
              <p className="text-2xl font-bold text-text-primary">{kpi.value}</p>
              <p className="mt-1 text-xs text-text-secondary">{kpi.hint}</p>
            </article>
          ))}
        </div>

        <aside className="card rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                {config.statusLabel}
              </p>
              <p className="mt-1 text-lg font-bold text-text-primary">{config.statusValue}</p>
              <p className="mt-1 text-xs text-text-secondary">
                Dados operacionais atualizados para acompanhamento do módulo.
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)]">
        <div className="card overflow-hidden rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-primary p-4">
            <div>
              <h2 className="text-base font-semibold text-text-primary">{config.recordsTitle}</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Registros operacionais disponíveis para consulta e ação.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 rounded-xl border border-border-secondary px-3 py-2 text-sm font-semibold text-text-secondary">
                <input
                  type="checkbox"
                  checked={allRecordsSelected}
                  onChange={toggleAllRecordsSelection}
                  className="h-4 w-4 rounded border-border-secondary accent-accent"
                />
                Selecionar todos
              </label>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-border-secondary px-3 py-2 text-sm font-semibold text-text-secondary transition hover:bg-hover-light"
              >
                <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Atualizando" : "Atualizar"}
              </button>
            </div>
          </div>

          {selectedRecordIds.size > 0 ? (
            <div className="flex flex-col gap-2 border-b border-border-primary bg-primary/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-text-primary">
                {selectedRecordIds.size} registro(s) selecionado(s)
              </p>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="btn-cancel inline-flex items-center justify-center gap-2"
              >
                <Trash2 size={15} />
                Excluir selecionados
              </button>
            </div>
          ) : null}

          <div className="divide-y divide-border-primary">
            {config.records.length === 0 ? (
              <div className="p-6 text-center text-sm text-text-secondary">
                Nenhum registro encontrado para este módulo.
              </div>
            ) : (
              config.records.map((record) => (
                <article
                  key={record.id}
                  className="grid gap-3 p-4 md:grid-cols-[36px_minmax(0,1fr)_150px_120px_42px]"
                >
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={selectedRecordIds.has(record.id)}
                      onChange={() => toggleRecordSelection(record.id)}
                      aria-label={`Selecionar ${record.title}`}
                      className="h-4 w-4 rounded border-border-secondary accent-accent"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary">{record.title}</p>
                    <p className="mt-1 text-sm text-text-secondary">{record.description}</p>
                    <p className="mt-2 text-xs font-medium text-text-tertiary">{record.meta}</p>
                  </div>
                  <SearchableSelectField
                    value={record.status}
                    options={statusOptions}
                    onChange={(nextValue) => void handleStatusChange(record, nextValue)}
                    getOptionValue={(option) => option.value}
                    getOptionLabel={(option) => option.label}
                    placeholder="Status"
                    emptyMessage="Status não encontrado."
                    className="w-fit min-w-[150px]"
                    inputClassName={`h-9 rounded-full border px-3 text-xs font-semibold ${getStatusClass(record.status)}`}
                  />
                  <p className="text-sm font-bold text-text-primary md:text-right">
                    {record.amount || "-"}
                  </p>
                  <div className="md:justify-self-end">
                    <RowActionsMenu
                      items={[
                        {
                          key: "edit",
                          label: "Editar",
                          icon: <Pencil size={13} />,
                          onClick: () => openEditForm(record),
                        },
                        {
                          key: "delete",
                          label: "Excluir",
                          icon: <Trash2 size={13} />,
                          danger: true,
                          onClick: () => void handleDelete(record),
                        },
                      ]}
                    />
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <section className="card rounded-2xl p-4">
            <h2 className="text-base font-semibold text-text-primary">{config.workflowTitle}</h2>
            <div className="mt-4 space-y-3">
              {config.workflow.map((step, index) => (
                <div key={step} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-xs font-bold text-secondary">
                    {index + 1}
                  </span>
                  <p className="text-sm text-text-secondary">{step}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="card rounded-2xl p-4">
            <h2 className="text-base font-semibold text-text-primary">Alertas operacionais</h2>
            <div className="mt-4 space-y-3">
              {config.alerts.map((alert) => (
                <div
                  key={alert}
                  className="flex gap-3 rounded-xl border border-border-primary bg-bg-primary/60 p-3"
                >
                  <CircleAlert size={17} className="mt-0.5 shrink-0 text-accent" />
                  <p className="text-sm text-text-secondary">{alert}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-dashed border-border-secondary bg-bg-light/70 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Clock3 size={16} className="text-secondary" />
              Rotina operacional
            </div>
            <p className="mt-2 text-sm text-text-secondary">
              Fluxo ativo para acompanhamento e execução das atividades do módulo.
            </p>
          </section>
        </div>
      </section>
      {formOpen && (
        <div className="fixed inset-0 z-layer-modal flex items-center justify-center bg-black/50 px-3 backdrop-blur-sm">
          <form
            onSubmit={submitForm}
            className="w-full max-w-2xl rounded-2xl border border-border-primary bg-bg-light shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border-primary px-4 py-3">
              <div>
                <h2 className="text-base font-semibold text-text-primary">{formTitle}</h2>
                <p className="text-sm text-text-secondary">{config.title}</p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-hover-light"
                aria-label="Fechar formulário"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold text-text-primary">Título</span>
                <input
                  value={form.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  className="input-field w-full"
                  placeholder="Informe o título do registro"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold text-text-primary">Descrição</span>
                <textarea
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  className="input-field min-h-24 w-full resize-y"
                  placeholder="Detalhe a operação"
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-semibold text-text-primary">Status</span>
                <SearchableSelectField
                  value={form.status}
                  options={statusOptions}
                  onChange={(nextValue) => updateField("status", nextValue)}
                  getOptionValue={(option) => option.value}
                  getOptionLabel={(option) => option.label}
                  placeholder="Selecione o status"
                  inputClassName={`font-semibold ${getStatusClass(form.status)}`}
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-semibold text-text-primary">Valor</span>
                <input
                  value={form.amount}
                  inputMode="numeric"
                  pattern="[0-9,.]*"
                  onBeforeInput={preventNonDigitBeforeInput}
                  onPaste={pasteAmount}
                  onChange={(event) => updateAmount(event.target.value)}
                  className="input-field w-full"
                  placeholder="R$ 0,00"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold text-text-primary">Informação adicional</span>
                <input
                  value={form.meta}
                  onChange={(event) => updateField("meta", event.target.value)}
                  className="input-field w-full"
                  placeholder="Responsável, prioridade, canal ou observação"
                />
              </label>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border-primary px-4 py-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-border-secondary px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-hover-light"
              >
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="btn-primary px-4 py-2">
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}
      {statusDialog.Dialog}
    </PageLayout>
  );
}
