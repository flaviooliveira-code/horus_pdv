/**
 * Arquivo: src/components/Admin/PaymentsPage/GatewayFormDrawer.tsx
 * Objetivo: renderiza o drawer de cadastro/edição de gateway de pagamento no padrão do sistema.
 * Entradas esperadas: recebe estado do formulário, máscaras das credenciais salvas e callbacks de salvar/fechar.
 */
import { Eye, EyeOff, Save, X } from "lucide-react";
import { useState, type FormEvent, type HTMLAttributes, type ReactNode } from "react";
import { YesNoSegmentedControl } from "@/components/Form";
import LoadingButton from "@/components/Loading/LoadingButton";
import type {
  PaymentGatewayEnvironment,
  PaymentGatewayProvider,
} from "@/services/api/paymentGatewayService";
import {
  CREDENTIAL_HELP,
  CREDENTIAL_LABEL,
  PIX_ONLY_PROVIDERS,
  PROVIDER_DESCRIPTION,
  PROVIDER_LABEL,
  PROVIDER_ORDER,
} from "./constants";
import ProviderLogo from "./ProviderLogo";
import type { GatewayFormState } from "./types";

type GatewayFormDrawerProps = {
  open: boolean;
  isEditMode: boolean;
  form: GatewayFormState;
  /** Máscaras das credenciais já salvas (somente na edição do mesmo provedor). */
  savedAccessTokenMask: string;
  savedWebhookSecretMask: string;
  isSaving: boolean;
  onChange: <K extends keyof GatewayFormState>(key: K, value: GatewayFormState[K]) => void;
  onClose: () => void;
  onSave: () => void;
};

const ENVIRONMENT_OPTIONS: Array<{ value: PaymentGatewayEnvironment; label: string }> = [
  { value: "PRODUCTION", label: "Produção" },
  { value: "SANDBOX", label: "Sandbox / Homologação" },
];

