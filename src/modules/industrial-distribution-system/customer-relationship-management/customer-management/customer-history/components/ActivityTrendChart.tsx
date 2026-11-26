"use client";

// ============================================================================
// Customer History — Activity Trend Chart (Vibrant Blue & Emerald)
// ============================================================================

import * as React from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { ActivityTrendPoint } from "../types/customer-history.types";

const chartConfig = {
  salesAmount: {
    label: "Sales Amount",
    color: "#2563eb",
  },
  paymentAmount: {
    label: "Payments",
    color: "#10b981",
  },
} satisfies ChartConfig;

export function ActivityTrendChart({
  data,
  title = "Sales & Payments Trend",
  description = "Industrial invoice sales vs recorded payments over the applied period.",
}: {
  data: ActivityTrendPoint[];
  title?: string;
  description?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="border-blue-200/70 shadow-sm dark:border-blue-900/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            {title}
          </CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
              No trend data for the applied filters.
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[240px] w-full">
              <AreaChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillSalesBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="fillPaymentsEmerald" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={11}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={70}
                  tickFormatter={(v) => formatCurrency(Number(v))}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Area
                  type="monotone"
                  dataKey="salesAmount"
                  stroke="#2563eb"
                  fill="url(#fillSalesBlue)"
                  strokeWidth={2.5}
                  isAnimationActive
                />
                <Area
                  type="monotone"
                  dataKey="paymentAmount"
                  stroke="#10b981"
                  fill="url(#fillPaymentsEmerald)"
                  strokeWidth={2.5}
                  isAnimationActive
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
