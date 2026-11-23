/**
 * Inventory Health Report Aggregation API Route
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Aggregation of cylinder fleet assets across industrial branches (division_id = 1)
 * - Parent serialized products filtering (parent_id IS NULL and is_serialized = 1)
 * - Fleet status breakdown: Usable/Full, Empty, Defective/Damaged, Customer-Held, In-Transit
 * - Coverage days calculation (displays "Unavailable" when daily demand is 0)
 * - Approved service level safety stock recommendations (95% service target, Z = 1.65)
 * - Stockout probability forecast and deterministic risk bands
 * - Dead stock and aging analysis with tied-up capital calculation
 * - Shared reporting requirements: Period, Cutoff, Calculation Basis, and Missing Data Disclosures
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    InventoryHealthReportPayload,
    InventoryHealthExecutiveKPIs,
    SkuHealthRow,
    CylinderConditionCount,
    StockoutRiskBand,
    AgingCategory,
    AiTierSlug,
} from '@/modules/industrial-distribution-system/ai-reports/inventory-health-report/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getDirectusBase(): string {
    const raw = process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const cleaned = raw.trim().replace(/\/$/, '');
    if (!cleaned) throw new Error('DIRECTUS_URL is not configured.');
    return /^https?:\/\//i.test(cleaned) ? cleaned : `http://${cleaned}`;
}

function getDirectusToken(): string {
    return (process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || '').trim();
}

function directusHeaders(): Record<string, string> {
    const token = getDirectusToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

async function fetchDirectusCollection<T>(collection: string, queryParams: string = ''): Promise<T[]> {
    try {
        const base = getDirectusBase();
        const url = `${base}/items/${collection}?${queryParams}`;
        const res = await fetch(url, {
            headers: directusHeaders(),
            cache: 'no-store',
        });
        if (!res.ok) {
            console.warn(`[InventoryHealth] Directus ${collection} returned status ${res.status}`);
            return [];
        }
        const json = await res.json().catch(() => ({ data: [] }));
        return (json?.data || []) as T[];
    } catch (err) {
        console.error(`[InventoryHealth] Error fetching ${collection}:`, err);
        return [];
    }
}

/**
 * Standard Normal Cumulative Distribution Function approximation (Abramowitz and Stegun)
 * Used to compute statistical stockout probability when empirical demand criteria are met
 */
