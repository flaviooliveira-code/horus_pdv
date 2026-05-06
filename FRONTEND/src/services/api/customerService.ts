import { apiRequest } from "./apiClient";

const CLIENTE_API_URL =
  import.meta.env.VITE_CLIENTE_API_URL ?? "http://localhost:5260/api/Cliente";

export type CustomerDto = {
  id: string;
  customerName: string;
  document: string;
  birthDate: string;
  age: string;
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

export type CustomerPayload = Omit<CustomerDto, "id">;

export const customerService = {
  async list() {
    const response = await apiRequest<CustomerDto[]>(CLIENTE_API_URL);
    return response.data ?? [];
  },
  async create(payload: CustomerPayload) {
    const response = await apiRequest<CustomerDto>(CLIENTE_API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.data;
  },
  async update(id: string, payload: CustomerPayload) {
    const response = await apiRequest<CustomerDto>(`${CLIENTE_API_URL}/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return response.data;
  },
  async remove(id: string) {
    await apiRequest<object>(`${CLIENTE_API_URL}/${id}`, { method: "DELETE" });
  },
};
