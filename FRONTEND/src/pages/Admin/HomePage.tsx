/**
 * Arquivo: src/pages/Admin/HomePage.tsx
 * Objetivo: apresenta visão resumida da operação com KPIs e atalhos rápidos para as telas principais.
 * Entradas esperadas: recebe callbacks opcionais para navegação interna e abertura da frente de caixa em nova aba.
 */

import {
  ArrowRight,
  BadgeDollarSign,
  CreditCard,
  FileText,
  History,
  Landmark,
  PackageCheck,
  Receipt,
  Repeat2,
  ShoppingCart,
  Store,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { PageKey } from "@/components/AppSidebar/AppSidebar";
import PageHeader from "@/components/Admin/PageHeader";
import KpiTrendCard from "@/components/Admin/KpiTrendCard";
import PageLayout from "@/layout/PageLayout";
import { homeService, type HomeKpiDto } from "@/services/api/homeService";

// Atalhos principais para reduzir cliques no fluxo operacional do dia a dia.
const shortcuts = [
  {
    title: "Cadastro de Cliente",
    description: "Cadastrar novo cliente",
    icon: UserRoundPlus,
    page: "cadastro-cliente" as PageKey,
  },
  {
    title: "Histórico de Vendas",
    description: "Consultar vendas finalizadas",
    icon: History,
    page: "historico-vendas" as PageKey,
  },
  {
    title: "Relatórios",
    description: "Analisar indicadores de operação",
    icon: FileText,
    page: "relatorios" as PageKey,
  },
  {
    title: "Iniciar Vendas",
    description: "Abrir frente de caixa",
    icon: ShoppingCart,
    page: "vendas" as PageKey,
  },
];

const marketShortcuts = [
  {
    title: "Fiscal NFC-e / NF-e",
    description: "Emissão, XML, DANFE e contingência",
    icon: Receipt,
    page: "fiscal" as PageKey,
  },
  {
    title: "Pagamentos Integrados",
    description: "TEF, Pix, link e conciliação",
    icon: CreditCard,
    page: "pagamentos" as PageKey,
  },
  {
    title: "Estoque e Inventário",
    description: "Movimentação, lote, validade e ruptura",
    icon: PackageCheck,
    page: "estoque" as PageKey,
  },
  {
    title: "Caixa",
    description: "Abertura, sangria e fechamento",
    icon: Landmark,
    page: "caixa" as PageKey,
  },
  {
    title: "Compras e Reposição",
    description: "Pedidos, recebimento e custo médio",
    icon: BadgeDollarSign,
    page: "compras" as PageKey,
  },
  {
    title: "Trocas e Devoluções",
    description: "Estorno, crédito e autorização",
    icon: Repeat2,
    page: "devolucoes" as PageKey,
  },
  {
    title: "CRM e Fidelidade",
    description: "Pontos, cashback e campanhas",
    icon: UsersRound,
    page: "crm-fidelidade" as PageKey,
  },
  {
    title: "Omnichannel",
    description: "Loja online, marketplace e delivery",
    icon: Store,
    page: "omnichannel" as PageKey,
  },
];

type HomePageProps = {
  onNavigate?: (page: PageKey) => void;
  onOpenSalesInNewTab?: () => void;
};

export default function HomePage({ onNavigate, onOpenSalesInNewTab }: HomePageProps) {
  const [cards, setCards] = useState<HomeKpiDto[]>([]);

  useEffect(() => {
    homeService.get().then((data) => setCards(data?.cards ?? [])).catch(() => setCards([]));
  }, []);

  return (
    <PageLayout className="space-y-4 py-4 md:space-y-6 md:py-6 lg:py-8">
      <PageHeader
        title="Home"
        description="Visão geral da operação do Hórus PDV em tempo real."
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map((card) => (
          <KpiTrendCard
            key={card.label}
            label={card.label}
            value={card.value}
            hint={card.helper}
            color={card.color}
            trend={card.trend}
          />
        ))}
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="text-base font-semibold text-text-primary">Ações rápidas</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Acesse os fluxos mais usados da operação com um clique.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {shortcuts.map((shortcut) => {
            const Icon = shortcut.icon;
            return (
              <button
                key={shortcut.title}
                type="button"
                onClick={() => {
                  // "Iniciar Vendas" precisa seguir fluxo especial de abertura em aba dedicada.
                  if (shortcut.page === "vendas") {
                    onOpenSalesInNewTab?.();
                    return;
                  }
                  // Demais atalhos usam navegação padrão de página.
                  onNavigate?.(shortcut.page);
                }}
                className="group flex h-full min-h-[132px] flex-col rounded-xl border border-border-primary bg-bg-primary p-4 text-left transition hover:-translate-y-0.5 hover:border-secondary/40 hover:bg-accent/10 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                    <Icon size={18} />
                  </span>
                  <ArrowRight
                    size={16}
                    className="text-text-tertiary transition group-hover:translate-x-0.5 group-hover:text-secondary"
                  />
                </div>

                <p className="mt-3 text-sm font-semibold text-text-primary group-hover:text-secondary">
                  {shortcut.title}
                </p>
                <p className="mt-1 text-xs text-text-secondary">{shortcut.description}</p>

                <span className="mt-auto pt-3 text-xs font-semibold text-secondary">
                  Abrir atalho
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="text-base font-semibold text-text-primary">Gestão avançada</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Acesse os módulos operacionais para acompanhar rotinas do PDV.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {marketShortcuts.map((shortcut) => {
            const Icon = shortcut.icon;
            return (
              <button
                key={shortcut.title}
                type="button"
                onClick={() => onNavigate?.(shortcut.page)}
                className="group flex min-h-[118px] flex-col rounded-xl border border-border-primary bg-bg-primary p-4 text-left transition hover:-translate-y-0.5 hover:border-secondary/40 hover:bg-accent/10 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                    <Icon size={18} />
                  </span>
                  <ArrowRight
                    size={16}
                    className="text-text-tertiary transition group-hover:translate-x-0.5 group-hover:text-secondary"
                  />
                </div>

                <p className="mt-3 text-sm font-semibold text-text-primary group-hover:text-secondary">
                  {shortcut.title}
                </p>
                <p className="mt-1 text-xs text-text-secondary">{shortcut.description}</p>
              </button>
            );
          })}
        </div>
      </section>
    </PageLayout>
  );
}
