/**
 * Logistics and Delivery Reliability Report — data aggregation API route
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Aggregates the dispatch chain out of Directus and joins it in memory:
 * - post_dispatch_plan            (the trip; scope = status 'Posted' from an active Industrial depot)
 * - post_dispatch_invoices        (the delivery stops on a trip)
 * - sales_invoice / details       (customer, amounts, invoiced lines)
 * - products                      (invoice lines are rolled up to their serialized root product)
 * - post_dispatch_dispatch_plans  -> dispatch_plan -> cluster   (destination cluster per trip)
 * - post_dispatch_budgeting       -> chart_of_accounts          (what the trip actually cost)
 * - post_dispatch_delivery_proofs / post_dispatch_nte / post_dispatch_gps_logs / user_fuel_allocation
 * - vehicles / user (driver) / branches / customer
 *
 * Revisions:
 * - Every metric on every screen comes from this single route so the four tabs can never disagree.
 * - Arrival commitment rule, tolerance and root-cause split live in services/logisticsMetrics.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    AiTierSlug,
    FleetActivityRow,
    LateShipmentRootCauseRow,
    LogisticsReportPayload,
    ReportExecutiveKPIs,
    RoutePerformanceRow,
    TripExpenseRow,
    TripStopRow,
    TripSummaryRow,
} from '@/modules/industrial-distribution-system/ai-reports/logistics-and-delivery-reliability-report/types';
import {
    DEFAULT_ON_TIME_TOLERANCE_MINUTES,
    HEADLINE_REQUIRES_ARRIVAL_COMMITMENT,
    TOLERANCE_OPTIONS,
    buildEtaBuckets,
    classifyRootCause,
    evaluateTripTiming,
    meanAbsoluteError,
    median,
    percentage,
    round,
    toFlagBit,
    toNumber,
    toPhDate,
} from '@/modules/industrial-distribution-system/ai-reports/logistics-and-delivery-reliability-report/services/logisticsMetrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOG_TAG = '[LogisticsReliability]';

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

async function fetchDirectusCollection<T>(collection: string, queryParams: string = ''): Promise<T[]> {
    const base = getDirectusBase();
    const url = `${base}/items/${collection}?${queryParams}`;
    let res: Response | null = null;
    // The first call after a cold start intermittently dies at the socket layer in dev; one retry keeps
    // a transient blip from turning the whole Apply into a 500.
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            res = await fetch(url, { headers: directusHeaders(), cache: 'no-store' });
            break;
        } catch (err: unknown) {
            if (attempt === 1) throw err;
            console.warn(`${LOG_TAG} Retry after network error on ${collection}:`, err instanceof Error ? err.message : err);
        }
    }
    if (!res) throw new Error(`No response from ${collection}`);
    if (!res.ok) {
        // A failed lookup only ever degrades one column, never the whole report, so log and continue.
        console.error(`${LOG_TAG} Failed to fetch ${collection}: status ${res.status}`);
        return [];
    }
    const json = await res.json().catch(() => ({ data: [] }));
    return (json?.data || []) as T[];
}

/** Directus `_in` filters reject over-long URLs, so id lists are pulled a hundred at a time. */
function chunk<T>(items: T[], size = 100): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

async function fetchByIds<T>(collection: string, idField: string, ids: number[], fields: string): Promise<T[]> {
    if (!ids.length) return [];
    const out: T[] = [];
    for (const group of chunk(ids)) {
        const rows = await fetchDirectusCollection<T>(
            collection,
            `filter[${idField}][_in]=${group.join(',')}&fields=${fields}&limit=-1`
        );
        out.push(...rows);
    }
    return out;
}

/**
 * Directus name columns are nullable and routinely arrive as '' (products.description defaults to '').
 * Returns the first populated value so a caller can fall back to a plain-language label rather than a
 * raw foreign key — the reader has no use for "Product 25552".
 */
function firstText(...values: Array<string | number | null | undefined>): string | null {
    for (const value of values) {
        const text = value === null || value === undefined ? '' : String(value).trim();
        if (text) return text;
    }
    return null;
}

// --- Raw Directus row shapes (only the projected columns are declared) -------------------------

interface RawBranch {
    id: number;
    branch_name: string | null;
    division_id?: number | null;
    isActive?: unknown;
}

interface RawPlan {
    id: number;
    doc_no: string | null;
    status: string | null;
    starting_point: number | null;
    vehicle_id: number | null;
    driver_id: number | null;
    total_distance: number | string | null;
    amount: number | string | null;
    estimated_time_of_dispatch: string | null;
    estimated_time_of_arrival: string | null;
    time_of_dispatch: string | null;
    time_of_arrival: string | null;
    date_encoded: string | null;
    remarks: string | null;
}

interface RawStop {
    id: number;
    post_dispatch_plan_id: number | null;
    invoice_id: number | null;
    distance: number | string | null;
    status: string | null;
    sequence: number | null;
    remarks: string | null;
}

interface RawInvoice {
    invoice_id: number;
    invoice_no: string | number | null;
    order_id: string | number | null;
    customer_code: string | null;
    branch_id: number | null;
    total_amount: number | string | null;
    net_amount: number | string | null;
    isReplaced: unknown;
    transaction_status: string | null;
}

interface RawInvoiceDetail {
    detail_id: number;
    /** Column is named invoice_no but is the FK to sales_invoice.invoice_id. */
    invoice_no: number;
    product_id: number;
    quantity: number | string | null;
    total_amount: number | string | null;
}

interface RawProduct {
    product_id: number;
    parent_id: number | null;
    is_serialized: unknown;
    isActive: unknown;
    description: string | null;
    product_name: string | null;
}

interface RawBudgetRow {
    id: number;
    post_dispatch_plan_id: number | null;
    coa_id: number | null;
    remarks: string | null;
    amount: number | string | null;
}

