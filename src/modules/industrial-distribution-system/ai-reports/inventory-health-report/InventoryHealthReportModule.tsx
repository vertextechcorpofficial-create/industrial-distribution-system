/**
 * Main Container Module for Inventory Health Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Real-time state coordination for filters, live metrics, and drawer views
 * - Centralized Core AI integration and slide-over Copilot Drawer
 * - High-fidelity print/export PDF generator
 * - Strict adherence to React Hook ordering rules (zero conditional hooks or hooks after early returns)
 *
 * Loading contract (same as the logistics reliability module):
 * - The filter bar opens pre-filled with the current month to date, and that window loads on mount.
 * - Editing any control changes only the draft; the database is not re-read until Apply Filters is clicked.
 * - Refresh re-runs the applied filter, and print/export describes the applied filter, never the draft.
 * - Search is a client-side narrowing of the rows already loaded, so it never re-reads the database.
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    InventoryHealthFilter,
    InventoryHealthReportPayload,
    SkuHealthRow,
    AiInsightResponse,
    AiTierSlug,
    ChatMessage,
} from './types';
import {
    fetchInventoryHealthData,
    generateGeminiInsights,
    fetchBranchesList,
} from './services/reportService';
import { generateInventoryHealthPrintHtml } from './utils/generateInventoryHealthPrintHtml';
import { FilterHeader } from './components/FilterHeader';
import { SummaryCards } from './components/SummaryCards';
import { InventoryRiskCharts } from './components/InventoryRiskCharts';
import { ResultsGrid } from './components/ResultsGrid';
import { DetailDrawer } from './components/DetailDrawer';
import { AICopilotDrawer } from './components/AICopilotDrawer';
import { AiInsightsPanel } from './components/AiInsightsPanel';

/**
 * Initial period window: current calendar month to date on the Manila wall clock.
 * Seeded into both the draft and applied filters, so the reader lands on this month's
 * numbers with Period From / Period To already showing the window that produced them.
 * The window stops at today: future days would widen it while adding no demand, which
 * understates average daily demand and inflates every coverage-days figure.
 */
function buildDefaultFilter(): InventoryHealthFilter {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    return { startDate: `${today.slice(0, 7)}-01`, endDate: today };
}

