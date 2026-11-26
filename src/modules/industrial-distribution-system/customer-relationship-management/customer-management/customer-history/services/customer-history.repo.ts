// ============================================================================
// Customer History — Directus Repository (I/O Only, No Business Logic)
// Reads only verified tables from zmine/manufacturing-table.txt.
// ============================================================================

import type {
  CustomerHistoryFilters,
  RawAuditTrailRow,
  RawBranchRow,
  RawClassificationRow,
  RawConsolidatorDetailRow,
  RawConsolidatorRow,
  RawConsolidatorSerialMappingRow,
  RawCustomerDiscountLogRow,
  RawCustomerMemoInvoiceRow,
  RawCustomerRow,
  RawCustomerSalesmanRow,
  RawCustomersMemoRow,
  RawDispatchPlanDetailRow,
  RawDispatchPlanRow,
  RawPosTransactionRow,
  RawPosTransactionSerialRow,
  RawProductRow,
  RawSalesInvoiceDetailRow,
  RawSalesInvoicePaymentRow,
  RawSalesInvoiceRow,
  RawSalesOrderDetailRow,
  RawSalesOrderDetailSerialRow,
  RawSalesOrderRow,
  RawSalesReturnDetailRow,
  RawSalesReturnRow,
  RawSalesReturnSerialRow,
  RawSalesmanRow,
  RawStoreTypeRow,
  RawUserRow,
} from "../types/customer-history.types";
import {
  chunk,
  fetchDirectusRows,
  flatten,
  resolveDirectusConfig,
  type DirectusConfig,
  type DirectusFetchOptions,
} from "./customer-history.directus";

export interface RepoOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  config?: Partial<DirectusConfig>;
}

export interface ScopeMasters {
  branches: RawBranchRow[];
  products: RawProductRow[];
}

export interface ListSourceBundle {
  scopeMasters: ScopeMasters;
  customers: RawCustomerRow[];
  storeTypes: RawStoreTypeRow[];
  classifications: RawClassificationRow[];
  customerSalesmen: RawCustomerSalesmanRow[];
  salesmen: RawSalesmanRow[];
  invoices: RawSalesInvoiceRow[];
  invoiceDetails: RawSalesInvoiceDetailRow[];
  payments: RawSalesInvoicePaymentRow[];
  posSerials: RawPosTransactionSerialRow[];
  orders: RawSalesOrderRow[];
  orderDetails: RawSalesOrderDetailRow[];
  dispatchPlans: RawDispatchPlanRow[];
  dispatchPlanDetails: RawDispatchPlanDetailRow[];
  returns: RawSalesReturnRow[];
  returnDetails: RawSalesReturnDetailRow[];
  memoInvoices: RawCustomerMemoInvoiceRow[];
  memos: RawCustomersMemoRow[];
}

export interface DetailSourceBundle {
  scopeMasters: ScopeMasters;
  customer: RawCustomerRow | null;
  storeTypes: RawStoreTypeRow[];
  classifications: RawClassificationRow[];
  customerSalesmen: RawCustomerSalesmanRow[];
  salesmen: RawSalesmanRow[];
  users: RawUserRow[];
  invoices: RawSalesInvoiceRow[];
  invoiceDetails: RawSalesInvoiceDetailRow[];
  payments: RawSalesInvoicePaymentRow[];
  posSerials: RawPosTransactionSerialRow[];
  posTransactions: RawPosTransactionRow[];
  orders: RawSalesOrderRow[];
  orderDetails: RawSalesOrderDetailRow[];
  orderSerials: RawSalesOrderDetailSerialRow[];
  dispatchPlanDetails: RawDispatchPlanDetailRow[];
  dispatchPlans: RawDispatchPlanRow[];
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
}

function getReader(options: RepoOptions) {
  const base = resolveDirectusConfig();
  const config: DirectusConfig = { ...base, ...options.config };
  return <T>(
    collection: string,
    query: Omit<DirectusFetchOptions, "signal" | "fetchImpl">
  ) =>
    fetchDirectusRows<T>(
      collection,
      { ...query, fetchImpl: options.fetchImpl, signal: options.signal },
      config
    );
}