interface RawCoa {
    coa_id: number;
    account_title: string | null;
}

interface RawJunction {
    post_dispatch_plan_id: number;
    dispatch_plan_id: number;
}

interface RawDispatchPlan {
    dispatch_id: number;
    cluster_id: number | null;
}

interface RawCluster {
    id: number;
    cluster_name: string | null;
}

interface RawVehicle {
    vehicle_id: number;
    vehicle_plate: string | null;
    name: string | null;
    status: string | null;
    branch_id: number | null;
    cbm_length: number | string | null;
    cbm_width: number | string | null;
    cbm_height: number | string | null;
    maximum_weight: number | string | null;
    max_liters: number | string | null;
    vehicle_type: { type_name: string | null } | null;
}

interface RawUser {
    user_id: number;
    user_fname: string | null;
    user_lname: string | null;
}

interface RawCustomer {
    customer_code: string | null;
    customer_name: string | null;
    city: string | null;
    province: string | null;
}

interface RawProof {
    id: number;
    post_dispatch_plan_id: number | null;
    post_dispatch_invoice_id: number | null;
    outcome: string | null;
    remarks: string | null;
    recipient_name: string | null;
    photo_file_id: string | null;
    latitude: number | string | null;
}

interface RawNte {
    id: number;
    doc_no: string | null;
    post_dispatch_invoice_id: number | null;
}

interface RawGps {
    id: number;
    trip_id: number | null;
}

interface RawFuel {
    id: number;
    dispatch_id: number | null;
    liter: number | string | null;
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate') || '';
        const endDate = searchParams.get('endDate') || '';
        const branchIdParam = searchParams.get('branchId') || '';
        const productIdParam = searchParams.get('productId') || '';
        const requestedTolerance = searchParams.get('toleranceMinutes');

        // Tolerance is only ever one of the published choices, so a tampered query string cannot
        // turn the headline percentage into an arbitrary number.
        const toleranceMinutes =
            TOLERANCE_OPTIONS.find((o) => String(o.value) === String(requestedTolerance))?.value ??
            DEFAULT_ON_TIME_TOLERANCE_MINUTES;

        // 1. Depot scope: active branches of the Industrial division only (per approved cut).
        // The whole branch table is read as well, because a vehicle's home depot is frequently a
        // non-industrial branch and naming it beats printing "Branch 51" on a stakeholder screen.
        const branches = await fetchDirectusCollection<RawBranch>(
            'branches',
            'fields=id,branch_name,division_id,isActive&sort=branch_name&limit=-1'
        );
        const branchNameById = new Map<number, string>();
        const depotById = new Map<number, string>();
        for (const b of branches) {
            const name = firstText(b.branch_name) || 'Unnamed branch';
            branchNameById.set(Number(b.id), name);
            if (Number(b.division_id) === 1 && toFlagBit(b.isActive) === 1) depotById.set(Number(b.id), name);
        }

        const answerEmpty = () => {
            const emptyKpis = buildEmptyKpis(toleranceMinutes);
            return NextResponse.json({
                filter: { startDate, endDate, branchId: branchIdParam, productId: productIdParam, toleranceMinutes },
                kpis: emptyKpis,
                trips: [],
                routes: [],
                lateShipments: [],
                fleet: [],
                userTier: { tierLevel: 3, tierSlug: 'executive' as AiTierSlug, tierName: 'Executive' },
            } satisfies LogisticsReportPayload);
        };

        if (!depotById.size) {
            // Nothing is in scope; answer with an empty but well-shaped payload instead of an error.
            return answerEmpty();
        }

        // A depot that is not in the industrial group has no trips by definition. Answering with the
        // whole company there would let a filter look like it worked while it quietly widened the scope.
        const scopedDepotIds = branchIdParam
            ? depotById.has(Number(branchIdParam))
                ? [Number(branchIdParam)]
                : []
            : [...depotById.keys()];
        if (!scopedDepotIds.length) return answerEmpty();

        // 2. Trips. Only a Posted dispatch has both departure and arrival closures recorded.
        const plans = await fetchDirectusCollection<RawPlan>(
            'post_dispatch_plan',
            `filter[status][_eq]=Posted&filter[starting_point][_in]=${scopedDepotIds.join(',')}` +
                `&fields=id,doc_no,status,starting_point,vehicle_id,driver_id,total_distance,amount,` +
                `estimated_time_of_dispatch,estimated_time_of_arrival,time_of_dispatch,time_of_arrival,date_encoded,remarks` +
                `&sort=-date_encoded&limit=-1`
        );

        // Reporting period is measured on date_encoded (the day the dispatch was entered). The
        // comparison is done on the Philippine day part of the stored timestamp, never on Date
        // objects, because Directus stamps a synthetic "Z" onto these naive columns.
        const inWindow = plans.filter((p) => {
            const day = toPhDate(p.date_encoded);
            if (!day) return false;
            if (startDate && day < startDate) return false;
            if (endDate && day > endDate) return false;
            return true;
        });
        const tripIds = inWindow.map((p) => Number(p.id));
        const tripIdSet = new Set(tripIds);

        // 3. Stops per trip.
        const stops = await fetchByIds<RawStop>(
            'post_dispatch_invoices',
            'post_dispatch_plan_id',
            tripIds,
            'id,post_dispatch_plan_id,invoice_id,distance,status,sequence,remarks'
        );
        const stopsByTrip = new Map<number, RawStop[]>();
        for (const s of stops) {
            const tripId = Number(s.post_dispatch_plan_id);
            if (!tripIdSet.has(tripId)) continue;
            const list = stopsByTrip.get(tripId) || [];
            list.push(s);
            stopsByTrip.set(tripId, list);
        }

