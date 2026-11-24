/**
 * Main Container Module for Warehouse Efficiency Intelligence Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Real-time state coordination for filters, live metrics, and drawer views
 * - Centralized Core AI integration and slide-over Copilot Drawer
 * - High-fidelity print/export PDF generator
 * - Strict adherence to React Hook ordering rules (zero conditional hooks or hooks after early returns)
 *
 * Loading contract:
 * - Filter bar opens pre-filled with the current month to date, loading on mount.
 * - Editing controls modifies only the draft; database is queried only upon Apply Filters.
 * - Refresh re-runs the applied filter.
 * - Search is client-side filtering over retrieved rows.
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    WarehouseEfficiencyFilter,
    WarehouseEfficiencyReportPayload,
    WarehouseEfficiencyRow,
    AiInsightResponse,
    AiTierSlug,
    ChatMessage,
} from './types';
import {
    fetchWarehouseEfficiencyData,
    generateGeminiWarehouseInsights,
    fetchBranchesList,
} from './services/reportService';
import { generateWarehouseEfficiencyPrintHtml } from './utils/generateWarehouseEfficiencyPrintHtml';
import { FilterHeader } from './components/FilterHeader';
import { SummaryCards } from './components/SummaryCards';
import { ResultsGrid } from './components/ResultsGrid';
import { DetailDrawer } from './components/DetailDrawer';
import { AICopilotDrawer } from './components/AICopilotDrawer';
import { AiInsightsPanel } from './components/AiInsightsPanel';
import { WarehouseEfficiencySkeleton } from './components/WarehouseEfficiencySkeleton';

function buildDefaultFilter(): WarehouseEfficiencyFilter {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    return {
        datePreset: 'this_month',
        startDate: `${today.slice(0, 7)}-01`,
        endDate: today,
        shift: 'ALL',
        unitType: 'ALL',
    };
}

export const WarehouseEfficiencyReportModule: React.FC = () => {
    const defaultInitialFilter = useMemo(() => buildDefaultFilter(), []);
    const [filter, setFilter] = useState<WarehouseEfficiencyFilter>(defaultInitialFilter);
    const [appliedFilter, setAppliedFilter] = useState<WarehouseEfficiencyFilter>(defaultInitialFilter);
    const [branches, setBranches] = useState<Array<{ id: number; branch_name: string; branch_code: string }>>([]);
    const [reportData, setReportData] = useState<WarehouseEfficiencyReportPayload | null>(null);
    const [selectedRow, setSelectedRow] = useState<WarehouseEfficiencyRow | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [aiInsight, setAiInsight] = useState<AiInsightResponse | null>(null);
    const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);

    const [userTier, setUserTier] = useState<{ tierSlug: AiTierSlug; tierName: string }>({
        tierSlug: 'basic',
        tierName: 'Basic',
    });

    const [isReportLoading, setIsReportLoading] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Initial branch metadata loading
    useEffect(() => {
        const loadInitialData = async () => {
            const branchList = await fetchBranchesList();
            setBranches(branchList);
        };
        loadInitialData();
    }, []);

    // Report fetcher with cache bypass option
    const runReport = useCallback(async (next: WarehouseEfficiencyFilter, bypassCache: boolean = false) => {
        setIsReportLoading(true);
        setErrorMessage(null);
        setAiInsight(null);

        try {
            const data = await fetchWarehouseEfficiencyData(next, bypassCache);
            setReportData(data);
            if (data.userTier) {
                setUserTier({
                    tierSlug: data.userTier.tierSlug,
                    tierName: data.userTier.tierName,
                });
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error fetching warehouse efficiency report';
            setErrorMessage(msg);
            setReportData(null);
        } finally {
            setIsReportLoading(false);
        }
    }, []);

    useEffect(() => {
        runReport(defaultInitialFilter);
    }, [defaultInitialFilter, runReport]);

    const handleApply = () => {
        setAppliedFilter(filter);
        runReport(filter, false);
    };

    const handleRefresh = () => {
        runReport(appliedFilter, true);
    };

    const handleReset = () => {
        const fresh = buildDefaultFilter();
        setFilter(fresh);
        setAppliedFilter(fresh);
        runReport(fresh, true);
    };

    const handleSelectRow = (row: WarehouseEfficiencyRow) => {
        setSelectedRow(row);
        setIsDrawerOpen(true);
    };

    const handleRunAi = async () => {
        setIsAiDrawerOpen(true);
        if (!reportData) return;
        if (aiInsight) return;

        setIsAiLoading(true);
        setErrorMessage(null);
        try {
            const insights = await generateGeminiWarehouseInsights(reportData, userTier.tierSlug);
            setAiInsight(insights);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to generate AI insights';
            setErrorMessage(msg);
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleAskCustomQuery = async (query: string, chatHistory: ChatMessage[]) => {
        if (!reportData) return;
        setIsAiLoading(true);
        try {
            const res = await generateGeminiWarehouseInsights(
                reportData,
                userTier.tierSlug,
                query,
                chatHistory
            );
            setAiInsight((prev) => ({
                ...(prev || res),
                qaAnswer: res.qaAnswer || res.summary,
                userQuery: query,
            }));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error processing inquiry';
            setErrorMessage(msg);
        } finally {
            setIsAiLoading(false);
        }
    };

    const handlePrint = () => {
        if (!reportData) return;
        const html = generateWarehouseEfficiencyPrintHtml(reportData);
        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
            win.focus();
            setTimeout(() => {
                win.print();
            }, 300);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header with Filters & Controls */}
            <FilterHeader
                filter={filter}
                appliedFilter={appliedFilter}
                onChange={setFilter}
                onApply={handleApply}
                onRefresh={handleRefresh}
                onReset={handleReset}
                onPrint={handlePrint}
                onOpenAiCopilot={handleRunAi}
                branches={branches}
                isLoading={isReportLoading}
                isAiLoading={isAiLoading}
            />

            {/* Error Message */}
            {errorMessage && (
                <div className="bg-destructive/10 border border-destructive text-destructive text-sm p-4 rounded-lg">
                    {errorMessage}
                </div>
            )}

            {/* Full Module Pulse Skeleton Loader during Data Fetching */}
            {isReportLoading ? (
                <WarehouseEfficiencySkeleton />
            ) : (
                <>
                    {/* Executive AI Insights Banner */}
                    <AiInsightsPanel
                        insights={aiInsight}
                        userTier={userTier}
                        isLoading={isAiLoading}
                        onOpenCopilot={() => {
                            setIsAiDrawerOpen(true);
                            if (!aiInsight) handleRunAi();
                        }}
                    />

                    {/* Key Performance Indicators */}
                    <SummaryCards kpis={reportData?.kpis || null} />

                    {/* Main Warehouse Operational Results Grid */}
                    <ResultsGrid
                        rows={reportData?.rows || []}
                        onSelectRow={handleSelectRow}
                        isLoading={false}
                    />
                </>
            )}

            {/* Operational Deep-Dive Detail Drawer */}
            <DetailDrawer
                row={selectedRow}
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
            />

            {/* AI Copilot Slide-Over Drawer with Universal Tier Hierarchy */}
            <AICopilotDrawer
                isOpen={isAiDrawerOpen}
                insights={aiInsight}
                reportPayload={reportData}
                activeTier={userTier.tierSlug}
                isLoading={isAiLoading}
                error={errorMessage}
                onClose={() => setIsAiDrawerOpen(false)}
                onAskCustomQuery={handleAskCustomQuery}
            />
        </div>
    );
};
