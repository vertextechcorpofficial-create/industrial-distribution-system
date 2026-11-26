"use client";

// ============================================================================
// Customer History — Configurable Printable Sheet
// Renders strictly according to user's PrintConfig (columns, sections, scale).
// ============================================================================

import * as React from "react";
import { formatCurrency } from "@/lib/utils";
import {
  formatDateDisplay,
  formatDateTimeDisplay,
} from "../../services/customer-history.helpers";
import type {
  CustomerHistoryDetailResponse,
  CustomerHistoryFilters,
  CustomerHistoryKpis,
  CustomerHistoryRow,
  PrintConfig,
} from "../../types/customer-history.types";
import { CUSTOMER_PRINTABLE_COLUMNS } from "../CustomerTable";

interface PrintSheetProps {
  mode: "list" | "detail";
  config: PrintConfig;
  filters: CustomerHistoryFilters;
  kpis?: CustomerHistoryKpis | null;
  rows: CustomerHistoryRow[];
  detail?: CustomerHistoryDetailResponse | null;
  generatedAt?: string;
}

function renderCellValue(row: CustomerHistoryRow, colKey: string): string {
  switch (colKey) {
    case "customerCode":
      return row.customerCode;
    case "customerName":
      return row.customerName;
    case "storeName":
      return row.storeName;
    case "classificationName":
      return row.classificationName;
    case "salesmanName":
      return row.salesmanName;
    case "invoiceCount":
      return String(row.invoiceCount);
    case "paymentCount":
      return String(row.paymentCount);
    case "returnCount":
      return String(row.returnCount);
    case "netSalesAmount":
      return formatCurrency(row.netSalesAmount);
    case "lastActivityAt":
      return formatDateDisplay(row.lastActivityAt);
    case "isActive":
      return row.isActive === 1 ? "Active" : "Inactive";
    default:
      return "-";
  }
}

