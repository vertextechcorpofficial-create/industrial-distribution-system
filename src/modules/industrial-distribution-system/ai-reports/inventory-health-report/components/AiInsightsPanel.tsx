/**
 * Embedded AI Insights Panel Component for Inventory Health Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Collapsible banner on top of the results grid displaying immediate AI findings
 * - Clean typography and formatted bullet rendering
 * - Shortcut button to open the full slide-over AI Copilot Drawer
 */

'use client';

import React from 'react';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { AiInsightResponse } from '../types';

interface AiInsightsPanelProps {
    aiInsight: AiInsightResponse | null;
    isAiLoading: boolean;
    onDismiss: () => void;
    onOpenFullCopilot: () => void;
}

export const AiInsightsPanel: React.FC<AiInsightsPanelProps> = ({
    aiInsight,
    isAiLoading,
    onDismiss,
    onOpenFullCopilot,
}) => {
    if (isAiLoading) {
        return (
            <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-teal-500/10 border border-purple-500/30 rounded-xl p-4 shadow-xs animate-pulse">
                <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 animate-spin" />
                    <div>
                        <div className="h-4 w-48 bg-purple-500/20 rounded-sm mb-1.5" />
                        <div className="h-3 w-80 bg-purple-500/10 rounded-sm" />
                    </div>
                </div>
            </div>
        );
    }

    if (!aiInsight) return null;

    const summary = aiInsight.summary || 'Enterprise inventory analysis complete.';
    const highlights = aiInsight.keyHighlights || [];

    return (
        <div className="bg-gradient-to-r from-purple-50/80 via-indigo-50/60 to-background dark:from-purple-950/20 dark:via-indigo-950/15 dark:to-background border border-purple-200 dark:border-purple-900/50 rounded-xl p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-purple-600 text-white shrink-0 shadow-xs">
                        <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold text-foreground">Gemini AI Executive Insights</h2>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                                {aiInsight.tierName} Tier
                            </span>
                            {aiInsight.isFallback && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                    Deterministic Fallback
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-foreground/90 font-medium leading-relaxed max-w-4xl">
                            {summary}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onOpenFullCopilot}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-2xs cursor-pointer"
                    >
                        <span>Open AI Copilot</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                        title="Dismiss Banner"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Quick Bullet Highlights if present */}
            {highlights.length > 0 && (
                <div className="mt-3 pt-3 border-t border-purple-200/60 dark:border-purple-900/40 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                    {highlights.slice(0, 4).map((h, i) => (
                        <div key={i} className="flex items-start gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-purple-600 dark:bg-purple-400 mt-1.5 shrink-0" />
                            <span className="leading-snug">{h}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