export default function GatewayFormDrawer({
  open,
  isEditMode,
  form,
  savedAccessTokenMask,
  savedWebhookSecretMask,
  isSaving,
  onChange,
  onClose,
  onSave,
}: GatewayFormDrawerProps) {
  if (!open) return null;

  const providerLabel = PROVIDER_LABEL[form.provider];
  const allowsPixOnly = PIX_ONLY_PROVIDERS.includes(form.provider);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave();
  };

  return (
    <div className="dept-drawer-overlay" onClick={isSaving ? undefined : onClose}>
      <aside
        className="dept-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gateway-drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
          <div className="flex items-start justify-between border-b border-border-primary p-5">
            <div>
              <h3 id="gateway-drawer-title" className="text-xl font-semibold text-text-primary">
                {isEditMode ? "Editar gateway" : "Novo gateway"}
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                Escolha o provedor, cole a credencial e defina quando esta conta entra nas cobranças.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg p-2 text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
              aria-label="Fechar formulário de gateway"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <section className="card rounded-2xl p-4">
              <h4 className="text-sm font-semibold text-text-secondary">Provedor</h4>
              <div
                role="radiogroup"
                aria-label="Provedor do gateway"
                className="mt-3 grid gap-2 sm:grid-cols-3"
              >
                {PROVIDER_ORDER.map((provider) => (
                  <ChoiceButton
                    key={provider}
                    selected={form.provider === provider}
                    onClick={() => onChange("provider", provider as PaymentGatewayProvider)}
                  >
                    {PROVIDER_LABEL[provider]}
                  </ChoiceButton>
                ))}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <span className="mb-1.5 block text-sm text-text-secondary">Ambiente</span>
                  <div role="radiogroup" aria-label="Ambiente" className="grid grid-cols-2 gap-2">
                    {ENVIRONMENT_OPTIONS.map((option) => (
                      <ChoiceButton
                        key={option.value}
                        selected={form.environment === option.value}
                        onClick={() => onChange("environment", option.value)}
                      >
                        {option.value === "PRODUCTION" ? "Produção" : "Sandbox"}
                      </ChoiceButton>
                    ))}
                  </div>
                </div>
                <TextField
                  label="Nome"
                  value={form.name}
                  onChange={(value) => onChange("name", value)}
                  placeholder={`Ex.: ${providerLabel} loja`}
                  required
                />
              </div>
            </section>

            <section className="card rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <ProviderLogo provider={form.provider} />
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-text-primary">
                    Credenciais {providerLabel}
                  </h4>
                  <p className="mt-1 text-sm text-text-secondary">
                    {PROVIDER_DESCRIPTION[form.provider]}
                  </p>
                  <p className="mt-1 text-sm font-medium text-accent">
                    {CREDENTIAL_HELP[form.provider]}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                <SecretField
                  label={CREDENTIAL_LABEL[form.provider]}
                  value={form.accessToken}
                  onChange={(value) => onChange("accessToken", value)}
                  savedMask={savedAccessTokenMask}
                  required={!savedAccessTokenMask}
                />
                {form.provider === "MERCADO_PAGO" ? (
                  <>
                    <TextField
                      label="Public Key"
                      value={form.publicKey}
                      onChange={(value) => onChange("publicKey", value)}
                      placeholder="APP_USR-... (opcional, usada no checkout)"
                    />
                    <SecretField
                      label="Assinatura secreta do webhook"
                      value={form.webhookSecret}
                      onChange={(value) => onChange("webhookSecret", value)}
                      savedMask={savedWebhookSecretMask}
                      emptyPlaceholder="Opcional: valida o x-signature dos eventos"
                    />
                  </>
                ) : null}
                {form.provider === "ASAAS" ? (
                  <TextField
                    label="E-mail para avisos do webhook"
                    value={form.webhookResponsibleEmail}
                    onChange={(value) => onChange("webhookResponsibleEmail", value)}
                    placeholder="financeiro@empresa.com"
                    type="email"
                    help="O Asaas avisa este e-mail quando a fila de webhook for interrompida."
                  />
                ) : null}
              </div>
            </section>

            <section className="card rounded-2xl p-4">
              <h4 className="text-sm font-semibold text-text-secondary">Uso desta conta</h4>
              <div className="mt-3 space-y-2">
                <ToggleRow
                  label="Gateway ativo"
                  helper="Contas inativas não emitem novas cobranças."
                  value={form.active}
                  onChange={(value) => onChange("active", value)}
                />
                <ToggleRow
                  label="Padrão para PIX"
                  helper="Usar esta conta nas cobranças PIX do caixa."
                  value={form.defaultPix}
                  disabled={form.pixOnly}
                  onChange={(value) => onChange("defaultPix", value)}
                />
                <ToggleRow
                  label="Padrão para boleto"
                  helper="Usar esta conta nas cobranças por boleto."
                  value={form.defaultBoleto}
                  disabled={form.pixOnly}
                  onChange={(value) => onChange("defaultBoleto", value)}
                />
                {allowsPixOnly ? (
                  <ToggleRow
                    label="Somente PIX"
                    helper="Desativa boleto e mantém só QR Code ou copia e cola."
                    value={form.pixOnly}
                    onChange={(value) => onChange("pixOnly", value)}
                  />
                ) : null}
                <ToggleRow
                  label="Boleto com PIX"
                  helper="Inclui QR Code PIX no boleto emitido."
                  value={form.generateBoletoPix}
                  disabled={form.pixOnly}
                  onChange={(value) => onChange("generateBoletoPix", value)}
                />
              </div>
            </section>

            <section className="card rounded-2xl p-4">
              <h4 className="text-sm font-semibold text-text-secondary">Regras do boleto</h4>
              <p className="mt-1 text-xs text-text-tertiary">
                Usadas nas próximas cobranças emitidas por esta conta. Deixe em branco para usar o
                padrão do provedor.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <TextField
                  label="Vencimento (dias)"
                  value={form.boletoDueDays}
                  onChange={(value) => onChange("boletoDueDays", value.replace(/\D/g, ""))}
                  placeholder="Ex.: 3"
                  inputMode="numeric"
                />
                <TextField
                  label="Multa (%)"
                  value={form.finePercent}
                  onChange={(value) => onChange("finePercent", value.replace(/[^\d,.]/g, ""))}
                  placeholder="Ex.: 2"
                  inputMode="decimal"
                />
                <TextField
                  label="Juros ao mês (%)"
                  value={form.monthlyInterestPercent}
                  onChange={(value) =>
                    onChange("monthlyInterestPercent", value.replace(/[^\d,.]/g, ""))
                  }
                  placeholder="Ex.: 1"
                  inputMode="decimal"
                />
              </div>
            </section>
          </div>

          <div className="border-t border-border-primary p-4">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
              <button type="button" onClick={onClose} disabled={isSaving} className="btn-cancel">
                Cancelar
              </button>
              <LoadingButton
                type="submit"
                isLoading={isSaving}
                loadingLabel="Salvando..."
                className="btn-primary inline-flex items-center justify-center gap-1.5"
              >
                <Save size={15} />
                {isEditMode ? "Salvar" : "Conectar gateway"}
              </LoadingButton>
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition ${
        selected
          ? "border-secondary bg-secondary text-text-light shadow-sm"
          : "border-border-secondary bg-bg-light text-text-secondary hover:bg-hover-light"
      }`}
    >
      {children}
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  help,
  required = false,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  help?: string;
  required?: boolean;
  type?: "text" | "email";
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-text-secondary">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input-field w-full"
        placeholder={placeholder}
        required={required}
        inputMode={inputMode}
      />
      {help ? <span className="mt-1 block text-xs text-text-tertiary">{help}</span> : null}
    </label>
  );
}

function SecretField({
  label,
  value,
  onChange,
  savedMask,
  required = false,
  emptyPlaceholder = "Cole a credencial gerada no painel do provedor",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  savedMask: string;
  required?: boolean;
  emptyPlaceholder?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-text-secondary">{label}</span>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="input-field w-full pr-11"
          placeholder={savedMask ? "Deixe em branco para manter a credencial salva" : emptyPlaceholder}
          required={required}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-text-secondary hover:text-text-primary"
          aria-label={visible ? `Ocultar ${label}` : `Mostrar ${label}`}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {savedMask ? (
        <span className="mt-1 block text-xs text-text-tertiary">Credencial salva: {savedMask}</span>
      ) : null}
    </label>
  );
}

function ToggleRow({
  label,
  helper,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  helper: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl bg-bg-gray-theme/70 px-3 py-3 sm:flex-row sm:items-center sm:justify-between ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        <p className="mt-0.5 text-xs text-text-secondary">{helper}</p>
      </div>
      <YesNoSegmentedControl
        ariaLabel={label}
        className="shrink-0"
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}
