/**
 * Arquivo: src/pages/Auth/AuthLayout.tsx
 * Objetivo: padroniza o layout visual das telas públicas de login, cadastro e recuperação de senha.
 * Entradas esperadas: recebe conteúdo filho e textos de apoio exibidos no painel institucional.
 */
import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

type AuthLayoutProps = {
  title: string;
  description: string;
  children: ReactNode;
  onBackToLogin?: () => void;
};

export default function AuthLayout({
  title,
  description,
  children,
  onBackToLogin,
}: AuthLayoutProps) {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-bg-primary px-4 py-8 text-text-primary md:px-6 lg:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="auth-login-glow-secondary absolute -top-20 -left-10 h-52 w-52 rounded-full bg-secondary/25 blur-3xl" />
        <div className="auth-login-glow-accent absolute top-[42%] -right-12 h-56 w-56 rounded-full bg-accent/25 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(46,191,244,0.16),transparent_45%),radial-gradient(circle_at_90%_80%,rgba(32,171,213,0.14),transparent_48%)]" />
        <div className="absolute inset-0 opacity-[0.13] [background:linear-gradient(115deg,transparent_0%,transparent_48%,rgba(255,255,255,0.6)_50%,transparent_52%,transparent_100%)] bg-[length:14px_14px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <section className="card auth-login-card grid w-full overflow-hidden border-white/45 bg-white/85 backdrop-blur-sm lg:grid-cols-[0.9fr_1.1fr]">
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
              Acesse vendas, clientes, produtos, caixa e relatórios em um único painel.
            </p>
          </div>

          <div className="auth-login-reveal-1 bg-bg-light/92 p-6 sm:p-8">
            <div className="mx-auto w-full max-w-md">
              {onBackToLogin ? (
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-secondary"
                >
                  <ArrowLeft size={16} />
                  Voltar ao login
                </button>
              ) : null}

              <h2 className="auth-login-reveal-2 text-2xl font-bold text-text-primary">
                {title}
              </h2>
              <p className="auth-login-reveal-3 mt-1 text-sm text-text-secondary">
                {description}
              </p>

              <div className="auth-login-reveal-3 mt-6 space-y-4">{children}</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
