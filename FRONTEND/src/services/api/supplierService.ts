import { apiRequest } from "./apiClient";

const FORNECEDOR_API_URL =
  import.meta.env.VITE_FORNECEDOR_API_URL ?? "http://localhost:5260/api/Fornecedor";

export type SupplierDto = {
  id: string;
  companyName: string;
  fantasyName: string;
  cnpj: string;
  cep: string;
  city: string;
  state: string;
  address: string;
  neighborhood: string;
  streetComplement: string;
  number: string;
  referencePoint: string;
  telephone: string;
  cellphone: string;
  email: string;
};

export type SupplierPayload = Omit<SupplierDto, "id">;

export const supplierService = {
  async list() {
    const response = await apiRequest<SupplierDto[]>(FORNECEDOR_API_URL);
    return response.data ?? [];
  },
  async create(payload: SupplierPayload) {
    const response = await apiRequest<SupplierDto>(FORNECEDOR_API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.data;
  },
  async update(id: string, payload: SupplierPayload) {
    const response = await apiRequest<SupplierDto>(`${FORNECEDOR_API_URL}/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return response.data;
  },
  async remove(id: string) {
    await apiRequest<object>(`${FORNECEDOR_API_URL}/${id}`, { method: "DELETE" });
  },
};
