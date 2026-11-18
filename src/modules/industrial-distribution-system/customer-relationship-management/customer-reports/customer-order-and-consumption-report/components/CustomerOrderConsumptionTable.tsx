// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/components/CustomerOrderConsumptionTable.tsx
// ============================================================
// Main Report Grid: Customer as the Primary Grouping.
// Expanding a customer row displays its nested Product Breakdown table.
// Clicking a product or "View Documents" triggers the supporting documents drawer.
// Rule Enforcement:
// - Product display uses products.description
// - React hook order safety (no hooks after early returns)
// ============================================================

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCustomerOrderConsumptionReport } from "../hooks/useCustomerOrderConsumptionReport";
import {
  formatAmount,
  formatKgCompact,
  formatQty,
} from "../services/customer-order-consumption.helpers";
import type {
  CustomerOrderConsumptionRow,

} from "../types/customer-order-consumption.types";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const EMPTY_ROWS: CustomerOrderConsumptionRow[] = [];

type SortKey =
  | "customer"
  | "branch"
  | "orders"
  | "fulfilledQty"
  | "returnedQty"
  | "netKg"
  | "avgKg"
  | "amount";

function sortRows(
  rows: CustomerOrderConsumptionRow[],
  key: SortKey,
  asc: boolean
): CustomerOrderConsumptionRow[] {
  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (key === "customer") cmp = a.customerName.localeCompare(b.customerName);
    else if (key === "branch") cmp = a.branchName.localeCompare(b.branchName);
    else if (key === "orders") cmp = a.orderFrequency - b.orderFrequency;
    else if (key === "fulfilledQty") cmp = a.fulfilledQty - b.fulfilledQty;
    else if (key === "returnedQty") cmp = a.returnedQty - b.returnedQty;
    else if (key === "netKg") cmp = a.netKg - b.netKg;
    else if (key === "avgKg") cmp = a.avgOrderSizeKg - b.avgOrderSizeKg;
    else if (key === "amount") cmp = a.netAmount - b.netAmount;
    return asc ? cmp : -cmp;
  });
}

function matchesSearch(row: CustomerOrderConsumptionRow, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const directMatch =
    row.customerName.toLowerCase().includes(q) ||
    row.customerCode.toLowerCase().includes(q) ||
    row.storeName.toLowerCase().includes(q) ||
    row.branchName.toLowerCase().includes(q);

  if (directMatch) return true;

  // Search inside nested products
  return row.products.some(
    (p) =>
      p.productName.toLowerCase().includes(q) ||
      p.productCode.toLowerCase().includes(q) ||
      (p.gasType && p.gasType.toLowerCase().includes(q))
  );
}

