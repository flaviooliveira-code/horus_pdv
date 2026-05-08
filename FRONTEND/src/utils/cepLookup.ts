/**
 * Arquivo: src/utils/cepLookup.ts
 * Objetivo: consulta endereço por CEP com fallback entre múltiplos provedores.
  * Entradas esperadas: recebe CEP normalizado e retorna endereço encontrado nos provedores disponíveis.
*/
const DEFAULT_TIMEOUT_MS = 5000;

const trimTrailingSlash = (url = "") => url.replace(/\/+$/, "");

export const sanitizeCep = (cep: string) => cep.replace(/\D/g, "");

type CepLookupOptions = {
  timeoutMs?: number;
  viaCepBaseUrl?: string;
  brasilApiBaseUrl?: string;
  openCepBaseUrl?: string;
};

type CepAddressData = {
  cep: string;
  estado: string;
  cidade: string;
  bairro: string;
  endereco: string;
  complemento: string;
};

type CepLookupSuccess = {
  success: true;
  provider: string;
  data: CepAddressData;
};

type CepLookupFailure = {
  success: false;
  reason: "invalid_cep" | "all_providers_failed";
};

export type CepLookupResult = CepLookupSuccess | CepLookupFailure;

const withTimeout = async (url: string, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const toAddressShape = (data: Record<string, string> = {}): CepAddressData => ({
  cep: data.cep || "",
  estado: data.uf || data.state || "",
  cidade: data.localidade || data.city || "",
  bairro: data.bairro || data.neighborhood || data.district || "",
  endereco: data.logradouro || data.street || data.address || "",
  complemento: data.complemento || data.complement || "",
});

const viaCepProvider = {
  name: "ViaCEP",
  async fetch(cep: string, options: CepLookupOptions) {
    const baseUrl = trimTrailingSlash(
      options.viaCepBaseUrl || import.meta.env.VITE_API_URL_VIACEP || "https://viacep.com.br/ws",
    );
    const response = await withTimeout(`${baseUrl}/${cep}/json/`, options.timeoutMs);
    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, string> & { erro?: boolean };
    if (data.erro) return null;
    return toAddressShape(data);
  },
};

const brasilApiProvider = {
  name: "BrasilAPI",
  async fetch(cep: string, options: CepLookupOptions) {
    const baseUrl = trimTrailingSlash(
      options.brasilApiBaseUrl ||
        import.meta.env.VITE_API_URL_BRASILAPI ||
        "https://brasilapi.com.br/api/cep/v2",
    );
    const response = await withTimeout(`${baseUrl}/${cep}`, options.timeoutMs);
    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, string>;
    if (!data.cep) return null;
    return toAddressShape(data);
  },
};

const openCepProvider = {
  name: "OpenCEP",
  async fetch(cep: string, options: CepLookupOptions) {
    const baseUrl = trimTrailingSlash(
      options.openCepBaseUrl || import.meta.env.VITE_API_URL_OPENCEP || "https://opencep.com/v1",
    );
    const response = await withTimeout(`${baseUrl}/${cep}`, options.timeoutMs);
    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, string>;
    if (!data.cep) return null;
    return toAddressShape(data);
  },
};

const providers = [viaCepProvider, brasilApiProvider, openCepProvider];

export async function lookupAddressByCep(
  rawCep: string,
  options: CepLookupOptions = {},
): Promise<CepLookupResult> {
  const cep = sanitizeCep(rawCep);
  if (cep.length !== 8) return { success: false, reason: "invalid_cep" };

  for (const provider of providers) {
    try {
      const data = await provider.fetch(cep, options);
      if (data) return { success: true, provider: provider.name, data };
    } catch {
      // Ignora falha e tenta próximo provedor.
    }
  }

  return { success: false, reason: "all_providers_failed" };
}
