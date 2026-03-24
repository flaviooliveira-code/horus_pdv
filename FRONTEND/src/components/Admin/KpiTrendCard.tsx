/**
 * Arquivo: src/components/Admin/KpiTrendCard.tsx
 * Objetivo: renderiza card de KPI com valor, legenda e mini gráfico SVG de tendência.
 * Entradas esperadas: recebe rótulo, valor, dica, cor e série numérica de tendência.
 */

import { memo } from "react";

export type KpiTrendCardProps = {
  label: string;
  value: string;
  hint: string;
  color: string;
  trend: number[];
  valueClassName?: string;
  className?: string;
};

const CHART_WIDTH = 160;
const CHART_HEIGHT = 48;
const CHART_PADDING = 4;

const toSafeGradientId = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

const buildTrendPath = (trend: number[]) => {
  if (!trend.length) return { linePath: "", areaPath: "" };

  const minValue = Math.min(...trend);
  const maxValue = Math.max(...trend);
  const valueRange = maxValue - minValue || 1;
  const innerWidth = CHART_WIDTH - CHART_PADDING * 2;
  const innerHeight = CHART_HEIGHT - CHART_PADDING * 2;

  const points = trend.map((value, index) => {
    const ratioX = trend.length === 1 ? 0.5 : index / (trend.length - 1);
    const x = CHART_PADDING + ratioX * innerWidth;
    const normalized = (value - minValue) / valueRange;
    const y = CHART_PADDING + (1 - normalized) * innerHeight;
    return { x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const baseY = CHART_HEIGHT - CHART_PADDING;
  const areaPath = `${linePath} L${lastPoint.x},${baseY} L${firstPoint.x},${baseY} Z`;

  return { linePath, areaPath };
};

function KpiTrendCard({
  label,
  value,
  hint,
  color,
  trend,
  valueClassName = "text-text-primary",
  className,
}: KpiTrendCardProps) {
  const gradientId = `kpi-trend-${toSafeGradientId(label)}`;
  const { linePath, areaPath } = buildTrendPath(trend);

  return (
    <article className={`card min-w-0 rounded-2xl p-4 ${className ?? ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {label}
      </p>
      <p className={`mt-1 text-lg font-bold md:text-2xl ${valueClassName}`}>{value}</p>
      <p className="mt-1 text-xs text-text-secondary">{hint}</p>
      <div className="mt-3 h-12 w-full min-w-0">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="h-full w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Tendência do indicador ${label}`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.22} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path d={linePath} fill="none" stroke={color} strokeWidth={2} />
        </svg>
      </div>
    </article>
  );
}

export default memo(KpiTrendCard);