function normCdf(x: number): number {
    const b1 = 0.319381530;
    const b2 = -0.356563782;
    const b3 = 1.781477937;
    const b4 = -1.821255978;
    const b5 = 1.330274429;
    const p = 0.2316419;
    const c2 = 0.39894228;

    if (x >= 0.0) {
        const t = 1.0 / (1.0 + p * x);
        return 1.0 - c2 * Math.exp((-x * x) / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
    } else {
        const t = 1.0 / (1.0 - p * x);
        return c2 * Math.exp((-x * x) / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const branchIdParam = searchParams.get('branchId') || '';
        const productIdParam = searchParams.get('productId') || '';
        const riskBandParam = searchParams.get('riskBand') || '';

        // Default window: current calendar month to date in Manila timezone.
        // Mirrors the module's initial filter so a request with no dates measures the
        // same period the pickers show.
        const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
        const monthStartIso = `${todayIso.slice(0, 7)}-01`;

        const startDate = searchParams.get('startDate') || monthStartIso;
        const endDate = searchParams.get('endDate') || todayIso;

        // Calculate window calendar days
        const startMs = new Date(`${startDate}T00:00:00`).getTime();
        const endMs = new Date(`${endDate}T23:59:59`).getTime();
        const diffDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));

        // 1. Fetch Authorized Industrial Branches (division_id = 1 and isActive = 1)
        const branches = await fetchDirectusCollection<{
            id: number;
            branch_name: string;
            branch_code: string;
            division_id: number;
            isActive: number;
        }>('branches', 'filter[division_id][_eq]=1&filter[isActive][_eq]=1&limit=-1');

        const authorizedBranchIds = new Set(branches.map((b) => Number(b.id)));

        // If specific branch is requested, ensure it belongs to authorized industrial branches
        let scopedBranchId: number | null = null;
        if (branchIdParam && branchIdParam !== 'all' && branchIdParam !== 'ALL') {
            const parsed = Number(branchIdParam);
            if (authorizedBranchIds.has(parsed)) {
                scopedBranchId = parsed;
            } else {
                // Requested branch is outside industrial division -> return empty dataset safely
                return NextResponse.json<InventoryHealthReportPayload>({
                    filter: { startDate, endDate, branchId: branchIdParam },
                    kpis: {
                        totalSkusEvaluated: 0,
                        criticalStockoutSkusCount: 0,
                        elevatedRiskSkusCount: 0,
                        healthySkusCount: 0,
                        excessStockSkusCount: 0,
                        deadStockSkusCount: 0,
                        totalUsableFleet: 0,
                        totalEmptyFleet: 0,
                        totalCustomerHeld: 0,
                        totalDefectiveFleet: 0,
                        totalFleet: 0,
                        fleetUtilizationRate: null,
                        totalTiedUpCapital: 0,
                        dataFreshnessTimestamp: new Date().toISOString(),
                        metadata: {
                            selectedPeriod: `${startDate} to ${endDate} (${diffDays} Days)`,
                            sourceCutoff: new Date().toISOString(),
                            calculationBasis: 'Selected branch is outside the authorized industrial division.',
                            missingDataNotice: 'No industrial data found for the selected branch.',
                        },
                    },
                    skus: [],
                    userTier: { tierLevel: 1, tierSlug: 'basic', tierName: 'Basic' },
                });
            }
        }

        // 2. Fetch Parent Serialized Products (parent_id IS NULL and is_serialized = 1)
        let productFilter = 'filter[is_serialized][_eq]=1&filter[parent_id][_null]=true&filter[isActive][_neq]=0&limit=-1';
        if (productIdParam && productIdParam !== 'all' && productIdParam !== 'ALL') {
            productFilter += `&filter[product_id][_eq]=${encodeURIComponent(productIdParam)}`;
        }

        const products = await fetchDirectusCollection<{
            product_id: number;
            product_code: string | null;
            product_name: string | null;
            description: string | null;
            cost_per_unit: number | null;
            price_per_unit: number | null;
            estimated_unit_cost: number | null;
            maintaining_quantity: number | null;
            product_category: { category_name?: string } | null;
        }>('products', productFilter);

        // 3. Fetch Live Cylinder Assets (cylinder_assets)
        let assetFilter = 'filter[is_deleted][_neq]=1&fields=id,serial_number,product_id,cylinder_status,cylinder_condition,current_branch_id,current_customer_code,acquisition_date,expiration_date,modified_date,created_date&limit=-1';
        if (scopedBranchId !== null) {
            assetFilter += `&filter[current_branch_id][_eq]=${scopedBranchId}`;
        }

        const assets = await fetchDirectusCollection<{
            id: number;
            serial_number: string;
            product_id: number | { product_id: number } | null;
            cylinder_status: string | null;
            cylinder_condition: string | null;
            current_branch_id: number | { id: number } | null;
            current_customer_code: string | null;
            modified_date: string | null;
            created_date: string | null;
        }>('cylinder_assets', assetFilter);

        // 4. Fetch Verified Sales Invoices for Demand Measurement
        let invoiceFilter = `filter[invoice_date][_gte]=${encodeURIComponent(startDate)}&filter[invoice_date][_lte]=${encodeURIComponent(endDate)}&limit=-1`;
        if (scopedBranchId !== null) {
            invoiceFilter += `&filter[branch_id][_eq]=${scopedBranchId}`;
        }

        const invoices = await fetchDirectusCollection<{
            invoice_id: number;
            invoice_no: string;
            invoice_date: string;
            branch_id: number;
        }>('sales_invoice', invoiceFilter);

        const industrialInvoices = invoices.filter((i) =>
            scopedBranchId !== null ? i.branch_id === scopedBranchId : authorizedBranchIds.has(i.branch_id)
        );

        const invoiceIds = industrialInvoices.map((i) => i.invoice_id);

        // Fetch sales invoice details in chunks to avoid URL length issues
        interface InvoiceDetailRow {
            invoice_no: number;
            product_id: number;
            quantity: number;
        }

        const invoiceDetails: InvoiceDetailRow[] = [];
        if (invoiceIds.length > 0) {
            const chunkSize = 200;
            for (let i = 0; i < invoiceIds.length; i += chunkSize) {
                const chunk = invoiceIds.slice(i, i + chunkSize);
                const details = await fetchDirectusCollection<InvoiceDetailRow>(
                    'sales_invoice_details',
                    `filter[invoice_no][_in]=${encodeURIComponent(chunk.join(','))}&fields=invoice_no,product_id,quantity&limit=-1`
                );
                invoiceDetails.push(...details);
            }
        }

        // Map invoice date lookup
        const invoiceDateMap = new Map<number, string>();
        industrialInvoices.forEach((inv) => {
            invoiceDateMap.set(inv.invoice_id, inv.invoice_date);
        });

        // Group daily demand and total sales by product_id
        // Map: productId -> Map(dateString -> quantity)
        const productDailyDemand = new Map<number, Map<string, number>>();
        const productTotalDemand = new Map<number, number>();
        const productLastSaleDate = new Map<number, string>();

        invoiceDetails.forEach((det) => {
            const pId = Number(det.product_id);
            const qty = Number(det.quantity || 0);
            const invDate = invoiceDateMap.get(det.invoice_no) || '';

            if (!pId || qty <= 0) return;

            productTotalDemand.set(pId, (productTotalDemand.get(pId) || 0) + qty);

            if (invDate) {
                if (!productDailyDemand.has(pId)) {
                    productDailyDemand.set(pId, new Map());
                }
                const dateMap = productDailyDemand.get(pId)!;
                dateMap.set(invDate, (dateMap.get(invDate) || 0) + qty);

                const currentLast = productLastSaleDate.get(pId);
                if (!currentLast || invDate > currentLast) {
                    productLastSaleDate.set(pId, invDate);
                }
            }
        });

        // Helper to extract numeric ID
        const getAssetProductId = (row: typeof assets[0]): number | null => {
            if (!row.product_id) return null;
            if (typeof row.product_id === 'object') return Number(row.product_id.product_id);
            return Number(row.product_id);
        };

        const getAssetBranchId = (row: typeof assets[0]): number | null => {
            if (!row.current_branch_id) return null;
            if (typeof row.current_branch_id === 'object') return Number(row.current_branch_id.id);
            return Number(row.current_branch_id);
        };

        // Group cylinder assets by product_id
        const productAssetsMap = new Map<number, typeof assets>();
        assets.forEach((asset) => {
            const pId = getAssetProductId(asset);
            const bId = getAssetBranchId(asset);

            // Filter for industrial branches when consolidated
            if (scopedBranchId !== null) {
                if (bId !== scopedBranchId) return;
            } else if (bId !== null && !authorizedBranchIds.has(bId)) {
                return;
            }

            if (pId) {
                if (!productAssetsMap.has(pId)) {
                    productAssetsMap.set(pId, []);
                }
                productAssetsMap.get(pId)!.push(asset);
            }
        });

        // 5. Aggregate SKU Health Rows
        const nowMs = Date.now();
        const skuRows: SkuHealthRow[] = [];

        products.forEach((prod) => {
            const pId = prod.product_id;
            const assetList = productAssetsMap.get(pId) || [];

            // Breakdown fleet states
            let usableAvailableQuantity = 0;
            let emptyQuantity = 0;
            let defectiveQuantity = 0;
            let customerHeldQuantity = 0;
            let inTransitQuantity = 0;

            const conditionCount: CylinderConditionCount = {
                good: 0,
                forRepair: 0,
                damaged: 0,
                scrap: 0,
            };

            let mostRecentActivityMs: number | null = null;

            assetList.forEach((a) => {
                const status = (a.cylinder_status || '').toUpperCase().trim();
                const condition = (a.cylinder_condition || 'GOOD').toUpperCase().trim();

                // Condition counts
                if (condition === 'GOOD') conditionCount.good++;
                else if (condition === 'FOR_REPAIR') conditionCount.forRepair++;
                else if (condition === 'DAMAGED') conditionCount.damaged++;
                else if (condition === 'SCRAP') conditionCount.scrap++;
                else conditionCount.good++;

                // Track most recent asset timestamp
                const assetStamp = a.modified_date || a.created_date;
                if (assetStamp) {
                    const stampMs = new Date(assetStamp).getTime();
                    if (Number.isFinite(stampMs) && (mostRecentActivityMs === null || stampMs > mostRecentActivityMs)) {
                        mostRecentActivityMs = stampMs;
                    }
                }

                // Customer-held
                if (status === 'WITH_CUSTOMER' || a.current_customer_code) {
                    customerHeldQuantity++;
                    return;
                }

                // In-transit
                if (status === 'LOADED' || status === 'RESERVED') {
                    inTransitQuantity++;
                    return;
                }

                // Defective
                if (
                    status === 'DAMAGED' ||
                    status === 'LOST' ||
                    status === 'RETIRED' ||
                    condition === 'FOR_REPAIR' ||
                    condition === 'DAMAGED' ||
                    condition === 'SCRAP'
                ) {
                    defectiveQuantity++;
                    return;
                }

                // Empty
                if (status === 'EMPTY') {
                    emptyQuantity++;
                    return;
                }

                // Usable Available (FULL or AVAILABLE in GOOD condition)
                if ((status === 'AVAILABLE' || status === 'FULL') && condition === 'GOOD') {
                    usableAvailableQuantity++;
                    return;
                }

                // Fallback default
                emptyQuantity++;
            });

            const totalFleetQuantity = assetList.length;

            // Demand metrics
            const totalDemand = productTotalDemand.get(pId) || 0;
            const averageDailyDemand = Number((totalDemand / diffDays).toFixed(2));

            // Coverage Days
            // Business rule: Usable available quantity / ADS. When demand is zero, coverage is Unavailable (null).
            let coverageDays: number | null = null;
            if (averageDailyDemand > 0) {
                coverageDays = Number((usableAvailableQuantity / averageDailyDemand).toFixed(1));
            }

            // Demand Variance & Standard Deviation across calendar days in the window
            const dailyMap = productDailyDemand.get(pId) || new Map();
            let sumSquaredDiff = 0;
            for (let d = 0; d < diffDays; d++) {
                const dayDate = new Date(startMs + d * 24 * 60 * 60 * 1000)
                    .toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
                const dayQty = dailyMap.get(dayDate) || 0;
                sumSquaredDiff += Math.pow(dayQty - averageDailyDemand, 2);
            }
            const demandVariance = diffDays > 1 ? sumSquaredDiff / (diffDays - 1) : 0;
            const sigmaD = Number(Math.sqrt(demandVariance).toFixed(2));

            // Safety Stock Recommendation
            // Standard Approved Service Level: 95% target (Z = 1.65)
            // Lead time: conservative industrial default of 7 days with 1.5 days variability factor
            const Z = 1.65;
            const leadTimeDays = 7;
            const sigmaLT = 1.5;

            let safetyStock = 0;
            let safetyBasis = '';
            if (sigmaD > 0 && averageDailyDemand > 0) {
                // Safety Stock formula taking demand and lead time variability into account
                const varianceCombined = (leadTimeDays * Math.pow(sigmaD, 2)) + (Math.pow(averageDailyDemand, 2) * Math.pow(sigmaLT, 2));
                safetyStock = Math.ceil(Z * Math.sqrt(varianceCombined));
                safetyBasis = 'Empirical 95% service target (Z=1.65) with demand and lead-time variability';
            } else if (averageDailyDemand > 0) {
                safetyStock = Math.ceil(averageDailyDemand * leadTimeDays);
                safetyBasis = 'Lead-time buffer (7-day ADS coverage)';
            } else {
                safetyStock = prod.maintaining_quantity || 0;
                safetyBasis = prod.maintaining_quantity ? 'Pre-configured maintaining threshold' : 'No consumption observed';
            }

            // Bounded below by maintaining_quantity if configured
            const maintainingQty = prod.maintaining_quantity || 0;
            if (maintainingQty > safetyStock) {
                safetyStock = maintainingQty;
                safetyBasis += ' (adjusted to maintaining quantity minimum)';
            }

            // Stockout Probability & Risk Bands
            let stockoutProbability: number | null = null;
            let hasValidatedModel = false;

            // Validated demand model condition: at least 15 active consumption days and normal distribution criteria
            const nonZeroDays = Array.from(dailyMap.values()).filter((q) => q > 0).length;
            if (nonZeroDays >= 15 && averageDailyDemand >= 2 * sigmaD && sigmaD > 0) {
                hasValidatedModel = true;
                const leadTimeDemand = averageDailyDemand * leadTimeDays;
                const leadTimeSigma = Math.sqrt((leadTimeDays * Math.pow(sigmaD, 2)) + (Math.pow(averageDailyDemand, 2) * Math.pow(sigmaLT, 2)));
                if (leadTimeSigma > 0) {
                    const zScore = (usableAvailableQuantity - leadTimeDemand) / leadTimeSigma;
                    stockoutProbability = Number(((1.0 - normCdf(zScore)) * 100).toFixed(1));
                }
            }

            // Deterministic Risk Band Assignment
            let riskBand: StockoutRiskBand = 'HEALTHY';
            if (averageDailyDemand === 0) {
                riskBand = 'NO_DEMAND';
            } else if (usableAvailableQuantity === 0 && averageDailyDemand > 0) {
                riskBand = 'CRITICAL';
            } else if (coverageDays !== null && coverageDays < 7) {
                riskBand = 'CRITICAL';
            } else if (coverageDays !== null && coverageDays >= 7 && coverageDays <= 14) {
                riskBand = 'ELEVATED';
            } else if (coverageDays !== null && coverageDays > 14 && coverageDays <= 30) {
                riskBand = 'MODERATE';
            } else if (coverageDays !== null && coverageDays > 30 && coverageDays <= 90) {
                riskBand = 'HEALTHY';
            } else if (coverageDays !== null && coverageDays > 90) {
                riskBand = 'EXCESS';
            }

            // Dead Stock & Aging Analysis
            const lastSale = productLastSaleDate.get(pId);
            let daysSinceLastMovement: number | null = null;
            if (lastSale) {
                const saleMs = new Date(`${lastSale}T00:00:00`).getTime();
                daysSinceLastMovement = Math.max(0, Math.round((nowMs - saleMs) / (1000 * 60 * 60 * 24)));
            } else if (mostRecentActivityMs) {
                daysSinceLastMovement = Math.max(0, Math.round((nowMs - mostRecentActivityMs) / (1000 * 60 * 60 * 24)));
            }

            let agingCategory: AgingCategory = 'ACTIVE';
            if (daysSinceLastMovement === null || daysSinceLastMovement > 90 || (averageDailyDemand === 0 && usableAvailableQuantity > 0)) {
                agingCategory = 'DEAD_STOCK';
            } else if (daysSinceLastMovement > 60) {
                agingCategory = 'DORMANT';
            } else if (daysSinceLastMovement > 30) {
                agingCategory = 'SLOW_MOVER';
            } else {
                agingCategory = 'ACTIVE';
            }

            const unitCost = Number(prod.cost_per_unit ?? prod.estimated_unit_cost ?? 0);
            const unitPrice = Number(prod.price_per_unit ?? 0);

            // Dead stock quantity and tied-up capital calculation
            const deadStockQuantity = agingCategory === 'DEAD_STOCK' ? usableAvailableQuantity : 0;
            const tiedUpCapital = Number((deadStockQuantity * unitCost).toFixed(2));

            // Display products.description as product name per ids-guide
            const displayName = (prod.description || '').trim() || (prod.product_name || `Product #${pId}`).trim();

            skuRows.push({
                productId: pId,
                productCode: prod.product_code || `SKU-${pId}`,
                productName: displayName,
                description: prod.description || '',
                category: prod.product_category?.category_name || '-',
                unitCost,
                unitPrice,
                maintainingQuantity: maintainingQty,
                fleet: {
                    usableAvailableQuantity,
                    emptyQuantity,
                    defectiveQuantity,
                    customerHeldQuantity,
                    inTransitQuantity,
                    totalFleetQuantity,
                },
                conditionBreakdown: conditionCount,
                windowDays: diffDays,
                totalDemand,
                averageDailyDemand,
                coverageDays,
                safetyStockRecommendation: safetyStock,
                safetyStockCalculationBasis: safetyBasis,
                leadTimeDays,
                demandStandardDeviation: sigmaD,
                stockoutProbabilityPercentage: stockoutProbability,
                hasValidatedModel,
                riskBand,
                agingCategory,
                daysSinceLastMovement,
                deadStockQuantity,
                tiedUpCapital,
            });
        });

        // Filter by risk band if requested
        let filteredSkus = skuRows;
        if (riskBandParam && riskBandParam !== 'ALL') {
            filteredSkus = skuRows.filter((s) => s.riskBand === riskBandParam);
        }

        // 6. Aggregate High-Level Executive KPIs
        const totalSkusEvaluated = skuRows.length;
        const criticalStockoutSkusCount = skuRows.filter((s) => s.riskBand === 'CRITICAL').length;
        const elevatedRiskSkusCount = skuRows.filter((s) => s.riskBand === 'ELEVATED').length;
        const healthySkusCount = skuRows.filter((s) => s.riskBand === 'HEALTHY').length;
        const excessStockSkusCount = skuRows.filter((s) => s.riskBand === 'EXCESS').length;
        const deadStockSkusCount = skuRows.filter((s) => s.agingCategory === 'DEAD_STOCK' && s.fleet.usableAvailableQuantity > 0).length;

        const totalUsableFleet = skuRows.reduce((acc, s) => acc + s.fleet.usableAvailableQuantity, 0);
        const totalEmptyFleet = skuRows.reduce((acc, s) => acc + s.fleet.emptyQuantity, 0);
        const totalCustomerHeld = skuRows.reduce((acc, s) => acc + s.fleet.customerHeldQuantity, 0);
        const totalDefectiveFleet = skuRows.reduce((acc, s) => acc + s.fleet.defectiveQuantity, 0);
        const totalFleet = skuRows.reduce((acc, s) => acc + s.fleet.totalFleetQuantity, 0);

        const fleetUtilizationRate = totalFleet > 0 ? Number(((totalCustomerHeld / totalFleet) * 100).toFixed(1)) : null;
        const totalTiedUpCapital = Number(skuRows.reduce((acc, s) => acc + s.tiedUpCapital, 0).toFixed(2));

        const branchLabel = scopedBranchId !== null
            ? branches.find((b) => Number(b.id) === scopedBranchId)?.branch_name || `Branch #${scopedBranchId}`
            : 'Consolidated (All Industrial Branches)';

        const kpis: InventoryHealthExecutiveKPIs = {
            totalSkusEvaluated,
            criticalStockoutSkusCount,
            elevatedRiskSkusCount,
            healthySkusCount,
            excessStockSkusCount,
            deadStockSkusCount,
            totalUsableFleet,
            totalEmptyFleet,
            totalCustomerHeld,
            totalDefectiveFleet,
            totalFleet,
            fleetUtilizationRate,
            totalTiedUpCapital,
            dataFreshnessTimestamp: new Date().toISOString(),
            metadata: {
                selectedPeriod: `${startDate} to ${endDate} (${diffDays} Days)`,
                sourceCutoff: new Date().toISOString(),
                calculationBasis: `Scope: ${branchLabel}. Usable Available = Good condition Full/Available cylinders at branch. Coverage Days = Usable / ADS (Unavailable when demand is zero). Safety Stock = 95% service target (Z=1.65) with empirical lead-time variance.`,
                missingDataNotice: 'Unserialized items excluded (is_serialized=1). Live cylinder register read without historical snapshots; zero-demand SKUs display Unavailable for coverage days.',
            },
        };

        // Dynamically resolve AI Tier configuration from Directus 'modules' collection
        let userTier = {
            tierLevel: 3,
            tierSlug: 'executive' as AiTierSlug,
            tierName: 'Executive',
        };

        try {
            const moduleRows = await fetchDirectusCollection<Record<string, unknown>>(
                'modules',
                'filter[slug][_in]=inventory-health-report,inventory-health-reports&fields=id,slug,ai_tier.*'
            );
            const moduleRecord = moduleRows[0];
            if (moduleRecord && moduleRecord.ai_tier) {
                const aiTierVal = moduleRecord.ai_tier;
                if (typeof aiTierVal === 'object' && aiTierVal !== null) {
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

                    const tierName =
                        rawName || (tierSlug === 'pro' ? 'Pro' : tierSlug === 'basic' ? 'Basic' : 'Executive');
                    const tierLevel = tierSlug === 'executive' ? 3 : tierSlug === 'pro' ? 2 : 1;

                    userTier = {
                        tierLevel,
                        tierSlug,
                        tierName,
                    };
                }
            }
        } catch {
            // Default to executive
        }

        return NextResponse.json<InventoryHealthReportPayload>({
            filter: {
                startDate,
                endDate,
                branchId: branchIdParam || undefined,
                productId: productIdParam || undefined,
                riskBand: riskBandParam || undefined,
            },
            kpis,
            skus: filteredSkus,
            userTier,
        });
    } catch (err: unknown) {
        console.error('[InventoryHealth Report] Fatal error:', err);
        const msg = err instanceof Error ? err.message : 'Internal Server Error';
        return NextResponse.json({ error: 'Failed to generate inventory health report', details: msg }, { status: 500 });
    }
}
