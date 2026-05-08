/**
 * Arquivo: src/components/Loading/LoadingButton.tsx
 * Objetivo: padronizar feedback de carregamento em ações assíncronas acionadas por botão.
  * Entradas esperadas: recebe props nativas de botão, estado de carregamento e conteúdo visual.
*/
import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  loadingLabel?: ReactNode;
  children: ReactNode;
};

export default function LoadingButton({
  isLoading = false,
  loadingLabel,
  children,
  className = "",
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <button
      {...props}
      disabled={isLoading || disabled}
      className={`${className} ${isLoading ? "cursor-not-allowed opacity-80" : ""}`.trim()}
    >
      {isLoading ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}
      {isLoading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
