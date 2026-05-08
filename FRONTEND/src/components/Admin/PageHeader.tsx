/**
 * Arquivo: src/components/Admin/PageHeader.tsx
 * Objetivo: renderiza título, descrição e ação principal das páginas administrativas.
 * Entradas esperadas: título, descrição e opcional de ação no topo da tela.
 */
import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { openGuidedTour } from "@/domain/navigation/events";

type PageHeaderProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export default function PageHeader({
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <header data-tour="page-header" className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 max-w-full flex-1">
        <div className="flex items-center gap-3 lg:gap-4">
          <button
            type="button"
            onClick={openGuidedTour}
            className="hidden h-10 shrink-0 items-center gap-2 rounded-xl border border-secondary/35 bg-bg-light px-3.5 text-sm font-semibold text-secondary transition hover:bg-secondary/10 lg:inline-flex"
            aria-label="Abrir tour da tela"
            title="Tour da tela"
          >
            <CircleHelp size={16} />
            Tour da tela
          </button>
          <h1 className="min-w-0 break-words text-2xl font-bold text-text-primary">{title}</h1>
        </div>
        <p className="mt-1.5 max-w-4xl break-words text-sm text-text-secondary">
          {description}
        </p>
      </div>
      {action ? <div data-tour="page-header-action" className="max-w-full">{action}</div> : null}
    </header>
  );
}
