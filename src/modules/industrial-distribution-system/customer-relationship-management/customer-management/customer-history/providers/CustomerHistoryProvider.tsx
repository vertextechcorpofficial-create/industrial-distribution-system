"use client";

// ============================================================================
// Customer History — Context Provider
// Enforces Draft vs Applied filter separation on the main page:
//   - Changing filter controls only mutates draftFilters (no API call).
//   - Data refreshes ONLY when applyFilters() is explicitly invoked.
//   - Initial load uses the current calendar month by default.
//   - Detail modal loads full all-time industrial history for the customer.
// ============================================================================

import * as React from "react";
import {
  fetchCustomerHistoryDetailClient,
  fetchCustomerHistoryListClient,
  fetchCustomerHistoryLookupsClient,
} from "../api/customer-history.client";
import { getCurrentMonthRange } from "../services/customer-history.helpers";
import type {
  CustomerHistoryDetailResponse,
  CustomerHistoryFilters,
  CustomerHistoryListResponse,
  LookupOption,
} from "../types/customer-history.types";

interface CustomerHistoryContextValue {
  // List filters (draft vs applied)
  draftFilters: CustomerHistoryFilters;
  appliedFilters: CustomerHistoryFilters;
  hasUnappliedChanges: boolean;
  setDraftFilters: React.Dispatch<React.SetStateAction<CustomerHistoryFilters>>;
  applyFilters: () => Promise<void>;
  resetFilters: () => Promise<void>;

  // Lookups
  branchOptions: LookupOption[];
  productOptions: LookupOption[];
  isLookupsLoading: boolean;

  // List data
  listData: CustomerHistoryListResponse | null;
  isListLoading: boolean;
  listError: string | null;

  // Detail modal state (always all-time industrial history)
  selectedCustomerCode: string | null;
  detailOpen: boolean;
  detailData: CustomerHistoryDetailResponse | null;
  isDetailLoading: boolean;
  detailError: string | null;
  openCustomerDetail: (customerCode: string) => void;
  closeCustomerDetail: () => void;
}

const CustomerHistoryContext =
  React.createContext<CustomerHistoryContextValue | null>(null);

function createDefaultFilters(): CustomerHistoryFilters {
  const { startDate, endDate } = getCurrentMonthRange();
  return {
    startDate,
    endDate,
    branchId: "all",
    productId: "all",
  };
}

function filtersEqual(
  a: CustomerHistoryFilters,
  b: CustomerHistoryFilters
): boolean {
  return (
    a.startDate === b.startDate &&
    a.endDate === b.endDate &&
    a.branchId === b.branchId &&
    a.productId === b.productId
  );
}

