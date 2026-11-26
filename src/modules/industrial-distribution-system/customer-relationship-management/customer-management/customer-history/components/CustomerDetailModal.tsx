"use client";

// ============================================================================
// Customer History — Customer Detail Modal
// Answers: "What has happened to this customer throughout their relationship?"
// Sections: Overview | Timeline | Transactions | Logistics | Notes | Audit Trail
// Note: All React hooks are called unconditionally at the top per ids-guide.
// ============================================================================

import * as React from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  FileText,
  History,
  Printer,
  StickyNote,
  Truck,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/utils";
import { useCustomerHistoryContext } from "../providers/CustomerHistoryProvider";
import {
  formatCurrencyOrDash,
  formatDateDisplay,
  formatDateTimeDisplay,
} from "../services/customer-history.helpers";
import type {
  ActivityTrendPoint,
  HistoryEvent,
} from "../types/customer-history.types";
import { ActivityTrendChart } from "./ActivityTrendChart";
import { CategoryMixChart } from "./CategoryMixChart";
import { DataTableLite, type DataTableColumn } from "./DataTableLite";

type DetailTab =
  | "overview"
  | "timeline"
  | "transactions"
  | "logistics"
  | "notes";

const DETAIL_TABS: {
  id: DetailTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "timeline", label: "Timeline", icon: History },
  { id: "transactions", label: "Transactions", icon: FileText },
  { id: "logistics", label: "Logistics", icon: Truck },
  { id: "notes", label: "Notes", icon: StickyNote },
];

function CustomerAvatar({
  imageId,
  name,
}: {
  imageId?: string | null;
  name: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const initials = name && name !== "-" ? name.trim().slice(0, 2).toUpperCase() : "-";

  if (imageId && !failed && process.env.NEXT_PUBLIC_API_BASE_URL) {
    return (
      <Image
        src={`${process.env.NEXT_PUBLIC_API_BASE_URL}/assets/${imageId}`}
        alt=""
        width={48}
        height={48}
        onError={() => setFailed(true)}
        className="h-12 w-12 shrink-0 rounded-lg border border-border/60 object-cover"
      />
    );
  }

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-sm font-semibold text-muted-foreground">
      {initials}
    </div>
  );
}

function ProfileRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-4 px-4 py-2">
      <dt className="w-32 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-sm font-medium text-foreground">
        {value ?? "-"}
      </dd>
    </div>
  );
}

