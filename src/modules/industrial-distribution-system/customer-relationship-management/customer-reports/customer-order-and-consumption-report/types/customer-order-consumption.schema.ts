// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/types/customer-order-consumption.schema.ts
// ============================================================
// Zod schemas for query validation, filter parsing, and drill-down requests.
// Placement: CRM -> Customer Reports -> Customer Order & Consumption Report
// ============================================================

import { z } from "zod";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const dateStringSchema = z
  .string()
  .regex(DATE_REGEX, "Must be an ISO date (YYYY-MM-DD).");

export const consumptionChannelSchema = z.enum(["CYLINDER", "LPG"]);

export const customerOrderConsumptionFilterSchema = z.object({
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  customerCodes: z.array(z.string().min(1)).optional(),
  branchIds: z.array(z.number().int().positive()).optional(),
  salesmanIds: z.array(z.number().int().positive()).optional(),
  classificationIds: z.array(z.number().int().positive()).optional(),
  categoryIds: z.array(z.number().int().positive()).optional(),
  channel: consumptionChannelSchema.optional(),
  search: z.string().max(100).optional(),
}).refine(
  (data) => data.startDate <= data.endDate,
  {
    message: "startDate must not be after endDate.",
    path: ["startDate"],
  }
);

export const customerOrderConsumptionDetailSchema = customerOrderConsumptionFilterSchema.extend({
  customerDetail: z.string().min(1, "customerDetail must be a customer code."),
  // Positive IDs identify serialized cylinder products; -1 = Metered LPG, -2 = WIWO (Kg) LPG
  productDetail: z.number().int().refine((n) => n !== 0, "Invalid product ID.").optional(),
});

export const reportLookupQuerySchema = z.object({
  type: z.enum(["customer", "branch", "salesman", "classification", "category", "product"]),
  query: z.string().max(100).optional(),
  branchId: z.coerce.number().int().positive().optional(),
});

export type ValidatedFilterInput = z.infer<typeof customerOrderConsumptionFilterSchema>;
export type ValidatedDetailInput = z.infer<typeof customerOrderConsumptionDetailSchema>;
export type ValidatedLookupQuery = z.infer<typeof reportLookupQuerySchema>;

/**
 * Safely parses list params from URLSearchParams (repeated keys).
 */
export function readStringList(params: URLSearchParams, key: string): string[] {
  return params
    .getAll(key)
    .flatMap((val) => val.split(","))
    .map((val) => val.trim())
    .filter(Boolean);
}

export function readNumberList(params: URLSearchParams, key: string): number[] {
  return readStringList(params, key)
    .map((val) => Number.parseInt(val, 10))
    .filter((num) => Number.isFinite(num) && num > 0);
}

export function readLabelList(params: URLSearchParams, field: string): string[] {
  return readStringList(params, field).slice(0, 50);
}

export function readFilterParams(params: URLSearchParams): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  const start = params.get("startDate");
  if (start) result.startDate = start.trim();

  const end = params.get("endDate");
  if (end) result.endDate = end.trim();

  const channel = params.get("channel");
  if (channel) result.channel = channel.trim();

  const search = params.get("search");
  if (search) result.search = search.trim();

  const customerDetail = params.get("customerDetail");
  if (customerDetail) result.customerDetail = customerDetail.trim();

  const productDetail = params.get("productDetail");
  if (productDetail) {
    const num = Number.parseInt(productDetail, 10);
    if (Number.isFinite(num) && num !== 0) result.productDetail = num;
  }

  const customerCodes = readStringList(params, "customerCodes");
  if (customerCodes.length > 0) result.customerCodes = customerCodes;

  const branchIds = readNumberList(params, "branchIds");
  if (branchIds.length > 0) result.branchIds = branchIds;

  const salesmanIds = readNumberList(params, "salesmanIds");
  if (salesmanIds.length > 0) result.salesmanIds = salesmanIds;

  const classificationIds = readNumberList(params, "classificationIds");
  if (classificationIds.length > 0) result.classificationIds = classificationIds;

  const categoryIds = readNumberList(params, "categoryIds");
  if (categoryIds.length > 0) result.categoryIds = categoryIds;

  return result;
}
