/**
 * Arquivo: src/pages/Auth/LoginPage.tsx
 * Objetivo: renderiza tela de autenticação do painel com validação básica e feedback local.
 * Entradas esperadas: recebe e-mail padrão e callback de autenticação para validar credenciais e abrir sessão.
 */

import { Eye, EyeOff, Lock, LogIn, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";

type LoginResult = {
  success: boolean;
  message: string;
};

type LoginPageProps = {
  defaultEmail: string;
  onLogin: (email: string, password: string) => LoginResult;
};

export default function LoginPage({ defaultEmail, onLogin }: LoginPageProps) {
  // Estado do formulário de autenticação.
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("Admin@1234");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  // Mensagem local de retorno da tentativa de login.
  const [feedback, setFeedback] = useState<LoginResult | null>(null);

  const handleSubmit = () => {
    // Validação mínima antes de delegar autenticação ao App.
    if (!email.trim() || !password.trim()) {
      setFeedback({
        success: false,
        message: "Informe e-mail e senha para entrar.",
      });
      return;
    }

    const result = onLogin(email, password);
    setFeedback(result);
  };

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-bg-primary px-4 py-8 text-text-primary md:px-6 lg:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="auth-login-glow-secondary absolute -top-20 -left-10 h-52 w-52 rounded-full bg-secondary/25 blur-3xl" />
        <div className="auth-login-glow-accent absolute top-[42%] -right-12 h-56 w-56 rounded-full bg-accent/25 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(46,191,244,0.16),transparent_45%),radial-gradient(circle_at_90%_80%,rgba(32,171,213,0.14),transparent_48%)]" />
        <div className="absolute inset-0 opacity-[0.13] [background:linear-gradient(115deg,transparent_0%,transparent_48%,rgba(255,255,255,0.6)_50%,transparent_52%,transparent_100%)] bg-[length:14px_14px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <section className="card auth-login-card grid w-full overflow-hidden border-white/45 bg-white/85 backdrop-blur-sm lg:grid-cols-[1.1fr_1fr]">
          <div className="hidden bg-gradient-to-br from-secondary to-accent p-8 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/80">
                <ShieldCheck size={13} />
                Hórus PDV
              </p>
              <h1 className="mt-4 text-3xl font-bold leading-tight">
                Gestão de vendas com fluxo rápido para operação de balcão.
              </h1>
            </div>

            <p className="text-sm text-white/85">
              Entre com sua conta para acessar pedidos, clientes, produtos e
              relatórios.
            </p>
          </div>

          <div className="auth-login-reveal-1 bg-bg-light/92 p-6 sm:p-8">
            <div className="mx-auto w-full max-w-md">
              <h2 className="auth-login-reveal-2 text-2xl font-bold text-text-primary">
                Fazer login
              </h2>
              <p className="auth-login-reveal-3 mt-1 text-sm text-text-secondary">
                Use seu e-mail e senha para acessar o painel.
              </p>

              <div className="auth-login-reveal-3 mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-text-primary">
                    E-mail
                  </span>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-tertiary"
                    />
                    <input
                      type="email"
                      className="input-field w-full pl-10"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="usuario@hpdv.com.br"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleSubmit();
                      }}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-text-primary">
                    Senha
                  </span>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-tertiary"
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      className="input-field w-full pl-10 pr-10"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleSubmit();
                      }}
                    />
                    <button
                      type="button"
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-text-secondary"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={
                        showPassword ? "Ocultar senha" : "Mostrar senha"
                      }
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                  />
                  Manter sessão conectada
                </label>

                {feedback ? (
                  <p
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      feedback.success
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-primary/30 bg-primary/10 text-primary"
                    }`}
                  >
                    {feedback.message}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={handleSubmit}
                  className="btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2"
                >
                  <LogIn size={16} />
                  Entrar
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