export function CustomerHistoryProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [defaultFilters] = React.useState<CustomerHistoryFilters>(() =>
    createDefaultFilters()
  );
  const [draftFilters, setDraftFilters] =
    React.useState<CustomerHistoryFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] =
    React.useState<CustomerHistoryFilters>(defaultFilters);

  const [branchOptions, setBranchOptions] = React.useState<LookupOption[]>([]);
  const [productOptions, setProductOptions] = React.useState<LookupOption[]>([]);
  const [isLookupsLoading, setIsLookupsLoading] = React.useState(true);

  const [listData, setListData] =
    React.useState<CustomerHistoryListResponse | null>(null);
  const [isListLoading, setIsListLoading] = React.useState(true);
  const [listError, setListError] = React.useState<string | null>(null);

  // Detail modal state
  const [selectedCustomerCode, setSelectedCustomerCode] =
    React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailData, setDetailData] =
    React.useState<CustomerHistoryDetailResponse | null>(null);
  const [isDetailLoading, setIsDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);

  const listSeqRef = React.useRef(0);
  const detailSeqRef = React.useRef(0);

  const loadList = React.useCallback(async (filters: CustomerHistoryFilters) => {
    const seq = ++listSeqRef.current;
    setIsListLoading(true);
    setListError(null);
    try {
      const data = await fetchCustomerHistoryListClient(filters);
      if (seq !== listSeqRef.current) return;
      setListData(data);
    } catch (err) {
      if (seq !== listSeqRef.current) return;
      setListError(
        err instanceof Error ? err.message : "Failed to load customer history."
      );
    } finally {
      if (seq === listSeqRef.current) {
        setIsListLoading(false);
      }
    }
  }, []);

  const loadDetail = React.useCallback(async (customerCode: string) => {
    const seq = ++detailSeqRef.current;
    setIsDetailLoading(true);
    setDetailError(null);
    try {
      const data = await fetchCustomerHistoryDetailClient(customerCode, "all");
      if (seq !== detailSeqRef.current) return;
      setDetailData(data);
    } catch (err) {
      if (seq !== detailSeqRef.current) return;
      setDetailError(
        err instanceof Error ? err.message : "Failed to load customer detail."
      );
    } finally {
      if (seq === detailSeqRef.current) {
        setIsDetailLoading(false);
      }
    }
  }, []);

  // Initial mount: load lookups + default this-month list once
  React.useEffect(() => {
    const controller = new AbortController();
    setIsLookupsLoading(true);
    Promise.all([
      fetchCustomerHistoryLookupsClient("branch", controller.signal),
      fetchCustomerHistoryLookupsClient("product", controller.signal),
    ])
      .then(([branches, products]) => {
        setBranchOptions(branches);
        setProductOptions(products);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("[CustomerHistory] lookup error:", err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLookupsLoading(false);
      });

    void loadList(defaultFilters);

    return () => controller.abort();
  }, [defaultFilters, loadList]);

  const applyFilters = React.useCallback(async () => {
    setAppliedFilters(draftFilters);
    await loadList(draftFilters);
  }, [draftFilters, loadList]);

  const resetFilters = React.useCallback(async () => {
    const fresh = createDefaultFilters();
    setDraftFilters(fresh);
    setAppliedFilters(fresh);
    await loadList(fresh);
  }, [loadList]);

  const openCustomerDetail = React.useCallback(
    (customerCode: string) => {
      setSelectedCustomerCode(customerCode);
      setDetailOpen(true);
      setDetailData(null);
      void loadDetail(customerCode);
    },
    [loadDetail]
  );

  const closeCustomerDetail = React.useCallback(() => {
    setDetailOpen(false);
  }, []);

  const hasUnappliedChanges = React.useMemo(
    () => !filtersEqual(draftFilters, appliedFilters),
    [draftFilters, appliedFilters]
  );

  const value = React.useMemo<CustomerHistoryContextValue>(
    () => ({
      draftFilters,
      appliedFilters,
      hasUnappliedChanges,
      setDraftFilters,
      applyFilters,
      resetFilters,
      branchOptions,
      productOptions,
      isLookupsLoading,
      listData,
      isListLoading,
      listError,
      selectedCustomerCode,
      detailOpen,
      detailData,
      isDetailLoading,
      detailError,
      openCustomerDetail,
      closeCustomerDetail,
    }),
    [
      draftFilters,
      appliedFilters,
      hasUnappliedChanges,
      applyFilters,
      resetFilters,
      branchOptions,
      productOptions,
      isLookupsLoading,
      listData,
      isListLoading,
      listError,
      selectedCustomerCode,
      detailOpen,
      detailData,
      isDetailLoading,
      detailError,
      openCustomerDetail,
      closeCustomerDetail,
    ]
  );

  return (
    <CustomerHistoryContext.Provider value={value}>
      {children}
    </CustomerHistoryContext.Provider>
  );
}

export function useCustomerHistoryContext(): CustomerHistoryContextValue {
  const ctx = React.useContext(CustomerHistoryContext);
  if (!ctx) {
    throw new Error(
      "useCustomerHistoryContext must be used inside CustomerHistoryProvider"
    );
  }
  return ctx;
}
