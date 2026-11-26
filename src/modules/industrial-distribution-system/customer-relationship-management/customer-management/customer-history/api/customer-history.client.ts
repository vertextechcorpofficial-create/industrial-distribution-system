// ============================================================================
// Customer History — Client API Gateway
// Thin fetch wrappers with cache: "no-store" and AbortSignal support.
// ============================================================================

import type {
  CustomerHistoryDetailResponse,
  CustomerHistoryFilters,
  CustomerHistoryListResponse,
  DetailRangePreset,
  LookupOption,
} from "../types/customer-history.types";

export async function fetchCustomerHistoryListClient(
  filters: CustomerHistoryFilters,
  signal?: AbortSignal
): Promise<CustomerHistoryListResponse> {
  const params = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate,
    branchId: filters.branchId,
    productId: filters.productId,
  });

  const res = await fetch(`/api/ids/crm/customer-history?${params.toString()}`, {
    cache: "no-store",
    signal,
  });

  const json = await res.json();
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || `Failed to load customer history (${res.status})`);
  }
  return json as CustomerHistoryListResponse;
}

export async function fetchCustomerHistoryDetailClient(
  customerCode: string,
  range: DetailRangePreset,
  signal?: AbortSignal
): Promise<CustomerHistoryDetailResponse> {
  const params = new URLSearchParams({
    customerCode,
    range,
  });

  const res = await fetch(`/api/ids/crm/customer-history/detail?${params.toString()}`, {
    cache: "no-store",
    signal,
  });

  const json = await res.json();
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || `Failed to load customer detail (${res.status})`);
  }
  return json as CustomerHistoryDetailResponse;
}

export async function fetchCustomerHistoryLookupsClient(
  type: "branch" | "product",
  signal?: AbortSignal
): Promise<LookupOption[]> {
  const params = new URLSearchParams({ type });
  const res = await fetch(`/api/ids/crm/customer-history/lookups?${params.toString()}`, {
    cache: "no-store",
    signal,
  });

  const json = await res.json();
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || `Failed to load ${type} options`);
  }
  return (json.options ?? []) as LookupOption[];
}
