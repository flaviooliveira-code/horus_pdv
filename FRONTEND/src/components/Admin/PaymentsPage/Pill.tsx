/**
 * Arquivo: src/components/Admin/PaymentsPage/Pill.tsx
 * Objetivo: renderiza etiqueta de status com o tom de cor do sistema.
 * Entradas esperadas: recebe tom e conteúdo da etiqueta.
 */
import type { ReactNode } from "react";
import type { Tone } from "./types";

const TONE_CLASS: Record<Tone, string> = {
  success: "border-success/30 bg-success/10 text-success",
  danger: "border-primary/30 bg-primary/10 text-primary",
  info: "border-accent/40 bg-accent/10 text-accent",
  brand: "border-secondary/30 bg-secondary/10 text-secondary",
  muted: "border-border-primary bg-bg-gray-theme text-text-secondary",
};

export default function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}
