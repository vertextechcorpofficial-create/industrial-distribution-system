// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/services/customer-order-consumption.helpers.ts
// ============================================================
// Formatting, date extraction, math guards, and helpers.
// No LaTeX formatting used per user guidelines.
// ============================================================

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function isTruthyFlag(value: unknown): boolean {
  return value === 1 || value === "1" || value === true || value === "true";
}

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function safeRatio(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0 || !Number.isFinite(denominator)) {
    return 0;
  }
  const ratio = numerator / denominator;
  return Number.isFinite(ratio) ? Math.round(ratio * 100) / 100 : 0;
}

export function dateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match ? match[1] : null;
}

export function monthKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2})/.exec(value.trim());
  return match ? match[1] : null;
}

export function normalizeStatus(status: string | null | undefined): string {
  return (status ?? "").trim().toLowerCase();
}

export function computeReturnRate(returnedKg: number, grossKg: number): number {
  if (grossKg <= 0) return 0;
  return safeRatio(returnedKg * 100, grossKg);
}

export function formatAmount(value: number | null | undefined): string {
  const num = toNumber(value, 0);
  return `PHP ${num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatKgCompact(value: number | null | undefined): string {
  const num = toNumber(value, 0);
  return `${num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kg`;
}

export function formatQty(value: number | null | undefined): string {
  const num = Math.round(toNumber(value, 0));
  return num.toLocaleString("en-PH");
}

export function formatPercent(value: number | null | undefined): string {
  const num = toNumber(value, 0);
  return `${num.toFixed(1)}%`;
}
