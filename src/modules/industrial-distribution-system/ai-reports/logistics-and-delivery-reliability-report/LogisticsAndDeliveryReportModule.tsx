/**
 * Logistics and Delivery Reliability Report — module root
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Loading contract:
 * - The filter bar opens pre-filled with the current calendar month, and that window is loaded on
 *   mount so the reader lands on this month's dispatches instead of an empty screen.
 * - `appliedFilter` starts as the same default and thereafter records the filter the on-screen
 *   numbers were actually produced from.
 * - The draft `filter` is free to edit; only Apply copies it into `appliedFilter` and triggers the request.
 * - Refresh re-runs `appliedFilter`. Reset moves the draft controls back to the current month and re-runs.
 * - Search is a client-side narrowing of the rows already loaded, so it never re-reads the database.
 */

'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    AiInsightResponse,
    AiTierSlug,
    ChatMessage,
    FleetActivityRow,
    LateShipmentRootCauseRow,
    LogisticsReportFilter,
    LogisticsReportPayload,
    RoutePerformanceRow,
    TripSummaryRow,
} from './types';
import { DEFAULT_ON_TIME_TOLERANCE_MINUTES } from './services/logisticsMetrics';
import {
    fetchBranchesList,
    fetchLogisticsReportData,
    fetchProductFamilies,
    generateGeminiInsights,
} from './services/reportService';
import { generateLogisticsPrintHtml } from './utils/generateLogisticsPrintHtml';
import { FilterHeader } from './components/FilterHeader';
import { SummaryCards } from './components/SummaryCards';
import { LogisticsViewTabs, LogisticsView } from './components/LogisticsViewTabs';
import { LogisticsCharts } from './components/LogisticsCharts';
import { EtaAccuracyGrid } from './components/EtaAccuracyGrid';
import { RouteComparisonGrid } from './components/RouteComparisonGrid';
import { LateShipmentRootCauseGrid } from './components/LateShipmentRootCauseGrid';
import { FleetActivityGrid } from './components/FleetActivityGrid';
import { TripDetailDrawer } from './components/TripDetailDrawer';
import { AICopilotDrawer } from './components/AICopilotDrawer';
import { ClipboardList } from 'lucide-react';

/** Current calendar month (1st to last day), offered on first paint and restored by Reset. */
function buildDefaultFilter(): LogisticsReportFilter {
    const now = new Date();
    // Day parts are read in the viewer's own frame on purpose. `toISOString()` answers in UTC, which
    // would roll a Philippine morning back to the previous month on the 1st and shorten the window by
    // a day; the route compares these strings against PH wall-clock dispatch dates.
    const iso = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
        startDate: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
        endDate: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
        branchId: undefined,
        productId: undefined,
        toleranceMinutes: DEFAULT_ON_TIME_TOLERANCE_MINUTES,
    };
}

function matches(term: string, parts: Array<string | number | null | undefined>): boolean {
    if (!term) return true;
    const needle = term.toLowerCase();
    return parts.some((p) => String(p ?? '').toLowerCase().includes(needle));
}

/**
 * Nearest vertically scrollable ancestor. This layout puts report modules inside a Radix ScrollArea,
 * so the window never scrolls — an inner element does, and anything that has to hold the reader's
 * position has to talk to that element rather than to `window`.
 */
function scrollParentOf(el: HTMLElement | null): HTMLElement | null {
    let node = el?.parentElement ?? null;
    while (node) {
        const overflowY = window.getComputedStyle(node).overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') return node;
        node = node.parentElement;
    }
    return (document.scrollingElement as HTMLElement | null) ?? null;
}