        // 4. Invoices behind those stops.
        const invoiceIds = [...new Set(stops.map((s) => Number(s.invoice_id)).filter((n) => Number.isFinite(n) && n > 0))];
        const invoices = await fetchByIds<RawInvoice>(
            'sales_invoice',
            'invoice_id',
            invoiceIds,
            'invoice_id,invoice_no,order_id,customer_code,branch_id,total_amount,net_amount,isReplaced,transaction_status'
        );
        const invoiceById = new Map<number, RawInvoice>();
        for (const inv of invoices) invoiceById.set(Number(inv.invoice_id), inv);

        // Replaced invoices are corrected-away duplicates and stay out of every count. Invoice
        // isPosted is deliberately NOT used as a gate: only 4 of the in-scope stop invoices carry
        // it, so gating there would erase the deliveries while leaving the trips themselves posted.
        const liveInvoiceIds = new Set(
            invoices.filter((i) => !toFlagBit(i.isReplaced)).map((i) => Number(i.invoice_id))
        );

        // 5. Invoiced lines, then rolled up to the serialized root product (cylinder family).
        const liveIds = [...liveInvoiceIds];
        const details = await fetchByIds<RawInvoiceDetail>(
            'sales_invoice_details',
            'invoice_no',
            liveIds,
            'detail_id,invoice_no,product_id,quantity,total_amount'
        );

        const productCache = new Map<number, RawProduct>();
        const seedProductIds = [...new Set(details.map((d) => Number(d.product_id)))];
        let frontier = seedProductIds;
        // Invoice lines sit at most a couple of levels under their root; the loop is depth-capped.
        for (let depth = 0; depth < 6 && frontier.length; depth += 1) {
            const unknown = frontier.filter((id) => !productCache.has(id));
            if (!unknown.length) break;
            const rows = await fetchByIds<RawProduct>(
                'products',
                'product_id',
                unknown,
                'product_id,parent_id,is_serialized,isActive,description,product_name'
            );
            for (const p of rows) productCache.set(Number(p.product_id), p);
            frontier = [...new Set(rows.map((p) => Number(p.parent_id)).filter((id) => id > 0 && !productCache.has(id)))];
        }

        const resolveRootId = (productId: number): number | null => {
            let current = productCache.get(productId);
            if (!current) return null;
            let hops = 0;
            const seen = new Set<number>([productId]);
            while (current && current.parent_id !== null && current.parent_id !== undefined && hops < 6) {
                const parentId = Number(current.parent_id);
                if (seen.has(parentId)) return null; // defensive: a malformed cycle is not worth scoring
                seen.add(parentId);
                const parent = productCache.get(parentId);
                if (!parent) return null; // partial hierarchy — refuse to guess the family
                current = parent;
                hops += 1;
            }
            return current ? Number(current.product_id) : null;
        };

        const isSerializedRoot = (rootId: number | null): boolean => {
            if (rootId === null) return false;
            const p = productCache.get(rootId);
            if (!p) return false;
            // Strictly enforce parent_id IS NULL and is_serialized = 1 per workspace rule
            return p.parent_id === null && toFlagBit(p.is_serialized) === 1;
        };

        // invoiceId -> root product id -> invoiced quantity
        const linesByInvoice = new Map<number, Map<number, number>>();
        for (const d of details) {
            const leafProduct = productCache.get(Number(d.product_id));
            // Filter out any line item product that is not serialized
            if (!leafProduct || toFlagBit(leafProduct.is_serialized) !== 1) continue;

            const rootId = resolveRootId(Number(d.product_id));
            if (!isSerializedRoot(rootId)) continue;
            const invId = Number(d.invoice_no);
            const map = linesByInvoice.get(invId) || new Map<number, number>();
            map.set(rootId as number, (map.get(rootId as number) || 0) + toNumber(d.quantity));
            linesByInvoice.set(invId, map);
        }

        // 6. Trip cost: budget lines actually liquidated against the dispatch.
        const budgetRows = await fetchByIds<RawBudgetRow>(
            'post_dispatch_budgeting',
            'post_dispatch_plan_id',
            tripIds,
            'id,post_dispatch_plan_id,coa_id,remarks,amount'
        );
        const coaIds = [...new Set(budgetRows.map((b) => Number(b.coa_id)).filter((n) => n > 0))];
        const coaRows = await fetchByIds<RawCoa>('chart_of_accounts', 'coa_id', coaIds, 'coa_id,account_title');
        const coaTitleById = new Map<number, string>();
        for (const c of coaRows) coaTitleById.set(Number(c.coa_id), String(c.account_title || `COA ${c.coa_id}`));

        const budgetByTrip = new Map<number, TripExpenseRow[]>();
        for (const b of budgetRows) {
            const tripId = Number(b.post_dispatch_plan_id);
            if (!tripIdSet.has(tripId)) continue;
            const list = budgetByTrip.get(tripId) || [];
            list.push({
                coaId: b.coa_id === null ? null : Number(b.coa_id),
                accountTitle: b.coa_id === null ? null : coaTitleById.get(Number(b.coa_id)) || null,
                remarks: b.remarks,
                amount: toNumber(b.amount),
            });
            budgetByTrip.set(tripId, list);
        }

