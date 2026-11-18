// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/types/customer-order-consumption.types.ts
// ============================================================
// TypeScript interfaces for Customer Order & Consumption Report.
// Follows IDS guidelines:
// - Main group is Customer with nested Product breakdown
// - Products display products.description as product name
// - Products filtered by is_serialized = 1
// - Branches filtered by division_id = 1
// - Categories filtered by is_industrial = 1 (extracts cylinder size: 1.4kg, 11kg, 50kg)
// - Read-only analytical audit: no writes to DB, no inventory moves, no financial releases
// ============================================================

export type ConsumptionChannel = "CYLINDER" | "LPG";

export type BillingMode = "KILO" | "METERED" | "BOTH";

// ------------------------------------------------------------
// Filter inputs
// ------------------------------------------------------------
export interface CustomerOrderConsumptionFilters {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  customerCodes?: string[];
  branchIds?: number[];
  salesmanIds?: number[];
  classificationIds?: number[];
  categoryIds?: number[];
  channel?: ConsumptionChannel;
  search?: string;
}

export interface AppliedFilterContext extends CustomerOrderConsumptionFilters {
  customerLabels?: string[];
  branchLabels?: string[];
  salesmanLabels?: string[];
  classificationLabels?: string[];
  categoryLabels?: string[];
}

// ------------------------------------------------------------
// Raw Directus rows mirroring DB collections
// ------------------------------------------------------------
export interface RawBranchRow {
  id: number;
  branch_name: string;
  branch_code: string;
  division_id: number | null;
  isActive: number;
}

export interface RawCategoryRow {
  category_id: number;
  category_name: string;
  is_industrial: number;
}

export interface RawProductRow {
  product_id: number;
  parent_id?: number | null; // Null for parent products; populated for variants (EMPTY, SWAP, etc.)
  uom_ids?: string | null;
  product_code: string | null;
  product_name: string | null;
  description?: string | null; // Used as product name per ids-guide
  product_weight: number | null;
  weight: number | null;
  weight_unit_id: number | null;
  is_serialized?: unknown; // Filtered by is_serialized = 1
  product_category: number | null;
  density_factor?: number | null;
}

export interface RawCustomerRow {
  id?: number;
  customer_id?: number;
  customer_code: string;
  customer_name: string;
  store_name: string | null;
  classification: number | null;
  branch_id?: number | null;
}

export interface RawClassificationRow {
  id: number;
  classification_name: string;
}

export interface RawSalesmanRow {
  id: number;
  salesman_code: string;
  salesman_name: string;
}

export interface RawUnitRow {
  unit_id: number;
  unit_name: string;
  unit_shortcut: string | null;
}

export interface RawWeightUnitRow {
  id: number;
  code: string;
  name: string;
}

export interface RawInvoiceRow {
  invoice_id: number;
  order_id: string | null;
  invoice_no: string | null;
  customer_code: string | null;
  branch_id: number | null;
  salesman_id: number | null;
  invoice_date: string | null;
  transaction_status: string | null;
  net_amount: number | null;
  gross_amount: number | null;
  discount_amount: number | null;
  isReplaced?: unknown;
  isDispatched?: unknown;
}

export interface RawInvoiceDetailRow {
  detail_id: number;
  invoice_no: number; // holds sales_invoice.invoice_id
  product_id: number;
  unit: number | null;
  quantity: number;
  unit_price: number | null;
  total_amount: number | null;
  discount_amount: number | null;
  gross_amount: number | null;
}

export interface RawReturnRow {
  return_id: number;
  return_number: string;
  customer_code: string | null;
  branch_id: number | null;
  salesman_id: number | null;
  return_date: string | null;
  gross_amount: number | null;
  order_id: string | null;
  invoice_no: string | null;
  status: string | null;
  isPosted?: unknown;
  deleted_at: string | null;
}

export interface RawReturnDetailRow {
  detail_id: number;
  return_no: string; // sales_return.return_number
  product_id: number;
  quantity: number;
  total_amount: number | null;
  gross_amount: number | null;
  status: string | null;
}

export interface RawReturnLinkRow {
  id: number;
  return_no: number;
  invoice_no: number;
  amount: number | null;
}

export interface RawPostDispatchRow {
  id: number;
  sales_invoice_id: number;
  dispatch_number: string | null;
  dispatch_date: string | null;
  status: string | null;
}

