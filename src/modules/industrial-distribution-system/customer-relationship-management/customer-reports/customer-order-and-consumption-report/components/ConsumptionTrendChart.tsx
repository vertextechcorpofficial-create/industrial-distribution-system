// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/components/ConsumptionTrendChart.tsx
// ============================================================
// Interactive Monthly Trend & Consumption Distribution Analytics.
// Powered by Recharts with smooth 500ms easing animations.
// ============================================================

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCustomerOrderConsumptionReport } from "../hooks/useCustomerOrderConsumptionReport";
import { formatKgCompact, formatQty } from "../services/customer-order-consumption.helpers";

const COLORS = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
];

const EMPTY_TREND: never[] = [];
const EMPTY_ROWS: never[] = [];

export function ConsumptionTrendChart(): React.ReactElement {
  const { report } = useCustomerOrderConsumptionReport();

  const monthlyTrend = report?.monthlyTrend ?? EMPTY_TREND;
  const rows = report?.rows ?? EMPTY_ROWS;

  // All hooks declared unconditionally before any early returns per ids-guide
  const trendData = React.useMemo(() => {
    const map = new Map<
      string,
      {
        month: string;
        cylinderKg: number;
        lpgKg: number;
        totalNetKg: number;
        orderKeys: Set<string>;
        orderCount: number;
      }
    >();

    for (const pt of monthlyTrend) {
      let entry = map.get(pt.yearMonth);
      if (!entry) {
        entry = {
          month: pt.yearMonth,
          cylinderKg: 0,
          lpgKg: 0,
          totalNetKg: 0,
          orderKeys: new Set<string>(),
          orderCount: 0,
        };
        map.set(pt.yearMonth, entry);
      }
      if (pt.channel === "CYLINDER") {
        entry.cylinderKg += pt.netKg;
      } else {
        entry.lpgKg += pt.netKg;
      }
      entry.totalNetKg += pt.netKg;
      // Dedupe distinct order keys across CYLINDER and LPG channels in the same month
      if (pt.orderKeys && pt.orderKeys.length > 0) {
        for (const k of pt.orderKeys) entry.orderKeys.add(k);
        entry.orderCount = entry.orderKeys.size;
      } else {
        entry.orderCount += pt.orderCount;
      }
    }

    // Project explicit fields so internal orderKeys Set is excluded without unused destructuring bindings
    return [...map.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((entry) => ({
        month: entry.month,
        cylinderKg: Math.round(entry.cylinderKg * 100) / 100,
        lpgKg: Math.round(entry.lpgKg * 100) / 100,
        totalNetKg: Math.round(entry.totalNetKg * 100) / 100,
        orderCount: entry.orderCount,
      }));
  }, [monthlyTrend]);

  // Cylinder size breakdown across all industrial parent products (strictly positive volumes)
  const sizeBreakdown = React.useMemo(() => {
    const sizeMap = new Map<string, number>();

    for (const r of rows) {
      for (const p of r.products) {
        if (p.cylinderSizeKg && p.netKg > 0.001) {
          const label = `${p.cylinderSizeKg} kg`;
          sizeMap.set(label, (sizeMap.get(label) ?? 0) + p.netKg);
        }
      }
    }

    return [...sizeMap.entries()]
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  // Total cylinder net weight for precise percentage formatting across all slices
  const totalCylinderKg = React.useMemo(() => {
    return sizeBreakdown.reduce((sum, item) => sum + item.value, 0);
  }, [sizeBreakdown]);

  if (!report) return <></>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Monthly Net Kg vs Order Count Trend */}
      <motion.div
        className="lg:col-span-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        <Card className="shadow-none border bg-card">
          <CardHeader className="p-4 pb-2 border-b">
            <CardTitle className="text-sm font-semibold">
              Monthly Net Consumption Volume vs. Order Frequency
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Dual-axis monthly time-series tracking net purchased kilograms and distinct order occurrences.
            </p>
          </CardHeader>
          <CardContent className="p-4 pt-6">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(val) => {
                      const num = Number(val) || 0;
                      if (Math.abs(num) >= 1000) {
                        const tons = num / 1000;
                        return `${Number.isInteger(tons) ? tons : tons.toFixed(1)}t`;
                      }
                      return `${Math.round(num)} kg`;
                    }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(val) => `${val}`}
                  />
                  <Tooltip
                    // Let Recharts infer formatter value/name types to avoid explicit any
                    formatter={(val, name) => {
                      const num = typeof val === "number" ? val : Number(val ?? 0);
                      const label = name !== undefined ? String(name) : "Weight";
                      if (label === "Order Frequency") return [formatQty(num), label];
                      return [formatKgCompact(num), label];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="cylinderKg"
                    name="Cylinder Net Kg"
                    fill="#2563eb"
                    radius={[4, 4, 0, 0]}
                    animationDuration={500}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="lpgKg"
                    name="Metered / WIWO LPG Net Kg"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                    animationDuration={500}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="orderCount"
                    name="Order Frequency"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    animationDuration={500}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Industrial Cylinder Sizing Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: 0.08, ease: "easeOut" }}
      >
        <Card className="shadow-none border bg-card">
          <CardHeader className="p-4 pb-2 border-b">
            <CardTitle className="text-sm font-semibold">
              Cylinder Size Distribution
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Purchased weight split by industrial cylinder category size.
            </p>
          </CardHeader>
          <CardContent className="p-4 pt-6 flex flex-col items-center justify-center">
            {sizeBreakdown.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-xs text-muted-foreground">
                No cylinder size data in this window.
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sizeBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      outerRadius={82}
                      innerRadius={44}
                      paddingAngle={2}
                      minAngle={5}
                      labelLine
                      animationDuration={500}
                    >
                      {sizeBreakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    {/* Tooltip shows exact kilograms and precise share percentage */}
                    <Tooltip
                      formatter={(val, name) => {
                        const num = Number(val) || 0;
                        const pct = totalCylinderKg > 0 ? (num / totalCylinderKg) * 100 : 0;
                        const pctStr = pct < 0.1 ? "<0.1%" : `${pct.toFixed(1)}%`;
                        return [`${formatKgCompact(num)} (${pctStr})`, `${name}`];
                      }}
                    />
                    {/* Legend clearly lists every segment with its exact share so small slices remain fully readable without overlap */}
                    <Legend
                      wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                      formatter={(value, entry) => {
                        const val = Number(entry?.payload?.value) || 0;
                        const pct = totalCylinderKg > 0 ? (val / totalCylinderKg) * 100 : 0;
                        const pctStr = pct < 0.1 ? "<0.1%" : `${pct.toFixed(1)}%`;
                        return (
                          <span className="text-xs font-medium text-foreground">
                            {value}{" "}
                            <span className="text-muted-foreground font-normal">({pctStr})</span>
                          </span>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
