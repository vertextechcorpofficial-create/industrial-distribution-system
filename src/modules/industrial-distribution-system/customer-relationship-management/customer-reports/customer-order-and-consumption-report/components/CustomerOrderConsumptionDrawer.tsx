// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/components/CustomerOrderConsumptionDrawer.tsx
// ============================================================
// Slide-over Drawer for Supporting Documents Drill-down.
// Features:
// - Wide audit layout (up to 1280px) so Status and reconciliation
//   columns never clip
// - Instant search across Order #, Invoice #, Return #, LPG Txn #,
//   Meter/WIWO #, Product Name, Serials, and Status
// - Grouped Transaction Chains (Sales Order -> LPG Metered/WIWO ->
//   Sales Invoices -> Sales Returns) + Flat Register view
// - Full pagination with page-size selector for both views
// - Smooth Framer Motion transitions & unconditional hook ordering
// ============================================================
"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  Flame,
  Gauge,
  GitBranch,
  List,
  Receipt,
  Scale,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useCustomerOrderConsumptionReport } from "../hooks/useCustomerOrderConsumptionReport";
import {
  formatAmount,
  formatKgCompact,
  formatQty,
} from "../services/customer-order-consumption.helpers";
import type { SupportingDocument } from "../types/customer-order-consumption.types";

type DrawerViewMode = "GROUPED" | "FLAT";
type ChainFilterTab = "ALL" | "HAS_LPG" | "HAS_RETURNS" | "UNINVOICED";
type FlatFilterTab = "ALL" | "ORDERS" | "INVOICES" | "RETURNS" | "LPG";

const DRAWER_PAGE_SIZES = [10, 20, 50];

// Stable module-level empty fallback so useMemo/useEffect never loop when detail is loading
const EMPTY_DOCS: SupportingDocument[] = [];

interface TransactionChain {
  chainKey: string;
  chainKind: "ORDER" | "DIRECT_INVOICE" | "STANDALONE_RETURN" | "LPG_METERED" | "LPG_WIWO";
  title: string;
  latestDate: string;
  branchName: string;
  primaryStatus: string;
  orders: SupportingDocument[];
  invoices: SupportingDocument[];
  returns: SupportingDocument[];
  lpgDocs: SupportingDocument[];
  orderedQty: number;
  orderedKg: number;
  fulfilledQty: number;
  fulfilledKg: number;
  returnedQty: number;
  returnedKg: number;
  lpgMeteredKg: number;
  lpgWiwoKg: number;
  netKg: number;
  netAmount: number;
  searchBlob: string;
}

/**
 * Groups related supporting documents into cohesive transaction lifecycle chains:
 * Sales Order -> LPG Metered / WIWO -> Sales Invoice(s) -> Sales Return(s).
 */
