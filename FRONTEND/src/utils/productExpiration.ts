/**
 * Arquivo: src/utils/productExpiration.ts
 * Objetivo: utilitário puro para calcular validade a partir da data de fabricação (ex.: 30 dias),
 *           formatar datas e classificar produtos vencidos ou prestes a vencer (compátivel com Node --test).
 */

export const EXPIRING_ALERT_DAYS = 7;
export const DEFAULT_SHELF_LIFE_DAYS = 30;

export type ExpirationMode = "" | "FIXED_DATE" | "DAYS_FROM_MANUFACTURE";
export type ExpirationStatus = "NONE" | "OK" | "EXPIRING_SOON" | "EXPIRED";

export type ExpirationEvaluation = {
  status: ExpirationStatus;
  daysUntilExpiration: number | null;
  formattedDate: string;
  label: string;
};

export function getTodayIsoDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDateParts(isoDate?: string): { year: number; month: number; day: number } | null {
  if (!isoDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const parts = parseIsoDateParts(isoDate);
  if (!parts || !Number.isFinite(days)) return "";
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day + Math.trunc(days));
  const next = new Date(utc);
  const year = next.getUTCFullYear();
  const month = String(next.getUTCMonth() + 1).padStart(2, "0");
  const day = String(next.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatIsoDateBr(isoDate?: string): string {
  const parts = parseIsoDateParts(isoDate);
  if (!parts) return "";
  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}/${parts.year}`;
}

export function computeEffectiveExpirationDate(params: {
  expirationMode?: string;
  manufactureDate?: string;
  shelfLifeDays?: number | null;
  expirationDate?: string;
}): string {
  if (params.expirationMode === "DAYS_FROM_MANUFACTURE") {
    const baseDate = params.manufactureDate?.trim() || "";
    const days = params.shelfLifeDays && params.shelfLifeDays > 0
      ? params.shelfLifeDays
      : DEFAULT_SHELF_LIFE_DAYS;
    return baseDate ? addDaysToIsoDate(baseDate, days) : "";
  }
  if (params.expirationMode === "FIXED_DATE") {
    return params.expirationDate?.trim() || "";
  }
  return params.expirationDate?.trim() || "";
}

export function evaluateProductExpiration(
  expirationDate?: string,
  referenceIso = getTodayIsoDate(),
  alertDays = EXPIRING_ALERT_DAYS,
): ExpirationEvaluation {
  const expParts = parseIsoDateParts(expirationDate);
  const refParts = parseIsoDateParts(referenceIso);
  if (!expParts || !refParts) {
    return {
      status: "NONE",
      daysUntilExpiration: null,
      formattedDate: "",
      label: "",
    };
  }

  const expMs = Date.UTC(expParts.year, expParts.month - 1, expParts.day);
  const refMs = Date.UTC(refParts.year, refParts.month - 1, refParts.day);
  const days = Math.round((expMs - refMs) / 86_400_000);
  const formattedDate = formatIsoDateBr(expirationDate);

  if (days < 0) {
    const absDays = Math.abs(days);
    return {
      status: "EXPIRED",
      daysUntilExpiration: days,
      formattedDate,
      label: absDays === 1 ? "Vencido há 1 dia" : `Vencido há ${absDays} dias`,
    };
  }

  if (days === 0) {
    return {
      status: "EXPIRING_SOON",
      daysUntilExpiration: 0,
      formattedDate,
      label: "Vence hoje",
    };
  }

  if (days <= alertDays) {
    return {
      status: "EXPIRING_SOON",
      daysUntilExpiration: days,
      formattedDate,
      label: days === 1 ? "Vence amanhã" : `Vence em ${days} dias`,
    };
  }

  return {
    status: "OK",
    daysUntilExpiration: days,
    formattedDate,
    label: `Vence em ${days} dias`,
  };
}
