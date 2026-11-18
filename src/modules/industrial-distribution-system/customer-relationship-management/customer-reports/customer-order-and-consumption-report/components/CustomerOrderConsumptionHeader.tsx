// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/components/CustomerOrderConsumptionHeader.tsx
// ============================================================
// Streamlined executive header for the Customer Order & Consumption Report.
// Action buttons (Refresh, Excel, PDF, Print) live inside the unified
// Filter & Scoping panel so all query and export controls stay grouped.
// ============================================================

"use client";

import * as React from "react";
import { CalendarRange, Clock, Loader2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCustomerOrderConsumptionReport } from "../hooks/useCustomerOrderConsumptionReport";

/** Formats an ISO date string (YYYY-MM-DD) into a concise human-readable label (e.g. Jan 01, 2026). */
function formatShortDateLabel(isoDate: string): string {
  const parts = isoDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return isoDate;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

/** Formats an ISO timestamp into a concise local time label (e.g. 9:24 AM). */
function formatGeneratedTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CustomerOrderConsumptionHeader(): React.ReactElement {
  const { report, appliedFilters, isLoading } = useCustomerOrderConsumptionReport();

  const windowLabel = React.useMemo(() => {
    const start = report?.filters.startDate ?? appliedFilters?.startDate;
    const end = report?.filters.endDate ?? appliedFilters?.endDate;
    if (!start || !end) return null;
    return `${formatShortDateLabel(start)} – ${formatShortDateLabel(end)}`;
  }, [report?.filters.startDate, report?.filters.endDate, appliedFilters?.startDate, appliedFilters?.endDate]);

  const updatedLabel = React.useMemo(() => {
    if (!report?.generatedAt) return null;
    return formatGeneratedTime(report.generatedAt);
  }, [report?.generatedAt]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b pb-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">
            Customer Order &amp; Consumption Report
          </h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Analyze industrial serialized cylinder and LPG consumption by customer and branch. Drill into supporting records or export audit files.
        </p>
      </div>

      {/* Live Reporting Window & Sync Metadata Pill */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        {windowLabel && (
          <div className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 font-medium text-foreground/80">
            <CalendarRange className="size-3.5 text-primary/80" />
            <span className="tabular-nums">{windowLabel}</span>
          </div>
        )}

        {isLoading ? (
          <div className="inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/5 px-2.5 py-1 font-medium text-primary">
            <Loader2 className="size-3 animate-spin" />
            <span>Syncing...</span>
          </div>
        ) : updatedLabel ? (
          <div className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1">
            <Clock className="size-3 text-muted-foreground" />
            <span className="tabular-nums">Updated {updatedLabel}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
