/**
 * Arquivo: src/components/Admin/MarketModulePage.tsx
 * Objetivo: renderizar módulos operacionais mockados para lacunas competitivas do PDV.
 * Entradas esperadas: configuração visual do módulo com KPIs, registros, fluxos e alertas.
 */
import { CheckCircle2, CircleAlert, Clock3, Plus, RefreshCw } from "lucide-react";
import PageHeader from "@/components/Admin/PageHeader";
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

const toneClass: Record<MarketModuleKpi["tone"], string> = {
  secondary: "bg-secondary/10 text-secondary border-secondary/20",
  success: "bg-success/10 text-success border-success/20",
  accent: "bg-accent/10 text-accent border-accent/20",
  primary: "bg-primary/10 text-primary border-primary/20",
};

export default function MarketModulePage({ config }: { config: MarketModuleConfig }) {
  return (
    <PageLayout size="wide" className="space-y-4 py-4 md:space-y-6 md:py-6 lg:py-8">
      <PageHeader
        title={config.title}
        description={config.description}
        action={
          <button type="button" className="btn-primary inline-flex items-center gap-2">
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
                Dados simulados para validar fluxo e layout antes da API.
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
                Registros mockados para simular operação do módulo.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-border-secondary px-3 py-2 text-sm font-semibold text-text-secondary transition hover:bg-hover-light"
            >
              <RefreshCw size={15} />
              Atualizar
            </button>
          </div>

          <div className="divide-y divide-border-primary">
            {config.records.map((record) => (
              <article
                key={record.id}
                className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_140px_120px]"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-text-primary">{record.title}</p>
                  <p className="mt-1 text-sm text-text-secondary">{record.description}</p>
                  <p className="mt-2 text-xs font-medium text-text-tertiary">{record.meta}</p>
                </div>
                <span className="inline-flex h-8 w-fit items-center rounded-full bg-accent/10 px-3 text-xs font-semibold text-accent">
                  {record.status}
                </span>
                <p className="text-sm font-bold text-text-primary md:text-right">
                  {record.amount ?? "-"}
                </p>
              </article>
            ))}
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
            <h2 className="text-base font-semibold text-text-primary">Alertas mockados</h2>
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
              Próximo passo técnico
            </div>
            <p className="mt-2 text-sm text-text-secondary">
              Conectar este fluxo a serviços reais mantendo os contratos visuais já validados.
            </p>
          </section>
        </div>
      </section>
    </PageLayout>
  );
}
