/**
 * Arquivo: src/components/Admin/SalesStartPage/CartItemsTable.tsx
 * Objetivo: exibe a listagem de itens da frente de caixa com tipografia legível em balcão (18px–20px) e cards mobile.
 * Entradas esperadas: carrinho, formatador de moeda, callback de remoção e flag alta visibilidade.
 */
import { Trash2 } from "lucide-react";
import { formatQuantity, type PdvCartItem } from "./pdvTypes";

type CartItemsTableProps = {
  cart: PdvCartItem[];
  lastScannedItemId?: string | null;
  formatMoney: (value: number) => string;
  onRemoveItem: (id: string) => void;
  highVisibility: boolean;
};

export default function CartItemsTable({
  cart,
  lastScannedItemId,
  formatMoney,
  onRemoveItem,
  highVisibility,
}: CartItemsTableProps) {
  if (cart.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-base font-medium text-text-secondary">
        Nenhum item no cupom.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2.5 p-2.5 md:hidden">
        {cart.map((item, index) => {
          const total = item.quantity * item.unitPrice;
          const isLast = item.id === lastScannedItemId;
          return (
            <article
              key={item.id}
              className={`pdv-mobile-item-card rounded-xl border bg-bg-light p-3 ${
                isLast ? "border-accent ring-1 ring-accent/30" : "border-border-primary"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-text-secondary pdv-tabular">
                    Item #{index + 1} • {item.code}
                  </p>
                  <p className="truncate text-base font-bold text-text-primary">{item.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-white"
                  aria-label={`Remover ${item.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2 text-sm pdv-tabular">
                <div>
                  <p className="text-xs text-text-secondary">Qtd</p>
                  <p className="font-bold text-accent">{formatQuantity(item.quantity)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Vl. Unit</p>
                  <p className="font-semibold text-text-primary">{formatMoney(item.unitPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Vl. Total</p>
                  <p className="font-bold text-success">{formatMoney(total)}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <table className="pdv-table hidden min-w-[720px] w-full text-lg leading-[1.3] xl:text-xl md:table">
        <thead>
          <tr className="border-b border-border-primary bg-bg-gray-theme text-xs uppercase text-text-secondary">
            <th className="w-14 px-3 py-2.5 text-center">#</th>
            <th className="w-36 px-3 py-2.5 text-left">Código</th>
            <th className="px-3 py-2.5 text-left">Produto</th>
            <th className="w-24 px-3 py-2.5 text-center">Qtd</th>
            <th className="w-36 px-3 py-2.5 text-right">Vl. Unit</th>
            <th className="w-36 px-3 py-2.5 text-right">Vl. Total</th>
            <th className="w-14 px-2 py-2.5 text-center"></th>
          </tr>
        </thead>
        <tbody>
          {cart.map((item, index) => {
            const total = item.quantity * item.unitPrice;
            const isLast = item.id === lastScannedItemId;
            return (
              <tr
                key={item.id}
                className={`border-b border-border-primary transition-colors ${
                  isLast
                    ? "bg-accent/10"
                    : index % 2 === 1
                      ? "bg-bg-gray-theme/40"
                      : "bg-bg-light"
                }`}
              >
                <td className="w-14 px-3 py-3.5 text-center font-semibold text-text-secondary pdv-tabular">
                  {index + 1}
                </td>
                <td className="w-36 px-3 py-3.5 font-mono text-base font-semibold text-text-secondary pdv-tabular">
                  {item.code}
                </td>
                <td className="px-3 py-3.5 font-bold text-text-primary">{item.name}</td>
                <td className="w-24 px-3 py-3.5 text-center font-extrabold text-accent pdv-tabular">
                  {formatQuantity(item.quantity)}
                </td>
                <td className="w-36 px-3 py-3.5 text-right font-semibold text-text-primary pdv-tabular">
                  {formatMoney(item.unitPrice)}
                </td>
                <td className="w-36 px-3 py-3.5 text-right font-extrabold text-success pdv-tabular">
                  {formatMoney(total)}
                </td>
                <td className="w-14 px-2 py-3.5 text-center">
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    className={`inline-flex items-center justify-center rounded-md bg-primary text-white ${
                      highVisibility ? "h-10 w-10" : "h-8 w-8"
                    }`}
                    aria-label={`Remover ${item.name}`}
                    title="Remover item"
                  >
                    <Trash2 size={highVisibility ? 16 : 14} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
