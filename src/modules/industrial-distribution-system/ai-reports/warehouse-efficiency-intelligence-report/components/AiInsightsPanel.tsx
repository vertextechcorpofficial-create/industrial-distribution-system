/**
 * AI Insights Executive Panel for Warehouse Efficiency Intelligence Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Dynamic tier action button (Basic: 'View AI Summary', Pro: 'View Diagnostic Review', Executive: 'Executive Report & AI Chatbot')
 * - Executive tier highlights and fallback indicators
 */

'use client';

import React from 'react';
import { AiInsightResponse, AiTierSlug } from '../types';
import { Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AiInsightsPanelProps {
    insights: AiInsightResponse | null;
    userTier: { tierSlug: AiTierSlug; tierName: string };
    isLoading: boolean;
    onOpenCopilot: () => void;
}

export const AiInsightsPanel: React.FC<AiInsightsPanelProps> = ({
    insights,
    userTier,
    isLoading,
    onOpenCopilot,
}) => {
    if (isLoading) {
        return (
            <div className="bg-gradient-to-r from-indigo-50/50 via-purple-50/30 to-blue-50/50 dark:from-indigo-950/20 dark:to-blue-950/20 border border-indigo-200 dark:border-indigo-900 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 animate-pulse">
                        <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-foreground">Gemini AI Executive Analysis Running...</h4>
                        <p className="text-xs text-muted-foreground">Evaluating pick rate variances, dock staging lines, and storage constraints.</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!insights) return null;

    const isExecutive = userTier.tierSlug === 'executive';
    const isPro = userTier.tierSlug === 'pro';

    const buttonLabel = isExecutive
        ? 'Executive Report & AI Chatbot'
        : isPro
            ? 'View Diagnostic Review'
            : 'View AI Summary';

    return (
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-full bg-primary text-primary-foreground">
                        <Sparkles className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">Gemini AI Executive Synthesis</h3>
                    <Badge variant="outline" className="text-[10px] font-semibold border-primary/30 text-primary">
                        Tier: {userTier.tierName}
                    </Badge>
                    {insights.isFallback && (
                        <Badge variant="secondary" className="text-[10px]">
                            Deterministic Fallback
                        </Badge>
                    )}
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenCopilot}
                    className="text-xs border-border hover:border-primary/40 text-foreground hover:bg-muted gap-1.5 h-8 px-3 font-semibold"
                >
                    {buttonLabel}
                    <ArrowRight className="h-3 w-3 text-primary" />
                </Button>
            </div>

            <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                {insights.summary}
            </p>

            {insights.keyHighlights && insights.keyHighlights.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t border-border/60">
                    {insights.keyHighlights.map((hl, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                            <span>{hl}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
