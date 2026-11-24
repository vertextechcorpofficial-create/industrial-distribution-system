/**
 * Demand Forecast Intelligence Report — Main Data Aggregation API Route
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * GET /api/ids/ai-reports/demand-forecast-intelligence-report
 *   ?startDate=YYYY-MM-DD
 *   &endDate=YYYY-MM-DD
 *   &branchId=<id>        (optional — all Div-1 branches if omitted)
 *   &productId=<id>       (optional — single product filter)
 *
 * Data sources:
 *   - branches                  (Division 1, isActive = 1)
 *   - products                  (parent_id IS NULL, is_serialized = 1)
 *   - sales_order               (non-cancelled, within date range)
 *   - sales_order_details       (all — joined in-memory)
 *   - purchase_order            (is_posted = 1, within date range)
 *   - purchase_order_products   (all — joined in-memory)
 *   - purchase_order_receiving  (isPosted = 1 — joined in-memory)
 *   - v_serial_onhand           (live stock snapshot)
 *
 * Aggregation produces ProductDemandRow[] and DemandForecastKPIs.
 * Only rows with totalSoCount > 0 are included in the response (no phantom rows).
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Inline type definitions (self-contained per supplier-performance pattern) ─────────────

type AiTierSlug = 'basic' | 'pro' | 'executive';

interface MonthlyDemandBucket {
    /** YYYY-MM label for the sparkline */
    month: string;
    orderedQty: number;
}

interface ForwardDayProjection {
    date: string;
    dayIndex: number;
    dayLabel: string;
    projectedDemand: number;
    endingStock: number;
    status: 'SAFE' | 'LOW' | 'STOCKOUT';
}

interface ProductDemandRow {
    productId: number;
    productName: string;
    branchId: number;
    branchName: string;
    // Sales-side demand
    totalDemandQty: number;
    servedQty: number;
    totalSoCount: number;
    avgOrderQty: number | null;
    // Replenishment (purchase orders)
    totalPurchasedQty: number;
    totalReceivedQty: number;
    // On-hand stock (usable inventory is FULL cylinders)
    stockOnHandFull: number;
    stockOnHandEmpty: number;
    stockOnHandTotal: number;
    // Derived coverage
    replenishmentCoverage: number | null;
    coverageStatus: 'UNDERSUPPLIED' | 'BALANCED' | 'OVERSUPPLIED' | 'NO_DATA';
    // Demand Forecasting Intelligence metrics
    dailyBurnRate: number;
    forecast7Day: number;
    forecast14Day: number;
    projected30DayDemand: number;
    daysOfSupply: number;
    suggestedReplenishment: number;
    estimatedStockoutDate: string | null;
    stockoutDaysRemaining: number | null;
    forwardDailySchedule: ForwardDayProjection[];
    runwayStatus: 'CRITICAL_STOCKOUT' | 'LOW_RUNWAY' | 'BALANCED' | 'SURPLUS' | 'NO_DEMAND';
    // Monthly trend up to 12 months
    monthlyDemandTrend: MonthlyDemandBucket[];
    demandTrend?: MonthlyDemandBucket[];
}

interface DemandForecastKPIs {
    totalProductsEvaluated: number;
    totalDemandQty: number;
    totalStockOnHand: number;
    projected7DayDemandTotal: number;
    projected14DayDemandTotal: number;
    projectedTotalForecast30Day: number;
    criticalStockoutCount: number;
    recommendedReplenishmentTotal: number;
    avgReplenishmentCoverage: number | null;
    understockedCount: number;
    overstockedCount: number;
    dataFreshnessTimestamp: string;
}

interface DemandForecastReportPayload {
    filter: { startDate: string; endDate: string; branchId: string; productId: string };
    kpis: DemandForecastKPIs;
    products: ProductDemandRow[];
    userTier: { tierLevel: number; tierSlug: AiTierSlug; tierName: string };
}

// ─── Directus helpers ─────────────────────────────────────────────────────────

function getDirectusBase(): string {
    const raw = process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const cleaned = raw.trim().replace(/\/$/, '');
    if (!cleaned) throw new Error('DIRECTUS_URL is not configured.');
    return /^https?:\/\//i.test(cleaned) ? cleaned : `http://${cleaned}`;
}