export interface RawPostDispatchSerialRow {
  id: number;
  sales_invoice_id: number;
  serial_number: string;
  product_id?: number | null;
  created_at?: string | null;
}

export interface RawSalesOrderRow {
  order_id: number | string;
  order_no: string | null;
  customer_code: string | null;
  branch_id: number | null;
  order_date: string | null;
  delivery_date?: string | null;
  order_status: string | null;
  total_amount?: number | null;
  net_amount?: number | null;
  isCancelled?: number | boolean | string | null;
  remarks?: string | null;
}

export interface RawSalesOrderDetailRow {
  detail_id: number;
  order_id: number | string;
  product_id: number;
  ordered_quantity?: number | null;
  allocated_quantity?: number | null;
  served_quantity?: number | null;
  quantity?: number | null;
  unit_price?: number | null;
  gross_amount?: number | null;
  net_amount?: number | null;
}

export interface RawSalesOrderSerialRow {
  id: number;
  sales_order_id: string;
  serial_number: string;
  delivery_date: string | null;
  customer_code: string | null;
  branch_id: number | null;
  product_id: number | null;
}

export interface RawSalesReturnSerialRow {
  id: number;
  sales_return_detail_id: number;
  serial_number: string;
  created_at: string | null;
}

export interface RawUnfulfilledTransactionRow {
  id: number;
  sales_invoice_id: number | null;
  order_id: string | null;
  customer_code: string | null;
  transaction_date: string | null;
  status: string | null;
  remarks: string | null;
}

export interface RawUnfulfilledDetailRow {
  id: number;
  unfulfilled_sales_transaction_id: number;
  sales_invoice_detail_id: number | null;
  product_id?: number | null;
  quantity: number;
  total_amount: number | null;
  concern_type?: string | null;
}

export interface RawLpgSiteRow {
  id: number;
  customer_code: string;
  site_name: string;
  billing_mode: BillingMode;
  default_price_per_kg: number | null;
  is_active: number;
}

export type LpgBillableSource = "NONE" | "METERED" | "WIWO";
export type LpgTransactionType = "ONBOARDING_BASELINE" | "REGULAR_BILLING" | "ADJUSTMENT";

/**
 * Exact projection of vos_database.lpg_metered_wiwo_transactions.
 * Uses billable_source ('METERED' | 'WIWO') to classify Metered vs WIWO (Kg) consumption.
 */
export interface RawUnifiedLpgRow {
  id: number;
  transaction_header_id?: number | null;
  transaction_no: string;
  transaction_type?: LpgTransactionType | string | null;
  lpg_site_id: number;
  customer_code: string;
  sales_order_id?: number | null;
  sales_order_no?: string | null;
  meter_reading_id?: number | null;
  wiwo_header_id?: number | null;
  transaction_date: string;
  billing_period_from?: string | null;
  billing_period_to?: string | null;
  metered_kg: number | null;
  wiwo_kg: number | null;
  variance_kg: number | null;
  variance_reason_code?: string | null;
  billable_source: LpgBillableSource | string | null;
  billable_kg: number;
  price_per_kg: number;
  gross_amount?: number | null;
  net_amount: number;
  sales_invoice_id: number | null;
  sales_invoice_no: string | null;
  status: string;
}

export interface RawWiwoHeaderRow {
  id: number;
  wiwo_no: string;
  lpg_site_id: number;
  customer_code: string;
  transaction_date: string;
  wiwo_type: string;
  total_billable_kg: number;
  gross_amount: number;
  net_amount: number;
  wiwo_status: string;
  sales_invoice_id: number | null;
  sales_invoice_no: string | null;
}

export interface RawWiwoDetailRow {
  id: number;
  wiwo_header_id: number;
  lpg_site_id: number;
  customer_code: string;
  line_type: string;
  product_id: number;
  serial_number: string | null;
  tare_weight_kg: number | null;
  consumed_lpg_kg: number | null;
  billable_kg: number;
  price_per_kg: number | null;
  gross_amount: number | null;
  net_amount: number | null;
  is_billable: number;
}

