/**
 * Main Container Module for Demand Forecast Intelligence Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Current month default date range (1st to last day of current month)
 * - Explicit filter application: only fetches data when the user clicks "Apply Filters" or "Refresh"
 * - Two-screen segmented AI Insight (Executive Overview vs Interactive Q&A)
 * - Centralized Core AI integration via runCoreAiAnalysis (@/lib/ai)
 * - Printable PDF generator with company header and formatted KPI scorecard
 * - Smart product demand and on-hand stock grid with sorting and pagination
 * - Slide-over Product Detail Drawer for drill-down inspection
 * - Strict adherence to React Rules of Hooks (unconditional hooks at component top)
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    DemandForecastFilter,
    DemandForecastReportPayload,
    ProductDemandRow,
    DemandAiInsightResponse,
    AiTierSlug,
    ChatMessage,
} from './types';
import {
    fetchDemandForecastData,
    generateDemandAiInsights,
    fetchBranchesList,
    fetchProductsList,
} from './services/reportService';
import { generateDemandForecastPrintHtml } from './utils/generateDemandForecastPrintHtml';
import { FilterHeader } from './components/FilterHeader';
import { SummaryCards } from './components/SummaryCards';
import { DemandCharts } from './components/DemandCharts';
import { ProductDemandGrid } from './components/ProductDemandGrid';
import { ProductDetailDrawer } from './components/ProductDetailDrawer';
import { AICopilotDrawer } from './components/AICopilotDrawer';

/**
 * Helper to compute the default date range for the current month:
 * e.g., for Nov 2026 => startDate: '2026-11-01', endDate: '2026-11-30'
 */
function getDefaultMonthDateRange(): { startDate: string; endDate: string } {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    return {
        startDate: `${year}-${month}-01`,
        endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
    };
}

export const DemandForecastReportModule: React.FC = () => {
    // Current month default dates (unconditional hook)
    const defaultDates = useMemo(() => getDefaultMonthDateRange(), []);

    // Active filter committed for querying (unconditional hook)
    const [activeFilter, setActiveFilter] = useState<DemandForecastFilter>(defaultDates);
    const [searchTerm, setSearchTerm] = useState('');
    const [branches, setBranches] = useState<Array<{ id: number; branch_name: string }>>([]);
    const [productsList, setProductsList] = useState<Array<{ product_id: number; description: string }>>([]);
    const [reportData, setReportData] = useState<DemandForecastReportPayload | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<ProductDemandRow | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [aiInsight, setAiInsight] = useState<DemandAiInsightResponse | null>(null);
    const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);

    // Dynamic resolved tier (defaults to executive if not yet hydrated)
    const [userTier, setUserTier] = useState<{ tierSlug: AiTierSlug; tierName: string }>({
        tierSlug: 'executive',
        tierName: 'Executive',
    });

    const [isReportLoading, setIsReportLoading] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Initial load: branches and the products dropdown. Company metadata is no longer fetched — the
    // printable sheet carries no letterhead, so nothing here needs it.
    useEffect(() => {
        const loadInitialData = async () => {
            const [branchList, productList] = await Promise.all([
                fetchBranchesList(),
                fetchProductsList(),
            ]);
            setBranches(branchList);
            setProductsList(productList);
        };
        loadInitialData();
    }, []);

    // Main data fetch routine: accepts explicit filter to query
    const loadReport = useCallback(async (filterToUse: DemandForecastFilter) => {
        setIsReportLoading(true);
        setErrorMessage(null);
        // Clear stale AI insight so AI output strictly reflects current dataset
        setAiInsight(null);
        try {
            const data = await fetchDemandForecastData(filterToUse);
            setReportData(data);
            if (data.userTier) {
                setUserTier({
                    tierSlug: data.userTier.tierSlug,
                    tierName: data.userTier.tierName,
                });
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error fetching demand forecast report';
            setErrorMessage(msg);
        } finally {
            setIsReportLoading(false);
        }
    }, []);

    // Initial load: runs ONLY ONCE on mount using default current-month dates
    useEffect(() => {
        loadReport(defaultDates);
    }, [loadReport, defaultDates]);

    // Apply Filter callback: executed ONLY when user clicks "Apply Filters" or "Refresh"
    const handleApplyFilter = (newFilter: DemandForecastFilter) => {
        setActiveFilter(newFilter);
        loadReport(newFilter);
    };

    // Handle user clicking any product row in the grid
    const handleSelectProduct = (product: ProductDemandRow) => {
        setSelectedProduct(product);
        setIsDrawerOpen(true);
    };

    // Trigger standard AI Insight analysis (Drawer Open + Load Insights)
    const handleRunAi = async () => {
        setIsAiDrawerOpen(true);
        if (!reportData) return;
        if (aiInsight) return; // Already loaded

        setIsAiLoading(true);
        setErrorMessage(null);
        try {
            const insights = await generateDemandAiInsights(reportData, userTier.tierSlug);
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
            const insights = await generateDemandAiInsights(reportData, userTier.tierSlug);
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
            const insights = await generateDemandAiInsights(
                reportData,
                userTier.tierSlug,
                query,
                chatHistory
            );
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

    // Printable PDF Generation. Describes the applied filter, so a printed page can never claim a
    // period or branch the reader has only typed into the draft controls.
    const handlePrint = () => {
        if (!reportData) return;

        const branchLabel = activeFilter.branchId
            ? branches.find((b) => String(b.id) === String(activeFilter.branchId))?.branch_name || 'Branch'
            : 'Consolidated (All Branches)';

        const html = generateDemandForecastPrintHtml(
            reportData.products,
            reportData.kpis,
            activeFilter,
            branchLabel
        );

        // Printing goes through an off-screen frame instead of window.open: no throwaway tab is
        // left behind, and a blocked popup can no longer make this button look dead. The browser
        // print dialog stays the layout control — paper, orientation, margins, Save as PDF.
        const frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.setAttribute('title', 'Demand Forecast & Inventory Alignment Report — print');
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
            {/* Filter Header with draft filter state and explicit Apply button */}
            <FilterHeader
                initialFilter={defaultDates}
                onApplyFilter={handleApplyFilter}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onToggleAi={handleRunAi}
                onPrint={handlePrint}
                isAiLoading={isAiLoading}
                isReportLoading={isReportLoading}
                branches={branches}
                productsList={productsList}
            />

            {/* Error Notification Banner */}
            {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300 rounded-lg text-xs font-medium">
                    {errorMessage}
                </div>
            )}

            {/* High-level 6-KPI Scorecard Summary with Theme Colors & Glow */}
            <SummaryCards kpis={reportData?.kpis || null} isLoading={isReportLoading} />

            {/* Visual Graphics: Demand vs Replenishment & Stock + Coverage Distribution */}
            <DemandCharts
                products={reportData?.products || []}
                kpis={reportData?.kpis || null}
                isLoading={isReportLoading}
            />

            {/* Main Product Demand & Stock Grid with Smart Sorting & Pagination */}
            <ProductDemandGrid
                products={reportData?.products || []}
                selectedProductId={selectedProduct?.productId || null}
                onSelectProduct={handleSelectProduct}
                isLoading={isReportLoading}
                searchTerm={searchTerm}
            />

            {/* Slide-Over Product Detail Drawer */}
            <ProductDetailDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                product={selectedProduct}
            />

            {/* Enterprise Slide-Over AI Insight Drawer */}
            <AICopilotDrawer
                isOpen={isAiDrawerOpen}
                insights={aiInsight}
                reportPayload={reportData}
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
