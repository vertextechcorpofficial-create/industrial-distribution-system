// ============================================================================
// Customer History — Service Layer (Orchestration & Aggregation)
// Calls repo for Directus I/O, applies industrial scope, and computes summaries.
// ============================================================================

import type {
  ActivityTrendPoint,
  CategoryMixPoint,
  CustomerDetailSummary,
  CustomerHistoryDetailResponse,
  CustomerHistoryFilters,
  CustomerHistoryKpis,
  CustomerHistoryListResponse,
  CustomerHistoryRow,
  CustomerMonthlySeriesPoint,
  CustomerProfileSummary,
  DetailRangePreset,
  EventKind,
  LookupOption,
  TopCustomerPoint,
} from "../types/customer-history.types";
import { buildCustomerEventStreams } from "./customer-history.events";
import {
  display,
  extractDateKey,
  isTruthyFlag,
  toNumberOrNull,
  toNumberZero,
} from "./customer-history.helpers";
import {
  readDetailSourceBundle,
  readListSourceBundle,
  readScopeMasters,
  type RepoOptions,
} from "./customer-history.repo";
import {
  buildIndustrialScope,
  isInScopeBranch,
  resolveQualifyingParentProductId,
} from "./customer-history.scope";

const CATEGORY_LABELS: Record<EventKind, string> = {
  profile: "Profile",
  invoice: "Sales Invoices",
  pos: "POS Sales",
  order: "Sales Orders",
  payment: "Payments",
  dispatch: "Dispatch Plans",
  return: "Returns",
  serial: "Serials",
  consolidation: "Consolidation",
  memo: "Memos",
};

function resolveSalesmanForCustomer(
  customerId: number,
  customerSalesmen: { customer_id: number; salesman_id: number }[],
  salesmanMap: Map<number, { salesman_name: string; salesman_code: string }>
): { salesmanName: string; salesmanCode: string } {
  const link = customerSalesmen.find((cs) => Number(cs.customer_id) === customerId);
  if (!link) return { salesmanName: "-", salesmanCode: "-" };
  const s = salesmanMap.get(Number(link.salesman_id));
  return {
    salesmanName: display(s?.salesman_name),
    salesmanCode: display(s?.salesman_code),
  };
}

/**
 * Computes the main Customer History list, KPI strip, and overview charts.
 * Includes only customers with at least 1 in-scope industrial activity in the applied date window.
 */
