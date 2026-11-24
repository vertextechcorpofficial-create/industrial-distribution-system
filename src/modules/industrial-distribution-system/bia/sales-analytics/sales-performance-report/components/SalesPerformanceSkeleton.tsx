// src/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/components/SalesPerformanceSkeleton.tsx
// ==============================================================================
// Sales Performance Report - Full Page Skeleton Loader
// Renders comprehensive pulse and skeleton placeholders for Header, Filters,
// KPI Cards, Visual Charts, and Results Table upon initial page mount.
// ==============================================================================

"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function SalesPerformanceSkeleton() {
  return (
    <div className="w-full min-w-0 space-y-4 animate-in fade-in duration-300">
      {/* 1. Header Skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border bg-card text-card-foreground shadow-xs">
        <div className="flex items-start gap-3">
          <Skeleton className="h-11 w-11 rounded-lg shrink-0" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-5 w-32 rounded-full" />
            </div>
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* 2. Filters Bar Skeleton */}
      <div className="space-y-3 p-4 rounded-xl border bg-card text-card-foreground shadow-xs">
        {/* Row 1: Search & Date Presets */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
            <Skeleton className="h-9 w-full sm:w-72 rounded-md" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-7 w-16 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-18 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>

        {/* Row 2: 5 Dropdown Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* 3. KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx} className="border shadow-xs overflow-hidden">
            <div className="h-1 bg-muted animate-pulse" />
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-36" />
              <div className="border-t pt-2 flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 4. Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend Area Chart (2 Cols) */}
        <Card className="lg:col-span-2 border shadow-xs">
          <CardHeader className="pb-2 space-y-1.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-72" />
          </CardHeader>
          <CardContent className="h-[280px] flex items-end gap-3 p-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end items-center gap-2 h-full">
                <Skeleton
                  className="w-full rounded-t-sm"
                  style={{ height: `${20 + ((i * 17) % 75)}%` }}
                />
                <Skeleton className="h-2.5 w-6" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Donut Chart (1 Col) */}
        <Card className="border shadow-xs">
          <CardHeader className="pb-2 space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-48" />
          </CardHeader>
          <CardContent className="h-[280px] flex flex-col items-center justify-center gap-4 p-6">
            <div className="relative flex items-center justify-center">
              <Skeleton className="h-40 w-40 rounded-full" />
              <div className="absolute h-24 w-24 rounded-full bg-card" />
            </div>
            <div className="grid grid-cols-2 gap-2 w-full pt-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. Results Table Skeleton */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {Array.from({ length: 10 }).map((_, idx) => (
                <TableHead key={idx} className="h-10">
                  <Skeleton className="h-3.5 w-16" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, rowIdx) => (
              <TableRow key={rowIdx}>
                {Array.from({ length: 10 }).map((_, colIdx) => (
                  <TableCell key={colIdx} className="py-3">
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
