/**
 * Results Grid Component for Warehouse Efficiency Intelligence Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 */

'use client';

import React from 'react';
import { WarehouseEfficiencyRow } from '../types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

interface ResultsGridProps {
    rows: WarehouseEfficiencyRow[];
    onSelectRow: (row: WarehouseEfficiencyRow) => void;
    isLoading: boolean;
}

export const ResultsGrid: React.FC<ResultsGridProps> = ({
    rows,
    onSelectRow,
    isLoading,
}) => {
    if (isLoading) {
        return (
            <div className="bg-card border rounded-lg p-12 text-center text-sm text-muted-foreground">
                Loading warehouse operational metrics...
            </div>
        );
    }

    if (!rows.length) {
        return (
            <div className="bg-card border rounded-lg p-12 text-center text-sm text-muted-foreground">
                No warehouse operations recorded for the selected scope and filters.
            </div>
        );
    }

    return (
        <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
            <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow>
                        <TableHead className="font-bold text-xs uppercase">Warehouse / Branch</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-center">Shift</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-right">Completed Units</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-right">Pick Rate</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-right">Dock Use</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-right">Space Use</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-center">Queue Time</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-center">Bottleneck</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((r) => {
                        return (
                            <TableRow
                                key={r.id}
                                className="hover:bg-muted/40 cursor-pointer transition-colors"
                                onClick={() => onSelectRow(r)}
                            >
                                <TableCell>
                                    <div className="font-semibold text-sm text-foreground">
                                        {r.warehouseName}
                                    </div>
                                    <div className="text-xs text-muted-foreground font-mono">
                                        {r.warehouseCode} &bull; {r.consolidatorCount} batch(es)
                                    </div>
                                </TableCell>

                                <TableCell className="text-center text-xs">
                                    <Badge variant="outline" className="font-medium">
                                        {r.shift}
                                    </Badge>
                                </TableCell>

                                <TableCell className="text-right">
                                    <span className="font-bold text-sm">
                                        {r.completedUnits.toLocaleString()}
                                    </span>
                                    <div className="text-[11px] text-muted-foreground">
                                        {r.cylindersCount} cyls &bull; {r.palletsCount} pal
                                    </div>
                                </TableCell>

                                <TableCell className="text-right font-medium text-xs">
                                    <span className={r.pickRate !== null && r.pickRate >= 25 ? 'text-emerald-600 font-bold' : ''}>
                                        {r.pickRateDisplay}
                                    </span>
                                </TableCell>

                                <TableCell className="text-right font-medium text-xs">
                                    <span
                                        className={
                                            r.dockUtilizationRate !== null && r.dockUtilizationRate > 85
                                                ? 'text-rose-600 font-bold'
                                                : ''
                                        }
                                    >
                                        {r.dockUtilizationDisplay}
                                    </span>
                                </TableCell>

                                <TableCell className="text-right font-medium text-xs">
                                    <span
                                        className={
                                            r.spaceUtilizationRate !== null && r.spaceUtilizationRate > 90
                                                ? 'text-amber-600 font-bold'
                                                : ''
                                        }
                                    >
                                        {r.spaceUtilizationDisplay}
                                    </span>
                                </TableCell>

                                <TableCell className="text-center text-xs font-mono">
                                    {r.averageQueueTimeMins !== null ? `${r.averageQueueTimeMins}m` : 'N/A'}
                                </TableCell>

                                <TableCell className="text-center">
                                    <Badge
                                        variant="secondary"
                                        className={`text-[11px] font-semibold ${
                                            r.bottleneck === 'SMOOTH_FLOW'
                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                : r.bottleneck === 'DOCK_CONGESTION'
                                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                        }`}
                                    >
                                        {r.bottleneck.replace(/_/g, ' ')}
                                    </Badge>
                                </TableCell>

                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectRow(r);
                                        }}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
};
