// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/services/customer-order-consumption.lookups.ts
// ============================================================
// Filter-bar typeahead lookups.
// Enforces rules:
// - branch: division_id = 1
// - category: is_industrial = 1
// - product: is_serialized = 1 (label uses products.description)
// ============================================================

import type {
  RawBranchRow,
  RawCategoryRow,
  RawClassificationRow,
  RawCustomerRow,
  RawProductRow,
  RawSalesmanRow,
  ReportLookupOption,
} from "../types/customer-order-consumption.types";
import { type DirectusConfig, fetchDirectusRows, resolveDirectusConfig } from "./directus";

export interface LookupOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  config?: Partial<DirectusConfig>;
}

export async function fetchReportLookupOptions(
  params: { type: string; query?: string; branchId?: number },
  options: LookupOptions = {}
): Promise<ReportLookupOption[]> {
  const config = resolveDirectusConfig();
  const mergedConfig: DirectusConfig = { ...config, ...options.config };
  const query = (params.query ?? "").trim().toLowerCase();

  const read = <T>(collection: string, queryParams: { fields: string; filter?: Record<string, unknown>; limit?: number }) =>
    fetchDirectusRows<T>(
      collection,
      { ...queryParams, fetchImpl: options.fetchImpl, signal: options.signal },
      mergedConfig
    );

  if (params.type === "branch") {
    // division_id = 1 per ids-guide
    const rows = await read<RawBranchRow>("branches", {
      fields: "id,branch_name,branch_code",
      filter: { division_id: { _eq: 1 }, isActive: { _eq: 1 } },
      limit: 100,
    });
    return rows
      .filter((b) => !query || b.branch_name.toLowerCase().includes(query) || b.branch_code.toLowerCase().includes(query))
      .map((b) => ({
        value: String(b.id),
        label: `${b.branch_name} (${b.branch_code})`,
        code: b.branch_code,
      }));
  }

  if (params.type === "category") {
    // is_industrial = 1 per ids-guide
    const rows = await read<RawCategoryRow>("categories", {
      fields: "category_id,category_name",
      filter: { is_industrial: { _eq: 1 } },
      limit: 100,
    });
    return rows
      .filter((c) => !query || c.category_name.toLowerCase().includes(query))
      .map((c) => ({
        value: String(c.category_id),
        label: c.category_name,
        code: String(c.category_id),
      }));
  }

  if (params.type === "product") {
    // Parent serialized products only (is_serialized = 1, parent_id IS NULL) per ids-guide
    const rows = await read<RawProductRow>("products", {
      fields: "product_id,parent_id,product_code,product_name,description",
      filter: { is_serialized: { _eq: 1 }, parent_id: { _null: true } },
      limit: -1,
    });
    return rows
      .filter(
        (p) =>
          !query ||
          (p.description && p.description.toLowerCase().includes(query)) ||
          (p.product_name && p.product_name.toLowerCase().includes(query)) ||
          (p.product_code && p.product_code.toLowerCase().includes(query))
      )
      .map((p) => ({
        value: String(p.product_id),
        // Product display label combines description and code per ids-guide
        label: `${p.description || p.product_name || "Product"} (${p.product_code ?? p.product_id})`,
        code: p.product_code ?? String(p.product_id),
      }));
  }

  if (params.type === "customer") {
    const rows = await read<RawCustomerRow>("customer", {
      fields: "id,customer_code,customer_name,store_name",
      limit: 250,
    });
    return rows
      .filter(
        (c) =>
          !query ||
          (c.customer_name && c.customer_name.toLowerCase().includes(query)) ||
          (c.customer_code && c.customer_code.toLowerCase().includes(query)) ||
          (c.store_name && c.store_name.toLowerCase().includes(query))
      )
      .map((c) => ({
        value: c.customer_code,
        label: `${c.customer_name || "Customer"} (${c.customer_code})${c.store_name ? ` - ${c.store_name}` : ""}`,
        code: c.customer_code,
      }));
  }

  if (params.type === "salesman") {
    const rows = await read<RawSalesmanRow>("salesman", {
      fields: "id,salesman_code,salesman_name",
      limit: 100,
    });
    return rows
      .filter((s) => !query || s.salesman_name.toLowerCase().includes(query) || s.salesman_code.toLowerCase().includes(query))
      .map((s) => ({
        value: String(s.id),
        label: `${s.salesman_name} (${s.salesman_code})`,
        code: s.salesman_code,
      }));
  }

  if (params.type === "classification") {
    const rows = await read<RawClassificationRow>("customer_classification", {
      fields: "id,classification_name",
      limit: 100,
    });
    return rows
      .filter((cl) => !query || cl.classification_name.toLowerCase().includes(query))
      .map((cl) => ({
        value: String(cl.id),
        label: cl.classification_name,
        code: String(cl.id),
      }));
  }

  return [];
}
