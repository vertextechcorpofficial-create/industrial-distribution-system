// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/api/customer-order-consumption.client.ts
// ============================================================
// Browser-side API client for Customer Order & Consumption Report.
// No direct DB or Directus tokens exposed in browser.
// ============================================================

import type {
  AppliedFilterContext,
  CustomerOrderConsumptionDetail,
  CustomerOrderConsumptionReportResponse,
  ReportLookupOption,
  ReportLookupResponse,
} from "../types/customer-order-consumption.types";

const REPORT_ENDPOINT = "/api/ids/crm/customer-reports/customer-order-and-consumption-report";
const LOOKUP_ENDPOINT = `${REPORT_ENDPOINT}/lookups`;

export class CustomerOrderConsumptionApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "CustomerOrderConsumptionApiError";
    this.code = code;
    this.status = status;
  }
}

type QueryValue = string | number | readonly (string | number)[] | undefined | null;

function buildQuery(values: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      const text = String(item).trim();
      if (text) params.append(key, text);
    }
  }
  return params.toString();
}

async function readJson<T>(response: Response): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new CustomerOrderConsumptionApiError(
      "NON_JSON_RESPONSE",
      "The server returned an unreadable response.",
      response.status
    );
  }

  if (!response.ok) {
    const errorPayload = payload as { code?: string; message?: string };
    throw new CustomerOrderConsumptionApiError(
      errorPayload.code ?? "REQUEST_FAILED",
      errorPayload.message ?? "Failed to fetch report data.",
      response.status
    );
  }

  return payload as T;
}

export async function fetchCustomerOrderConsumptionReportClient(
  filters: AppliedFilterContext,
  options: { signal?: AbortSignal } = {}
): Promise<CustomerOrderConsumptionReportResponse> {
  const query = buildQuery({
    startDate: filters.startDate,
    endDate: filters.endDate,
    customerCodes: filters.customerCodes,
    branchIds: filters.branchIds,
    salesmanIds: filters.salesmanIds,
    classificationIds: filters.classificationIds,
    categoryIds: filters.categoryIds,
    channel: filters.channel,
    search: filters.search,
    customerLabels: filters.customerLabels,
    branchLabels: filters.branchLabels,
    salesmanLabels: filters.salesmanLabels,
    classificationLabels: filters.classificationLabels,
    categoryLabels: filters.categoryLabels,
  });

  const response = await fetch(`${REPORT_ENDPOINT}?${query}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: options.signal,
  });

  return readJson<CustomerOrderConsumptionReportResponse>(response);
}

export async function fetchCustomerOrderConsumptionDetailClient(
  filters: AppliedFilterContext,
  customerCode: string,
  productId?: number,
  options: { signal?: AbortSignal } = {}
): Promise<CustomerOrderConsumptionDetail> {
  const query = buildQuery({
    startDate: filters.startDate,
    endDate: filters.endDate,
    customerDetail: customerCode,
    productDetail: productId,
    branchIds: filters.branchIds,
  });

  const response = await fetch(`${REPORT_ENDPOINT}?${query}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: options.signal,
  });

  return readJson<CustomerOrderConsumptionDetail>(response);
}

export async function fetchLookupOptionsClient(
  type: "customer" | "branch" | "salesman" | "classification" | "category" | "product",
  query?: string,
  branchId?: number,
  options: { signal?: AbortSignal } = {}
): Promise<ReportLookupOption[]> {
  const q = buildQuery({ type, query, branchId });
  const response = await fetch(`${LOOKUP_ENDPOINT}?${q}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: options.signal,
  });

  const payload = await readJson<ReportLookupResponse>(response);
  return payload.data ?? [];
}
