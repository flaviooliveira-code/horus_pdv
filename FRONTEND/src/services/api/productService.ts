/**
 * Arquivo: src/services/api/productService.ts
 * Objetivo: encapsula chamadas HTTP de cadastro, estoque e manutenção de produtos.
 * Entradas esperadas: recebe payloads já validados pelas telas e retorna respostas tipadas da API.
 */
import { apiRequest } from "./apiClient";

const PRODUTO_API_URL =
  import.meta.env.VITE_PRODUTO_API_URL ?? "http://localhost:5260/api/Produto";

const PRODUTO_IMPORTACAO_API_URL =
  import.meta.env.VITE_PRODUTO_IMPORTACAO_API_URL ?? "http://localhost:5260/api/ProdutoImportacao";

export type ProductDto = {
  id: string;
  productImageUrl: string;
  productImageName: string;
  productName: string;
  productCode: string;
  productSupplier: string;
  productDescription: string;
  productQnt: string;
  productUnitPrice: string;
  productSalePrice: string;
  totalPriceOnProduct: string;
  unitType?: string;
};

export type ProductPayload = Omit<ProductDto, "id">;

export type ScaleBarcodeDecodeDto = {
  barcode: string;
  mode: "price" | "weight";
  layout: string;
  matchedCode: string;
  productId: string;
  productCode: string;
  productName: string;
  unitType: string;
  unitPrice: number;
  quantity: number;
  totalValue: number;
  product: ProductDto;
};

export type ProductConflictMode = "atualizar" | "ignorar";

export type ProductImportRowPayload = {
  rowNumber: number;
  productCode: string;
  productName: string;
  productSupplier: string;
  productDescription: string;
  productQnt: string;
  productUnitPrice: string;
  productSalePrice: string;
};

export type ProductImportRowStatusDto = {
  rowNumber: number;
  productCode: string;
  productName: string;
  action: "CRIAR" | "ATUALIZAR" | "IGNORAR" | "ERRO";
  isValid: boolean;
  errors: string[];
  parsedQuantity: number;
  parsedUnitCost: number;
  parsedSalePrice: number;
};

export type ProductImportBatchResultDto = {
  totalRows: number;
  validRows: number;
  errorRows: number;
  createdCount: number;
  updatedCount: number;
  ignoredCount: number;
  rows: ProductImportRowStatusDto[];
};

export const productService = {
  async list() {
    const response = await apiRequest<ProductDto[]>(PRODUTO_API_URL);
    return response.data ?? [];
  },
  async create(payload: ProductPayload) {
    const response = await apiRequest<ProductDto>(PRODUTO_API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.data;
  },
  async update(id: string, payload: ProductPayload) {
    const response = await apiRequest<ProductDto>(`${PRODUTO_API_URL}/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return response.data;
  },
  async remove(id: string) {
    await apiRequest<object>(`${PRODUTO_API_URL}/${id}`, { method: "DELETE" });
  },
  async decodeScaleBarcode(barcode: string, mode: "price" | "weight" = "price") {
    const response = await apiRequest<ScaleBarcodeDecodeDto>(
      `${PRODUTO_API_URL}/decodificar-balanca/${encodeURIComponent(barcode)}?mode=${encodeURIComponent(mode)}`,
    );
    return response.data;
  },
  async validateImportBatch(items: ProductImportRowPayload[], conflictMode: ProductConflictMode) {
    const response = await apiRequest<ProductImportBatchResultDto>(
      `${PRODUTO_IMPORTACAO_API_URL}/validar`,
      {
        method: "POST",
        body: JSON.stringify({ conflictMode, items }),
      },
    );
    return response.data;
  },
  async importBatch(items: ProductImportRowPayload[], conflictMode: ProductConflictMode) {
    const response = await apiRequest<ProductImportBatchResultDto>(
      `${PRODUTO_IMPORTACAO_API_URL}/importar`,
      {
        method: "POST",
        body: JSON.stringify({ conflictMode, items }),
      },
    );
    return response.data;
  },
};

