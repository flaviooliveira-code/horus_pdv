import { Clock3, Construction, ShieldAlert } from "lucide-react";
import PageHeader from "@/components/Admin/PageHeader";
import PageLayout from "@/layout/PageLayout";

type UnderDevelopmentPageProps = {
  title: string;
  description: string;
  checkpoints: string[];
};

export default function UnderDevelopmentPage({
  title,
  description,
  checkpoints,
}: UnderDevelopmentPageProps) {
  return (
    <PageLayout size="wide" className="space-y-4 py-4 md:space-y-6 md:py-6 lg:py-8">
      <PageHeader
        title={title}
        description={description}
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent">
            <Construction size={16} />
            Em desenvolvimento
          </span>
        }
      />

      <section className="card overflow-hidden rounded-2xl border-dashed border-accent/35">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="bg-bg-secondary p-6 md:p-8">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12 text-accent">
              <ShieldAlert size={28} />
            </div>
            <h2 className="mt-5 text-2xl font-bold text-text-primary line-through decoration-accent/70 decoration-2">
              Módulo operacional
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-text-secondary">
              Esta área está bloqueada para uso operacional enquanto as integrações,
              regras de negócio e homologações finais são concluídas.
            </p>
          </div>

          <div className="p-6 md:p-8">
            <div className="flex items-start gap-3 rounded-2xl border border-accent/25 bg-accent/8 p-4">
              <Clock3 size={20} className="mt-0.5 shrink-0 text-accent" />
              <div>
                <p className="font-semibold text-text-primary">
                  Disponibilização controlada
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  Os atalhos permanecem visíveis no menu, mas a operação será liberada
                  somente após validação técnica.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {checkpoints.map((checkpoint) => (
                <div
                  key={checkpoint}
                  className="flex items-center gap-3 rounded-xl border border-border-primary bg-bg-primary/60 px-4 py-3 text-sm text-text-secondary"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                  {checkpoint}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
