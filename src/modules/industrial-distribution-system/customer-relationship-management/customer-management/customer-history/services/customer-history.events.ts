// ============================================================================
// Customer History — Pure Event & Audit Builders
// Converts verified Directus records into HistoryEvent and AuditEntry streams.
// Keeps Business Activity History and Audit History logically separate.
// ============================================================================

import type {
  AuditEntry,
  DetailRangePreset,
  HistoryEvent,
  RawAuditTrailRow,
  RawConsolidatorDetailRow,
  RawConsolidatorRow,
  RawConsolidatorSerialMappingRow,
  RawCustomerDiscountLogRow,
  RawCustomerMemoInvoiceRow,
  RawCustomerRow,
  RawCustomersMemoRow,
  RawDispatchPlanDetailRow,
  RawDispatchPlanRow,
  RawPosTransactionRow,
  RawPosTransactionSerialRow,
  RawSalesInvoiceDetailRow,
  RawSalesInvoicePaymentRow,
  RawSalesInvoiceRow,
  RawSalesOrderDetailRow,
  RawSalesOrderDetailSerialRow,
  RawSalesOrderRow,
  RawSalesReturnDetailRow,
  RawSalesReturnRow,
  RawSalesReturnSerialRow,
  RawUserRow,
} from "../types/customer-history.types";
import {
  display,
  isTruthyFlag,
  isWithinDateWindow,
  resolveDetailRangeBounds,
  toNumberOrNull,
  toNumberZero,
} from "./customer-history.helpers";
import {
  getBranchName,
  getParentProductName,
  isInScopeBranch,
  resolveQualifyingParentProductId,
  type IndustrialScope,
} from "./customer-history.scope";

export interface BuiltCustomerEvents {
  timeline: HistoryEvent[];
  transactions: HistoryEvent[];
  logistics: HistoryEvent[];
  notes: HistoryEvent[];
  audit: AuditEntry[];
}

function summarizeProducts(
  productIds: number[],
  scope: IndustrialScope
): string {
  const uniqueNames = Array.from(
    new Set(
      productIds
        .map((pid) => getParentProductName(pid, scope))
        .filter((name) => name !== "-")
    )
  );
  if (uniqueNames.length === 0) return "-";
  if (uniqueNames.length <= 2) return uniqueNames.join(", ");
  return `${uniqueNames.slice(0, 2).join(", ")} +${uniqueNames.length - 2} more`;
}

function formatUserName(user: RawUserRow | undefined): string {
  if (!user) return "-";
  const full = [user.user_fname, user.user_lname]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return display(full || user.user_email);
}

/**
 * Builds the complete Business Activity and Audit streams for one customer,
 * filtered by industrial scope and the requested modal date range.
 */
