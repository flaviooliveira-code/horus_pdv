/**
 * Arquivo: src/pages/Admin/MyCompanyPage.tsx
 * Objetivo: centraliza configuracoes cadastrais e de contato da empresa.
 * Entradas esperadas: nao recebe props; renderiza formulario de dados institucionais.
 */
import { useEffect, useState } from "react";
import PageHeader from "@/components/Admin/PageHeader";
import { SearchableSelectField } from "@/components/Form";
import { Toast } from "@/hooks/Dialog";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";
import PageLayout from "@/layout/PageLayout";
import { companyService } from "@/services/api/companyService";
import { lookupAddressByCep, sanitizeCep } from "@/utils/cepLookup";

const UF_OPTIONS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

const UF_SELECT_OPTIONS = UF_OPTIONS.map((option) => ({ value: option, label: option }));

export default function MyCompanyPage() {
  const { maskCep, maskCnpj, maskPhoneBr, onlyDigits } = useInputMasks();

  const [fantasyName, setFantasyName] = useState("");
  const [corporateName, setCorporateName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [stateRegistration, setStateRegistration] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [telSac, setTelSac] = useState("");
  const [telefone, setTelefone] = useState("");
  const [celular, setCelular] = useState("");
  const [cep, setCep] = useState("");
  const [address, setAddress] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("SP");
  const [complement, setComplement] = useState("");
  const [cepLookupLoading, setCepLookupLoading] = useState(false);
  const [cepLookupError, setCepLookupError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    companyService
      .get()
      .then((data) => {
        if (!data) return;
        setFantasyName(data.fantasyName);
        setCorporateName(data.corporateName);
        setCnpj(data.cnpj);
        setStateRegistration(data.stateRegistration);
        setWebsite(data.website);
        setEmail(data.email);
        setTelSac(data.sacPhone);
        setTelefone(data.phone);
        setCelular(data.mobile);
        setCep(data.cep);
        setAddress(data.address);
        setNumber(data.number);
        setNeighborhood(data.neighborhood);
        setCity(data.city);
        setUf(data.uf || "SP");
        setComplement(data.complement);
      })
      .catch(() => {
        Toast.error("Não foi possível carregar dados da empresa.");
      });
  }, []);

  const handleCepLookup = async () => {
    const rawCep = sanitizeCep(cep);

    if (rawCep.length === 0) {
      setCepLookupError("");
      return;
    }

    if (rawCep.length !== 8) {
      setCepLookupError("CEP inválido. Informe 8 dígitos.");
      return;
    }

    setCepLookupLoading(true);
    setCepLookupError("");

    const result = await lookupAddressByCep(rawCep);

    setCepLookupLoading(false);

    if (!result.success) {
      setCepLookupError("Verifique o CEP e tente novamente.");
      return;
    }

    setCep(maskCep(result.data.cep || rawCep));
    setAddress(result.data.endereco || "");
    setNeighborhood(result.data.bairro || "");
    setCity(result.data.cidade || "");
    if (result.data.estado) setUf(result.data.estado);
    setComplement(result.data.complemento || "");
  };

  const saveCompany = async () => {
    if (fantasyName.trim().length < 3) {
      Toast.error("Informe o nome fantasia.");
      return;
    }

    if (onlyDigits(cnpj).length !== 14) {
      Toast.error("CNPJ inválido.");
      return;
    }

    setSaving(true);
    try {
      const data = await companyService.update({
        fantasyName,
        corporateName,
        cnpj,
        stateRegistration,
        website,
        email,
        sacPhone: telSac,
        phone: telefone,
        mobile: celular,
        cep,
        address,
        number,
        neighborhood,
        city,
        uf,
        complement,
      });

      if (data) {
        setFantasyName(data.fantasyName);
        setCorporateName(data.corporateName);
        setCnpj(data.cnpj);
        setStateRegistration(data.stateRegistration);
        setWebsite(data.website);
        setEmail(data.email);
        setTelSac(data.sacPhone);
        setTelefone(data.phone);
        setCelular(data.mobile);
        setCep(data.cep);
        setAddress(data.address);
        setNumber(data.number);
        setNeighborhood(data.neighborhood);
        setCity(data.city);
        setUf(data.uf || "SP");
        setComplement(data.complement);
      }
      Toast.success("Dados da empresa salvos com sucesso.");
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Erro ao salvar dados da empresa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout className="space-y-4 py-4 md:py-6 lg:py-8">
      <PageHeader
        title="Minha Empresa"
        description="Dados cadastrais e de contato da empresa."
      />

      <section className="card rounded-2xl p-4 md:p-5">
        <form className="grid gap-4 md:grid-cols-12">
          <label className="block md:col-span-6">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Nome Fantasia
            </span>
            <input
              className="input-field w-full"
              value={fantasyName}
              onChange={(event) => setFantasyName(event.target.value)}
              placeholder="Nome fantasia"
            />
          </label>

          <label className="block md:col-span-6">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Razão Social
            </span>
            <input
              className="input-field w-full"
              value={corporateName}
              onChange={(event) => setCorporateName(event.target.value)}
              placeholder="Razão social"
            />
          </label>

          <label className="block md:col-span-6">
            <span className="mb-1.5 block text-sm text-text-secondary">
              CNPJ
            </span>
            <input
              className="input-field w-full"
              value={cnpj}
              onChange={(event) => setCnpj(maskCnpj(event.target.value))}
              placeholder="00.000.000/0000-00"
            />
          </label>

          <label className="block md:col-span-6">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Inscrição Estadual
            </span>
            <input
              className="input-field w-full"
              value={stateRegistration}
              onChange={(event) => setStateRegistration(event.target.value)}
              placeholder="Inscrição estadual"
            />
          </label>

          <label className="block md:col-span-6">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Site
            </span>
            <input
              className="input-field w-full"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="https://www.seusite.com.br"
            />
          </label>

          <label className="block md:col-span-6">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Email de Contato
            </span>
            <input
              className="input-field w-full"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@empresa.com.br"
            />
          </label>

          <label className="block md:col-span-4">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Tel SAC
            </span>
            <input
              className="input-field w-full"
              value={telSac}
              onChange={(event) => setTelSac(maskPhoneBr(event.target.value))}
              placeholder="(00) 00000-0000"
            />
          </label>

          <label className="block md:col-span-4">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Telefone
            </span>
            <input
              className="input-field w-full"
              value={telefone}
              onChange={(event) => setTelefone(maskPhoneBr(event.target.value))}
              placeholder="(00) 00000-0000"
            />
          </label>

          <label className="block md:col-span-4">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Celular
            </span>
            <input
              className="input-field w-full"
              value={celular}
              onChange={(event) => setCelular(maskPhoneBr(event.target.value))}
              placeholder="(00) 00000-0000"
            />
          </label>

          <label className="block md:col-span-3">
            <span className="mb-1.5 block text-sm text-text-secondary">
              CEP
            </span>
            <input
              className="input-field w-full"
              value={cep}
              onChange={(event) => setCep(maskCep(event.target.value))}
              onBlur={handleCepLookup}
              placeholder="00000-000"
            />
            {cepLookupLoading ? (
              <p className="mt-1 text-xs text-text-secondary">Consultando CEP...</p>
            ) : null}
            {cepLookupError ? (
              <p className="mt-1 text-xs text-primary">{cepLookupError}</p>
            ) : null}
          </label>

          <label className="block md:col-span-6">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Endereço
            </span>
            <input
              className="input-field w-full"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Rua, avenida, alameda..."
            />
          </label>

          <label className="block md:col-span-3">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Número
            </span>
            <input
              className="input-field w-full"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              placeholder="Número"
            />
          </label>

          <label className="block md:col-span-3">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Bairro
            </span>
            <input
              className="input-field w-full"
              value={neighborhood}
              onChange={(event) => setNeighborhood(event.target.value)}
              placeholder="Bairro"
            />
          </label>

          <label className="block md:col-span-4">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Cidade
            </span>
            <input
              className="input-field w-full"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Cidade"
            />
          </label>

          <SearchableSelectField
            label="UF"
            value={uf}
            options={UF_SELECT_OPTIONS}
            onChange={(nextValue) => setUf(nextValue)}
            getOptionValue={(option) => option.value}
            getOptionLabel={(option) => option.label}
            placeholder="UF"
            emptyMessage="UF não encontrada."
            className="md:col-span-2"
          />

          <label className="block md:col-span-3">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Complemento
            </span>
            <input
              className="input-field w-full"
              value={complement}
              onChange={(event) => setComplement(event.target.value)}
              placeholder="Apto, bloco..."
            />
          </label>

          <div className="flex justify-end md:col-span-12">
            <button type="button" onClick={saveCompany} disabled={saving} className="btn-primary">
              {saving ? "Salvando..." : "Salvar dados da empresa"}
            </button>
          </div>
        </form>
      </section>
    </PageLayout>
  );
}
