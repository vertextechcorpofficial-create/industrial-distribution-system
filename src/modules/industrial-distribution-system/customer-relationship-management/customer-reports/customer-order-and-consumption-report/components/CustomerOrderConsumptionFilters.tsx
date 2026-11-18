// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/components/CustomerOrderConsumptionFilters.tsx
// ============================================================
// Unified Filter, Preset & Action Toolbar for the Customer Order & Consumption Report.
// Rules enforced:
// - Authorized branches: division_id = 1 (searchable multi-select)
// - Categories / cylinder size: is_industrial = 1 (searchable multi-select)
// - All React hooks declared unconditionally before any returns
// - Tactile + stateful visual feedback (motion press, loading spinner,
//   emerald checkmark flash, top shimmer bar, and Sonner toast notifications)
//   for every filter, preset, refresh, export, and print action.
// ============================================================

"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronsUpDown,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useConsumptionFilterOptions } from "../hooks/useConsumptionFilterOptions";
import { useCustomerOrderConsumptionReport } from "../hooks/useCustomerOrderConsumptionReport";
import {
  downloadCustomerOrderConsumptionPdf,
  printCustomerOrderConsumptionPdf,
} from "../services/customer-order-consumption.pdf";
import { downloadCustomerOrderConsumptionExcel } from "../services/customer-order-consumption.xlsx";
import type {
  AppliedFilterContext,
  ReportLookupOption,
} from "../types/customer-order-consumption.types";

type DatePresetKey = "THIS_MONTH" | "LAST_MONTH" | "LAST_90_DAYS" | "YTD";
type ButtonFeedbackKey = "apply" | "reset" | "refresh" | "excel" | "pdf" | "print";
type ButtonFeedbackState = "idle" | "loading" | "success";

interface DatePresetDefinition {
  key: DatePresetKey;
  label: string;
  shortLabel: string;
  getRange: () => { start: string; end: string };
}

/** Formats a local Date into YYYY-MM-DD without UTC timezone drift. */
function toIsoLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentMonthToDate(): { start: string; end: string } {
  const now = new Date();
  return {
    start: toIsoLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toIsoLocalDate(now),
  };
}

function getCurrentMonthFull(): { start: string; end: string } {
  const now = new Date();
  return {
    start: toIsoLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toIsoLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function getLastMonthRange(): { start: string; end: string } {
  const now = new Date();
  return {
    start: toIsoLocalDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    end: toIsoLocalDate(new Date(now.getFullYear(), now.getMonth(), 0)),
  };
}

function getLast90DaysRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 89);
  return {
    start: toIsoLocalDate(start),
    end: toIsoLocalDate(now),
  };
}

function getYtdRange(): { start: string; end: string } {
  const now = new Date();
  return {
    start: `${now.getFullYear()}-01-01`,
    end: toIsoLocalDate(now),
  };
}

/** Compares two string arrays as order-independent sets. */
function sameStringSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((item) => setA.has(item));
}

const DATE_PRESETS: readonly DatePresetDefinition[] = [
  {
    key: "THIS_MONTH",
    label: "This Month",
    shortLabel: "This Month",
    getRange: getCurrentMonthToDate,
  },
  {
    key: "LAST_MONTH",
    label: "Last Month",
    shortLabel: "Last Month",
    getRange: getLastMonthRange,
  },
  {
    key: "LAST_90_DAYS",
    label: "Last 90 Days",
    shortLabel: "90 Days",
    getRange: getLast90DaysRange,
  },
  {
    key: "YTD",
    label: "Year to Date",
    shortLabel: "YTD",
    getRange: getYtdRange,
  },
];

const INITIAL_FEEDBACK: Record<ButtonFeedbackKey, ButtonFeedbackState> = {
  apply: "idle",
  reset: "idle",
  refresh: "idle",
  excel: "idle",
  pdf: "idle",
  print: "idle",
};

interface SearchableMultiSelectProps {
  options: ReportLookupOption[];
  selectedValues: string[];
  onChange: (nextValues: string[]) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  disabled?: boolean;
  isLoading?: boolean;
}