export const LogisticsAndDeliveryReportModule: React.FC = () => {
    const defaultInitialFilter = useMemo(() => buildDefaultFilter(), []);
    const [filter, setFilter] = useState<LogisticsReportFilter>(defaultInitialFilter);
    const [appliedFilter, setAppliedFilter] = useState<LogisticsReportFilter>(defaultInitialFilter);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeView, setActiveView] = useState<LogisticsView>('eta');

    // Changing tabs unmounts one grid and mounts another of a different height, and the reader is
    // thrown to the top of the page. Remember the offset, then put it back before the browser paints.
    const tabBarRef = useRef<HTMLDivElement>(null);
    const pendingScrollTop = useRef<number | null>(null);

    const handleViewChange = useCallback(
        (next: LogisticsView) => {
            if (next === activeView) return;
            pendingScrollTop.current = scrollParentOf(tabBarRef.current)?.scrollTop ?? null;
            setActiveView(next);
        },
        [activeView]
    );

    useLayoutEffect(() => {
        const top = pendingScrollTop.current;
        pendingScrollTop.current = null;
        if (top === null) return;
        const host = scrollParentOf(tabBarRef.current);
        // A shorter view has already clamped the offset; asking for the old position is what keeps
        // the tab bar on screen instead of resetting to the filter card.
        if (host && host.scrollTop !== top) host.scrollTop = top;
    }, [activeView]);

    const [branches, setBranches] = useState<Array<{ id: number; branch_name: string }>>([]);
    const [products, setProducts] = useState<Array<{ id: number; description: string }>>([]);

    const [reportData, setReportData] = useState<LogisticsReportPayload | null>(null);
    const [isReportLoading, setIsReportLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [selectedTrip, setSelectedTrip] = useState<TripSummaryRow | null>(null);
    const [isTripDrawerOpen, setIsTripDrawerOpen] = useState(false);

    const [aiInsight, setAiInsight] = useState<AiInsightResponse | null>(null);
    const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [activeTier, setActiveTier] = useState<AiTierSlug>('executive');

    // The pickers are reference lists, not report figures, so they may hydrate on mount. Company
    // metadata is no longer fetched: the printable sheet carries no letterhead.
    useEffect(() => {
        const loadLookups = async () => {
            const [branchList, productList] = await Promise.all([
                fetchBranchesList(),
                fetchProductFamilies(),
            ]);
            setBranches(branchList);
            setProducts(productList);
        };
        loadLookups();
    }, []);

    const runReport = useCallback(async (next: LogisticsReportFilter) => {
        setIsReportLoading(true);
        setErrorMessage(null);
        // Stale commentary must never outlive the dataset it described.
        setAiInsight(null);
        try {
            const data = await fetchLogisticsReportData(next);
            setReportData(data);
            if (data.userTier?.tierSlug) setActiveTier(data.userTier.tierSlug);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to load the logistics reliability report';
            setErrorMessage(msg);
            setReportData(null);
        } finally {
            setIsReportLoading(false);
        }
    }, []);

    // First paint answers for the current month, using the same default the Reset button restores
    useEffect(() => {
        runReport(defaultInitialFilter);
    }, [defaultInitialFilter, runReport]);

    const handleApply = () => {
        setAppliedFilter(filter);
        runReport(filter);
    };

    const handleRefresh = () => {
        runReport(appliedFilter);
    };

    const handleReset = () => {
        const def = buildDefaultFilter();
        setFilter(def);
        setAppliedFilter(def);
        setSearchTerm('');
        runReport(def);
    };

    const toleranceMinutes = reportData?.kpis.toleranceMinutes ?? appliedFilter?.toleranceMinutes ?? filter.toleranceMinutes ?? DEFAULT_ON_TIME_TOLERANCE_MINUTES;

    const visibleTrips = useMemo(() => {
        const trips = reportData?.trips ?? [];
        return trips.filter((t) =>
            matches(searchTerm, [
                t.docNo,
                t.depotBranchName,
                t.clusterName,
                t.driverName,
                t.vehiclePlate,
                t.vehicleName,
                ...t.stops.map((s) => s.customerName),
            ])
        );
    }, [reportData, searchTerm]);

    const visibleRoutes = useMemo<RoutePerformanceRow[]>(() => {
        const routes = reportData?.routes ?? [];
        return routes.filter((r) => matches(searchTerm, [r.depotBranchName, r.destinationCluster]));
    }, [reportData, searchTerm]);

    const visibleLate = useMemo<LateShipmentRootCauseRow[]>(() => {
        const late = reportData?.lateShipments ?? [];
        return late.filter((r) =>
            matches(searchTerm, [r.docNo, r.depotBranchName, r.clusterName, r.driverName, r.vehiclePlate, ...r.remarksEvidence])
        );
    }, [reportData, searchTerm]);

    const visibleFleet = useMemo<FleetActivityRow[]>(() => {
        const fleet = reportData?.fleet ?? [];
        return fleet.filter((v) => matches(searchTerm, [v.vehiclePlate, v.vehicleName, v.vehicleType, v.registeredHomeBranch]));
    }, [reportData, searchTerm]);

    const openTripById = (tripId: number) => {
        const trip = (reportData?.trips ?? []).find((t) => t.tripId === tripId) || null;
        if (!trip) return;
        setSelectedTrip(trip);
        setIsTripDrawerOpen(true);
    };

    const handleRunAi = async () => {
        setIsAiDrawerOpen(true);
        if (!reportData || aiInsight) return;
        setIsAiLoading(true);
        setErrorMessage(null);
        try {
            setAiInsight(await generateGeminiInsights(reportData, activeTier));
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : 'Failed to generate AI insights');
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleRegenerateAi = async () => {
        if (!reportData) return;
        setIsAiLoading(true);
        setErrorMessage(null);
        try {
            setAiInsight(await generateGeminiInsights(reportData, activeTier));
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : 'Failed to regenerate AI insights');
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleAskCustomQuery = async (query: string, chatHistory: ChatMessage[]) => {
        if (!reportData) return;
        setErrorMessage(null);
        try {
            const insights = await generateGeminiInsights(reportData, activeTier, query, chatHistory);
            setAiInsight((prev) => ({
                ...(prev || insights),
                userQuery: insights.userQuery,
                qaAnswer: insights.qaAnswer,
                model: insights.model,
                governance: insights.governance,
            }));
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : 'Failed to answer the inquiry');
        }
    };

    const handlePrint = () => {
        if (!reportData) return;
        // Header labels for the printed register. Unresolved pickers say what is missing rather
        // than echoing a bare id.
        const branchLabel = appliedFilter?.branchId
            ? branches.find((b) => String(b.id) === String(appliedFilter.branchId))?.branch_name || '-'
            : 'All Industrial Branches';
        const productLabel = appliedFilter?.productId
            ? products.find((p) => String(p.id) === String(appliedFilter.productId))?.description || '-'
            : 'All Products';

        const html = generateLogisticsPrintHtml({
            kpis: reportData.kpis,
            // The printed register mirrors exactly what the reader is looking at, search included.
            trips: visibleTrips,
            routes: visibleRoutes,
            lateShipments: visibleLate,
            fleet: visibleFleet,
            filter: appliedFilter ?? filter,
            branchLabel,
            productLabel,
            searchTerm,
        });

        // Printing goes through an off-screen frame instead of window.open: a blocked popup used to
        // make this button look dead — no dialog, no message. The browser print dialog is the layout
        // control (paper, orientation, margins, Save as PDF); LOGISTICS_PRINT_LAYOUT only sets the
        // fallback shape of the sheet itself.
        const frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.setAttribute('title', 'Logistics and Delivery Reliability Report — print');
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

    const hasReport = reportData !== null;

    return (
        <div className="w-full space-y-4 px-2 sm:px-4 pb-6">
            <FilterHeader
                filter={filter}
                onFilterChange={setFilter}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onApply={handleApply}
                onRefresh={handleRefresh}
                onReset={handleReset}
                onPrint={handlePrint}
                onToggleAi={handleRunAi}
                isAiLoading={isAiLoading}
                isReportLoading={isReportLoading}
                hasReport={hasReport}
                branches={branches}
                products={products}
            />

            {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300 rounded-lg text-xs font-medium">
                    {errorMessage}
                </div>
            )}

            {isReportLoading && (
                <div className="space-y-4">
                    <SummaryCards kpis={null} isLoading />
                    <div className="h-64 bg-muted/40 animate-pulse rounded-2xl border border-border" />
                </div>
            )}

            {!isReportLoading && !hasReport && (
                <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center text-center space-y-2">
                    <div className="p-3 rounded-xl bg-muted text-muted-foreground">
                        <ClipboardList className="h-6 w-6" />
                    </div>
                    <h2 className="text-sm font-semibold text-foreground">No data available</h2>
                    <p className="text-xs text-muted-foreground max-w-md">
                        No posted dispatches were found matching the selected criteria. Try adjusting the date range or branch filter and click Apply.
                    </p>
                </div>
            )}

            {!isReportLoading && hasReport && reportData && (
                <>
                    <SummaryCards kpis={reportData.kpis} isLoading={false} />

                    <div ref={tabBarRef}>
                        <LogisticsViewTabs
                            activeView={activeView}
                            onChange={handleViewChange}
                            counts={{
                                eta: visibleTrips.length,
                                routes: visibleRoutes.length,
                                late: visibleLate.length,
                                fleet: visibleFleet.length,
                            }}
                        />
                    </div>

                    {activeView === 'eta' && (
                        <div className="space-y-4">
                            {/* Charts take the full applied period, not the search-narrowed rows: a
                                search that matches two trips must not empty the panels while the
                                cards above still describe the period. */}
                            <LogisticsCharts
                                kpis={reportData.kpis}
                                routes={reportData.routes}
                                trips={reportData.trips}
                            />
                            <EtaAccuracyGrid
                                trips={visibleTrips}
                                toleranceMinutes={toleranceMinutes}
                                onSelectTrip={(trip) => {
                                    setSelectedTrip(trip);
                                    setIsTripDrawerOpen(true);
                                }}
                                selectedTripId={selectedTrip?.tripId ?? null}
                            />
                        </div>
                    )}

                    {activeView === 'routes' && <RouteComparisonGrid routes={visibleRoutes} toleranceMinutes={toleranceMinutes} />}

                    {activeView === 'late' && (
                        <LateShipmentRootCauseGrid
                            lateShipments={visibleLate}
                            toleranceMinutes={toleranceMinutes}
                            onOpenTrip={openTripById}
                            selectedTripId={selectedTrip?.tripId ?? null}
                        />
                    )}

                    {activeView === 'fleet' && <FleetActivityGrid fleet={visibleFleet} />}

                    {searchTerm && (
                        <p className="text-[11px] text-muted-foreground px-1">
                            Rows are narrowed by the search box only; the cards and charts above still describe the full applied period.
                        </p>
                    )}
                </>
            )}

            <TripDetailDrawer
                isOpen={isTripDrawerOpen}
                onClose={() => setIsTripDrawerOpen(false)}
                trip={selectedTrip}
                toleranceMinutes={toleranceMinutes}
            />

            <AICopilotDrawer
                isOpen={isAiDrawerOpen}
                insights={aiInsight}
                reportPayload={reportData}
                activeTier={activeTier}
                isLoading={isAiLoading}
                error={errorMessage}
                onClose={() => setIsAiDrawerOpen(false)}
                onRegenerate={handleRegenerateAi}
                onAskCustomQuery={handleAskCustomQuery}
            />
        </div>
    );
};
