// ============================================================================
// Customer History — Pure Formatting, Date & Comparator Helpers
// Rule: Fallback to "-" ONLY when data truly does not exist.
// Numeric 0 and boolean false are real values and must never become "-".
// ============================================================================

import type { DetailRangePreset } from "../types/customer-history.types";

/**
 * Formats a value for display, falling back to "-" only when truly absent.
 * Treats null, undefined, whitespace-only strings, and legacy DB default '0'
 * strings (on text columns like customer_name/contact_number) as absent.
 * Numeric 0 is preserved as "0".
 */
export function display(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "-";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "0") return "-";
    return trimmed;
  }
  return String(value);
}

/**
 * Safely coerces an unknown numeric value (number or numeric string) to a number.
 * Returns null if the value is empty, null, undefined, or non-finite.
 */
export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Safely coerces an unknown value to a finite number, defaulting to 0.
 */
export function toNumberZero(value: unknown): number {
  return toNumberOrNull(value) ?? 0;
}

/**
 * Evaluates Directus bit/tinyint/boolean flags consistently.
 */
export function isTruthyFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "1" || s === "true";
  }
  if (value && typeof value === "object" && "data" in value) {
    // Handle Buffer-like bit(1) serialization from MySQL/Directus if present
    const arr = (value as { data?: number[] }).data;
    return Array.isArray(arr) && arr[0] === 1;
  }
  return false;
}

/**
 * Formats a date/timestamp string into a clean wall-clock date label.
 * Directus serialises naive datetimes with a trailing "Z" or space separator.
 * Returns "-" when the date is genuinely missing or unparseable.
 */
export function formatDateDisplay(value: string | null | undefined): string {
  if (!value) return "-";
  const cleaned = value.trim();
  if (!cleaned) return "-";
  const datePart = cleaned.slice(0, 10);
  const parsed = new Date(`${datePart}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return cleaned;
  return parsed.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

/**
 * Formats a timestamp with date and time for timelines and audit logs.
 */
export function formatDateTimeDisplay(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return formatDateDisplay(value);
  return parsed.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formats currency or returns "-" when null/undefined.
 */
export function formatCurrencyOrDash(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Returns YYYY-MM-DD bounds for the current calendar month (1st -> today).
 * Used as the default date filter on page load.
 */
export function getCurrentMonthRange(now: Date = new Date()): {
  startDate: string;
  endDate: string;
} {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return {
    startDate: `${year}-${month}-01`,
    endDate: `${year}-${month}-${day}`,
  };
}

/**
 * Resolves a DetailRangePreset into optional YYYY-MM-DD bounds.
 */
export function resolveDetailRangeBounds(
  preset: DetailRangePreset,
  now: Date = new Date()
): { startDate?: string; endDate?: string } {
  if (preset === "all") return {};
  if (preset === "this_month") return getCurrentMonthRange(now);

  // "12_months": 12 calendar months back to the 1st of that month
  const endYear = now.getFullYear();
  const endMonth = String(now.getMonth() + 1).padStart(2, "0");
  const endDay = String(now.getDate()).padStart(2, "0");

  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const startYear = start.getFullYear();
  const startMonth = String(start.getMonth() + 1).padStart(2, "0");

  return {
    startDate: `${startYear}-${startMonth}-01`,
    endDate: `${endYear}-${endMonth}-${endDay}`,
  };
}

/**
 * Extracts a comparable YYYY-MM-DD key from a timestamp or date string.
 */
export function extractDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length < 10) return null;
  const key = trimmed.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

/**
 * Checks whether a timestamp/date falls within [startDate, endDate] inclusive.
 */
export function isWithinDateWindow(
  value: string | null | undefined,
  startDate?: string,
  endDate?: string
): boolean {
  if (!startDate && !endDate) return true;
  const key = extractDateKey(value);
  if (!key) return false;
  if (startDate && key < startDate) return false;
  if (endDate && key > endDate) return false;
  return true;
}

/**
 * Generic null-safe comparator for sortable table columns.
 */
export function compareValues(
  a: unknown,
  b: unknown,
  direction: "asc" | "desc"
): number {
  const mult = direction === "asc" ? 1 : -1;
  const aEmpty = a === null || a === undefined || a === "" || a === "-";
  const bEmpty = b === null || b === undefined || b === "" || b === "-";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1; // Always push missing values to bottom
  if (bEmpty) return -1;

  if (typeof a === "number" && typeof b === "number") {
    return (a - b) * mult;
  }

  const aStr = String(a).toLowerCase();
  const bStr = String(b).toLowerCase();
  if (aStr < bStr) return -1 * mult;
  if (aStr > bStr) return 1 * mult;
  return 0;
}

/**
 * Extracts lat/lon coordinates from a Directus GeoJSON Point or string.
 */
export function formatPointLocation(value: unknown): string {
  if (!value) return "-";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed && trimmed !== "0" ? trimmed : "-";
  }
  if (typeof value === "object") {
    const coords = (value as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const lon = toNumberOrNull(coords[0]);
      const lat = toNumberOrNull(coords[1]);
      if (lat !== null && lon !== null) {
        return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      }
    }
  }
  return "-";
}
