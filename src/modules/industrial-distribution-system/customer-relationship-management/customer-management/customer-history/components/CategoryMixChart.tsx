"use client";

// ============================================================================
// Customer History — Category Mix Bar Chart (Multi-color per category)
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
import type { CategoryMixPoint } from "../types/customer-history.types";

const PALETTE = [
  "#2563eb", // blue
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#6366f1", // indigo
  "#14b8a6", // teal
];

const chartConfig = {
  count: {
    label: "Events",
    color: "#8b5cf6",
  },
} satisfies ChartConfig;

export function CategoryMixChart({
  data,
  title = "Activity by Category",
  description = "Distribution of industrial events across verified modules.",
}: {
  data: CategoryMixPoint[];
  title?: string;
  description?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.04 }}
    >
      <Card className="border-violet-200/70 shadow-sm dark:border-violet-900/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-violet-900 dark:text-violet-100">
            {title}
          </CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
              No category activity recorded.
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[240px] w-full">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ left: 12, right: 16, top: 4, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={105}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} isAnimationActive>
                  {data.map((entry, idx) => (
                    <Cell key={entry.kind} fill={PALETTE[idx % PALETTE.length]} />
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
