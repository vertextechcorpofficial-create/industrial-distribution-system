// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/providers/CustomerOrderConsumptionReportProvider.tsx
// ============================================================
// React Context Provider for the Customer Order & Consumption Report.
// Strictly obeys React hook ordering: all hooks execute unconditionally
// before any early returns.
// ============================================================

"use client";

import * as React from "react";
import {
  fetchCustomerOrderConsumptionDetailClient,
  fetchCustomerOrderConsumptionReportClient,
} from "../api/customer-order-consumption.client";
import type {
  AppliedFilterContext,
  CustomerOrderConsumptionDetail,
  CustomerOrderConsumptionReportResponse,
} from "../types/customer-order-consumption.types";

export interface DrillDownTarget {
  customerCode: string;
  customerName?: string;
  productId?: number | null;
  productName?: string | null;
}

export interface CustomerOrderConsumptionReportContextValue {
  appliedFilters: AppliedFilterContext | null;
  report: CustomerOrderConsumptionReportResponse | null;
  error: string | null;
  isLoading: boolean;
  isInitialLoading: boolean;
  applyFilters: (next: AppliedFilterContext) => Promise<boolean>;
  refresh: () => Promise<boolean>;
  drillDownTarget: DrillDownTarget | null;
  drillDownDetail: CustomerOrderConsumptionDetail | null;
  isDrillDownLoading: boolean;
  drillDownError: string | null;
  openDrillDown: (target: DrillDownTarget) => void;
  closeDrillDown: () => void;
}

const CustomerOrderConsumptionReportContext =
  React.createContext<CustomerOrderConsumptionReportContextValue | null>(null);

function defaultInitialDates(): { startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return {
    startDate: `${year}-${month}-01`,
    endDate: `${year}-${month}-${day}`,
  };
}

export function CustomerOrderConsumptionReportProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [appliedFilters, setAppliedFilters] = React.useState<AppliedFilterContext | null>(() => {
    const dates = defaultInitialDates();
    return {
      startDate: dates.startDate,
      endDate: dates.endDate,
    };
  });

  const [report, setReport] = React.useState<CustomerOrderConsumptionReportResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = React.useState<boolean>(true);

  // Drill-down state
  const [drillDownTarget, setDrillDownTarget] = React.useState<DrillDownTarget | null>(null);
  const [drillDownDetail, setDrillDownDetail] = React.useState<CustomerOrderConsumptionDetail | null>(null);
  const [isDrillDownLoading, setIsDrillDownLoading] = React.useState<boolean>(false);
  const [drillDownError, setDrillDownError] = React.useState<string | null>(null);

  // Track latest request sequence so rapid filter clicks never let stale responses overwrite newer ones
  const requestSeqRef = React.useRef<number>(0);
  const initialFiltersRef = React.useRef<AppliedFilterContext | null>(appliedFilters);

  // Main Report Fetch returning true on success and false on failure/stale
  const loadReport = React.useCallback(async (filters: AppliedFilterContext): Promise<boolean> => {
    const seq = ++requestSeqRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCustomerOrderConsumptionReportClient(filters);
      if (seq !== requestSeqRef.current) return false;
      setReport(data);
      return true;
    } catch (err) {
      if (seq !== requestSeqRef.current) return false;
      console.error("[CustomerOrderConsumption] Load report error:", err);
      setError(err instanceof Error ? err.message : "Failed to load report data.");
      return false;
    } finally {
      if (seq === requestSeqRef.current) {
        setIsLoading(false);
        setIsInitialLoading(false);
      }
    }
  }, []);

  // Trigger initial load once on mount with default reporting window
  React.useEffect(() => {
    if (initialFiltersRef.current) {
      void loadReport(initialFiltersRef.current);
    }
  }, [loadReport]);

  const applyFilters = React.useCallback(
    async (next: AppliedFilterContext): Promise<boolean> => {
      setAppliedFilters(next);
      return await loadReport(next);
    },
    [loadReport]
  );

  const refresh = React.useCallback(async (): Promise<boolean> => {
    if (!appliedFilters) return false;
    return await loadReport(appliedFilters);
  }, [appliedFilters, loadReport]);

  // Drill-down Document Fetch
  const openDrillDown = React.useCallback(
    (target: DrillDownTarget) => {
      setDrillDownTarget(target);
      if (!appliedFilters) return;

      setIsDrillDownLoading(true);
      setDrillDownError(null);
      fetchCustomerOrderConsumptionDetailClient(
        appliedFilters,
        target.customerCode,
        target.productId ?? undefined
      )
        .then((detail) => {
          setDrillDownDetail({
            ...detail,
            customerName: target.customerName || target.customerCode,
            productName: target.productName || detail.productName,
          });
        })
        .catch((err) => {
          console.error("[CustomerOrderConsumption] Drilldown error:", err);
          setDrillDownError(err instanceof Error ? err.message : "Failed to load supporting documents.");
        })
        .finally(() => {
          setIsDrillDownLoading(false);
        });
    },
    [appliedFilters]
  );

  const closeDrillDown = React.useCallback(() => {
    setDrillDownTarget(null);
    setDrillDownDetail(null);
    setDrillDownError(null);
  }, []);

  // Context value memoized unconditionally
  const contextValue = React.useMemo<CustomerOrderConsumptionReportContextValue>(
    () => ({
      appliedFilters,
      report,
      error,
      isLoading,
      isInitialLoading,
      applyFilters,
      refresh,
      drillDownTarget,
      drillDownDetail,
      isDrillDownLoading,
      drillDownError,
      openDrillDown,
      closeDrillDown,
    }),
    [
      appliedFilters,
      report,
      error,
      isLoading,
      isInitialLoading,
      applyFilters,
      refresh,
      drillDownTarget,
      drillDownDetail,
      isDrillDownLoading,
      drillDownError,
      openDrillDown,
      closeDrillDown,
    ]
  );

  return (
    <CustomerOrderConsumptionReportContext.Provider value={contextValue}>
      {children}
    </CustomerOrderConsumptionReportContext.Provider>
  );
}

export function useCustomerOrderConsumptionReportContext(): CustomerOrderConsumptionReportContextValue {
  const ctx = React.useContext(CustomerOrderConsumptionReportContext);
  if (!ctx) {
    throw new Error(
      "useCustomerOrderConsumptionReportContext must be used within a CustomerOrderConsumptionReportProvider."
    );
  }
  return ctx;
}