function getDirectusToken(): string {
    const token = (process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || '').trim();
    if (!token) throw new Error('DIRECTUS_STATIC_TOKEN is not configured.');
    return token;
}

function directusHeaders(): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getDirectusToken()}`,
    };
}

/** Generic Directus collection fetcher — returns empty array on failure */
async function fetchDirectusCollection<T>(collection: string, queryParams: string = ''): Promise<T[]> {
    const base = getDirectusBase();
    const url = `${base}/items/${collection}?${queryParams}`;
    const res = await fetch(url, { headers: directusHeaders(), cache: 'no-store' });
    if (!res.ok) {
        console.error(`[DemandForecast] Failed to fetch ${collection}: status ${res.status}`);
        return [];
    }
    const json = await res.json().catch(() => ({ data: [] }));
    return (json?.data || []) as T[];
}

// ─── Coverage status classifier ───────────────────────────────────────────────

function classifyCoverage(coverage: number | null): ProductDemandRow['coverageStatus'] {
    if (coverage === null) return 'NO_DATA';
    if (coverage < 80) return 'UNDERSUPPLIED';
    if (coverage <= 150) return 'BALANCED';
    return 'OVERSUPPLIED';
}

/** Helper to safely check boolean/bit(1) values returned by Directus (handles MySQL buffer objects) */
function isCancelledCheck(val: unknown): boolean {
    if (!val) return false;
    if (val === true || val === 1 || val === '1') return true;
    if (typeof val === 'object' && val !== null && 'data' in val) {
        const data = (val as { data?: number[] }).data;
        if (Array.isArray(data) && data[0] === 1) return true;
    }
    return false;
}

// ─── Main GET handler ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate') || '';
        const endDate = searchParams.get('endDate') || '';
        const branchId = searchParams.get('branchId') || '';
        const productId = searchParams.get('productId') || '';

        // ── 1. Fetch Division 1 active branches ───────────────────────────────
        const branchRows = await fetchDirectusCollection<{
            id: number;
            branch_name: string;
            division_id: number;
        }>('branches', 'filter[isActive][_eq]=1&filter[division_id][_eq]=1&sort=branch_name&limit=-1');

        // In-memory guard: enforce division_id = 1
        const activeBranches = branchRows
            .filter((b) => Number(b.division_id) === 1)
            .map((b) => ({
                id: Number(b.id),
                branch_name: String(b.branch_name || `Branch ${b.id}`),
            }));

        // If branchId is specified, limit to that single branch
        const targetBranches = branchId
            ? activeBranches.filter((b) => b.id === Number(branchId))
            : activeBranches;

        // ── 2. Fetch parent serialized products ───────────────────────────────
        // Include product_name and product_code to guarantee resolution if description is empty string
        let productFilter = 'filter[parent_id][_null]=true&filter[is_serialized][_eq]=1&fields=product_id,description,product_name,product_code&limit=-1';
        if (productId) {
            productFilter += `&filter[product_id][_eq]=${encodeURIComponent(productId)}`;
        }
        const productRows = await fetchDirectusCollection<{
            product_id: number;
            description?: string;
            product_name?: string;
            product_code?: string;
        }>('products', productFilter);

        // Fetch all products to map child variants to their parent product
        const allProductRows = await fetchDirectusCollection<{
            product_id: number;
            parent_id: number | null;
            description?: string;
            product_name?: string;
            product_code?: string;
        }>('products', 'limit=-1&fields=product_id,parent_id,description,product_name,product_code');

        const childToParentMap = new Map<number, number>();
        for (const p of allProductRows) {
            if (p.parent_id) {
                childToParentMap.set(Number(p.product_id), Number(p.parent_id));
            }
        }

        // ── 3. Fetch sales orders (non-cancelled, within date range) ──────────
        let soFilter = [
            'filter[order_status][_nin]=Cancelled,Not Fulfilled',
            'fields=order_id,branch_id,order_date,order_status,isCancelled',
            'limit=-1',
        ].join('&');
        if (branchId) {
            soFilter += `&filter[branch_id][_eq]=${encodeURIComponent(branchId)}`;
        }
        if (startDate) {
            soFilter += `&filter[order_date][_gte]=${encodeURIComponent(startDate)}`;
        }
        if (endDate) {
            soFilter += `&filter[order_date][_lte]=${encodeURIComponent(endDate)}`;
        }
        const rawSalesOrders = await fetchDirectusCollection<{
            order_id: number;
            branch_id: number;
            order_date: string;
            order_status: string;
            isCancelled?: unknown;
        }>('sales_order', soFilter);

        // Filter out cancelled sales orders safely handling MySQL bit(1) buffers
        const salesOrders = rawSalesOrders.filter((so) => !isCancelledCheck(so.isCancelled));

        // ── 4. Fetch all sales order details (joined in-memory) ───────────────
        const soDetails = await fetchDirectusCollection<{
            order_id: number;
            product_id: number;
            ordered_quantity: number;
            served_quantity: number;
        }>('sales_order_details', 'limit=-1&fields=order_id,product_id,ordered_quantity,served_quantity');

        // ── 5. Fetch posted purchase orders (within date range) ───────────────
        let poFilter = [
            'filter[is_posted][_eq]=1',
            'fields=purchase_order_id,branch_id,date',
            'limit=-1',
        ].join('&');
        if (branchId) {
            poFilter += `&filter[branch_id][_eq]=${encodeURIComponent(branchId)}`;
        }
        if (startDate) {
            poFilter += `&filter[date][_gte]=${encodeURIComponent(startDate)}`;
        }
        if (endDate) {
            poFilter += `&filter[date][_lte]=${encodeURIComponent(endDate)}`;
        }
        const purchaseOrders = await fetchDirectusCollection<{
            purchase_order_id: number;
            branch_id: number;
            date: string;
        }>('purchase_order', poFilter);

        // ── 6. Fetch all purchase order products (joined in-memory) ───────────
        const poProducts = await fetchDirectusCollection<{
            purchase_order_id: number;
            product_id: number;
            ordered_quantity: number;
        }>('purchase_order_products', 'limit=-1&fields=purchase_order_id,product_id,ordered_quantity');

        // ── 7. Fetch purchase order receiving (posted only) ───────────────────
        const poReceivings = await fetchDirectusCollection<{
            purchase_order_id: number;
            product_id: number;
            received_quantity: number;
            receipt_date: string;
        }>('purchase_order_receiving', 'filter[isPosted][_eq]=1&limit=-1&fields=purchase_order_id,product_id,received_quantity,receipt_date');

        // ── 8. Fetch on-hand stock snapshot from v_serial_onhand (with cylinder_assets fallback) ──
        let onHandFilter = 'limit=-1&fields=product_id,parent_id,branch_id,serial_number,status';
        if (branchId) {
            onHandFilter += `&filter[branch_id][_eq]=${encodeURIComponent(branchId)}`;
        }
        let onHandRows = await fetchDirectusCollection<{
            product_id: number;
            parent_id: number | null;
            branch_id: number;
            serial_number: string;
            status: string;
        }>('v_serial_onhand', onHandFilter);

        // Fallback to cylinder_assets if v_serial_onhand is empty or 403 (consistent with Inventory Control)
        if (!onHandRows || onHandRows.length === 0) {
            let caFilter = 'limit=-1&fields=id,cylinder_status,current_branch_id,product_id.product_id,product_id.parent_id&filter[cylinder_status][_in]=AVAILABLE,FULL,EMPTY';
            if (branchId) {
                caFilter += `&filter[current_branch_id][_eq]=${encodeURIComponent(branchId)}`;
            }
            const caRows = await fetchDirectusCollection<{
                id: number;
                cylinder_status: string;
                current_branch_id: number;
                product_id?: { product_id: number; parent_id: number | null };
            }>('cylinder_assets', caFilter);

            onHandRows = caRows.map((ca) => {
                const pObj = ca.product_id || { product_id: 0, parent_id: null };
                const status = String(ca.cylinder_status || '').toUpperCase() === 'EMPTY' ? 'Empty' : 'Full';
                return {
                    product_id: Number(pObj.product_id),
                    parent_id: pObj.parent_id !== null && pObj.parent_id !== undefined ? Number(pObj.parent_id) : null,
                    branch_id: Number(ca.current_branch_id),
                    serial_number: String(ca.id),
                    status,
                };
            });
        }

        // ── Build lookup maps ─────────────────────────────────────────────────

        // soDetails keyed by order_id for fast join
        const soDetailsByOrderId = new Map<number, typeof soDetails>();
        for (const d of soDetails) {
            const list = soDetailsByOrderId.get(d.order_id) || [];
            list.push(d);
            soDetailsByOrderId.set(d.order_id, list);
        }

        // poProducts keyed by purchase_order_id
        const poProductsByPoId = new Map<number, typeof poProducts>();
        for (const pp of poProducts) {
            const list = poProductsByPoId.get(pp.purchase_order_id) || [];
            list.push(pp);
            poProductsByPoId.set(pp.purchase_order_id, list);
        }

        // poReceivings keyed by purchase_order_id
        const poReceivingsByPoId = new Map<number, typeof poReceivings>();
        for (const pr of poReceivings) {
            const list = poReceivingsByPoId.get(pr.purchase_order_id) || [];
            list.push(pr);
            poReceivingsByPoId.set(pr.purchase_order_id, list);
        }

        // On-hand stock map keyed by `${parentId}_${branchId}`
        const onHandByKey = new Map<string, { full: number; empty: number }>();
        for (const oh of onHandRows) {
            const parentId = oh.parent_id !== null && oh.parent_id !== undefined ? Number(oh.parent_id) : Number(oh.product_id);
            const bid = Number(oh.branch_id);
            const key = `${parentId}_${bid}`;
            const bucket = onHandByKey.get(key) || { full: 0, empty: 0 };
            if (String(oh.status).toLowerCase() === 'full') {
                bucket.full += 1;
            } else {
                bucket.empty += 1;
            }
            onHandByKey.set(key, bucket);
        }

        // Build SO header map keyed by order_id for quick lookup of branch_id and order_date
        const soHeaderMap = new Map<number, { branch_id: number; order_date: string }>();
        for (const so of salesOrders) {
            soHeaderMap.set(so.order_id, { branch_id: Number(so.branch_id), order_date: so.order_date });
        }

        // Build purchase orders list keyed by branch_id for quick iteration
        const posByBranchId = new Map<number, typeof purchaseOrders>();
        for (const po of purchaseOrders) {
            const list = posByBranchId.get(Number(po.branch_id)) || [];
            list.push(po);
            posByBranchId.set(Number(po.branch_id), list);
        }

        // ── Aggregation: one row per (product × branch) ───────────────────────
        // Calculate date range period length (days) for daily burn rate calculation
        let periodDays = 30; // default 1 month
        if (startDate && endDate) {
            const startMs = new Date(startDate).getTime();
            const endMs = new Date(endDate).getTime();
            if (!isNaN(startMs) && !isNaN(endMs) && endMs >= startMs) {
                periodDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1);
            }
        }

        const allRows: ProductDemandRow[] = [];

        for (const product of productRows) {
            const pid = Number(product.product_id);
            const desc = (product.description?.toString() || '').trim();
            const pNameRaw = (product.product_name?.toString() || '').trim();
            const pCode = (product.product_code?.toString() || '').trim();
            const pName = desc || pNameRaw || (pCode ? `Item ${pCode}` : `Product ${pid}`);

            for (const branch of targetBranches) {
                const bid = branch.id;

                // Filter SOs that belong to this branch (via soHeaderMap)
                const branchSoIds = salesOrders
                    .filter((so) => Number(so.branch_id) === bid)
                    .map((so) => so.order_id);

                // Collect all SO details for this product + branch (rolling up child variants to parent)
                const relevantDetails: { order_id: number; ordered_quantity: number; served_quantity: number }[] = [];
                for (const soId of branchSoIds) {
                    const details = soDetailsByOrderId.get(soId) || [];
                    for (const d of details) {
                        const parentId = childToParentMap.get(Number(d.product_id)) || Number(d.product_id);
                        if (parentId === pid) {
                            relevantDetails.push({
                                order_id: soId,
                                ordered_quantity: Number(d.ordered_quantity) || 0,
                                served_quantity: Number(d.served_quantity) || 0,
                            });
                        }
                    }
                }

                // Core demand metrics
                const totalDemandQty = relevantDetails.reduce((acc, d) => acc + d.ordered_quantity, 0);
                const servedQty = relevantDetails.reduce((acc, d) => acc + d.served_quantity, 0);
                // Unique order count (deduplicated per order)
                const uniqueOrderIds = new Set(relevantDetails.map((d) => d.order_id));
                const totalSoCount = uniqueOrderIds.size;
                const avgOrderQty = totalSoCount > 0 ? totalDemandQty / totalSoCount : null;

                // Build monthly demand trend: bucket ordered_quantity by YYYY-MM
                const monthlyMap = new Map<string, number>();
                for (const soId of uniqueOrderIds) {
                    const header = soHeaderMap.get(soId);
                    if (!header?.order_date) continue;
                    const month = String(header.order_date).slice(0, 7); // YYYY-MM
                    const details = soDetailsByOrderId.get(soId) || [];
                    for (const d of details) {
                        const parentId = childToParentMap.get(Number(d.product_id)) || Number(d.product_id);
                        if (parentId === pid) {
                            monthlyMap.set(month, (monthlyMap.get(month) || 0) + (Number(d.ordered_quantity) || 0));
                        }
                    }
                }
                const monthlyDemandTrend: MonthlyDemandBucket[] = Array.from(monthlyMap.entries())
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .slice(-12)
                    .map(([month, orderedQty]) => ({ month, orderedQty }));

                // Replenishment: aggregate from purchase orders for this branch
                const branchPOs = posByBranchId.get(bid) || [];
                let totalPurchasedQty = 0;
                let totalReceivedQty = 0;

                for (const po of branchPOs) {
                    const ppList = poProductsByPoId.get(po.purchase_order_id) || [];
                    for (const pp of ppList) {
                        const parentId = childToParentMap.get(Number(pp.product_id)) || Number(pp.product_id);
                        if (parentId === pid) {
                            totalPurchasedQty += Number(pp.ordered_quantity) || 0;
                        }
                    }
                    const prList = poReceivingsByPoId.get(po.purchase_order_id) || [];
                    for (const pr of prList) {
                        const parentId = childToParentMap.get(Number(pr.product_id)) || Number(pr.product_id);
                        if (parentId === pid) {
                            totalReceivedQty += Number(pr.received_quantity) || 0;
                        }
                    }
                }

                // On-hand stock from v_serial_onhand / cylinder_assets (keyed by parentId_branchId)
                const onHand = onHandByKey.get(`${pid}_${bid}`) || { full: 0, empty: 0 };
                const stockOnHandFull = onHand.full;
                const stockOnHandEmpty = onHand.empty;
                // Usable inventory is strictly FULL cylinders (child products/empty are statuses/containers)
                const stockOnHandTotal = stockOnHandFull;

                // Skip completely inactive rows unless a specific product filter was requested
                if (totalSoCount === 0 && stockOnHandTotal === 0 && totalPurchasedQty === 0 && totalReceivedQty === 0 && !productId) {
                    continue;
                }

                // Replenishment coverage percentage
                const replenishmentCoverage =
                    totalDemandQty > 0 ? (totalReceivedQty / totalDemandQty) * 100 : null;

                const coverageStatus = classifyCoverage(replenishmentCoverage);

                // Demand Forecasting Intelligence metrics
                const dailyBurnRate = Number((totalDemandQty / periodDays).toFixed(2));
                const forecast7Day = Math.round(dailyBurnRate * 7);
                const forecast14Day = Math.round(dailyBurnRate * 14);
                const projected30DayDemand = Math.round(dailyBurnRate * 30);
                const daysOfSupply = dailyBurnRate > 0
                    ? Math.round(stockOnHandFull / dailyBurnRate)
                    : (stockOnHandFull > 0 ? 999 : 0);
                const suggestedReplenishment = Math.max(0, projected30DayDemand - stockOnHandFull);

                // Estimated Stockout Date & Days remaining
                let estimatedStockoutDate: string | null = null;
                let stockoutDaysRemaining: number | null = null;
                if (stockOnHandFull === 0 && totalDemandQty > 0) {
                    estimatedStockoutDate = 'TODAY';
                    stockoutDaysRemaining = 0;
                } else if (dailyBurnRate > 0) {
                    stockoutDaysRemaining = Math.floor(stockOnHandFull / dailyBurnRate);
                    const stockoutDateObj = new Date();
                    stockoutDateObj.setDate(stockoutDateObj.getDate() + stockoutDaysRemaining);
                    estimatedStockoutDate = stockoutDateObj.toISOString().slice(0, 10);
                }

                // 14-day forward day-by-day forecast schedule
                const forwardDailySchedule: ForwardDayProjection[] = [];
                const scheduleToday = new Date();
                for (let i = 1; i <= 14; i++) {
                    const nextDate = new Date(scheduleToday);
                    nextDate.setDate(scheduleToday.getDate() + i);
                    const dateStr = nextDate.toISOString().slice(0, 10);
                    const dayLabel = nextDate.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                    });
                    const projectedDayDemand = Number(dailyBurnRate.toFixed(1));
                    const endingStock = Math.max(0, Math.round(stockOnHandFull - dailyBurnRate * i));

                    let status: 'SAFE' | 'LOW' | 'STOCKOUT' = 'SAFE';
                    if (endingStock === 0) {
                        status = 'STOCKOUT';
                    } else if (endingStock < dailyBurnRate * 3) {
                        status = 'LOW';
                    }

                    forwardDailySchedule.push({
                        date: dateStr,
                        dayIndex: i,
                        dayLabel,
                        projectedDemand: projectedDayDemand,
                        endingStock,
                        status,
                    });
                }

                let runwayStatus: ProductDemandRow['runwayStatus'];
                if (totalDemandQty === 0) {
                    runwayStatus = 'NO_DEMAND';
                } else if (stockOnHandFull === 0 || daysOfSupply < 7) {
                    runwayStatus = 'CRITICAL_STOCKOUT';
                } else if (daysOfSupply < 15) {
                    runwayStatus = 'LOW_RUNWAY';
                } else if (daysOfSupply <= 45) {
                    runwayStatus = 'BALANCED';
                } else {
                    runwayStatus = 'SURPLUS';
                }

                allRows.push({
                    productId: pid,
                    productName: pName,
                    branchId: bid,
                    branchName: branch.branch_name,
                    totalDemandQty,
                    servedQty,
                    totalSoCount,
                    avgOrderQty,
                    totalPurchasedQty,
                    totalReceivedQty,
                    stockOnHandFull,
                    stockOnHandEmpty,
                    stockOnHandTotal,
                    replenishmentCoverage,
                    coverageStatus,
                    dailyBurnRate,
                    forecast7Day,
                    forecast14Day,
                    projected30DayDemand,
                    daysOfSupply,
                    suggestedReplenishment,
                    estimatedStockoutDate,
                    stockoutDaysRemaining,
                    forwardDailySchedule,
                    runwayStatus,
                    monthlyDemandTrend,
                    demandTrend: monthlyDemandTrend,
                });
            }
        }

        // Rows guaranteed to have activity (totalSoCount > 0 enforced inside loop)
        const existingRows = allRows;

        // ── KPI computation ────────────────────────────────────────────────────
        const totalDemandQtySum = existingRows.reduce((acc, r) => acc + r.totalDemandQty, 0);
        // Only count FULL stock on hand (usable inventory)
        const totalStockOnHand = existingRows.reduce((acc, r) => acc + r.stockOnHandFull, 0);
        const projected7DayDemandTotal = existingRows.reduce((acc, r) => acc + r.forecast7Day, 0);
        const projected14DayDemandTotal = existingRows.reduce((acc, r) => acc + r.forecast14Day, 0);
        const projectedTotalForecast30Day = existingRows.reduce((acc, r) => acc + r.projected30DayDemand, 0);
        const criticalStockoutCount = existingRows.filter((r) => r.runwayStatus === 'CRITICAL_STOCKOUT').length;
        const recommendedReplenishmentTotal = existingRows.reduce((acc, r) => acc + r.suggestedReplenishment, 0);

        const coverageValues = existingRows
            .map((r) => r.replenishmentCoverage)
            .filter((v): v is number => v !== null);
        const avgReplenishmentCoverage =
            coverageValues.length > 0
                ? coverageValues.reduce((a, b) => a + b, 0) / coverageValues.length
                : null;

        const understockedCount = existingRows.filter((r) => r.coverageStatus === 'UNDERSUPPLIED').length;
        const overstockedCount = existingRows.filter((r) => r.coverageStatus === 'OVERSUPPLIED').length;

        const kpis: DemandForecastKPIs = {
            totalProductsEvaluated: existingRows.length,
            totalDemandQty: totalDemandQtySum,
            totalStockOnHand,
            projected7DayDemandTotal,
            projected14DayDemandTotal,
            projectedTotalForecast30Day,
            criticalStockoutCount,
            recommendedReplenishmentTotal,
            avgReplenishmentCoverage,
            understockedCount,
            overstockedCount,
            dataFreshnessTimestamp: new Date().toISOString(),
        };

        // ── AI Tier resolution via Directus 'modules' collection ──────────────
        // Defaults to Executive if lookup fails (most permissive tier)
        let userTier: { tierLevel: number; tierSlug: AiTierSlug; tierName: string } = {
            tierLevel: 3,
            tierSlug: 'executive',
            tierName: 'Executive',
        };

        try {
            const moduleRows = await fetchDirectusCollection<Record<string, unknown>>(
                'modules',
                'filter[slug][_eq]=demand-forecast-intelligence-report&fields=id,slug,ai_tier.*'
            );

            const moduleRecord = moduleRows[0];
            if (moduleRecord && moduleRecord.ai_tier) {
                const aiTierVal = moduleRecord.ai_tier;

                if (typeof aiTierVal === 'object' && aiTierVal !== null) {
                    // Fully expanded ai_tier object
                    const tierObj = aiTierVal as Record<string, unknown>;
                    const rawLevel = Number(tierObj.tier_level);
                    const rawSlug = String(tierObj.slug || '').toLowerCase();
                    const rawName = String(tierObj.name || '');

                    const tierSlug: AiTierSlug =
                        rawSlug === 'pro' || rawLevel === 2
                            ? 'pro'
                            : rawSlug === 'basic' || rawLevel === 1
                            ? 'basic'
                            : 'executive';

                    const tierName = rawName || (tierSlug === 'pro' ? 'Pro' : tierSlug === 'basic' ? 'Basic' : 'Executive');
                    const tierLevel = tierSlug === 'executive' ? 3 : tierSlug === 'pro' ? 2 : 1;
                    userTier = { tierLevel, tierSlug, tierName };
                } else if (typeof aiTierVal === 'number' || typeof aiTierVal === 'string') {
                    // Foreign key stored as ID — fetch ai_tier collection directly
                    const tierRows = await fetchDirectusCollection<Record<string, unknown>>(
                        'ai_tier',
                        `filter[id][_eq]=${encodeURIComponent(String(aiTierVal))}&fields=*`
                    );
                    const tierObj = tierRows[0];
                    if (tierObj) {
                        const rawLevel = Number(tierObj.tier_level);
                        const rawSlug = String(tierObj.slug || '').toLowerCase();
                        const rawName = String(tierObj.name || '');

                        const tierSlug: AiTierSlug =
                            rawSlug === 'pro' || rawLevel === 2
                                ? 'pro'
                                : rawSlug === 'basic' || rawLevel === 1
                                ? 'basic'
                                : 'executive';

                        const tierName = rawName || (tierSlug === 'pro' ? 'Pro' : tierSlug === 'basic' ? 'Basic' : 'Executive');
                        const tierLevel = tierSlug === 'executive' ? 3 : tierSlug === 'pro' ? 2 : 1;
                        userTier = { tierLevel, tierSlug, tierName };
                    }
                }
            }
        } catch (tierErr) {
            console.warn('[DemandForecast] Could not resolve ai_tier dynamically, defaulting to Executive:', tierErr);
        }

        const responsePayload: DemandForecastReportPayload = {
            filter: { startDate, endDate, branchId, productId },
            kpis,
            products: existingRows,
            userTier,
        };

        return NextResponse.json(responsePayload);
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown server error';
        console.error('[DemandForecast API Error]:', errorMsg);
        return NextResponse.json(
            { error: 'Failed to generate demand forecast intelligence report', details: errorMsg },
            { status: 500 }
        );
    }
}
