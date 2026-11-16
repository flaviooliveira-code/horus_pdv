/**
 * Arquivo: src/components/Admin/SalesStartPage/TotalBanner.tsx
 * Objetivo: banner de destaque absoluto para o TOTAL A PAGAR visível à distância de balcão.
 * Entradas esperadas: subtotal, total de volumes, quantidade de itens, formatador e flag alta visibilidade.
 */
import { formatTotalVolumes } from "./pdvTypes";

type TotalBannerProps = {
  subtotal: number;
  totalVolumes: number;
  itemCount: number;
  formatMoney: (value: number) => string;
  highVisibility: boolean;
};

export default function TotalBanner({
  subtotal,
  totalVolumes,
  itemCount,
  formatMoney,
  highVisibility,
}: TotalBannerProps) {
  return (
    <div
      className={`pdv-total-banner flex flex-col justify-between gap-2 border-t border-border-primary bg-accent px-4 py-3 text-text-light sm:flex-row sm:items-center ${
        highVisibility ? "py-4" : ""
      }`}
    >
      <div>
        <p
          className={`font-display font-extrabold uppercase tracking-wider ${
            highVisibility ? "text-xl md:text-2xl" : "text-sm md:text-base"
          }`}
        >
          TOTAL A PAGAR
        </p>
        <p className="pdv-tabular text-xs font-semibold text-text-light/80 md:text-sm">
          {itemCount} {itemCount === 1 ? "item" : "itens"} • {formatTotalVolumes(totalVolumes)} vol.
        </p>
      </div>

      <div
        className={`pdv-total-amount pdv-tabular text-right font-display font-extrabold leading-none tracking-tight ${
          highVisibility ? "text-6xl md:text-7xl" : "text-5xl md:text-6xl"
        }`}
      >
        R$ {formatMoney(subtotal)}
      </div>
    </div>
  );
}