        // 7. Destination cluster: trip -> dispatch plan(s) -> cluster name.
        const junctions = await fetchByIds<RawJunction>(
            'post_dispatch_dispatch_plans',
            'post_dispatch_plan_id',
            tripIds,
            'id,post_dispatch_plan_id,dispatch_plan_id'
        );
        const dpIds = [...new Set(junctions.map((j) => Number(j.dispatch_plan_id)).filter((n) => n > 0))];
        const dispatchPlans = await fetchByIds<RawDispatchPlan>('dispatch_plan', 'dispatch_id', dpIds, 'dispatch_id,cluster_id');
        const clusters = await fetchDirectusCollection<RawCluster>('cluster', 'fields=id,cluster_name&limit=-1');
        const clusterNameById = new Map<number, string>();
        for (const c of clusters) clusterNameById.set(Number(c.id), firstText(c.cluster_name) || 'Unnamed cluster');
        const clusterByDispatch = new Map<number, number | null>();
        for (const d of dispatchPlans) clusterByDispatch.set(Number(d.dispatch_id), d.cluster_id === null ? null : Number(d.cluster_id));

        const clustersByTrip = new Map<number, string[]>();
        for (const j of junctions) {
            const tripId = Number(j.post_dispatch_plan_id);
            if (!tripIdSet.has(tripId)) continue;
            const clusterId = clusterByDispatch.get(Number(j.dispatch_plan_id));
            if (!clusterId) continue;
            const list = clustersByTrip.get(tripId) || [];
            // A cluster row that no longer exists contributes no name, so the trip simply reports
            // "No cluster linked" rather than a bare foreign key.
            const name = clusterNameById.get(clusterId);
            if (!name) continue;
            if (!list.includes(name)) list.push(name);
            clustersByTrip.set(tripId, list);
        }

        // 8. Fleet, drivers, customers.
        const vehicleIds = [...new Set(inWindow.map((p) => Number(p.vehicle_id)).filter((n) => n > 0))];
        const vehicles = await fetchByIds<RawVehicle>(
            'vehicles',
            'vehicle_id',
            vehicleIds,
            'vehicle_id,vehicle_plate,name,status,branch_id,cbm_length,cbm_width,cbm_height,maximum_weight,max_liters,vehicle_type.type_name'
        );
        const vehicleById = new Map<number, RawVehicle>();
        for (const v of vehicles) vehicleById.set(Number(v.vehicle_id), v);

        const driverIds = [...new Set(inWindow.map((p) => Number(p.driver_id)).filter((n) => n > 0))];
        const drivers = await fetchByIds<RawUser>('user', 'user_id', driverIds, 'user_id,user_fname,user_lname');
        const driverById = new Map<number, string>();
        for (const u of drivers) {
            driverById.set(Number(u.user_id), firstText(u.user_fname, u.user_lname) || 'Unnamed driver');
        }

        const customerCodes = [...new Set(invoices.map((i) => i.customer_code).filter((c): c is string => Boolean(c)))];
        const customers: RawCustomer[] = [];
        for (const group of chunk(customerCodes)) {
            const rows = await fetchDirectusCollection<RawCustomer>(
                'customer',
                `filter[customer_code][_in]=${group.map((c) => encodeURIComponent(c)).join(',')}&fields=customer_code,customer_name,city,province&limit=-1`
            );
            customers.push(...rows);
        }
        const customerByCode = new Map<string, RawCustomer>();
        for (const c of customers) if (c.customer_code) customerByCode.set(String(c.customer_code), c);

        // 9. Evidence captures. All four are sparse in production, hence coverage counters.
        //     Proofs and GPS are keyed by trip, NTE by stop, fuel by trip.
        const scopedIds = tripIds.join(',');
        const proofs = scopedIds
            ? await fetchDirectusCollection<RawProof>(
                  'post_dispatch_delivery_proofs',
                  `filter[post_dispatch_plan_id][_in]=${scopedIds}&fields=id,post_dispatch_plan_id,post_dispatch_invoice_id,outcome,remarks,recipient_name,photo_file_id,latitude&limit=-1`
              )
            : [];
        const nteRows = await fetchDirectusCollection<RawNte>(
            'post_dispatch_nte',
            'fields=id,doc_no,post_dispatch_invoice_id&limit=-1'
        );
        const gpsRows = scopedIds
            ? await fetchDirectusCollection<RawGps>('post_dispatch_gps_logs', `filter[trip_id][_in]=${scopedIds}&fields=id,trip_id&limit=-1`)
            : [];
        const fuelRows = await fetchDirectusCollection<RawFuel>('user_fuel_allocation', 'fields=id,dispatch_id,liter&limit=-1');

        const proofsByStop = new Map<number, RawProof>();
        const proofTripIds = new Set<number>();
        for (const p of proofs) {
            if (p.post_dispatch_invoice_id) proofsByStop.set(Number(p.post_dispatch_invoice_id), p);
            if (p.post_dispatch_plan_id) proofTripIds.add(Number(p.post_dispatch_plan_id));
        }
        const nteByStop = new Map<number, string[]>();
        for (const n of nteRows) {
            const stopId = Number(n.post_dispatch_invoice_id);
            if (!stopId) continue;
            const list = nteByStop.get(stopId) || [];
            if (n.doc_no) list.push(String(n.doc_no));
            nteByStop.set(stopId, list);
        }
        const gpsCountByTrip = new Map<number, number>();
        for (const g of gpsRows) {
            const tripId = Number(g.trip_id);
            if (!tripId) continue;
            gpsCountByTrip.set(tripId, (gpsCountByTrip.get(tripId) || 0) + 1);
        }
        const fuelLitersByTrip = new Map<number, number>();
        for (const f of fuelRows) {
            const tripId = Number(f.dispatch_id);
            if (!tripId) continue;
            fuelLitersByTrip.set(tripId, (fuelLitersByTrip.get(tripId) || 0) + toNumber(f.liter));
        }

        // 10. Product scope is applied at trip level (a trip qualifies if it carries the family).
        // Any supplied id is honoured: if no trip in the window invoices that family the answer is an
        // empty report, which is the truth, rather than the unfiltered corpus wearing a filter label.
        const productFilterId = productIdParam ? Number(productIdParam) : null;
        const productFilterUsable = productFilterId !== null && Number.isFinite(productFilterId);

