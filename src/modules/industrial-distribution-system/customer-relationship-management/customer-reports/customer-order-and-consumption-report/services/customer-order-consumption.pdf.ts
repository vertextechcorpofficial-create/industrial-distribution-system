// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/services/customer-order-consumption.pdf.ts
// ============================================================
// PDF Export using jsPDF and jspdf-autotable.
// Landscape A4 orientation.
// No LaTeX formatting used.
// ============================================================

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CustomerOrderConsumptionReportResponse } from "../types/customer-order-consumption.types";
import { formatAmount, formatKgCompact, formatQty } from "./customer-order-consumption.helpers";

export function generateCustomerOrderConsumptionPdf(
  report: CustomerOrderConsumptionReportResponse
): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  // Title & Header
  doc.setFontSize(16);
  doc.text("Customer Order & Consumption Report", 40, 40);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `Window: ${report.filters.startDate} to ${report.filters.endDate}  |  Cutoff: ${report.reportingCutoff}  |  Generated: ${new Date(report.generatedAt).toLocaleString()}`,
    40,
    58
  );

  doc.text(
    `Total Customers: ${report.overview.totalCustomers}  |  Orders: ${report.overview.totalOrders}  |  Cylinder Net: ${formatKgCompact(report.overview.cylinder.netKg)}  |  LPG Net: ${formatKgCompact(report.overview.lpg.netKg)}`,
    40,
    74
  );

  // Table Data (Customer Main Group)
  const tableRows = report.rows.map((r) => [
    r.customerCode,
    r.customerName,
    r.branchName,
    formatQty(r.orderFrequency),
    formatQty(r.fulfilledQty),
    formatQty(r.returnedQty),
    formatQty(r.netQty),
    formatKgCompact(r.netKg),
    formatKgCompact(r.avgOrderSizeKg),
    formatAmount(r.netAmount),
  ]);

  autoTable(doc, {
    startY: 90,
    head: [
      [
        "Code",
        "Customer",
        "Branch",
        "Orders",
        "Fulfilled",
        "Returned",
        "Net Units",
        "Net Kg",
        "Avg Order",
        "Net Revenue",
      ],
    ],
    body: tableRows,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [40, 50, 70], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
  });

  return doc;
}

export function downloadCustomerOrderConsumptionPdf(
  report: CustomerOrderConsumptionReportResponse,
  filename = "customer-order-and-consumption-report.pdf"
): void {
  const doc = generateCustomerOrderConsumptionPdf(report);
  doc.save(filename);
}

/**
 * Generates the landscape A4 PDF report with print instructions embedded
 * and opens a print-ready preview window. Falls back to window.print() if
 * browser popup settings block opening a new tab.
 */
export function printCustomerOrderConsumptionPdf(
  report: CustomerOrderConsumptionReportResponse
): "pdf_window" | "browser_print" {
  const doc = generateCustomerOrderConsumptionPdf(report);
  doc.autoPrint();
  const blobUrl = doc.output("bloburl");
  const printWindow = window.open(String(blobUrl), "_blank", "noopener,noreferrer");
  if (printWindow) {
    return "pdf_window";
  }
  window.print();
  return "browser_print";
}
