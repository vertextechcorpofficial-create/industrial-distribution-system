"use client";

// ============================================================================
// Customer History — Main Customer Summary Table
// Displays industrial-scoped customers with activity in the applied window.
// Every column header has a descriptive `title` attribute.
// ============================================================================

import * as React from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency } from "@/lib/utils";
import { formatDateDisplay } from "../services/customer-history.helpers";
import type { CustomerHistoryRow } from "../types/customer-history.types";
import { DataTableLite, type DataTableColumn } from "./DataTableLite";

export type CustomerTableColumnKey =
  | "customerCode"
  | "customerName"
  | "storeName"
  | "classificationName"
  | "salesmanName"
  | "invoiceCount"
  | "paymentCount"
  | "returnCount"
  | "netSalesAmount"
  | "lastActivityAt"
  | "isActive"
  | "actions";

export const CUSTOMER_PRINTABLE_COLUMNS: { key: string; label: string }[] = [
  { key: "customerCode", label: "Code" },
  { key: "customerName", label: "Customer Name" },
  { key: "storeName", label: "Store" },
  { key: "classificationName", label: "Classification" },
  { key: "salesmanName", label: "Salesman" },
  { key: "invoiceCount", label: "Invoices" },
  { key: "paymentCount", label: "Payments" },
  { key: "returnCount", label: "Returns" },
  { key: "netSalesAmount", label: "Net Sales" },
  { key: "lastActivityAt", label: "Last Activity" },
  { key: "isActive", label: "Status" },
];

interface CustomerTableProps {
  rows: CustomerHistoryRow[];
  isLoading: boolean;
  onViewCustomer: (customerCode: string) => void;
  onFilteredRowsChange?: (rows: CustomerHistoryRow[]) => void;
  onPagedRowsChange?: (rows: CustomerHistoryRow[]) => void;
}

export function CustomerTable({
  rows,
  isLoading,
  onViewCustomer,
  onFilteredRowsChange,
  onPagedRowsChange,
}: CustomerTableProps) {
  const columns = React.useMemo<DataTableColumn<CustomerHistoryRow, CustomerTableColumnKey>[]>(
    () => [
      {
        key: "customerCode",
        header: "Code",
        title: "Unique customer code from customer.customer_code",
        className: "w-[115px]",
        render: (r) => (
          <span className="block truncate font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
            {r.customerCode}
          </span>
        ),
      },
      {
        key: "customerName",
        header: "Customer",
        title: "Customer name and type from customer table",
        className: "w-[210px]",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{r.customerName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{r.type}</p>
          </div>
        ),
      },
      {
        key: "storeName",
        header: "Store",
        title: "Store name and signage from customer table",
        className: "w-[180px]",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">{r.storeName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{r.storeSignage}</p>
          </div>
        ),
      },
      {
        key: "classificationName",
        header: "Classification",
        title: "Customer classification from customer_classification",
        className: "w-[125px]",
        render: (r) => <span className="block truncate text-xs">{r.classificationName}</span>,
      },
      {
        key: "salesmanName",
        header: "Salesman",
        title: "Assigned salesman resolved via customer_salesmen -> salesman",
        className: "w-[155px]",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{r.salesmanName}</p>
            {r.salesmanCode !== "-" && (
              <p className="truncate text-[11px] text-muted-foreground">{r.salesmanCode}</p>
            )}
          </div>
        ),
      },
      {
        key: "invoiceCount",
        header: "Invoices",
        title: "Count of industrial sales invoices in the applied date range",
        align: "right",
        className: "w-[85px]",
        render: (r) => <span className="font-medium tabular-nums">{r.invoiceCount}</span>,
      },
      {
        key: "paymentCount",
        header: "Payments",
        title: "Count of recorded payments on industrial invoices in the applied date range",
        align: "right",
        className: "w-[90px]",
        render: (r) => <span className="font-medium tabular-nums">{r.paymentCount}</span>,
      },
      {
        key: "returnCount",
        header: "Returns",
        title: "Count of industrial sales returns in the applied date range",
        align: "right",
        className: "w-[85px]",
        render: (r) => <span className="font-medium tabular-nums">{r.returnCount}</span>,
      },
      {
        key: "netSalesAmount",
        header: "Net Sales",
        title: "Industrial invoice line totals minus industrial return totals",
        align: "right",
        className: "w-[125px]",
        render: (r) => (
          <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatCurrency(r.netSalesAmount)}
          </span>
        ),
      },
      {
        key: "lastActivityAt",
        header: "Last Activity",
        title: "Most recent industrial activity date inside the applied range",
        className: "w-[115px]",
        render: (r) => (
          <span className="block truncate whitespace-nowrap text-xs text-muted-foreground">
            {formatDateDisplay(r.lastActivityAt)}
          </span>
        ),
      },
      {
        key: "isActive",
        header: "Status",
        title: "Customer active status (customer.isActive)",
        align: "center",
        className: "w-[90px]",
        render: (r) => (
          <StatusBadge tone={r.isActive === 1 ? "success" : "neutral"}>
            {r.isActive === 1 ? "Active" : "Inactive"}
          </StatusBadge>
        ),
      },
      {
        key: "actions",
        header: "History",
        title: "Open full customer history detail modal",
        sortable: false,
        align: "right",
        className: "w-[85px]",
        render: (r) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onViewCustomer(r.customerCode);
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </Button>
        ),
      },
    ],
    [onViewCustomer]
  );

  const searchPredicate = React.useCallback(
    (row: CustomerHistoryRow, q: string) =>
      row.customerCode.toLowerCase().includes(q) ||
      row.customerName.toLowerCase().includes(q) ||
      row.storeName.toLowerCase().includes(q) ||
      row.salesmanName.toLowerCase().includes(q) ||
      row.classificationName.toLowerCase().includes(q),
    []
  );

  return (
    <DataTableLite<CustomerHistoryRow, CustomerTableColumnKey>
      rows={rows}
      columns={columns}
      rowKey={(r) => r.customerCode}
      isLoading={isLoading}
      emptyTitle="No Industrial Customer Activity Found"
      emptyDescription="Only customers with industrial activity (division 1, parent serialized products) inside the applied date range are listed."
      searchPlaceholder="Search by code, customer, store, classification, or salesman..."
      searchPredicate={searchPredicate}
      defaultPageSize={10}
      onRowClick={(r) => onViewCustomer(r.customerCode)}
      onFilteredRowsChange={onFilteredRowsChange}
      onPagedRowsChange={onPagedRowsChange}
    />
  );
}
