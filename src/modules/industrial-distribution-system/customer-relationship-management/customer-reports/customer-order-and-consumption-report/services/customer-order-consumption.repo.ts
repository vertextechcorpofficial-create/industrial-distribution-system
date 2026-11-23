// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/services/customer-order-consumption.repo.ts
// ============================================================
// I/O Data Layer via Directus REST.
// Pure reading layer — no writes, no mutations.
// Applies IDS guidelines:
// - products: filtered by is_serialized = 1
// - branches: filtered by division_id = 1
// - categories: filtered by is_industrial = 1
// - resilient reads with .catch(() => []) for zero-crash stability
// ============================================================

import type {
  AppliedFilterContext,
  ConsumptionSourceData,
  CustomerOrderConsumptionFilters,
  RawBranchRow,
  RawCategoryRow,
  RawClassificationRow,
  RawCustomerRow,
  RawInvoiceDetailRow,
  RawInvoiceRow,
  RawLpgHeaderInvoiceRow,
  RawLpgSiteRow,

  RawMeterReadingRow,

  RawProductRow,
  RawReturnDetailRow,
  RawReturnLinkRow,
  RawReturnRow,
  RawSalesOrderDetailRow,
  RawSalesOrderRow,
  RawSalesOrderSerialRow,

  RawSalesmanRow,
  RawUnifiedLpgRow,
  RawUnitRow,
  RawUnfulfilledDetailRow,
  RawUnfulfilledTransactionRow,
  RawWeightUnitRow,
  RawWiwoDetailRow,
  RawWiwoHeaderRow,
  SupportingDocument,
} from "../types/customer-order-consumption.types";
import {
  type DirectusConfig,
  type DirectusFetchOptions,
  chunk,
  fetchDirectusRows,
  resolveDirectusConfig,
} from "./directus";
import {  isTruthyFlag, normalizeStatus, toNumber } from "./customer-order-consumption.helpers";
import { resolveCylinderSizeKg } from "./customer-order-consumption.cylinder-calc";
import {
  classifyUnifiedLpgTransaction,
  LPG_METERED_PRODUCT_ID,
  LPG_WIWO_PRODUCT_ID,
} from "./customer-order-consumption.lpg-calc";

export interface RepoOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  config?: Partial<DirectusConfig>;
}

function windowFilter(
  column: string,
  filters: CustomerOrderConsumptionFilters,
  timeStamped: boolean
): Record<string, unknown> {
  const start = timeStamped ? `${filters.startDate}T00:00:00` : filters.startDate;
  const end = timeStamped ? `${filters.endDate}T23:59:59` : filters.endDate;
  return { [column]: { _gte: start, _lte: end } };
}

function selectedIn(
  column: string,
  values?: readonly (string | number)[]
): Record<string, unknown> {
  if (!values || values.length === 0) return {};
  return { [column]: { _in: [...values] } };
}

function flatten<T>(batches: T[][]): T[] {
  return batches.reduce<T[]>((all, rows) => all.concat(rows), []);
}