function dateWindowFilter(
  field: string,
  startDate?: string,
  endDate?: string,
  dateOnly = false
): Record<string, unknown> {
  if (!startDate && !endDate) return {};
  const bounds: Record<string, unknown> = {};
  if (startDate) bounds._gte = dateOnly ? startDate : `${startDate} 00:00:00`;
  if (endDate) bounds._lte = dateOnly ? endDate : `${endDate} 23:59:59`;
  return { [field]: bounds };
}

/**
 * Reads industrial scope masters:
 * - branches: division_id = 1 AND isActive = 1
 * - products: is_serialized = 1 (includes child variants so they resolve to parent_id IS NULL)
 */
export async function readScopeMasters(
  options: RepoOptions = {}
): Promise<ScopeMasters> {
  const read = getReader(options);
  const [branches, products] = await Promise.all([
    read<RawBranchRow>("branches", {
      fields: "id,branch_name,branch_code,division_id,isActive",
      filter: { division_id: { _eq: 1 }, isActive: { _eq: 1 } },
    }),
    read<RawProductRow>("products", {
      fields: "product_id,parent_id,product_code,product_name,description,is_serialized",
      filter: { is_serialized: { _eq: 1 } },
    }),
  ]);
  return { branches, products };
}

/**
 * Reads all data needed to compute the main Customer History list, KPIs, and charts
 * inside the applied date window and branch scope.
 */