export interface RawMeterReadingRow {
  id: number;
  lpg_site_id: number;
  customer_code: string;
  reading_no: string;
  reading_date: string;
  billing_period_from: string | null;
  billing_period_to: string | null;
  previous_reading?: number | null;
  current_reading?: number | null;
  raw_consumption?: number | null;
  meter_unit: string | null;
  kg_consumed: number;
  price_per_kg: number | null;
  gross_amount: number | null;
  net_amount: number | null;
  reading_status: string;
  sales_invoice_id: number | null;
  sales_invoice_no: string | null;
}

export interface RawLpgTransactionHeaderRow {
  header_id: number;
  header_no: string;
  customer_id: number;
  customer_site_id: number;
  period_from: string;
  period_to: string;
  status: string;
  is_billed: number;
}

export interface RawLpgHeaderInvoiceRow {
  id: number;
  header_id: number;
  sales_invoice_id: number;
  status: string | null;
}

export interface ConsumptionSourceData {
  invoices: RawInvoiceRow[];
  invoiceDetails: RawInvoiceDetailRow[];
  returns: RawReturnRow[];
  returnDetails: RawReturnDetailRow[];
  returnLinks: RawReturnLinkRow[];
  postDispatch: RawPostDispatchRow[];
  postDispatchSerials: RawPostDispatchSerialRow[];
  salesOrders: RawSalesOrderRow[];
  salesOrderDetails: RawSalesOrderDetailRow[];
  salesOrderSerials: RawSalesOrderSerialRow[];
  salesReturnSerials: RawSalesReturnSerialRow[];
  unfulfilledTransactions: RawUnfulfilledTransactionRow[];
  unfulfilledDetails: RawUnfulfilledDetailRow[];
  products: RawProductRow[];
  productLabels: RawProductRow[];
  units: RawUnitRow[];
  weightUnits: RawWeightUnitRow[];
  categories: RawCategoryRow[];
  customers: RawCustomerRow[];
  classifications: RawClassificationRow[];
  branches: RawBranchRow[];
  salesmen: RawSalesmanRow[];
  lpgSites: RawLpgSiteRow[];
  unifiedLpg: RawUnifiedLpgRow[];
  wiwoHeaders: RawWiwoHeaderRow[];
  wiwoDetails: RawWiwoDetailRow[];
  meterReadings: RawMeterReadingRow[];
  transactionHeaders: RawLpgTransactionHeaderRow[];
  headerInvoices: RawLpgHeaderInvoiceRow[];
}

// ------------------------------------------------------------
// Aggregation Data Structures (Customer Main Group, Nested Product)
// ------------------------------------------------------------
export interface MonthlyTrendPoint {
  yearMonth: string; // YYYY-MM
  orderCount: number;
  orderKeys: string[];
  grossQty: number;
  returnedQty: number;
  grossKg: number;
  returnedKg: number;
  netKg: number;
}

/** Product-level breakdown for a customer */
export interface ProductConsumptionSummary {
  productId: number;
  productCode: string;
  productName: string; // From products.description
  categoryName: string;
  cylinderSizeKg: number | null; // Parsed from categories.category_name (is_industrial=1)
  gasType: string | null;
  channel: ConsumptionChannel;
  orderFrequency: number;
  fulfilledQty: number;
  returnedQty: number;
  netQty: number;
  grossKg: number;
  returnedKg: number;
  netKg: number;
  avgOrderSizeKg: number;
  avgOrderSizeQty: number;
  netAmount: number;
  monthlyTrend: MonthlyTrendPoint[];
  exceptionCodes: string[];
}

/** Customer-level main group row */
export interface CustomerOrderConsumptionRow {
  rowKey: string; // customerCode|branchId
  customerCode: string;
  customerName: string;
  storeName: string;
  classificationName: string;
  branchId: number | null;
  branchName: string;
  orderFrequency: number;
  fulfilledQty: number;
  returnedQty: number;
  netQty: number;
  grossKg: number;
  returnedKg: number;
  netKg: number;
  avgOrderSizeKg: number;
  avgOrderSizeQty: number;
  netAmount: number;
  products: ProductConsumptionSummary[];
  monthlyTrend: MonthlyTrendPoint[];
  exceptionCodes: string[];
}

// ------------------------------------------------------------
// Supporting Documents Drill-down
// ------------------------------------------------------------
export type SupportingDocumentType =
  | "SALES_ORDER"
  | "SALES_INVOICE"
  | "POST_DISPATCH"
  | "SALES_RETURN"
  | "LPG_WIWO"
  | "METER_READING"
  | "UNFULFILLED_BACKLOG";

