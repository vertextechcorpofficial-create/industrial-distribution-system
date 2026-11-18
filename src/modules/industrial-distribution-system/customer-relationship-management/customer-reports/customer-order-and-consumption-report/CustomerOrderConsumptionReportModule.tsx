// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/CustomerOrderConsumptionReportModule.tsx
// ============================================================
// Composition Root: Customer Order & Consumption Report Module.
// Follows IDS guidelines:
// - Main group is Customer with nested Product breakdown
// - Products display products.description as product name
// - Products filtered by is_serialized = 1
// - Branches filtered by division_id = 1
// - Categories filtered by is_industrial = 1 (extracts cylinder size)
// - React hook order safety (no conditional useMemo or early returns before hooks)
// ============================================================

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConsumptionTrendChart } from "./components/ConsumptionTrendChart";
import { CustomerOrderConsumptionDrawer } from "./components/CustomerOrderConsumptionDrawer";
import { CustomerOrderConsumptionFilters } from "./components/CustomerOrderConsumptionFilters";
import { CustomerOrderConsumptionHeader } from "./components/CustomerOrderConsumptionHeader";
import { CustomerOrderConsumptionKpis } from "./components/CustomerOrderConsumptionKpis";
import { CustomerOrderConsumptionTable } from "./components/CustomerOrderConsumptionTable";
import { ExceptionsPanel } from "./components/ExceptionsPanel";
import {
  ReportEmptyState,
  ReportErrorState,
  ReportPromptState,
  ReportQuietState,
  ReportSkeleton,
} from "./components/ReportState";
import { useCustomerOrderConsumptionReport } from "./hooks/useCustomerOrderConsumptionReport";
import {
  CustomerOrderConsumptionReportProvider,
} from "./providers/CustomerOrderConsumptionReportProvider";

type ReportTab = "customers" | "trends" | "exceptions";

function ReportContent(): React.ReactElement {
  const { report, error, isInitialLoading, refresh } =
    useCustomerOrderConsumptionReport();

  const [tab, setTab] = React.useState<ReportTab>("customers");

  // Hook calls must remain above any early returns
  const exceptionCount = report?.exceptions.length ?? 0;
  const customerCount = report?.rows.length ?? 0;
  const monthCount = React.useMemo(() => {
    if (!report) return 0;
    return new Set(report.monthlyTrend.map((p) => p.yearMonth)).size;
  }, [report]);

  if (isInitialLoading) {
    return <ReportSkeleton />;
  }

  if (error && !report) {
    return <ReportErrorState message={error} onRetry={() => void refresh()} />;
  }

  if (!report) {
    return <ReportPromptState />;
  }

  return (
    <div className="space-y-4">
      {/* 1. Executive KPIs */}
      <CustomerOrderConsumptionKpis onOpenExceptions={() => setTab("exceptions")} />

      {/* 2. Tab Navigation */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as ReportTab)} className="space-y-3">
        <div className="flex w-full overflow-x-auto border-b pb-px">
          <TabsList className="h-9 gap-1 bg-transparent p-0">
            <TabsTrigger
              value="customers"
              className="gap-2 rounded-none px-3 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              Demand by Customer
              <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] tabular-nums font-medium text-muted-foreground">
                {customerCount}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="trends"
              className="gap-2 rounded-none px-3 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              Monthly Trend Analytics
              <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] tabular-nums font-medium text-muted-foreground">
                {monthCount}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="exceptions"
              className="gap-2 rounded-none px-3 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              Data Quality &amp; Exceptions
              {exceptionCount > 0 ? (
                <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[9px] tabular-nums">
                  {exceptionCount}
                </Badge>
              ) : (
                <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] tabular-nums font-medium text-muted-foreground">
                  0
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Smooth Animated Tab Content Transition */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-3 p-0"
          >
            {tab === "customers" && (
              report.rows.length === 0 ? (
                <ReportEmptyState />
              ) : (
                <CustomerOrderConsumptionTable />
              )
            )}

            {tab === "trends" && (
              monthCount === 0 ? (
                <ReportQuietState
                  title="No Monthly Trend Data"
                  message="No time-series movement points were recorded in the selected period."
                />
              ) : (
                <ConsumptionTrendChart />
              )
            )}

            {tab === "exceptions" && (
              exceptionCount === 0 ? (
                <ReportQuietState
                  title="Zero Data Exceptions"
                  message="All movements in this period matched valid product weights, industrial category cylinder sizes, and authorized branches."
                />
              ) : (
                <ExceptionsPanel />
              )
            )}
          </motion.div>
        </AnimatePresence>
      </Tabs>

      {/* 3. Slide-over Drill-down Drawer */}
      <CustomerOrderConsumptionDrawer />
    </div>
  );
}

export function CustomerOrderConsumptionReportModule(): React.ReactElement {
  return (
    <CustomerOrderConsumptionReportProvider>
      <div className="space-y-4">
        <CustomerOrderConsumptionHeader />
        <CustomerOrderConsumptionFilters />
        <ReportContent />
      </div>
    </CustomerOrderConsumptionReportProvider>
  );
}

export default CustomerOrderConsumptionReportModule;