        // 11. Build the trip rows — the single source every tab reads.
        const plannedDistanceByTrip = new Map<number, number>();
        for (const p of inWindow) plannedDistanceByTrip.set(Number(p.id), toNumber(p.total_distance));

        const trips: TripSummaryRow[] = [];
        for (const p of inWindow) {
            const tripId = Number(p.id);
            const rawStops = (stopsByTrip.get(tripId) || []).sort(
                (a, b) => toNumber(a.sequence) - toNumber(b.sequence) || Number(a.id) - Number(b.id)
            );

            const stopRows: TripStopRow[] = rawStops.map((s) => {
                const invoice = s.invoice_id ? invoiceById.get(Number(s.invoice_id)) : undefined;
                const customer = invoice?.customer_code ? customerByCode.get(String(invoice.customer_code)) : undefined;
                const rootMap = s.invoice_id ? linesByInvoice.get(Number(s.invoice_id)) : undefined;
                const products = rootMap
                    ? [...rootMap.entries()].map(([productId, quantity]) => {
                          const row = productCache.get(productId);
                          return {
                              productId,
                              // description is the display label of record; product_name is the house
                              // fallback because description ships as '' on real families (e.g. LPG 11KG).
                              description: firstText(row?.description, row?.product_name) || 'Unnamed product',
                              quantity,
                          };
                      })
                    : [];
                const proof = proofsByStop.get(Number(s.id));
                return {
                    stopId: Number(s.id),
                    sequence: s.sequence === null ? null : Number(s.sequence),
                    invoiceId: s.invoice_id === null ? null : Number(s.invoice_id),
                    invoiceNo: invoice ? String(invoice.invoice_no ?? '') : null,
                    customerCode: invoice?.customer_code ?? null,
                    customerName: customer?.customer_name ?? invoice?.customer_code ?? null,
                    outcome: s.status || 'Not Fulfilled',
                    remarks: s.remarks,
                    nteDocNos: nteByStop.get(Number(s.id)) || [],
                    proofOutcome: proof?.outcome ?? null,
                    proofRemarks: proof?.remarks ?? null,
                    proofPhotoFileId: proof?.photo_file_id ?? null,
                    proofRecipientName: proof?.recipient_name ?? null,
                    products: products.sort((a, b) => b.quantity - a.quantity),
                    deliveredUnits: products.reduce((sum, item) => sum + item.quantity, 0),
                };
            });

            // A stop is in-scope only if it delivers serialized industrial products (is_serialized = 1)
            const scoredStops = stopRows.filter(
                (s) => (s.invoiceId === null || liveInvoiceIds.has(s.invoiceId)) && s.products.length > 0
            );

            // Exclude dispatches that carried no serialized industrial products
            if (scoredStops.length === 0) {
                continue;
            }

            const deliveredUnits = scoredStops.reduce((sum, s) => sum + s.deliveredUnits, 0);

            if (productFilterUsable && !scoredStops.some((s) => s.products.some((pr) => pr.productId === productFilterId))) {
                continue;
            }

            const timing = evaluateTripTiming({
                estimatedDeparture: p.estimated_time_of_dispatch,
                actualDeparture: p.time_of_dispatch,
                estimatedArrival: p.estimated_time_of_arrival,
                actualArrival: p.time_of_arrival,
                toleranceMinutes,
            });

            // A commitment-only reading of the corpus excludes trips whose planner never promised
            // an arrival, and trips whose driver never closed it. The switch documents exactly which
            // reading the headline is using.
            const measurable = HEADLINE_REQUIRES_ARRIVAL_COMMITMENT
                ? timing.arrivalState !== 'NO_COMMITMENT' && timing.arrivalState !== 'NO_ARRIVAL'
                : timing.arrivalState !== 'NO_ARRIVAL';

            const rootCauseCategory = measurable
                ? classifyRootCause({
                      arrivalState: timing.arrivalState,
                      etaErrorMinutes: timing.etaErrorMinutes,
                      departureLagMinutes: timing.departureLagMinutes,
                      transitMinutes: timing.transitLagMinutes,
                      plannedTransitMinutes: timing.plannedTransitMinutes,
                      toleranceMinutes,
                  })
                : 'NOT_MEASURABLE';

            const expenses = budgetByTrip.get(tripId) || [];
            const tripCost = expenses.reduce((sum, e) => sum + e.amount, 0);
            const vehicle = p.vehicle_id ? vehicleById.get(Number(p.vehicle_id)) : undefined;

            // Derive a meaningful destination name so the depot warehouse is never confused with the destination:
            // 1. Linked cluster name(s) from dispatch plan junction (e.g., Central Pangasinan, Ilocos Region)
            // 2. Or distinct customer city/province from the delivery stops (e.g., Dagupan City, La Union)
        
            const linkedClusters = clustersByTrip.get(tripId) || [];
            let destinationName = linkedClusters.join(' / ');
            if (!destinationName) {
                const stopAreas = [
                    ...new Set(
                        scoredStops
                            .map((s) => {
                                const inv = s.invoiceId ? invoiceById.get(s.invoiceId) : undefined;
                                const cust = inv?.customer_code ? customerByCode.get(inv.customer_code) : undefined;
                                if (cust?.city && cust?.province) return `${cust.city}, ${cust.province}`;
                                if (cust?.city) return cust.city;
                                if (cust?.province) return cust.province;
                                return s.customerName || null;
                            })
                            .filter(Boolean)
                    ),
                ];
                destinationName = stopAreas.length > 0 ? stopAreas.slice(0, 2).join(' / ') : '-';
            }

            trips.push({
                tripId,
                docNo: p.doc_no ? String(p.doc_no) : `Trip ${p.id}`,
                status: p.status || 'Posted',
                date: toPhDate(p.date_encoded),
                depotBranchId: p.starting_point === null ? null : Number(p.starting_point),
                depotBranchName:
                    p.starting_point === null
                        ? 'Branch not recorded'
                        : depotById.get(Number(p.starting_point)) || '-',
                driverId: p.driver_id === null ? null : Number(p.driver_id),
                driverName:
                    p.driver_id === null ? 'Unassigned' : driverById.get(Number(p.driver_id)) || '-',
                vehicleId: p.vehicle_id === null ? null : Number(p.vehicle_id),
                vehiclePlate: vehicle?.vehicle_plate || 'Not linked',
                vehicleName: vehicle?.name || '—',
                vehicleType: vehicle?.vehicle_type?.type_name ?? null,
                clusterName: destinationName,
                plannedDeparture: p.estimated_time_of_dispatch,
                actualDeparture: p.time_of_dispatch,
                plannedArrival: p.estimated_time_of_arrival,
                actualArrival: p.time_of_arrival,
                hasArrivalCommitment: timing.hasArrivalCommitment,
                etaErrorMinutes: measurable ? timing.etaErrorMinutes : null,
                departureLagMinutes: timing.departureLagMinutes,
                transitLagMinutes: measurable ? timing.transitLagMinutes : null,
                arrivalState: timing.arrivalState,
                isOnTime: measurable ? timing.isOnTime : null,
                rootCauseCategory,
                stopsCount: scoredStops.length,
                fulfilledStops: scoredStops.filter((s) => s.outcome === 'Fulfilled').length,
                returnsStops: scoredStops.filter((s) => s.outcome === 'Fulfilled With Returns').length,
                concernStops: scoredStops.filter((s) => s.outcome === 'Fulfilled With Concerns').length,
                unfulfilledStops: scoredStops.filter((s) => s.outcome === 'Not Fulfilled').length,
                deliveredUnits,
                tripCost: round(tripCost, 2) || 0,
                approvedAmount: round(toNumber(p.amount), 2) || 0,
                costPerDeliveredUnit: deliveredUnits > 0 ? round(tripCost / deliveredUnits, 2) : null,
                fuelLiters: fuelLitersByTrip.has(tripId) ? round(fuelLitersByTrip.get(tripId) as number, 2) : null,
                hasFuelLog: fuelLitersByTrip.has(tripId),
                hasProofs: proofTripIds.has(tripId),
                hasGpsLogs: (gpsCountByTrip.get(tripId) || 0) > 0,
                hasNte: scoredStops.some((s) => s.nteDocNos.length > 0),
                gpsPointCount: gpsCountByTrip.get(tripId) || 0,
                remarks: p.remarks,
                stops: scoredStops,
                expenses,
            });
        }

