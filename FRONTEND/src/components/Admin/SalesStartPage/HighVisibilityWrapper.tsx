/**
 * Arquivo: src/components/Admin/SalesStartPage/HighVisibilityWrapper.tsx
 * Objetivo: envolve a frente de caixa aplicando o escopo .pdv-high-visibility (WCAG AAA e +50% escala).
 * Entradas esperadas: flag booleana enabled e conteúdo filho.
 */
import type { ReactNode } from "react";

type HighVisibilityWrapperProps = {
  enabled: boolean;
  children: ReactNode;
  className?: string;
};

export default function HighVisibilityWrapper({
  enabled,
  children,
  className = "",
}: HighVisibilityWrapperProps) {
  return (
    <div
      data-pdv-high-visibility={enabled ? "true" : "false"}
      className={`${enabled ? "pdv-high-visibility" : ""} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
