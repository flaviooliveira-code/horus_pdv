/**
 * Arquivo: src/pages/Admin/PaymentsPage.tsx
 * Objetivo: gerencia os gateways de pagamento (Asaas, Mercado Pago e PagBank) e as cobranças PIX/boleto emitidas por eles.
 * Entradas esperadas: não recebe props; integra APIs de gateways e cobranças, drawers de cadastro e diálogos de confirmação.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleAlert, FileText, Landmark, Plus, QrCode, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import PageHeader from "@/components/Admin/PageHeader";
import {
  ChargeFormDrawer,
  ChargesSection,
  DEFAULT_FORM,
  GatewayCard,
  GatewayFormDrawer,
  PIX_ONLY_PROVIDERS,
  needsAttention,
  toFormState,
  toPayload,
  upsertGateway,
  type GatewayFormState,
} from "@/components/Admin/PaymentsPage";
import Skeleton from "@/components/Loading/Skeleton";
import { Toast, useStatusDialog } from "@/hooks/Dialog";
import PageLayout from "@/layout/PageLayout";
import {
  paymentChargeService,
  type CreatePaymentChargePayload,
  type PaymentChargeDto,
} from "@/services/api/paymentChargeService";
import { customerService, type CustomerDto } from "@/services/api/customerService";
import {
  paymentGatewayService,
  type PaymentGatewayDto,
} from "@/services/api/paymentGatewayService";

type PaymentsTab = "gateways" | "cobrancas";

export default function PaymentsPage() {
  const statusDialog = useStatusDialog();
  const [gateways, setGateways] = useState<PaymentGatewayDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GatewayFormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [tab, setTab] = useState<PaymentsTab>("gateways");
  const [charges, setCharges] = useState<PaymentChargeDto[]>([]);
  const [chargesLoading, setChargesLoading] = useState(false);
  const [chargesLoaded, setChargesLoaded] = useState(false);
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [chargeDrawerOpen, setChargeDrawerOpen] = useState(false);
  const [creatingCharge, setCreatingCharge] = useState(false);
  const [syncingChargeId, setSyncingChargeId] = useState<string | null>(null);
  const [cancellingChargeId, setCancellingChargeId] = useState<string | null>(null);

  const editingGateway = useMemo(
    () => gateways.find((gateway) => gateway.id === editingId),
    [gateways, editingId],
  );
  const activeCount = gateways.filter((gateway) => gateway.active).length;
  const productionCount = gateways.filter(
    (gateway) => gateway.active && gateway.environment === "PRODUCTION",
  ).length;
  const attentionCount = gateways.filter(needsAttention).length;
  const defaultPix = gateways.find((gateway) => gateway.defaultPix);
  const defaultBoleto = gateways.find((gateway) => gateway.defaultBoleto);

  // O estado inicial já é "carregando"; o recarregar manual liga o indicador antes de buscar.
  const loadGateways = useCallback(
    () =>
      paymentGatewayService
        .list()
        .then(setGateways)
        .catch((error: unknown) => {
          Toast.error(
            error instanceof Error ? error.message : "Não foi possível carregar os gateways.",
          );
        })
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    void loadGateways();
  }, [loadGateways]);

  const refreshGateways = () => {
    setLoading(true);
    void loadGateways();
  };

  const loadCharges = () => {
    setChargesLoading(true);
    paymentChargeService
      .list()
      .then((rows) => {
        setCharges(rows);
        setChargesLoaded(true);
      })
      .catch((error: unknown) => {
        Toast.error(error instanceof Error ? error.message : "Não foi possível carregar as cobranças.");
      })
      .finally(() => setChargesLoading(false));
  };

  const selectTab = (next: PaymentsTab) => {
    setTab(next);
    if (next === "cobrancas" && !chargesLoaded && !chargesLoading) loadCharges();
  };

  const replaceCharge = (next: PaymentChargeDto) =>
    setCharges((current) => {
      const exists = current.some((charge) => charge.id === next.id);
      return exists
        ? current.map((charge) => (charge.id === next.id ? next : charge))
        : [next, ...current];
    });

  const openChargeDrawer = () => {
    setChargeDrawerOpen(true);
    if (!customers.length) {
      customerService
        .list()
        .then((rows) => setCustomers(rows ?? []))
        .catch(() => Toast.error("Não foi possível carregar os clientes."));
    }
  };

  const createCharge = async (payload: CreatePaymentChargePayload) => {
    setCreatingCharge(true);
    try {
      const result = await paymentChargeService.create(payload);
      replaceCharge(result.charge);
      Toast.success(result.message);
      setChargeDrawerOpen(false);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Não foi possível emitir a cobrança.");
      loadCharges();
    } finally {
      setCreatingCharge(false);
    }
  };

  const syncCharge = async (charge: PaymentChargeDto) => {
    setSyncingChargeId(charge.id);
    try {
      const updated = await paymentChargeService.get(charge.id);
      replaceCharge(updated);
      Toast.info(updated.status === "PAID" ? "Pagamento confirmado." : "Status atualizado.");
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Não foi possível consultar a cobrança.");
    } finally {
      setSyncingChargeId(null);
    }
  };

  const cancelCharge = async (charge: PaymentChargeDto) => {
    const confirmed = await statusDialog.confirm(
      `Cancelar a cobrança de ${(charge.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} para ${charge.payerName}?`,
      { confirmLabel: "Cancelar cobrança", cancelLabel: "Manter" },
    );
    if (!confirmed) return;

    setCancellingChargeId(charge.id);
    try {
      const result = await paymentChargeService.cancel(charge.id);
      replaceCharge(result.charge);
      Toast.success(result.message);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Não foi possível cancelar a cobrança.");
    } finally {
      setCancellingChargeId(null);
    }
  };

  const updateField = <K extends keyof GatewayFormState>(key: K, value: GatewayFormState[K]) => {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === "provider" && !PIX_ONLY_PROVIDERS.includes(next.provider)) {
        next.pixOnly = false;
      }

      if (key === "pixOnly" && value === true) {
        next.defaultPix = true;
        next.defaultBoleto = false;
        next.generateBoletoPix = true;
      }

      return next;
    });
  };

  const openCreateDrawer = () => {
    setEditingId(null);
    setForm({ ...DEFAULT_FORM, defaultPix: !defaultPix });
    setDrawerOpen(true);
  };

  const openEditDrawer = (gateway: PaymentGatewayDto) => {
    setEditingId(gateway.id);
    setForm(toFormState(gateway));
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (saving) return;
    setDrawerOpen(false);
    setEditingId(null);
    setForm(DEFAULT_FORM);
  };

  const saveGateway = async () => {
    setSaving(true);
    try {
      const payload = toPayload(form);
      const saved = editingId
        ? await paymentGatewayService.update(editingId, payload)
        : await paymentGatewayService.create(payload);
      setGateways((current) => upsertGateway(current, saved));
      Toast.success(editingId ? "Gateway atualizado." : "Gateway conectado. Clique em Validar para testar.");
      setDrawerOpen(false);
      setEditingId(null);
      setForm(DEFAULT_FORM);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Não foi possível salvar o gateway.");
    } finally {
      setSaving(false);
    }
  };

  const validateGateway = async (gateway: PaymentGatewayDto) => {
    setValidatingId(gateway.id);
    try {
      const result = await paymentGatewayService.validate(gateway.id);
      setGateways((current) => upsertGateway(current, result.gateway));
      if (result.gateway.status === "OK") {
        Toast.success(result.message);
      } else {
        Toast.error(result.message);
      }
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Não foi possível validar o gateway.");
    } finally {
      setValidatingId(null);
    }
  };

  const removeGateway = async (gateway: PaymentGatewayDto) => {
    const confirmed = await statusDialog.confirm(
      `Remover ${gateway.name}? As credenciais salvas serão apagadas.`,
      { confirmLabel: "Remover" },
    );
    if (!confirmed) return;

    setRemovingId(gateway.id);
    try {
      await paymentGatewayService.remove(gateway.id);
      setGateways((current) => current.filter((item) => item.id !== gateway.id));
      Toast.success("Gateway removido.");
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Não foi possível remover o gateway.");
    } finally {
      setRemovingId(null);
    }
  };

  const sameProviderAsSaved = editingGateway?.provider === form.provider;

  return (
    <PageLayout className="space-y-4 py-4 md:py-6 lg:py-8" size="wide">
      <PageHeader
        title="Pagamentos Integrados"
        description="Conecte Asaas, Mercado Pago ou PagBank para receber por PIX e boleto."
        action={
          <div className="grid w-[calc(100vw-1.5rem)] max-w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
            <button
              type="button"
              onClick={tab === "gateways" ? refreshGateways : loadCharges}
              disabled={tab === "gateways" ? loading : chargesLoading}
              className="btn-outline-secondary inline-flex items-center justify-center gap-2"
            >
              <RefreshCw
                size={16}
                className={(tab === "gateways" ? loading : chargesLoading) ? "animate-spin" : ""}
              />
              Atualizar
            </button>
            <button
              type="button"
              onClick={tab === "gateways" ? openCreateDrawer : openChargeDrawer}
              className="btn-primary inline-flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              {tab === "gateways" ? "Novo gateway" : "Nova cobrança"}
            </button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard
          icon={<Wallet size={20} />}
          label="Gateways"
          value={String(gateways.length)}
          hint={`${activeCount} ${activeCount === 1 ? "ativo" : "ativos"}`}
        />
        <SummaryCard
          icon={<ShieldCheck size={20} />}
          label="Em produção"
          value={String(productionCount)}
          hint={`${Math.max(gateways.length - productionCount, 0)} em sandbox ou inativos`}
        />
        <SummaryCard
          icon={<QrCode size={20} />}
          label="Padrões"
          value={`${Number(Boolean(defaultPix)) + Number(Boolean(defaultBoleto))}/2`}
          hint={`PIX: ${defaultPix?.name ?? "-"} · Boleto: ${defaultBoleto?.name ?? "-"}`}
        />
        <SummaryCard
          icon={<CircleAlert size={20} />}
          label="Atenção"
          value={String(attentionCount)}
          hint={attentionCount ? "Validar ou ativar" : "Tudo operacional"}
          tone={attentionCount ? "danger" : "success"}
        />
      </section>

      <section className="card overflow-hidden rounded-2xl">
        <div
          role="tablist"
          aria-label="Seções de pagamentos"
          className="flex gap-1 border-b border-border-primary px-2 pt-2 sm:px-3"
        >
          <TabButton
            selected={tab === "gateways"}
            icon={<Landmark size={16} />}
            label="Gateways"
            onClick={() => selectTab("gateways")}
          />
          <TabButton
            selected={tab === "cobrancas"}
            icon={<FileText size={16} />}
            label="Cobranças"
            onClick={() => selectTab("cobrancas")}
          />
        </div>

        {tab === "cobrancas" ? (
          <ChargesSection
            charges={charges}
            loading={chargesLoading}
            syncingId={syncingChargeId}
            cancellingId={cancellingChargeId}
            onCreate={openChargeDrawer}
            onSync={(charge) => void syncCharge(charge)}
            onCancel={(charge) => void cancelCharge(charge)}
          />
        ) : loading && !gateways.length ? (
          <div className="space-y-3 p-5" aria-busy="true">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-40" />
            ))}
          </div>
        ) : gateways.length ? (
          <div className="divide-y divide-border-primary">
            {gateways.map((gateway) => (
              <GatewayCard
                key={gateway.id}
                gateway={gateway}
                validating={validatingId === gateway.id}
                removing={removingId === gateway.id}
                onValidate={() => void validateGateway(gateway)}
                onEdit={() => openEditDrawer(gateway)}
                onRemove={() => void removeGateway(gateway)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center px-5 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
              <Wallet size={22} />
            </span>
            <h3 className="mt-3 font-semibold text-text-primary">Nenhum gateway configurado</h3>
            <p className="mt-1 max-w-md text-sm text-text-secondary">
              Conecte Asaas, Mercado Pago ou PagBank para liberar cobranças por PIX e boleto.
            </p>
            <button
              type="button"
              onClick={openCreateDrawer}
              className="btn-primary mt-5 inline-flex items-center gap-2"
            >
              <Plus size={16} />
              Adicionar gateway
            </button>
          </div>
        )}
      </section>

      <GatewayFormDrawer
        open={drawerOpen}
        isEditMode={Boolean(editingId)}
        form={form}
        savedAccessTokenMask={sameProviderAsSaved ? editingGateway?.accessTokenMask ?? "" : ""}
        savedWebhookSecretMask={sameProviderAsSaved ? editingGateway?.webhookSecretMask ?? "" : ""}
        isSaving={saving}
        onChange={updateField}
        onClose={closeDrawer}
        onSave={() => void saveGateway()}
      />
      <ChargeFormDrawer
        key={chargeDrawerOpen ? "open" : "closed"}
        open={chargeDrawerOpen}
        customers={customers}
        isSaving={creatingCharge}
        onClose={() => !creatingCharge && setChargeDrawerOpen(false)}
        onSave={(payload) => void createCharge(payload)}
      />
      {statusDialog.Dialog}
    </PageLayout>
  );
}

function TabButton({
  selected,
  icon,
  label,
  onClick,
}: {
  selected: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition ${
        selected
          ? "border-secondary text-secondary"
          : "border-transparent text-text-secondary hover:text-text-primary"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
  tone = "brand",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: "brand" | "success" | "danger";
}) {
  const toneClass = {
    brand: "bg-secondary/10 text-secondary",
    success: "bg-success/10 text-success",
    danger: "bg-primary/10 text-primary",
  }[tone];

  return (
    <div className="card rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-text-primary">{value}</p>
          <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{hint}</p>
        </div>
        <span
          className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex ${toneClass}`}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}