export function buildCustomerEventStreams(params: {
  customer: RawCustomerRow;
  scope: IndustrialScope;
  range: DetailRangePreset;
  users: RawUserRow[];
  invoices: RawSalesInvoiceRow[];
  invoiceDetails: RawSalesInvoiceDetailRow[];
  payments: RawSalesInvoicePaymentRow[];
  posSerials: RawPosTransactionSerialRow[];
  posTransactions: RawPosTransactionRow[];
  orders: RawSalesOrderRow[];
  orderDetails: RawSalesOrderDetailRow[];
  orderSerials: RawSalesOrderDetailSerialRow[];
  dispatchPlans: RawDispatchPlanRow[];
  dispatchPlanDetails: RawDispatchPlanDetailRow[];
  returns: RawSalesReturnRow[];
  returnDetails: RawSalesReturnDetailRow[];
  returnSerials: RawSalesReturnSerialRow[];
  consolidatorMappings: RawConsolidatorSerialMappingRow[];
  consolidatorDetails: RawConsolidatorDetailRow[];
  consolidators: RawConsolidatorRow[];
  memos: RawCustomersMemoRow[];
  memoInvoices: RawCustomerMemoInvoiceRow[];
  auditTrails: RawAuditTrailRow[];
  discountLogs: RawCustomerDiscountLogRow[];
}): BuiltCustomerEvents {
  const { scope, range } = params;
  const { startDate, endDate } = resolveDetailRangeBounds(range);
  const inWindow = (dt: string | null | undefined) =>
    isWithinDateWindow(dt, startDate, endDate);

  const userMap = new Map<number, RawUserRow>(
    params.users.map((u) => [Number(u.user_id), u])
  );

  // Group invoice details by invoice_id and resolve qualifying parent products
  const invoiceDetailsByInvoice = new Map<number, RawSalesInvoiceDetailRow[]>();
  for (const d of params.invoiceDetails) {
    const invId = Number(d.invoice_no);
    const list = invoiceDetailsByInvoice.get(invId) ?? [];
    list.push(d);
    invoiceDetailsByInvoice.set(invId, list);
  }

  const qualifyingInvoiceMap = new Map<
    number,
    { invoice: RawSalesInvoiceRow; amount: number; productIds: number[] }
  >();
  for (const inv of params.invoices) {
    if (!isInScopeBranch(inv.branch_id, scope)) continue;
    const lines = invoiceDetailsByInvoice.get(Number(inv.invoice_id)) ?? [];
    const matchedProductIds: number[] = [];
    let qualifyingSum = 0;
    for (const line of lines) {
      const parentId = resolveQualifyingParentProductId(line.product_id, scope);
      if (parentId !== null) {
        matchedProductIds.push(parentId);
        qualifyingSum += toNumberZero(line.total_amount);
      }
    }
    if (matchedProductIds.length > 0) {
      qualifyingInvoiceMap.set(Number(inv.invoice_id), {
        invoice: inv,
        amount: qualifyingSum,
        productIds: matchedProductIds,
      });
    }
  }

  // Group order details and resolve qualifying parent products
  const orderDetailsByOrder = new Map<number, RawSalesOrderDetailRow[]>();
  for (const d of params.orderDetails) {
    const list = orderDetailsByOrder.get(Number(d.order_id)) ?? [];
    list.push(d);
    orderDetailsByOrder.set(Number(d.order_id), list);
  }

  const qualifyingOrderMap = new Map<
    number,
    { order: RawSalesOrderRow; amount: number; productIds: number[] }
  >();
  for (const ord of params.orders) {
    if (!isInScopeBranch(ord.branch_id, scope)) continue;
    const lines = orderDetailsByOrder.get(Number(ord.order_id)) ?? [];
    const matchedProductIds: number[] = [];
    let qualifyingSum = 0;
    for (const line of lines) {
      const parentId = resolveQualifyingParentProductId(line.product_id, scope);
      if (parentId !== null) {
        matchedProductIds.push(parentId);
        qualifyingSum += toNumberZero(line.net_amount);
      }
    }
    if (matchedProductIds.length > 0) {
      qualifyingOrderMap.set(Number(ord.order_id), {
        order: ord,
        amount: qualifyingSum,
        productIds: matchedProductIds,
      });
    }
  }

  const timeline: HistoryEvent[] = [];
  const transactions: HistoryEvent[] = [];
  const logistics: HistoryEvent[] = [];
  const notes: HistoryEvent[] = [];

  // 1. Profile registration event
  if (params.customer.date_entered && inWindow(params.customer.date_entered)) {
    timeline.push({
      id: `profile-${params.customer.id}`,
      kind: "profile",
      occurredAt: params.customer.date_entered,
      title: "Customer Registered",
      reference: display(params.customer.customer_code),
      amount: null,
      status: isTruthyFlag(params.customer.isActive) ? "Active" : "Inactive",
      branchName: "-",
      productSummary: "-",
      meta: [
        { label: "Type", value: display(params.customer.type) },
        { label: "Store", value: display(params.customer.store_name) },
      ],
    });
  }

  // 2. Sales Invoices
  for (const { invoice, amount, productIds } of qualifyingInvoiceMap.values()) {
    const occurredAt = invoice.invoice_date ?? invoice.created_date;
    if (!inWindow(occurredAt)) continue;
    const evt: HistoryEvent = {
      id: `invoice-${invoice.invoice_id}`,
      kind: "invoice",
      occurredAt,
      title: "Sales Invoice Created",
      reference: display(invoice.invoice_no ?? invoice.order_id),
      amount,
      status: display(invoice.payment_status ?? invoice.transaction_status),
      branchName: getBranchName(invoice.branch_id, scope),
      productSummary: summarizeProducts(productIds, scope),
      meta: [
        { label: "Order Ref", value: display(invoice.order_id) },
        { label: "Price Type", value: display(invoice.price_type) },
        { label: "Tx Status", value: display(invoice.transaction_status) },
      ],
    };
    timeline.push(evt);
    transactions.push(evt);
  }

  // 3. POS Transactions (linked via pos_transaction_serial -> qualifying invoice)
  const posTxMap = new Map<string, RawPosTransactionRow>(
    params.posTransactions.map((pt) => [pt.transaction_id, pt])
  );
  const posSeen = new Set<string>();
  for (const ps of params.posSerials) {
    const inv = qualifyingInvoiceMap.get(Number(ps.sales_invoice_id));
    if (!inv) continue;
    const parentId = resolveQualifyingParentProductId(ps.product_id, scope);
    if (parentId === null) continue;
    const tx = ps.pos_transaction_id ? posTxMap.get(ps.pos_transaction_id) : undefined;
    const key = tx ? `pos-tx-${tx.transaction_id}` : `pos-ser-${ps.id}`;
    if (posSeen.has(key)) continue;
    posSeen.add(key);

    const occurredAt = tx?.created_at ?? ps.created_at;
    if (!inWindow(occurredAt)) continue;
    const evt: HistoryEvent = {
      id: key,
      kind: "pos",
      occurredAt,
      title: "POS Transaction",
      reference: display(tx?.invoice_no ?? inv.invoice.invoice_no ?? ps.pos_transaction_id),
      amount: tx ? toNumberOrNull(tx.total_amount) : null,
      status: display(tx?.status ?? ps.movement_type),
      branchName: getBranchName(inv.invoice.branch_id, scope),
      productSummary: getParentProductName(parentId, scope),
      meta: [
        { label: "Method", value: display(tx?.payment_method) },
        { label: "Tx Type", value: display(tx?.transaction_type) },
        { label: "Serial", value: display(ps.serial_number) },
      ],
    };
    timeline.push(evt);
    transactions.push(evt);
  }

  // 4. Sales Orders
  for (const { order, amount, productIds } of qualifyingOrderMap.values()) {
    const occurredAt = order.order_date ?? order.created_date;
    if (!inWindow(occurredAt)) continue;
    const evt: HistoryEvent = {
      id: `order-${order.order_id}`,
      kind: "order",
      occurredAt,
      title: "Sales Order Placed",
      reference: display(order.order_no),
      amount,
      status: display(order.order_status),
      branchName: getBranchName(order.branch_id, scope),
      productSummary: summarizeProducts(productIds, scope),
      meta: [
        { label: "PO No", value: display(order.po_no) },
        { label: "Remarks", value: display(order.remarks) },
      ],
    };
    timeline.push(evt);
    transactions.push(evt);
  }

  // 5. Payments (sales_invoice_payments linked to qualifying industrial invoices)
  for (const pay of params.payments) {
    const inv = qualifyingInvoiceMap.get(Number(pay.invoice_id));
    if (!inv) continue;
    if (!inWindow(pay.date_paid)) continue;
    const evt: HistoryEvent = {
      id: `payment-${pay.id}`,
      kind: "payment",
      occurredAt: pay.date_paid,
      title: "Payment Recorded",
      reference: display(pay.reference_no ?? inv.invoice.invoice_no),
      amount: toNumberOrNull(pay.paid_amount),
      status: "Paid",
      branchName: getBranchName(inv.invoice.branch_id, scope),
      productSummary: summarizeProducts(inv.productIds, scope),
      meta: [
        { label: "Invoice", value: display(inv.invoice.invoice_no) },
        { label: "Collection ID", value: pay.collection_id ? String(pay.collection_id) : "-" },
      ],
    };
    timeline.push(evt);
    transactions.push(evt);
  }

  // 6. Dispatch Plans (linked via dispatch_plan_details -> qualifying sales orders)
  const dispatchPlanMap = new Map<number, RawDispatchPlanRow>(
    params.dispatchPlans.map((d) => [Number(d.dispatch_id), d])
  );
  const dispatchSeen = new Set<number>();
  for (const dpd of params.dispatchPlanDetails) {
    const dp = dispatchPlanMap.get(Number(dpd.dispatch_id));
    if (!dp || isTruthyFlag(dp.is_delete) || !isInScopeBranch(dp.branch_id, scope)) {
      continue;
    }
    const ord = qualifyingOrderMap.get(Number(dpd.sales_order_id));
    if (!ord) continue;
    if (dispatchSeen.has(dp.dispatch_id)) continue;
    dispatchSeen.add(dp.dispatch_id);

    const occurredAt = dp.dispatch_date ?? dp.created_at;
    if (!inWindow(occurredAt)) continue;
    const evt: HistoryEvent = {
      id: `dispatch-${dp.dispatch_id}`,
      kind: "dispatch",
      occurredAt,
      title: `Dispatch ${display(dp.status)}`,
      reference: display(dp.dispatch_no),
      amount: toNumberOrNull(dp.total_amount),
      status: display(dp.status),
      branchName: getBranchName(dp.branch_id, scope),
      productSummary: summarizeProducts(ord.productIds, scope),
      meta: [
        { label: "Order", value: display(ord.order.order_no) },
        { label: "Remarks", value: display(dp.remarks) },
      ],
    };
    timeline.push(evt);
    logistics.push(evt);
  }

  // 7. Returns (sales_return + sales_return_details + sales_return_serial)
  const returnDetailsByNo = new Map<string, RawSalesReturnDetailRow[]>();
  for (const rd of params.returnDetails) {
    const list = returnDetailsByNo.get(rd.return_no) ?? [];
    list.push(rd);
    returnDetailsByNo.set(rd.return_no, list);
  }
  const returnSerialsByDetail = new Map<number, RawSalesReturnSerialRow[]>();
  for (const rs of params.returnSerials) {
    const list = returnSerialsByDetail.get(Number(rs.sales_return_detail_id)) ?? [];
    list.push(rs);
    returnSerialsByDetail.set(Number(rs.sales_return_detail_id), list);
  }

  for (const ret of params.returns) {
    if (ret.deleted_at) continue;
    if (!isInScopeBranch(ret.branch_id, scope)) continue;
    const lines = returnDetailsByNo.get(ret.return_number) ?? [];
    const matchedProductIds: number[] = [];
    const serialList: string[] = [];
    let qualifyingSum = 0;

    for (const line of lines) {
      const parentId = resolveQualifyingParentProductId(line.product_id, scope);
      if (parentId !== null) {
        matchedProductIds.push(parentId);
        qualifyingSum += toNumberZero(line.total_amount);
        const srs = returnSerialsByDetail.get(Number(line.detail_id)) ?? [];
        for (const sr of srs) serialList.push(sr.serial_number);
      }
    }
    if (matchedProductIds.length === 0) continue;

    const occurredAt = ret.return_date ?? ret.received_at;
    if (!inWindow(occurredAt)) continue;
    const evt: HistoryEvent = {
      id: `return-${ret.return_id}`,
      kind: "return",
      occurredAt,
      title: "Sales Return Processed",
      reference: display(ret.return_number),
      amount: qualifyingSum,
      status: display(ret.status),
      branchName: getBranchName(ret.branch_id, scope),
      productSummary: summarizeProducts(matchedProductIds, scope),
      meta: [
        { label: "Invoice Ref", value: display(ret.invoice_no) },
        {
          label: "Serials",
          value: serialList.length > 0 ? serialList.slice(0, 3).join(", ") : "-",
        },
        { label: "Remarks", value: display(ret.remarks) },
      ],
    };
    timeline.push(evt);
    logistics.push(evt);
  }

  // 8. Serial Assignments (sales_order_details_serial)
  for (const s of params.orderSerials) {
    if (!isInScopeBranch(s.branch_id, scope)) continue;
    const parentId = resolveQualifyingParentProductId(s.product_id, scope);
    if (parentId === null) continue;
    const occurredAt = s.created_date ?? s.delivery_date;
    if (!inWindow(occurredAt)) continue;
    const evt: HistoryEvent = {
      id: `serial-order-${s.id}`,
      kind: "serial",
      occurredAt,
      title: "Serial Assigned",
      reference: display(s.serial_number),
      amount: null,
      status: "Assigned",
      branchName: getBranchName(s.branch_id, scope),
      productSummary: getParentProductName(parentId, scope),
      meta: [
        { label: "Order ID", value: String(s.sales_order_id) },
        { label: "Delivery", value: display(s.delivery_date) },
      ],
    };
    timeline.push(evt);
    logistics.push(evt);
  }

  // 9. Consolidation (consolidator_serial_mappings -> consolidator_details -> consolidator)
  const consolidatorDetailMap = new Map<number, RawConsolidatorDetailRow>(
    params.consolidatorDetails.map((cd) => [Number(cd.id), cd])
  );
  const consolidatorMap = new Map<number, RawConsolidatorRow>(
    params.consolidators.map((c) => [Number(c.id), c])
  );
  for (const m of params.consolidatorMappings) {
    const cd = consolidatorDetailMap.get(Number(m.detail_id));
    if (!cd) continue;
    const cons = consolidatorMap.get(Number(cd.consolidator_id));
    if (!cons || isTruthyFlag(cons.is_delete) || !isInScopeBranch(cons.branch_id, scope)) {
      continue;
    }
    const parentId = resolveQualifyingParentProductId(cd.product_id, scope);
    if (parentId === null) continue;
    const occurredAt = m.scanned_at ?? cons.picked_at ?? cons.created_at;
    if (!inWindow(occurredAt)) continue;
    const evt: HistoryEvent = {
      id: `consol-${m.id}`,
      kind: "consolidation",
      occurredAt,
      title: "Consolidator Scanned",
      reference: display(cons.consolidator_no),
      amount: null,
      status: display(cons.status),
      branchName: getBranchName(cons.branch_id, scope),
      productSummary: getParentProductName(parentId, scope),
      meta: [
        { label: "Serial", value: display(m.serial_number) },
        { label: "Picked Qty", value: String(cd.picked_quantity) },
      ],
    };
    timeline.push(evt);
    logistics.push(evt);
  }

  // 10. Customer Memos — STRICT: only memos applied to an in-scope industrial invoice
  const memoMap = new Map<number, RawCustomersMemoRow>(
    params.memos.filter((m) => !m.deleted_at).map((m) => [Number(m.id), m])
  );
  for (const link of params.memoInvoices) {
    if (!link.invoice_id || !link.memo_id) continue;
    const inv = qualifyingInvoiceMap.get(Number(link.invoice_id));
    const memo = memoMap.get(Number(link.memo_id));
    if (!inv || !memo) continue;

    const occurredAt = link.date_applied ?? memo.created_at;
    if (!inWindow(occurredAt)) continue;
    const evt: HistoryEvent = {
      id: `memo-link-${link.id}`,
      kind: "memo",
      occurredAt,
      title: "Customer Memo Applied",
      reference: display(memo.memo_number),
      amount: toNumberOrNull(link.amount ?? memo.applied_amount),
      status: display(memo.status),
      branchName: getBranchName(inv.invoice.branch_id, scope),
      productSummary: summarizeProducts(inv.productIds, scope),
      meta: [
        { label: "Invoice", value: display(inv.invoice.invoice_no) },
        { label: "Reason", value: display(memo.reason) },
      ],
    };
    timeline.push(evt);
    notes.push(evt);
  }

  // Sort all business activity streams descending by occurredAt
  const byDescTime = (a: HistoryEvent, b: HistoryEvent) => {
    const ta = a.occurredAt ? Date.parse(a.occurredAt) : 0;
    const tb = b.occurredAt ? Date.parse(b.occurredAt) : 0;
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  };
  timeline.sort(byDescTime);
  transactions.sort(byDescTime);
  logistics.sort(byDescTime);
  notes.sort(byDescTime);

  // 11. Separate Audit Trail (audit_trail_table + customer_discount_log)
  const audit: AuditEntry[] = [];
  for (const row of params.auditTrails) {
    if (!inWindow(row.timestamp)) continue;
    audit.push({
      id: `audit-${row.id}`,
      occurredAt: row.timestamp,
      actorName: row.user_id ? formatUserName(userMap.get(Number(row.user_id))) : "-",
      action: display(row.action),
      targetTable: display(row.table_name),
      fieldName: display(row.field_name),
      oldValue: display(row.old_value),
      newValue: display(row.new_value),
    });
  }

  for (const log of params.discountLogs) {
    if (!inWindow(log.changed_at)) continue;
    audit.push({
      id: `disc-log-${log.log_id}`,
      occurredAt: log.changed_at,
      actorName: log.changed_by_user_id
        ? formatUserName(userMap.get(Number(log.changed_by_user_id)))
        : "-",
      action: display(log.action_type),
      targetTable: "customer_discount_log",
      fieldName: "discount_type",
      oldValue: "-",
      newValue:
        log.discount_type !== null && log.discount_type !== undefined
          ? String(log.discount_type)
          : "-",
    });
  }

  audit.sort((a, b) => {
    const ta = a.occurredAt ? Date.parse(a.occurredAt) : 0;
    const tb = b.occurredAt ? Date.parse(b.occurredAt) : 0;
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });

  return { timeline, transactions, logistics, notes, audit };
}
