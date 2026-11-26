// ============================================================================
// Customer History — TypeScript Domain Contracts
// All types map strictly to verified columns in zmine/manufacturing-table.txt.
// ============================================================================

export type DetailRangePreset = "this_month" | "12_months" | "all";

export type EventKind =
  | "profile"
  | "invoice"
  | "pos"
  | "order"
  | "payment"
  | "dispatch"
  | "return"
  | "serial"
  | "consolidation"
  | "memo";

export type HistoryEventGroup = "timeline" | "transactions" | "logistics" | "notes";

/**
 * Applied filter context for the main Customer History list.
 * Draft filters live in the UI and only promote to Applied on "Apply Filters".
 */
export interface CustomerHistoryFilters {
  startDate: string;
  endDate: string;
  branchId: string; // "all" or numeric branch ID as string
  productId: string; // "all" or numeric parent product ID as string
}

export interface LookupOption {
  value: string;
  label: string;
  code?: string;
}

/**
 * Raw Directus row definitions (matching verified DDL columns).
 */
export interface RawBranchRow {
  id: number;
  branch_name: string;
  branch_code: string;
  division_id: number | null;
  isActive: number | null;
}

export interface RawProductRow {
  product_id: number;
  parent_id: number | null;
  product_code: string | null;
  product_name: string | null;
  description: string | null;
  is_serialized: number | boolean;
}

export interface RawCustomerRow {
  id: number;
  customer_code: string;
  customer_name: string;
  type: "Regular" | "Employee";
  customer_image: string | null;
  store_name: string;
  store_signage: string;
  brgy: string | null;
  city: string | null;
  province: string | null;
  contact_number: string;
  customer_email: string | null;
  tel_number: string | null;
  customer_tin: string | null;
  payment_term: number | null;
  store_type: number;
  price_type: string | null;
  date_entered: string | null;
  isActive: number;
  isVAT: number;
  isEWT: number;
  classification: number | null;
  location: unknown;
  credit_limit: string | number | null;
  house_no: string | null;
  unit_building: string | null;
  street: string | null;
  purok_sitio: string | null;
  subdivision: string | null;
  zip_code: string | null;
  region: string | null;
  otherDetails: string | null;
}

export interface RawStoreTypeRow {
  id: number;
  store_type: string | null;
}

export interface RawClassificationRow {
  id: number;
  classification_name: string | null;
}

export interface RawCustomerSalesmanRow {
  id: number;
  customer_id: number;
  salesman_id: number;
}

export interface RawSalesmanRow {
  id: number;
  salesman_code: string;
  salesman_name: string;
}

export interface RawSalesInvoiceRow {
  invoice_id: number;
  order_id: string | null;
  customer_code: string | null;
  invoice_no: string | null;
  salesman_id: number | null;
  branch_id: number | null;
  invoice_date: string | null;
  due_date: string | null;
  transaction_status: string | null;
  payment_status: string | null;
  total_amount: number | null;
  net_amount: number | null;
  gross_amount: number | null;
  discount_amount: number | null;
  sales_type: number | null;
  price_type: string | null;
  created_date: string | null;
  remarks: string | null;
  isDispatched: number | boolean | null;
  isReplaced: number | boolean | null;
}

export interface RawSalesInvoiceDetailRow {
  detail_id: number;
  invoice_no: number; // FK to sales_invoice.invoice_id
  product_id: number;
  quantity: number;
  unit_price: number;
  total_amount: number;
  discount_amount: number | null;
  gross_amount: number | null;
}

export interface RawPosTransactionRow {
  transaction_id: string;
  invoice_no: string | null;
  customer_id: string | null;
  transaction_type: string;
  payment_method: string;
  payment_reference_no: string | null;
  total_amount: string | number;
  status: string;
  void_status: string;
  created_at: string;
}

export interface RawPosTransactionSerialRow {
  id: number;
  sales_invoice_id: number;
  pos_transaction_id: string | null;
  product_id: number;
  serial_number: string;
  movement_type: "IN" | "OUT";
  created_at: string;
  created_by: string | null;
}

