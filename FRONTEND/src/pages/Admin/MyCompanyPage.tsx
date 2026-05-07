/**
 * Arquivo: src/pages/Admin/MyCompanyPage.tsx
 * Objetivo: centraliza configuracoes cadastrais e de contato da empresa.
 * Entradas esperadas: nao recebe props; renderiza formulario de dados institucionais.
 */
import { useEffect, useState } from "react";
import PageHeader from "@/components/Admin/PageHeader";
import { SearchableSelectField, YesNoSegmentedControl } from "@/components/Form";
import LoadingButton from "@/components/Loading/LoadingButton";
import { Toast } from "@/hooks/Dialog";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";
import PageLayout from "@/layout/PageLayout";
import { companyService } from "@/services/api/companyService";
import { lookupAddressByCep, sanitizeCep } from "@/utils/cepLookup";
import { isValidEmail } from "@/utils/validators";

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
  const [emailSmtpEnabled, setEmailSmtpEnabled] = useState(false);
  const [emailSmtpHost, setEmailSmtpHost] = useState("smtp-mail.outlook.com");
  const [emailSmtpPort, setEmailSmtpPort] = useState("587");
  const [emailSmtpEnableSsl, setEmailSmtpEnableSsl] = useState(true);
  const [emailSmtpUser, setEmailSmtpUser] = useState("");
  const [emailSmtpPassword, setEmailSmtpPassword] = useState("");
  const [emailSmtpHasPassword, setEmailSmtpHasPassword] = useState(false);
  const [emailSmtpFromEmail, setEmailSmtpFromEmail] = useState("");
  const [emailSmtpFromName, setEmailSmtpFromName] = useState("Hórus PDV");
  const [emailSmtpReplyTo, setEmailSmtpReplyTo] = useState("");
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
        setEmailSmtpEnabled(Boolean(data.emailSmtpEnabled));
        setEmailSmtpHost(data.emailSmtpHost || "smtp-mail.outlook.com");
        setEmailSmtpPort(String(data.emailSmtpPort || 587));
        setEmailSmtpEnableSsl(data.emailSmtpEnableSsl ?? true);
        setEmailSmtpUser(data.emailSmtpUser || "");
        setEmailSmtpPassword("");
        setEmailSmtpHasPassword(Boolean(data.emailSmtpHasPassword));
        setEmailSmtpFromEmail(data.emailSmtpFromEmail || data.email || "");
        setEmailSmtpFromName(data.emailSmtpFromName || data.fantasyName || "Hórus PDV");
        setEmailSmtpReplyTo(data.emailSmtpReplyTo || "");
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

    if (emailSmtpEnabled) {
      const smtpPort = Number(emailSmtpPort);

      if (!emailSmtpHost.trim()) {
        Toast.error("Informe o host SMTP.");
        return;
      }

      if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
        Toast.error("Informe uma porta SMTP válida.");
        return;
      }

      if (!isValidEmail(emailSmtpUser)) {
        Toast.error("Informe o usuário SMTP.");
        return;
      }

      if (!isValidEmail(emailSmtpFromEmail)) {
        Toast.error("Informe o e-mail remetente.");
        return;
      }

      if (emailSmtpReplyTo.trim() && !isValidEmail(emailSmtpReplyTo)) {
        Toast.error("Informe um e-mail de resposta válido.");
        return;
      }

      if (!emailSmtpHasPassword && !emailSmtpPassword.trim()) {
        Toast.error("Informe a senha de app SMTP.");
        return;
      }
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
        emailSmtpEnabled,
        emailSmtpHost,
        emailSmtpPort: Number(emailSmtpPort || 0),
        emailSmtpEnableSsl,
        emailSmtpUser,
        emailSmtpPassword,
        emailSmtpHasPassword,
        emailSmtpFromEmail,
        emailSmtpFromName,
        emailSmtpReplyTo,
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
        setEmailSmtpEnabled(Boolean(data.emailSmtpEnabled));
        setEmailSmtpHost(data.emailSmtpHost || "smtp-mail.outlook.com");
        setEmailSmtpPort(String(data.emailSmtpPort || 587));
        setEmailSmtpEnableSsl(data.emailSmtpEnableSsl ?? true);
        setEmailSmtpUser(data.emailSmtpUser || "");
        setEmailSmtpPassword("");
        setEmailSmtpHasPassword(Boolean(data.emailSmtpHasPassword));
        setEmailSmtpFromEmail(data.emailSmtpFromEmail || data.email || "");
        setEmailSmtpFromName(data.emailSmtpFromName || data.fantasyName || "Hórus PDV");
        setEmailSmtpReplyTo(data.emailSmtpReplyTo || "");
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
            <LoadingButton
              type="button"
              onClick={saveCompany}
              isLoading={saving}
              loadingLabel="Salvando..."
              className="btn-primary"
            >
              Salvar dados da empresa
            </LoadingButton>
          </div>
        </form>
      </section>

      <section className="card rounded-2xl p-4 md:p-5">
        <div className="mb-4 flex flex-col gap-3 border-b border-border/70 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Configuração de e-mail
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Envio de e-mails do sistema usando a conta da empresa.
            </p>
          </div>

          <YesNoSegmentedControl
            value={emailSmtpEnabled}
            onChange={setEmailSmtpEnabled}
            ariaLabel="Usar envio de e-mails pela conta da empresa"
          />
        </div>

        <form className="grid gap-4 md:grid-cols-12">
          <label className="block md:col-span-6">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Host SMTP
            </span>
            <input
              className="input-field w-full"
              value={emailSmtpHost}
              onChange={(event) => setEmailSmtpHost(event.target.value)}
              placeholder="smtp-mail.outlook.com"
              disabled={!emailSmtpEnabled}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Porta
            </span>
            <input
              className="input-field w-full"
              inputMode="numeric"
              value={emailSmtpPort}
              onChange={(event) =>
                setEmailSmtpPort(event.target.value.replace(/\D/g, "").slice(0, 5))
              }
              placeholder="587"
              disabled={!emailSmtpEnabled}
            />
          </label>

          <label className="flex items-end md:col-span-4">
            <span className="inline-flex min-h-11 items-center gap-3 text-sm font-medium text-text-primary">
              <input
                type="checkbox"
                checked={emailSmtpEnableSsl}
                onChange={(event) => setEmailSmtpEnableSsl(event.target.checked)}
                disabled={!emailSmtpEnabled}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              Conexão segura
            </span>
          </label>

          <label className="block md:col-span-6">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Usuário SMTP
            </span>
            <input
              className="input-field w-full"
              value={emailSmtpUser}
              onChange={(event) => setEmailSmtpUser(event.target.value)}
              placeholder="email@empresa.com.br"
              disabled={!emailSmtpEnabled}
            />
          </label>

          <label className="block md:col-span-6">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Senha de app
            </span>
            <input
              className="input-field w-full"
              type="password"
              value={emailSmtpPassword}
              onChange={(event) => setEmailSmtpPassword(event.target.value)}
              placeholder={
                emailSmtpHasPassword
                  ? "Senha já configurada. Preencha apenas para trocar."
                  : "Senha de app SMTP"
              }
              disabled={!emailSmtpEnabled}
            />
          </label>

          <label className="block md:col-span-4">
            <span className="mb-1.5 block text-sm text-text-secondary">
              E-mail remetente
            </span>
            <input
              className="input-field w-full"
              value={emailSmtpFromEmail}
              onChange={(event) => setEmailSmtpFromEmail(event.target.value)}
              placeholder="naoresponder@empresa.com.br"
              disabled={!emailSmtpEnabled}
            />
          </label>

          <label className="block md:col-span-4">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Nome do remetente
            </span>
            <input
              className="input-field w-full"
              value={emailSmtpFromName}
              onChange={(event) => setEmailSmtpFromName(event.target.value)}
              placeholder="Nome da empresa"
              disabled={!emailSmtpEnabled}
            />
          </label>

          <label className="block md:col-span-4">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Responder para
            </span>
            <input
              className="input-field w-full"
              value={emailSmtpReplyTo}
              onChange={(event) => setEmailSmtpReplyTo(event.target.value)}
              placeholder="resposta@empresa.com.br"
              disabled={!emailSmtpEnabled}
            />
          </label>

          <div className="flex justify-end md:col-span-12">
            <LoadingButton
              type="button"
              onClick={saveCompany}
              isLoading={saving}
              loadingLabel="Salvando..."
              className="btn-primary"
            >
              Salvar configuração de e-mail
            </LoadingButton>
          </div>
        </form>
      </section>
    </PageLayout>
  );
}
