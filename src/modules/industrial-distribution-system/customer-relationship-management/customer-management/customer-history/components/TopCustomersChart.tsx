"use client";

// ============================================================================
// Customer History — Top Customers by Net Sales Chart (Colorful Bars)
// ============================================================================

import * as React from "react";
import { motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { TopCustomerPoint } from "../types/customer-history.types";

const BAR_COLORS = [
  "#0ea5e9",
  "#2563eb",
  "#4f46e5",
  "#7c3aed",
  "#10b981",
  "#14b8a6",
  "#f59e0b",
  "#ec4899",
];

const chartConfig = {
  netSalesAmount: {
    label: "Net Sales",
    color: "#0ea5e9",
  },
} satisfies ChartConfig;

export function TopCustomersChart({ data }: { data: TopCustomerPoint[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.08 }}
    >
      <Card className="border-sky-200/70 shadow-sm dark:border-sky-900/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-sky-900 dark:text-sky-100">
            Top Industrial Customers
          </CardTitle>
          <CardDescription className="text-xs">
            Highest net sales (industrial invoices minus returns) in the applied range.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
              No customer sales to rank.
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[240px] w-full">
              <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis
                  dataKey="customerCode"
                  tickLine={false}
                  axisLine={false}
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
                <Bar dataKey="netSalesAmount" radius={[6, 6, 0, 0]} isAnimationActive>
                  {data.map((entry, idx) => (
                    <Cell
                      key={entry.customerCode}
                      fill={BAR_COLORS[idx % BAR_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