        // 12. Tab 2 — route performance. A route is one depot serving one destination cluster.
        const routeGroups = new Map<string, TripSummaryRow[]>();
        for (const t of trips) {
            const key = `${t.depotBranchName}__${t.clusterName}`;
            const list = routeGroups.get(key) || [];
            list.push(t);
            routeGroups.set(key, list);
        }
        const routes: RoutePerformanceRow[] = [...routeGroups.entries()].map(([key, list]) => {
            const measurable = list.filter((t) => t.etaErrorMinutes !== null);
            const errors = measurable.map((t) => t.etaErrorMinutes as number);
            const totalUnits = list.reduce((sum, t) => sum + t.deliveredUnits, 0);
            const totalCost = list.reduce((sum, t) => sum + t.tripCost, 0);
            const totalStops = list.reduce((sum, t) => sum + t.stopsCount, 0);
            return {
                routeKey: key,
                depotBranchId: list[0].depotBranchId,
                depotBranchName: list[0].depotBranchName,
                destinationCluster: list[0].clusterName,
                totalTrips: list.length,
                measurableTrips: measurable.length,
                onTimeTrips: measurable.filter((t) => t.isOnTime === true).length,
                lateTrips: measurable.filter((t) => t.arrivalState === 'LATE').length,
                // Early is counted inside the on-time rate, so the rate alone cannot explain a gap
                // measured in days; the count has to travel with the row.
                earlyTrips: measurable.filter((t) => t.arrivalState === 'EARLY').length,
                onTimeRatePercentage: percentage(measurable.filter((t) => t.isOnTime === true).length, measurable.length),
                meanAbsoluteErrorMinutes: round(meanAbsoluteError(errors), 0),
                medianEtaErrorMinutes: round(median(errors), 0),
                totalStops,
                totalDeliveredUnits: totalUnits,
                totalRouteCost: round(totalCost, 2) || 0,
                averageCostPerTrip: list.length ? round(totalCost / list.length, 2) : null,
                costPerDeliveredUnit: totalUnits > 0 ? round(totalCost / totalUnits, 2) : null,
            };
        }).sort((a, b) => b.totalTrips - a.totalTrips);