export function CustomerOrderConsumptionTable(): React.ReactElement {
  const { report, openDrillDown } = useCustomerOrderConsumptionReport();

  const [expandedCustomers, setExpandedCustomers] = React.useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = React.useState<SortKey>("netKg");
  const [sortAsc, setSortAsc] = React.useState<boolean>(false);
  const [page, setPage] = React.useState<number>(0);
  const [pageSize, setPageSize] = React.useState<number>(25);

  const toggleExpand = React.useCallback((customerKey: string) => {
    setExpandedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(customerKey)) next.delete(customerKey);
      else next.add(customerKey);
      return next;
    });
  }, []);

  const handleSort = React.useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortAsc((prev) => !prev);
      } else {
        setSortKey(key);
        setSortAsc(false);
      }
    },
    [sortKey]
  );

  const rawRows = report?.rows ?? EMPTY_ROWS;
  const searchQuery = report?.filters?.search ?? "";

  // Filter & Sort rows unconditionally before render
  const filteredRows = React.useMemo(() => {
    return rawRows.filter((r) => matchesSearch(r, searchQuery));
  }, [rawRows, searchQuery]);

  const sortedRows = React.useMemo(() => {
    return sortRows(filteredRows, sortKey, sortAsc);
  }, [filteredRows, sortKey, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const paginatedRows = React.useMemo(() => {
    const start = safePage * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, safePage, pageSize]);

  return (
    <Card className="shadow-none border bg-card py-0">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-9 px-2 text-center" />
                <TableHead
                  onClick={() => handleSort("customer")}
                  className="cursor-pointer select-none text-xs font-semibold"
                >
                  <div className="flex items-center gap-1">
                    Customer Details
                    <ArrowUpDown className="size-3 text-muted-foreground" />
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => handleSort("branch")}
                  className="cursor-pointer select-none text-xs font-semibold"
                >
                  <div className="flex items-center gap-1">
                    Branch
                    <ArrowUpDown className="size-3 text-muted-foreground" />
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => handleSort("orders")}
                  className="cursor-pointer select-none text-xs font-semibold text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    Orders
                    <ArrowUpDown className="size-3 text-muted-foreground" />
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => handleSort("fulfilledQty")}
                  className="cursor-pointer select-none text-xs font-semibold text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    Fulfilled (pcs)
                    <ArrowUpDown className="size-3 text-muted-foreground" />
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => handleSort("returnedQty")}
                  className="cursor-pointer select-none text-xs font-semibold text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    Returned (pcs)
                    <ArrowUpDown className="size-3 text-muted-foreground" />
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => handleSort("netKg")}
                  className="cursor-pointer select-none text-xs font-semibold text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    Net Purchased Kg
                    <ArrowUpDown className="size-3 text-muted-foreground" />
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => handleSort("avgKg")}
                  className="cursor-pointer select-none text-xs font-semibold text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    Avg Order (kg)
                    <ArrowUpDown className="size-3 text-muted-foreground" />
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => handleSort("amount")}
                  className="cursor-pointer select-none text-xs font-semibold text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    Net Revenue
                    <ArrowUpDown className="size-3 text-muted-foreground" />
                  </div>
                </TableHead>
                <TableHead className="w-24 text-center text-xs font-semibold">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-xs text-muted-foreground">
                    No customers match the active filters or search terms.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((customer) => {
                  const isExpanded = expandedCustomers.has(customer.rowKey);
                  return (
                    <React.Fragment key={customer.rowKey}>
                      {/* Customer Parent Row */}
                      <TableRow
                        className={`hover:bg-muted/30 cursor-pointer transition-colors ${
                          isExpanded ? "bg-muted/20 font-medium" : ""
                        }`}
                        onClick={() => toggleExpand(customer.rowKey)}
                      >
                        <TableCell className="px-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-6 p-0 text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(customer.rowKey);
                            }}
                          >
                            <ChevronDown
                              className={`size-3.5 transition-transform duration-200 ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </Button>
                        </TableCell>

                        <TableCell className="max-w-[260px]">
                          <div className="space-y-0.5">
                            <div className="font-semibold text-xs truncate text-foreground">
                              {customer.customerName}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
                              <span>{customer.customerCode}</span>
                              {customer.storeName ? (
                                <>
                                  <span>·</span>
                                  <span>{customer.storeName}</span>
                                </>
                              ) : null}
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                {customer.classificationName}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {customer.branchName}
                        </TableCell>

                        <TableCell className="text-right text-xs tabular-nums font-semibold">
                          {formatQty(customer.orderFrequency)}
                        </TableCell>

                        <TableCell className="text-right text-xs tabular-nums">
                          {formatQty(customer.fulfilledQty)}
                        </TableCell>

                        <TableCell className="text-right text-xs tabular-nums">
                          {customer.returnedQty > 0 ? (
                            <span className="text-rose-600 font-medium">
                              {formatQty(customer.returnedQty)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>

                        <TableCell className="text-right text-xs tabular-nums font-bold text-foreground">
                          {formatKgCompact(customer.netKg)}
                        </TableCell>

                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {formatKgCompact(customer.avgOrderSizeKg)}
                        </TableCell>

                        <TableCell className="text-right text-xs tabular-nums font-medium">
                          {formatAmount(customer.netAmount)}
                        </TableCell>

                        <TableCell className="text-center px-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2 gap-1 text-primary hover:text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDrillDown({
                                customerCode: customer.customerCode,
                                customerName: customer.customerName,
                              });
                            }}
                          >
                            <ExternalLink className="size-3" />
                            Drill Down
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Nested Products Breakdown Row with smooth motion animation */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <TableRow className="bg-muted/10 hover:bg-muted/10 border-b border-border/50">
                            <TableCell colSpan={10} className="p-0 overflow-hidden">
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                                className="p-3 pl-10"
                              >
                                <div className="rounded-md border bg-background p-3 shadow-xs space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                      <Layers className="size-3.5 text-primary" />
                                      Product Movement Breakdown for {customer.customerName}
                                    </div>
                                    <span className="text-[11px] text-muted-foreground">
                                      {customer.products.length} product line(s) purchased
                                    </span>
                                  </div>

                                  <Table>
                                    <TableHeader className="bg-muted/30">
                                      <TableRow className="h-7">
                                        <TableHead className="text-[11px] font-semibold py-1">
                                          Product Name (Description)
                                        </TableHead>
                                        <TableHead className="text-[11px] font-semibold py-1">
                                          Code
                                        </TableHead>
                                        <TableHead className="text-[11px] font-semibold py-1">
                                          Cylinder Size
                                        </TableHead>
                                        <TableHead className="text-[11px] font-semibold py-1">
                                          Gas Type
                                        </TableHead>
                                        <TableHead className="text-[11px] font-semibold text-right py-1">
                                          Orders
                                        </TableHead>
                                        <TableHead className="text-[11px] font-semibold text-right py-1">
                                          Fulfilled (pcs)
                                        </TableHead>
                                        <TableHead className="text-[11px] font-semibold text-right py-1">
                                          Returned (pcs)
                                        </TableHead>
                                        <TableHead className="text-[11px] font-semibold text-right py-1">
                                          Net Purchased Kg
                                        </TableHead>
                                        <TableHead className="text-[11px] font-semibold text-right py-1">
                                          Avg Order (kg)
                                        </TableHead>
                                        <TableHead className="text-[11px] font-semibold text-center py-1">
                                          Supporting Records
                                        </TableHead>
                                      </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                      {customer.products.map((p, pIndex) => (
                                        <motion.tr
                                          key={p.productId}
                                          initial={{ opacity: 0, x: -4 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ duration: 0.16, delay: pIndex * 0.02, ease: "easeOut" }}
                                          className="h-8 hover:bg-muted/40 cursor-pointer border-b border-border/40 transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openDrillDown({
                                              customerCode: customer.customerCode,
                                              customerName: customer.customerName,
                                              productId: p.productId,
                                              productName: p.productName,
                                            });
                                          }}
                                        >
                                          <TableCell className="text-xs font-medium py-1.5 max-w-[200px] truncate">
                                            {/* Shows products.description as product name per ids-guide */}
                                            {p.productName}
                                          </TableCell>
                                          <TableCell className="text-[11px] text-muted-foreground py-1.5">
                                            {p.productCode}
                                          </TableCell>
                                          <TableCell className="text-xs py-1.5">
                                            {p.cylinderSizeKg ? (
                                              <Badge variant="secondary" className="text-[10px] font-mono">
                                                {p.cylinderSizeKg} kg
                                              </Badge>
                                            ) : (
                                              <span className="text-muted-foreground text-[11px]">—</span>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-xs text-muted-foreground py-1.5">
                                            {p.gasType}
                                          </TableCell>
                                          <TableCell className="text-right text-xs tabular-nums py-1.5 font-medium">
                                            {p.orderFrequency}
                                          </TableCell>
                                          <TableCell className="text-right text-xs tabular-nums py-1.5">
                                            {formatQty(p.fulfilledQty)}
                                          </TableCell>
                                          <TableCell className="text-right text-xs tabular-nums py-1.5">
                                            {p.returnedQty > 0 ? (
                                              <span className="text-rose-600 font-medium">
                                                {formatQty(p.returnedQty)}
                                              </span>
                                            ) : (
                                              "—"
                                            )}
                                          </TableCell>
                                          <TableCell className="text-right text-xs tabular-nums font-bold py-1.5">
                                            {formatKgCompact(p.netKg)}
                                          </TableCell>
                                          <TableCell className="text-right text-xs tabular-nums text-muted-foreground py-1.5">
                                            {formatKgCompact(p.avgOrderSizeKg)}
                                          </TableCell>
                                          <TableCell className="text-center py-1.5">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 text-[11px] px-2 text-primary hover:text-primary gap-1"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openDrillDown({
                                                  customerCode: customer.customerCode,
                                                  customerName: customer.customerName,
                                                  productId: p.productId,
                                                  productName: p.productName,
                                                });
                                              }}
                                            >
                                              View Documents
                                            </Button>
                                          </TableCell>
                                        </motion.tr>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </motion.div>
                            </TableCell>
                          </TableRow>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-t bg-muted/10">
          <p className="text-xs text-muted-foreground">
            Showing {paginatedRows.length} of {sortedRows.length} customers · Click a row to expand products
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Rows per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-7 w-16 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="h-7 px-2 text-xs"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="text-xs px-2 text-muted-foreground">
                Page {safePage + 1} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={safePage >= pageCount - 1}
                className="h-7 px-2 text-xs"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
