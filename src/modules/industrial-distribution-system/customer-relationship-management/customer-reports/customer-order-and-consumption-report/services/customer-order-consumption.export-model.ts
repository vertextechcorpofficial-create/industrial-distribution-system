// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/services/customer-order-consumption.export-model.ts
// ============================================================
// Model formatting for Excel (.xlsx) and PDF report generation.
// No LaTeX used.
// ============================================================

import type {
  CustomerOrderConsumptionReportResponse,
  CustomerOrderConsumptionRow,
  ProductConsumptionSummary,
  ReportException,
} from "../types/customer-order-consumption.types";

export interface FlatCustomerExportRow {
  "Customer Code": string;
  "Customer Name": string;
  "Store Name": string;
  "Branch": string;
  "Classification": string;
  "Order Frequency": number;
  "Fulfilled Pieces": number;
  "Returned Pieces": number;
  "Net Pieces": number;
  "Gross Kg": number;
  "Returned Kg": number;
  "Net Purchased Kg": number;
  "Avg Order Size Kg": number;
  "Net Revenue (PHP)": number;
}

export interface FlatProductExportRow {
  "Customer Code": string;
  "Customer Name": string;
  "Product Name": string;
  "Product Code": string;
  "Cylinder Size (Kg)": string;
  "Gas Type": string;
  "Channel": string;
  "Order Frequency": number;
  "Fulfilled Pieces": number;
  "Returned Pieces": number;
  "Net Pieces": number;
  "Gross Kg": number;
  "Returned Kg": number;
  "Net Purchased Kg": number;
  "Avg Order Size Kg": number;
  "Net Revenue (PHP)": number;
}

export interface FlatExceptionExportRow {
  "Exception Code": string;
  "Channel": string;
  "Customer Code": string;
  "Customer Name": string;
  "Reference Type": string;
  "Reference No": string;
  "Detail": string;
  "Quantity": number;
  "Kg": number;
}

export function flattenCustomersForExport(rows: CustomerOrderConsumptionRow[]): FlatCustomerExportRow[] {
  return rows.map((r) => ({
    "Customer Code": r.customerCode,
    "Customer Name": r.customerName,
    "Store Name": r.storeName,
    "Branch": r.branchName,
    "Classification": r.classificationName,
    "Order Frequency": r.orderFrequency,
    "Fulfilled Pieces": r.fulfilledQty,
    "Returned Pieces": r.returnedQty,
    "Net Pieces": r.netQty,
    "Gross Kg": Math.round(r.grossKg * 100) / 100,
    "Returned Kg": Math.round(r.returnedKg * 100) / 100,
    "Net Purchased Kg": Math.round(r.netKg * 100) / 100,
    "Avg Order Size Kg": r.avgOrderSizeKg,
    "Net Revenue (PHP)": Math.round(r.netAmount * 100) / 100,
  }));
}

export function flattenProductsForExport(rows: CustomerOrderConsumptionRow[]): FlatProductExportRow[] {
  const result: FlatProductExportRow[] = [];
  for (const r of rows) {
    for (const p of r.products) {
      result.push({
        "Customer Code": r.customerCode,
        "Customer Name": r.customerName,
        "Product Name": p.productName,
        "Product Code": p.productCode,
        "Cylinder Size (Kg)": p.cylinderSizeKg ? `${p.cylinderSizeKg} kg` : "N/A",
        "Gas Type": p.gasType ?? "LPG",
        "Channel": p.channel,
        "Order Frequency": p.orderFrequency,
        "Fulfilled Pieces": p.fulfilledQty,
        "Returned Pieces": p.returnedQty,
        "Net Pieces": p.netQty,
        "Gross Kg": Math.round(p.grossKg * 100) / 100,
        "Returned Kg": Math.round(p.returnedKg * 100) / 100,
        "Net Purchased Kg": Math.round(p.netKg * 100) / 100,
        "Avg Order Size Kg": p.avgOrderSizeKg,
        "Net Revenue (PHP)": Math.round(p.netAmount * 100) / 100,
      });
    }
  }
  return result;
}

export function flattenExceptionsForExport(exceptions: ReportException[]): FlatExceptionExportRow[] {
  return exceptions.map((e) => ({
    "Exception Code": e.code,
    "Channel": e.channel,
    "Customer Code": e.customerCode,
    "Customer Name": e.customerName,
    "Reference Type": e.referenceType,
    "Reference No": e.referenceNo,
    "Detail": e.detail,
    "Quantity": e.quantity,
    "Kg": e.kg,
  }));
}
