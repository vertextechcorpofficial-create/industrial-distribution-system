// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/hooks/useConsumptionFilterOptions.ts
// ============================================================
// Hook to load lookup options for filters (branches, categories, products, customers).
// ============================================================

"use client";

import * as React from "react";
import { fetchLookupOptionsClient } from "../api/customer-order-consumption.client";
import type { ReportLookupOption } from "../types/customer-order-consumption.types";

export function useConsumptionFilterOptions() {
  const [branches, setBranches] = React.useState<ReportLookupOption[]>([]);
  const [categories, setCategories] = React.useState<ReportLookupOption[]>([]);
  const [products, setProducts] = React.useState<ReportLookupOption[]>([]);
  const [customers, setCustomers] = React.useState<ReportLookupOption[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    Promise.all([
      fetchLookupOptionsClient("branch"),
      fetchLookupOptionsClient("category"),
      fetchLookupOptionsClient("product"),
      fetchLookupOptionsClient("customer"),
    ])
      .then(([b, c, p, cust]) => {
        if (!cancelled) {
          setBranches(b);
          setCategories(c);
          setProducts(p);
          setCustomers(cust);
        }
      })
      .catch((err) => {
        console.error("[CustomerOrderConsumption] Failed to fetch filter options:", err);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    branches,
    categories,
    products,
    customers,
    isLoading,
  };
}
