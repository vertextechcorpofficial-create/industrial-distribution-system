// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/components/ReportState.tsx
// ============================================================
// State boundaries: skeletons, empty states, error fallbacks, and prompt states.
// ============================================================

import * as React from "react";
import { AlertCircle, AlertTriangle, ArrowRight, FileQuestion, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ReportSkeleton(): React.ReactElement {
  return (
    <div className="space-y-4">
      {/* KPI Cards Skeletons */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-7 w-32 mb-1" />
            <Skeleton className="h-3 w-16" />
          </Card>
        ))}
      </div>

      {/* Main Table Skeleton */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}

export function ReportEmptyState(): React.ReactElement {
  return (
    <Card className="border-dashed py-12 text-center">
      <CardContent className="flex flex-col items-center justify-center space-y-3">
        <div className="rounded-full bg-muted p-3">
          <FileQuestion className="size-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">No Demand Records Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            No sales orders, fulfilled invoices, or LPG site consumptions were recorded for the selected period and branch filters.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReportPromptState(): React.ReactElement {
  return (
    <Card className="border-dashed py-12 text-center">
      <CardContent className="flex flex-col items-center justify-center space-y-3">
        <div className="rounded-full bg-primary/10 p-3">
          <ArrowRight className="size-8 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Select Reporting Period & Filters</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            Choose a date range and authorized branch above, then click &ldquo;Apply Filters&rdquo; to generate the customer order and consumption assessment.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReportErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}): React.ReactElement {
  return (
    <Card className="border-destructive/40 bg-destructive/5 p-6 text-center">
      <CardContent className="flex flex-col items-center justify-center space-y-3 p-0">
        <div className="rounded-full bg-destructive/10 p-3">
          <AlertCircle className="size-8 text-destructive" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-destructive">Unable to Build Report</h3>
          <p className="text-xs text-muted-foreground max-w-md">{message}</p>
        </div>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
            <RefreshCw className="size-3.5" />
            Retry Report
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ReportQuietState({
  title,
  message,
}: {
  title: string;
  message: string;
}): React.ReactElement {
  return (
    <Card className="border-dashed py-10 text-center">
      <CardContent className="flex flex-col items-center justify-center space-y-2">
        <div className="rounded-full bg-muted p-2.5">
          <AlertTriangle className="size-6 text-muted-foreground" />
        </div>
        <h4 className="text-sm font-medium">{title}</h4>
        <p className="text-xs text-muted-foreground max-w-md">{message}</p>
      </CardContent>
    </Card>
  );
}
