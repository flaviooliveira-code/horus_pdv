import { apiRequest } from "./apiClient";

const EMPRESA_API_URL =
  import.meta.env.VITE_EMPRESA_API_URL ?? "http://localhost:5260/api/Empresa";

export type CompanyDto = {
  fantasyName: string;
  corporateName: string;
  cnpj: string;
  stateRegistration: string;
  website: string;
  email: string;
  sacPhone: string;
  phone: string;
  mobile: string;
  cep: string;
  address: string;
  number: string;
  neighborhood: string;
  city: string;
  uf: string;
  complement: string;
};

export const companyService = {
  async get() {
    const response = await apiRequest<CompanyDto>(EMPRESA_API_URL);
    return response.data;
  },
  async update(payload: CompanyDto) {
    const response = await apiRequest<CompanyDto>(EMPRESA_API_URL, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return response.data;
  },
};