export async function readListSourceBundle(
  filters: CustomerHistoryFilters,
  options: RepoOptions = {}
): Promise<ListSourceBundle> {
  const read = getReader(options);
  const scopeMasters = await readScopeMasters(options);

  const authorizedBranchIds = scopeMasters.branches.map((b) => Number(b.id));
  const targetBranchIds =
    filters.branchId !== "all"
      ? authorizedBranchIds.filter((id) => id === Number(filters.branchId))
      : authorizedBranchIds;

  const branchFilter =
    targetBranchIds.length > 0
      ? { branch_id: { _in: targetBranchIds } }
      : { branch_id: { _in: [-1] } };

  // Windowed documents in industrial branches
  const [invoices, orders, returns, dispatchPlans, payments, posSerials] =
    await Promise.all([
      read<RawSalesInvoiceRow>("sales_invoice", {
        fields:
          "invoice_id,order_id,customer_code,invoice_no,salesman_id,branch_id,invoice_date,transaction_status,payment_status,total_amount,net_amount,gross_amount,discount_amount,sales_type",
        filter: {
          ...dateWindowFilter("invoice_date", filters.startDate, filters.endDate),
          ...branchFilter,
        },
      }),
      read<RawSalesOrderRow>("sales_order", {
        fields:
          "order_id,order_no,po_no,customer_code,salesman_id,branch_id,order_date,order_status,total_amount,net_amount",
        filter: {
          ...dateWindowFilter("order_date", filters.startDate, filters.endDate, true),
          ...branchFilter,
        },
      }),
      read<RawSalesReturnRow>("sales_return", {
        fields:
          "return_id,return_number,customer_code,branch_id,return_date,total_amount,gross_amount,order_id,invoice_no,status,deleted_at",
        filter: {
          ...dateWindowFilter("return_date", filters.startDate, filters.endDate),
          ...branchFilter,
        },
      }),
      read<RawDispatchPlanRow>("dispatch_plan", {
        fields: "dispatch_id,dispatch_no,dispatch_date,branch_id,created_at,status,total_amount,is_delete",
        filter: {
          ...dateWindowFilter("dispatch_date", filters.startDate, filters.endDate),
          ...branchFilter,
        },
      }).catch(() => []),
      read<RawSalesInvoicePaymentRow>("sales_invoice_payments", {
        fields: "id,invoice_id,collection_id,reference_no,paid_amount,date_paid,coa_id",
        filter: {
          ...dateWindowFilter("date_paid", filters.startDate, filters.endDate),
        },
      }).catch(() => []),
      read<RawPosTransactionSerialRow>("pos_transaction_serial", {
        fields: "id,sales_invoice_id,pos_transaction_id,product_id,serial_number,movement_type,created_at",
        filter: {
          ...dateWindowFilter("created_at", filters.startDate, filters.endDate),
        },
      }).catch(() => []),
    ]);

  // Also ensure we have the parent invoices for any payments/POS serials in the window
  const loadedInvoiceIds = new Set(invoices.map((i) => Number(i.invoice_id)));
  const extraInvoiceIds = Array.from(
    new Set([
      ...payments.map((p) => Number(p.invoice_id)),
      ...posSerials.map((ps) => Number(ps.sales_invoice_id)),
    ])
  ).filter((id) => Number.isFinite(id) && id > 0 && !loadedInvoiceIds.has(id));

  const extraInvoices = flatten(
    await Promise.all(
      chunk(extraInvoiceIds).map((ids) =>
        read<RawSalesInvoiceRow>("sales_invoice", {
          fields:
            "invoice_id,order_id,customer_code,invoice_no,salesman_id,branch_id,invoice_date,transaction_status,payment_status,total_amount,net_amount,gross_amount,discount_amount,sales_type",
          filter: { invoice_id: { _in: ids }, ...branchFilter },
        })
      )
    )
  );
  const allRelevantInvoices = [...invoices, ...extraInvoices];

  // Batched line details, dispatch links, and memo-invoice links
  const invoiceIds = invoices.map((i) => Number(i.invoice_id));
  const orderIds = orders.map((o) => Number(o.order_id));
  const returnNumbers = returns.map((r) => r.return_number).filter(Boolean);
  const dispatchIds = dispatchPlans.map((d) => Number(d.dispatch_id));

  const [
    invoiceDetails,
    orderDetails,
    returnDetails,
    dispatchPlanDetails,
    memoInvoices,
    storeTypes,
    classifications,
    salesmen,
  ] = await Promise.all([
    Promise.all(
      chunk(invoiceIds).map((ids) =>
        read<RawSalesInvoiceDetailRow>("sales_invoice_details", {
          fields: "detail_id,invoice_no,product_id,quantity,unit_price,total_amount,discount_amount,gross_amount",
          filter: { invoice_no: { _in: ids } },
        })
      )
    ).then(flatten),
    Promise.all(
      chunk(orderIds).map((ids) =>
        read<RawSalesOrderDetailRow>("sales_order_details", {
          fields: "detail_id,order_id,product_id,ordered_quantity,served_quantity,net_amount",
          filter: { order_id: { _in: ids } },
        })
      )
    ).then(flatten),
    Promise.all(
      chunk(returnNumbers).map((nums) =>
        read<RawSalesReturnDetailRow>("sales_return_details", {
          fields: "detail_id,return_no,product_id,quantity,total_amount,reason,status",
          filter: { return_no: { _in: nums } },
        })
      )
    ).then(flatten),
    Promise.all(
      chunk(dispatchIds).map((ids) =>
        read<RawDispatchPlanDetailRow>("dispatch_plan_details", {
          fields: "detail_id,dispatch_id,sales_order_id",
          filter: { dispatch_id: { _in: ids } },
        })
      )
    )
      .then(flatten)
      .catch(() => []),
    read<RawCustomerMemoInvoiceRow>("customer_memo_invoices", {
      fields: "id,invoice_id,memo_id,amount,date_applied",
      filter: {
        ...dateWindowFilter("date_applied", filters.startDate, filters.endDate),
      },
    }).catch(() => []),
    read<RawStoreTypeRow>("store_type", { fields: "id,store_type" }).catch(() => []),
    read<RawClassificationRow>("customer_classification", {
      fields: "id,classification_name",
    }).catch(() => []),
    read<RawSalesmanRow>("salesman", {
      fields: "id,salesman_code,salesman_name",
    }).catch(() => []),
  ]);

  // Ensure dispatch-linked sales orders are known to resolve customer_code
  const loadedOrderIds = new Set(orders.map((o) => Number(o.order_id)));
  const missingDispatchOrderIds = Array.from(
    new Set(dispatchPlanDetails.map((d) => Number(d.sales_order_id)))
  ).filter((id) => Number.isFinite(id) && id > 0 && !loadedOrderIds.has(id));

  const extraOrders = flatten(
    await Promise.all(
      chunk(missingDispatchOrderIds).map((ids) =>
        read<RawSalesOrderRow>("sales_order", {
          fields:
            "order_id,order_no,po_no,customer_code,salesman_id,branch_id,order_date,order_status,total_amount,net_amount",
          filter: { order_id: { _in: ids } },
        })
      )
    )
  );
  const allOrders = [...orders, ...extraOrders];

  // Memos referenced by customer_memo_invoices in window
  const memoIds = Array.from(
    new Set(memoInvoices.map((m) => Number(m.memo_id)).filter((id) => Number.isFinite(id) && id > 0))
  );
  const memos = flatten(
    await Promise.all(
      chunk(memoIds).map((ids) =>
        read<RawCustomersMemoRow>("customers_memo", {
          fields: "id,memo_number,customer_id,amount,applied_amount,reason,status,created_at,deleted_at",
          filter: { id: { _in: ids } },
        })
      )
    )
  );

  // Invoices referenced by memoInvoices if not already loaded
  const memoInvoiceIds = Array.from(
    new Set(
      memoInvoices
        .map((m) => Number(m.invoice_id))
        .filter((id) => Number.isFinite(id) && id > 0 && !loadedInvoiceIds.has(id))
    )
  );
  const memoExtraInvoices = flatten(
    await Promise.all(
      chunk(memoInvoiceIds).map((ids) =>
        read<RawSalesInvoiceRow>("sales_invoice", {
          fields:
            "invoice_id,order_id,customer_code,invoice_no,salesman_id,branch_id,invoice_date,transaction_status,payment_status,total_amount,net_amount,gross_amount,discount_amount,sales_type",
          filter: { invoice_id: { _in: ids }, ...branchFilter },
        })
      )
    )
  );
  const finalInvoices = [...allRelevantInvoices, ...memoExtraInvoices];

  // Collect all candidate customer codes + customer IDs from memos
  const candidateCodes = Array.from(
    new Set(
      [
        ...finalInvoices.map((i) => i.customer_code),
        ...allOrders.map((o) => o.customer_code),
        ...returns.map((r) => r.customer_code),
      ].filter((c): c is string => Boolean(c && c.trim()))
    )
  );

  // Only show active customers (customer.isActive = 1)
  const customers = flatten(
    await Promise.all(
      chunk(candidateCodes).map((codes) =>
        read<RawCustomerRow>("customer", {
          fields:
            "id,customer_code,customer_name,type,customer_image,store_name,store_signage,brgy,city,province,contact_number,customer_email,tel_number,customer_tin,payment_term,store_type,price_type,date_entered,isActive,isVAT,isEWT,classification,location,credit_limit,house_no,unit_building,street,purok_sitio,subdivision,zip_code,region,otherDetails",
          filter: {
            customer_code: { _in: codes },
            isActive: { _eq: 1 },
          },
        })
      )
    )
  );

  const customerIds = customers.map((c) => Number(c.id));
  const customerSalesmen = await Promise.all(
    chunk(customerIds).map((ids) =>
      read<RawCustomerSalesmanRow>("customer_salesmen", {
        fields: "id,customer_id,salesman_id",
        filter: { customer_id: { _in: ids } },
      })
    )
  )
    .then(flatten)
    .catch(() => []);

  return {
    scopeMasters,
    customers,
    storeTypes,
    classifications,
    customerSalesmen,
    salesmen,
    invoices: finalInvoices,
    invoiceDetails,
    payments,
    posSerials,
    orders: allOrders,
    orderDetails,
    dispatchPlans,
    dispatchPlanDetails,
    returns,
    returnDetails,
    memoInvoices,
    memos,
  };
}