/**
 * Structured LPG reconciliation breakdown for Metered and WIWO (Kg) documents
 * surfaced in the Supporting Records Audit drawer.
 */
export interface SupportingLpgDetails {
  billableSource: "METERED" | "WIWO";
  transactionType?: string | null;
  siteName?: string | null;
  billingPeriodFrom?: string | null;
  billingPeriodTo?: string | null;
  meterReadingNo?: string | null;
  previousReading?: number | null;
  currentReading?: number | null;
  rawConsumption?: number | null;
  meterUnit?: string | null;
  meteredKg?: number | null;
  wiwoNo?: string | null;
  wiwoKg?: number | null;
  varianceKg?: number | null;
  varianceReason?: string | null;
  billableKg: number;
  pricePerKg?: number | null;
}

export interface SupportingDocument {
  id: string;
  documentType: SupportingDocumentType;
  documentNo: string;
  date: string;
  status: string;
  customerCode: string;
  customerName: string;
  branchName: string;
  productId: number;
  productName: string;
  productCode: string;
  quantity: number;
  kg: number;
  amount: number;
  serialNumbers: string[];
  reference: string;
  // Relational keys for grouping linked Sales Orders -> Invoices -> Returns -> LPG in the drill-down drawer
  orderNo?: string | null;
  invoiceNo?: string | null;
  returnNo?: string | null;
  lpgDetails?: SupportingLpgDetails | null;
  notes?: string;
}

export interface CustomerOrderConsumptionDetail {
  customerCode: string;
  customerName: string;
  storeName: string;
  classificationName: string;
  branchName: string;
  productId?: number | null;
  productName?: string | null;
  window: { startDate: string; endDate: string };
  documents: SupportingDocument[];
  exceptions: ReportException[];
}

// ------------------------------------------------------------
// Exceptions and Quality Flags
// ------------------------------------------------------------
export type ExceptionCode =
  | "MISSING_PRODUCT_WEIGHT"
  | "MISSING_PRODUCT_CATEGORY"
  | "UNFULFILLED_DELIVERY"
  | "RETURN_EXCEEDS_FULFILLED"
  | "UNBILLED_LPG_TRANSACTION"
  | "LPG_VARIANCE"
  | "BRANCH_UNKNOWN";

export interface ReportException {
  code: ExceptionCode;
  channel: ConsumptionChannel;
  customerCode: string;
  customerName: string;
  productName?: string;
  referenceType:
    | "SALES_ORDER"
    | "SALES_INVOICE"
    | "SALES_RETURN"
    | "WIWO"
    | "METER_READING"
    | "UNFULFILLED"
    | "PRODUCT";
  referenceNo: string;
  detail: string;
  quantity: number;
  kg: number;
}

// ------------------------------------------------------------
// Executive KPIs & Overview
// ------------------------------------------------------------
export interface ChannelTotals {
  customers: number;
  orders: number;
  grossQty: number;
  returnedQty: number;
  grossKg: number;
  returnedKg: number;
  netKg: number;
  netAmount: number;
  avgOrderSizeKg: number;
  returnRatePct: number;
}

export interface CustomerOrderConsumptionOverview {
  totalCustomers: number;
  totalOrders: number;
  cylinder: ChannelTotals;
  lpg: ChannelTotals;
  exceptionCount: number;
}

export interface ReportTrendPoint {
  yearMonth: string;
  channel: ConsumptionChannel;
  orderCount: number;
  orderKeys: string[];
  grossQty: number;
  returnedQty: number;
  grossKg: number;
  returnedKg: number;
  netKg: number;
}

// ------------------------------------------------------------
// BFF Envelope
// ------------------------------------------------------------
export interface CustomerOrderConsumptionReportResponse {
  filters: AppliedFilterContext;
  generatedAt: string;
  reportingCutoff: string;
  sourceRowCount: number;
  overview: CustomerOrderConsumptionOverview;
  rows: CustomerOrderConsumptionRow[];
  exceptions: ReportException[];
  monthlyTrend: ReportTrendPoint[];
}

export interface ReportLookupOption {
  value: string;
  label: string;
  code?: string;
}

export interface ReportLookupResponse {
  data: ReportLookupOption[];
}
