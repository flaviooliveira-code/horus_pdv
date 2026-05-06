import { KeyRound } from "lucide-react";
import { useState } from "react";
import useRecaptchaV3 from "@/hooks/Security/useRecaptchaV3";
import { isValidCnpj, isValidEmail } from "@/utils/validators";
import AuthLayout from "./AuthLayout";
import { CnpjField, EmailField, FeedbackMessage } from "./AuthFields";
import type { AuthActionResult } from "./types";

type ForgotPasswordPageProps = {
  defaultEmail: string;
  onForgotPassword: (
    cnpj: string,
    email: string,
    recaptchaToken?: string,
  ) => Promise<AuthActionResult>;
  onOpenLogin: () => void;
  onOpenResetPassword: (token: string) => void;
};

export default function ForgotPasswordPage({
  defaultEmail,
  onForgotPassword,
  onOpenLogin,
  onOpenResetPassword,
}: ForgotPasswordPageProps) {
  const { executeRecaptcha, isRecaptchaConfigured } = useRecaptchaV3();
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<AuthActionResult | null>(null);

  const handleSubmit = async () => {
    if (!isValidCnpj(cnpj)) {
      setFeedback({ success: false, message: "Informe um CNPJ válido." });
      return;
    }
    if (!email.trim() || !isValidEmail(email)) {
      setFeedback({ success: false, message: "Informe um e-mail válido." });
      return;
    }

    setIsSubmitting(true);
    try {
      const recaptchaToken = isRecaptchaConfigured
        ? await executeRecaptcha("password_forgot_request")
        : "";
      const result = await onForgotPassword(cnpj, email, recaptchaToken);
      setFeedback(result);
      if (result.success && result.data?.resetToken) {
        onOpenResetPassword(result.data.resetToken);
      }
    } catch (error) {
      setFeedback(toErrorResult(error, "Não foi possível solicitar a recuperação de senha."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Recuperar senha"
      description="Informe CNPJ e e-mail para receber instruções de redefinição de senha."
      onBackToLogin={onOpenLogin}
    >
      <CnpjField value={cnpj} onChange={setCnpj} onEnter={handleSubmit} />
      <EmailField value={email} onChange={setEmail} onEnter={handleSubmit} />

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2"
      >
        <KeyRound size={16} />
        {isSubmitting ? "Enviando..." : "Enviar e-mail"}
      </button>

      <FeedbackMessage result={feedback} />
    </AuthLayout>
  );
}

function toErrorResult(error: unknown, fallback: string): AuthActionResult {
  return {
    success: false,
    message: error instanceof Error ? error.message : fallback,
  };
}