export const PrintSheet = React.forwardRef<HTMLDivElement, PrintSheetProps>(
  function PrintSheet(
    { mode, config, filters, kpis, rows, detail, generatedAt },
    ref
  ) {
    const fontClass =
      config.fontSize === "compact"
        ? "text-[10px]"
        : config.fontSize === "comfortable"
          ? "text-[13px]"
          : "text-[11px]";

    const activeColumns = CUSTOMER_PRINTABLE_COLUMNS.filter((c) =>
      config.includedColumns.includes(c.key)
    );

    return (
      <div
        ref={ref}
        className={`customer-history-print-root bg-white p-4 text-slate-900 ${fontClass}`}
      >
        {config.showHeaderFooter && (
          <header className="mb-4 border-b border-slate-300 pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold tracking-tight">
                  {config.title || "Customer History Report"}
                </h1>
                {config.subtitle && (
                  <p className="text-xs text-slate-600">{config.subtitle}</p>
                )}
              </div>
              <div className="text-right text-[10px] text-slate-500">
                <p>Generated: {formatDateTimeDisplay(generatedAt ?? new Date().toISOString())}</p>
         
              </div>
            </div>
          </header>
        )}

        {config.showFiltersSummary && (
          <section className="mb-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-700">
            <strong>Applied Filters:</strong> {filters.startDate} to {filters.endDate} · Branch:{" "}
            {filters.branchId === "all" ? "All Branches" : filters.branchId} · Product:{" "}
            {filters.productId === "all" ? "All Products" : filters.productId}
          </section>
        )}

        {mode === "list" && config.showKpis && kpis && (
          <section className="mb-4 grid grid-cols-5 gap-2">
            <div className="rounded border border-slate-200 p-2">
              <div className="text-[9px] uppercase text-slate-500">Customers</div>
              <div className="text-sm font-bold">{kpis.totalCustomers}</div>
            </div>
            <div className="rounded border border-slate-200 p-2">
              <div className="text-[9px] uppercase text-slate-500">Invoices</div>
              <div className="text-sm font-bold">{kpis.totalInvoices}</div>
            </div>
            <div className="rounded border border-slate-200 p-2">
              <div className="text-[9px] uppercase text-slate-500">Payments</div>
              <div className="text-sm font-bold">{kpis.totalPayments}</div>
            </div>
            <div className="rounded border border-slate-200 p-2">
              <div className="text-[9px] uppercase text-slate-500">Returns</div>
              <div className="text-sm font-bold">{kpis.totalReturns}</div>
            </div>
            <div className="rounded border border-slate-200 p-2">
              <div className="text-[9px] uppercase text-slate-500">Net Sales</div>
              <div className="text-sm font-bold">{formatCurrency(kpis.netSalesAmount)}</div>
            </div>
          </section>
        )}

        {mode === "list" && config.showTable && (
          <table className="customer-history-print-table w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300 bg-slate-100 text-left">
                {activeColumns.map((col) => (
                  <th key={col.key} className="px-2 py-1.5 font-semibold">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.customerCode} className="border-b border-slate-200">
                  {activeColumns.map((col) => (
                    <td key={col.key} className="px-2 py-1.5">
                      {renderCellValue(row, col.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {mode === "detail" && detail && (
          <div className="space-y-4">
            <section className="rounded border border-slate-200 p-3">
              <h2 className="text-sm font-bold">
                {detail.profile.customerName} ({detail.profile.customerCode})
              </h2>
              <p className="text-[10px] text-slate-600">
                Store: {detail.profile.storeName} · Salesman: {detail.profile.salesmanName} ·
                Customer since {formatDateDisplay(detail.profile.dateEntered)}
              </p>
            </section>

            {config.showKpis && (
              <section className="grid grid-cols-4 gap-2">
                <div className="rounded border border-slate-200 p-2">
                  <div className="text-[9px] uppercase text-slate-500">Events</div>
                  <div className="text-sm font-bold">{detail.summary.totalTransactions}</div>
                </div>
                <div className="rounded border border-slate-200 p-2">
                  <div className="text-[9px] uppercase text-slate-500">Invoices</div>
                  <div className="text-sm font-bold">{detail.summary.invoiceCount}</div>
                </div>
                <div className="rounded border border-slate-200 p-2">
                  <div className="text-[9px] uppercase text-slate-500">Returns</div>
                  <div className="text-sm font-bold">{detail.summary.returnCount}</div>
                </div>
                <div className="rounded border border-slate-200 p-2">
                  <div className="text-[9px] uppercase text-slate-500">Net Sales</div>
                  <div className="text-sm font-bold">
                    {formatCurrency(detail.summary.netSalesAmount)}
                  </div>
                </div>
              </section>
            )}

            {config.showTable && (
              <table className="customer-history-print-table w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-300 bg-slate-100 text-left">
                    <th className="px-2 py-1.5 font-semibold">Date</th>
                    <th className="px-2 py-1.5 font-semibold">Event</th>
                    <th className="px-2 py-1.5 font-semibold">Reference</th>
                    <th className="px-2 py-1.5 font-semibold">Branch</th>
                    <th className="px-2 py-1.5 font-semibold">Product</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Amount</th>
                    <th className="px-2 py-1.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.timeline.map((evt) => (
                    <tr key={evt.id} className="border-b border-slate-200">
                      <td className="px-2 py-1.5">{formatDateTimeDisplay(evt.occurredAt)}</td>
                      <td className="px-2 py-1.5">{evt.title}</td>
                      <td className="px-2 py-1.5 font-mono">{evt.reference}</td>
                      <td className="px-2 py-1.5">{evt.branchName}</td>
                      <td className="px-2 py-1.5">{evt.productSummary}</td>
                      <td className="px-2 py-1.5 text-right">
                        {evt.amount !== null ? formatCurrency(evt.amount) : "-"}
                      </td>
                      <td className="px-2 py-1.5">{evt.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {config.showHeaderFooter && config.showPageNumbers && (
          <footer className="mt-4 border-t border-slate-200 pt-2 text-right text-[9px] text-slate-500">
            Industrial Distribution System · Customer History
          </footer>
        )}
      </div>
    );
  }
);
