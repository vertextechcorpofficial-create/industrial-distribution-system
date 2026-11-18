// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/components/CustomerOrderConsumptionKpis.tsx
// ============================================================
// Executive KPI metric cards with smooth motion transitions.
// Channels kept distinct: Cylinder vs Metered LPG.
// ============================================================

"use client";

import * as React from "react";
import { motion, type Variants } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownRight,
  Cylinder,
  Flame,
  Layers,
  Scale,
  ShoppingBag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useCustomerOrderConsumptionReport } from "../hooks/useCustomerOrderConsumptionReport";
import {
  formatAmount,
  formatKgCompact,
  formatPercent,
  formatQty,
} from "../services/customer-order-consumption.helpers";

const kpiCardVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      delay: i * 0.05,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  }),
};

export function CustomerOrderConsumptionKpis({
  onOpenExceptions,
}: {
  onOpenExceptions?: () => void;
}): React.ReactElement {
  const { report } = useCustomerOrderConsumptionReport();

  const ov = report?.overview;
  const totalNetKg = (ov?.cylinder.netKg ?? 0) + (ov?.lpg.netKg ?? 0);
  const totalGrossKg = (ov?.cylinder.grossKg ?? 0) + (ov?.lpg.grossKg ?? 0);
  const totalReturnedKg = (ov?.cylinder.returnedKg ?? 0) + (ov?.lpg.returnedKg ?? 0);
  const overallReturnRate = totalGrossKg > 0 ? (totalReturnedKg * 100) / totalGrossKg : 0;
  const overallAvgOrderKg = (ov?.totalOrders ?? 0) > 0 ? totalNetKg / (ov?.totalOrders ?? 1) : 0;

  if (!ov) return <></>;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {/* 1. Total Net Purchased Kg */}
      <motion.div
        custom={0}
        variants={kpiCardVariants}
        initial="hidden"
        animate="visible"
        whileHover={{ y: -2, transition: { duration: 0.15 } }}
      >
        <Card className="p-3.5 shadow-none border bg-card hover:shadow-xs transition-shadow">
          <CardContent className="p-0 space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Net Purchased Weight</span>
              <Scale className="size-4 text-primary" />
            </div>
            <div className="text-xl font-bold tabular-nums tracking-tight">
              {formatKgCompact(totalNetKg)}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
              <span className="flex items-center gap-0.5 text-blue-600 font-medium">
                <Cylinder className="size-3" />
                {formatKgCompact(ov.cylinder.netKg)}
              </span>
              <span>·</span>
              <span className="flex items-center gap-0.5 text-amber-600 font-medium">
                <Flame className="size-3" />
                {formatKgCompact(ov.lpg.netKg)}
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 2. Total Order Frequency */}
      <motion.div
        custom={1}
        variants={kpiCardVariants}
        initial="hidden"
        animate="visible"
        whileHover={{ y: -2, transition: { duration: 0.15 } }}
      >
        <Card className="p-3.5 shadow-none border bg-card hover:shadow-xs transition-shadow">
          <CardContent className="p-0 space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Order Frequency</span>
              <ShoppingBag className="size-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold tabular-nums tracking-tight">
              {formatQty(ov.totalOrders)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Across {ov.totalCustomers} active customer accounts
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* 3. Average Order Size */}
      <motion.div
        custom={2}
        variants={kpiCardVariants}
        initial="hidden"
        animate="visible"
        whileHover={{ y: -2, transition: { duration: 0.15 } }}
      >
        <Card className="p-3.5 shadow-none border bg-card hover:shadow-xs transition-shadow">
          <CardContent className="p-0 space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Avg Order Size</span>
              <Layers className="size-4 text-indigo-600" />
            </div>
            <div className="text-xl font-bold tabular-nums tracking-tight">
              {formatKgCompact(overallAvgOrderKg)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Cylinder: {formatKgCompact(ov.cylinder.avgOrderSizeKg)} / event
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* 4. Returns & Return Rate */}
      <motion.div
        custom={3}
        variants={kpiCardVariants}
        initial="hidden"
        animate="visible"
        whileHover={{ y: -2, transition: { duration: 0.15 } }}
      >
        <Card className="p-3.5 shadow-none border bg-card hover:shadow-xs transition-shadow">
          <CardContent className="p-0 space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Returns Deducted</span>
              <ArrowDownRight className="size-4 text-rose-600" />
            </div>
            <div className="text-xl font-bold tabular-nums tracking-tight text-rose-600">
              {formatKgCompact(totalReturnedKg)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{formatQty(ov.cylinder.returnedQty)} pieces returned</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 text-rose-600 border-rose-200">
                {formatPercent(overallReturnRate)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 5. Data Exceptions */}
      <motion.div
        custom={4}
        variants={kpiCardVariants}
        initial="hidden"
        animate="visible"
        whileHover={{ y: -2, transition: { duration: 0.15 } }}
      >
        <Card
          onClick={onOpenExceptions}
          className={`p-3.5 shadow-none border cursor-pointer transition-all ${
            ov.exceptionCount > 0 ? "border-amber-300 bg-amber-50/20 hover:bg-amber-50/40" : "bg-card hover:bg-muted/40"
          }`}
        >
          <CardContent className="p-0 space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Data Exceptions</span>
              <AlertTriangle className={`size-4 ${ov.exceptionCount > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
            </div>
            <div className="text-xl font-bold tabular-nums tracking-tight">
              {ov.exceptionCount}
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              {ov.exceptionCount > 0 ? "Click to inspect flagged items" : "All records verified"}
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
