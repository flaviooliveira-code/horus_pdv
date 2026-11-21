/**
 * Arquivo: src/components/Admin/SalesStartPage/LastScannedCard.tsx
 * Objetivo: exibe o card em destaque gigante do último produto bipado com imagem e fórmula QTD x VL. UNIT = TOTAL.
 * Entradas esperadas: último item do carrinho, produto selecionado em prévia, imagem, formatador e flag alta visibilidade.
 */
import { Image as ImageIcon } from "lucide-react";
import { computeLineTotal } from "../../../utils/scaleBarcode.ts";
import { formatQuantity, getCartLineTotal, type PdvCartItem, type PdvProduct } from "./pdvTypes";

type LastScannedCardProps = {
  activeItem: PdvCartItem | null;
  selectedProduct: PdvProduct | null;
  previewImageUrl?: string;
  previewQuantity?: number;
  formatMoney: (value: number) => string;
  highVisibility: boolean;
};

export default function LastScannedCard({
  activeItem,
  selectedProduct,
  previewImageUrl,
  previewQuantity = 1,
  formatMoney,
  highVisibility,
}: LastScannedCardProps) {
  const displayName = activeItem?.name ?? selectedProduct?.name ?? "AGUARDANDO PRODUTO";
  const displayCode = activeItem?.code ?? selectedProduct?.code ?? "";
  const displayQty = activeItem ? activeItem.quantity : selectedProduct ? previewQuantity : 0;
  const displayUnitPrice = activeItem
    ? activeItem.unitPrice
    : selectedProduct
      ? selectedProduct.salePrice
      : 0;
  const displayTotal = activeItem
    ? getCartLineTotal(activeItem)
    : computeLineTotal(displayUnitPrice, displayQty);
  const hasActiveProduct = Boolean(activeItem || selectedProduct);

  return (
    <div
      className={`pdv-last-scanned-card border-b border-border-primary bg-bg-light px-4 py-3 ${
        highVisibility ? "py-4" : ""
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-border-secondary bg-bg-primary text-text-tertiary ${
            highVisibility ? "h-24 w-24 sm:h-28 sm:w-28" : "h-20 w-20 sm:h-24 sm:w-24"
          }`}
        >
          {previewImageUrl ? (
            <img
              src={previewImageUrl}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-center">
              <ImageIcon size={highVisibility ? 32 : 24} />
              <span className="text-[11px] font-medium">Sem imagem</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="pdv-field-label text-xs font-bold uppercase tracking-wide text-text-secondary">
              {activeItem ? "Último Produto Bipado:" : "Produto em Foco:"}
            </span>
            {displayCode ? (
              <span className="rounded-md border border-border-secondary bg-bg-gray-theme px-2 py-0.5 font-mono text-xs font-bold text-text-primary pdv-tabular">
                Cód. {displayCode}
              </span>
            ) : null}
          </div>

          <h2
            className={`pdv-last-scanned-name break-words font-display font-extrabold leading-tight tracking-tight text-text-primary ${
              highVisibility ? "text-4xl md:text-5xl" : "text-3xl md:text-4xl"
            }`}
          >
            {displayName}
          </h2>

          {hasActiveProduct ? (
            <p
              className={`pdv-last-scanned-math pdv-tabular mt-1.5 font-bold text-accent ${
                highVisibility ? "text-2xl md:text-3xl" : "text-xl md:text-2xl"
              }`}
            >
              {formatQuantity(displayQty)} x R$ {formatMoney(displayUnitPrice)} ={" "}
              <span className="text-success">R$ {formatMoney(displayTotal)}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm font-medium text-text-secondary">
              Bipe um código de barras ou pesquise um produto para iniciar a venda.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