export interface RawSalesOrderRow {
  order_id: number;
  order_no: string;
  po_no: string;
  customer_code: string;
  salesman_id: number | null;
  branch_id: number | null;
  order_date: string;
  delivery_date: string | null;
  order_status: string;
  total_amount: number | null;
  net_amount: number | null;
  created_date: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  remarks: string | null;
}

export interface RawSalesOrderDetailRow {
  detail_id: number;
  order_id: number;
  product_id: number;
  ordered_quantity: number;
  served_quantity: number;
  net_amount: number | null;
}

export interface RawSalesOrderDetailSerialRow {
  id: number;
  sales_order_detail_id: number;
  sales_order_id: number;
  product_id: number;
  serial_number: string;
  customer_code: string;
  branch_id: number | null;
  dispatch_plan_id: number | null;
  delivery_date: string | null;
  created_date: string | null;
}

export interface RawSalesInvoicePaymentRow {
  id: number;
  invoice_id: number;
  collection_id: number | null;
  reference_no: string | null;
  paid_amount: number;
  date_paid: string;
  coa_id: number;
}

export interface RawDispatchPlanRow {
  dispatch_id: number;
  dispatch_no: string;
  dispatch_date: string | null;
  branch_id: number | null;
  created_at: string | null;
  status: string;
  total_amount: number | null;
  remarks: string | null;
  is_delete: number | boolean | null;
}

export interface RawDispatchPlanDetailRow {
  detail_id: number;
  dispatch_id: number;
  sales_order_id: number;
}

export interface RawSalesReturnRow {
  return_id: number;
  return_number: string;
  customer_code: string;
  branch_id: number | null;
  return_date: string;
  total_amount: string | number;
  gross_amount: string | number;
  order_id: string;
  invoice_no: string | null;
  status: string | null;
  remarks: string | null;
  received_at: string | null;
  deleted_at: string | null;
}

export interface RawSalesReturnDetailRow {
  detail_id: number;
  return_no: string;
  product_id: number;
  quantity: number;
  total_amount: string | number;
  reason: string | null;
  status: string | null;
}

export interface RawSalesReturnSerialRow {
  id: number;
  sales_return_detail_id: number;
  serial_number: string;
  created_at: string | null;
}

export interface RawConsolidatorRow {
  id: number;
  consolidator_no: string;
  status: string | null;
  branch_id: number | null;
  created_at: string | null;
  picked_at: string | null;
  audited_at: string | null;
  is_delete: number | boolean | null;
}

export interface RawConsolidatorDetailRow {
  id: number;
  consolidator_id: number;
  product_id: number;
  ordered_quantity: number;
  picked_quantity: number;
  applied_quantity: number;
}

export interface RawConsolidatorSerialMappingRow {
  id: number;
  detail_id: number;
  serial_number: string;
  scanned_at: string | null;
}

export interface RawCustomersMemoRow {
  id: number;
  memo_number: string;
  customer_id: number;
  amount: number;
  applied_amount: number;
  reason: string | null;
  status: string;
  created_at: string | null;
  deleted_at: string | null;
}

export interface RawCustomerMemoInvoiceRow {
  id: number;
  invoice_id: number | null;
  memo_id: number | null;
  amount: number | null;
  date_applied: string | null;
}

export interface RawAuditTrailRow {
  id: number;
  timestamp: string | null;
  user_id: number | null;
  action: string | null;
  table_name: string | null;
  record_id: number | null;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
}

export interface RawCustomerDiscountLogRow {
  log_id: number;
  discount_record_id: number;
  action_type: "INSERT" | "UPDATE" | "DELETE";
  customer_code: string | null;
  discount_type: number | null;
  supplier_id: number | null;
  category_id: number | null;
  changed_by_user_id: number | null;
  changed_at: string;
}

export interface RawUserRow {
  user_id: number;
  user_fname: string | null;
  user_lname: string | null;
  user_email: string | null;
}

/**
 * Aggregated Customer History Row (Main Table).
 */
export interface CustomerHistoryRow {
  customerId: number;
  customerCode: string;
  customerName: string;
  storeName: string;
  storeSignage: string;
  type: "Regular" | "Employee";
  classificationName: string;
  storeTypeName: string;
  salesmanName: string;
  salesmanCode: string;
  isActive: number;
  dateEntered: string | null;
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
  netSalesAmount: number;
  lastActivityAt: string | null;
  totalEvents: number;
}