function buildTransactionChains(docs: SupportingDocument[]): TransactionChain[] {
  const map = new Map<string, TransactionChain>();

  for (const doc of docs) {
    let chainKey: string;
    let chainKind: TransactionChain["chainKind"];
    let title: string;

    if (doc.orderNo) {
      chainKey = `ORDER:${doc.orderNo}`;
      chainKind = "ORDER";
      title = doc.orderNo;
    } else if (doc.invoiceNo) {
      chainKey = `INVOICE:${doc.invoiceNo}`;
      chainKind = "DIRECT_INVOICE";
      title = doc.invoiceNo;
    } else if (doc.documentType === "SALES_RETURN") {
      chainKey = `RETURN:${doc.documentNo}`;
      chainKind = "STANDALONE_RETURN";
      title = doc.documentNo;
    } else {
      const isMetered =
        doc.lpgDetails?.billableSource === "METERED" || doc.documentType === "METER_READING";
      chainKey = `LPG:${doc.documentNo}`;
      chainKind = isMetered ? "LPG_METERED" : "LPG_WIWO";
      title = doc.documentNo;
    }

    let chain = map.get(chainKey);
    if (!chain) {
      chain = {
        chainKey,
        chainKind,
        title,
        latestDate: doc.date || "",
        branchName: doc.branchName || "Main",
        primaryStatus: doc.status || "POSTED",
        orders: [],
        invoices: [],
        returns: [],
        lpgDocs: [],
        orderedQty: 0,
        orderedKg: 0,
        fulfilledQty: 0,
        fulfilledKg: 0,
        returnedQty: 0,
        returnedKg: 0,
        lpgMeteredKg: 0,
        lpgWiwoKg: 0,
        netKg: 0,
        netAmount: 0,
        searchBlob: `${title} ${doc.branchName || ""}`,
      };
      map.set(chainKey, chain);
    }

    if (doc.date && (!chain.latestDate || doc.date > chain.latestDate)) {
      chain.latestDate = doc.date;
    }
    if (doc.branchName && chain.branchName === "Main") {
      chain.branchName = doc.branchName;
    }

    // Append document terms to searchable blob for fast client filtering
    chain.searchBlob += ` ${doc.documentNo} ${doc.reference} ${doc.productName} ${doc.productCode} ${doc.status} ${doc.branchName} ${doc.serialNumbers.join(" ")} ${doc.lpgDetails?.meterReadingNo ?? ""} ${doc.lpgDetails?.wiwoNo ?? ""} ${doc.lpgDetails?.siteName ?? ""}`;

    if (doc.documentType === "SALES_ORDER") {
      chain.orders.push(doc);
      chain.orderedQty += doc.quantity;
      chain.orderedKg += doc.kg;
      chain.primaryStatus = doc.status || chain.primaryStatus;
    } else if (doc.documentType === "SALES_INVOICE") {
      chain.invoices.push(doc);
      chain.fulfilledQty += doc.quantity;
      chain.fulfilledKg += doc.kg;
      chain.netAmount += doc.amount;
    } else if (doc.documentType === "SALES_RETURN") {
      chain.returns.push(doc);
      chain.returnedQty += doc.quantity;
      chain.returnedKg += doc.kg;
      chain.netAmount -= doc.amount;
    } else {
      chain.lpgDocs.push(doc);
      chain.fulfilledKg += doc.kg;
      chain.netAmount += doc.amount;
      const isMetered =
        doc.lpgDetails?.billableSource === "METERED" || doc.documentType === "METER_READING";
      if (isMetered) {
        chain.lpgMeteredKg += doc.kg;
      } else {
        chain.lpgWiwoKg += doc.kg;
      }
    }
  }

  for (const chain of map.values()) {
    chain.netKg = Math.max(0, chain.fulfilledKg - chain.returnedKg);
    chain.searchBlob = chain.searchBlob.toLowerCase();
    // If an order has no invoice yet, keep its ordered amount visible as reference
    if (chain.invoices.length === 0 && chain.lpgDocs.length === 0 && chain.orders.length > 0) {
      chain.netAmount = chain.orders.reduce((sum, o) => sum + o.amount, 0);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.latestDate.localeCompare(a.latestDate));
}

function docMatchesQuery(doc: SupportingDocument, q: string): boolean {
  if (!q) return true;
  return (
    doc.documentNo.toLowerCase().includes(q) ||
    doc.reference.toLowerCase().includes(q) ||
    doc.productName.toLowerCase().includes(q) ||
    doc.productCode.toLowerCase().includes(q) ||
    doc.status.toLowerCase().includes(q) ||
    doc.branchName.toLowerCase().includes(q) ||
    doc.serialNumbers.some((s) => s.toLowerCase().includes(q)) ||
    Boolean(doc.lpgDetails?.meterReadingNo?.toLowerCase().includes(q)) ||
    Boolean(doc.lpgDetails?.wiwoNo?.toLowerCase().includes(q)) ||
    Boolean(doc.lpgDetails?.siteName?.toLowerCase().includes(q))
  );
}

function formatShortDate(value: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const norm = (status || "").trim().toUpperCase();
  if (norm === "POSTED" || norm === "COMPLETED" || norm === "DELIVERED" || norm === "FULFILLED") {
    return (
      <Badge
        variant="outline"
        className="text-[10px] px-2 py-0.5 uppercase whitespace-nowrap bg-emerald-50/70 text-emerald-700 border-emerald-200"
      >
        {norm}
      </Badge>
    );
  }
  if (norm.includes("CANCEL") || norm.includes("NOT DELIV") || norm.includes("NOT FULF") || norm === "VOIDED") {
    return (
      <Badge
        variant="outline"
        className="text-[10px] px-2 py-0.5 uppercase whitespace-nowrap bg-rose-50/70 text-rose-700 border-rose-200"
      >
        {norm}
      </Badge>
    );
  }
  if (norm === "DRAFT" || norm.includes("EN ROUTE") || norm.includes("PREPAR") || norm.includes("PICK") || norm.includes("CONSOLID")) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] px-2 py-0.5 uppercase whitespace-nowrap bg-amber-50/70 text-amber-700 border-amber-200"
      >
        {norm}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] px-2 py-0.5 uppercase whitespace-nowrap">
      {norm || "—"}
    </Badge>
  );
}

