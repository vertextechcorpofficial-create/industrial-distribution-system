// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/services/customer-order-consumption.xlsx.ts
// ============================================================
// Multi-sheet Excel export generator using SheetJS (xlsx).
// Generates:
// 1. Filters & Overview
// 2. Customer Demand Summary (Customer Main Group)
// 3. Customer Products Breakdown
// 4. Data Exceptions & Audit
// ============================================================

import * as XLSX from "xlsx";
import type { CustomerOrderConsumptionReportResponse } from "../types/customer-order-consumption.types";
import {
  flattenCustomersForExport,
  flattenExceptionsForExport,
  flattenProductsForExport,
} from "./customer-order-consumption.export-model";

export function generateCustomerOrderConsumptionWorkbook(
  report: CustomerOrderConsumptionReportResponse
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // 1. Filters & Overview Sheet
  const overviewRows = [
    ["Report", "Customer Order & Consumption Report"],
    ["Reporting Cutoff", report.reportingCutoff],
    ["Generated At", report.generatedAt],
    ["Start Date", report.filters.startDate],
    ["End Date", report.filters.endDate],
    ["Total Customers", report.overview.totalCustomers],
    ["Total Orders", report.overview.totalOrders],
    ["Cylinder Net Kg", report.overview.cylinder.netKg],
    ["LPG Net Kg", report.overview.lpg.netKg],
    ["Exceptions Count", report.overview.exceptionCount],
  ];
  const overviewSheet = XLSX.utils.aoa_to_sheet(overviewRows);
  overviewSheet["!cols"] = [{ wch: 22 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, overviewSheet, "Overview");

  // 2. Customer Summary Sheet (Main Group)
  const customerRows = flattenCustomersForExport(report.rows);
  const customerSheet = XLSX.utils.json_to_sheet(customerRows);
  customerSheet["!cols"] = [
    { wch: 16 }, // Customer Code
    { wch: 28 }, // Customer Name
    { wch: 20 }, // Store Name
    { wch: 18 }, // Branch
    { wch: 16 }, // Classification
    { wch: 16 }, // Order Frequency
    { wch: 16 }, // Fulfilled Pieces
    { wch: 16 }, // Returned Pieces
    { wch: 14 }, // Net Pieces
    { wch: 16 }, // Gross Kg
    { wch: 16 }, // Returned Kg
    { wch: 18 }, // Net Purchased Kg
    { wch: 18 }, // Avg Order Size Kg
    { wch: 20 }, // Net Revenue (PHP)
  ];
  XLSX.utils.book_append_sheet(wb, customerSheet, "Customers");

  // 3. Products Breakdown Sheet
  const productRows = flattenProductsForExport(report.rows);
  const productSheet = XLSX.utils.json_to_sheet(productRows);
  productSheet["!cols"] = [
    { wch: 16 }, // Customer Code
    { wch: 26 }, // Customer Name
    { wch: 30 }, // Product Name
    { wch: 16 }, // Product Code
    { wch: 18 }, // Cylinder Size
    { wch: 14 }, // Gas Type
    { wch: 12 }, // Channel
    { wch: 16 }, // Order Frequency
    { wch: 16 }, // Fulfilled Pieces
    { wch: 16 }, // Returned Pieces
    { wch: 14 }, // Net Pieces
    { wch: 16 }, // Gross Kg
    { wch: 16 }, // Returned Kg
    { wch: 18 }, // Net Purchased Kg
    { wch: 18 }, // Avg Order Size Kg
    { wch: 20 }, // Net Revenue
  ];
  XLSX.utils.book_append_sheet(wb, productSheet, "Products");

  // 4. Exceptions Sheet
  if (report.exceptions.length > 0) {
    const exceptionRows = flattenExceptionsForExport(report.exceptions);
    const exceptionSheet = XLSX.utils.json_to_sheet(exceptionRows);
    exceptionSheet["!cols"] = [
      { wch: 26 }, // Exception Code
      { wch: 12 }, // Channel
      { wch: 16 }, // Customer Code
      { wch: 24 }, // Customer Name
      { wch: 16 }, // Reference Type
      { wch: 18 }, // Reference No
      { wch: 45 }, // Detail
      { wch: 12 }, // Quantity
      { wch: 12 }, // Kg
    ];
    XLSX.utils.book_append_sheet(wb, exceptionSheet, "Exceptions");
  }

  return wb;
}

export function downloadCustomerOrderConsumptionExcel(
  report: CustomerOrderConsumptionReportResponse,
  filename = "customer-order-and-consumption-report.xlsx"
): void {
  const wb = generateCustomerOrderConsumptionWorkbook(report);
  XLSX.writeFile(wb, filename);
}