export interface CustomerHistoryKpis {
  totalCustomers: number;
  totalInvoices: number;
  totalPayments: number;
  totalReturns: number;
  netSalesAmount: number;
  totalEvents: number;
}

export interface ActivityTrendPoint {
  date: string;
  label: string;
  invoices: number;
  payments: number;
  returns: number;
  salesAmount: number;
  paymentAmount: number;
}

export interface CategoryMixPoint {
  kind: EventKind;
  label: string;
  count: number;
}

export interface TopCustomerPoint {
  customerCode: string;
  customerName: string;
  netSalesAmount: number;
  totalEvents: number;
}

export interface CustomerHistoryListResponse {
  ok: true;
  rows: CustomerHistoryRow[];
  kpis: CustomerHistoryKpis;
  trend: ActivityTrendPoint[];
  categoryMix: CategoryMixPoint[];
  topCustomers: TopCustomerPoint[];
  appliedFilters: CustomerHistoryFilters;
  generatedAt: string;
}

/**
 * Unified Business Activity Event for the customer detail modal.
 */
export interface HistoryEventMeta {
  label: string;
  value: string;
}

export interface HistoryEvent {
  id: string;
  kind: EventKind;
  occurredAt: string | null;
  title: string;
  reference: string;
  amount: number | null;
  status: string;
  branchName: string;
  productSummary: string;
  meta: HistoryEventMeta[];
}

/**
 * Separate Audit Trail Entry (who changed what, from old to new, and when).
 */
export interface AuditEntry {
  id: string;
  occurredAt: string | null;
  actorName: string;
  action: string;
  targetTable: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
}

export interface CustomerProfileSummary {
  id: number;
  customerCode: string;
  customerName: string;
  type: "Regular" | "Employee";
  customerImage: string | null;
  storeName: string;
  storeSignage: string;
  storeTypeName: string;
  classificationName: string;
  salesmanName: string;
  salesmanCode: string;
  contactNumber: string;
  telNumber: string;
  customerEmail: string;
  address: string;
  coordinates: string;
  customerTin: string;
  isVAT: number;
  isEWT: number;
  paymentTerm: number | null;
  priceType: string;
  creditLimit: number | null;
  dateEntered: string | null;
  isActive: number;
}

export interface CustomerMonthlySeriesPoint {
  month: string;
  label: string;
  salesAmount: number;
  paymentAmount: number;
  returnAmount: number;
  eventCount: number;
}

export interface CustomerDetailSummary {
  totalTransactions: number;
  invoiceCount: number;
  posCount: number;
  orderCount: number;
  paymentCount: number;
  dispatchCount: number;
  returnCount: number;
  serialCount: number;
  consolidationCount: number;
  memoCount: number;
  auditCount: number;
  totalSalesAmount: number;
  totalPaymentAmount: number;
  totalReturnAmount: number;
  netSalesAmount: number;
}

export interface CustomerHistoryDetailResponse {
  ok: true;
  profile: CustomerProfileSummary;
  summary: CustomerDetailSummary;
  timeline: HistoryEvent[];
  transactions: HistoryEvent[];
  logistics: HistoryEvent[];
  notes: HistoryEvent[];
  audit: AuditEntry[];
  monthlySeries: CustomerMonthlySeriesPoint[];
  categoryMix: CategoryMixPoint[];
  appliedRange: DetailRangePreset;
  generatedAt: string;
}

/**
 * User-configurable Print Settings (no hardcoded layout).
 */
export type PrintPaperSize = "auto" | "A4" | "Letter" | "Legal";
export type PrintOrientation = "portrait" | "landscape";
export type PrintRowScope = "current_page" | "all_filtered";
export type PrintFontSize = "compact" | "normal" | "comfortable";

export interface PrintConfig {
  paperSize: PrintPaperSize;
  orientation: PrintOrientation;
  marginMm: number;
  scalePercent: number;
  fontSize: PrintFontSize;
  title: string;
  subtitle: string;
  showHeaderFooter: boolean;
  showPageNumbers: boolean;
  showFiltersSummary: boolean;
  showKpis: boolean;
  showCharts: boolean;
  showTable: boolean;
  rowScope: PrintRowScope;
  includedColumns: string[];
}