export async function getCustomerHistoryList(
  filters: CustomerHistoryFilters,
  options: RepoOptions = {}
): Promise<CustomerHistoryListResponse> {
  const bundle = await readListSourceBundle(filters, options);
  const scope = buildIndustrialScope(
    bundle.scopeMasters.branches,
    bundle.scopeMasters.products
  );

  const storeTypeMap = new Map<number, string>(
    bundle.storeTypes.map((st) => [Number(st.id), display(st.store_type)])
  );
  const classificationMap = new Map<number, string>(
    bundle.classifications.map((cl) => [Number(cl.id), display(cl.classification_name)])
  );
  const salesmanMap = new Map(
    bundle.salesmen.map((s) => [
      Number(s.id),
      { salesman_name: s.salesman_name, salesman_code: s.salesman_code },
    ])
  );

  // Index invoice & order & return details
  const invoiceDetailsByInvoice = new Map<number, typeof bundle.invoiceDetails>();
  for (const d of bundle.invoiceDetails) {
    const list = invoiceDetailsByInvoice.get(Number(d.invoice_no)) ?? [];
    list.push(d);
    invoiceDetailsByInvoice.set(Number(d.invoice_no), list);
  }
  const orderDetailsByOrder = new Map<number, typeof bundle.orderDetails>();
  for (const d of bundle.orderDetails) {
    const list = orderDetailsByOrder.get(Number(d.order_id)) ?? [];
    list.push(d);
    orderDetailsByOrder.set(Number(d.order_id), list);
  }
  const returnDetailsByNo = new Map<string, typeof bundle.returnDetails>();
  for (const d of bundle.returnDetails) {
    const list = returnDetailsByNo.get(d.return_no) ?? [];
    list.push(d);
    returnDetailsByNo.set(d.return_no, list);
  }

  // Per-customer accumulator
  interface Acc {
    invoiceCount: number;
    posCount: number;
    orderCount: number;
    paymentCount: number;
    dispatchCount: number;
    returnCount: number;
    memoCount: number;
    totalSalesAmount: number;
    totalPaymentAmount: number;
    totalReturnAmount: number;
    lastActivityAt: string | null;
  }
  const accMap = new Map<string, Acc>();
  const touch = (code: string, dt: string | null | undefined): Acc => {
    let a = accMap.get(code);
    if (!a) {
      a = {
        invoiceCount: 0,
        posCount: 0,
        orderCount: 0,
        paymentCount: 0,
        dispatchCount: 0,
        returnCount: 0,
        memoCount: 0,
        totalSalesAmount: 0,
        totalPaymentAmount: 0,
        totalReturnAmount: 0,
        lastActivityAt: null,
      };
      accMap.set(code, a);
    }
    if (dt) {
      if (!a.lastActivityAt || dt > a.lastActivityAt) {
        a.lastActivityAt = dt;
      }
    }
    return a;
  };

  // Trend & Category Mix accumulators
  const trendMap = new Map<string, ActivityTrendPoint>();
  const ensureTrend = (dt: string | null | undefined): ActivityTrendPoint | null => {
    const key = extractDateKey(dt);
    if (!key) return null;
    let pt = trendMap.get(key);
    if (!pt) {
      const d = new Date(`${key}T00:00:00`);
      const label = Number.isNaN(d.getTime())
        ? key
        : d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
      pt = {
        date: key,
        label,
        invoices: 0,
        payments: 0,
        returns: 0,
        salesAmount: 0,
        paymentAmount: 0,
      };
      trendMap.set(key, pt);
    }
    return pt;
  };

  const categoryCounts = new Map<EventKind, number>();
  const bumpCategory = (kind: EventKind) => {
    categoryCounts.set(kind, (categoryCounts.get(kind) ?? 0) + 1);
  };

  const selectedBranch = filters.branchId;
  const selectedProduct = filters.productId;

  // Qualifying invoices in scope
  const qualifyingInvoicesById = new Map<
    number,
    { customerCode: string; amount: number }
  >();
  const windowInvoiceIds = new Set<number>();

  for (const inv of bundle.invoices) {
    if (!inv.customer_code) continue;
    if (!isInScopeBranch(inv.branch_id, scope, selectedBranch)) continue;

    const lines = invoiceDetailsByInvoice.get(Number(inv.invoice_id)) ?? [];
    let qualifyingSum = 0;
    let hasMatch = false;
    for (const line of lines) {
      const parentId = resolveQualifyingParentProductId(
        line.product_id,
        scope,
        selectedProduct
      );
      if (parentId !== null) {
        hasMatch = true;
        qualifyingSum += toNumberZero(line.total_amount);
      }
    }
    if (!hasMatch && lines.length > 0) continue;
    if (!hasMatch && selectedProduct !== "all") continue;
    // If invoice has zero details loaded (e.g. extra invoice fetched for payment), allow only if lines exist in DB;
    // for windowed invoices we always queried details so lines.length === 0 means no industrial lines.
    if (!hasMatch) continue;

    qualifyingInvoicesById.set(Number(inv.invoice_id), {
      customerCode: inv.customer_code,
      amount: qualifyingSum,
    });

    // Count as windowed invoice only if invoice_date is inside applied window
    const invKey = extractDateKey(inv.invoice_date);
    if (invKey && invKey >= filters.startDate && invKey <= filters.endDate) {
      windowInvoiceIds.add(Number(inv.invoice_id));
      const a = touch(inv.customer_code, inv.invoice_date);
      a.invoiceCount += 1;
      a.totalSalesAmount += qualifyingSum;
      bumpCategory("invoice");
      const tp = ensureTrend(inv.invoice_date);
      if (tp) {
        tp.invoices += 1;
        tp.salesAmount += qualifyingSum;
      }
    }
  }

  // POS serials
  const posSeen = new Set<string>();
  for (const ps of bundle.posSerials) {
    const parentId = resolveQualifyingParentProductId(
      ps.product_id,
      scope,
      selectedProduct
    );
    if (parentId === null) continue;
    const inv = bundle.invoices.find(
      (i) => Number(i.invoice_id) === Number(ps.sales_invoice_id)
    );
    if (!inv || !inv.customer_code) continue;
    if (!isInScopeBranch(inv.branch_id, scope, selectedBranch)) continue;
    const key = ps.pos_transaction_id ?? `ser-${ps.id}`;
    if (posSeen.has(key)) continue;
    posSeen.add(key);
    const a = touch(inv.customer_code, ps.created_at);
    a.posCount += 1;
    bumpCategory("pos");
  }

  // Sales Orders
  const qualifyingOrdersById = new Map<number, string>();
  for (const ord of bundle.orders) {
    if (!ord.customer_code) continue;
    if (!isInScopeBranch(ord.branch_id, scope, selectedBranch)) continue;
    const lines = orderDetailsByOrder.get(Number(ord.order_id)) ?? [];
    const hasMatch = lines.some(
      (l) =>
        resolveQualifyingParentProductId(l.product_id, scope, selectedProduct) !==
        null
    );
    if (!hasMatch) continue;
    qualifyingOrdersById.set(Number(ord.order_id), ord.customer_code);

    const ordKey = extractDateKey(ord.order_date);
    if (ordKey && ordKey >= filters.startDate && ordKey <= filters.endDate) {
      const a = touch(ord.customer_code, ord.order_date);
      a.orderCount += 1;
      bumpCategory("order");
    }
  }

  // Payments (on qualifying industrial invoices)
  for (const pay of bundle.payments) {
    const inv = bundle.invoices.find(
      (i) => Number(i.invoice_id) === Number(pay.invoice_id)
    );
    if (!inv || !inv.customer_code) continue;
    if (!isInScopeBranch(inv.branch_id, scope, selectedBranch)) continue;
    // When product filter is active, only count payments on invoices matching that product
    if (
      selectedProduct !== "all" &&
      !qualifyingInvoicesById.has(Number(pay.invoice_id))
    ) {
      continue;
    }
    const amt = toNumberZero(pay.paid_amount);
    const a = touch(inv.customer_code, pay.date_paid);
    a.paymentCount += 1;
    a.totalPaymentAmount += amt;
    bumpCategory("payment");
    const tp = ensureTrend(pay.date_paid);
    if (tp) {
      tp.payments += 1;
      tp.paymentAmount += amt;
    }
  }

  // Dispatch plans
  const dispatchSeen = new Set<string>();
  for (const dpd of bundle.dispatchPlanDetails) {
    const dp = bundle.dispatchPlans.find(
      (d) => Number(d.dispatch_id) === Number(dpd.dispatch_id)
    );
    if (!dp || isTruthyFlag(dp.is_delete)) continue;
    if (!isInScopeBranch(dp.branch_id, scope, selectedBranch)) continue;
    const customerCode = qualifyingOrdersById.get(Number(dpd.sales_order_id));
    if (!customerCode) continue;
    const dedupe = `${dp.dispatch_id}:${customerCode}`;
    if (dispatchSeen.has(dedupe)) continue;
    dispatchSeen.add(dedupe);
    const a = touch(customerCode, dp.dispatch_date ?? dp.created_at);
    a.dispatchCount += 1;
    bumpCategory("dispatch");
  }

  // Returns
  for (const ret of bundle.returns) {
    if (ret.deleted_at || !ret.customer_code) continue;
    if (!isInScopeBranch(ret.branch_id, scope, selectedBranch)) continue;
    const lines = returnDetailsByNo.get(ret.return_number) ?? [];
    let qualifyingSum = 0;
    let hasMatch = false;
    for (const line of lines) {
      const parentId = resolveQualifyingParentProductId(
        line.product_id,
        scope,
        selectedProduct
      );
      if (parentId !== null) {
        hasMatch = true;
        qualifyingSum += toNumberZero(line.total_amount);
      }
    }
    if (!hasMatch) continue;
    const a = touch(ret.customer_code, ret.return_date);
    a.returnCount += 1;
    a.totalReturnAmount += qualifyingSum;
    bumpCategory("return");
    const tp = ensureTrend(ret.return_date);
    if (tp) {
      tp.returns += 1;
    }
  }

  // Memos (strict: applied to an in-scope industrial invoice)
  const validMemoMap = new Map(
    bundle.memos.filter((m) => !m.deleted_at).map((m) => [Number(m.id), m])
  );
  for (const link of bundle.memoInvoices) {
    if (!link.invoice_id || !link.memo_id) continue;
    if (!validMemoMap.has(Number(link.memo_id))) continue;
    const inv = bundle.invoices.find(
      (i) => Number(i.invoice_id) === Number(link.invoice_id)
    );
    if (!inv || !inv.customer_code) continue;
    if (!isInScopeBranch(inv.branch_id, scope, selectedBranch)) continue;
    if (
      selectedProduct !== "all" &&
      !qualifyingInvoicesById.has(Number(link.invoice_id))
    ) {
      continue;
    }
    const a = touch(inv.customer_code, link.date_applied);
    a.memoCount += 1;
    bumpCategory("memo");
  }

  // Assemble rows only for customers that exist in `customer` (and match customerStatus)
  // AND have at least 1 in-scope industrial activity in the applied window.
  const rows: CustomerHistoryRow[] = [];
  for (const c of bundle.customers) {
    const a = accMap.get(c.customer_code);
    if (!a) continue;
    const totalEvents =
      a.invoiceCount +
      a.posCount +
      a.orderCount +
      a.paymentCount +
      a.dispatchCount +
      a.returnCount +
      a.memoCount;
    if (totalEvents === 0) continue;

    const { salesmanName, salesmanCode } = resolveSalesmanForCustomer(
      Number(c.id),
      bundle.customerSalesmen,
      salesmanMap
    );

    rows.push({
      customerId: Number(c.id),
      customerCode: display(c.customer_code),
      customerName: display(c.customer_name),
      storeName: display(c.store_name),
      storeSignage: display(c.store_signage),
      type: c.type,
      classificationName:
        c.classification !== null && c.classification !== undefined
          ? classificationMap.get(Number(c.classification)) ?? "-"
          : "-",
      storeTypeName: storeTypeMap.get(Number(c.store_type)) ?? "-",
      salesmanName,
      salesmanCode,
      isActive: Number(c.isActive),
      dateEntered: c.date_entered,
      invoiceCount: a.invoiceCount,
      posCount: a.posCount,
      orderCount: a.orderCount,
      paymentCount: a.paymentCount,
      dispatchCount: a.dispatchCount,
      returnCount: a.returnCount,
      memoCount: a.memoCount,
      totalSalesAmount: a.totalSalesAmount,
      totalPaymentAmount: a.totalPaymentAmount,
      totalReturnAmount: a.totalReturnAmount,
      netSalesAmount: a.totalSalesAmount - a.totalReturnAmount,
      lastActivityAt: a.lastActivityAt,
      totalEvents,
    });
  }

  // Sort default by lastActivityAt desc
  rows.sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""));

  const kpis: CustomerHistoryKpis = rows.reduce(
    (acc, r) => ({
      totalCustomers: acc.totalCustomers + 1,
      totalInvoices: acc.totalInvoices + r.invoiceCount,
      totalPayments: acc.totalPayments + r.paymentCount,
      totalReturns: acc.totalReturns + r.returnCount,
      netSalesAmount: acc.netSalesAmount + r.netSalesAmount,
      totalEvents: acc.totalEvents + r.totalEvents,
    }),
    {
      totalCustomers: 0,
      totalInvoices: 0,
      totalPayments: 0,
      totalReturns: 0,
      netSalesAmount: 0,
      totalEvents: 0,
    }
  );

  const trend = Array.from(trendMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const categoryMix: CategoryMixPoint[] = Array.from(categoryCounts.entries())
    .map(([kind, count]) => ({
      kind,
      label: CATEGORY_LABELS[kind],
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const topCustomers: TopCustomerPoint[] = [...rows]
    .sort((a, b) => b.netSalesAmount - a.netSalesAmount)
    .slice(0, 8)
    .map((r) => ({
      customerCode: r.customerCode,
      customerName: r.customerName,
      netSalesAmount: r.netSalesAmount,
      totalEvents: r.totalEvents,
    }));

  return {
    ok: true,
    rows,
    kpis,
    trend,
    categoryMix,
    topCustomers,
    appliedFilters: filters,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Computes full Business Activity + Audit history for a single customer.
 */
export async function getCustomerHistoryDetail(
  customerCode: string,
  range: DetailRangePreset = "all",
  options: RepoOptions = {}
): Promise<CustomerHistoryDetailResponse | null> {
  const bundle = await readDetailSourceBundle(customerCode, options);
  if (!bundle.customer) return null;

  const scope = buildIndustrialScope(
    bundle.scopeMasters.branches,
    bundle.scopeMasters.products
  );

  const storeTypeMap = new Map<number, string>(
    bundle.storeTypes.map((st) => [Number(st.id), display(st.store_type)])
  );
  const classificationMap = new Map<number, string>(
    bundle.classifications.map((cl) => [Number(cl.id), display(cl.classification_name)])
  );
  const salesmanMap = new Map(
    bundle.salesmen.map((s) => [
      Number(s.id),
      { salesman_name: s.salesman_name, salesman_code: s.salesman_code },
    ])
  );

  const { salesmanName, salesmanCode } = resolveSalesmanForCustomer(
    Number(bundle.customer.id),
    bundle.customerSalesmen,
    salesmanMap
  );

  const c = bundle.customer;
  const addressParts = [
    [c.house_no, c.unit_building].map((x) => (x ?? "").trim()).filter(Boolean).join(" "),
    c.street,
    c.purok_sitio,
    c.subdivision,
    c.brgy,
    c.city,
    c.province,
    c.zip_code,
  ]
    .map((x) => (x ?? "").trim())
    .filter((x) => Boolean(x) && x !== "0");

  let coordinates = "-";
  if (c.location && typeof c.location === "object" && "coordinates" in c.location) {
    const coords = (c.location as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const lon = toNumberOrNull(coords[0]);
      const lat = toNumberOrNull(coords[1]);
      if (lat !== null && lon !== null) {
        coordinates = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      }
    }
  } else if (typeof c.location === "string" && c.location.trim()) {
    coordinates = c.location.trim();
  }

  const profile: CustomerProfileSummary = {
    id: Number(c.id),
    customerCode: display(c.customer_code),
    customerName: display(c.customer_name),
    type: c.type,
    customerImage: c.customer_image,
    storeName: display(c.store_name),
    storeSignage: display(c.store_signage),
    storeTypeName: storeTypeMap.get(Number(c.store_type)) ?? "-",
    classificationName:
      c.classification !== null && c.classification !== undefined
        ? classificationMap.get(Number(c.classification)) ?? "-"
        : "-",
    salesmanName,
    salesmanCode,
    contactNumber: display(c.contact_number),
    telNumber: display(c.tel_number),
    customerEmail: display(c.customer_email),
    address: addressParts.length > 0 ? addressParts.join(", ") : "-",
    coordinates,
    customerTin: display(c.customer_tin),
    isVAT: Number(c.isVAT),
    isEWT: Number(c.isEWT),
    paymentTerm: toNumberOrNull(c.payment_term),
    priceType: display(c.price_type),
    creditLimit: toNumberOrNull(c.credit_limit),
    dateEntered: c.date_entered,
    isActive: Number(c.isActive),
  };

  const streams = buildCustomerEventStreams({
    customer: c,
    scope,
    range,
    users: bundle.users,
    invoices: bundle.invoices,
    invoiceDetails: bundle.invoiceDetails,
    payments: bundle.payments,
    posSerials: bundle.posSerials,
    posTransactions: bundle.posTransactions,
    orders: bundle.orders,
    orderDetails: bundle.orderDetails,
    orderSerials: bundle.orderSerials,
    dispatchPlans: bundle.dispatchPlans,
    dispatchPlanDetails: bundle.dispatchPlanDetails,
    returns: bundle.returns,
    returnDetails: bundle.returnDetails,
    returnSerials: bundle.returnSerials,
    consolidatorMappings: bundle.consolidatorMappings,
    consolidatorDetails: bundle.consolidatorDetails,
    consolidators: bundle.consolidators,
    memos: bundle.memos,
    memoInvoices: bundle.memoInvoices,
    auditTrails: bundle.auditTrails,
    discountLogs: bundle.discountLogs,
  });

  // Compute summary, monthly series, and category mix from streams
  const counts: Record<EventKind, number> = {
    profile: 0,
    invoice: 0,
    pos: 0,
    order: 0,
    payment: 0,
    dispatch: 0,
    return: 0,
    serial: 0,
    consolidation: 0,
    memo: 0,
  };
  let totalSalesAmount = 0;
  let totalPaymentAmount = 0;
  let totalReturnAmount = 0;

  const monthlyMap = new Map<string, CustomerMonthlySeriesPoint>();

  for (const evt of streams.timeline) {
    counts[evt.kind] += 1;
    const amt = evt.amount ?? 0;
    if (evt.kind === "invoice") totalSalesAmount += amt;
    if (evt.kind === "payment") totalPaymentAmount += amt;
    if (evt.kind === "return") totalReturnAmount += amt;

    const key = extractDateKey(evt.occurredAt);
    if (key) {
      const monthKey = key.slice(0, 7);
      let m = monthlyMap.get(monthKey);
      if (!m) {
        const d = new Date(`${monthKey}-01T00:00:00`);
        const label = Number.isNaN(d.getTime())
          ? monthKey
          : d.toLocaleDateString("en-PH", { year: "numeric", month: "short" });
        m = {
          month: monthKey,
          label,
          salesAmount: 0,
          paymentAmount: 0,
          returnAmount: 0,
          eventCount: 0,
        };
        monthlyMap.set(monthKey, m);
      }
      m.eventCount += 1;
      if (evt.kind === "invoice") m.salesAmount += amt;
      if (evt.kind === "payment") m.paymentAmount += amt;
      if (evt.kind === "return") m.returnAmount += amt;
    }
  }

  const summary: CustomerDetailSummary = {
    totalTransactions: streams.timeline.length,
    invoiceCount: counts.invoice,
    posCount: counts.pos,
    orderCount: counts.order,
    paymentCount: counts.payment,
    dispatchCount: counts.dispatch,
    returnCount: counts.return,
    serialCount: counts.serial,
    consolidationCount: counts.consolidation,
    memoCount: counts.memo,
    auditCount: streams.audit.length,
    totalSalesAmount,
    totalPaymentAmount,
    totalReturnAmount,
    netSalesAmount: totalSalesAmount - totalReturnAmount,
  };

  const monthlySeries = Array.from(monthlyMap.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  const categoryMix: CategoryMixPoint[] = (Object.keys(counts) as EventKind[])
    .filter((k) => counts[k] > 0)
    .map((kind) => ({
      kind,
      label: CATEGORY_LABELS[kind],
      count: counts[kind],
    }))
    .sort((a, b) => b.count - a.count);

  return {
    ok: true,
    profile,
    summary,
    timeline: streams.timeline,
    transactions: streams.transactions,
    logistics: streams.logistics,
    notes: streams.notes,
    audit: streams.audit,
    monthlySeries,
    categoryMix,
    appliedRange: range,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Returns strictly scoped lookup options for the filter bar:
 * - branch: division_id = 1 AND isActive = 1
 * - product: parent_id IS NULL AND is_serialized = 1, label = products.description
 */
export async function getCustomerHistoryLookups(
  type: "branch" | "product",
  query = "",
  options: RepoOptions = {}
): Promise<LookupOption[]> {
  const scopeMasters = await readScopeMasters(options);
  const scope = buildIndustrialScope(scopeMasters.branches, scopeMasters.products);
  const q = query.trim().toLowerCase();

  if (type === "branch") {
    return Array.from(scope.branchMap.values())
      .filter(
        (b) =>
          !q ||
          b.branch_name.toLowerCase().includes(q) ||
          b.branch_code.toLowerCase().includes(q)
      )
      .sort((a, b) => a.branch_name.localeCompare(b.branch_name))
      .map((b) => ({
        value: String(b.id),
        label: `${b.branch_name} (${b.branch_code})`,
        code: b.branch_code,
      }));
  }

  return Array.from(scope.parentProductMap.values())
    .filter((p) => {
      const desc = (p.description ?? "").toLowerCase();
      const code = (p.product_code ?? "").toLowerCase();
      return !q || desc.includes(q) || code.includes(q);
    })
    .sort((a, b) => (a.description ?? "").localeCompare(b.description ?? ""))
    .map((p) => ({
      value: String(p.product_id),
      // Per ids-guide: show products.description as product name
      label: p.description ? p.description : display(p.product_code),
      code: display(p.product_code),
    }));
}