/**
 * Reads full customer history across all verified sources for one customerCode.
 */
export async function readDetailSourceBundle(
  customerCode: string,
  options: RepoOptions = {}
): Promise<DetailSourceBundle> {
  const read = getReader(options);
  const scopeMasters = await readScopeMasters(options);
  const authorizedBranchIds = scopeMasters.branches.map((b) => Number(b.id));
  const branchFilter =
    authorizedBranchIds.length > 0
      ? { branch_id: { _in: authorizedBranchIds } }
      : { branch_id: { _in: [-1] } };

  const [customerRows, storeTypes, classifications, salesmen, users] =
    await Promise.all([
      read<RawCustomerRow>("customer", {
        fields:
          "id,customer_code,customer_name,type,customer_image,store_name,store_signage,brgy,city,province,contact_number,customer_email,tel_number,customer_tin,payment_term,store_type,price_type,date_entered,isActive,isVAT,isEWT,classification,location,credit_limit,house_no,unit_building,street,purok_sitio,subdivision,zip_code,region,otherDetails",
        filter: { customer_code: { _eq: customerCode } },
        limit: 1,
      }),
      read<RawStoreTypeRow>("store_type", { fields: "id,store_type" }).catch(() => []),
      read<RawClassificationRow>("customer_classification", {
        fields: "id,classification_name",
      }).catch(() => []),
      read<RawSalesmanRow>("salesman", {
        fields: "id,salesman_code,salesman_name",
      }).catch(() => []),
      read<RawUserRow>("user", {
        fields: "user_id,user_fname,user_lname,user_email",
      }).catch(() => []),
    ]);

  const customer = customerRows[0] ?? null;
  if (!customer) {
    return {
      scopeMasters,
      customer: null,
      storeTypes,
      classifications,
      customerSalesmen: [],
      salesmen,
      users,
      invoices: [],
      invoiceDetails: [],
      payments: [],
      posSerials: [],
      posTransactions: [],
      orders: [],
      orderDetails: [],
      orderSerials: [],
      dispatchPlanDetails: [],
      dispatchPlans: [],
      returns: [],
      returnDetails: [],
      returnSerials: [],
      consolidatorMappings: [],
      consolidatorDetails: [],
      consolidators: [],
      memos: [],
      memoInvoices: [],
      auditTrails: [],
      discountLogs: [],
    };
  }

  // Primary customer documents (strictly scoped to industrial branches)
  const [
    customerSalesmen,
    invoices,
    orders,
    returns,
    orderSerials,
    memos,
    auditTrails,
    discountLogs,
  ] = await Promise.all([
    read<RawCustomerSalesmanRow>("customer_salesmen", {
      fields: "id,customer_id,salesman_id",
      filter: { customer_id: { _eq: customer.id } },
    }).catch(() => []),
    read<RawSalesInvoiceRow>("sales_invoice", {
      fields:
        "invoice_id,order_id,customer_code,invoice_no,salesman_id,branch_id,invoice_date,due_date,transaction_status,payment_status,total_amount,net_amount,gross_amount,discount_amount,sales_type,price_type,created_date,remarks,isDispatched,isReplaced",
      filter: { customer_code: { _eq: customerCode }, ...branchFilter },
    }),
    read<RawSalesOrderRow>("sales_order", {
      fields:
        "order_id,order_no,po_no,customer_code,salesman_id,branch_id,order_date,delivery_date,order_status,total_amount,net_amount,created_date,delivered_at,cancelled_at,remarks",
      filter: { customer_code: { _eq: customerCode }, ...branchFilter },
    }),
    read<RawSalesReturnRow>("sales_return", {
      fields:
        "return_id,return_number,customer_code,branch_id,return_date,total_amount,gross_amount,order_id,invoice_no,status,remarks,received_at,deleted_at",
      filter: { customer_code: { _eq: customerCode }, ...branchFilter },
    }),
    read<RawSalesOrderDetailSerialRow>("sales_order_details_serial", {
      fields:
        "id,sales_order_detail_id,sales_order_id,product_id,serial_number,customer_code,branch_id,dispatch_plan_id,delivery_date,created_date",
      filter: { customer_code: { _eq: customerCode }, ...branchFilter },
    }).catch(() => []),
    read<RawCustomersMemoRow>("customers_memo", {
      fields: "id,memo_number,customer_id,amount,applied_amount,reason,status,created_at,deleted_at",
      filter: { customer_id: { _eq: customer.id } },
    }).catch(() => []),
    read<RawAuditTrailRow>("audit_trail_table", {
      fields: "id,timestamp,user_id,action,table_name,record_id,field_name,old_value,new_value",
      filter: {
        table_name: { _in: ["customer", "customers", "customer_management"] },
        record_id: { _eq: customer.id },
      },
    }).catch(() => []),
    read<RawCustomerDiscountLogRow>("customer_discount_log", {
      fields:
        "log_id,discount_record_id,action_type,customer_code,discount_type,supplier_id,category_id,changed_by_user_id,changed_at",
      filter: { customer_code: { _eq: customerCode } },
    }).catch(() => []),
  ]);

  // Dependent child & linked reads
  const invoiceIds = invoices.map((i) => Number(i.invoice_id));
  const orderIds = orders.map((o) => Number(o.order_id));
  const returnNumbers = returns.map((r) => r.return_number).filter(Boolean);
  const memoIds = memos.map((m) => Number(m.id));
  const serialNumbers = Array.from(
    new Set(orderSerials.map((s) => s.serial_number).filter(Boolean))
  );

  const [
    invoiceDetails,
    payments,
    posSerials,
    orderDetails,
    dispatchPlanDetails,
    returnDetails,
    memoInvoices,
    consolidatorMappings,
  ] = await Promise.all([
    Promise.all(
      chunk(invoiceIds).map((ids) =>
        read<RawSalesInvoiceDetailRow>("sales_invoice_details", {
          fields: "detail_id,invoice_no,product_id,quantity,unit_price,total_amount,discount_amount,gross_amount",
          filter: { invoice_no: { _in: ids } },
        })
      )
    ).then(flatten),
    Promise.all(
      chunk(invoiceIds).map((ids) =>
        read<RawSalesInvoicePaymentRow>("sales_invoice_payments", {
          fields: "id,invoice_id,collection_id,reference_no,paid_amount,date_paid,coa_id",
          filter: { invoice_id: { _in: ids } },
        })
      )
    )
      .then(flatten)
      .catch(() => []),
    Promise.all(
      chunk(invoiceIds).map((ids) =>
        read<RawPosTransactionSerialRow>("pos_transaction_serial", {
          fields: "id,sales_invoice_id,pos_transaction_id,product_id,serial_number,movement_type,created_at,created_by",
          filter: { sales_invoice_id: { _in: ids } },
        })
      )
    )
      .then(flatten)
      .catch(() => []),
    Promise.all(
      chunk(orderIds).map((ids) =>
        read<RawSalesOrderDetailRow>("sales_order_details", {
          fields: "detail_id,order_id,product_id,ordered_quantity,served_quantity,net_amount",
          filter: { order_id: { _in: ids } },
        })
      )
    ).then(flatten),
    Promise.all(
      chunk(orderIds).map((ids) =>
        read<RawDispatchPlanDetailRow>("dispatch_plan_details", {
          fields: "detail_id,dispatch_id,sales_order_id",
          filter: { sales_order_id: { _in: ids } },
        })
      )
    )
      .then(flatten)
      .catch(() => []),
    Promise.all(
      chunk(returnNumbers).map((nums) =>
        read<RawSalesReturnDetailRow>("sales_return_details", {
          fields: "detail_id,return_no,product_id,quantity,total_amount,reason,status",
          filter: { return_no: { _in: nums } },
        })
      )
    ).then(flatten),
    Promise.all(
      chunk(memoIds).map((ids) =>
        read<RawCustomerMemoInvoiceRow>("customer_memo_invoices", {
          fields: "id,invoice_id,memo_id,amount,date_applied",
          filter: { memo_id: { _in: ids } },
        })
      )
    )
      .then(flatten)
      .catch(() => []),
    Promise.all(
      chunk(serialNumbers).map((sns) =>
        read<RawConsolidatorSerialMappingRow>("consolidator_serial_mappings", {
          fields: "id,detail_id,serial_number,scanned_at",
          filter: { serial_number: { _in: sns } },
        })
      )
    )
      .then(flatten)
      .catch(() => []),
  ]);

  // Grandchild reads (POS headers, dispatch plans, return serials, consolidator headers)
  const posTxIds = Array.from(
    new Set(
      posSerials
        .map((p) => p.pos_transaction_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const dispatchIds = Array.from(
    new Set(dispatchPlanDetails.map((d) => Number(d.dispatch_id)))
  );
  const returnDetailIds = returnDetails.map((rd) => Number(rd.detail_id));
  const consolidatorDetailIds = Array.from(
    new Set(consolidatorMappings.map((m) => Number(m.detail_id)))
  );

  const [posTransactions, dispatchPlans, returnSerials, consolidatorDetails] =
    await Promise.all([
      Promise.all(
        chunk(posTxIds).map((ids) =>
          read<RawPosTransactionRow>("pos_transactions", {
            fields:
              "transaction_id,invoice_no,customer_id,transaction_type,payment_method,payment_reference_no,total_amount,status,void_status,created_at",
            filter: { transaction_id: { _in: ids } },
          })
        )
      )
        .then(flatten)
        .catch(() => []),
      Promise.all(
        chunk(dispatchIds).map((ids) =>
          read<RawDispatchPlanRow>("dispatch_plan", {
            fields: "dispatch_id,dispatch_no,dispatch_date,branch_id,created_at,status,total_amount,remarks,is_delete",
            filter: { dispatch_id: { _in: ids }, ...branchFilter },
          })
        )
      )
        .then(flatten)
        .catch(() => []),
      Promise.all(
        chunk(returnDetailIds).map((ids) =>
          read<RawSalesReturnSerialRow>("sales_return_serial", {
            fields: "id,sales_return_detail_id,serial_number,created_at",
            filter: { sales_return_detail_id: { _in: ids } },
          })
        )
      )
        .then(flatten)
        .catch(() => []),
      Promise.all(
        chunk(consolidatorDetailIds).map((ids) =>
          read<RawConsolidatorDetailRow>("consolidator_details", {
            fields: "id,consolidator_id,product_id,ordered_quantity,picked_quantity,applied_quantity",
            filter: { id: { _in: ids } },
          })
        )
      )
        .then(flatten)
        .catch(() => []),
    ]);

  const consolidatorIds = Array.from(
    new Set(consolidatorDetails.map((cd) => Number(cd.consolidator_id)))
  );
  const consolidators = await Promise.all(
    chunk(consolidatorIds).map((ids) =>
      read<RawConsolidatorRow>("consolidator", {
        fields: "id,consolidator_no,status,branch_id,created_at,picked_at,audited_at,is_delete",
        filter: { id: { _in: ids }, ...branchFilter },
      })
    )
  )
    .then(flatten)
    .catch(() => []);

  return {
    scopeMasters,
    customer,
    storeTypes,
    classifications,
    customerSalesmen,
    salesmen,
    users,
    invoices,
    invoiceDetails,
    payments,
    posSerials,
    posTransactions,
    orders,
    orderDetails,
    orderSerials,
    dispatchPlanDetails,
    dispatchPlans,
    returns,
    returnDetails,
    returnSerials,
    consolidatorMappings,
    consolidatorDetails,
    consolidators,
    memos,
    memoInvoices,
    auditTrails,
    discountLogs,
  };
}
