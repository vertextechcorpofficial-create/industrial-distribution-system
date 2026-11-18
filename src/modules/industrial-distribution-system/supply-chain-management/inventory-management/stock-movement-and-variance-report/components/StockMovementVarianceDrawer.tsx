// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/components/StockMovementVarianceDrawer.tsx
// ==============================================================================
// Supporting-Record Slide-Over Panel (spec §2 "drill into supporting records").
// Shows the ledger documents behind a line, the count it was measured against and
// retained adjustment references. Every figure is read-only evidence; correcting
// anything happens in the originating module.
// ==============================================================================

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  FileClock,
  Ruler,
  Scale,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStockMovementVarianceReport } from "../hooks/useStockMovementVarianceReport";
import type { SupportingDocument } from "../types/stock-movement-variance.types";
import { formatPhDateTime, formatQty, formatSigned } from "../services/stock-movement-variance.calc";

/** Compact labelled figure used across the panel header. */
function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "short" | "over" | "muted";
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-2.5 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums",
          tone === "short" && "text-red-600 dark:text-red-400",
          tone === "over" && "text-amber-600 dark:text-amber-400",
          tone === "muted" && "text-muted-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * One ledger document card in the Supporting Records drawer.
 * Layout places the document identifier & timestamp on the left, and anchors
 * the document type (top-right) directly above prominent, color-coded quantity
 * badges (bottom-right) so quantities are scannable at a glance rather than
 * cramped inline beside the timestamp.
 * `muted` marks movement booked after the count cutoff (outside Expected).
 */
