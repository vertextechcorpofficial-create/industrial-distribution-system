"use client";

// ============================================================================
// Customer History — Main Module Shell
// Industrial-scoped (division_id = 1, active branches, parent serialized products).
// Uses framer-motion with MotionConfig reducedMotion="user" for smooth transitions.
// Printing invokes the browser's native print dialog directly (no hardcoded @page).
// ============================================================================

import * as React from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useReactToPrint } from "react-to-print";
import { BarChart3, History, Printer, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CustomerHistoryProvider,
  useCustomerHistoryContext,
} from "./providers/CustomerHistoryProvider";
import { FilterBar } from "./components/FilterBar";
import { KpiStrip } from "./components/KpiStrip";
import { CustomerTable, CUSTOMER_PRINTABLE_COLUMNS } from "./components/CustomerTable";
import { ActivityTrendChart } from "./components/ActivityTrendChart";
import { CategoryMixChart } from "./components/CategoryMixChart";
import { TopCustomersChart } from "./components/TopCustomersChart";
import { CustomerDetailModal } from "./components/CustomerDetailModal";
import { PrintSheet } from "./components/print/PrintSheet";
import type { CustomerHistoryRow, PrintConfig } from "./types/customer-history.types";

type MainTab = "customers" | "insights";

// Stable empty array reference to prevent infinite re-render loops when listData is null
const EMPTY_ROWS: CustomerHistoryRow[] = [];

// Neutral print config so the browser's native print dialog controls paper, margins, and scale
const NATIVE_PRINT_CONFIG: PrintConfig = {
  paperSize: "auto",
  orientation: "portrait",
  marginMm: 0,
  scalePercent: 100,
  fontSize: "normal",
  title: "Customer History Report",
  subtitle: "Industrial Distribution System",
  showHeaderFooter: true,
  showPageNumbers: false,
  showFiltersSummary: true,
  showKpis: true,
  showCharts: false,
  showTable: true,
  rowScope: "all_filtered",
  includedColumns: CUSTOMER_PRINTABLE_COLUMNS.map((c) => c.key),
};

function CustomerHistoryShell() {
  const {
    listData,
    isListLoading,
    listError,
    appliedFilters,
    openCustomerDetail,
    detailData,
  } = useCustomerHistoryContext();

  const [activeTab, setActiveTab] = React.useState<MainTab>("customers");
  const [filteredRows, setFilteredRows] = React.useState<CustomerHistoryRow[]>([]);

  const listPrintRef = React.useRef<HTMLDivElement>(null);
  const detailPrintRef = React.useRef<HTMLDivElement>(null);

  const rows = listData?.rows ?? EMPTY_ROWS;

  // Trigger browser's default print dialog directly without hardcoded @page layout
  const handlePrintList = useReactToPrint({
    contentRef: listPrintRef,
    documentTitle: "Customer History Report",
  });

  const handlePrintDetail = useReactToPrint({
    contentRef: detailPrintRef,
    documentTitle: detailData
      ? `Customer History - ${detailData.profile.customerName}`
      : "Customer History Detail",
  });

  return (
    <div className="flex min-h-full flex-col gap-5 bg-background/50 p-3 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-blue-950 dark:text-blue-100 sm:text-2xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <History className="h-5 w-5 shrink-0" />
            </span>
            Customer History
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Complete industrial relationship timeline: sales, payments, dispatch, returns, serials, and memos.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => handlePrintList()}
          disabled={isListLoading || rows.length === 0}
          className="h-9 gap-2 rounded-lg bg-indigo-600 text-xs font-medium text-white shadow-xs hover:bg-indigo-700"
        >
          <Printer className="h-4 w-4" />
          Print Report
        </Button>
      </div>

      {/* Filters (Apply button required to refresh data) */}
      <FilterBar />

      {/* KPI Strip */}
      <KpiStrip kpis={listData?.kpis} isLoading={isListLoading} />

      {/* Error banner */}
      {listError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {listError}
        </div>
      )}

      {/* Main View Tabs: Customers | Insights */}
      <div className="flex items-center gap-2 border-b border-border/60">
        {[
          { id: "customers" as const, label: "Customers", icon: Users },
          { id: "insights" as const, label: "Insights & Graphs", icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="customer-history-main-tab"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Animated Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "customers" ? (
          <motion.div
            key="tab-customers"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            <CustomerTable
              rows={rows}
              isLoading={isListLoading}
              onViewCustomer={openCustomerDetail}
              onFilteredRowsChange={setFilteredRows}
            />
          </motion.div>
        ) : (
          <motion.div
            key="tab-insights"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="grid grid-cols-1 gap-4 lg:grid-cols-2"
          >
            <div className="lg:col-span-2">
              <ActivityTrendChart data={listData?.trend ?? []} />
            </div>
            <CategoryMixChart data={listData?.categoryMix ?? []} />
            <TopCustomersChart data={listData?.topCustomers ?? []} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customer Detail Modal */}
      <CustomerDetailModal onPrintCustomer={() => handlePrintDetail()} />

      {/* Hidden printable sheets for native browser print dialog */}
      <div className="hidden">
        <PrintSheet
          ref={listPrintRef}
          mode="list"
          config={NATIVE_PRINT_CONFIG}
          filters={appliedFilters}
          kpis={listData?.kpis}
          rows={filteredRows.length > 0 ? filteredRows : rows}
        />
        <PrintSheet
          ref={detailPrintRef}
          mode="detail"
          config={NATIVE_PRINT_CONFIG}
          filters={appliedFilters}
          rows={EMPTY_ROWS}
          detail={detailData}
        />
      </div>
    </div>
  );
}

export default function CustomerHistoryModule() {
  return (
    <MotionConfig reducedMotion="user">
      <CustomerHistoryProvider>
        <CustomerHistoryShell />
      </CustomerHistoryProvider>
    </MotionConfig>
  );
}