        // 13. Tab 3 — late arrivals with the evidence attached to each one.
        const lateShipments: LateShipmentRootCauseRow[] = trips
            .filter((t) => t.arrivalState === 'LATE')
            .map((t) => {
                const evidence: string[] = [];
                if (t.remarks && t.remarks.trim()) evidence.push(`Dispatch remarks: ${t.remarks.trim()}`);
                for (const s of t.stops) {
                    if (s.remarks && s.remarks.trim()) evidence.push(`Stop ${s.invoiceNo || s.stopId} (${s.outcome}): ${s.remarks.trim()}`);
                    if (s.proofRemarks && s.proofRemarks.trim()) evidence.push(`Proof remarks ${s.invoiceNo || s.stopId}: ${s.proofRemarks.trim()}`);
                }
                return {
                    tripId: t.tripId,
                    docNo: t.docNo,
                    date: t.date,
                    depotBranchName: t.depotBranchName,
                    driverName: t.driverName,
                    vehiclePlate: t.vehiclePlate,
                    clusterName: t.clusterName,
                    etaErrorMinutes: t.etaErrorMinutes ?? 0,
                    departureLagMinutes: t.departureLagMinutes,
                    transitLagMinutes: t.transitLagMinutes,
                    rootCauseCategory: t.rootCauseCategory,
                    stopsCount: t.stopsCount,
                    unfulfilledStops: t.unfulfilledStops,
                    returnsStops: t.returnsStops,
                    remarksEvidence: evidence.slice(0, 12),
                    nteDocNos: [...new Set(t.stops.flatMap((s) => s.nteDocNos))],
                    hasProofs: t.hasProofs,
                    hasGpsLogs: t.hasGpsLogs,
                };
            })
            .sort((a, b) => b.etaErrorMinutes - a.etaErrorMinutes);

        // 14. Tab 4 — fleet activity, grouped by the vehicle that actually ran the trip.
        const fleetGroups = new Map<string, TripSummaryRow[]>();
        for (const t of trips) {
            const key = t.vehicleId === null ? `unlinked-${t.tripId}` : `vehicle-${t.vehicleId}`;
            const list = fleetGroups.get(key) || [];
            list.push(t);
            fleetGroups.set(key, list);
        }
        const fleet: FleetActivityRow[] = [...fleetGroups.values()].map((list) => {
            const first = list[0];
            const vehicle = first.vehicleId === null ? undefined : vehicleById.get(first.vehicleId);
            const cbm = vehicle
                ? round(toNumber(vehicle.cbm_length) * toNumber(vehicle.cbm_width) * toNumber(vehicle.cbm_height), 3)
                : null;
            const measurable = list.filter((t) => t.etaErrorMinutes !== null);
            const totalUnits = list.reduce((sum, t) => sum + t.deliveredUnits, 0);
            const totalCost = list.reduce((sum, t) => sum + t.tripCost, 0);
            const totalStops = list.reduce((sum, t) => sum + t.stopsCount, 0);
            return {
                vehicleId: first.vehicleId,
                vehiclePlate: first.vehiclePlate,
                vehicleName: first.vehicleName,
                vehicleType: first.vehicleType,
                // vehicle.branch_id frequently points at rows no longer in `branches`; a bare id reads like
                // a real depot name, so an unresolvable home branch is reported as absent.
                registeredHomeBranch:
                    (vehicle?.branch_id ? branchNameById.get(Number(vehicle.branch_id)) : undefined) ?? null,
                totalTrips: list.length,
                activeDays: new Set(list.map((t) => t.date)).size,
                totalStops,
                totalDeliveredUnits: totalUnits,
                unfulfilledStops: list.reduce((sum, t) => sum + t.unfulfilledStops, 0),
                returnsStops: list.reduce((sum, t) => sum + t.returnsStops, 0),
                totalCost: round(totalCost, 2) || 0,
                costPerDeliveredUnit: totalUnits > 0 ? round(totalCost / totalUnits, 2) : null,
                averageStopsPerTrip: list.length ? round(totalStops / list.length, 1) : null,
                onTimeTrips: measurable.filter((t) => t.isOnTime === true).length,
                measurableTrips: measurable.length,
                onTimeRatePercentage: percentage(measurable.filter((t) => t.isOnTime === true).length, measurable.length),
                ratedWeightKg: vehicle ? round(toNumber(vehicle.maximum_weight), 2) : null,
                ratedCbm: cbm && cbm > 0 ? cbm : null,
                fuelTankLiters: vehicle ? round(toNumber(vehicle.max_liters), 2) : null,
                totalFuelLiters: round(list.reduce((sum, t) => sum + toNumber(t.fuelLiters), 0), 2),
            };
        }).sort((a, b) => b.totalTrips - a.totalTrips);

        // 15. Executive KPIs.
        const measurableTrips = trips.filter((t) => t.etaErrorMinutes !== null);
        const errors = measurableTrips.map((t) => t.etaErrorMinutes as number);
        const onTimeTripsCount = measurableTrips.filter((t) => t.isOnTime === true).length;
        const totalStops = trips.reduce((sum, t) => sum + t.stopsCount, 0);
        const unfulfilledStopsCount = trips.reduce((sum, t) => sum + t.unfulfilledStops, 0);
        const returnsStopsCount = trips.reduce((sum, t) => sum + t.returnsStops, 0);
        const totalDeliveredUnits = trips.reduce((sum, t) => sum + t.deliveredUnits, 0);
        const totalTripCost = trips.reduce((sum, t) => sum + t.tripCost, 0);

