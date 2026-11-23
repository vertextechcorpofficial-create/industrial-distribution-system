/**
 * Segmented view switcher — Logistics and Delivery Reliability Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Revisions:
 * - Each tab carries the count of rows behind it so the reader knows the weight of a view before opening it.
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Map, SearchX, Truck } from 'lucide-react';

export type LogisticsView = 'eta' | 'routes' | 'late' | 'fleet';

interface LogisticsViewTabsProps {
    activeView: LogisticsView;
    onChange: (view: LogisticsView) => void;
    counts: Record<LogisticsView, number>;
}

const TABS: Array<{ id: LogisticsView; label: string; icon: React.ElementType }> = [
    { id: 'eta', label: 'Delivery ETA Accuracy', icon: Clock },
    { id: 'routes', label: 'Route Performance', icon: Map },
    { id: 'late', label: 'Late Trip Evidence', icon: SearchX },
    { id: 'fleet', label: 'Fleet Activity', icon: Truck },
];

export const LogisticsViewTabs: React.FC<LogisticsViewTabsProps> = ({
    activeView,
    onChange,
    counts,
}) => {
    return (
        <div className="flex items-center gap-1 p-1 bg-muted/50 border border-border rounded-xl overflow-x-auto">
            {TABS.map((tab) => {
                const isActive = tab.id === activeView;
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onChange(tab.id)}
                        className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                            isActive ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {isActive && (
                            <motion.span
                                layoutId="logistics-active-tab"
                                className="absolute inset-0 rounded-lg bg-primary shadow-xs"
                                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            />
                        )}
                        <span className="relative flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5" />
                            {tab.label}
                            <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    isActive ? 'bg-white/20 text-primary-foreground' : 'bg-background text-muted-foreground border border-border'
                                }`}
                            >
                                {counts[tab.id]}
                            </span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
};
