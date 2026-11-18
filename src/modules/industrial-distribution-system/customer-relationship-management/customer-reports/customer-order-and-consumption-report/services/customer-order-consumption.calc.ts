// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/services/customer-order-consumption.calc.ts
// ============================================================
// Core Pure Aggregation Engine:
// Groups by Customer (Main Group) with nested Product breakdowns.
// Strict Scope Rules:
// - ONLY products with is_serialized = 1 are processed
// - ONLY products in categories with is_industrial = 1 are processed
// - Non-serialized products (groceries, snacks, sanitizers) are strictly excluded
// - products.description used as product name
// - branches filtered by division_id = 1
// ============================================================

import type {
  ConsumptionSourceData,
  CustomerOrderConsumptionFilters,
  CustomerOrderConsumptionOverview,
  CustomerOrderConsumptionRow,
  MonthlyTrendPoint,
  ProductConsumptionSummary,
  RawBranchRow,
  RawCategoryRow,
  RawClassificationRow,
  RawCustomerRow,
  RawLpgSiteRow,
  RawProductRow,
  RawSalesmanRow,
  ReportException,
  ReportTrendPoint,
} from "../types/customer-order-consumption.types";
import { evaluateCylinderProduct, resolveCylinderSizeKg } from "./customer-order-consumption.cylinder-calc";
import {
  classifyUnifiedLpgTransaction,
  LPG_METERED_PRODUCT_ID,
  LPG_WIWO_PRODUCT_ID,
} from "./customer-order-consumption.lpg-calc";
import {
  computeReturnRate,

  isTruthyFlag,
  monthKey,
  normalizeStatus,
  safeRatio,
  toNumber,
} from "./customer-order-consumption.helpers";

export interface ConsumptionContext {
  products: Map<number, RawProductRow>;
  categories: Map<number, RawCategoryRow>;
  customers: Map<string, RawCustomerRow>;
  classifications: Map<number, RawClassificationRow>;
  branches: Map<number, RawBranchRow>;
  salesmen: Map<number, RawSalesmanRow>;
  lpgSites: Map<number, RawLpgSiteRow>;
}

export function buildContext(source: ConsumptionSourceData): ConsumptionContext {
  return {
    products: new Map(
      source.products.map((row) => [Number(row.product_id), row])
    ),
    categories: new Map(source.categories.map((row) => [Number(row.category_id), row])),
    customers: new Map(source.customers.map((row) => [String(row.customer_code), row])),
    classifications: new Map(source.classifications.map((row) => [Number(row.id), row])),
    branches: new Map(source.branches.map((row) => [Number(row.id), row])),
    salesmen: new Map(source.salesmen.map((row) => [Number(row.id), row])),
    lpgSites: new Map(source.lpgSites.map((site) => [Number(site.id), site])),
  };
}

interface ProductAccumulator {
  productId: number;
  channel: "CYLINDER" | "LPG";
  hasMetered?: boolean;
  hasWiwo?: boolean;
  orderKeys: Set<string>;
  grossQty: number;
  returnedQty: number;
  grossKg: number;
  returnedKg: number;
  netAmount: number;
  // Movement-level channel attribution so Metered/WIWO LPG kg stays accurately reported in
  // KPI overview and Monthly Trend Analytics even when merged onto a real Parent Product.
  cylinderOrderKeys: Set<string>;
  cylinderGrossQty: number;
  cylinderReturnedQty: number;
  cylinderGrossKg: number;
  cylinderReturnedKg: number;
  cylinderNetAmount: number;
  lpgOrderKeys: Set<string>;
  lpgGrossKg: number;
  lpgReturnedKg: number;
  lpgNetAmount: number;
  monthlyTrend: Map<string, MonthlyTrendPoint>;
  channelMonthlyTrend: Map<string, ReportTrendPoint>;
  exceptionCodes: Set<string>;
}

interface CustomerAccumulator {
  customerCode: string;
  branchId: number | null;
  customerOrderKeys: Set<string>;
  products: Map<number, ProductAccumulator>;
  customerMonthlyTrend: Map<string, MonthlyTrendPoint>;
  exceptionCodes: Set<string>;
}

