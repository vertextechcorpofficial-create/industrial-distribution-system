// ============================================================================
// Customer History — Zod Validation Schemas
// Validates all incoming API query parameters before entering services.
// ============================================================================

import { z } from "zod";
import { getCurrentMonthRange } from "../services/customer-history.helpers";
import type {
  CustomerHistoryFilters,
  DetailRangePreset,
} from "./customer-history.types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const customerHistoryFilterSchema = z
  .object({
    startDate: z
      .string()
      .regex(ISO_DATE_RE, "startDate must be YYYY-MM-DD")
      .optional(),
    endDate: z
      .string()
      .regex(ISO_DATE_RE, "endDate must be YYYY-MM-DD")
      .optional(),
    branchId: z.string().trim().min(1).optional().default("all"),
    productId: z.string().trim().min(1).optional().default("all"),
  })
  .transform((val): CustomerHistoryFilters => {
    const defaults = getCurrentMonthRange();
    const startDate = val.startDate ?? defaults.startDate;
    const endDate = val.endDate ?? defaults.endDate;
    return {
      startDate: startDate <= endDate ? startDate : endDate,
      endDate: endDate >= startDate ? endDate : startDate,
      branchId: val.branchId || "all",
      productId: val.productId || "all",
    };
  });

export const customerHistoryDetailSchema = z.object({
  customerCode: z.string().trim().min(1, "customerCode is required"),
  range: z
    .enum(["this_month", "12_months", "all"])
    .optional()
    .default("all") as z.ZodType<DetailRangePreset>,
});

export const customerHistoryLookupsSchema = z.object({
  type: z.enum(["branch", "product"]),
  q: z.string().trim().optional().default(""),
});

export function parseListFiltersFromSearchParams(
  params: URLSearchParams
): CustomerHistoryFilters {
  const raw = {
    startDate: params.get("startDate") ?? undefined,
    endDate: params.get("endDate") ?? undefined,
    branchId: params.get("branchId") ?? undefined,
    productId: params.get("productId") ?? undefined,
  };
  return customerHistoryFilterSchema.parse(raw);
}
