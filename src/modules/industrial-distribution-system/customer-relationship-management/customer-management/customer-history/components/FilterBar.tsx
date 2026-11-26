"use client";

// ============================================================================
// Customer History — Filter Bar
// Separate From Date and To Date inputs, Branch (Div 1), and Parent Product.
// Customer status filter removed (backend always filters customer.isActive = 1).
// Edits draftFilters only; data refreshes strictly when clicking Apply Filters.
// ============================================================================

import * as React from "react";
import { Calendar, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import { useCustomerHistoryContext } from "../providers/CustomerHistoryProvider";

export function FilterBar() {
  const {
    draftFilters,
    setDraftFilters,
    hasUnappliedChanges,
    applyFilters,
    resetFilters,
    branchOptions,
    productOptions,
    isLookupsLoading,
    isListLoading,
  } = useCustomerHistoryContext();

  const branchSelectOptions = React.useMemo(
    () => [{ value: "all", label: "All Branches" }, ...branchOptions],
    [branchOptions]
  );

  const productSelectOptions = React.useMemo(
    () => [{ value: "all", label: "All Products" }, ...productOptions],
    [productOptions]
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-blue-200/70 bg-gradient-to-r from-blue-50/50 via-background to-indigo-50/40 p-3.5 shadow-sm dark:border-blue-900/40 dark:from-blue-950/20 dark:to-indigo-950/20">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[155px] flex-col gap-1">
          <label
            htmlFor="ch-from-date"
            className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300"
          >
            <Calendar className="h-3 w-3" />
            From Date
          </label>
          <Input
            id="ch-from-date"
            type="date"
            value={draftFilters.startDate}
            max={draftFilters.endDate || undefined}
            onChange={(e) =>
              setDraftFilters((prev) => ({ ...prev, startDate: e.target.value }))
            }
            className="h-10 rounded-lg border-blue-200/80 bg-background text-xs font-medium focus-visible:ring-blue-500"
          />
        </div>

        <div className="flex min-w-[155px] flex-col gap-1">
          <label
            htmlFor="ch-to-date"
            className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300"
          >
            <Calendar className="h-3 w-3" />
            To Date
          </label>
          <Input
            id="ch-to-date"
            type="date"
            value={draftFilters.endDate}
            min={draftFilters.startDate || undefined}
            onChange={(e) =>
              setDraftFilters((prev) => ({ ...prev, endDate: e.target.value }))
            }
            className="h-10 rounded-lg border-blue-200/80 bg-background text-xs font-medium focus-visible:ring-blue-500"
          />
        </div>

        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
            Branches
          </span>
          <SearchableSelect
            value={draftFilters.branchId}
            onValueChange={(branchId) =>
              setDraftFilters((prev) => ({ ...prev, branchId }))
            }
            options={branchSelectOptions}
            placeholder={isLookupsLoading ? "Loading branches..." : "Select branch"}
            disabled={isLookupsLoading}
            className="h-10 border-indigo-200/80 bg-background"
          />
        </div>

        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            Products
          </span>
          <SearchableSelect
            value={draftFilters.productId}
            onValueChange={(productId) =>
              setDraftFilters((prev) => ({ ...prev, productId }))
            }
            options={productSelectOptions}
            placeholder={isLookupsLoading ? "Loading products..." : "Select product"}
            disabled={isLookupsLoading}
            className="h-10 border-violet-200/80 bg-background"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => void applyFilters()}
            disabled={isListLoading}
            className={cn(
              "relative h-10 gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700",
              hasUnappliedChanges && "ring-2 ring-blue-400/60"
            )}
          >
            <Check className="h-4 w-4" />
            Apply Filters
            {hasUnappliedChanges && (
              <span
                aria-label="Unapplied filter changes"
                className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-background"
              />
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => void resetFilters()}
            disabled={isListLoading}
            className="h-10 gap-1.5 rounded-lg border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
            title="Reset filters to this month"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