export function aggregateCustomerOrderConsumption(
  source: ConsumptionSourceData,
  filters?: Partial<CustomerOrderConsumptionFilters>
): {
  rows: CustomerOrderConsumptionRow[];
  exceptions: ReportException[];
  overview: CustomerOrderConsumptionOverview;
  overallTrend: ReportTrendPoint[];
} {
  const context = buildContext(source);
  const exceptions: ReportException[] = [];
  const customerMap = new Map<string, CustomerAccumulator>();

  // Multi-select filter gates (branches filtered to division_id = 1, categories to is_industrial = 1)
  const industrialBranchIds =
    context.branches.size > 0 ? new Set<number>(context.branches.keys()) : null;
  const selectedBranchIds =
    filters?.branchIds && filters.branchIds.length > 0
      ? new Set<number>(filters.branchIds.map(Number))
      : null;
  const selectedCategoryIds =
    filters?.categoryIds && filters.categoryIds.length > 0
      ? new Set<number>(filters.categoryIds.map(Number))
      : null;

  /**
   * Validates whether a document's branch_id belongs to the authorized industrial scope
   * (division_id = 1) and matches any user-selected multi-select branches.
   */
  const isBranchAllowed = (
    branchId: number | null | undefined,
    allowNullWhenUnfiltered = false
  ): boolean => {
    const numId = branchId != null ? Number(branchId) : NaN;
    const hasBranch = Number.isFinite(numId) && numId > 0;
    if (selectedBranchIds) {
      if (!hasBranch) return false;
      if (!selectedBranchIds.has(numId)) return false;
      if (industrialBranchIds && !industrialBranchIds.has(numId)) return false;
      return true;
    }
    if (!hasBranch) {
      return allowNullWhenUnfiltered;
    }
    if (industrialBranchIds && !industrialBranchIds.has(numId)) {
      return false;
    }
    return true;
  };

  /** Validates whether a product's category_id matches any user-selected multi-select cylinder sizes. */
  const isCategoryAllowed = (categoryId: number | null | undefined): boolean => {
    if (!selectedCategoryIds) return true;
    if (categoryId == null) return false;
    return selectedCategoryIds.has(Number(categoryId));
  };

  function getOrCreateCustomer(customerCode: string, branchId: number | null): CustomerAccumulator {
    const key = `${customerCode}|${branchId ?? 0}`;
    let cust = customerMap.get(key);
    if (!cust) {
      cust = {
        customerCode,
        branchId,
        customerOrderKeys: new Set<string>(),
        products: new Map<number, ProductAccumulator>(),
        customerMonthlyTrend: new Map<string, MonthlyTrendPoint>(),
        exceptionCodes: new Set<string>(),
      };
      customerMap.set(key, cust);
    }
    return cust;
  }

  function getOrCreateProductAcc(
    cust: CustomerAccumulator,
    productId: number,
    channel: "CYLINDER" | "LPG"
  ): ProductAccumulator {
    let p = cust.products.get(productId);
    if (!p) {
      p = {
        productId,
        channel,
        orderKeys: new Set<string>(),
        grossQty: 0,
        returnedQty: 0,
        grossKg: 0,
        returnedKg: 0,
        netAmount: 0,
        cylinderOrderKeys: new Set<string>(),
        cylinderGrossQty: 0,
        cylinderReturnedQty: 0,
        cylinderGrossKg: 0,
        cylinderReturnedKg: 0,
        cylinderNetAmount: 0,
        lpgOrderKeys: new Set<string>(),
        lpgGrossKg: 0,
        lpgReturnedKg: 0,
        lpgNetAmount: 0,
        monthlyTrend: new Map<string, MonthlyTrendPoint>(),
        channelMonthlyTrend: new Map<string, ReportTrendPoint>(),
        exceptionCodes: new Set<string>(),
      };
      cust.products.set(productId, p);
    }
    return p;
  }

  /**
   * Records a monthly movement point into both the product's combined monthlyTrend
   * and its channel-specific channelMonthlyTrend ("CYLINDER" vs "LPG").
   */
  function recordMonthlyMovement(
    prodAcc: ProductAccumulator,
    channel: "CYLINDER" | "LPG",
    dateValue: string | null | undefined,
    delta: {
      grossQty?: number;
      returnedQty?: number;
      grossKg?: number;
      returnedKg?: number;
      orderKey?: string;
    }
  ): void {
    const mKey = monthKey(dateValue) ?? "UNKNOWN";
    if (mKey === "UNKNOWN") return;

    // Combined product-level monthly trend
    let prodTrend = prodAcc.monthlyTrend.get(mKey);
    if (!prodTrend) {
      prodTrend = {
        yearMonth: mKey,
        orderCount: 0,
        orderKeys: [],
        grossQty: 0,
        returnedQty: 0,
        grossKg: 0,
        returnedKg: 0,
        netKg: 0,
      };
      prodAcc.monthlyTrend.set(mKey, prodTrend);
    }
    prodTrend.grossQty += delta.grossQty ?? 0;
    prodTrend.returnedQty += delta.returnedQty ?? 0;
    prodTrend.grossKg += delta.grossKg ?? 0;
    prodTrend.returnedKg += delta.returnedKg ?? 0;
    prodTrend.netKg = prodTrend.grossKg - prodTrend.returnedKg;
    if (delta.orderKey && !prodTrend.orderKeys.includes(delta.orderKey)) {
      prodTrend.orderKeys.push(delta.orderKey);
      prodTrend.orderCount = prodTrend.orderKeys.length;
    }

    // Channel-attributed monthly trend (powers Monthly Trend Analytics CYLINDER vs Metered/WIWO LPG bars)
    const chKey = `${mKey}|${channel}`;
    let chTrend = prodAcc.channelMonthlyTrend.get(chKey);
    if (!chTrend) {
      chTrend = {
        yearMonth: mKey,
        channel,
        orderCount: 0,
        orderKeys: [],
        grossQty: 0,
        returnedQty: 0,
        grossKg: 0,
        returnedKg: 0,
        netKg: 0,
      };
      prodAcc.channelMonthlyTrend.set(chKey, chTrend);
    }
    chTrend.grossQty += delta.grossQty ?? 0;
    chTrend.returnedQty += delta.returnedQty ?? 0;
    chTrend.grossKg += delta.grossKg ?? 0;
    chTrend.returnedKg += delta.returnedKg ?? 0;
    chTrend.netKg = chTrend.grossKg - chTrend.returnedKg;
    if (delta.orderKey && !chTrend.orderKeys.includes(delta.orderKey)) {
      chTrend.orderKeys.push(delta.orderKey);
      chTrend.orderCount = chTrend.orderKeys.length;
    }
  }

  // Helper: Parent products only (parent_id IS NULL / 0) — excludes child variants like EMPTY, SWAP, DEPOSIT
  const isParentProduct = (product: RawProductRow | undefined): boolean =>
    Boolean(product && (product.parent_id == null || Number(product.parent_id) <= 0));

  // Helper: Resolve any product (or child variant referenced on an LPG order/invoice) up to its in-scope Parent Product ID
  const resolveParentProductId = (rawProductId: number | string | null | undefined): number | null => {
    if (rawProductId == null) return null;
    const pid = Number(rawProductId);
    const p = context.products.get(pid);
    if (!p) return null;
    const rootId = p.parent_id != null && Number(p.parent_id) > 0 ? Number(p.parent_id) : pid;
    const root = context.products.get(rootId);
    if (!root || !isTruthyFlag(root.is_serialized) || !isParentProduct(root)) return null;
    const cat = root.product_category != null ? context.categories.get(Number(root.product_category)) : undefined;
    if (!cat || !isTruthyFlag(cat.is_industrial)) return null;
    return Number(root.product_id);
  };

  // Build Sales Order canonical lookup (supports both order_no strings and numeric order_id keys)
  const salesOrderKeyMap = new Map<string, string>();
  const salesOrderNoById = new Map<number, string>();
  const salesOrderBranchMap = new Map<string, number>();
  for (const so of source.salesOrders) {
    const canonical = (so.order_no && so.order_no.trim()) || `SO-${so.order_id}`;
    const soBranchId = so.branch_id != null && Number(so.branch_id) > 0 ? Number(so.branch_id) : null;
    if (so.order_no && so.order_no.trim()) {
      const trimmedNo = so.order_no.trim();
      salesOrderKeyMap.set(trimmedNo, canonical);
      if (soBranchId != null) salesOrderBranchMap.set(trimmedNo, soBranchId);
    }
    if (so.order_id != null) {
      const idStr = String(so.order_id).trim();
      salesOrderKeyMap.set(idStr, canonical);
      salesOrderNoById.set(Number(so.order_id), canonical);
      if (soBranchId != null) salesOrderBranchMap.set(idStr, soBranchId);
    }
  }

  // Invoice lookups & consolidated LPG header -> invoice bridge
  const invoiceMap = new Map(source.invoices.map((inv) => [Number(inv.invoice_id), inv]));
  const invoiceByNoMap = new Map(
    source.invoices
      .filter((inv) => Boolean(inv.invoice_no))
      .map((inv) => [String(inv.invoice_no).trim(), inv])
  );
  const headerInvoiceByHeaderId = new Map<number, number>();
  for (const hi of source.headerInvoices ?? []) {
    if (hi.header_id && hi.sales_invoice_id) {
      headerInvoiceByHeaderId.set(Number(hi.header_id), Number(hi.sales_invoice_id));
    }
  }

  const resolveLpgInvoice = (
    salesInvoiceId: number | null | undefined,
    salesInvoiceNo: string | null | undefined,
    transactionHeaderId?: number | null
  ) => {
    const bridgedInvId =
      salesInvoiceId ??
      (transactionHeaderId != null
        ? headerInvoiceByHeaderId.get(Number(transactionHeaderId)) ?? null
        : null);
    const inv =
      (bridgedInvId != null ? invoiceMap.get(Number(bridgedInvId)) : undefined) ??
      (salesInvoiceNo && salesInvoiceNo.trim()
        ? invoiceByNoMap.get(salesInvoiceNo.trim())
        : undefined);
    return {
      invoice: inv,
      invoiceId: bridgedInvId ?? (inv ? Number(inv.invoice_id) : null),
      invoiceNo: (salesInvoiceNo && salesInvoiceNo.trim()) || inv?.invoice_no || null,
      branchId: inv?.branch_id ?? null,
    };
  };

  // Pre-index invoices governed by POSTED lpg_metered_wiwo_transactions so Step 1 doesn't double-count nominal cylinder kg
  const lpgInvoiceStatusMap = new Map<number, "BASELINE" | "REGULAR">();
  for (const tx of source.unifiedLpg) {
    if (normalizeStatus(tx.status) !== "posted") continue;
    const site = context.lpgSites.get(Number(tx.lpg_site_id));
    const classified = classifyUnifiedLpgTransaction(tx, site);
    const linked = resolveLpgInvoice(tx.sales_invoice_id, tx.sales_invoice_no, tx.transaction_header_id);
    if (linked.invoiceId != null) {
      if (classified.isOnboardingBaseline) {
        if (!lpgInvoiceStatusMap.has(linked.invoiceId)) {
          lpgInvoiceStatusMap.set(linked.invoiceId, "BASELINE");
        }
      } else {
        lpgInvoiceStatusMap.set(linked.invoiceId, "REGULAR");
      }
    }
  }

  // Pre-index real Parent Product IDs for Invoices, Sales Orders, and WIWO headers so LPG rows attach to their actual Parent Product
  const invoiceParentProductMap = new Map<number, number>();
  for (const d of source.invoiceDetails) {
    const invId = Number(d.invoice_no);
    if (!invoiceParentProductMap.has(invId)) {
      const parentPid = resolveParentProductId(d.product_id);
      if (parentPid != null) invoiceParentProductMap.set(invId, parentPid);
    }
  }

  const orderParentProductMap = new Map<string, number>();
  for (const d of source.salesOrderDetails) {
    const parentPid = resolveParentProductId(d.product_id);
    if (parentPid == null) continue;
    const numId = Number(d.order_id);
    if (!orderParentProductMap.has(String(numId))) {
      orderParentProductMap.set(String(numId), parentPid);
    }
    const orderNo = salesOrderNoById.get(numId);
    if (orderNo && !orderParentProductMap.has(orderNo)) {
      orderParentProductMap.set(orderNo, parentPid);
    }
  }

  const wiwoParentProductMap = new Map<number, number>();
  for (const d of source.wiwoDetails) {
    const wid = Number(d.wiwo_header_id);
    if (!wiwoParentProductMap.has(wid)) {
      const parentPid = resolveParentProductId(d.product_id);
      if (parentPid != null) wiwoParentProductMap.set(wid, parentPid);
    }
  }

  // 1. Process Sales Invoices & Details (Cylinder Channel — Parent Products Only)
  for (const detail of source.invoiceDetails) {
    const inv = invoiceMap.get(Number(detail.invoice_no));
    if (!inv) continue;

    // Reject voided/cancelled
    const status = normalizeStatus(inv.transaction_status);
    if (status === "cancelled" || status === "voided" || isTruthyFlag(inv.isReplaced)) {
      continue;
    }

    // Strict Branch Scope Gate: division_id = 1 industrial branches + user-selected multi-select branches
    if (!isBranchAllowed(inv.branch_id, false)) {
      continue;
    }

    // STRICT SCOPE GATE: Product must exist, be serialized, be a PARENT product (parent_id IS NULL), and industrial!
    const product = context.products.get(Number(detail.product_id));
    if (!product || !isTruthyFlag(product.is_serialized) || !isParentProduct(product)) {
      // Non-serialized items and child variants (e.g. EMPTY, SWAP) -> strictly excluded
      continue;
    }

    const category = product.product_category != null ? context.categories.get(Number(product.product_category)) : undefined;
    if (!category || !isTruthyFlag(category.is_industrial)) {
      // Non-industrial category -> strictly excluded
      continue;
    }

    // Multi-select Cylinder Size (categoryIds) filter
    if (!isCategoryAllowed(category.category_id)) {
      continue;
    }

    // Check if this invoice is governed by a POSTED Metered / WIWO LPG transaction
    const lpgInvStatus = lpgInvoiceStatusMap.get(Number(inv.invoice_id));
    if (lpgInvStatus === "BASELINE") {
      // Onboarding baseline delivery is not consumption
      continue;
    }

    const customerCode = inv.customer_code ?? "UNKNOWN";
    const branchId = inv.branch_id;
    const custProfile = context.customers.get(customerCode);
    const customerName = custProfile?.customer_name ?? customerCode;

    const cust = getOrCreateCustomer(customerCode, branchId);

    const evalRes = evaluateCylinderProduct(
      product,
      category,
      customerCode,
      customerName,
      "SALES_INVOICE",
      inv.invoice_no ?? String(inv.invoice_id)
    );

    if (evalRes.exceptions.length > 0) {
      exceptions.push(...evalRes.exceptions);
      for (const e of evalRes.exceptions) {
        cust.exceptionCodes.add(e.code);
      }
    }

    const rawOrderRef = inv.order_id != null ? String(inv.order_id).trim() : "";
    const resolvedOrderKey =
      (rawOrderRef ? salesOrderKeyMap.get(rawOrderRef) ?? rawOrderRef : "") ||
      inv.invoice_no ||
      String(inv.invoice_id);
    cust.customerOrderKeys.add(resolvedOrderKey);

    const prodAcc = getOrCreateProductAcc(cust, Number(detail.product_id), "CYLINDER");
    prodAcc.orderKeys.add(resolvedOrderKey);

    const qty = toNumber(detail.quantity, 0);
    // When invoice is governed by a POSTED Metered/WIWO LPG transaction, Step 3 adds the authoritative
    // reconciled billable_kg and net_amount onto this same Parent Product under channel "LPG" (prevents double-counting!)
    const isLpgGoverned = lpgInvStatus === "REGULAR";
    const lineKg = isLpgGoverned ? 0 : qty * evalRes.effectiveKgPerUnit;
    const lineAmt = isLpgGoverned ? 0 : toNumber(detail.total_amount || detail.gross_amount, 0);

    prodAcc.grossQty += qty;
    prodAcc.grossKg += lineKg;
    prodAcc.netAmount += lineAmt;

    if (!isLpgGoverned) {
      prodAcc.cylinderOrderKeys.add(resolvedOrderKey);
      prodAcc.cylinderGrossQty += qty;
      prodAcc.cylinderGrossKg += lineKg;
      prodAcc.cylinderNetAmount += lineAmt;
      recordMonthlyMovement(prodAcc, "CYLINDER", inv.invoice_date, {
        grossQty: qty,
        grossKg: lineKg,
        orderKey: resolvedOrderKey,
      });
    } else {
      // Track fulfilled cylinder pieces without double-counting nominal kg into CYLINDER channel
      prodAcc.cylinderGrossQty += qty;
    }
  }

  // 2. Process Sales Returns (Deducted from gross purchases — Parent Products Only)
  const returnNumberMap = new Map(source.returns.map((ret) => [ret.return_number, ret]));

  for (const detail of source.returnDetails) {
    const ret = returnNumberMap.get(detail.return_no);
    if (!ret) continue;

    const status = normalizeStatus(ret.status);
    if (status === "cancelled" || status === "voided" || status === "rejected") {
      continue;
    }

    // Strict Branch Scope Gate
    if (!isBranchAllowed(ret.branch_id, false)) {
      continue;
    }

    // STRICT SCOPE GATE: Product must exist, be serialized, be a PARENT product, and belong to an industrial category!
    const product = context.products.get(Number(detail.product_id));
    if (!product || !isTruthyFlag(product.is_serialized) || !isParentProduct(product)) {
      continue;
    }

    const category = product.product_category != null ? context.categories.get(Number(product.product_category)) : undefined;
    if (!category || !isTruthyFlag(category.is_industrial)) {
      continue;
    }

    // Multi-select Cylinder Size (categoryIds) filter
    if (!isCategoryAllowed(category.category_id)) {
      continue;
    }

    const customerCode = ret.customer_code ?? "UNKNOWN";
    const branchId = ret.branch_id;
    const custProfile = context.customers.get(customerCode);
    const customerName = custProfile?.customer_name ?? customerCode;

    const cust = getOrCreateCustomer(customerCode, branchId);

    const evalRes = evaluateCylinderProduct(
      product,
      category,
      customerCode,
      customerName,
      "SALES_RETURN",
      ret.return_number
    );

    const prodAcc = getOrCreateProductAcc(cust, detail.product_id, "CYLINDER");
    const qty = toNumber(detail.quantity, 0);
    const lineKg = qty * evalRes.effectiveKgPerUnit;

    prodAcc.returnedQty += qty;
    prodAcc.returnedKg += lineKg;
    prodAcc.cylinderReturnedQty += qty;
    prodAcc.cylinderReturnedKg += lineKg;

    recordMonthlyMovement(prodAcc, "CYLINDER", ret.return_date, {
      returnedQty: qty,
      returnedKg: lineKg,
    });
  }

  // 3. Process LPG Consumptions (Unified Ledger -> Uncovered WIWO -> Uncovered Metered)
  // Traces each LPG transaction -> linked sales_invoice -> linked sales_order -> real Parent Product.
  const resolveLpgTargetProductId = (
    linkedInvId: number | null,
    rawSoRef: string,
    wiwoHeaderId: number | null | undefined,
    fallbackSyntheticId: number
  ): number => {
    if (linkedInvId != null) {
      const fromInv = invoiceParentProductMap.get(linkedInvId);
      if (fromInv != null) return fromInv;
    }
    if (rawSoRef) {
      const trimmed = rawSoRef.trim();
      const canonicalSo = salesOrderKeyMap.get(trimmed) ?? trimmed;
      const fromOrder =
        orderParentProductMap.get(canonicalSo) ?? orderParentProductMap.get(trimmed);
      if (fromOrder != null) return fromOrder;
    }
    if (wiwoHeaderId != null) {
      const fromWiwo = wiwoParentProductMap.get(Number(wiwoHeaderId));
      if (fromWiwo != null) return fromWiwo;
    }
    return fallbackSyntheticId;
  };

  const addLpgTrendPoint = (
    prodAcc: ProductAccumulator,
    dateValue: string | null | undefined,
    kg: number,
    orderKey: string
  ) => {
    recordMonthlyMovement(prodAcc, "LPG", dateValue, {
      grossKg: kg,
      orderKey,
    });
  };

  const resolveLpgBranchId = (
    invoiceBranchId: number | null | undefined,
    rawSoRef: string
  ): number | null => {
    if (invoiceBranchId != null && Number(invoiceBranchId) > 0) {
      return Number(invoiceBranchId);
    }
    if (rawSoRef) {
      const trimmed = rawSoRef.trim();
      const canonical = salesOrderKeyMap.get(trimmed) ?? trimmed;
      return salesOrderBranchMap.get(canonical) ?? salesOrderBranchMap.get(trimmed) ?? null;
    }
    return null;
  };

  const coveredWiwoIds = new Set<number>();
  const coveredMeterIds = new Set<number>();

  // 3a. Unified Ledger: lpg_metered_wiwo_transactions (billable_source = METERED | WIWO)
  for (const tx of source.unifiedLpg) {
    if (normalizeStatus(tx.status) !== "posted") continue;
    const site = context.lpgSites.get(Number(tx.lpg_site_id));
    const classified = classifyUnifiedLpgTransaction(tx, site);

    // Track covered child records even for onboarding baselines so standalone headers don't double-count
    if (tx.wiwo_header_id != null) coveredWiwoIds.add(Number(tx.wiwo_header_id));
    if (tx.meter_reading_id != null) coveredMeterIds.add(Number(tx.meter_reading_id));

    // Onboarding baseline fills and zero-consumption rows are excluded
    if (classified.isOnboardingBaseline) continue;
    const txAmount = toNumber(tx.net_amount ?? tx.gross_amount, 0);
    if (classified.effectiveKg <= 0 && txAmount <= 0) continue;

    const customerCode = tx.customer_code;
    const linkedInv = resolveLpgInvoice(
      tx.sales_invoice_id,
      tx.sales_invoice_no,
      tx.transaction_header_id
    );
    const rawSoRef = String(
      tx.sales_order_no ||
        (tx.sales_order_id != null ? String(tx.sales_order_id) : "") ||
        linkedInv.invoice?.order_id ||
        ""
    ).trim();

    // Enforce authorized industrial branch scope + multi-select branchIds filter
    const resolvedBranchId = resolveLpgBranchId(linkedInv.branchId, rawSoRef);
    if (!isBranchAllowed(resolvedBranchId, true)) continue;

    // Resolve to real Parent Product via linked sales_invoice -> sales_order -> parent product
    const targetProductId = resolveLpgTargetProductId(
      linkedInv.invoiceId,
      rawSoRef,
      tx.wiwo_header_id,
      classified.syntheticProductId
    );
    const resolvedProduct = context.products.get(targetProductId);

    // Enforce multi-select Cylinder Size (categoryIds) filter
    if (!isCategoryAllowed(resolvedProduct?.product_category)) continue;

    const cust = getOrCreateCustomer(customerCode, resolvedBranchId);

    const orderKey =
      (rawSoRef ? salesOrderKeyMap.get(rawSoRef) ?? rawSoRef : "") ||
      linkedInv.invoiceNo ||
      tx.transaction_no;
    cust.customerOrderKeys.add(orderKey);

    const targetChannel: "CYLINDER" | "LPG" = targetProductId > 0 ? "CYLINDER" : "LPG";

    const prodAcc = getOrCreateProductAcc(cust, targetProductId, targetChannel);
    if (classified.mode === "METERED") prodAcc.hasMetered = true;
    else prodAcc.hasWiwo = true;
    prodAcc.orderKeys.add(orderKey);
    prodAcc.grossKg += classified.effectiveKg;
    prodAcc.netAmount += txAmount;
    // Always attribute Metered/WIWO kg & amount to the LPG channel for KPIs & Monthly Trends
    prodAcc.lpgOrderKeys.add(orderKey);
    prodAcc.lpgGrossKg += classified.effectiveKg;
    prodAcc.lpgNetAmount += txAmount;
    addLpgTrendPoint(prodAcc, tx.transaction_date, classified.effectiveKg, orderKey);

    const resolvedProdLabel =
      resolvedProduct?.description || resolvedProduct?.product_name || classified.productName;

    // Flag >5% variance when both metered and WIWO readings exist on the unified transaction
    if (classified.variancePct > 5) {
      exceptions.push({
        code: "LPG_VARIANCE",
        channel: "LPG",
        customerCode,
        customerName: context.customers.get(customerCode)?.customer_name ?? customerCode,
        productName: resolvedProdLabel,
        referenceType: classified.mode === "METERED" ? "METER_READING" : "WIWO",
        referenceNo: tx.transaction_no,
        detail: `Metered vs WIWO variance of ${classified.varianceKg} kg (${classified.variancePct}%) exceeds 5% tolerance${tx.variance_reason_code && tx.variance_reason_code !== "NONE" ? ` (${tx.variance_reason_code})` : ""}.`,
        quantity: 0,
        kg: classified.varianceKg,
      });
      prodAcc.exceptionCodes.add("LPG_VARIANCE");
      cust.exceptionCodes.add("LPG_VARIANCE");
    }

    if (!linkedInv.invoiceId && !linkedInv.invoiceNo) {
      exceptions.push({
        code: "UNBILLED_LPG_TRANSACTION",
        channel: "LPG",
        customerCode,
        customerName: context.customers.get(customerCode)?.customer_name ?? customerCode,
        productName: resolvedProdLabel,
        referenceType: classified.mode === "METERED" ? "METER_READING" : "WIWO",
        referenceNo: tx.transaction_no,
        detail: `Posted ${classified.mode === "METERED" ? "Metered" : "WIWO (Kg)"} LPG transaction ${tx.transaction_no} has no linked sales invoice.`,
        quantity: 0,
        kg: classified.effectiveKg,
      });
      prodAcc.exceptionCodes.add("UNBILLED_LPG_TRANSACTION");
      cust.exceptionCodes.add("UNBILLED_LPG_TRANSACTION");
    }
  }

  // 3b. Standalone WIWO headers not already covered by lpg_metered_wiwo_transactions -> WIWO (Kg)
  for (const wiwo of source.wiwoHeaders) {
    if (coveredWiwoIds.has(Number(wiwo.id))) continue;
    if (normalizeStatus(wiwo.wiwo_status) !== "posted") continue;
    const billableKg = toNumber(wiwo.total_billable_kg, 0);
    const amt = toNumber(wiwo.net_amount ?? wiwo.gross_amount, 0);
    if (billableKg <= 0 && amt <= 0) continue;

    const customerCode = wiwo.customer_code;
    const linkedInv = resolveLpgInvoice(wiwo.sales_invoice_id, wiwo.sales_invoice_no);
    const rawSoRef = String(linkedInv.invoice?.order_id || "").trim();

    const resolvedBranchId = resolveLpgBranchId(linkedInv.branchId, rawSoRef);
    if (!isBranchAllowed(resolvedBranchId, true)) continue;

    const targetProductId = resolveLpgTargetProductId(
      linkedInv.invoiceId,
      rawSoRef,
      wiwo.id,
      LPG_WIWO_PRODUCT_ID
    );
    const resolvedProduct = context.products.get(targetProductId);
    if (!isCategoryAllowed(resolvedProduct?.product_category)) continue;

    const cust = getOrCreateCustomer(customerCode, resolvedBranchId);

    const orderKey =
      (rawSoRef ? salesOrderKeyMap.get(rawSoRef) ?? rawSoRef : "") ||
      linkedInv.invoiceNo ||
      wiwo.wiwo_no;
    cust.customerOrderKeys.add(orderKey);

    const targetChannel: "CYLINDER" | "LPG" = targetProductId > 0 ? "CYLINDER" : "LPG";

    const prodAcc = getOrCreateProductAcc(cust, targetProductId, targetChannel);
    prodAcc.hasWiwo = true;
    prodAcc.orderKeys.add(orderKey);
    prodAcc.grossKg += billableKg;
    prodAcc.netAmount += amt;
    prodAcc.lpgOrderKeys.add(orderKey);
    prodAcc.lpgGrossKg += billableKg;
    prodAcc.lpgNetAmount += amt;
    addLpgTrendPoint(prodAcc, wiwo.transaction_date, billableKg, orderKey);

    if (!linkedInv.invoiceId && !linkedInv.invoiceNo) {
      exceptions.push({
        code: "UNBILLED_LPG_TRANSACTION",
        channel: "LPG",
        customerCode,
        customerName: context.customers.get(customerCode)?.customer_name ?? customerCode,
        productName:
          resolvedProduct?.description || "LPG WIWO (Kg) Consumption",
        referenceType: "WIWO",
        referenceNo: wiwo.wiwo_no,
        detail: `Posted WIWO (Kg) transaction ${wiwo.wiwo_no} has no linked sales invoice.`,
        quantity: 0,
        kg: billableKg,
      });
      prodAcc.exceptionCodes.add("UNBILLED_LPG_TRANSACTION");
      cust.exceptionCodes.add("UNBILLED_LPG_TRANSACTION");
    }
  }

  // 3c. Standalone Meter Readings not already covered by lpg_metered_wiwo_transactions -> Metered
  for (const meter of source.meterReadings) {
    if (coveredMeterIds.has(Number(meter.id))) continue;
    if (normalizeStatus(meter.reading_status) !== "posted") continue;
    const consumedKg = toNumber(meter.kg_consumed, 0);
    const amt = toNumber(meter.net_amount ?? meter.gross_amount, 0);
    if (consumedKg <= 0 && amt <= 0) continue;

    const customerCode = meter.customer_code;
    const linkedInv = resolveLpgInvoice(meter.sales_invoice_id, meter.sales_invoice_no);
    const rawSoRef = String(linkedInv.invoice?.order_id || "").trim();

    const resolvedBranchId = resolveLpgBranchId(linkedInv.branchId, rawSoRef);
    if (!isBranchAllowed(resolvedBranchId, true)) continue;

    const targetProductId = resolveLpgTargetProductId(
      linkedInv.invoiceId,
      rawSoRef,
      null,
      LPG_METERED_PRODUCT_ID
    );
    const resolvedProduct = context.products.get(targetProductId);
    if (!isCategoryAllowed(resolvedProduct?.product_category)) continue;

    const cust = getOrCreateCustomer(customerCode, resolvedBranchId);

    const orderKey =
      (rawSoRef ? salesOrderKeyMap.get(rawSoRef) ?? rawSoRef : "") ||
      linkedInv.invoiceNo ||
      meter.reading_no;
    cust.customerOrderKeys.add(orderKey);

    const targetChannel: "CYLINDER" | "LPG" = targetProductId > 0 ? "CYLINDER" : "LPG";

    const prodAcc = getOrCreateProductAcc(cust, targetProductId, targetChannel);
    prodAcc.hasMetered = true;
    prodAcc.orderKeys.add(orderKey);
    prodAcc.grossKg += consumedKg;
    prodAcc.netAmount += amt;
    prodAcc.lpgOrderKeys.add(orderKey);
    prodAcc.lpgGrossKg += consumedKg;
    prodAcc.lpgNetAmount += amt;
    addLpgTrendPoint(prodAcc, meter.reading_date, consumedKg, orderKey);

    if (!linkedInv.invoiceId && !linkedInv.invoiceNo) {
      exceptions.push({
        code: "UNBILLED_LPG_TRANSACTION",
        channel: "LPG",
        customerCode,
        customerName: context.customers.get(customerCode)?.customer_name ?? customerCode,
        productName:
          resolvedProduct?.description || "LPG Metered Consumption",
        referenceType: "METER_READING",
        referenceNo: meter.reading_no,
        detail: `Posted Metered reading ${meter.reading_no} has no linked sales invoice.`,
        quantity: 0,
        kg: consumedKg,
      });
      prodAcc.exceptionCodes.add("UNBILLED_LPG_TRANSACTION");
      cust.exceptionCodes.add("UNBILLED_LPG_TRANSACTION");
    }
  }

  // 4. Build Customer-level Rows & Nested Product Summaries
  const rows: CustomerOrderConsumptionRow[] = [];

  for (const [key, cust] of customerMap.entries()) {
    // A customer with zero in-scope industrial cylinder or LPG lines is excluded from this report
    if (cust.products.size === 0) {
      continue;
    }

    const custProfile = context.customers.get(cust.customerCode);
    const branchProfile = cust.branchId != null ? context.branches.get(cust.branchId) : undefined;
    const classificationProfile =
      custProfile?.classification != null ? context.classifications.get(custProfile.classification) : undefined;

    const productSummaries: ProductConsumptionSummary[] = [];
    let custGrossQty = 0;
    let custReturnedQty = 0;
    let custGrossKg = 0;
    let custReturnedKg = 0;
    let custNetAmount = 0;

    for (const prodAcc of cust.products.values()) {
      const product = context.products.get(Number(prodAcc.productId));
      const category =
        product?.product_category != null
          ? context.categories.get(Number(product.product_category))
          : undefined;

      const netQty = prodAcc.grossQty - prodAcc.returnedQty;
      const netKg = prodAcc.grossKg - prodAcc.returnedKg;
      const orderFreq = prodAcc.orderKeys.size;

      if (prodAcc.returnedQty > prodAcc.grossQty && prodAcc.grossQty > 0) {
        exceptions.push({
          code: "RETURN_EXCEEDS_FULFILLED",
          channel: prodAcc.channel,
          customerCode: cust.customerCode,
          customerName: custProfile?.customer_name ?? cust.customerCode,
          productName: product?.description || product?.product_name || "Product",
          referenceType: "SALES_RETURN",
          referenceNo: cust.customerCode,
          detail: `Returned quantity (${prodAcc.returnedQty}) exceeds fulfilled gross quantity (${prodAcc.grossQty}) in this period.`,
          quantity: prodAcc.returnedQty - prodAcc.grossQty,
          kg: prodAcc.returnedKg - prodAcc.grossKg,
        });
        prodAcc.exceptionCodes.add("RETURN_EXCEEDS_FULFILLED");
        cust.exceptionCodes.add("RETURN_EXCEEDS_FULFILLED");
      }

      custGrossQty += prodAcc.grossQty;
      custReturnedQty += prodAcc.returnedQty;
      custGrossKg += prodAcc.grossKg;
      custReturnedKg += prodAcc.returnedKg;
      custNetAmount += prodAcc.netAmount;

      const trendPoints = [...prodAcc.monthlyTrend.values()].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

      // Resolve standard cylinder size: 1.4kg, 11kg, 50kg (null only for unlinked bulk LPG fallbacks)
      const resolvedSize = product ? resolveCylinderSizeKg(category, product) : null;

      // Distinct labels for unlinked LPG fallbacks vs real Parent Products (including Metered/WIWO-billed parent cylinders)
      const isMeteredLpg = prodAcc.productId === LPG_METERED_PRODUCT_ID;
      const isWiwoLpg = prodAcc.productId === LPG_WIWO_PRODUCT_ID;

      const displayProductCode = isMeteredLpg
        ? "LPG-METERED"
        : isWiwoLpg
        ? "LPG-WIWO"
        : product?.product_code ?? String(prodAcc.productId);

      const displayProductName = isMeteredLpg
        ? "LPG Metered Consumption"
        : isWiwoLpg
        ? "LPG WIWO (Kg) Consumption"
        : product?.description || product?.product_name || `Product #${prodAcc.productId}`;

      const displayCategoryName = isMeteredLpg
        ? "Metered LPG"
        : isWiwoLpg
        ? "WIWO LPG (Kg)"
        : category?.category_name ?? "Industrial Gas";

      const displayGasType =
        isMeteredLpg || (prodAcc.hasMetered && !prodAcc.hasWiwo)
          ? "LPG (Metered)"
          : isWiwoLpg || (prodAcc.hasWiwo && !prodAcc.hasMetered)
          ? "LPG (WIWO / Kg)"
          : prodAcc.hasMetered && prodAcc.hasWiwo
          ? "LPG (Metered / WIWO)"
          : product?.description?.toLowerCase().includes("lpg") ||
            category?.category_name?.toLowerCase().includes("lpg") ||
            prodAcc.channel === "LPG"
          ? "LPG"
          : "Industrial Gas";

      productSummaries.push({
        productId: prodAcc.productId,
        productCode: displayProductCode,
        // Product display label combines product name and unit type for UI presentation per ids-guide
        productName: displayProductName,
        categoryName: displayCategoryName,
        cylinderSizeKg: resolvedSize,
        gasType: displayGasType,
        channel: prodAcc.channel,
        orderFrequency: orderFreq,
        fulfilledQty: prodAcc.grossQty,
        returnedQty: prodAcc.returnedQty,
        netQty,
        grossKg: prodAcc.grossKg,
        returnedKg: prodAcc.returnedKg,
        netKg,
        avgOrderSizeKg: safeRatio(netKg, orderFreq),
        avgOrderSizeQty: safeRatio(netQty, orderFreq),
        netAmount: prodAcc.netAmount,
        monthlyTrend: trendPoints,
        exceptionCodes: [...prodAcc.exceptionCodes],
      });
    }

    // AG-COMMENT: Strictly skip any customer record that has zero valid in-scope industrial products
    if (productSummaries.length === 0) {
      continue;
    }

    const custNetQty = custGrossQty - custReturnedQty;
    const custNetKg = custGrossKg - custReturnedKg;
    const custOrderFreq = cust.customerOrderKeys.size;

    rows.push({
      rowKey: key,
      customerCode: cust.customerCode,
      customerName: custProfile?.customer_name ?? cust.customerCode,
      storeName: custProfile?.store_name ?? "",
      classificationName: classificationProfile?.classification_name ?? "Standard",
      branchId: cust.branchId,
      branchName: branchProfile?.branch_name ?? "Unassigned Branch",
      orderFrequency: custOrderFreq,
      fulfilledQty: custGrossQty,
      returnedQty: custReturnedQty,
      netQty: custNetQty,
      grossKg: custGrossKg,
      returnedKg: custReturnedKg,
      netKg: custNetKg,
      avgOrderSizeKg: safeRatio(custNetKg, custOrderFreq),
      avgOrderSizeQty: safeRatio(custNetQty, custOrderFreq),
      netAmount: custNetAmount,
      products: productSummaries.sort((a, b) => b.netKg - a.netKg),
      monthlyTrend: [],
      exceptionCodes: [...cust.exceptionCodes],
    });
  }

  // Optional search scoping (aligns rows, KPIs, trends, and exceptions when search filter is submitted)
  const searchQuery = (filters?.search ?? "").trim().toLowerCase();
  const scopedRows = searchQuery
    ? rows.filter(
        (r) =>
          r.customerName.toLowerCase().includes(searchQuery) ||
          r.customerCode.toLowerCase().includes(searchQuery) ||
          r.storeName.toLowerCase().includes(searchQuery) ||
          r.branchName.toLowerCase().includes(searchQuery) ||
          r.products.some(
            (p) =>
              p.productName.toLowerCase().includes(searchQuery) ||
              p.productCode.toLowerCase().includes(searchQuery) ||
              (p.gasType ?? "").toLowerCase().includes(searchQuery)
          )
      )
    : rows;

  const scopedCustomerKeys = new Set(scopedRows.map((r) => r.rowKey));
  const scopedCustomerCodes = new Set(scopedRows.map((r) => r.customerCode));
  const scopedAccumulators = [...customerMap.entries()]
    .filter(([key]) => scopedCustomerKeys.has(key))
    .map(([, acc]) => acc);
  const scopedExceptions = searchQuery
    ? exceptions.filter((e) => scopedCustomerCodes.has(e.customerCode))
    : exceptions;

  // 5. Build Overview & Trends using movement-level channel attribution (Cylinder vs Metered/WIWO LPG)
  const overview = buildOverview(scopedRows, scopedAccumulators, scopedExceptions);
  const overallTrend = buildOverallTrend(scopedAccumulators);

  return {
    rows: scopedRows.sort((a, b) => b.netKg - a.netKg),
    exceptions: scopedExceptions,
    overview,
    overallTrend,
  };
}

