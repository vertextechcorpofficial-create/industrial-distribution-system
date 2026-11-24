/**
 * Skeleton Pulse Loader Component for Warehouse Efficiency Intelligence Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Pulsing skeleton placeholders for AI Executive banner, 4 KPI cards, and results data table
 * - Eliminates layout shift and blank content during async data fetching
 */

'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const WarehouseEfficiencySkeleton: React.FC = () => {
    return (
        <div className="space-y-6 animate-pulse">
            {/* AI Insights Banner Skeleton */}
            <div className="bg-card border rounded-lg p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-7 w-7 rounded-full" />
                        <Skeleton className="h-4 w-48 rounded" />
                        <Skeleton className="h-4 w-16 rounded" />
                    </div>
                    <Skeleton className="h-7 w-32 rounded" />
                </div>
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-3/4 rounded" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t">
                    <Skeleton className="h-3 w-full rounded" />
                    <Skeleton className="h-3 w-full rounded" />
                    <Skeleton className="h-3 w-full rounded" />
                </div>
            </div>

            {/* KPI Summary Cards Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-card border rounded-lg p-4 shadow-xs flex items-start justify-between">
                        <div className="space-y-2">
                            <Skeleton className="h-3 w-28 rounded" />
                            <Skeleton className="h-8 w-24 rounded" />
                            <Skeleton className="h-3 w-36 rounded" />
                        </div>
                        <Skeleton className="h-10 w-10 rounded-md" />
                    </div>
                ))}
            </div>

            {/* Calculation Notice Skeleton */}
            <div className="bg-muted/30 border rounded px-3 py-2 flex items-center justify-between">
                <Skeleton className="h-3 w-64 rounded" />
                <Skeleton className="h-3 w-36 rounded" />
            </div>

            {/* Results Grid Skeleton */}
            <div className="bg-card border rounded-lg overflow-hidden shadow-xs space-y-0">
                {/* Table Header Skeleton */}
                <div className="h-10 bg-muted/40 border-b flex items-center px-4 gap-4 justify-between">
                    <Skeleton className="h-3.5 w-36 rounded" />
                    <Skeleton className="h-3.5 w-16 rounded" />
                    <Skeleton className="h-3.5 w-24 rounded" />
                    <Skeleton className="h-3.5 w-20 rounded" />
                    <Skeleton className="h-3.5 w-16 rounded" />
                    <Skeleton className="h-3.5 w-16 rounded" />
                    <Skeleton className="h-3.5 w-20 rounded" />
                    <Skeleton className="h-3.5 w-24 rounded" />
                </div>

                {/* Table Rows Skeleton */}
                <div className="divide-y divide-border/60">
                    {Array.from({ length: 7 }).map((_, rowIdx) => (
                        <div key={rowIdx} className="h-14 px-4 flex items-center justify-between gap-4">
                            <div className="space-y-1.5 w-36">
                                <Skeleton className="h-3.5 w-28 rounded" />
                                <Skeleton className="h-2.5 w-20 rounded" />
                            </div>
                            <Skeleton className="h-5 w-20 rounded-full" />
                            <div className="space-y-1 text-right w-24 flex flex-col items-end">
                                <Skeleton className="h-3.5 w-12 rounded" />
                                <Skeleton className="h-2.5 w-16 rounded" />
                            </div>
                            <Skeleton className="h-3.5 w-16 rounded" />
                            <Skeleton className="h-3.5 w-12 rounded" />
                            <Skeleton className="h-3.5 w-12 rounded" />
                            <Skeleton className="h-3.5 w-12 rounded" />
                            <Skeleton className="h-5 w-24 rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