export async function fetchCustomerOrderConsumptionSources(
  filters: CustomerOrderConsumptionFilters,
  options: RepoOptions = {}
): Promise<ConsumptionSourceData> {
  const config = resolveDirectusConfig();
  const mergedConfig: DirectusConfig = { ...config, ...options.config };

  const read = <T>(collection: string, query: Omit<DirectusFetchOptions, "signal" | "fetchImpl">) =>
    fetchDirectusRows<T>(
      collection,
      { ...query, fetchImpl: options.fetchImpl, signal: options.signal },
      mergedConfig
    );

  // 1. Fetch Masters
  const [branches, categories, products, customers, classifications, salesmen, units, weightUnits, lpgSites] =
    await Promise.all([
      // Branch filter: division_id = 1 per ids-guide
      read<RawBranchRow>("branches", {
        fields: "id,branch_name,branch_code,division_id,isActive",
        filter: { division_id: { _eq: 1 }, isActive: { _eq: 1 } },
      }),
      // Categories filter: is_industrial = 1 per ids-guide
      read<RawCategoryRow>("categories", {
        fields: "category_id,category_name,is_industrial",
        filter: { is_industrial: { _eq: 1 } },
      }),
      // Products filter: is_serialized = 1 per ids-guide (includes parent_id to filter parent products only)
      read<RawProductRow>("products", {
        fields:
          "product_id,parent_id,uom_ids,product_code,product_name,description,product_weight,weight,weight_unit_id,is_serialized,product_category,density_factor",
        filter: { is_serialized: { _eq: 1 } },
      }),
      // Customer: primary key is id, no branch_id on customer table
      read<RawCustomerRow>("customer", {
        fields: "id,customer_code,customer_name,store_name,classification",
      }),
      read<RawClassificationRow>("customer_classification", {
        fields: "id,classification_name",
      }).catch(() => []),
      read<RawSalesmanRow>("salesman", {
        fields: "id,salesman_code,salesman_name",
      }).catch(() => []),
      read<RawUnitRow>("units", {
        fields: "unit_id,unit_name,unit_shortcut",
      }).catch(() => []),
      read<RawWeightUnitRow>("weight_unit", {
        fields: "id,code,name",
      }).catch(() => []),
      read<RawLpgSiteRow>("lpg_customer_lpg_sites", {
        fields: "id,customer_code,site_name,billing_mode",
        filter: { is_active: { _neq: 0 } },
      }).catch(() => []),
    ]);

  const customerFilter = selectedIn("customer_code", filters.customerCodes);

  // Strictly scope queries to authorized industrial branches (division_id = 1) per ids-guide.
  // When explicit branchIds are selected, intersect with authorized branches so non-industrial
  // or null-branch rows (which previously rendered as "All Branches") are never fetched.
  const authorizedBranchIds = branches
    .map((b) => Number(b.id))
    .filter((id) => Number.isFinite(id) && id > 0);
  const authorizedBranchSet = new Set(authorizedBranchIds);
  const effectiveBranchIds =
    filters.branchIds && filters.branchIds.length > 0
      ? authorizedBranchIds.length > 0
        ? filters.branchIds.filter((id) => authorizedBranchSet.has(Number(id)))
        : filters.branchIds
      : authorizedBranchIds;
  const branchFilter =
    filters.branchIds && filters.branchIds.length > 0 && effectiveBranchIds.length === 0
      ? { branch_id: { _in: [-1] } } // Explicitly requested branch not in industrial division -> return empty
      : selectedIn("branch_id", effectiveBranchIds);

  // 2. Windowed Document Headers
  const [invoices, returns, unifiedLpg, wiwoHeaders, meterReadings] =
    await Promise.all([
      read<RawInvoiceRow>("sales_invoice", {
        fields:
          "invoice_id,order_id,invoice_no,customer_code,branch_id,salesman_id,invoice_date,transaction_status,net_amount,gross_amount,discount_amount,isReplaced,isDispatched",
        filter: {
          ...windowFilter("invoice_date", filters, true),
          ...customerFilter,
          ...branchFilter,
        },
      }),
      read<RawReturnRow>("sales_return", {
        fields:
          "return_id,return_number,customer_code,branch_id,salesman_id,return_date,gross_amount,order_id,invoice_no,status,isPosted,deleted_at",
        filter: {
          ...windowFilter("return_date", filters, true),
          ...customerFilter,
          ...branchFilter,
        },
      }),
      read<RawUnifiedLpgRow>("lpg_metered_wiwo_transactions", {
        fields: UNIFIED_LPG_FIELDS,
        filter: {
          status: { _eq: "POSTED" },
          ...windowFilter("transaction_date", filters, false),
          ...customerFilter,
        },
      }).catch(() => []),
      read<RawWiwoHeaderRow>("lpg_wiwo_headers", {
        fields:
          "id,wiwo_no,lpg_site_id,customer_code,transaction_date,wiwo_type,total_billable_kg,gross_amount,net_amount,wiwo_status,sales_invoice_id,sales_invoice_no",
        filter: {
          wiwo_status: { _eq: "POSTED" },
          ...windowFilter("transaction_date", filters, false),
          ...customerFilter,
        },
      }).catch(() => []),
      read<RawMeterReadingRow>("lpg_meter_readings", {
        fields:
          "id,lpg_site_id,customer_code,reading_no,reading_date,billing_period_from,billing_period_to,meter_unit,kg_consumed,price_per_kg,gross_amount,net_amount,reading_status,sales_invoice_id,sales_invoice_no",
        filter: {
          reading_status: { _eq: "POSTED" },
          ...windowFilter("reading_date", filters, false),
          ...customerFilter,
        },
      }).catch(() => []),
    ]);

  // 3. Batched Child Reads
  const invoiceIds = invoices.map((i) => i.invoice_id);
  const invoiceDetailBatches = await Promise.all(
    chunk(invoiceIds).map((ids) =>
      read<RawInvoiceDetailRow>("sales_invoice_details", {
        fields:
          "detail_id,invoice_no,product_id,unit,quantity,unit_price,total_amount,discount_amount,gross_amount",
        filter: { invoice_no: { _in: ids } },
      })
    )
  );
  const invoiceDetails = flatten(invoiceDetailBatches);

  const returnNumbers = returns.map((r) => r.return_number);
  const returnDetailBatches = await Promise.all(
    chunk(returnNumbers).map((numbers) =>
      read<RawReturnDetailRow>("sales_return_details", {
        fields: "detail_id,return_no,product_id,quantity,total_amount,gross_amount,status",
        filter: { return_no: { _in: numbers } },
      })
    )
  );
  const returnDetails = flatten(returnDetailBatches);

  const returnIds = returns.map((r) => r.return_id);
  const returnLinkBatches = await Promise.all(
    chunk(returnIds).map((ids) =>
      read<RawReturnLinkRow>("sales_invoice_sales_return", {
        fields: "id,return_no,invoice_no,amount",
        filter: { return_no: { _in: ids } },
      }).catch(() => [])
    )
  );
  const returnLinks = flatten(returnLinkBatches);

  const wiwoHeaderIds = wiwoHeaders.map((w) => w.id);
  const wiwoDetailBatches = await Promise.all(
    chunk(wiwoHeaderIds).map((ids) =>
      read<RawWiwoDetailRow>("lpg_wiwo_details", {
        fields:
          "id,wiwo_header_id,lpg_site_id,customer_code,line_type,product_id,serial_number,tare_weight_kg,consumed_lpg_kg,billable_kg,price_per_kg,gross_amount,net_amount,is_billable",
        filter: { wiwo_header_id: { _in: ids } },
      }).catch(() => [])
    )
  );
  const wiwoDetails = flatten(wiwoDetailBatches);

  // Unfulfilled transactions linked by invoice IDs
  const unfulfilledBatches = await Promise.all(
    chunk(invoiceIds).map((ids) =>
      read<RawUnfulfilledTransactionRow>("unfulfilled_sales_transaction", {
        fields: "id,sales_invoice_id,status,remarks",
        filter: { sales_invoice_id: { _in: ids } },
      }).catch(() => [])
    )
  );
  const unfulfilledTransactions = flatten(unfulfilledBatches);

  const unfulfilledIds = unfulfilledTransactions.map((u) => u.id);
  const unfulfilledDetailBatches = await Promise.all(
    chunk(unfulfilledIds).map((ids) =>
      read<RawUnfulfilledDetailRow>("unfulfilled_sales_transaction_details", {
        fields:
          "id,unfulfilled_sales_transaction_id,sales_invoice_detail_id,product_id,quantity,total_amount,concern_type",
        filter: { unfulfilled_sales_transaction_id: { _in: ids } },
      }).catch(() => [])
    )
  );
  const unfulfilledDetails = flatten(unfulfilledDetailBatches);

  // Fetch consolidated LPG header -> sales_invoice bridge links
  const lpgHeaderIds = Array.from(
    new Set(
      unifiedLpg
        .map((u) => (u.transaction_header_id != null ? Number(u.transaction_header_id) : 0))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );
  const headerInvoiceBatches = await Promise.all(
    chunk(lpgHeaderIds).map((ids) =>
      read<RawLpgHeaderInvoiceRow>("lpg_transaction_header_invoices", {
        fields: "id,header_id,sales_invoice_id",
        filter: { header_id: { _in: ids } },
      }).catch(() => [])
    )
  );
  const headerInvoices = flatten(headerInvoiceBatches);

  // Hydrate any sales_invoice headers linked to LPG transactions that fell outside the invoice_date window
  // (used for branch_id and order_id resolution only — does NOT fetch out-of-window cylinder details)
  const knownInvoiceIds = new Set(invoices.map((i) => Number(i.invoice_id)));
  const missingLpgInvoiceIds = Array.from(
    new Set(
      [
        ...unifiedLpg.map((u) => u.sales_invoice_id),
        ...headerInvoices.map((h) => h.sales_invoice_id),
        ...wiwoHeaders.map((w) => w.sales_invoice_id),
        ...meterReadings.map((m) => m.sales_invoice_id),
      ]
        .map((id) => (id != null ? Number(id) : 0))
        .filter((id) => Number.isFinite(id) && id > 0 && !knownInvoiceIds.has(id))
    )
  );
  const extraLpgInvoiceBatches = await Promise.all(
    chunk(missingLpgInvoiceIds).map((ids) =>
      read<RawInvoiceRow>("sales_invoice", {
        fields:
          "invoice_id,order_id,invoice_no,customer_code,branch_id,salesman_id,invoice_date,transaction_status,net_amount,gross_amount,discount_amount,isReplaced,isDispatched",
        filter: { invoice_id: { _in: ids } },
      }).catch(() => [])
    )
  );
  const allInvoices = [...invoices, ...flatten(extraLpgInvoiceBatches)];

  // AG-COMMENT: Resolve Sales Orders linked from invoices (supports both order_no strings and numeric order_id)
  // as well as direct windowed sales orders in the selected period.
  const [linkedSalesOrders, windowedSalesOrders] = await Promise.all([
    resolveLinkedSalesOrders(
      [
        ...allInvoices.map((i) => i.order_id),
        ...unifiedLpg.map((u) => u.sales_order_no || u.sales_order_id),
      ],
      read
    ),
    read<RawSalesOrderRow>("sales_order", {
      fields: SALES_ORDER_FIELDS,
      filter: {
        ...windowFilter("order_date", filters, false),
        ...customerFilter,
        ...branchFilter,
      },
    }).catch(() => []),
  ]);

  const salesOrderMap = new Map<number, RawSalesOrderRow>();
  for (const so of [...windowedSalesOrders, ...linkedSalesOrders]) {
    const id = Number(so.order_id);
    if (Number.isFinite(id) && id > 0) salesOrderMap.set(id, so);
  }
  const salesOrders = Array.from(salesOrderMap.values());

  // Fetch Sales Order details for all resolved orders
  const resolvedSoIds = Array.from(salesOrderMap.keys());
  const salesOrderDetailBatches = await Promise.all(
    chunk(resolvedSoIds).map((ids) =>
      read<RawSalesOrderDetailRow>("sales_order_details", {
        fields: SALES_ORDER_DETAIL_FIELDS,
        filter: { order_id: { _in: ids } },
      }).catch(() => [])
    )
  );
  const salesOrderDetails = flatten(salesOrderDetailBatches);

  // 4. Products scope is strictly is_serialized = 1 (no non-serialized label reads)
  return {
    invoices: allInvoices,
    invoiceDetails,
    returns,
    returnDetails,
    returnLinks,
    postDispatch: [],
    postDispatchSerials: [],
    salesOrders,
    salesOrderDetails,
    salesOrderSerials: [],
    salesReturnSerials: [],
    unfulfilledTransactions,
    unfulfilledDetails,
    products,
    productLabels: [],
    units,
    weightUnits,
    categories,
    customers,
    classifications,
    branches,
    salesmen,
    lpgSites,
    unifiedLpg,
    wiwoHeaders,
    wiwoDetails,
    meterReadings,
    transactionHeaders: [],
    headerInvoices,
  };
}

const SALES_ORDER_FIELDS =
  "order_id,order_no,customer_code,branch_id,order_date,delivery_date,order_status,total_amount,net_amount,isCancelled,remarks";
const SALES_ORDER_DETAIL_FIELDS =
  "detail_id,order_id,product_id,ordered_quantity,allocated_quantity,served_quantity,unit_price,gross_amount,net_amount";
// Exact columns from vos_database.lpg_metered_wiwo_transactions (uses billable_source for METERED vs WIWO)
const UNIFIED_LPG_FIELDS =
  "id,transaction_header_id,transaction_no,transaction_type,lpg_site_id,customer_code,sales_order_id,sales_order_no,meter_reading_id,wiwo_header_id,transaction_date,billing_period_from,billing_period_to,metered_kg,wiwo_kg,variance_kg,variance_reason_code,billable_source,billable_kg,price_per_kg,gross_amount,net_amount,sales_invoice_id,sales_invoice_no,status";

/**
 * Resolves sales_order headers from invoice order references.
 * Handles both order_no strings (e.g. "SO-2026-0001") and numeric order_id values.
 */
async function resolveLinkedSalesOrders(
  rawRefs: Array<string | number | null | undefined>,
  read: <T>(
    collection: string,
    query: Omit<DirectusFetchOptions, "signal" | "fetchImpl">
  ) => Promise<T[]>
): Promise<RawSalesOrderRow[]> {
  const stringRefs = Array.from(
    new Set(
      rawRefs
        .map((r) => (r == null ? "" : String(r).trim()))
        .filter((r) => r.length > 0)
    )
  );
  const numericRefs = Array.from(
    new Set(
      stringRefs
        .filter((r) => /^\d+$/.test(r))
        .map((r) => Number(r))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  );

  if (stringRefs.length === 0 && numericRefs.length === 0) return [];

  const [byOrderNoBatches, byOrderIdBatches] = await Promise.all([
    Promise.all(
      chunk(stringRefs).map((refs) =>
        read<RawSalesOrderRow>("sales_order", {
          fields: SALES_ORDER_FIELDS,
          filter: { order_no: { _in: refs } },
        }).catch(() => [])
      )
    ),
    Promise.all(
      chunk(numericRefs).map((ids) =>
        read<RawSalesOrderRow>("sales_order", {
          fields: SALES_ORDER_FIELDS,
          filter: { order_id: { _in: ids } },
        }).catch(() => [])
      )
    ),
  ]);

  const dedup = new Map<number, RawSalesOrderRow>();
  for (const so of [...flatten(byOrderNoBatches), ...flatten(byOrderIdBatches)]) {
    const id = Number(so.order_id);
    if (Number.isFinite(id) && id > 0) dedup.set(id, so);
  }
  return Array.from(dedup.values());
}

/**
 * Fetches supporting documents for drill-down of a specific customer and optional product.
 * Resolves Sales Orders, Sales Invoices, Sales Returns, WIWO headers, and Meter Readings.
 */
export async function fetchSupportingDocumentsForCustomer(
  filters: AppliedFilterContext,
  customerCode: string,
  productId?: number,
  options: RepoOptions = {}
): Promise<SupportingDocument[]> {
  const config = resolveDirectusConfig();
  const mergedConfig: DirectusConfig = { ...config, ...options.config };

  const read = <T>(collection: string, query: Omit<DirectusFetchOptions, "signal" | "fetchImpl">) =>
    fetchDirectusRows<T>(
      collection,
      { ...query, fetchImpl: options.fetchImpl, signal: options.signal },
      mergedConfig
    );

  const [
    windowedOrders,
    invoices,
    returns,
    unifiedLpg,
    wiwos,
    meters,
    lpgSites,
    allProducts,
    categories,
    branches,
  ] = await Promise.all([
      // Direct sales orders placed in the selected date window for this customer
      read<RawSalesOrderRow>("sales_order", {
        fields: SALES_ORDER_FIELDS,
        filter: {
          customer_code: { _eq: customerCode },
          ...windowFilter("order_date", filters, false),
        },
      }).catch(() => []),
      read<RawInvoiceRow>("sales_invoice", {
        fields:
          "invoice_id,order_id,invoice_no,customer_code,branch_id,salesman_id,invoice_date,transaction_status,net_amount,gross_amount",
        filter: {
          customer_code: { _eq: customerCode },
          ...windowFilter("invoice_date", filters, true),
        },
      }),
      read<RawReturnRow>("sales_return", {
        fields:
          "return_id,return_number,customer_code,branch_id,salesman_id,return_date,gross_amount,order_id,invoice_no,status",
        filter: {
          customer_code: { _eq: customerCode },
          ...windowFilter("return_date", filters, true),
        },
      }),
      // Unified LPG ledger (billable_source classifies METERED vs WIWO)
      read<RawUnifiedLpgRow>("lpg_metered_wiwo_transactions", {
        fields: UNIFIED_LPG_FIELDS,
        filter: {
          customer_code: { _eq: customerCode },
          ...windowFilter("transaction_date", filters, false),
        },
      }).catch(() => []),
      read<RawWiwoHeaderRow>("lpg_wiwo_headers", {
        fields:
          "id,wiwo_no,lpg_site_id,customer_code,transaction_date,wiwo_type,total_billable_kg,gross_amount,net_amount,wiwo_status,sales_invoice_id,sales_invoice_no",
        filter: {
          customer_code: { _eq: customerCode },
          ...windowFilter("transaction_date", filters, false),
        },
      }).catch(() => []),
      read<RawMeterReadingRow>("lpg_meter_readings", {
        fields:
          "id,lpg_site_id,customer_code,reading_no,reading_date,billing_period_from,billing_period_to,previous_reading,current_reading,raw_consumption,meter_unit,kg_consumed,price_per_kg,gross_amount,net_amount,reading_status,sales_invoice_id,sales_invoice_no",
        filter: {
          customer_code: { _eq: customerCode },
          ...windowFilter("reading_date", filters, false),
        },
      }).catch(() => []),
      read<RawLpgSiteRow>("lpg_customer_lpg_sites", {
        fields: "id,customer_code,site_name,billing_mode",
        filter: { customer_code: { _eq: customerCode } },
      }).catch(() => []),
      // Strict serialized product master per ids-guide (includes parent_id for parent-only filtering)
      read<RawProductRow>("products", {
        fields: "product_id,parent_id,uom_ids,product_code,product_name,description,product_weight,weight,is_serialized,product_category",
        filter: { is_serialized: { _eq: 1 } },
      }),
      // Strict industrial categories per ids-guide
      read<RawCategoryRow>("categories", {
        fields: "category_id,category_name,is_industrial",
        filter: { is_industrial: { _eq: 1 } },
      }),
      read<RawBranchRow>("branches", {
        fields: "id,branch_name,branch_code",
      }),
    ]);

  const productMap = new Map(allProducts.map((p) => [Number(p.product_id), p]));
  const categoryMap = new Map(categories.map((c) => [Number(c.category_id), c]));
  const branchMap = new Map(branches.map((b) => [Number(b.id), b.branch_name]));
  const lpgSiteMap = new Map(lpgSites.map((s) => [Number(s.id), s]));

  // Resolve consolidated LPG header -> sales_invoice bridge links for this customer's LPG transactions
  const customerLpgHeaderIds = Array.from(
    new Set(
      unifiedLpg
        .map((u) => (u.transaction_header_id != null ? Number(u.transaction_header_id) : 0))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );
  const customerHeaderInvoices =
    customerLpgHeaderIds.length > 0
      ? flatten(
          await Promise.all(
            chunk(customerLpgHeaderIds).map((ids) =>
              read<RawLpgHeaderInvoiceRow>("lpg_transaction_header_invoices", {
                fields: "id,header_id,sales_invoice_id",
                filter: { header_id: { _in: ids } },
              }).catch(() => [])
            )
          )
        )
      : [];

  const headerInvoiceByHeaderId = new Map<number, number>();
  for (const hi of customerHeaderInvoices) {
    if (hi.header_id && hi.sales_invoice_id) {
      headerInvoiceByHeaderId.set(Number(hi.header_id), Number(hi.sales_invoice_id));
    }
  }

  // Hydrate any sales_invoice headers linked from LPG transactions / WIWOs / meters that fell outside invoice_date window
  const existingInvIds = new Set(invoices.map((i) => Number(i.invoice_id)));
  const existingInvNos = new Set(
    invoices.map((i) => (i.invoice_no ? i.invoice_no.trim() : "")).filter(Boolean)
  );
  const missingLinkedInvIds = Array.from(
    new Set(
      [
        ...unifiedLpg.map((u) => u.sales_invoice_id),
        ...customerHeaderInvoices.map((hi) => hi.sales_invoice_id),
        ...wiwos.map((w) => w.sales_invoice_id),
        ...meters.map((m) => m.sales_invoice_id),
      ]
        .map((id) => (id != null ? Number(id) : 0))
        .filter((id) => Number.isFinite(id) && id > 0 && !existingInvIds.has(id))
    )
  );
  const missingLinkedInvNos = Array.from(
    new Set(
      [
        ...unifiedLpg.map((u) => u.sales_invoice_no),
        ...wiwos.map((w) => w.sales_invoice_no),
        ...meters.map((m) => m.sales_invoice_no),
      ]
        .map((no) => (no ? no.trim() : ""))
        .filter((no) => no.length > 0 && !existingInvNos.has(no))
    )
  );

  const [extraInvsById, extraInvsByNo] = await Promise.all([
    missingLinkedInvIds.length > 0
      ? flatten(
          await Promise.all(
            chunk(missingLinkedInvIds).map((ids) =>
              read<RawInvoiceRow>("sales_invoice", {
                fields:
                  "invoice_id,order_id,invoice_no,customer_code,branch_id,salesman_id,invoice_date,transaction_status,net_amount,gross_amount",
                filter: { invoice_id: { _in: ids } },
              }).catch(() => [])
            )
          )
        )
      : Promise.resolve([]),
    missingLinkedInvNos.length > 0
      ? flatten(
          await Promise.all(
            chunk(missingLinkedInvNos).map((nos) =>
              read<RawInvoiceRow>("sales_invoice", {
                fields:
                  "invoice_id,order_id,invoice_no,customer_code,branch_id,salesman_id,invoice_date,transaction_status,net_amount,gross_amount",
                filter: { invoice_no: { _in: nos } },
              }).catch(() => [])
            )
          )
        )
      : Promise.resolve([]),
  ]);

  const allInvById = new Map<number, RawInvoiceRow>();
  for (const inv of [...invoices, ...extraInvsById, ...extraInvsByNo]) {
    allInvById.set(Number(inv.invoice_id), inv);
  }
  const allCustomerInvoices = Array.from(allInvById.values());

  // Resolve any additional sales orders referenced by this customer's invoices, returns, or unified LPG records
  const linkedOrders = await resolveLinkedSalesOrders(
    [
      ...allCustomerInvoices.map((i) => i.order_id),
      ...returns.map((r) => r.order_id),
      ...unifiedLpg.map((u) => u.sales_order_no || u.sales_order_id),
    ],
    read
  );

  const salesOrderMap = new Map<number, RawSalesOrderRow>();
  const soCanonicalByRef = new Map<string, string>();
  for (const so of [...windowedOrders, ...linkedOrders]) {
    const id = Number(so.order_id);
    if (Number.isFinite(id) && id > 0) {
      salesOrderMap.set(id, so);
      const canonical = (so.order_no && so.order_no.trim()) || `SO-${id}`;
      if (so.order_no && so.order_no.trim()) {
        soCanonicalByRef.set(so.order_no.trim(), canonical);
      }
      soCanonicalByRef.set(String(id), canonical);
    }
  }

  // Resolve canonical Sales Order reference for any raw invoice/return order_id string
  const resolveOrderNo = (rawRef: string | number | null | undefined): string | null => {
    if (rawRef == null) return null;
    const trimmed = String(rawRef).trim();
    if (!trimmed) return null;
    return soCanonicalByRef.get(trimmed) ?? trimmed;
  };

  // Map invoice references (invoice_no and numeric invoice_id) -> { invoice, invoiceNo, orderNo }
  const invMetaByRef = new Map<
    string,
    { invoice: RawInvoiceRow; invoiceNo: string; orderNo: string | null }
  >();
  for (const inv of allCustomerInvoices) {
    const invNo = (inv.invoice_no && inv.invoice_no.trim()) || `SI-${inv.invoice_id}`;
    const meta = { invoice: inv, invoiceNo: invNo, orderNo: resolveOrderNo(inv.order_id) };
    invMetaByRef.set(invNo, meta);
    invMetaByRef.set(String(inv.invoice_id), meta);
  }

  const documents: SupportingDocument[] = [];
  const emittedInvoiceIds = new Set<number>();

  // Helper: verify product is a PARENT serialized industrial product (parent_id IS NULL) and compute net gas kg per unit
  const resolveScopedProduct = (rawProductId: number | string) => {
    const pid = Number(rawProductId);
    const p = productMap.get(pid);
    if (!p || !isTruthyFlag(p.is_serialized)) return null;
    // Parent products only: exclude child variants (EMPTY, SWAP, DEPOSIT, etc.)
    if (p.parent_id != null && Number(p.parent_id) > 0) return null;
    const cat = p.product_category != null ? categoryMap.get(Number(p.product_category)) : undefined;
    if (!cat || !isTruthyFlag(cat.is_industrial)) return null;
    const unitKg = resolveCylinderSizeKg(cat, p) ?? toNumber(p.weight || p.product_weight, 0);
    return { product: p, category: cat, unitKg };
  };

  // Helper: climb any child variant (if referenced on an LPG order/invoice) up to its parent product
  const resolveParentProduct = (rawProductId: number | string) => {
    const pid = Number(rawProductId);
    const p = productMap.get(pid);
    if (!p) return null;
    const rootId = p.parent_id != null && Number(p.parent_id) > 0 ? Number(p.parent_id) : pid;
    return resolveScopedProduct(rootId);
  };

  // Maps used to resolve the real Parent Product for LPG Metered / WIWO transactions via linked invoice/order
  const orderParentProductByOrderNo = new Map<string, ReturnType<typeof resolveScopedProduct>>();
  const invoiceParentProductByInvId = new Map<number, ReturnType<typeof resolveScopedProduct>>();

  // 1. Sales Orders & Details
  const soIds = Array.from(salesOrderMap.keys());
  if (soIds.length > 0) {
    const [soDetailBatches, soSerialBatches] = await Promise.all([
      Promise.all(
        chunk(soIds).map((ids) =>
          read<RawSalesOrderDetailRow>("sales_order_details", {
            fields: SALES_ORDER_DETAIL_FIELDS,
            filter: { order_id: { _in: ids } },
          }).catch(() => [])
        )
      ),
      Promise.all(
        chunk(soIds).map((ids) =>
          read<RawSalesOrderSerialRow>("sales_order_details_serial", {
            fields: "id,sales_order_id,serial_number,product_id",
            filter: { sales_order_id: { _in: ids } },
          }).catch(() => [])
        )
      ),
    ]);

    const soDetails = flatten(soDetailBatches);
    const soSerials = flatten(soSerialBatches);

    // Group tagged serial numbers by sales_order_id + product_id
    const serialsByOrderProd = new Map<string, string[]>();
    for (const s of soSerials) {
      if (!s.serial_number) continue;
      const key = `${Number(s.sales_order_id)}|${Number(s.product_id ?? 0)}`;
      const list = serialsByOrderProd.get(key) ?? [];
      list.push(s.serial_number);
      serialsByOrderProd.set(key, list);
    }

    for (const d of soDetails) {
      const pid = Number(d.product_id);
      const so = salesOrderMap.get(Number(d.order_id));
      if (!so) continue;
      const canonicalOrderNo = (so.order_no && so.order_no.trim()) || `SO-${so.order_id}`;

      // Record parent product for this sales order (even if line used a variant, climbs to parent)
      const parentForOrder = resolveParentProduct(pid);
      if (parentForOrder && !orderParentProductByOrderNo.has(canonicalOrderNo)) {
        orderParentProductByOrderNo.set(canonicalOrderNo, parentForOrder);
      }

      const scoped = parentForOrder ?? resolveScopedProduct(pid);
      if (!scoped) continue;
      const effectiveParentId = Number(scoped.product.product_id);

      // Support filtering by exact product ID or its resolved Parent Product ID
      if (
        productId != null &&
        pid !== Number(productId) &&
        effectiveParentId !== Number(productId)
      ) {
        continue;
      }

      const qty = toNumber(
        d.ordered_quantity ?? d.served_quantity ?? d.allocated_quantity ?? d.quantity,
        0
      );
      const amount =
        toNumber(d.net_amount ?? d.gross_amount, 0) || qty * toNumber(d.unit_price, 0);
      const serials = serialsByOrderProd.get(`${Number(so.order_id)}|${pid}`) ?? [];

      documents.push({
        id: `SO-${d.detail_id}`,
        documentType: "SALES_ORDER",
        documentNo: canonicalOrderNo,
        date: so.order_date || so.delivery_date || "",
        status: isTruthyFlag(so.isCancelled) ? "CANCELLED" : so.order_status || "OPEN",
        customerCode,
        customerName: customerCode,
        branchName: so.branch_id ? branchMap.get(Number(so.branch_id)) ?? "Branch" : "Main",
        productId: effectiveParentId,
        productName: scoped.product.description || scoped.product.product_name || `Product #${effectiveParentId}`,
        productCode: scoped.product.product_code ?? "",
        quantity: qty,
        kg: qty * scoped.unitKg,
        amount,
        serialNumbers: serials,
        reference: so.remarks ?? "",
        orderNo: canonicalOrderNo,
      });
    }
  }

  // 2. Invoices & Details (fetched for allCustomerInvoices so linked LPG billing invoices have details too)
  const allInvIds = allCustomerInvoices.map((i) => i.invoice_id);
  const windowedInvIdSet = new Set(invoices.map((i) => Number(i.invoice_id)));
  if (allInvIds.length > 0) {
    const detailBatches = await Promise.all(
      chunk(allInvIds).map((ids) =>
        read<RawInvoiceDetailRow>("sales_invoice_details", {
          fields: "detail_id,invoice_no,product_id,quantity,unit_price,total_amount",
          filter: { invoice_no: { _in: ids } },
        }).catch(() => [])
      )
    );
    const details = flatten(detailBatches);

    const invMap = new Map(allCustomerInvoices.map((i) => [Number(i.invoice_id), i]));
    for (const d of details) {
      const pid = Number(d.product_id);
      const inv = invMap.get(Number(d.invoice_no));
      if (!inv) continue;

      // Record parent product for this invoice (used by linked LPG Metered / WIWO transactions)
      const parentForInv = resolveParentProduct(pid);
      if (parentForInv && !invoiceParentProductByInvId.has(Number(inv.invoice_id))) {
        invoiceParentProductByInvId.set(Number(inv.invoice_id), parentForInv);
      }

      // Only emit cylinder invoice documents for invoices placed within the reporting date window
      if (!windowedInvIdSet.has(Number(inv.invoice_id))) continue;

      const scoped = parentForInv ?? resolveScopedProduct(pid);
      if (!scoped) continue;
      const effectiveParentId = Number(scoped.product.product_id);

      if (
        productId != null &&
        pid !== Number(productId) &&
        effectiveParentId !== Number(productId)
      ) {
        continue;
      }

      const qty = toNumber(d.quantity, 0);
      const invNo = (inv.invoice_no && inv.invoice_no.trim()) || `SI-${inv.invoice_id}`;
      const linkedOrderNo = resolveOrderNo(inv.order_id);
      emittedInvoiceIds.add(Number(inv.invoice_id));

      documents.push({
        id: `SI-${d.detail_id}`,
        documentType: "SALES_INVOICE",
        documentNo: invNo,
        date: inv.invoice_date ?? "",
        status: inv.transaction_status ?? "POSTED",
        customerCode,
        customerName: customerCode,
        branchName: inv.branch_id ? branchMap.get(Number(inv.branch_id)) ?? "Branch" : "Main",
        productId: effectiveParentId,
        productName: scoped.product.description || scoped.product.product_name || `Product #${effectiveParentId}`,
        productCode: scoped.product.product_code ?? "",
        quantity: qty,
        kg: qty * scoped.unitKg,
        amount: toNumber(d.total_amount, 0),
        serialNumbers: [],
        reference: linkedOrderNo ?? "",
        orderNo: linkedOrderNo,
        invoiceNo: invNo,
      });
    }
  }

  // 3. Sales Returns (also checks sales_invoice_sales_return bridge for invoice/order linkage)
  const returnNumbers = returns.map((r) => r.return_number);
  if (returnNumbers.length > 0) {
    const returnIds = returns.map((r) => r.return_id);
    const [retDetails, retLinks] = await Promise.all([
      read<RawReturnDetailRow>("sales_return_details", {
        fields: "detail_id,return_no,product_id,quantity,total_amount,status",
        filter: { return_no: { _in: returnNumbers } },
      }),
      returnIds.length > 0
        ? read<RawReturnLinkRow>("sales_invoice_sales_return", {
            fields: "id,return_no,invoice_no,amount",
            filter: { return_no: { _in: returnIds } },
          }).catch(() => [])
        : Promise.resolve([]),
    ]);

    const linkInvoiceByReturnId = new Map<number, string>();
    for (const lnk of retLinks) {
      if (lnk.return_no && lnk.invoice_no) {
        linkInvoiceByReturnId.set(Number(lnk.return_no), String(lnk.invoice_no));
      }
    }

    const retMap = new Map(returns.map((r) => [r.return_number, r]));
    for (const d of retDetails) {
      const pid = Number(d.product_id);
      const ret = retMap.get(d.return_no);
      if (!ret) continue;

      const parentForRet = resolveParentProduct(pid);
      const scoped = parentForRet ?? resolveScopedProduct(pid);
      if (!scoped) continue;
      const effectiveParentId = Number(scoped.product.product_id);

      if (
        productId != null &&
        pid !== Number(productId) &&
        effectiveParentId !== Number(productId)
      ) {
        continue;
      }

      const qty = toNumber(d.quantity, 0);
      const rawInvRef =
        (ret.invoice_no && ret.invoice_no.trim()) ||
        linkInvoiceByReturnId.get(Number(ret.return_id)) ||
        "";
      const invMeta = rawInvRef ? invMetaByRef.get(rawInvRef) : undefined;
      const linkedInvoiceNo = invMeta?.invoiceNo ?? (rawInvRef || null);
      const linkedOrderNo = resolveOrderNo(ret.order_id) ?? invMeta?.orderNo ?? null;

      documents.push({
        id: `SR-${d.detail_id}`,
        documentType: "SALES_RETURN",
        documentNo: ret.return_number,
        date: ret.return_date ?? "",
        status: ret.status ?? "POSTED",
        customerCode,
        customerName: customerCode,
        branchName: ret.branch_id ? branchMap.get(Number(ret.branch_id)) ?? "Branch" : "Main",
        productId: effectiveParentId,
        productName: scoped.product.description || scoped.product.product_name || `Product #${effectiveParentId}`,
        productCode: scoped.product.product_code ?? "",
        quantity: qty,
        kg: qty * scoped.unitKg,
        amount: toNumber(d.total_amount, 0),
        serialNumbers: [],
        reference: linkedInvoiceNo ?? linkedOrderNo ?? "",
        orderNo: linkedOrderNo,
        invoiceNo: linkedInvoiceNo,
        returnNo: ret.return_number,
      });
    }
  }

  // Pre-index parent product references from standalone and linked WIWO detail lines
  const wiwoHeaderIds = Array.from(new Set(wiwos.map((w) => Number(w.id)).filter((id) => id > 0)));
  const wiwoParentProductByHeaderId = new Map<number, ReturnType<typeof resolveScopedProduct>>();
  if (wiwoHeaderIds.length > 0) {
    const wiwoDetailBatches = await Promise.all(
      chunk(wiwoHeaderIds).map((ids) =>
        read<RawWiwoDetailRow>("lpg_wiwo_details", {
          fields: "id,wiwo_header_id,product_id",
          filter: { wiwo_header_id: { _in: ids } },
        }).catch(() => [])
      )
    );
    for (const d of flatten(wiwoDetailBatches)) {
      const wid = Number(d.wiwo_header_id);
      if (!wiwoParentProductByHeaderId.has(wid)) {
        const parent = resolveParentProduct(d.product_id);
        if (parent) wiwoParentProductByHeaderId.set(wid, parent);
      }
    }
  }

  // 4. Unified LPG Transactions (lpg_metered_wiwo_transactions: billable_source classifies METERED vs WIWO)
  // Hydrate any linked meter readings or WIWO headers referenced by unified transactions
  const wiwoById = new Map<number, RawWiwoHeaderRow>(wiwos.map((w) => [Number(w.id), w]));
  const meterById = new Map<number, RawMeterReadingRow>(meters.map((m) => [Number(m.id), m]));

  const missingWiwoIds = Array.from(
    new Set(
      unifiedLpg
        .map((u) => (u.wiwo_header_id != null ? Number(u.wiwo_header_id) : 0))
        .filter((id) => id > 0 && !wiwoById.has(id))
    )
  );
  const missingMeterIds = Array.from(
    new Set(
      unifiedLpg
        .map((u) => (u.meter_reading_id != null ? Number(u.meter_reading_id) : 0))
        .filter((id) => id > 0 && !meterById.has(id))
    )
  );

  if (missingWiwoIds.length > 0 || missingMeterIds.length > 0) {
    const [extraWiwos, extraMeters] = await Promise.all([
      missingWiwoIds.length > 0
        ? read<RawWiwoHeaderRow>("lpg_wiwo_headers", {
            fields:
              "id,wiwo_no,lpg_site_id,customer_code,transaction_date,wiwo_type,total_billable_kg,gross_amount,net_amount,wiwo_status,sales_invoice_id,sales_invoice_no",
            filter: { id: { _in: missingWiwoIds } },
          }).catch(() => [])
        : Promise.resolve([]),
      missingMeterIds.length > 0
        ? read<RawMeterReadingRow>("lpg_meter_readings", {
            fields:
              "id,lpg_site_id,customer_code,reading_no,reading_date,billing_period_from,billing_period_to,previous_reading,current_reading,raw_consumption,meter_unit,kg_consumed,price_per_kg,gross_amount,net_amount,reading_status,sales_invoice_id,sales_invoice_no",
            filter: { id: { _in: missingMeterIds } },
          }).catch(() => [])
        : Promise.resolve([]),
    ]);
    for (const w of extraWiwos) wiwoById.set(Number(w.id), w);
    for (const m of extraMeters) meterById.set(Number(m.id), m);
  }

  // Helper: resolve linked sales_invoice for an LPG record (direct ID, invoice_no, or consolidated header bridge)
  const resolveLpgInvoiceLink = (
    salesInvoiceId: number | null | undefined,
    salesInvoiceNo: string | null | undefined,
    transactionHeaderId?: number | null
  ) => {
    const bridgedInvId =
      salesInvoiceId ??
      (transactionHeaderId != null
        ? headerInvoiceByHeaderId.get(Number(transactionHeaderId)) ?? null
        : null);
    const metaById = bridgedInvId != null ? invMetaByRef.get(String(bridgedInvId)) : undefined;
    const metaByNo =
      salesInvoiceNo && salesInvoiceNo.trim()
        ? invMetaByRef.get(salesInvoiceNo.trim())
        : undefined;
    const invMeta = metaById ?? metaByNo;
    const linkedInvoiceNo = invMeta?.invoiceNo ?? (salesInvoiceNo?.trim() || null);
    return { invMeta, linkedInvoiceNo };
  };

  // Helper: trace an LPG transaction -> linked sales_invoice -> linked sales_order -> real Parent Product
  const resolveLpgParentProduct = (
    invMeta: { invoice: RawInvoiceRow; invoiceNo: string; orderNo: string | null } | undefined,
    linkedOrderNo: string | null,
    wiwoHeaderId?: number | null
  ) => {
    if (invMeta) {
      const fromInv = invoiceParentProductByInvId.get(Number(invMeta.invoice.invoice_id));
      if (fromInv) return fromInv;
    }
    const orderRef = linkedOrderNo ?? invMeta?.orderNo ?? null;
    if (orderRef) {
      const fromOrder = orderParentProductByOrderNo.get(orderRef);
      if (fromOrder) return fromOrder;
    }
    if (wiwoHeaderId != null) {
      const fromWiwo = wiwoParentProductByHeaderId.get(Number(wiwoHeaderId));
      if (fromWiwo) return fromWiwo;
    }
    return null;
  };

  // Emit header-level SALES_INVOICE document for LPG billing invoices that had no serialized cylinder detail lines,
  // so the linked Sales Invoice is visibly connected to the LPG Metered / WIWO record in the chain card.
  const ensureLpgBillingInvoiceDoc = (
    invMeta: { invoice: RawInvoiceRow; invoiceNo: string; orderNo: string | null } | undefined,
    linkedOrderNo: string | null,
    mode: "METERED" | "WIWO",
    resolvedParent: ReturnType<typeof resolveScopedProduct>
  ) => {
    if (!invMeta) return;
    const inv = invMeta.invoice;
    const invId = Number(inv.invoice_id);
    if (emittedInvoiceIds.has(invId)) return;
    emittedInvoiceIds.add(invId);

    const parentProd = resolvedParent?.product;
    const docProductId = parentProd
      ? Number(parentProd.product_id)
      : mode === "METERED"
      ? LPG_METERED_PRODUCT_ID
      : LPG_WIWO_PRODUCT_ID;

    // Strict product scope check on LPG billing invoices
    if (productId != null && Number(productId) !== docProductId) return;

    documents.push({
      id: `SI-LPG-${invId}`,
      documentType: "SALES_INVOICE",
      documentNo: invMeta.invoiceNo,
      date: inv.invoice_date ?? "",
      status: inv.transaction_status ?? "POSTED",
      customerCode,
      customerName: customerCode,
      branchName: inv.branch_id ? branchMap.get(Number(inv.branch_id)) ?? "Branch" : "Main",
      productId: docProductId,
      productName:
        parentProd?.description ||
        parentProd?.product_name ||
        (mode === "METERED"
          ? "LPG Metered Billing Invoice"
          : "LPG WIWO (Kg) Billing Invoice"),
      productCode:
        parentProd?.product_code ?? (mode === "METERED" ? "LPG-METERED" : "LPG-WIWO"),
      quantity: 1,
      // kg is 0 here because consumption kg is already represented on the linked LPG transaction row
      kg: 0,
      amount: toNumber(inv.net_amount ?? inv.gross_amount, 0),
      serialNumbers: [],
      reference: linkedOrderNo ?? invMeta.orderNo ?? "",
      orderNo: linkedOrderNo ?? invMeta.orderNo,
      invoiceNo: invMeta.invoiceNo,
    });
  };

  const coveredWiwoIds = new Set<number>();
  const coveredMeterIds = new Set<number>();

  for (const u of unifiedLpg) {
    if (normalizeStatus(u.status) === "cancelled") continue;
    const site = lpgSiteMap.get(Number(u.lpg_site_id));
    const classified = classifyUnifiedLpgTransaction(u, site);

    if (u.wiwo_header_id != null) coveredWiwoIds.add(Number(u.wiwo_header_id));
    if (u.meter_reading_id != null) coveredMeterIds.add(Number(u.meter_reading_id));

    if (classified.isOnboardingBaseline) continue;
    const txAmount = toNumber(u.net_amount ?? u.gross_amount, 0);
    if (classified.effectiveKg <= 0 && txAmount <= 0) continue;

    const linkedMeter = u.meter_reading_id != null ? meterById.get(Number(u.meter_reading_id)) : undefined;
    const linkedWiwo = u.wiwo_header_id != null ? wiwoById.get(Number(u.wiwo_header_id)) : undefined;

    const { invMeta, linkedInvoiceNo } = resolveLpgInvoiceLink(
      u.sales_invoice_id,
      u.sales_invoice_no,
      u.transaction_header_id
    );
    const linkedOrderNo =
      resolveOrderNo(u.sales_order_no || u.sales_order_id) ?? invMeta?.orderNo ?? null;

    // Trace linked invoice -> linked sales order -> real Parent Product
    const resolvedParent = resolveLpgParentProduct(invMeta, linkedOrderNo, u.wiwo_header_id);
    const resolvedProductId = resolvedParent
      ? Number(resolvedParent.product.product_id)
      : classified.syntheticProductId;

    if (productId != null && Number(productId) !== resolvedProductId) continue;

    ensureLpgBillingInvoiceDoc(invMeta, linkedOrderNo, classified.mode, resolvedParent);

    const resolvedProdName = resolvedParent
      ? resolvedParent.product.description || resolvedParent.product.product_name || classified.productName
      : site?.site_name
      ? `${classified.productName} · ${site.site_name}`
      : classified.productName;

    documents.push({
      id: `LPG-TXN-${u.id}`,
      documentType: classified.documentType,
      documentNo: u.transaction_no,
      date: u.transaction_date,
      status: u.status,
      customerCode,
      customerName: customerCode,
      branchName: site?.site_name || "LPG Site",
      productId: resolvedProductId,
      productName: resolvedProdName,
      productCode: resolvedParent?.product.product_code ?? classified.productCode,
      quantity: 1,
      kg: classified.effectiveKg,
      amount: txAmount,
      serialNumbers: [],
      reference: linkedInvoiceNo || linkedOrderNo || "",
      orderNo: linkedOrderNo,
      invoiceNo: linkedInvoiceNo,
      lpgDetails: {
        billableSource: classified.mode,
        transactionType: u.transaction_type ?? null,
        siteName: site?.site_name ?? null,
        billingPeriodFrom: u.billing_period_from ?? linkedMeter?.billing_period_from ?? null,
        billingPeriodTo: u.billing_period_to ?? linkedMeter?.billing_period_to ?? null,
        meterReadingNo: linkedMeter?.reading_no ?? null,
        previousReading: linkedMeter?.previous_reading != null ? toNumber(linkedMeter.previous_reading, 0) : null,
        currentReading: linkedMeter?.current_reading != null ? toNumber(linkedMeter.current_reading, 0) : null,
        rawConsumption: linkedMeter?.raw_consumption != null ? toNumber(linkedMeter.raw_consumption, 0) : null,
        meterUnit: linkedMeter?.meter_unit ?? null,
        meteredKg: toNumber(u.metered_kg, 0),
        wiwoNo: linkedWiwo?.wiwo_no ?? null,
        wiwoKg: toNumber(u.wiwo_kg, 0),
        varianceKg: classified.varianceKg,
        varianceReason: u.variance_reason_code ?? null,
        billableKg: classified.effectiveKg,
        pricePerKg: toNumber(u.price_per_kg, 0),
      },
    });
  }

  // 5. Standalone WIWOs not already covered by lpg_metered_wiwo_transactions
  for (const w of wiwos) {
    if (coveredWiwoIds.has(Number(w.id))) continue;
    if (normalizeStatus(w.wiwo_status) === "cancelled") continue;

    const kg = toNumber(w.total_billable_kg, 0);
    const amt = toNumber(w.net_amount ?? w.gross_amount, 0);
    if (kg <= 0 && amt <= 0) continue;

    const site = lpgSiteMap.get(Number(w.lpg_site_id));
    const { invMeta, linkedInvoiceNo } = resolveLpgInvoiceLink(
      w.sales_invoice_id,
      w.sales_invoice_no
    );
    const linkedOrderNo = invMeta?.orderNo ?? null;
    const resolvedParent = resolveLpgParentProduct(invMeta, linkedOrderNo, w.id);
    const resolvedProductId = resolvedParent
      ? Number(resolvedParent.product.product_id)
      : LPG_WIWO_PRODUCT_ID;

    if (productId != null && Number(productId) !== resolvedProductId) continue;

    ensureLpgBillingInvoiceDoc(invMeta, linkedOrderNo, "WIWO", resolvedParent);

    documents.push({
      id: `WIWO-${w.id}`,
      documentType: "LPG_WIWO",
      documentNo: w.wiwo_no,
      date: w.transaction_date,
      status: w.wiwo_status,
      customerCode,
      customerName: customerCode,
      branchName: site?.site_name || "LPG Site",
      productId: resolvedProductId,
      productName: resolvedParent
        ? resolvedParent.product.description || resolvedParent.product.product_name || "LPG WIWO (Kg) Consumption"
        : site?.site_name
        ? `LPG WIWO (Kg) Consumption · ${site.site_name}`
        : "LPG WIWO (Kg) Consumption",
      productCode: resolvedParent?.product.product_code ?? "LPG-WIWO",
      quantity: 1,
      kg,
      amount: amt,
      serialNumbers: [],
      reference: linkedInvoiceNo || "",
      orderNo: linkedOrderNo,
      invoiceNo: linkedInvoiceNo,
      lpgDetails: {
        billableSource: "WIWO",
        siteName: site?.site_name ?? null,
        wiwoNo: w.wiwo_no,
        wiwoKg: kg,
        billableKg: kg,
      },
    });
  }

  // 6. Standalone Meter Readings not already covered by lpg_metered_wiwo_transactions
  for (const m of meters) {
    if (coveredMeterIds.has(Number(m.id))) continue;
    if (normalizeStatus(m.reading_status) === "cancelled") continue;

    const kg = toNumber(m.kg_consumed, 0);
    const amt = toNumber(m.net_amount ?? m.gross_amount, 0);
    if (kg <= 0 && amt <= 0) continue;

    const site = lpgSiteMap.get(Number(m.lpg_site_id));
    const { invMeta, linkedInvoiceNo } = resolveLpgInvoiceLink(
      m.sales_invoice_id,
      m.sales_invoice_no
    );
    const linkedOrderNo = invMeta?.orderNo ?? null;
    const resolvedParent = resolveLpgParentProduct(invMeta, linkedOrderNo);
    const resolvedProductId = resolvedParent
      ? Number(resolvedParent.product.product_id)
      : LPG_METERED_PRODUCT_ID;

    if (productId != null && Number(productId) !== resolvedProductId) continue;

    ensureLpgBillingInvoiceDoc(invMeta, linkedOrderNo, "METERED", resolvedParent);

    documents.push({
      id: `MR-${m.id}`,
      documentType: "METER_READING",
      documentNo: m.reading_no,
      date: m.reading_date,
      status: m.reading_status,
      customerCode,
      customerName: customerCode,
      branchName: site?.site_name || "LPG Site",
      productId: resolvedProductId,
      productName: resolvedParent
        ? resolvedParent.product.description || resolvedParent.product.product_name || "LPG Metered Consumption"
        : site?.site_name
        ? `LPG Metered Consumption · ${site.site_name}`
        : "LPG Metered Consumption",
      productCode: resolvedParent?.product.product_code ?? "LPG-METERED",
      quantity: 1,
      kg,
      amount: amt,
      serialNumbers: [],
      reference: linkedInvoiceNo || "",
      orderNo: linkedOrderNo,
      invoiceNo: linkedInvoiceNo,
      lpgDetails: {
        billableSource: "METERED",
        siteName: site?.site_name ?? null,
        billingPeriodFrom: m.billing_period_from ?? null,
        billingPeriodTo: m.billing_period_to ?? null,
        meterReadingNo: m.reading_no,
        previousReading: m.previous_reading != null ? toNumber(m.previous_reading, 0) : null,
        currentReading: m.current_reading != null ? toNumber(m.current_reading, 0) : null,
        rawConsumption: m.raw_consumption != null ? toNumber(m.raw_consumption, 0) : null,
        meterUnit: m.meter_unit ?? null,
        meteredKg: kg,
        billableKg: kg,
        pricePerKg: m.price_per_kg != null ? toNumber(m.price_per_kg, 0) : null,
      },
    });
  }

  return documents.sort((a, b) => b.date.localeCompare(a.date));
}
