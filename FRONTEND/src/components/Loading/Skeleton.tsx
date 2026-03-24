/**
 * Arquivo: src/components/Loading/Skeleton.tsx
 * Objetivo: renderiza placeholder visual para estados de carregamento de blocos da interface.
 * Entradas esperadas: recebe classes opcionais de estilo e flag para formato circular.
 */

type SkeletonProps = {
  className?: string;
  circle?: boolean;
};

export default function Skeleton({ className = "", circle = false }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-bg-gray-theme ${circle ? "rounded-full" : "rounded-md"} ${className}`.trim()}
      aria-hidden="true"
    />
  );
}
