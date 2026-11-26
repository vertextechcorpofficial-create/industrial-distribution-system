"use client";

// ============================================================================
// Customer History — Colorful KPI Summary Strip
// ============================================================================

import * as React from "react";
import { motion } from "framer-motion";
import { Users, FileText, CreditCard, RotateCcw, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { CustomerHistoryKpis } from "../types/customer-history.types";

interface KpiItem {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  cardTone: string;
  iconBg: string;
  iconColor: string;
  valueColor: string;
}

export function KpiStrip({
  kpis,
  isLoading,
}: {
  kpis: CustomerHistoryKpis | null | undefined;
  isLoading: boolean;
}) {
  const items: KpiItem[] = React.useMemo(() => {
    const base = [
      {
        label: "Active Customers",
        value: kpis ? formatNumber(kpis.totalCustomers, "en-PH", 0) : "-",
        icon: Users,
        cardTone: "border-l-4 border-l-blue-500 border-blue-200/70 bg-blue-50/40 dark:bg-blue-950/20",
        iconBg: "bg-blue-100 dark:bg-blue-900/50",
        iconColor: "text-blue-600 dark:text-blue-300",
        valueColor: "text-blue-900 dark:text-blue-100",
      },
      {
        label: "Sales Invoices",
        value: kpis ? formatNumber(kpis.totalInvoices, "en-PH", 0) : "-",
        icon: FileText,
        cardTone: "border-l-4 border-l-indigo-500 border-indigo-200/70 bg-indigo-50/40 dark:bg-indigo-950/20",
        iconBg: "bg-indigo-100 dark:bg-indigo-900/50",
        iconColor: "text-indigo-600 dark:text-indigo-300",
        valueColor: "text-indigo-900 dark:text-indigo-100",
      },
      {
        label: "Payments Recorded",
        value: kpis ? formatNumber(kpis.totalPayments, "en-PH", 0) : "-",
        icon: CreditCard,
        cardTone: "border-l-4 border-l-emerald-500 border-emerald-200/70 bg-emerald-50/40 dark:bg-emerald-950/20",
        iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
        iconColor: "text-emerald-600 dark:text-emerald-300",
        valueColor: "text-emerald-900 dark:text-emerald-100",
      },
      {
        label: "Returns",
        value: kpis ? formatNumber(kpis.totalReturns, "en-PH", 0) : "-",
        icon: RotateCcw,
        cardTone: "border-l-4 border-l-amber-500 border-amber-200/70 bg-amber-50/40 dark:bg-amber-950/20",
        iconBg: "bg-amber-100 dark:bg-amber-900/50",
        iconColor: "text-amber-600 dark:text-amber-300",
        valueColor: "text-amber-900 dark:text-amber-100",
      },
      {
        label: "Net Industrial Sales",
        value: kpis ? formatCurrency(kpis.netSalesAmount) : "-",
        icon: TrendingUp,
        cardTone: "border-l-4 border-l-violet-500 border-violet-200/70 bg-violet-50/40 dark:bg-violet-950/20",
        iconBg: "bg-violet-100 dark:bg-violet-900/50",
        iconColor: "text-violet-600 dark:text-violet-300",
        valueColor: "text-violet-900 dark:text-violet-100",
      },
    ];
    return base;
  }, [kpis]);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: idx * 0.03 }}
          >
            <Card className={`shadow-sm transition-shadow hover:shadow-md ${item.cardTone}`}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-muted-foreground">
                    {item.label}
                  </p>
                  {isLoading ? (
                    <Skeleton className="mt-1.5 h-6 w-20" />
                  ) : (
                    <p className={`mt-0.5 truncate text-lg font-bold tracking-tight ${item.valueColor}`}>
                      {item.value}
                    </p>
                  )}
                </div>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.iconBg}`}>
                  <Icon className={`h-4 w-4 ${item.iconColor}`} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