function DocumentRow({ doc, muted }: { doc: SupportingDocument; muted?: boolean }) {
  const hasQuantities = Boolean(doc.inBase || doc.outBase || doc.countAdjustment);

  return (
    <li
      className={cn(
        "rounded-lg border px-3 py-2.5 transition-colors",
        muted ? "border-dashed bg-background" : "bg-muted/20"
      )}
    >
      {/* Top row: Document reference (left) & Document type label (right) */}
      <div className="flex items-start justify-between gap-3">
        <span className="truncate text-xs font-semibold text-foreground">{doc.label}</span>
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {doc.docType}
        </span>
      </div>

      {/* Bottom row: Timestamp cleanly isolated (left) & prominent quantity badges (right) */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground">
          <FileClock className="h-3.5 w-3.5 shrink-0" />
          <span>{formatPhDateTime(doc.ts)}</span>
        </span>

        {hasQuantities ? (
          <div
            className={cn(
              "flex shrink-0 flex-wrap items-center justify-end gap-1.5",
              muted && "opacity-80"
            )}
          >
            {doc.inBase ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-300">
                <ArrowDownLeft className="h-3 w-3 shrink-0" />
                <span>In {formatQty(doc.inBase)}</span>
              </span>
            ) : null}

            {doc.outBase ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-orange-700 dark:border-orange-500/35 dark:bg-orange-500/15 dark:text-orange-300">
                <ArrowUpRight className="h-3 w-3 shrink-0" />
                <span>Out {formatQty(doc.outBase)}</span>
              </span>
            ) : null}

            {doc.countAdjustment ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-sky-700 dark:border-sky-500/35 dark:bg-sky-500/15 dark:text-sky-300">
                <Scale className="h-3 w-3 shrink-0" />
                <span>Restated {formatSigned(doc.countAdjustment)}</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function StockMovementVarianceDrawer() {
  const { selectedRow, closeRowDetail } = useStockMovementVarianceReport();

  // Escape always closes the panel.
  React.useEffect(() => {
    if (!selectedRow) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRowDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedRow, closeRowDetail]);

  return (
    <AnimatePresence>
      {selectedRow ? (
        <motion.div
          key="variance-drawer"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex justify-end overflow-hidden"
        >
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeRowDetail}
            className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
          />

          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 260 }}
            className="relative flex h-full w-full max-w-xl flex-col border-l bg-card shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={`Supporting records for ${selectedRow.productName}`}
          >
            {/* ── Panel header ─────────────────────────────────────────────── */}
            <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Supporting records
                </p>
                <h2 className="truncate text-sm font-semibold">{selectedRow.productName}</h2>
                <p className="truncate text-[11px] text-muted-foreground">
                  {selectedRow.productCode ?? `ID ${selectedRow.productId}`} ·{" "}
                  {selectedRow.branchName || `Branch #${selectedRow.branchId}`} · unit factor{" "}
                  {formatQty(selectedRow.unitCount)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeRowDetail}
                aria-label="Close supporting records"
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* ── Reconciliation arithmetic ────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2 border-b px-4 py-3 sm:grid-cols-6">
              <Metric label="Opening" value={formatQty(selectedRow.openingBalance)} />
              <Metric label="In" value={formatQty(selectedRow.periodIn)} />
              <Metric label="Out" value={formatQty(selectedRow.periodOut)} />
              <Metric label="Expected" value={formatQty(selectedRow.expectedClosing)} />
              <Metric
                label="Counted"
                value={formatQty(selectedRow.countedClosing)}
                tone={selectedRow.countedClosing === null ? "muted" : undefined}
              />
              <Metric
                label="Variance"
                value={formatSigned(selectedRow.variance)}
                tone={
                  selectedRow.variance === null
                    ? "muted"
                    : selectedRow.variance < 0
                      ? "short"
                      : selectedRow.variance > 0
                        ? "over"
                        : undefined
                }
              />
            </div>

            {/* ── Count document ───────────────────────────────────────────── */}
            <div className="border-b px-4 py-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold">
                <Ruler className="h-3.5 w-3.5 text-primary" />
                <span>Physical count</span>
              </p>
              {selectedRow.countDocNo ? (
                <div className="space-y-1 text-[11px]">
                  <p>
                    <span className="font-medium">{selectedRow.countDocNo}</span> · cutoff{" "}
                    {formatPhDateTime(selectedRow.countCutoffDate)}
                    {selectedRow.countInPeriod ? "" : " · before this period"}
                  </p>
                  {selectedRow.countInPeriod ? (
                    <p className="text-muted-foreground">
                      Count sheet recorded system {formatQty(selectedRow.countSystemQty)} and its own
                      variance of {formatSigned(selectedRow.countSourceVariance)} base units. This
                      report compares the count against the movement ledger instead, so a difference
                      between the two is itself the finding.
                    </p>
                  ) : (
                    // The count measured another day, so using it here would publish
                    // every movement since then as this period's variance.
                    <p className="text-muted-foreground">
                      This count was taken before the period started, so it is shown for reference
                      only and is not this period&apos;s counted figure — movement booked since it
                      was taken would otherwise appear here as variance.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  No committed physical count covers this product at the selected cutoff, so no
                  counted figure exists and variance is undefined. Counting is performed in the
                  Physical Inventory module.
                </p>
              )}
            </div>

            {/* ── Supporting documents ───────────────────────────────────── */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold">
                <ClipboardList className="h-3.5 w-3.5 text-primary" />
                <span>Documents ({selectedRow.supportingDocuments.length})</span>
              </p>

              {selectedRow.supportingDocuments.length === 0 &&
              selectedRow.documentsAfterCount.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  No posted movement is included in this line&apos;s Expected figure.
                </p>
              ) : (
                <>
                  {selectedRow.supportingDocuments.length > 0 && (
                    <ul className="space-y-2">
                      {selectedRow.supportingDocuments.map((doc, index) => (
                        <DocumentRow key={`${doc.docNo}-${index}`} doc={doc} />
                      ))}
                    </ul>
                  )}

                  {/* Stock that arrived after the sheet was cut is named here rather
                      than left out, so the line does not read as having received
                      nothing. It stays outside Expected and the variance. */}
                  {selectedRow.documentsAfterCount.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-1 text-[11px] font-semibold text-muted-foreground">
                        After the count ({selectedRow.documentsAfterCount.length})
                      </p>
                      <p className="mb-2 text-[11px] text-muted-foreground">
                        Booked after this count, so it is real stock but outside Expected.
                      </p>
                      <ul className="space-y-2">
                        {selectedRow.documentsAfterCount.map((doc, index) => (
                          <DocumentRow key={`${doc.docNo}-${index}`} doc={doc} muted />
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
