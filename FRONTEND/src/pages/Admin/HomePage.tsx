/**
 * Arquivo: src/pages/Admin/HomePage.tsx
 * Objetivo: apresenta visão resumida da operação com KPIs e atalhos rápidos para as telas principais.
 * Entradas esperadas: recebe callbacks opcionais para navegação interna e abertura da frente de caixa em nova aba.
 */

import {
  AlertTriangle,
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
  Tag,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { PageKey } from "@/components/AppSidebar/AppSidebar";
import PageHeader from "@/components/Admin/PageHeader";
import KpiTrendCard from "@/components/Admin/KpiTrendCard";
import { Toast } from "@/hooks/Dialog";
import PageLayout from "@/layout/PageLayout";
import { homeService, type HomeExpiringProductDto, type HomeKpiDto } from "@/services/api/homeService";
import { productService } from "@/services/api/productService";
import { evaluateProductExpiration, formatIsoDateBr } from "@/utils/productExpiration";

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
  const [expiringProducts, setExpiringProducts] = useState<HomeExpiringProductDto[]>([]);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  useEffect(() => {
    homeService
      .get()
      .then((data) => {
        setCards(data?.cards ?? []);
        setExpiringProducts(data?.expiringProducts ?? []);
      })
      .catch(() => {
        setCards([]);
        setExpiringProducts([]);
      });
  }, []);

  const handleApplyCostPrice = async (item: HomeExpiringProductDto) => {
    try {
      setApplyingId(item.id);
      await productService.applyCostPrice(item.id);
      const refreshed = await homeService.get();
      setCards(refreshed?.cards ?? []);
      setExpiringProducts(refreshed?.expiringProducts ?? []);
      Toast.success(
        `Preço de "${item.productName}" ajustado para o custo (${item.unitCostFormatted}).`,
      );
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Erro ao aplicar preço de custo.");
    } finally {
      setApplyingId(null);
    }
  };

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

      {expiringProducts.length > 0 && (
        <section
          aria-label="Alertas de vencimento"
          className="card border border-amber-500/35 bg-amber-500/5 p-4 md:p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-text-primary md:text-base">
                  Produtos vencidos ou prestes a vencer ({expiringProducts.length})
                </h2>
                <p className="text-xs text-text-secondary">
                  Itens com estoque vencido ou com validade próxima (até 7 dias). Liquide a preço de
                  custo para evitar perda.
                </p>
              </div>
            </div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate("cadastro-produto")}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-default bg-bg-secondary px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:border-brand-accent/60 hover:text-brand-accent"
              >
                Gerenciar no cadastro
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-2.5 md:grid-cols-2">
            {expiringProducts.slice(0, 8).map((item) => {
              const evaluation = evaluateProductExpiration(item.expirationDate);
              const isExpired = item.expirationStatus === "EXPIRED" || evaluation.status === "EXPIRED";
              const formattedDate = formatIsoDateBr(item.expirationDate) || evaluation.formattedDate;
              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between gap-2.5 rounded-xl border border-border-default bg-bg-secondary/90 p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-text-primary">
                        {item.productName}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          isExpired
                            ? "bg-rose-500/15 text-rose-400"
                            : "bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {evaluation.label || (isExpired ? "Vencido" : "Prestes a vencer")}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary">
                      {item.productCode ? `Cód. ${item.productCode} • ` : ""}
                      Estoque: <strong className="text-text-primary">{item.quantity}</strong>{" "}
                      {item.unitType || "un"} • Validade:{" "}
                      <strong className="text-text-primary">{formattedDate || "-"}</strong>
                    </p>
                    <p className="text-xs text-text-secondary">
                      Custo: <strong className="text-text-primary">{item.unitCostFormatted}</strong>{" "}
                      • Venda atual:{" "}
                      <strong className="text-text-primary">{item.salePriceFormatted}</strong>
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {item.alreadyAtCostPrice ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-400">
                        <Tag className="h-3.5 w-3.5" />
                        Já a preço de custo
                      </span>
                    ) : item.canApplyCostPrice ? (
                      <button
                        type="button"
                        disabled={applyingId === item.id}
                        onClick={() => void handleApplyCostPrice(item)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-60"
                      >
                        <Tag className="h-3.5 w-3.5" />
                        {applyingId === item.id ? "Aplicando..." : "Vender a preço de custo"}
                      </button>
                    ) : (
                      <span className="rounded-lg bg-bg-primary px-2.5 py-1.5 text-xs text-text-secondary">
                        Sem custo cadastrado
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {expiringProducts.length > 8 && (
            <p className="mt-2.5 text-xs text-text-secondary">
              Exibindo 8 de {expiringProducts.length} produtos em alerta de validade. Acesse o
              cadastro de produtos ou relatórios para ver a lista completa.
            </p>
          )}
        </section>
      )}

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
