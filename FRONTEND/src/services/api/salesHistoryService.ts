import { apiRequest } from "./apiClient";

const HISTORICO_VENDAS_API_URL =
  import.meta.env.VITE_HISTORICO_VENDAS_API_URL ?? "http://localhost:5260/api/HistoricoVendas";

export type SaleHistoryDto = {
  saleNumber: string;
  customerName: string;
  customerCpf: string;
  paymentType: string;
  totalAmount: string;
  operatorName: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  itemTotal: string;
  saleDate: string;
};

export type RegisterSalePayload = {
  customerName: string;
  customerCpf: string;
  paymentType: string;
  totalAmount: string;
  operatorName: string;
  items: Array<{
    productCode: string;
    productName: string;
    quantity: number;
  }>;
};

export const salesHistoryService = {
  async list() {
    const response = await apiRequest<SaleHistoryDto[]>(HISTORICO_VENDAS_API_URL);
    return response.data ?? [];
  },
  async register(payload: RegisterSalePayload) {
    const response = await apiRequest<{ saleNumber: string }>(HISTORICO_VENDAS_API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.data;
  },
  async print(saleNumber: string) {
    const response = await apiRequest<{
      saleNumber: string;
      printedAt: string;
      items: number;
      rows: SaleHistoryDto[];
    }>(`${HISTORICO_VENDAS_API_URL}/${saleNumber}/imprimir`, {
      method: "POST",
    });
    return response.data;
  },
};