export const InventoryHealthReportModule: React.FC = () => {
    // `filter` is the draft bound to the controls; `appliedFilter` records the filter the
    // on-screen numbers were actually produced from. Only Apply copies draft -> applied.
    const defaultInitialFilter = useMemo(() => buildDefaultFilter(), []);
    const [filter, setFilter] = useState<InventoryHealthFilter>(defaultInitialFilter);
    const [appliedFilter, setAppliedFilter] = useState<InventoryHealthFilter>(defaultInitialFilter);
    const [searchTerm, setSearchTerm] = useState('');
    const [branches, setBranches] = useState<Array<{ id: number; branch_name: string }>>([]);
    const [reportData, setReportData] = useState<InventoryHealthReportPayload | null>(null);
    const [selectedSku, setSelectedSku] = useState<SkuHealthRow | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [aiInsight, setAiInsight] = useState<AiInsightResponse | null>(null);
    const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
    const [isInsightsBannerDismissed, setIsInsightsBannerDismissed] = useState(false);

    // Resolved tier
    const [userTier, setUserTier] = useState<{ tierSlug: AiTierSlug; tierName: string }>({
        tierSlug: 'basic',
        tierName: 'Basic',
    });

    const [isReportLoading, setIsReportLoading] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Initial load: the branch picker. Company metadata is no longer fetched — the printable sheet
    // carries no letterhead, so nothing here needs it.
    useEffect(() => {
        const loadInitialData = async () => {
            const branchList = await fetchBranchesList();
            setBranches(branchList);
        };
        loadInitialData();
    }, []);

    // Report fetcher. Takes the filter to run so it never reads draft state implicitly.
    const runReport = useCallback(async (next: InventoryHealthFilter) => {
        setIsReportLoading(true);
        setErrorMessage(null);
        // Clear stale AI insights so findings strictly reflect the dataset being loaded
        setAiInsight(null);
        setIsInsightsBannerDismissed(false);

        try {
            const data = await fetchInventoryHealthData(next);
            setReportData(data);
            if (data.userTier) {
                setUserTier({
                    tierSlug: data.userTier.tierSlug,
                    tierName: data.userTier.tierName,
                });
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error fetching inventory report';
            setErrorMessage(msg);
            setReportData(null);
        } finally {
            setIsReportLoading(false);
        }
    }, []);

    // First paint answers for the current month, using the same default the pickers show
    useEffect(() => {
        runReport(defaultInitialFilter);
    }, [defaultInitialFilter, runReport]);

    // Apply is the only path that adopts the draft controls
    const handleApply = () => {
        setAppliedFilter(filter);
        runReport(filter);
    };

    // Refresh re-reads the scope already on screen; edits to the draft are not adopted here
    const handleRefresh = () => {
        runReport(appliedFilter);
    };

    // Handle user clicking 'Details >' on any SKU row
    const handleSelectSku = (sku: SkuHealthRow) => {
        setSelectedSku(sku);
        setIsDrawerOpen(true);
    };

    // Trigger AI Copilot analysis (Drawer Open + Load Insights)
    const handleRunAi = async () => {
        setIsAiDrawerOpen(true);
        if (!reportData) return;
        if (aiInsight) return; // Already loaded

        setIsAiLoading(true);
        setErrorMessage(null);
        try {
            const insights = await generateGeminiInsights(reportData, userTier.tierSlug);
            setAiInsight(insights);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to generate AI insights';
            setErrorMessage(msg);
        } finally {
            setIsAiLoading(false);
        }
    };

    // Explicit Regenerate trigger from drawer
    const handleRegenerateAi = async () => {
        if (!reportData) return;
        setIsAiLoading(true);
        setErrorMessage(null);
        try {
            const insights = await generateGeminiInsights(reportData, userTier.tierSlug);
            setAiInsight(insights);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to generate AI insights';
            setErrorMessage(msg);
        } finally {
            setIsAiLoading(false);
        }
    };

    // Trigger Executive Custom Inquiry (Interactive Q&A with Chat History)
    const handleAskCustomQuery = async (query: string, chatHistory: ChatMessage[]) => {
        if (!reportData) return;
        setErrorMessage(null);
        try {
            const insights = await generateGeminiInsights(reportData, userTier.tierSlug, query, chatHistory);
            setAiInsight((prev) => ({
                ...(prev || insights),
                userQuery: insights.userQuery,
                qaAnswer: insights.qaAnswer,
                model: insights.model,
                governance: insights.governance,
            }));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to answer inquiry';
            setErrorMessage(msg);
        }
    };

    // High-Fidelity Printable PDF Generation. Describes the applied scope, so a printed page
    // can never claim a period or branch the reader has only typed into the draft controls.
    const handlePrint = () => {
        if (!reportData) return;

        const branchLabel = appliedFilter.branchId
            ? branches.find((b) => String(b.id) === String(appliedFilter.branchId))?.branch_name || 'Industrial Branch'
            : 'Consolidated (All Industrial Branches)';

        const html = generateInventoryHealthPrintHtml(
            reportData.skus,
            reportData.kpis,
            appliedFilter,
            branchLabel
        );

        // Printing goes through an off-screen frame instead of window.open: no throwaway tab is
        // left behind, and a blocked popup can no longer make this button look dead. The browser
        // print dialog stays the layout control — paper, orientation, margins, Save as PDF — and
        // the sheet declares no page size, so every control in that dialog remains live.
        const frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.setAttribute('title', 'Inventory Health Report — print');
        frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
        document.body.appendChild(frame);

        const frameDoc = frame.contentDocument;
        const frameWin = frame.contentWindow;
        if (!frameDoc || !frameWin) {
            frame.remove();
            return;
        }
        frameDoc.open();
        frameDoc.write(html);
        frameDoc.close();

        // The dialog's "Save as PDF" name comes from the page title, and this SPA route has no
        // title of its own, so the sheet's own name is installed for the length of the dialog.
        const previousTitle = document.title;
        document.title = frameDoc.title || previousTitle;

        frameWin.focus();
        frameWin.print();
        const done = () => {
            document.title = previousTitle;
            frame.remove();
        };
        // Chrome tears the frame down on its own after the dialog closes; the rest get a backstop.
        frameWin.addEventListener('afterprint', done);
        window.setTimeout(done, 60000);
    };

    return (
        <div className="w-full space-y-4 px-2 sm:px-4 pb-6">
            {/* Filter Header with Search Product at Column 1, Branch at Column 2, and Print / Export PDF */}
            <FilterHeader
                filter={filter}
                onFilterChange={setFilter}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onRefresh={handleRefresh}
                onApply={handleApply}
                onToggleAi={handleRunAi}
                onPrint={handlePrint}
                isAiLoading={isAiLoading}
                isReportLoading={isReportLoading}
                branches={branches}
            />

            {/* Error Notification Banner */}
            {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300 rounded-lg text-xs font-medium">
                    {errorMessage}
                </div>
            )}

            {/* High-level KPI Scorecard Summary with Vibrant Theme Colors & Glow */}
            <SummaryCards kpis={reportData?.kpis || null} isLoading={isReportLoading} />

            {/* Embedded AI Insights Banner if generated and not dismissed */}
            {!isInsightsBannerDismissed && (aiInsight || isAiLoading) && (
                <AiInsightsPanel
                    aiInsight={aiInsight}
                    isAiLoading={isAiLoading}
                    onDismiss={() => setIsInsightsBannerDismissed(true)}
                    onOpenFullCopilot={() => setIsAiDrawerOpen(true)}
                />
            )}

            {/* Visual Graphics: Cylinder Fleet Breakdown & Stockout Risk Portfolio */}
            <InventoryRiskCharts
                skus={reportData?.skus || []}
                isLoading={isReportLoading}
            />

            {/* Main Scorecard Results Grid with Active Sorting, Pagination, and Unavailable Coverage */}
            <ResultsGrid
                skus={reportData?.skus || []}
                selectedProductId={selectedSku?.productId || null}
                onSelectSku={handleSelectSku}
                isLoading={isReportLoading}
                searchTerm={searchTerm}
            />

            {/* Slide-Over Detail Drawer */}
            <DetailDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                sku={selectedSku}
            />

            {/* Enterprise Slide-Over AI Copilot Drawer */}
            <AICopilotDrawer
                isOpen={isAiDrawerOpen}
                insights={aiInsight}
                activeTier={userTier.tierSlug}
                isLoading={isAiLoading}
                error={errorMessage}
                onClose={() => setIsAiDrawerOpen(false)}
                onRegenerate={handleRegenerateAi}
                onAskCustomQuery={handleAskCustomQuery}
            />
        </div>
    );
};