function buildOverview(
  rows: CustomerOrderConsumptionRow[],
  accumulators: CustomerAccumulator[],
  exceptions: ReportException[]
): CustomerOrderConsumptionOverview {
  let cylOrders = 0;
  let cylGrossQty = 0;
  let cylReturnedQty = 0;
  let cylGrossKg = 0;
  let cylReturnedKg = 0;
  let cylNetAmount = 0;
  let cylCustomers = 0;

  let lpgOrders = 0;
  let lpgGrossKg = 0;
  let lpgReturnedKg = 0;
  let lpgNetAmount = 0;
  let lpgCustomers = 0;

  const totalOrders = rows.reduce((acc, r) => acc + r.orderFrequency, 0);

  for (const cust of accumulators) {
    let custHasCylinder = false;
    let custHasLpg = false;

    for (const p of cust.products.values()) {
      const hasCylinderActivity =
        p.cylinderGrossKg > 0 || p.cylinderReturnedKg > 0 || p.cylinderOrderKeys.size > 0;
      const hasLpgActivity =
        p.lpgGrossKg > 0 || p.lpgReturnedKg > 0 || p.lpgOrderKeys.size > 0;

      if (hasCylinderActivity) {
        custHasCylinder = true;
        cylOrders += p.cylinderOrderKeys.size;
        cylGrossQty += p.cylinderGrossQty;
        cylReturnedQty += p.cylinderReturnedQty;
        cylGrossKg += p.cylinderGrossKg;
        cylReturnedKg += p.cylinderReturnedKg;
        cylNetAmount += p.cylinderNetAmount;
      }

      if (hasLpgActivity) {
        custHasLpg = true;
        lpgOrders += p.lpgOrderKeys.size;
        lpgGrossKg += p.lpgGrossKg;
        lpgReturnedKg += p.lpgReturnedKg;
        lpgNetAmount += p.lpgNetAmount;
      }
    }

    if (custHasCylinder) cylCustomers += 1;
    if (custHasLpg) lpgCustomers += 1;
  }

  const cylNetKg = cylGrossKg - cylReturnedKg;
  const lpgNetKg = lpgGrossKg - lpgReturnedKg;

  return {
    totalCustomers: rows.length,
    totalOrders,
    cylinder: {
      customers: cylCustomers,
      orders: cylOrders,
      grossQty: cylGrossQty,
      returnedQty: cylReturnedQty,
      grossKg: cylGrossKg,
      returnedKg: cylReturnedKg,
      netKg: cylNetKg,
      netAmount: cylNetAmount,
      avgOrderSizeKg: safeRatio(cylNetKg, cylOrders),
      returnRatePct: computeReturnRate(cylReturnedKg, cylGrossKg),
    },
    lpg: {
      customers: lpgCustomers,
      orders: lpgOrders,
      grossQty: 0,
      returnedQty: 0,
      grossKg: lpgGrossKg,
      returnedKg: lpgReturnedKg,
      netKg: lpgNetKg,
      netAmount: lpgNetAmount,
      avgOrderSizeKg: safeRatio(lpgNetKg, lpgOrders),
      returnRatePct: computeReturnRate(lpgReturnedKg, lpgGrossKg),
    },
    exceptionCount: exceptions.length,
  };
}

function buildOverallTrend(accumulators: CustomerAccumulator[]): ReportTrendPoint[] {
  const trendMap = new Map<string, ReportTrendPoint>();

  for (const cust of accumulators) {
    for (const p of cust.products.values()) {
      for (const [key, pt] of p.channelMonthlyTrend.entries()) {
        let point = trendMap.get(key);
        if (!point) {
          point = {
            yearMonth: pt.yearMonth,
            channel: pt.channel,
            orderCount: 0,
            orderKeys: [],
            grossQty: 0,
            returnedQty: 0,
            grossKg: 0,
            returnedKg: 0,
            netKg: 0,
          };
          trendMap.set(key, point);
        }
        point.grossQty += pt.grossQty;
        point.returnedQty += pt.returnedQty;
        point.grossKg += pt.grossKg;
        point.returnedKg += pt.returnedKg;
        point.netKg = point.grossKg - point.returnedKg;
        for (const k of pt.orderKeys) {
          if (!point.orderKeys.includes(k)) point.orderKeys.push(k);
        }
        point.orderCount = point.orderKeys.length;
      }
    }
  }

  return [...trendMap.values()].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
}