function DocBadge({ type }: { type: SupportingDocument["documentType"] }) {
  if (type === "SALES_ORDER") {
    return (
      <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap">
        Order
      </Badge>
    );
  }
  if (type === "SALES_INVOICE") {
    return (
      <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap">
        Invoice
      </Badge>
    );
  }
  if (type === "SALES_RETURN") {
    return (
      <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-rose-50 text-rose-700 border-rose-200 whitespace-nowrap">
        Return
      </Badge>
    );
  }
  if (type === "LPG_WIWO") {
    return (
      <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 border-amber-200 whitespace-nowrap">
        WIWO (Kg)
      </Badge>
    );
  }
  if (type === "METER_READING") {
    return (
      <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 border-purple-200 whitespace-nowrap">
        Metered
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-[10px] whitespace-nowrap">{type}</Badge>;
}

function ChainKindBadge({ kind }: { kind: TransactionChain["chainKind"] }) {
  if (kind === "ORDER") {
    return (
      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 gap-1 shrink-0">
        <ClipboardList className="size-2.5" />
        Order Chain
      </Badge>
    );
  }
  if (kind === "DIRECT_INVOICE") {
    return (
      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 shrink-0">
        <FileCheck2 className="size-2.5" />
        Direct Invoice
      </Badge>
    );
  }
  if (kind === "STANDALONE_RETURN") {
    return (
      <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 gap-1 shrink-0">
        <ArrowDownLeft className="size-2.5" />
        Return Only
      </Badge>
    );
  }
  if (kind === "LPG_METERED") {
    return (
      <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 gap-1 shrink-0">
        <Gauge className="size-2.5" />
        LPG Metered
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 gap-1 shrink-0">
      <Scale className="size-2.5" />
      LPG WIWO (Kg)
    </Badge>
  );
}

/**
 * Renders structured Metered vs WIWO (Kg) LPG reconciliation cards inside a chain.
 */
function LpgReconciliationStage({ docs }: { docs: SupportingDocument[] }) {
  if (docs.length === 0) return null;

  return (
    <div className="relative pl-5 pb-3 last:pb-0">
      <span className="absolute left-[5px] top-1.5 size-2.5 rounded-full ring-2 ring-background bg-amber-500" />
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 flex items-center gap-1.5">
          <Flame className="size-3" />
          LPG Metered &amp; WIWO (Kg) Consumption ({docs.length})
        </div>

        <div className="space-y-2">
          {docs.map((doc) => {
            const det = doc.lpgDetails;
            const isMetered =
              det?.billableSource === "METERED" || doc.documentType === "METER_READING";
            const hasMeterData =
              Boolean(det?.meterReadingNo) || (det?.meteredKg != null && det.meteredKg > 0);
            const hasWiwoData =
              Boolean(det?.wiwoNo) || (det?.wiwoKg != null && det.wiwoKg > 0);
            const hasVariance = det?.varianceKg != null && det.varianceKg > 0;
            const periodLabel =
              det?.billingPeriodFrom && det?.billingPeriodTo
                ? `${formatShortDate(det.billingPeriodFrom)} – ${formatShortDate(det.billingPeriodTo)}`
                : null;

            return (
              <div
                key={doc.id}
                className="rounded-md border bg-background p-3 space-y-2.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] gap-1 ${
                        isMetered
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {isMetered ? <Gauge className="size-2.5" /> : <Scale className="size-2.5" />}
                      {isMetered ? "Billed via Metered" : "Billed via WIWO (Kg)"}
                    </Badge>
                    <span className="font-mono font-bold text-foreground">
                      {doc.documentNo}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      · {formatShortDate(doc.date)}
                    </span>
                    {det?.siteName ? (
                      <span className="text-[11px] text-muted-foreground">
                        · {det.siteName}
                      </span>
                    ) : null}
                  </div>
                  <StatusBadge status={doc.status} />
                </div>

                {(periodLabel || doc.orderNo || doc.invoiceNo) ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    {periodLabel ? <span>Period: {periodLabel}</span> : null}
                    {doc.orderNo ? (
                      <span className="font-mono">Order: {doc.orderNo}</span>
                    ) : null}
                    {doc.invoiceNo ? (
                      <span className="font-mono">Invoice: {doc.invoiceNo}</span>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div
                    className={`rounded border p-2.5 ${
                      isMetered
                        ? "border-purple-300 bg-purple-50/40"
                        : "border-border bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-semibold text-purple-700">
                      <span>Metered Reading</span>
                      {isMetered ? (
                        <span className="text-[9px] uppercase tracking-wider">Primary</span>
                      ) : null}
                    </div>
                    {hasMeterData ? (
                      <div className="mt-1 space-y-0.5">
                        <div className="font-bold tabular-nums text-foreground">
                          {formatKgCompact(det?.meteredKg ?? doc.kg)}
                        </div>
                        {det?.meterReadingNo ? (
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {det.meterReadingNo}
                          </div>
                        ) : null}
                        {det?.previousReading != null && det?.currentReading != null ? (
                          <div className="text-[10px] text-muted-foreground tabular-nums">
                            {det.previousReading.toLocaleString()} →{" "}
                            {det.currentReading.toLocaleString()}{" "}
                            {det.meterUnit || "KG"}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-1 text-[11px] text-muted-foreground">—</div>
                    )}
                  </div>

                  <div
                    className={`rounded border p-2.5 ${
                      !isMetered
                        ? "border-amber-300 bg-amber-50/40"
                        : "border-border bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-semibold text-amber-700">
                      <span>WIWO (Kg)</span>
                      {!isMetered ? (
                        <span className="text-[9px] uppercase tracking-wider">Primary</span>
                      ) : null}
                    </div>
                    {hasWiwoData ? (
                      <div className="mt-1 space-y-0.5">
                        <div className="font-bold tabular-nums text-foreground">
                          {formatKgCompact(det?.wiwoKg ?? doc.kg)}
                        </div>
                        {det?.wiwoNo ? (
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {det.wiwoNo}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-1 text-[11px] text-muted-foreground">—</div>
                    )}
                  </div>

                  <div className="rounded border border-border bg-muted/20 p-2.5">
                    <div className="text-[10px] font-semibold text-muted-foreground">
                      Billable &amp; Amount
                    </div>
                    <div className="mt-1 space-y-0.5">
                      <div className="font-bold tabular-nums text-foreground">
                        {formatKgCompact(det?.billableKg ?? doc.kg)}
                      </div>
                      <div className="text-[11px] tabular-nums text-foreground font-medium">
                        {formatAmount(doc.amount)}
                      </div>
                      {hasVariance ? (
                        <div className="text-[10px] text-amber-700 font-medium tabular-nums">
                          Variance: {formatKgCompact(det?.varianceKg ?? 0)}
                          {det?.varianceReason && det.varianceReason !== "NONE"
                            ? ` (${det.varianceReason.replace(/_/g, " ")})`
                            : ""}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders one stage section (Sales Orders, Sales Invoices, Sales Returns)
 * inside a grouped transaction chain card.
 */
function ChainStageSection({
  title,
  accentClass,
  dotClass,
  docs,
  isReturn = false,
}: {
  title: string;
  accentClass: string;
  dotClass: string;
  docs: SupportingDocument[];
  isReturn?: boolean;
}) {
  if (docs.length === 0) return null;

  return (
    <div className="relative pl-5 pb-3 last:pb-0">
      <span
        className={`absolute left-[5px] top-1.5 size-2.5 rounded-full ring-2 ring-background ${dotClass}`}
      />
      <div className="space-y-1.5">
        <div className={`text-[11px] font-semibold uppercase tracking-wide ${accentClass}`}>
          {title} ({docs.length})
        </div>
        <div className="rounded-md border bg-background overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="h-7">
                <TableHead className="text-[10px] font-semibold py-1.5 px-3">Document #</TableHead>
                <TableHead className="text-[10px] font-semibold py-1.5 px-3">Date</TableHead>
                <TableHead className="text-[10px] font-semibold py-1.5 px-3">Product</TableHead>
                <TableHead className="text-[10px] font-semibold text-right py-1.5 px-3">Qty</TableHead>
                <TableHead className="text-[10px] font-semibold text-right py-1.5 px-3">Weight</TableHead>
                <TableHead className="text-[10px] font-semibold text-right py-1.5 px-3">Amount</TableHead>
                <TableHead className="text-[10px] font-semibold text-right py-1.5 px-3">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((doc) => (
                <TableRow key={doc.id} className="h-9 hover:bg-muted/20">
                  <TableCell className="py-1.5 px-3 font-mono text-xs font-medium whitespace-nowrap">
                    {doc.documentNo}
                  </TableCell>
                  <TableCell className="py-1.5 px-3 text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatShortDate(doc.date)}
                  </TableCell>
                  <TableCell className="py-1.5 px-3 text-xs max-w-[260px]">
                    <div className="truncate font-medium">{doc.productName}</div>

                  </TableCell>
                  <TableCell
                    className={`py-1.5 px-3 text-xs text-right tabular-nums whitespace-nowrap ${
                      isReturn ? "text-rose-600 font-medium" : ""
                    }`}
                  >
                    {isReturn ? `-${formatQty(doc.quantity)}` : formatQty(doc.quantity)}
                  </TableCell>
                  <TableCell
                    className={`py-1.5 px-3 text-xs text-right tabular-nums font-semibold whitespace-nowrap ${
                      isReturn ? "text-rose-600" : ""
                    }`}
                  >
                    {isReturn ? `-${formatKgCompact(doc.kg)}` : formatKgCompact(doc.kg)}
                  </TableCell>
                  <TableCell className="py-1.5 px-3 text-xs text-right tabular-nums whitespace-nowrap">
                    {formatAmount(doc.amount)}
                  </TableCell>
                  <TableCell className="py-1.5 px-3 text-right whitespace-nowrap">
                    <StatusBadge status={doc.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

export function CustomerOrderConsumptionDrawer(): React.ReactElement {
  const {
    drillDownTarget,
    drillDownDetail,
    isDrillDownLoading,
    drillDownError,
    closeDrillDown,
  } = useCustomerOrderConsumptionReport();

  const isOpen = drillDownTarget !== null;
  const docs = drillDownDetail?.documents ?? EMPTY_DOCS;

  // All hooks unconditionally declared at top level per ids-guide
  const [viewMode, setViewMode] = React.useState<DrawerViewMode>("GROUPED");
  const [chainFilter, setChainFilter] = React.useState<ChainFilterTab>("ALL");
  const [flatTab, setFlatTab] = React.useState<FlatFilterTab>("ALL");
  const [searchTerm, setSearchTerm] = React.useState<string>("");
  const [page, setPage] = React.useState<number>(0);
  const [pageSize, setPageSize] = React.useState<number>(10);
  const [expandedChains, setExpandedChains] = React.useState<Set<string>>(new Set());

  const chains = React.useMemo(() => buildTransactionChains(docs), [docs]);

  // Reset filters & pagination when switching drill-down target
  React.useEffect(() => {
    setViewMode("GROUPED");
    setChainFilter("ALL");
    setFlatTab("ALL");
    setSearchTerm("");
    setPage(0);
  }, [drillDownTarget?.customerCode, drillDownTarget?.productId]);

  // Reset to page 0 whenever search, filter, view mode, or page size changes
  React.useEffect(() => {
    setPage(0);
  }, [viewMode, chainFilter, flatTab, searchTerm, pageSize]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const chainCounts = React.useMemo(() => {
    let hasLpg = 0;
    let hasReturns = 0;
    let uninvoiced = 0;
    for (const c of chains) {
      if (c.lpgDocs.length > 0) hasLpg += 1;
      if (c.returns.length > 0) hasReturns += 1;
      if (c.orders.length > 0 && c.invoices.length === 0 && c.lpgDocs.length === 0) uninvoiced += 1;
    }
    return { total: chains.length, hasLpg, hasReturns, uninvoiced };
  }, [chains]);

  const filteredChains = React.useMemo(() => {
    return chains.filter((c) => {
      if (chainFilter === "HAS_LPG" && c.lpgDocs.length === 0) return false;
      if (chainFilter === "HAS_RETURNS" && c.returns.length === 0) return false;
      if (
        chainFilter === "UNINVOICED" &&
        !(c.orders.length > 0 && c.invoices.length === 0 && c.lpgDocs.length === 0)
      ) {
        return false;
      }
      if (normalizedSearch && !c.searchBlob.includes(normalizedSearch)) return false;
      return true;
    });
  }, [chains, chainFilter, normalizedSearch]);

  const summaryCounts = React.useMemo(() => {
    let orderDocs = 0;
    let invoiceDocs = 0;
    let returnDocs = 0;
    let lpgDocs = 0;
    let grossKg = 0;
    let returnedKg = 0;

    for (const d of docs) {
      if (d.documentType === "SALES_ORDER") {
        orderDocs += 1;
      } else if (d.documentType === "SALES_INVOICE") {
        invoiceDocs += 1;
        grossKg += d.kg;
      } else if (d.documentType === "SALES_RETURN") {
        returnDocs += 1;
        returnedKg += d.kg;
      } else {
        lpgDocs += 1;
        grossKg += d.kg;
      }
    }

    return {
      orderDocs,
      invoiceDocs,
      returnDocs,
      lpgDocs,
      netKg: Math.max(0, grossKg - returnedKg),
    };
  }, [docs]);

  const filteredFlatDocs = React.useMemo(() => {
    return docs.filter((d) => {
      if (flatTab === "ORDERS" && d.documentType !== "SALES_ORDER") return false;
      if (flatTab === "INVOICES" && d.documentType !== "SALES_INVOICE") return false;
      if (flatTab === "RETURNS" && d.documentType !== "SALES_RETURN") return false;
      if (
        flatTab === "LPG" &&
        d.documentType !== "LPG_WIWO" &&
        d.documentType !== "METER_READING"
      ) {
        return false;
      }
      if (normalizedSearch && !docMatchesQuery(d, normalizedSearch)) return false;
      return true;
    });
  }, [docs, flatTab, normalizedSearch]);

  // Pagination slice for the active view
  const activeTotal = viewMode === "GROUPED" ? filteredChains.length : filteredFlatDocs.length;
  const pageCount = Math.max(1, Math.ceil(activeTotal / pageSize));
  const safePage = Math.min(page, pageCount - 1);

  const paginatedChains = React.useMemo(() => {
    const start = safePage * pageSize;
    return filteredChains.slice(start, start + pageSize);
  }, [filteredChains, safePage, pageSize]);

  const paginatedFlatDocs = React.useMemo(() => {
    const start = safePage * pageSize;
    return filteredFlatDocs.slice(start, start + pageSize);
  }, [filteredFlatDocs, safePage, pageSize]);

  // Primitive signature prevents redundant state updates or infinite loops
  const defaultExpandedSignature = React.useMemo(
    () => paginatedChains.slice(0, 3).map((c) => c.chainKey).join("\u001f"),
    [paginatedChains]
  );

  React.useEffect(() => {
    // Auto-expand top 3 chains on the current page so linked details are immediately visible
    if (!defaultExpandedSignature) {
      setExpandedChains((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    setExpandedChains(new Set(defaultExpandedSignature.split("\u001f")));
  }, [defaultExpandedSignature]);

  const toggleChain = React.useCallback((chainKey: string) => {
    setExpandedChains((prev) => {
      const next = new Set(prev);
      if (next.has(chainKey)) next.delete(chainKey);
      else next.add(chainKey);
      return next;
    });
  }, []);

  const expandPageChains = React.useCallback(() => {
    setExpandedChains(new Set(paginatedChains.map((c) => c.chainKey)));
  }, [paginatedChains]);

  const collapsePageChains = React.useCallback(() => {
    setExpandedChains(new Set());
  }, []);

  const allOnPageExpanded =
    paginatedChains.length > 0 &&
    paginatedChains.every((c) => expandedChains.has(c.chainKey));

  const rangeStart = activeTotal === 0 ? 0 : safePage * pageSize + 1;
  const rangeEnd = Math.min(activeTotal, (safePage + 1) * pageSize);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeDrillDown()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[96vw] sm:max-w-[94vw] lg:max-w-6xl xl:max-w-[1280px] flex flex-col p-0 gap-0 z-50 bg-background"
      >
        {/* Fixed Top Header */}
        <SheetHeader className="px-5 py-4 border-b space-y-1 shrink-0 bg-background">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <SheetTitle className="text-base font-bold flex items-center gap-2">
                <Receipt className="size-4 text-primary shrink-0" />
                Supporting Records Audit
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground truncate">
                Customer:{" "}
                <strong className="text-foreground">
                  {drillDownTarget?.customerName ?? drillDownTarget?.customerCode}
                </strong>
                {drillDownTarget?.productName ? (
                  <>
                    {" "}
                    · Product:{" "}
                    <strong className="text-foreground">{drillDownTarget.productName}</strong>
                  </>
                ) : null}
              </SheetDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={closeDrillDown}
              aria-label="Close supporting records drawer"
            >
              <X className="size-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Fixed Summary Strip + Search & View Controls */}
        {!isDrillDownLoading && !drillDownError ? (
          <div className="px-5 py-3 border-b bg-muted/15 space-y-3 shrink-0">
            {/* Quick Totals Strip */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <div className="rounded-md border bg-background px-3 py-2">
                <div className="text-[10px] text-muted-foreground">Chains</div>
                <div className="text-sm font-bold tabular-nums">{chains.length}</div>
              </div>
              <div className="rounded-md border bg-blue-50/50 border-blue-200/70 px-3 py-2">
                <div className="text-[10px] text-blue-700">Orders</div>
                <div className="text-sm font-bold tabular-nums text-blue-800">
                  {summaryCounts.orderDocs}
                </div>
              </div>
              <div className="rounded-md border bg-emerald-50/50 border-emerald-200/70 px-3 py-2">
                <div className="text-[10px] text-emerald-700">Invoices</div>
                <div className="text-sm font-bold tabular-nums text-emerald-800">
                  {summaryCounts.invoiceDocs}
                </div>
              </div>
              <div className="rounded-md border bg-rose-50/50 border-rose-200/70 px-3 py-2">
                <div className="text-[10px] text-rose-700">Returns</div>
                <div className="text-sm font-bold tabular-nums text-rose-800">
                  {summaryCounts.returnDocs}
                </div>
              </div>
              <div className="rounded-md border bg-amber-50/50 border-amber-200/70 px-3 py-2">
                <div className="text-[10px] text-amber-700">LPG Docs</div>
                <div className="text-sm font-bold tabular-nums text-amber-800">
                  {summaryCounts.lpgDocs}
                </div>
              </div>
              <div className="rounded-md border bg-background px-3 py-2">
                <div className="text-[10px] text-muted-foreground">Net Purchased</div>
                <div className="text-sm font-bold tabular-nums">
                  {formatKgCompact(summaryCounts.netKg)}
                </div>
              </div>
            </div>

            {/* Toolbar: View Switcher + Search Input + Quick Filter Pills */}
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Tabs
                  value={viewMode}
                  onValueChange={(v) => setViewMode(v as DrawerViewMode)}
                >
                  <TabsList className="h-8 p-0.5 bg-muted/70">
                    <TabsTrigger value="GROUPED" className="text-xs h-7 px-3 gap-1.5">
                      <GitBranch className="size-3.5" />
                      Related Chains ({chains.length})
                    </TabsTrigger>
                    <TabsTrigger value="FLAT" className="text-xs h-7 px-3 gap-1.5">
                      <List className="size-3.5" />
                      All Documents ({docs.length})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Instant Search Bar */}
                <div className="flex items-center gap-2 flex-1 sm:flex-initial sm:min-w-[300px] lg:min-w-[360px]">
                  <div className="relative flex-1">
                    <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search order #, invoice #, meter #, serial, status..."
                      className="h-8 pl-8 pr-7 text-xs bg-background"
                    />
                    {searchTerm ? (
                      <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label="Clear search"
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : null}
                  </div>

                  {viewMode === "GROUPED" && paginatedChains.length > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs shrink-0 bg-background"
                      onClick={allOnPageExpanded ? collapsePageChains : expandPageChains}
                    >
                      {allOnPageExpanded ? "Collapse Page" : "Expand Page"}
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Contextual Quick Filter Pills */}
              {viewMode === "GROUPED" ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: "ALL", label: `All Chains (${chainCounts.total})` },
                      { id: "HAS_LPG", label: `With Metered / WIWO (${chainCounts.hasLpg})` },
                      { id: "HAS_RETURNS", label: `With Returns (${chainCounts.hasReturns})` },
                      { id: "UNINVOICED", label: `Pending Invoice (${chainCounts.uninvoiced})` },
                    ] as const
                  ).map((pill) => (
                    <Button
                      key={pill.id}
                      type="button"
                      variant={chainFilter === pill.id ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs px-2.5"
                      onClick={() => setChainFilter(pill.id)}
                    >
                      {pill.label}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: "ALL", label: `All (${docs.length})` },
                      { id: "ORDERS", label: `Orders (${summaryCounts.orderDocs})` },
                      { id: "INVOICES", label: `Invoices (${summaryCounts.invoiceDocs})` },
                      { id: "RETURNS", label: `Returns (${summaryCounts.returnDocs})` },
                      { id: "LPG", label: `LPG Sites (${summaryCounts.lpgDocs})` },
                    ] as const
                  ).map((pill) => (
                    <Button
                      key={pill.id}
                      type="button"
                      variant={flatTab === pill.id ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs px-2.5"
                      onClick={() => setFlatTab(pill.id)}
                    >
                      {pill.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isDrillDownLoading ? (
            <div className="space-y-2.5 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : drillDownError ? (
            <div className="p-6 text-center text-xs text-destructive bg-destructive/5 rounded-md border border-destructive/20">
              {drillDownError}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {viewMode === "GROUPED" ? (
                <motion.div
                  key={`grouped-${safePage}-${chainFilter}-${normalizedSearch}`}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="space-y-2.5"
                >
                  {paginatedChains.length === 0 ? (
                    <div className="rounded-md border bg-card p-10 text-center text-xs text-muted-foreground">
                      {searchTerm
                        ? `No transaction chains match "${searchTerm}".`
                        : "No matching supporting documents in this reporting window."}
                    </div>
                  ) : (
                    paginatedChains.map((chain, idx) => {
                      const isChainOpen = expandedChains.has(chain.chainKey);
                      return (
                        <motion.div
                          key={chain.chainKey}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.18,
                            delay: Math.min(idx * 0.025, 0.2),
                            ease: "easeOut",
                          }}
                          className="rounded-lg border bg-card overflow-hidden shadow-2xs"
                        >
                          {/* Chain Header */}
                          <button
                            type="button"
                            onClick={() => toggleChain(chain.chainKey)}
                            className="w-full flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-muted/25 hover:bg-muted/40 transition-colors text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <ChevronDown
                                className={`size-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                                  isChainOpen ? "rotate-180" : ""
                                }`}
                              />
                              <ChainKindBadge kind={chain.chainKind} />
                              <span className="font-mono text-xs font-bold text-foreground truncate">
                                {chain.title}
                              </span>
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                · {formatShortDate(chain.latestDate)} · {chain.branchName}
                              </span>
                            </div>

                            {/* Lifecycle Pill Trail */}
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums">
                              {chain.orders.length > 0 ? (
                                <span className="rounded bg-blue-50 text-blue-700 border border-blue-200/70 px-2 py-0.5 font-medium">
                                  Ordered {formatQty(chain.orderedQty)} pcs
                                </span>
                              ) : null}
                              {chain.invoices.length > 0 ? (
                                <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200/70 px-2 py-0.5 font-medium">
                                  Invoiced {formatQty(chain.fulfilledQty)} pcs
                                </span>
                              ) : null}
                              {chain.returns.length > 0 ? (
                                <span className="rounded bg-rose-50 text-rose-700 border border-rose-200/70 px-2 py-0.5 font-medium">
                                  Returned -{formatQty(chain.returnedQty)} pcs
                                </span>
                              ) : null}
                              {chain.lpgMeteredKg > 0 ? (
                                <span className="rounded bg-purple-50 text-purple-700 border border-purple-200/70 px-2 py-0.5 font-medium">
                                  Metered {formatKgCompact(chain.lpgMeteredKg)}
                                </span>
                              ) : null}
                              {chain.lpgWiwoKg > 0 ? (
                                <span className="rounded bg-amber-50 text-amber-700 border border-amber-200/70 px-2 py-0.5 font-medium">
                                  WIWO {formatKgCompact(chain.lpgWiwoKg)}
                                </span>
                              ) : null}
                              <span className="font-bold text-foreground pl-1.5 min-w-[72px] text-right">
                                {formatKgCompact(chain.netKg)}
                              </span>
                            </div>
                          </button>

                          {/* Smooth Expandable Linked Document Timeline */}
                          <AnimatePresence initial={false}>
                            {isChainOpen && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                                className="overflow-hidden border-t"
                              >
                                <div className="p-4 bg-background/60">
                                  <div className="relative before:absolute before:left-[9px] before:top-3 before:bottom-3 before:w-px before:bg-border">
                                    <ChainStageSection
                                      title="1. Sales Order"
                                      accentClass="text-blue-700"
                                      dotClass="bg-blue-500"
                                      docs={chain.orders}
                                    />
                                    <LpgReconciliationStage docs={chain.lpgDocs} />
                                    <ChainStageSection
                                      title={
                                        chain.orders.length > 0
                                          ? "2. Linked Sales Invoices"
                                          : "Sales Invoices"
                                      }
                                      accentClass="text-emerald-700"
                                      dotClass="bg-emerald-500"
                                      docs={chain.invoices}
                                    />
                                    <ChainStageSection
                                      title={
                                        chain.orders.length > 0 || chain.invoices.length > 0
                                          ? "3. Linked Sales Returns"
                                          : "Sales Returns"
                                      }
                                      accentClass="text-rose-700"
                                      dotClass="bg-rose-500"
                                      docs={chain.returns}
                                      isReturn
                                    />
                                  </div>

                                  {chain.orders.length > 0 &&
                                  chain.invoices.length === 0 &&
                                  chain.lpgDocs.length === 0 ? (
                                    <div className="mt-2 ml-5 text-[11px] text-muted-foreground italic">
                                      No sales invoice recorded for this order within the selected period.
                                    </div>
                                  ) : null}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key={`flat-${safePage}-${flatTab}-${normalizedSearch}`}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="border rounded-lg overflow-hidden bg-card"
                >
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="h-9">
                          <TableHead className="text-xs font-semibold py-2 px-3">Type</TableHead>
                          <TableHead className="text-xs font-semibold py-2 px-3">Document #</TableHead>
                          <TableHead className="text-xs font-semibold py-2 px-3">Date</TableHead>
                          <TableHead className="text-xs font-semibold py-2 px-3">Product</TableHead>
                          <TableHead className="text-xs font-semibold text-right py-2 px-3">Qty</TableHead>
                          <TableHead className="text-xs font-semibold text-right py-2 px-3">Weight</TableHead>
                          <TableHead className="text-xs font-semibold text-right py-2 px-3">Amount</TableHead>
                          <TableHead className="text-xs font-semibold text-right py-2 px-3">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedFlatDocs.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={8}
                              className="py-10 text-center text-xs text-muted-foreground"
                            >
                              {searchTerm
                                ? `No documents match "${searchTerm}".`
                                : "No matching supporting documents in this window."}
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedFlatDocs.map((doc, docIdx) => (
                            <motion.tr
                              key={doc.id}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                duration: 0.14,
                                delay: Math.min(docIdx * 0.015, 0.18),
                              }}
                              className="h-10 hover:bg-muted/20 border-b border-border/40 transition-colors"
                            >
                              <TableCell className="py-2 px-3 whitespace-nowrap">
                                <DocBadge type={doc.documentType} />
                              </TableCell>
                              <TableCell className="py-2 px-3 font-mono text-xs font-medium whitespace-nowrap">
                                <div>{doc.documentNo}</div>
                                {doc.reference ? (
                                  <div className="text-[10px] font-sans text-muted-foreground truncate max-w-[200px]">
                                    Ref: {doc.reference}
                                  </div>
                                ) : null}
                              </TableCell>
                              <TableCell className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                                {formatShortDate(doc.date)}
                              </TableCell>
                              <TableCell className="py-2 px-3 text-xs max-w-[260px]">
                                <div className="truncate font-medium">{doc.productName}</div>
                                {doc.lpgDetails ? (
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {doc.lpgDetails.meterReadingNo
                                      ? `Meter: ${doc.lpgDetails.meterReadingNo}`
                                      : null}
                                    {doc.lpgDetails.meterReadingNo && doc.lpgDetails.wiwoNo
                                      ? " · "
                                      : null}
                                    {doc.lpgDetails.wiwoNo
                                      ? `WIWO: ${doc.lpgDetails.wiwoNo}`
                                      : null}
                                  </div>
                                )  : null}
                              </TableCell>
                              <TableCell className="py-2 px-3 text-xs text-right tabular-nums whitespace-nowrap">
                                {formatQty(doc.quantity)}
                              </TableCell>
                              <TableCell className="py-2 px-3 text-xs text-right tabular-nums font-semibold whitespace-nowrap">
                                {formatKgCompact(doc.kg)}
                              </TableCell>
                              <TableCell className="py-2 px-3 text-xs text-right tabular-nums whitespace-nowrap">
                                {formatAmount(doc.amount)}
                              </TableCell>
                              <TableCell className="py-2 px-3 text-right whitespace-nowrap">
                                <StatusBadge status={doc.status} />
                              </TableCell>
                            </motion.tr>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Fixed Sticky Bottom Pagination Footer */}
        {!isDrillDownLoading && !drillDownError && activeTotal > 0 ? (
          <div className="px-5 py-3 border-t bg-muted/15 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                Showing <strong className="text-foreground tabular-nums">{rangeStart}–{rangeEnd}</strong>{" "}
                of <strong className="text-foreground tabular-nums">{activeTotal}</strong>{" "}
                {viewMode === "GROUPED" ? "chain(s)" : "document(s)"}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]">Per page:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => setPageSize(Number(val))}
                >
                  <SelectTrigger className="h-7 w-[68px] text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DRAWER_PAGE_SIZES.map((sz) => (
                      <SelectItem key={sz} value={String(sz)} className="text-xs">
                        {sz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs bg-background"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="size-3.5 mr-0.5" />
                Prev
              </Button>
              <span className="text-xs text-muted-foreground px-2 tabular-nums">
                Page <strong className="text-foreground">{safePage + 1}</strong> of{" "}
                <strong className="text-foreground">{pageCount}</strong>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs bg-background"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                Next
                <ChevronRight className="size-3.5 ml-0.5" />
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