export function CustomerDetailModal({
  onPrintCustomer,
}: {
  onPrintCustomer: () => void;
}) {
  const {
    detailOpen,
    closeCustomerDetail,
    detailData,
    isDetailLoading,
    detailError,
  } = useCustomerHistoryContext();

  const [activeTab, setActiveTab] = React.useState<DetailTab>("overview");
  const [timelineKindFilter, setTimelineKindFilter] = React.useState<string>("all");
  const [timelinePage, setTimelinePage] = React.useState(1);

  React.useEffect(() => {
    if (detailOpen) {
      setActiveTab("overview");
      setTimelineKindFilter("all");
      setTimelinePage(1);
    }
  }, [detailOpen]);

  // All hooks MUST run unconditionally before any conditional render
  const eventColumns = React.useMemo<
    DataTableColumn<HistoryEvent, "occurredAt" | "kind" | "reference" | "branchName" | "productSummary" | "amount" | "status">[]
  >(
    () => [
      {
        key: "occurredAt",
        header: "Date",
        title: "Event timestamp from source document",
        render: (e) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeDisplay(e.occurredAt)}
          </span>
        ),
      },
      {
        key: "kind",
        header: "Event",
        title: "Business event category and title",
        render: (e) => (
          <div>
            <p className="text-xs font-semibold text-foreground">{e.title}</p>
            <p className="text-[11px] uppercase text-muted-foreground">{e.kind}</p>
          </div>
        ),
      },
      {
        key: "reference",
        header: "Reference",
        title: "Document number, serial, or memo reference",
        render: (e) => (
          <span className="font-mono text-xs font-medium">{e.reference}</span>
        ),
      },
      {
        key: "branchName",
        header: "Branch",
        title: "Industrial branch (division_id = 1, isActive = 1)",
        render: (e) => <span className="text-xs">{e.branchName}</span>,
      },
      {
        key: "productSummary",
        header: "Product",
        title: "Parent serialized product description (products.description)",
        render: (e) => (
          <span className="block max-w-[200px] truncate text-xs" title={e.productSummary}>
            {e.productSummary}
          </span>
        ),
      },
      {
        key: "amount",
        header: "Amount",
        title: "Qualifying industrial line or payment amount",
        align: "right",
        render: (e) => (
          <span className="font-medium tabular-nums">
            {formatCurrencyOrDash(e.amount)}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        title: "Document status at source",
        align: "center",
        render: (e) => <Badge variant="outline">{e.status}</Badge>,
      },
    ],
    []
  );

  const eventSearchPredicate = React.useCallback(
    (e: HistoryEvent, q: string) =>
      e.title.toLowerCase().includes(q) ||
      e.reference.toLowerCase().includes(q) ||
      e.branchName.toLowerCase().includes(q) ||
      e.productSummary.toLowerCase().includes(q) ||
      e.status.toLowerCase().includes(q),
    []
  );

  const monthlyTrendPoints = React.useMemo<ActivityTrendPoint[]>(() => {
    if (!detailData) return [];
    return detailData.monthlySeries.map((m) => ({
      date: m.month,
      label: m.label,
      invoices: 0,
      payments: 0,
      returns: 0,
      salesAmount: m.salesAmount,
      paymentAmount: m.paymentAmount,
    }));
  }, [detailData]);

  const filteredTimeline = React.useMemo(() => {
    const list = detailData?.timeline ?? [];
    if (timelineKindFilter === "all") return list;
    return list.filter((e) => e.kind === timelineKindFilter);
  }, [detailData, timelineKindFilter]);

  const timelineTotalPages = Math.max(1, Math.ceil(filteredTimeline.length / 10));
  const pagedTimeline = React.useMemo(() => {
    const safePage = Math.min(timelinePage, timelineTotalPages);
    const start = (safePage - 1) * 10;
    return filteredTimeline.slice(start, start + 10);
  }, [filteredTimeline, timelinePage, timelineTotalPages]);

  const profile = detailData?.profile;
  const summary = detailData?.summary;

  return (
    <Dialog open={detailOpen} onOpenChange={(open) => !open && closeCustomerDetail()}>
      <DialogContent className="flex max-h-[90vh] w-[96vw] flex-col gap-0 overflow-hidden rounded-xl border-border/70 p-0 shadow-2xl sm:max-w-[1100px]">
        {/* Header */}
        <DialogHeader className="flex-row flex-wrap items-start justify-between gap-4 border-b border-blue-200/60 bg-gradient-to-r from-blue-50/60 via-background to-indigo-50/50 p-5 pr-12 text-left dark:border-blue-900/40 dark:from-blue-950/30 dark:to-indigo-950/20">
          <div className="flex min-w-0 items-start gap-3.5">
            <CustomerAvatar
              imageId={profile?.customerImage}
              name={profile?.customerName ?? "-"}
            />
            <div className="min-w-0">
              <DialogTitle className="truncate text-base font-bold tracking-tight text-blue-950 dark:text-blue-100">
                {profile?.customerName ?? (isDetailLoading ? "Loading customer..." : "-")}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                {profile
                  ? `${profile.customerCode} · ${profile.type} · Customer since ${formatDateDisplay(profile.dateEntered)}`
                  : "Industrial Customer History"}
              </DialogDescription>
              {profile && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge tone={profile.isActive === 1 ? "success" : "neutral"}>
                    {profile.isActive === 1 ? "Active" : "Inactive"}
                  </StatusBadge>
                  {profile.classificationName !== "-" && (
                    <Badge className="border-indigo-200 bg-indigo-50 text-[11px] text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300" variant="outline">
                      {profile.classificationName}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Print Button (uses browser default print dialog) */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={onPrintCustomer}
              disabled={!detailData}
              className="h-8 gap-1.5 bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
          </div>
        </DialogHeader>

        {/* Smooth animated tab bar */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border/60 bg-background px-5 pt-2">
          {DETAIL_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="customer-detail-tab-underline"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-background p-5">
          {isDetailLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : detailError ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive">
              {detailError}
            </div>
          ) : detailData && profile && summary ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                {activeTab === "overview" && (
                  <>
                    {/* Activity overview */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-xl border border-blue-200/70 border-l-4 border-l-blue-500 bg-blue-50/40 p-3.5 dark:bg-blue-950/20">
                        <p className="text-[11px] font-semibold text-muted-foreground">
                          Total Events
                        </p>
                        <p className="mt-1 text-xl font-bold text-blue-900 dark:text-blue-100">
                          {summary.totalTransactions}
                        </p>
                      </div>
                      <div className="rounded-xl border border-emerald-200/70 border-l-4 border-l-emerald-500 bg-emerald-50/40 p-3.5 dark:bg-emerald-950/20">
                        <p className="text-[11px] font-semibold text-muted-foreground">
                          Invoices / Payments
                        </p>
                        <p className="mt-1 text-xl font-bold text-emerald-900 dark:text-emerald-100">
                          {summary.invoiceCount} / {summary.paymentCount}
                        </p>
                      </div>
                      <div className="rounded-xl border border-amber-200/70 border-l-4 border-l-amber-500 bg-amber-50/40 p-3.5 dark:bg-amber-950/20">
                        <p className="text-[11px] font-semibold text-muted-foreground">
                          Returns
                        </p>
                        <p className="mt-1 text-xl font-bold text-amber-900 dark:text-amber-100">
                          {summary.returnCount}
                        </p>
                      </div>
                      <div className="rounded-xl border border-violet-200/70 border-l-4 border-l-violet-500 bg-violet-50/40 p-3.5 dark:bg-violet-950/20">
                        <p className="text-[11px] font-semibold text-muted-foreground">
                          Net Sales
                        </p>
                        <p className="mt-1 text-xl font-bold text-violet-700 dark:text-violet-300">
                          {formatCurrency(summary.netSalesAmount)}
                        </p>
                      </div>
                    </div>

                    {/* Graphs */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <ActivityTrendChart
                        data={monthlyTrendPoints}
                        title="Relationship Sales vs Payments"
                        description="Monthly industrial invoice sales vs payments."
                      />
                      <CategoryMixChart
                        data={detailData.categoryMix}
                        title="Customer Category Breakdown"
                        description="Count of industrial events per module."
                      />
                    </div>

                    {/* Profile Details */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <section className="overflow-hidden rounded-xl border border-border/60">
                        <h3 className="border-b bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Business & Contact
                        </h3>
                        <dl className="divide-y divide-border/50">
                          <ProfileRow label="Store Name" value={profile.storeName} />
                          <ProfileRow label="Signage" value={profile.storeSignage} />
                          <ProfileRow label="Store Type" value={profile.storeTypeName} />
                          <ProfileRow
                            label="Salesman"
                            value={
                              profile.salesmanName !== "-" && profile.salesmanCode !== "-"
                                ? `${profile.salesmanName} (${profile.salesmanCode})`
                                : profile.salesmanName
                            }
                          />
                          <ProfileRow label="Mobile" value={profile.contactNumber} />
                          <ProfileRow label="Landline" value={profile.telNumber} />
                          <ProfileRow label="Email" value={profile.customerEmail} />
                          <ProfileRow label="Address" value={profile.address} />
                        </dl>
                      </section>

                      <section className="overflow-hidden rounded-xl border border-border/60">
                        <h3 className="border-b bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Billing & Terms
                        </h3>
                        <dl className="divide-y divide-border/50">
                          <ProfileRow label="TIN" value={profile.customerTin} />
                          <ProfileRow
                            label="Tax Codes"
                            value={
                              <span className="flex gap-1.5">
                                <StatusBadge tone={profile.isVAT ? "info" : "neutral"}>
                                  {profile.isVAT ? "VAT" : "Non-VAT"}
                                </StatusBadge>
                                <StatusBadge tone={profile.isEWT ? "info" : "neutral"}>
                                  {profile.isEWT ? "EWT" : "No EWT"}
                                </StatusBadge>
                              </span>
                            }
                          />
                          <ProfileRow
                            label="Payment Terms"
                            value={
                              profile.paymentTerm !== null
                                ? `${profile.paymentTerm} days`
                                : "-"
                            }
                          />
                          <ProfileRow label="Price List" value={profile.priceType} />
                          <ProfileRow
                            label="Credit Limit"
                            value={formatCurrencyOrDash(profile.creditLimit)}
                          />
                          <ProfileRow label="Coordinates" value={profile.coordinates} />
                        </dl>
                      </section>
                    </div>
                  </>
                )}

                {activeTab === "timeline" && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {["all", "profile", "invoice", "pos", "order", "payment", "dispatch", "return", "serial", "consolidation", "memo"].map(
                        (kind) => (
                          <Button
                            key={kind}
                            type="button"
                            size="sm"
                            variant={timelineKindFilter === kind ? "default" : "outline"}
                            className="h-7 rounded-full px-3 text-xs capitalize"
                            onClick={() => {
                              setTimelineKindFilter(kind);
                              setTimelinePage(1);
                            }}
                          >
                            {kind}
                          </Button>
                        )
                      )}
                    </div>

                    {pagedTimeline.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/60 py-12 text-center text-sm text-muted-foreground">
                        No timeline events found for this filter.
                      </div>
                    ) : (
                      <ol className="relative ml-3 space-y-4 border-l border-border/70 pl-6">
                        {pagedTimeline.map((evt) => (
                          <li key={evt.id} className="relative">
                            <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                            <div className="rounded-xl border border-border/60 bg-card p-3.5 shadow-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-foreground">
                                    {evt.title}
                                  </span>
                                  <Badge variant="outline" className="text-[10px] uppercase">
                                    {evt.kind}
                                  </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {formatDateTimeDisplay(evt.occurredAt)}
                                </span>
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <span>
                                  Ref: <strong className="font-mono text-foreground">{evt.reference}</strong>
                                </span>
                                {evt.amount !== null && (
                                  <span>
                                    Amount:{" "}
                                    <strong className="text-foreground">
                                      {formatCurrency(evt.amount)}
                                    </strong>
                                  </span>
                                )}
                                <span>Branch: {evt.branchName}</span>
                                <span>Product: {evt.productSummary}</span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}

                    {timelineTotalPages > 1 && (
                      <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                        <span>
                          Page {timelinePage} of {timelineTotalPages} ({filteredTimeline.length} events)
                        </span>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={timelinePage <= 1}
                            onClick={() => setTimelinePage((p) => p - 1)}
                          >
                            Previous
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={timelinePage >= timelineTotalPages}
                            onClick={() => setTimelinePage((p) => p + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "transactions" && (
                  <div className="space-y-4">
                    <ActivityTrendChart
                      data={monthlyTrendPoints}
                      title="Transactions: Sales vs Payments"
                      description="Monthly industrial sales invoices and recorded payments."
                    />
                    <DataTableLite
                      rows={detailData.transactions}
                      columns={eventColumns}
                      rowKey={(e) => e.id}
                      searchPlaceholder="Search invoices, POS, orders, or payments..."
                      searchPredicate={eventSearchPredicate}
                      emptyTitle="No industrial transactions found"
                    />
                  </div>
                )}

                {activeTab === "logistics" && (
                  <DataTableLite
                    rows={detailData.logistics}
                    columns={eventColumns}
                    rowKey={(e) => e.id}
                    searchPlaceholder="Search dispatch, returns, serials, or consolidations..."
                    searchPredicate={eventSearchPredicate}
                    emptyTitle="No industrial logistics events found"
                  />
                )}

                {activeTab === "notes" && (
                  <DataTableLite
                    rows={detailData.notes}
                    columns={eventColumns}
                    rowKey={(e) => e.id}
                    searchPlaceholder="Search applied customer memos..."
                    searchPredicate={eventSearchPredicate}
                    emptyTitle="No applied industrial customer memos found"
                    emptyDescription="Only memos applied to an in-scope industrial invoice appear here."
                  />
                )}
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t bg-muted/20 px-5 py-3">
 
          <DialogClose asChild>
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs">
              Close
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