/**
 * Searchable Multi-Select Combobox powered by Radix Popover + cmdk Command.
 * Keeps the dropdown open on toggle so users can select multiple options smoothly,
 * includes instant search filtering, Select All, and Clear actions.
 */
function SearchableMultiSelect({
  options,
  selectedValues,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  disabled = false,
  isLoading = false,
}: SearchableMultiSelectProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);

  const selectedSet = React.useMemo(() => new Set(selectedValues), [selectedValues]);

  const selectedOptions = React.useMemo(
    () => options.filter((opt) => selectedSet.has(opt.value)),
    [options, selectedSet]
  );

  const toggleValue = React.useCallback(
    (value: string) => {
      if (selectedSet.has(value)) {
        onChange(selectedValues.filter((v) => v !== value));
      } else {
        onChange([...selectedValues, value]);
      }
    },
    [selectedSet, selectedValues, onChange]
  );

  const handleSelectAll = React.useCallback(() => {
    onChange(options.map((opt) => opt.value));
  }, [options, onChange]);

  const handleClear = React.useCallback(() => {
    onChange([]);
  }, [onChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn(
            "h-9 w-full justify-between gap-1.5 bg-background px-2.5 text-xs font-normal hover:bg-background/90",
            selectedValues.length === 0 && "text-muted-foreground"
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left">
            {isLoading ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Loading...
              </span>
            ) : selectedValues.length === 0 ? (
              <span className="truncate">{placeholder}</span>
            ) : selectedValues.length === 1 ? (
              <span className="truncate font-medium text-foreground">
                {selectedOptions[0]?.label ?? `Selected (${selectedValues[0]})`}
              </span>
            ) : (
              <>
                <span className="truncate font-medium text-foreground">
                  {selectedOptions[0]?.label ?? `${selectedValues.length} selected`}
                </span>
                <Badge
                  variant="secondary"
                  className="h-5 shrink-0 rounded bg-primary/10 px-1.5 text-[10px] font-semibold text-primary"
                >
                  +{selectedValues.length - 1}
                </Badge>
              </>
            )}
          </span>

          <span className="flex shrink-0 items-center gap-1">
            {selectedValues.length > 0 && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                aria-label={`Clear ${placeholder}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="size-3" />
              </span>
            )}
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9 text-xs" />

          {/* Selection utility header */}
          <div className="flex items-center justify-between border-b bg-muted/30 px-2.5 py-1.5 text-[11px]">
            <span className="font-medium text-muted-foreground">
              {selectedValues.length === 0
                ? "All included"
                : `${selectedValues.length} of ${options.length} selected`}
            </span>
            <div className="flex items-center gap-2">
              {options.length > 0 && selectedValues.length < options.length && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="font-medium text-primary hover:underline"
                >
                  Select All
                </button>
              )}
              {selectedValues.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="font-medium text-muted-foreground hover:text-foreground hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <CommandList className="max-h-60">
            <CommandEmpty className="py-5 text-center text-xs text-muted-foreground">
              {emptyLabel}
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = selectedSet.has(opt.value);
                return (
                  <CommandItem
                    key={opt.value}
                    value={`${opt.label} ${opt.code ?? ""}`}
                    onSelect={() => toggleValue(opt.value)}
                    className="flex cursor-pointer items-center gap-2 py-2 text-xs"
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background"
                      )}
                    >
                      {isSelected && <Check className="size-3 stroke-[2.5]" />}
                    </span>
                    <span className="truncate flex-1">{opt.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function CustomerOrderConsumptionFilters(): React.ReactElement {
  const { report, appliedFilters, applyFilters, refresh, isLoading } =
    useCustomerOrderConsumptionReport();
  const { branches, categories, isLoading: isOptionsLoading } =
    useConsumptionFilterOptions();

  // Local controlled filter fields (multi-select arrays for branch and cylinder size)
  const [startDate, setStartDate] = React.useState<string>(appliedFilters?.startDate ?? "");
  const [endDate, setEndDate] = React.useState<string>(appliedFilters?.endDate ?? "");
  const [selectedBranchIds, setSelectedBranchIds] = React.useState<string[]>(
    appliedFilters?.branchIds?.map(String) ?? []
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = React.useState<string[]>(
    appliedFilters?.categoryIds?.map(String) ?? []
  );
  const [search, setSearch] = React.useState<string>(appliedFilters?.search ?? "");

  // Per-button visual feedback state (loading -> emerald checkmark flash -> idle)
  const [feedback, setFeedback] =
    React.useState<Record<ButtonFeedbackKey, ButtonFeedbackState>>(INITIAL_FEEDBACK);
  const [loadingPresetKey, setLoadingPresetKey] = React.useState<DatePresetKey | null>(null);

  // Track active feedback reset timers so they always clean up safely on unmount
  const timersRef = React.useRef<Map<ButtonFeedbackKey, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  React.useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timerId) => clearTimeout(timerId));
      timers.clear();
    };
  }, []);

  // Synchronize local inputs whenever appliedFilters changes externally
  React.useEffect(() => {
    if (appliedFilters) {
      setStartDate(appliedFilters.startDate);
      setEndDate(appliedFilters.endDate);
      setSelectedBranchIds(appliedFilters.branchIds?.map(String) ?? []);
      setSelectedCategoryIds(appliedFilters.categoryIds?.map(String) ?? []);
      setSearch(appliedFilters.search ?? "");
    }
  }, [appliedFilters]);

  /** Helper to set a button's state and optionally auto-clear its emerald success flash. */
  const setButtonState = React.useCallback(
    (key: ButtonFeedbackKey, state: ButtonFeedbackState, autoResetMs = 1700) => {
      const existing = timersRef.current.get(key);
      if (existing) {
        clearTimeout(existing);
        timersRef.current.delete(key);
      }

      setFeedback((prev) => (prev[key] === state ? prev : { ...prev, [key]: state }));

      if (state === "success") {
        const timerId = setTimeout(() => {
          setFeedback((prev) => ({ ...prev, [key]: "idle" }));
          timersRef.current.delete(key);
        }, autoResetMs);
        timersRef.current.set(key, timerId);
      }
    },
    []
  );

  // Detect which date preset matches the currently selected startDate/endDate
  const activePreset = React.useMemo<DatePresetKey | null>(() => {
    if (!startDate || !endDate) return null;

    const mtd = getCurrentMonthToDate();
    const fullMonth = getCurrentMonthFull();
    if (
      (startDate === mtd.start && endDate === mtd.end) ||
      (startDate === fullMonth.start && endDate === fullMonth.end)
    ) {
      return "THIS_MONTH";
    }

    const lastMonth = getLastMonthRange();
    if (startDate === lastMonth.start && endDate === lastMonth.end) {
      return "LAST_MONTH";
    }

    const last90 = getLast90DaysRange();
    if (startDate === last90.start && endDate === last90.end) {
      return "LAST_90_DAYS";
    }

    const ytd = getYtdRange();
    if (startDate === ytd.start && endDate === ytd.end) {
      return "YTD";
    }

    return null;
  }, [startDate, endDate]);

  // Date range validation
  const isDateRangeInvalid = React.useMemo(() => {
    if (!startDate || !endDate) return false;
    return startDate > endDate;
  }, [startDate, endDate]);

  // Detect whether local form values differ from the currently applied report query
  const hasPendingChanges = React.useMemo(() => {
    if (!appliedFilters) return false;
    const appliedBranches = appliedFilters.branchIds?.map(String) ?? [];
    const appliedCategories = appliedFilters.categoryIds?.map(String) ?? [];
    const appliedSearch = (appliedFilters.search ?? "").trim();

    return (
      startDate !== appliedFilters.startDate ||
      endDate !== appliedFilters.endDate ||
      !sameStringSet(selectedBranchIds, appliedBranches) ||
      !sameStringSet(selectedCategoryIds, appliedCategories) ||
      search.trim() !== appliedSearch
    );
  }, [appliedFilters, startDate, endDate, selectedBranchIds, selectedCategoryIds, search]);

  // Detect whether any non-default filters are currently active or entered
  const canReset = React.useMemo(() => {
    const defaultDates = getCurrentMonthToDate();
    return (
      startDate !== defaultDates.start ||
      endDate !== defaultDates.end ||
      selectedBranchIds.length > 0 ||
      selectedCategoryIds.length > 0 ||
      search.trim().length > 0
    );
  }, [startDate, endDate, selectedBranchIds, selectedCategoryIds, search]);

  const appliedSearchTerm = React.useMemo(
    () => (appliedFilters?.search ?? "").trim(),
    [appliedFilters?.search]
  );

  // Build normalized AppliedFilterContext from current or overridden values
  const buildFilterPayload = React.useCallback(
    (overrides?: {
      startDate?: string;
      endDate?: string;
      branchIds?: string[];
      categoryIds?: string[];
      search?: string;
    }): AppliedFilterContext => {
      const nextStart = overrides?.startDate ?? startDate;
      const nextEnd = overrides?.endDate ?? endDate;
      const nextBranchStrings = overrides?.branchIds ?? selectedBranchIds;
      const nextCategoryStrings = overrides?.categoryIds ?? selectedCategoryIds;
      const nextSearch = (overrides?.search ?? search).trim();

      const branchNums = nextBranchStrings
        .map((id) => Number(id))
        .filter((n) => Number.isFinite(n) && n > 0);
      const categoryNums = nextCategoryStrings
        .map((id) => Number(id))
        .filter((n) => Number.isFinite(n) && n > 0);

      return {
        startDate: nextStart,
        endDate: nextEnd,
        branchIds: branchNums.length > 0 ? branchNums : undefined,
        categoryIds: categoryNums.length > 0 ? categoryNums : undefined,
        search: nextSearch || undefined,
      };
    },
    [startDate, endDate, selectedBranchIds, selectedCategoryIds, search]
  );

  // Apply Filters handler with spinner -> emerald check + toast feedback
  const handleApply = React.useCallback(async () => {
    if (!startDate || !endDate) {
      toast.error("Please select both a start date and an end date.");
      return;
    }
    if (startDate > endDate) {
      toast.error("Start date cannot be later than end date.");
      return;
    }

    setButtonState("apply", "loading");
    const ok = await applyFilters(buildFilterPayload());
    if (ok) {
      setButtonState("apply", "success");
      toast.success("Report filters applied", {
        description: `Window: ${startDate} to ${endDate}`,
      });
    } else {
      setButtonState("apply", "idle");
      toast.error("Failed to update report with selected filters.");
    }
  }, [startDate, endDate, applyFilters, buildFilterPayload, setButtonState]);

  // Date Preset click handler: updates range AND immediately applies with visual feedback
  const handleSelectPreset = React.useCallback(
    async (preset: DatePresetDefinition) => {
      const dates = preset.getRange();
      setStartDate(dates.start);
      setEndDate(dates.end);
      setLoadingPresetKey(preset.key);

      const ok = await applyFilters(
        buildFilterPayload({ startDate: dates.start, endDate: dates.end })
      );
      setLoadingPresetKey(null);

      if (ok) {
        toast.success(`Showing ${preset.label}`, {
          description: `${dates.start} to ${dates.end}`,
        });
      } else {
        toast.error(`Unable to load ${preset.label} report data.`);
      }
    },
    [applyFilters, buildFilterPayload]
  );

  // Reset Filters handler: restores default current-month window & clears all scopes
  const handleReset = React.useCallback(async () => {
    const defaultDates = getCurrentMonthToDate();
    setStartDate(defaultDates.start);
    setEndDate(defaultDates.end);
    setSelectedBranchIds([]);
    setSelectedCategoryIds([]);
    setSearch("");

    setButtonState("reset", "loading");
    const ok = await applyFilters({
      startDate: defaultDates.start,
      endDate: defaultDates.end,
    });

    if (ok) {
      setButtonState("reset", "success");
      toast.info("Filters reset to This Month");
    } else {
      setButtonState("reset", "idle");
      toast.error("Failed to reset report filters.");
    }
  }, [applyFilters, setButtonState]);

  // Clear search bar and re-apply if a search was currently applied
  const handleClearSearch = React.useCallback(async () => {
    setSearch("");
    if (appliedSearchTerm) {
      const ok = await applyFilters(buildFilterPayload({ search: "" }));
      if (ok) {
        toast.info("Search filter cleared");
      }
    }
  }, [appliedSearchTerm, applyFilters, buildFilterPayload]);

  // Refresh button handler with spinner -> emerald check + toast
  const handleRefresh = React.useCallback(async () => {
    setButtonState("refresh", "loading");
    const ok = await refresh();
    if (ok) {
      setButtonState("refresh", "success");
      toast.success("Report data refreshed");
    } else {
      setButtonState("refresh", "idle");
      toast.error("Could not refresh report data.");
    }
  }, [refresh, setButtonState]);

  // Excel Export handler with brief active transition -> emerald check + toast
  const handleExportExcel = React.useCallback(() => {
    if (!report || feedback.excel === "loading") return;
    setButtonState("excel", "loading");

    // Yield one frame so the loading state visibly paints before synchronous XLSX build
    window.setTimeout(() => {
      try {
        const filename = `customer-order-consumption-${report.filters.startDate}-to-${report.filters.endDate}.xlsx`;
        downloadCustomerOrderConsumptionExcel(report, filename);
        setButtonState("excel", "success");
        toast.success("Excel workbook downloaded", { description: filename });
      } catch (err) {
        console.error("[CustomerOrderConsumption] Excel export error:", err);
        setButtonState("excel", "idle");
        toast.error("Failed to export Excel workbook.");
      }
    }, 60);
  }, [report, feedback.excel, setButtonState]);

  // PDF Download handler with brief active transition -> emerald check + toast
  const handleExportPdf = React.useCallback(() => {
    if (!report || feedback.pdf === "loading") return;
    setButtonState("pdf", "loading");

    window.setTimeout(() => {
      try {
        const filename = `customer-order-consumption-${report.filters.startDate}-to-${report.filters.endDate}.pdf`;
        downloadCustomerOrderConsumptionPdf(report, filename);
        setButtonState("pdf", "success");
        toast.success("PDF report downloaded", { description: filename });
      } catch (err) {
        console.error("[CustomerOrderConsumption] PDF export error:", err);
        setButtonState("pdf", "idle");
        toast.error("Failed to generate PDF report.");
      }
    }, 60);
  }, [report, feedback.pdf, setButtonState]);

  // Print handler: opens print-ready landscape PDF preview (with browser print fallback)
  const handlePrint = React.useCallback(() => {
    if (!report || feedback.print === "loading") return;
    setButtonState("print", "loading");

    window.setTimeout(() => {
      try {
        const mode = printCustomerOrderConsumptionPdf(report);
        setButtonState("print", "success");
        toast.success(
          mode === "pdf_window" ? "Print preview opened" : "Print dialog opened",
          {
            description: "Formatted landscape A4 report ready for printing.",
          }
        );
      } catch (err) {
        console.error("[CustomerOrderConsumption] Print error:", err);
        setButtonState("print", "idle");
        toast.error("Failed to prepare printable report.");
      }
    }, 60);
  }, [report, feedback.print, setButtonState]);

  return (
    <Card className="relative overflow-hidden border bg-card/85 shadow-xs transition-all duration-300">
      {/* Top-edge indeterminate progress shimmer while a report query is running */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            key="filter-loading-bar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-primary/15"
          >
            <motion.div
              className="h-full w-1/3 rounded-full bg-primary"
              animate={{ x: ["-100%", "400%"] }}
              transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Row 1: Unified Toolbar Header (Quick Date Presets + Refresh / Export / Print Actions) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/35 px-3.5 py-2.5 sm:px-4">
        {/* Left Cluster: Section Label + Segmented Date Presets */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
            <SlidersHorizontal className="size-3.5 text-primary" />
            <span>Filters &amp; Period</span>
          </div>

          <div className="hidden h-4 w-px bg-border sm:block" />

          {/* Segmented Date Preset Pill Track */}
          <div
            role="group"
            aria-label="Quick reporting period presets"
            className="inline-flex items-center rounded-lg border bg-background/90 p-0.5 shadow-2xs"
          >
            {DATE_PRESETS.map((preset) => {
              const isActive = activePreset === preset.key;
              const isPresetLoading = loadingPresetKey === preset.key;

              return (
                <motion.button
                  key={preset.key}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  disabled={isLoading}
                  onClick={() => void handleSelectPreset(preset)}
                  className={cn(
                    "relative inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-60",
                    isActive
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="consumptionReportPresetPill"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-md bg-primary shadow-xs"
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-1">
                    {isPresetLoading && <Loader2 className="size-3 animate-spin" />}
                    <span className="hidden sm:inline">{preset.label}</span>
                    <span className="sm:hidden">{preset.shortLabel}</span>
                  </span>
                </motion.button>
              );
            })}
          </div>

          {!activePreset && startDate && endDate && (
            <Badge
              variant="outline"
              className="h-6 rounded-md border-dashed bg-background/70 px-2 text-[10px] font-medium text-muted-foreground"
            >
              Custom Range
            </Badge>
          )}
        </div>

        {/* Right Cluster: Refresh, Excel, PDF Actions inside the Filter Section */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleRefresh()}
            disabled={isLoading}
            className={cn(
              "h-8 gap-1.5 bg-background px-2.5 text-xs font-medium transition-all duration-150 active:scale-[0.96]",
              feedback.refresh === "success" &&
                "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400"
            )}
          >
            {feedback.refresh === "loading" ? (
              <RefreshCw className="size-3.5 animate-spin text-primary" />
            ) : feedback.refresh === "success" ? (
              <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <RefreshCw className="size-3.5 text-muted-foreground" />
            )}
            <span>
              {feedback.refresh === "loading"
                ? "Refreshing..."
                : feedback.refresh === "success"
                ? "Refreshed"
                : "Refresh"}
            </span>
          </Button>

          <div className="hidden h-4 w-px bg-border sm:block mx-0.5" />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={!report || feedback.excel === "loading"}
            className={cn(
              "h-8 gap-1.5 bg-background px-2.5 text-xs font-medium transition-all duration-150 active:scale-[0.96]",
              feedback.excel === "success" &&
                "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400"
            )}
          >
            {feedback.excel === "loading" ? (
              <Loader2 className="size-3.5 animate-spin text-emerald-600" />
            ) : feedback.excel === "success" ? (
              <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
            )}
            <span>
              {feedback.excel === "loading"
                ? "Exporting..."
                : feedback.excel === "success"
                ? "Saved"
                : "Excel"}
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={!report || feedback.pdf === "loading"}
            className={cn(
              "h-8 gap-1.5 bg-background px-2.5 text-xs font-medium transition-all duration-150 active:scale-[0.96]",
              feedback.pdf === "success" &&
                "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400"
            )}
          >
            {feedback.pdf === "loading" ? (
              <Loader2 className="size-3.5 animate-spin text-rose-600" />
            ) : feedback.pdf === "success" ? (
              <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <FileText className="size-3.5 text-rose-600" />
            )}
            <span>
              {feedback.pdf === "loading"
                ? "Preparing..."
                : feedback.pdf === "success"
                ? "Saved"
                : "PDF"}
            </span>
          </Button>
        </div>
      </div>

      {/* Row 2 & 3: Proportionate Filter Controls + Search Bar */}
      <CardContent className="space-y-3 p-3.5 sm:p-4">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-12">
          {/* Start Date */}
          <div className="space-y-1.5 lg:col-span-2">
            <label
              htmlFor="report-start-date"
              className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground"
            >
              <Calendar className="size-3 opacity-70" />
              Start Date
            </label>
            <Input
              id="report-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={cn(
                "h-9 w-full bg-background text-xs tabular-nums",
                isDateRangeInvalid && "border-destructive focus-visible:ring-destructive/30"
              )}
            />
          </div>

          {/* End Date */}
          <div className="space-y-1.5 lg:col-span-2">
            <label
              htmlFor="report-end-date"
              className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground"
            >
              <Calendar className="size-3 opacity-70" />
              End Date
            </label>
            <Input
              id="report-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={cn(
                "h-9 w-full bg-background text-xs tabular-nums",
                isDateRangeInvalid && "border-destructive focus-visible:ring-destructive/30"
              )}
            />
          </div>

          {/* Industrial Branch Searchable Multi-Select (division_id = 1) */}
          <div className="space-y-1.5 lg:col-span-3">
            <label className="block text-[11px] font-medium text-muted-foreground">
              Branch
            </label>
            <SearchableMultiSelect
              options={branches}
              selectedValues={selectedBranchIds}
              onChange={setSelectedBranchIds}
              placeholder="All Industrial Branches"
              searchPlaceholder="Search industrial branches..."
              emptyLabel="No matching branch found."
              isLoading={isOptionsLoading}
            />
          </div>

          {/* Industrial Cylinder Size Searchable Multi-Select (is_industrial = 1) */}
          <div className="space-y-1.5 lg:col-span-2">
            <label className="block text-[11px] font-medium text-muted-foreground">
              Cylinder Size
            </label>
            <SearchableMultiSelect
              options={categories}
              selectedValues={selectedCategoryIds}
              onChange={setSelectedCategoryIds}
              placeholder="All Cylinder Sizes"
              searchPlaceholder="Search cylinder sizes..."
              emptyLabel="No matching cylinder size found."
              isLoading={isOptionsLoading}
            />
          </div>

          {/* Primary Apply & Reset Action Group */}
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
            <Button
              type="button"
              onClick={() => void handleApply()}
              disabled={isLoading || !startDate || !endDate || isDateRangeInvalid}
              className={cn(
                "relative h-9 flex-1 gap-1.5 text-xs font-medium transition-all duration-150 active:scale-[0.97]",
                feedback.apply === "success" &&
                  "bg-emerald-600 text-white hover:bg-emerald-600",
                hasPendingChanges &&
                  feedback.apply !== "success" &&
                  "shadow-sm ring-2 ring-primary/25"
              )}
            >
              {feedback.apply === "loading" ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Applying...</span>
                </>
              ) : feedback.apply === "success" ? (
                <>
                  <Check className="size-3.5" />
                  <span>Applied</span>
                </>
              ) : (
                <>
                  <Filter className="size-3.5" />
                  <span>Apply Filters</span>
                  {hasPendingChanges && (
                    <span
                      title="Unapplied filter changes"
                      className="ml-0.5 inline-flex size-2 rounded-full bg-amber-300 animate-pulse"
                    />
                  )}
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleReset()}
              disabled={isLoading || !canReset}
              title="Reset all filters to This Month"
              className={cn(
                "h-9 shrink-0 gap-1.5 bg-background px-3 text-xs font-medium transition-all duration-150 active:scale-[0.96]",
                feedback.reset === "success" &&
                  "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400"
              )}
            >
              {feedback.reset === "loading" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : feedback.reset === "success" ? (
                <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <RotateCcw className="size-3.5 text-muted-foreground" />
              )}
              <span>
                {feedback.reset === "loading"
                  ? "Resetting..."
                  : feedback.reset === "success"
                  ? "Cleared"
                  : "Reset"}
              </span>
            </Button>
          </div>
        </div>

        {/* Inline Date Range Validation Alert */}
        {isDateRangeInvalid && (
          <div className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-[11px] font-medium text-destructive">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>Start date must be on or before the end date to apply filters.</span>
          </div>
        )}

        {/* Row 3: Search Input with Keyboard Submit Hint & Clear Action */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by customer name, customer code, store name, or product description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isLoading && !isDateRangeInvalid) {
                e.preventDefault();
                void handleApply();
              }
            }}
            className="h-9 bg-background pl-9 pr-24 text-xs"
          />

          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            {search.trim() !== appliedSearchTerm && search.trim().length > 0 && (
              <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
                Enter ↵
              </kbd>
            )}

            {search.length > 0 && (
              <button
                type="button"
                onClick={() => void handleClearSearch()}
                aria-label="Clear search query"
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
