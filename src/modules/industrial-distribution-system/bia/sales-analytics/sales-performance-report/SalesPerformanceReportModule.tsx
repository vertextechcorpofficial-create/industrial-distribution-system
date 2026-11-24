// src/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/SalesPerformanceReportModule.tsx
// ==============================================================================
// Root Component for Sales Performance Report Module
// Connects Header, Filters, KPI Cards, Visual Charts, Results Table, Slide-out Drawer,
// and ARF TracingReportPreviewModal for printable report review.
// ==============================================================================

"use client";

import * as React from "react";
import { SalesPerformanceProvider, useSalesPerformance } from "./providers/SalesPerformanceProvider";
import { SalesPerformanceHeader } from "./components/SalesPerformanceHeader";
import { SalesPerformanceFilters } from "./components/SalesPerformanceFilters";
import { SalesPerformanceKPICards } from "./components/SalesPerformanceKPICards";
import { SalesPerformanceCharts } from "./components/SalesPerformanceCharts";
import { SalesPerformanceTable } from "./components/SalesPerformanceTable";
import { SalesPerformanceDrawer } from "./components/SalesPerformanceDrawer";
import { SalesPerformanceSkeleton } from "./components/SalesPerformanceSkeleton";
import { TracingReportPreviewModal } from "@/modules/industrial-distribution-system/audit-results-findings/traceability-compliance/components/TracingReportPreviewModal";
import { generateSalesPerformancePrintHtml } from "./utils/generateSalesPerformancePrintHtml";

function SalesPerformanceContent() {
  const {
    report,
    filters,
    lookups,
    isLoading,
    isLoadingLookups,
    isPrintModalOpen,
    setIsPrintModalOpen,
  } = useSalesPerformance();

  const selectedBranchName = React.useMemo(() => {
    if (!filters.branchId || filters.branchId === "ALL") return "All Authorized Branches";
    const found = lookups?.branches.find((b) => String(b.value) === String(filters.branchId));
    return found ? found.label : "Selected Branch";
  }, [filters.branchId, lookups]);

  const printHtml = React.useMemo(() => {
    if (!report) return "";
    return generateSalesPerformancePrintHtml(report, filters, selectedBranchName);
  }, [report, filters, selectedBranchName]);

  // Initial mount state: when initial report or lookup data is first loading
  if ((isLoading && !report) || (isLoadingLookups && !lookups)) {
    return <SalesPerformanceSkeleton />;
  }

  return (
    <div className="relative w-full min-w-0 space-y-4 animate-in fade-in duration-300">
      {/* Sleek Top-of-Module Progress Pulse Bar during filter changes / background re-queries */}
      {isLoading && (
        <div className="sticky top-0 z-30 w-full h-1 overflow-hidden rounded-full bg-emerald-500/20">
          <div className="h-full w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 animate-[pulse_1.2s_ease-in-out_infinite]" />
        </div>
      )}

      {/* 1. Header with Export and Print Triggers */}
      <SalesPerformanceHeader onOpenPrintPreview={() => setIsPrintModalOpen(true)} />

      {/* 2. Interactive Filter Bar with SearchableSelect */}
      <SalesPerformanceFilters />

      {/* Content wrapper with smooth opacity transition during filter change re-fetching */}
      <div
        className={`space-y-4 transition-opacity duration-200 ${
          isLoading ? "opacity-60 pointer-events-none" : "opacity-100"
        }`}
      >
        {/* 3. High-Contrast KPI Cards */}
        <SalesPerformanceKPICards />

        {/* 4. Colorful Visual Analytics Charts (Recharts) */}
        <SalesPerformanceCharts />

        {/* 5. Paginated Results Table */}
        <SalesPerformanceTable />
      </div>

      {/* 6. Drill-down Slide-out Drawer */}
      <SalesPerformanceDrawer />

      {/* 7. Print / PDF Preview Modal */}
      <TracingReportPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        html={printHtml}
        title="Sales Performance Report"
        subtitle={selectedBranchName}
      />
    </div>
  );
}

export function SalesPerformanceReportModule() {
  return (
    <SalesPerformanceProvider>
      <SalesPerformanceContent />
    </SalesPerformanceProvider>
  );
}

export default SalesPerformanceReportModule;
