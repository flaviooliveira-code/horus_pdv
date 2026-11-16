/**
 * Arquivo: src/pages/Admin/CustomerDisplayPage.tsx
 * Objetivo: segunda tela voltada ao cliente (?pdv-display=1) sincronizada em tempo real com a frente de caixa.
 * Entradas esperadas: mensagens BroadcastChannel e snapshot localStorage de customerDisplayChannel.
 */
import { Eye, Image as ImageIcon, Maximize2, Minimize2, Monitor } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  formatQuantity,
  formatTotalVolumes,
  HighVisibilityWrapper,
} from "@/components/Admin/SalesStartPage";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";
import {
  type CustomerDisplayState,
  readCustomerDisplayState,
  requestCustomerDisplaySync,
  subscribeCustomerDisplay,
} from "@/utils/customerDisplayChannel";

function formatDisplayClock(date: Date) {
  return {
    dateLabel: date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    timeLabel: date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  };
}

export default function CustomerDisplayPage() {
  const { formatMoneyBr } = useInputMasks();
  const [displayState, setDisplayState] = useState<CustomerDisplayState | null>(() =>
    readCustomerDisplayState(),
  );
  const [localHighVisibility, setLocalHighVisibility] = useState<boolean | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const activeRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeCustomerDisplay({
      onState: (nextState) => {
        setDisplayState(nextState);
      },
    });
    requestCustomerDisplaySync();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!displayState?.themeMode) return;
    document.documentElement.setAttribute("data-theme", displayState.themeMode);
  }, [displayState?.themeMode]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [displayState?.lastScannedItem?.id, displayState?.items.length]);

  const highVisibility = localHighVisibility ?? displayState?.highVisibility ?? true;
  const items = displayState?.items ?? [];
  const lastItem = displayState?.lastScannedItem ?? (items.length > 0 ? items[items.length - 1] : null);
  const subtotal = displayState?.subtotal ?? 0;
  const totalVolumes = displayState?.totalVolumes ?? 0;
  const status = displayState?.status ?? "idle";
  const lastSale = displayState?.lastSale ?? null;
  const companyName = displayState?.companyName || "Hórus PDV";
  const { dateLabel, timeLabel } = formatDisplayClock(now);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Navegador/ambiente headless pode bloquear Fullscreen API sem gesto direto.
    }
  };

  const statusBadgeText =
    status === "active"
      ? "Atendimento em andamento"
      : status === "completed"
        ? "Venda finalizada"
        : status === "cancelled"
          ? "Venda cancelada"
          : "Caixa livre";

  return (
    <HighVisibilityWrapper enabled={highVisibility} className="min-h-screen">
      <div className="flex min-h-[100dvh] flex-col bg-bg-primary text-text-primary">
        <header className="border-b border-border-secondary bg-accent px-5 py-3.5 text-text-light">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                <Monitor size={24} />
              </span>
              <div>
                <h1 className="pdv-header-title font-display text-2xl font-extrabold leading-tight md:text-3xl">
                  {companyName}
                </h1>
                <p className="pdv-header-subtitle text-sm font-semibold text-text-light/80 md:text-base">
                  Visor do Cliente
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`rounded-full border px-3.5 py-1.5 text-sm font-bold ${
                  status === "completed"
                    ? "bg-success/10 text-success"
                    : status === "cancelled"
                      ? "bg-primary/10 text-primary"
                      : "border-white/30 bg-white/15 text-text-light"
                }`}
              >
                {statusBadgeText}
              </span>

              <button
                type="button"
                onClick={() => setLocalHighVisibility(!highVisibility)}
                aria-pressed={highVisibility}
                className="pdv-toggle-pill inline-flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/15 px-3 py-1.5 text-sm font-bold text-text-light transition hover:bg-white/25"
              >
                <Eye size={16} />
                {highVisibility ? "Alta Visibilidade: ON" : "Alta Visibilidade: OFF"}
              </button>

              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className="pdv-toggle-pill inline-flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/15 px-3 py-1.5 text-sm font-bold text-text-light transition hover:bg-white/25"
                aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                {isFullscreen ? "Reduzir" : "Tela cheia"}
              </button>

              <div className="ml-2 text-right pdv-tabular">
                <p className="text-xs capitalize text-text-light/80">{dateLabel}</p>
                <p className="pdv-header-clock text-lg font-bold">{timeLabel}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 p-4 md:p-6">
          {status === "completed" && lastSale ? (
            <div
              role="status"
              className="rounded-2xl border-2 border-success bg-success/10 px-5 py-4 text-success shadow-sm"
            >
              <p className="font-display text-2xl font-extrabold md:text-3xl">
                Obrigado pela preferência! Venda #{lastSale.saleNumber} concluída
              </p>
              <p className="pdv-tabular mt-1 text-lg font-bold md:text-2xl">
                Total: R$ {formatMoneyBr(lastSale.total)} • Forma: {lastSale.paymentLabel}
                {lastSale.change > 0 ? ` • Troco: R$ ${formatMoneyBr(lastSale.change)}` : ""}
              </p>
            </div>
          ) : null}

          <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <section className="flex flex-col justify-between rounded-2xl border-2 border-border-primary bg-bg-light p-5 shadow-sm">
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="pdv-field-label text-sm font-bold uppercase tracking-wider text-text-secondary">
                    Último Produto Bipado
                  </span>
                  {lastItem?.code ? (
                    <span className="rounded-lg border border-border-secondary bg-bg-gray-theme px-2.5 py-1 font-mono text-sm font-bold text-text-primary pdv-tabular">
                      Cód. {lastItem.code}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                  <div className="flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-border-secondary bg-bg-primary text-text-tertiary md:h-48 md:w-48">
                    {lastItem?.imageUrl ? (
                      <img
                        src={lastItem.imageUrl}
                        alt={lastItem.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-center">
                        <ImageIcon size={40} />
                        <span className="text-xs font-semibold">Sem imagem</span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <h2 className="pdv-last-scanned-name break-words font-display text-3xl font-extrabold leading-tight text-text-primary md:text-5xl">
                      {lastItem ? lastItem.name : "CAIXA LIVRE"}
                    </h2>

                    {lastItem ? (
                      <div className="mt-4 space-y-2">
                        <p className="pdv-last-scanned-math pdv-tabular text-xl font-bold text-accent md:text-3xl">
                          {formatQuantity(lastItem.quantity)} x R${" "}
                          {formatMoneyBr(lastItem.unitPrice)}
                        </p>
                        <p className="pdv-tabular font-display text-3xl font-extrabold text-success md:text-4xl">
                          = R$ {formatMoneyBr(lastItem.total)}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-lg font-medium text-text-secondary md:text-xl">
                        Aguardando o próximo produto no balcão.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-border-primary bg-bg-gray-theme px-4 py-3 text-sm font-semibold text-text-secondary md:text-base">
                Operador: <span className="text-text-primary">{displayState?.operatorName || "Caixa 01"}</span>
              </div>
            </section>

            <section className="flex min-h-[260px] flex-col overflow-hidden rounded-2xl border-2 border-border-primary bg-bg-light shadow-sm">
              <div className="border-b border-border-primary bg-bg-gray-theme px-4 py-3">
                <h2 className="font-display text-lg font-extrabold uppercase tracking-wide text-text-primary md:text-xl">
                  Itens da Compra ({items.length})
                </h2>
              </div>

              <div className="flex-1 overflow-auto">
                {items.length === 0 ? (
                  <div className="flex h-full min-h-[180px] items-center justify-center p-6 text-center text-lg font-medium text-text-secondary md:text-xl">
                    Nenhum item registrado nesta compra.
                  </div>
                ) : (
                  <table className="pdv-table w-full text-lg md:text-xl">
                    <thead>
                      <tr className="border-b border-border-primary bg-bg-gray-theme text-xs uppercase text-text-secondary">
                        <th className="w-12 px-3 py-2.5 text-center">#</th>
                        <th className="px-3 py-2.5 text-left">Produto</th>
                        <th className="w-24 px-3 py-2.5 text-center">Qtd</th>
                        <th className="w-32 px-3 py-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => {
                        const isLast = lastItem?.id === item.id;
                        return (
                          <tr
                            key={item.id}
                            ref={isLast ? activeRowRef : undefined}
                            className={`border-b border-border-primary ${
                              isLast ? "bg-accent/10" : "bg-bg-light"
                            }`}
                          >
                            <td className="px-3 py-3 text-center font-semibold text-text-secondary pdv-tabular">
                              {index + 1}
                            </td>
                            <td className="px-3 py-3 font-bold text-text-primary">
                              {item.name}
                              <span className="block font-mono text-xs font-semibold text-text-secondary">
                                {item.code} • R$ {formatMoneyBr(item.unitPrice)}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center font-extrabold text-accent pdv-tabular">
                              {formatQuantity(item.quantity)}
                            </td>
                            <td className="px-3 py-3 text-right font-extrabold text-success pdv-tabular">
                              R$ {formatMoneyBr(item.total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        </main>

        <footer className="pdv-total-banner border-t-2 border-border-secondary bg-accent px-6 py-4 text-text-light">
          <div className="mx-auto flex max-w-[1600px] flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <p className="font-display text-xl font-extrabold uppercase tracking-wider md:text-2xl">
                TOTAL A PAGAR
              </p>
              <p className="pdv-tabular text-sm font-semibold text-text-light/80 md:text-base">
                {items.length} {items.length === 1 ? "item" : "itens"} •{" "}
                {formatTotalVolumes(totalVolumes)} vol.
              </p>
            </div>
            <p className="pdv-total-amount pdv-tabular font-display text-6xl font-extrabold leading-none md:text-7xl">
              R$ {formatMoneyBr(subtotal)}
            </p>
          </div>
        </footer>
      </div>
    </HighVisibilityWrapper>
  );
}
