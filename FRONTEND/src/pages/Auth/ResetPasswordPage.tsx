import { KeyRound } from "lucide-react";
import { useState } from "react";
import useRecaptchaV3 from "@/hooks/Security/useRecaptchaV3";
import AuthLayout from "./AuthLayout";
import { FeedbackMessage, PasswordField } from "./AuthFields";
import type { AuthActionResult } from "./types";

type ResetPasswordPageProps = {
  initialToken: string;
  onResetPassword: (
    token: string,
    nextPassword: string,
    confirmPassword: string,
    recaptchaToken?: string,
  ) => Promise<AuthActionResult>;
  onOpenLogin: () => void;
};

export default function ResetPasswordPage({
  initialToken,
  onResetPassword,
  onOpenLogin,
}: ResetPasswordPageProps) {
  const { executeRecaptcha, isRecaptchaConfigured } = useRecaptchaV3();
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<AuthActionResult | null>(null);

  const handleSubmit = async () => {
    if (!token.trim()) {
      setFeedback({ success: false, message: "Informe o token de redefinição." });
      return;
    }
    if (password.length < 8) {
      setFeedback({
        success: false,
        message: "A nova senha deve ter pelo menos 8 caracteres.",
      });
      return;
    }
    if (password !== confirmPassword) {
      setFeedback({ success: false, message: "A confirmação de senha não confere." });
      return;
    }

    setIsSubmitting(true);
    try {
      const recaptchaToken = isRecaptchaConfigured
        ? await executeRecaptcha("password_reset")
        : "";
      const result = await onResetPassword(token, password, confirmPassword, recaptchaToken);
      setFeedback(result);
      if (result.success) {
        setPassword("");
        setConfirmPassword("");
        setToken("");
        onOpenLogin();
      }
    } catch (error) {
      setFeedback(toErrorResult(error, "Não foi possível redefinir a senha."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Redefinir senha"
      description="Crie uma nova senha para voltar ao painel."
      onBackToLogin={onOpenLogin}
    >
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-text-primary">
          Token
        </span>
        <div className="relative">
          <KeyRound
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="text"
            className="input-field w-full pl-10"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Token recebido"
          />
        </div>
      </label>

      <PasswordField
        label="Nova senha"
        value={password}
        show={showPassword}
        onChange={setPassword}
        onToggle={() => setShowPassword((current) => !current)}
        onEnter={handleSubmit}
      />
      <PasswordField
        label="Confirmar senha"
        value={confirmPassword}
        show={showPassword}
        onChange={setConfirmPassword}
        onToggle={() => setShowPassword((current) => !current)}
        onEnter={handleSubmit}
      />

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2"
      >
        <KeyRound size={16} />
        {isSubmitting ? "Salvando..." : "Redefinir senha"}
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
