/**
 * Arquivo: src/utils/scaleBarcode.ts
 * Objetivo: decodificador de etiquetas EAN-13 de balança (prefixo 2) e formatadores de quantidade decimal.
 * Entradas esperadas: código EAN-13 de 13 dígitos, lista de produtos cadastrados e modo de leitura (price|weight).
 */

export type ScaleBarcodeMode = "price" | "weight";

export type ScaleProductMatchInput = {
  id: string;
  code: string;
  name: string;
  salePrice: number;
  stock: number;
  unitType?: string;
};

export type ScaleBarcodeMatchResult<T extends ScaleProductMatchInput = ScaleProductMatchInput> = {
  barcode: string;
  mode: ScaleBarcodeMode;
  layout: "5x6" | "4x6" | "6x5";
  matchedCode: string;
  product: T;
  quantity: number;
  unitPrice: number;
  totalValue: number;
};

export function roundQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 0;
  return Math.round((quantity + Number.EPSILON) * 1000) / 1000;
}

/**
 * Total da linha (preço × quantidade) arredondado meio-para-cima em centavos, igual ao
 * servidor (decimal com MidpointRounding.AwayFromZero). Usa inteiros (centavos × milésimos)
 * para evitar erro de ponto flutuante: 12,90 × 0,350 = 4,515 → 4,52 (em float daria 4,51).
 */
export function computeLineTotal(unitPrice: number, quantity: number): number {
  if (!Number.isFinite(unitPrice) || !Number.isFinite(quantity)) return 0;
  const priceCents = Math.round(unitPrice * 100);
  const quantityMilli = Math.round(quantity * 1000);
  const scaled = priceCents * quantityMilli; // centavos × 1000, inteiro exato
  const sign = scaled < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(scaled) / 1000)) / 100;
}

export function formatQuantityPtBr(quantity: number): string {
  if (!Number.isFinite(quantity)) return "0";
  const rounded = roundQuantity(quantity);
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }
  return rounded.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

export function isValidEan13CheckDigit(barcode: string): boolean {
  const trimmed = String(barcode ?? "").trim();
  if (!/^\d{13}$/.test(trimmed)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const digit = Number(trimmed[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }

  const expected = (10 - (sum % 10)) % 10;
  return expected === Number(trimmed[12]);
}

function trimLeadingZeros(code: string): string {
  return code.replace(/^0+/, "") || "0";
}

export function parseScaleBarcode<T extends ScaleProductMatchInput>(
  barcode: string,
  products: readonly T[],
  mode: ScaleBarcodeMode = "price",
): ScaleBarcodeMatchResult<T> | null {
  const trimmed = String(barcode ?? "").trim();
  if (!/^2\d{12}$/.test(trimmed) || !isValidEan13CheckDigit(trimmed)) {
    return null;
  }

  const layouts: Array<{ layout: "5x6" | "4x6" | "6x5"; rawCode: string; rawMeasure: number }> = [
    {
      layout: "5x6",
      rawCode: trimmed.slice(1, 6),
      rawMeasure: Number(trimmed.slice(6, 12)),
    },
  ];

  if (trimmed[1] === "0") {
    layouts.push({
      layout: "4x6",
      rawCode: trimmed.slice(2, 6),
      rawMeasure: Number(trimmed.slice(6, 12)),
    });
  }

  layouts.push({
    layout: "6x5",
    rawCode: trimmed.slice(1, 7),
    rawMeasure: Number(trimmed.slice(7, 12)),
  });

  for (const candidate of layouts) {
    const rawLower = candidate.rawCode.toLowerCase();
    const trimmedLower = trimLeadingZeros(candidate.rawCode).toLowerCase();

    const matched =
      products.find((product) => product.code.trim().toLowerCase() === rawLower) ??
      products.find((product) => product.code.trim().toLowerCase() === trimmedLower);

    if (!matched) continue;
    if (!Number.isFinite(matched.salePrice) || matched.salePrice <= 0) return null;

    let quantity: number;
    let totalValue: number;
    if (mode === "price") {
      totalValue = Math.round(candidate.rawMeasure) / 100;
      quantity = roundQuantity(totalValue / matched.salePrice);
    } else {
      quantity = roundQuantity(candidate.rawMeasure / 1000);
      totalValue = computeLineTotal(matched.salePrice, quantity);
    }

    if (quantity <= 0 || totalValue <= 0) return null;

    return {
      barcode: trimmed,
      mode,
      layout: candidate.layout,
      matchedCode: matched.code.trim(),
      product: matched,
      quantity,
      unitPrice: matched.salePrice,
      totalValue,
    };
  }

  return null;
}