        const kpis: ReportExecutiveKPIs = {
            totalTripsEvaluated: trips.length,
            completedTripsCount: trips.filter((t) => t.stopsCount > 0 && t.unfulfilledStops === 0).length,
            measurableTripsCount: measurableTrips.length,
            uncommittedTripsCount: trips.filter((t) => t.arrivalState === 'NO_COMMITMENT').length,
            missingArrivalCount: trips.filter((t) => t.arrivalState === 'NO_ARRIVAL').length,
            onTimeTripsCount,
            lateTripsCount: measurableTrips.filter((t) => t.arrivalState === 'LATE').length,
            earlyTripsCount: measurableTrips.filter((t) => t.arrivalState === 'EARLY').length,
            onTimeSharePercentage: percentage(onTimeTripsCount, measurableTrips.length),
            meanAbsoluteErrorMinutes: round(meanAbsoluteError(errors), 0),
            medianEtaErrorMinutes: round(median(errors), 0),
            depotLateDeparturesCount: trips.filter(
                (t) =>
                    t.rootCauseCategory === 'DEPOT_DISPATCH_DELAY' || t.rootCauseCategory === 'DEPOT_AND_ROAD_DELAY'
            ).length,
            roadLateArrivalsCount: trips.filter(
                (t) => t.rootCauseCategory === 'ROAD_TRANSIT_DELAY' || t.rootCauseCategory === 'DEPOT_AND_ROAD_DELAY'
            ).length,
            totalStops,
            unfulfilledStopsCount,
            unfulfilledStopsPercentage: percentage(unfulfilledStopsCount, totalStops),
            returnsStopsCount,
            totalDeliveredUnits,
            totalTripCost: round(totalTripCost, 2) || 0,
            averageCostPerDeliveredUnit: totalDeliveredUnits > 0 ? round(totalTripCost / totalDeliveredUnits, 2) : null,
            averageStopsPerTrip: trips.length ? round(totalStops / trips.length, 1) : null,
            tripsWithFuelLogs: trips.filter((t) => t.hasFuelLog).length,
            tripsWithProofs: trips.filter((t) => t.hasProofs).length,
            tripsWithGpsLogs: trips.filter((t) => t.hasGpsLogs).length,
            tripsWithDistance: trips.filter((t) => (plannedDistanceByTrip.get(t.tripId) || 0) > 0).length,
            tripsWithNte: trips.filter((t) => t.hasNte).length,
            // The two coverage rows that come from what this application itself records, so the evidence
            // panel is not left plotting columns no screen in this app writes.
            tripsWithRemarks: trips.filter((t) => String(t.remarks ?? '').trim().length > 0).length,
            tripsWithBudgetLines: trips.filter((t) => t.expenses.length > 0).length,
            etaBuckets: buildEtaBuckets(measurableTrips, toleranceMinutes),
            toleranceMinutes,
            dataFreshnessTimestamp: new Date().toISOString(),
        };

        // 16. AI tier is owned by the module row in Directus, exactly as the sibling report does it.
        let userTier = {
            tierLevel: 3,
            tierSlug: 'executive' as AiTierSlug,
            tierName: 'Executive',
        };
        try {
            const moduleRows = await fetchDirectusCollection<Record<string, unknown>>(
                'modules',
                'filter[slug][_in]=logistics-and-delivery-reliability-report,logistics-delivery-reliability-report&fields=id,slug,ai_tier.*'
            );
            const moduleRecord = moduleRows[0];
            const aiTierVal = moduleRecord?.ai_tier;
            let tierObj: Record<string, unknown> | null = null;
            if (aiTierVal && typeof aiTierVal === 'object') {
                tierObj = aiTierVal as Record<string, unknown>;
            } else if (typeof aiTierVal === 'number' || typeof aiTierVal === 'string') {
                const tierRows = await fetchDirectusCollection<Record<string, unknown>>(
                    'ai_tier',
                    `filter[id][_eq]=${encodeURIComponent(String(aiTierVal))}&fields=*`
                );
                tierObj = tierRows[0] || null;
            }
            if (tierObj) {
                const rawLevel = Number(tierObj.tier_level);
                const rawSlug = String(tierObj.slug || '').toLowerCase();
                const rawName = String(tierObj.name || '');
                const tierSlug: AiTierSlug =
                    rawSlug === 'pro' || rawLevel === 2 ? 'pro' : rawSlug === 'basic' || rawLevel === 1 ? 'basic' : 'executive';
                userTier = {
                    tierLevel: tierSlug === 'executive' ? 3 : tierSlug === 'pro' ? 2 : 1,
                    tierSlug,
                    tierName: rawName || (tierSlug === 'pro' ? 'Pro' : tierSlug === 'basic' ? 'Basic' : 'Executive'),
                };
            }
        } catch (tierErr) {
            console.warn(`${LOG_TAG} Could not resolve ai_tier, defaulting to Executive:`, tierErr);
        }

        const responsePayload: LogisticsReportPayload = {
            filter: {
                startDate,
                endDate,
                branchId: branchIdParam,
                productId: productIdParam,
                toleranceMinutes,
            },
            kpis,
            trips,
            routes,
            lateShipments,
            fleet,
            userTier,
        };

        return NextResponse.json(responsePayload);
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown server error';
        console.error(`${LOG_TAG} API Error:`, errorMsg);
        return NextResponse.json(
            { error: 'Failed to generate logistics and delivery reliability report', details: errorMsg },
            { status: 500 }
        );
    }
}

/** KPI shape used when the depot scope resolves to nothing, so the UI never reads undefined. */
function buildEmptyKpis(toleranceMinutes: number): ReportExecutiveKPIs {
    return {
        totalTripsEvaluated: 0,
        completedTripsCount: 0,
        measurableTripsCount: 0,
        uncommittedTripsCount: 0,
        missingArrivalCount: 0,
        onTimeTripsCount: 0,
        lateTripsCount: 0,
        earlyTripsCount: 0,
        onTimeSharePercentage: null,
        meanAbsoluteErrorMinutes: null,
        medianEtaErrorMinutes: null,
        depotLateDeparturesCount: 0,
        roadLateArrivalsCount: 0,
        totalStops: 0,
        unfulfilledStopsCount: 0,
        unfulfilledStopsPercentage: null,
        returnsStopsCount: 0,
        totalDeliveredUnits: 0,
        totalTripCost: 0,
        averageCostPerDeliveredUnit: null,
        averageStopsPerTrip: null,
        tripsWithFuelLogs: 0,
        tripsWithProofs: 0,
        tripsWithGpsLogs: 0,
        tripsWithDistance: 0,
        tripsWithNte: 0,
        tripsWithRemarks: 0,
        tripsWithBudgetLines: 0,
        etaBuckets: [],
        toleranceMinutes,
        dataFreshnessTimestamp: new Date().toISOString(),
    };
}
