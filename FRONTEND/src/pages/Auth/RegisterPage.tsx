/**
 * Arquivo: src/pages/Auth/RegisterPage.tsx
 * Objetivo: renderiza cadastro público da empresa e usuário administrador inicial.
 * Entradas esperadas: recebe callbacks de navegação; envia dados validados, máscaras e reCAPTCHA para a API.
 */
import { Building2, Phone, User, UserPlus } from "lucide-react";
import { useState } from "react";
import LoadingButton from "@/components/Loading/LoadingButton";
import useRecaptchaV3 from "@/hooks/Security/useRecaptchaV3";
import { maskCnpj, maskPhoneBr } from "@/utils/inputMasks";
import { isValidCnpj, isValidEmail } from "@/utils/validators";
import AuthLayout from "./AuthLayout";
import { EmailField, FeedbackMessage, PasswordField } from "./AuthFields";
import type { AuthActionResult, RegisterFormPayload } from "./types";

const initialRegisterForm: RegisterFormPayload = {
  cnpj: "",
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

type RegisterPageProps = {
  onRegister: (
    payload: RegisterFormPayload,
    recaptchaToken?: string,
  ) => Promise<AuthActionResult>;
  onOpenLogin: () => void;
  onRegisterSuccess: (email: string) => void;
};

export default function RegisterPage({
  onRegister,
  onOpenLogin,
  onRegisterSuccess,
}: RegisterPageProps) {
  const { executeRecaptcha, isRecaptchaConfigured } = useRecaptchaV3();
  const [form, setForm] = useState(initialRegisterForm);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<AuthActionResult | null>(null);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.cnpj.trim() || !form.password.trim()) {
      setFeedback({
        success: false,
        message: "Preencha nome da empresa, CNPJ, e-mail e senha.",
      });
      return;
    }
    if (!isValidCnpj(form.cnpj)) {
      setFeedback({ success: false, message: "Informe um CNPJ válido." });
      return;
    }
    if (!isValidEmail(form.email)) {
      setFeedback({ success: false, message: "Informe um e-mail válido." });
      return;
    }
    if (form.password.length < 8) {
      setFeedback({ success: false, message: "A senha deve ter pelo menos 8 caracteres." });
      return;
    }
    if (form.password !== form.confirmPassword) {
      setFeedback({ success: false, message: "A confirmação de senha não confere." });
      return;
    }

    setIsSubmitting(true);
    try {
      const recaptchaToken = isRecaptchaConfigured
        ? await executeRecaptcha("signup_complete")
        : "";
      const result = await onRegister(form, recaptchaToken);
      setFeedback(result);
      if (result.success) {
        onRegisterSuccess(form.email);
        setForm(initialRegisterForm);
      }
    } catch (error) {
      setFeedback(toErrorResult(error, "Não foi possível concluir o cadastro."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Criar cadastro"
      description="Preencha os dados da empresa para acessar o PDV."
      onBackToLogin={onOpenLogin}
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold text-text-primary">
            Nome da empresa
          </span>
          <div className="relative">
            <User
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-tertiary"
            />
            <input
              type="text"
              className="input-field w-full pl-10"
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              placeholder="Razão social ou nome fantasia"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-text-primary">
            CNPJ
          </span>
          <div className="relative">
            <Building2
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-tertiary"
            />
            <input
              type="text"
              inputMode="text"
              className="input-field w-full pl-10"
              value={form.cnpj}
              onChange={(event) => setField("cnpj", maskCnpj(event.target.value))}
              placeholder="00.000.000/0000-00"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-text-primary">
            Telefone
          </span>
          <div className="relative">
            <Phone
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-tertiary"
            />
            <input
              type="tel"
              className="input-field w-full pl-10"
              value={form.phone}
              onChange={(event) => setField("phone", maskPhoneBr(event.target.value))}
              placeholder="(00) 00000-0000"
            />
          </div>
        </label>
      </div>

      <EmailField
        value={form.email}
        onChange={(value) => setField("email", value)}
        onEnter={handleSubmit}
      />
      <PasswordField
        label="Senha"
        value={form.password}
        show={showPassword}
        onChange={(value) => setField("password", value)}
        onToggle={() => setShowPassword((current) => !current)}
        onEnter={handleSubmit}
      />
      <PasswordField
        label="Confirmar senha"
        value={form.confirmPassword}
        show={showPassword}
        onChange={(value) => setField("confirmPassword", value)}
        onToggle={() => setShowPassword((current) => !current)}
        onEnter={handleSubmit}
      />

      <LoadingButton
        type="button"
        onClick={handleSubmit}
        isLoading={isSubmitting}
        loadingLabel="Criando..."
        className="btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2"
      >
        <UserPlus size={16} />
        Criar cadastro
      </LoadingButton>

      <FeedbackMessage result={feedback} />
    </AuthLayout>
  );

  function setField(field: keyof RegisterFormPayload, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }
}

function toErrorResult(error: unknown, fallback: string): AuthActionResult {
  return {
    success: false,
    message: error instanceof Error ? error.message : fallback,
  };
}
