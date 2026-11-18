// src/app/api/ids/scm/inventory-management/stock-movement-and-variance-report/route.ts
// ==============================================================================
// BFF API Route: Stock Movement and Variance Report (IDS SCM)
//
// Read-only reporting. It never posts inventory, creates a charge or releases a
// payment (spec §2), and it never mutates a source document.
//
// Scope: `branchId` narrows the report to one branch; omitting it reconciles
// every branch the filter bar offers ("All branches"). Reconciliation is always
// performed per branch and never across branches, because a count sheet and a
// movement ledger line only ever belong to one warehouse.
//
// Product scope: only products flagged `is_serialized` are reconciled. The
// movements view accepts no such parameter, so both sources are gated by the
// same id set read from the product master; the counts and the ledger can never
// disagree about what is in scope.
//
// Sources of truth
// - Spring-backed `view-product-movements` ledger (posted in/out per document).
//   Reachable only through SPRING_API_BASE_URL; Directus has no equivalent view.
//   The `/filter` endpoint accepts repeated `branchName` parameters so all
//   branches in scope are read in ONE batched request (avoiding per-branch HTTP
//   429 rate-limit bursts and multi-minute retry stalls).
// - Directus `physical_inventory` + `physical_inventory_details`: committed counts
//   carrying system_count, physical_count and the reporting cutoff.
// - Directus `sales_invoice`: transaction_status, used to detect voids.
//
// Performance architecture
// - Phase 1 (parallel): Directus branch scope + serialized product master (full
//   metadata for all serialized products, eliminating redundant per-product
//   lookups before and after ledger reads).
// - Phase 2 (parallel): Directus committed counts + single batched Spring ledger
//   read (with short-TTL per-session cache & in-flight deduplication; bypassed
//   when `?refresh=1` is supplied).
// - Phase 3 (parallel): Directus voided-invoice check + unnumbered purchase
//   receipt PO reference resolution, narrowed to the filtered product set.
//
// Known source-data limitations, surfaced to the caller instead of hidden:
// - The movements view does not apply later voids, so voided invoices are
//   identified here and excluded from every balance.
// - There is no opening-balance table anywhere in the schema. The opening figure
//   is therefore reconstructed from full movement history before the period,
//   which is only exact for products whose ledger is complete.
// - Access is scoped by the branch the caller selects; the platform has no
//   per-user branch permission table to enforce it further.
// - When a branch ledger batch cannot be read, those branches are omitted from
//   the result and named in `warnings` rather than reported as a zero balance.
//
// Complies with VoSync standards:
// - Full comments left behind for long-term maintainability
// ==============================================================================

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  buildVarianceRows,
  productDisplayName,
  receiptMatchKey,
  summariseKpis,
  type ProductMeta,
} from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/services/stock-movement-variance.calc";
import type {
  RawCountLine,
  RawMovementRow,
  StockMovementVarianceFilters,
  StockMovementVarianceReportResponse,
  StockMovementVarianceRow,
} from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/types/stock-movement-variance.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

/** Attempts per Spring ledger call before the batch is reported as unreadable. */
const LEDGER_ATTEMPTS = 4;

/** Maximum branchName params per fallback chunk if a single batched URL is rejected. */
const FALLBACK_BRANCH_BATCH_SIZE = 8;

/** Short TTL for per-session raw ledger snapshots so rapid filter tweaks stay instant and 429-free. */
const LEDGER_CACHE_TTL_MS = 60_000;

/** Bounded cache size so long-lived server processes never leak memory. */
const LEDGER_CACHE_MAX_ENTRIES = 32;

interface LedgerCacheEntry {
  cachedAt: number;
  tokenHash: string;
  /** Empty string represents an unfiltered (all-products) ledger snapshot. */
  productName: string;
  /** Uppercase trimmed branch names covered by this snapshot. */
  coveredBranches: Set<string>;
  rows: RawMovementRow[];
}

/** Per-session raw ledger cache keyed by `${tokenHash}|${productName}|${branchKey}`. */
const ledgerSnapshotCache = new Map<string, LedgerCacheEntry>();

/** In-flight promise deduplication so concurrent identical requests share one Spring call. */
const inFlightLedgerReads = new Map<string, Promise<BatchedFetchOutcome>>();

interface BatchedFetchOutcome {
  rows: RawMovementRow[] | null;
  error?: string;
  status?: number;
}

/** Hashes the caller's session token so cached snapshots are strictly isolated per session. */
function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

/** Evicts expired entries and keeps the ledger snapshot cache bounded. */
function pruneLedgerCache(now: number): void {
  for (const [key, entry] of ledgerSnapshotCache.entries()) {
    if (now - entry.cachedAt > LEDGER_CACHE_TTL_MS) {
      ledgerSnapshotCache.delete(key);
    }
  }
  while (ledgerSnapshotCache.size > LEDGER_CACHE_MAX_ENTRIES) {
    const oldestKey = ledgerSnapshotCache.keys().next().value;
    if (!oldestKey) break;
    ledgerSnapshotCache.delete(oldestKey);
  }
}

/**
 * Looks up a fresh cached raw ledger snapshot for the same authenticated session
 * whose branch and product scope is a superset of what the caller requested.
 */
function findCachedLedgerSnapshot(
  tokenHash: string,
  scope: BranchScope[],
  ledgerProductName: string
): { rows: RawMovementRow[]; fromAllProducts: boolean } | null {
  const now = Date.now();
  pruneLedgerCache(now);

  const requiredBranches = scope.map((b) => b.name.trim().toUpperCase());

  // Prefer an exact product match first, then fall back to an unfiltered all-products snapshot.
  let fallbackAllProducts: RawMovementRow[] | null = null;

  for (const entry of ledgerSnapshotCache.values()) {
    if (entry.tokenHash !== tokenHash) continue;
    if (now - entry.cachedAt > LEDGER_CACHE_TTL_MS) continue;

    const coversAllBranches = requiredBranches.every((name) => entry.coveredBranches.has(name));
    if (!coversAllBranches) continue;

    if (entry.productName === ledgerProductName) {
      return { rows: entry.rows, fromAllProducts: false };
    }
    if (entry.productName === "" && ledgerProductName !== "") {
      fallbackAllProducts = entry.rows;
    }
  }

  if (fallbackAllProducts) {
    return { rows: fallbackAllProducts, fromAllProducts: true };
  }

  return null;
}

/** Stores a freshly fetched raw ledger snapshot in the per-session cache. */
function storeCachedLedgerSnapshot(
  tokenHash: string,
  scope: BranchScope[],
  ledgerProductName: string,
  rows: RawMovementRow[]
): void {
  const now = Date.now();
  const branchNames = scope.map((b) => b.name.trim().toUpperCase()).sort();
  const key = `${tokenHash}|${ledgerProductName}|${branchNames.join(",")}`;
  ledgerSnapshotCache.set(key, {
    cachedAt: now,
    tokenHash,
    productName: ledgerProductName,
    coveredBranches: new Set(branchNames),
    rows,
  });
  pruneLedgerCache(now);
}

/**
 * Retrieves the Directus endpoint and static token from environment.
 * NEXT_PUBLIC_API_BASE_URL is the value actually configured for this deployment.
 */
function getDirectusConfig(): { url: string; token: string } {
  const url = (
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");

  const token = (
    process.env.DIRECTUS_STATIC_TOKEN ||
    process.env.DIRECTUS_TOKEN ||
    ""
  ).trim();

  return { url: /^https?:\/\//i.test(url) ? url : `http://${url}`, token };
}

/**
 * Performs a Directus read and unwraps the `{ data: [...] }` envelope.
 */
async function directusList<T>(
  base: string,
  token: string,
  collection: string,
  query: string
): Promise<T[]> {
  const res = await fetch(`${base}/items/${collection}?${query}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`${collection} query failed with status ${res.status}`);
  }

  const payload = (await res.json()) as { data?: T[] } | T[];
  return Array.isArray(payload) ? payload : (payload.data ?? []);
}

/** Chunks an array so Directus `_in` filters never exceed a sane URL length. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Runs a batch of async tasks with a bounded concurrency to protect the gateway. */
async function mapPool<In, Out>(
  items: In[],
  limit: number,
  task: (item: In) => Promise<Out>
): Promise<Out[]> {
  const results: Out[] = [];
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

/** A rate limit or a gateway fault is worth waiting out; anything else is final. */
function isRetryable(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/** Honours Retry-After when the gateway sends it, otherwise backs off exponentially. */
function retryWaitMs(res: Response, attempt: number): number {
  const announced = Number(res.headers.get("retry-after"));
  if (Number.isFinite(announced) && announced > 0) return Math.min(announced * 1000, 15000);
  return Math.min(500 * 2 ** attempt, 5000);
}

/**
 * Executes a single Spring ledger read with bounded retry/backoff on transient
 * 429/5xx gateway responses.
 */
async function fetchLedger(url: string, token: string): Promise<Response> {
  let res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });

  for (let attempt = 0; attempt < LEDGER_ATTEMPTS - 1 && isRetryable(res.status); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, retryWaitMs(res, attempt)));
    res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
  }

  return res;
}

/**
 * Fetches one batched `/api/view-product-movements/filter` request carrying all
 * requested branch names in one HTTP round trip, deduplicating identical
 * concurrent in-flight requests per session.
 */
async function fetchBatchedLedgerRequest(
  springBase: string,
  token: string,
  tokenHash: string,
  branches: BranchScope[],
  ledgerProductName: string
): Promise<BatchedFetchOutcome> {
  const sortedNames = branches.map((b) => b.name.trim().toUpperCase()).sort();
  const dedupeKey = `${tokenHash}|${ledgerProductName}|${sortedNames.join(",")}`;

  const existing = inFlightLedgerReads.get(dedupeKey);
  if (existing) return existing;

  const task = (async (): Promise<BatchedFetchOutcome> => {
    const movementsUrl = new URL(`${springBase}/api/view-product-movements/filter`);
    for (const branch of branches) {
      movementsUrl.searchParams.append("branchName", branch.name);
    }
    if (ledgerProductName) {
      movementsUrl.searchParams.set("productName", ledgerProductName);
    }

    try {
      const res = await fetchLedger(movementsUrl.toString(), token);
      if (!res.ok) {
        return { rows: null, error: `status ${res.status}`, status: res.status };
      }

      const parsed = JSON.parse(await res.text());
      if (!Array.isArray(parsed)) {
        return { rows: null, error: "a non-list payload", status: res.status };
      }

      return { rows: parsed as RawMovementRow[], status: res.status };
    } catch (err) {
      return {
        rows: null,
        error: err instanceof Error ? err.message : "unknown error",
      };
    }
  })();

  inFlightLedgerReads.set(dedupeKey, task);
  try {
    return await task;
  } finally {
    inFlightLedgerReads.delete(dedupeKey);
  }
}

/** Unwraps a Directus relation value that may be an id or a nested object. */
function relationId(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const candidate = obj.product_id ?? obj.id ?? obj.branch_id ?? obj.category_id;
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Reads the branch name off a movement row, whichever casing the view used. */
function movementBranchName(row: RawMovementRow): string {
  return String(row.branchName ?? (row as Record<string, unknown>).branch_name ?? "").trim();
}

/** Reads the master product name off a movement row, whichever casing the view used. */
function movementProductName(row: RawMovementRow): string {
  return String(row.productName ?? (row as Record<string, unknown>).product_name ?? "").trim();
}

interface BranchScope {
  id: number;
  name: string;
}

interface SerializedProductRow {
  product_id: number;
  product_code?: string;
  product_name?: string;
  description?: string;
  unit_of_measurement_count?: number;
  product_category?: { category_id?: unknown; category_name?: string };
}

interface BranchLedgerBucket {
  rows: RawMovementRow[] | null;
  error?: string;
  /** How many rows the view returned for this branch before the serialized scope cut them. */
  sourceRowCount: number;
}

/**
 * Splits a batched raw ledger array back into per-branch buckets, gating every
 * row against `serializedProductIds` and shallow-cloning kept rows so cached
 * arrays remain immutable across subsequent requests.
 */
function partitionBatchRowsByBranch(
  rawRows: RawMovementRow[],
  branches: BranchScope[],
  serializedProductIds: Set<number>,
  filterProductName?: string
): Map<number, BranchLedgerBucket> {
  const byId = new Map<number, BranchScope>();
  const byUpperName = new Map<string, BranchScope>();
  const buckets = new Map<number, BranchLedgerBucket>();

  for (const branch of branches) {
    byId.set(branch.id, branch);
    byUpperName.set(branch.name.trim().toUpperCase(), branch);
    buckets.set(branch.id, { rows: [], sourceRowCount: 0 });
  }

  const singleBranchFallback = branches.length === 1 ? branches[0] : null;
  const targetProductUpper = filterProductName ? filterProductName.trim().toUpperCase() : "";

  for (const row of rawRows) {
    // When slicing an unfiltered all-products cache for a single-product query,
    // ignore rows belonging to other products before tallying sourceRowCount.
    if (targetProductUpper) {
      const rowName = movementProductName(row).toUpperCase();
      if (rowName && rowName !== targetProductUpper) continue;
    }

    const rawName = movementBranchName(row);
    const rawBranchId = relationId(row.branchId ?? (row as Record<string, unknown>).branch_id);

    const matchedBranch =
      (rawName ? byUpperName.get(rawName.toUpperCase()) : undefined) ??
      (rawBranchId !== null ? byId.get(rawBranchId) : undefined) ??
      (!rawName && rawBranchId === null ? singleBranchFallback : null);

    if (!matchedBranch) continue;

    const bucket = buckets.get(matchedBranch.id);
    if (!bucket || !bucket.rows) continue;

    bucket.sourceRowCount += 1;

    const pid = relationId(row.productId ?? (row as Record<string, unknown>).product_id);
    if (pid === null || !serializedProductIds.has(pid)) continue;

    // Shallow-copy kept rows so downstream receiptRef attachment never mutates cached arrays.
    const cloned: RawMovementRow = { ...row };
    if (!cloned.branchId) cloned.branchId = matchedBranch.id;
    if (!rawName) cloned.branchName = matchedBranch.name;
    bucket.rows.push(cloned);
  }

  return buckets;
}

/**
 * Loads movement ledgers for all branches in scope with minimal Spring calls:
 * 1. Serves from the 60s per-session raw ledger cache when warm (unless `forceRefresh`).
 * 2. Otherwise sends ONE single batched request containing every `branchName` in scope.
 * 3. Only if the gateway rejects a large URL (HTTP 400/414) does it fall back to
 *    sequential small-chunk batches so it never triggers concurrent 429 bursts.
 */
async function loadBranchLedgers(params: {
  springBase: string;
  token: string;
  tokenHash: string;
  scope: BranchScope[];
  ledgerProductName: string;
  serializedProductIds: Set<number>;
  forceRefresh: boolean;
}): Promise<Map<number, BranchLedgerBucket>> {
  const {
    springBase,
    token,
    tokenHash,
    scope,
    ledgerProductName,
    serializedProductIds,
    forceRefresh,
  } = params;

  // 1. Fast path: per-session warm snapshot (bypassed on explicit Refresh).
  if (!forceRefresh) {
    const cached = findCachedLedgerSnapshot(tokenHash, scope, ledgerProductName);
    if (cached) {
      return partitionBatchRowsByBranch(
        cached.rows,
        scope,
        serializedProductIds,
        cached.fromAllProducts ? ledgerProductName : undefined
      );
    }
  }

  // 2. Primary path: ONE batched Spring request covering every branch in scope.
  const primary = await fetchBatchedLedgerRequest(
    springBase,
    token,
    tokenHash,
    scope,
    ledgerProductName
  );

  if (primary.rows !== null) {
    storeCachedLedgerSnapshot(tokenHash, scope, ledgerProductName, primary.rows);
    return partitionBatchRowsByBranch(primary.rows, scope, serializedProductIds);
  }

  // 3. URL-size fallback: if multi-branch query was rejected with 400/414 on a
  //    large scope, split into smaller sequential chunks to avoid 429 bursts.
  const shouldChunkFallback =
    scope.length > 1 && (primary.status === 400 || primary.status === 414);

  if (!shouldChunkFallback) {
    const failed = new Map<number, BranchLedgerBucket>();
    for (const branch of scope) {
      failed.set(branch.id, { rows: null, error: primary.error, sourceRowCount: 0 });
    }
    return failed;
  }

  const combinedBuckets = new Map<number, BranchLedgerBucket>();
  const allFetchedRows: RawMovementRow[] = [];
  let allChunksSucceeded = true;
  const batches = chunk(scope, FALLBACK_BRANCH_BATCH_SIZE);

  for (let i = 0; i < batches.length; i += 1) {
    if (i > 0) {
      // Gentle sequential pacing protects the gateway rate limiter on fallback chunks.
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const batch = batches[i];
    const outcome = await fetchBatchedLedgerRequest(
      springBase,
      token,
      tokenHash,
      batch,
      ledgerProductName
    );

    if (outcome.rows === null) {
      allChunksSucceeded = false;
      for (const branch of batch) {
        combinedBuckets.set(branch.id, { rows: null, error: outcome.error, sourceRowCount: 0 });
      }
      continue;
    }

    allFetchedRows.push(...outcome.rows);
    const partitioned = partitionBatchRowsByBranch(outcome.rows, batch, serializedProductIds);
    for (const [branchId, bucket] of partitioned.entries()) {
      combinedBuckets.set(branchId, bucket);
    }
  }

  if (allChunksSucceeded) {
    storeCachedLedgerSnapshot(tokenHash, scope, ledgerProductName, allFetchedRows);
  }

  return combinedBuckets;
}

/**
 * The movements view posts some purchase receipts with an empty number and
 * exposes no document id at all, so those rows are traced back through
 * `purchase_order_receiving` on branch + product + the exact second the stock
 * was received, and the parent purchase order is named instead. A match that
 * points at more than one order is left unnamed rather than guessed, because
 * a wrong reference on a receipt is worse than none.
 */
async function attachReceiptReferences(
  movements: RawMovementRow[],
  directusBase: string,
  directusToken: string,
  branchIds: number[]
): Promise<void> {
  const blanks = movements.filter((row) => {
    const docType = String(row.docType ?? "").toUpperCase();
    const docNo = String(row.docNo ?? row.doc_no ?? "").trim();
    return docType === "PURCHASE RECEIPT" && !docNo;
  });
  if (blanks.length === 0 || branchIds.length === 0) return;

  const stamps = blanks
    .map((row) => String(row.ts ?? "").replace("T", " ").slice(0, 19))
    .filter(Boolean)
    .sort();
  if (stamps.length === 0) return;

  const receiving = await directusList<{
    purchase_order_id?: number;
    product_id?: number;
    branch_id?: number;
    received_date?: string;
  }>(
    directusBase,
    directusToken,
    "purchase_order_receiving",
    "fields=purchase_order_id,product_id,branch_id,received_date" +
      "&filter[receipt_no][_null]=true" +
      `&filter[branch_id][_in]=${branchIds.join(",")}` +
      `&filter[received_date][_between]=${encodeURIComponent(
        `${stamps[0].replace(" ", "T")},${stamps[stamps.length - 1].replace(" ", "T")}`
      )}` +
      "&limit=-1"
  );

  const ordersByKey = new Map<string, Set<number>>();
  for (const row of receiving) {
    const orderId = Number(row.purchase_order_id);
    if (!orderId) continue;
    const key = receiptMatchKey(Number(row.branch_id), Number(row.product_id), row.received_date);
    const bucket = ordersByKey.get(key);
    if (bucket) bucket.add(orderId);
    else ordersByKey.set(key, new Set([orderId]));
  }

  const orderIds = [...new Set(receiving.map((row) => Number(row.purchase_order_id)))].filter(
    (id) => id > 0
  );
  const orders =
    orderIds.length === 0
      ? []
      : await directusList<{ purchase_order_id?: number; purchase_order_no?: string }>(
          directusBase,
          directusToken,
          "purchase_order",
          `fields=purchase_order_id,purchase_order_no&filter[purchase_order_id][_in]=${orderIds.join(
            ","
          )}&limit=-1`
        );
  const numberById = new Map(
    orders.map((order) => [Number(order.purchase_order_id), String(order.purchase_order_no ?? "")])
  );

  for (const row of blanks) {
    const key = receiptMatchKey(
      relationId(row.branchId ?? (row as Record<string, unknown>).branch_id) ?? 0,
      relationId(row.productId ?? (row as Record<string, unknown>).product_id) ?? 0,
      row.ts
    );
    const matches = ordersByKey.get(key);
    if (!matches || matches.size !== 1) continue;
    const number = numberById.get([...matches][0]);
    if (number) row.receiptRef = number;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized: Missing access token" },
      { status: 401 }
    );
  }

  const { url: directusBase, token: directusToken } = getDirectusConfig();
  if (!directusBase || !directusToken) {
    return NextResponse.json(
      { ok: false, error: "Directus is not configured for this environment." },
      { status: 500 }
    );
  }

  const springBase = process.env.SPRING_API_BASE_URL?.trim().replace(/\/$/, "");
  if (!springBase) {
    return NextResponse.json(
      { ok: false, error: "SPRING_API_BASE_URL is not configured; movements are unavailable." },
      { status: 500 }
    );
  }

  const search = new URL(req.url).searchParams;
  const startDate = search.get("startDate")?.trim() ?? "";
  const endDate = search.get("endDate")?.trim() ?? "";
  const branchIdRaw = search.get("branchId")?.trim() ?? "";
  const categoryIdRaw = search.get("categoryId")?.trim() ?? "";
  const productIdRaw = search.get("productId")?.trim() ?? "";
  const forceRefresh = search.get("refresh") === "1";

  if (!startDate || !endDate) {
    return NextResponse.json(
      { ok: false, error: "startDate and endDate are both required." },
      { status: 400 }
    );
  }
  if (startDate > endDate) {
    return NextResponse.json(
      { ok: false, error: "The reporting period start cannot be after its cutoff." },
      { status: 400 }
    );
  }

  const requestedBranchId = branchIdRaw ? Number(branchIdRaw) : null;
  if (requestedBranchId !== null && (!Number.isFinite(requestedBranchId) || requestedBranchId <= 0)) {
    return NextResponse.json({ ok: false, error: "branchId is not valid." }, { status: 400 });
  }

  const requestedProductId = productIdRaw ? Number(productIdRaw) : null;
  if (
    requestedProductId !== null &&
    (!Number.isFinite(requestedProductId) || requestedProductId <= 0)
  ) {
    return NextResponse.json({ ok: false, error: "productId is not valid." }, { status: 400 });
  }

  const requestedCategoryId = categoryIdRaw ? Number(categoryIdRaw) : null;
  const warnings: string[] = [];
  const tokenHash = hashSessionToken(token);

  try {
    // ── Phase 1 (parallel): Branch scope & full serialized product master ─────
    // Reading branches (division_id = 1) and serialized products (is_serialized = 1)
    // in parallel cuts two sequential Directus round trips up front, and pre-seeds
    // `productMeta` + `ledgerProductName` so neither needs a second product query.
    const [branchRows, serializedRows] = await Promise.all([
      directusList<{ id: number; branch_name: string; isActive?: boolean }>(
        directusBase,
        directusToken,
        "branches",
        requestedBranchId !== null
          ? `filter[id][_eq]=${requestedBranchId}&filter[division_id][_eq]=1&fields=id,branch_name,isActive`
          : `fields=id,branch_name&filter[isActive][_eq]=1&filter[division_id][_eq]=1&sort=branch_name&limit=-1`
      ),
      directusList<SerializedProductRow>(
        directusBase,
        directusToken,
        "products",
        `fields=product_id,product_code,product_name,description,unit_of_measurement_count,` +
          `product_category.category_id,product_category.category_name` +
          `&filter[is_serialized][_eq]=1&limit=-1`
      ),
    ]);

    const scope: BranchScope[] = branchRows
      .filter((row) => Boolean(row.branch_name))
      .map((row) => ({ id: Number(row.id), name: String(row.branch_name) }));

    if (scope.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            requestedBranchId !== null
              ? `Branch ${requestedBranchId} was not found.`
              : "No active Industrial-division branches are available to report on.",
        },
        { status: 404 }
      );
    }

    for (const branch of scope) {
      const source = branchRows.find((row) => Number(row.id) === branch.id);
      if (source?.isActive === false || Number(source?.isActive ?? 1) === 0) {
        warnings.push(`Branch "${branch.name}" is inactive; historical data is still reported.`);
      }
    }

    const serializedProductIds = new Set<number>();
    const productMeta: Record<number, ProductMeta> = {};
    const masterProductNameById = new Map<number, string>();

    for (const row of serializedRows) {
      const pid = Number(row.product_id);
      if (!Number.isFinite(pid)) continue;
      serializedProductIds.add(pid);

      if (row.product_name) {
        masterProductNameById.set(pid, String(row.product_name).trim());
      }

      const unitCount = Number(row.unit_of_measurement_count ?? 1);
      productMeta[pid] = {
        productCode: row.product_code ? String(row.product_code) : null,
        // ids-guide rule: products.description is the displayed product name.
        productName:
          productDisplayName(row.description, row.product_name, row.product_code) ||
          `Product #${pid}`,
        unitCount: Number.isFinite(unitCount) && unitCount > 0 ? unitCount : 1,
        categoryId: relationId(row.product_category?.category_id),
        categoryName: row.product_category?.category_name
          ? String(row.product_category.category_name)
          : null,
      };
    }

    if (serializedProductIds.size === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No product is flagged as serialized, so there is nothing for this report to reconcile.",
        },
        { status: 404 }
      );
    }

    // Resolve the master product_name required by the Spring movements view.
    // Most selections hit the in-memory map above with zero extra Directus queries.
    let ledgerProductName = "";
    if (requestedProductId !== null) {
      ledgerProductName = masterProductNameById.get(requestedProductId) ?? "";
      if (!ledgerProductName) {
        const productRows = await directusList<{ product_id: number; product_name?: string }>(
          directusBase,
          directusToken,
          "products",
          `fields=product_id,product_name&filter[product_id][_eq]=${requestedProductId}&limit=1`
        );
        ledgerProductName = String(productRows[0]?.product_name ?? "").trim();
        if (!ledgerProductName) {
          return NextResponse.json(
            {
              ok: false,
              error: `Product ${requestedProductId} has no name on record, so the movement ledger cannot be queried for it.`,
            },
            { status: 404 }
          );
        }
      }
    }

    const singleBranch = requestedBranchId !== null;
    const scopeIds = scope.map((branch) => branch.id);
    const branchFilter = singleBranch
      ? `filter[ph_id][branch_id][_eq]=${scopeIds[0]}`
      : `filter[ph_id][branch_id][_in]=${scopeIds.join(",")}`;

    // ── Phase 2 (parallel): Committed physical counts + batched Spring ledger ─
    // Running both sources concurrently hides Directus count latency completely
    // behind the single batched Spring ledger read.
    const cutoffInclusive = encodeURIComponent(`${endDate} 23:59:59`);
    const productCountFilter =
      requestedProductId !== null ? `&filter[product_id][_eq]=${requestedProductId}` : "";

    const countFieldQuery =
      `fields=id,physical_count,system_count,variance,date_encoded,product_id,` +
      `ph_id.id,ph_id.ph_no,ph_id.cutOff_date,ph_id.date_encoded,ph_id.branch_id` +
      `&${branchFilter}` +
      productCountFilter +
      `&filter[ph_id][isComitted][_eq]=1` +
      `&filter[ph_id][isCancelled][_eq]=0` +
      `&filter[ph_id][cutOff_date][_lte]=${cutoffInclusive}` +
      `&sort=-ph_id.cutOff_date&limit=-1`;

    interface RawCountRow {
      id: number;
      physical_count?: number | string;
      system_count?: number | string;
      variance?: number | string;
      date_encoded?: string | null;
      ph_id?: { id?: number; ph_no?: string; cutOff_date?: string; date_encoded?: string; branch_id?: number };
      product_id?: unknown;
    }

    const [rawCountRows, ledgerBuckets] = await Promise.all([
      directusList<RawCountRow>(
        directusBase,
        directusToken,
        "physical_inventory_details",
        countFieldQuery
      ),
      loadBranchLedgers({
        springBase,
        token,
        tokenHash,
        scope,
        ledgerProductName,
        serializedProductIds,
        forceRefresh,
      }),
    ]);

    const countRows = rawCountRows.filter((row) => {
      const pid = relationId(row.product_id);
      return pid !== null && serializedProductIds.has(pid);
    });

    const counts: RawCountLine[] = countRows
      .map((row) => {
        const productId = relationId(row.product_id);
        const ph = row.ph_id ?? {};
        if (productId === null || !ph?.ph_no) return null;
        return {
          id: row.id,
          phId: Number(ph.id ?? 0),
          phNo: String(ph.ph_no),
          branchId: Number(ph.branch_id ?? 0),
          cutOffDate: ph.cutOff_date ? String(ph.cutOff_date) : null,
          dateEncoded: ph.date_encoded
            ? String(ph.date_encoded)
            : row.date_encoded
              ? String(row.date_encoded)
              : null,
          productId,
          systemCount: Number(row.system_count ?? 0),
          physicalCount: Number(row.physical_count ?? 0),
          sourceVariance: Number(row.variance ?? 0),
        } satisfies RawCountLine;
      })
      .filter((line): line is RawCountLine => line !== null);

    // Counts bucket per branch: a count sheet never evidences another branch.
    const countsByBranch = new Map<number, RawCountLine[]>();
    for (const line of counts) {
      const bucket = countsByBranch.get(line.branchId);
      if (bucket) bucket.push(line);
      else countsByBranch.set(line.branchId, [line]);
    }

    const ledgerByBranch = new Map<number, RawMovementRow[]>();
    const movements: RawMovementRow[] = [];
    const reconciled: BranchScope[] = [];

    for (const branch of scope) {
      const result = ledgerBuckets.get(branch.id);
      if (!result || result.rows === null) {
        // A failed ledger is omitted outright: reporting it as an empty ledger
        // would invent variances for a branch that was simply unreachable.
        warnings.push(
          `Branch "${branch.name}" was omitted because its movement ledger could not be read${
            result?.error ? ` (${result.error})` : ""
          }.`
        );
        continue;
      }
      ledgerByBranch.set(branch.id, result.rows);
      reconciled.push(branch);
      movements.push(...result.rows);
      if (result.sourceRowCount === 0) {
        // Only a genuinely empty ledger is worth flagging: a branch whose whole
        // history is non-serialized legitimately contributes no lines here.
        warnings.push(
          `The movements ledger returned no rows for "${branch.name}", so its expected balances are zero.`
        );
      }
    }

    if (reconciled.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No branch movement ledger could be read for this period." },
        { status: 502 }
      );
    }

    // ── Phase 3 (parallel): Void detection & unnumbered receipt PO tracing ───
    // Narrow to the products that will survive product/category filtering so we
    // never query Directus for invoices or receipts on excluded products.
    const relevantMovements = movements.filter((row) => {
      const pid = relationId(row.productId ?? (row as Record<string, unknown>).product_id);
      if (pid === null) return false;
      if (requestedProductId !== null && pid !== requestedProductId) return false;
      if (
        requestedCategoryId !== null &&
        Number.isFinite(requestedCategoryId) &&
        productMeta[pid]?.categoryId !== requestedCategoryId
      ) {
        return false;
      }
      return true;
    });

    const salesInvoiceDocNos = Array.from(
      new Set(
        relevantMovements
          .filter((row) => {
            const docType = String(row.docType ?? "").toUpperCase();
            const docNo = String(row.docNo ?? row.doc_no ?? "").toUpperCase();
            return docType === "SALES INVOICE" || docNo.startsWith("SI");
          })
          .map((row) => String(row.docNo ?? row.doc_no ?? "").trim())
          .filter(Boolean)
      )
    );

    const voidedDocuments = new Set<string>();

    await Promise.all([
      // 3a. Void detection: reversals the ledger view never applied.
      mapPool(chunk(salesInvoiceDocNos, 150), 4, async (batch) => {
        const rows = await directusList<{ invoice_no?: string; transaction_status?: string }>(
          directusBase,
          directusToken,
          "sales_invoice",
          `fields=invoice_no,transaction_status&filter[invoice_no][_in]=${encodeURIComponent(
            batch.join(",")
          )}&filter[transaction_status][_eq]=Void&limit=-1`
        );
        for (const row of rows) {
          if (row.invoice_no) voidedDocuments.add(String(row.invoice_no).toUpperCase());
        }
      }).catch((err) => {
        // Void resolution must not break the report; it degrades to a warning.
        warnings.push(
          `Voided-document check was incomplete: ${err instanceof Error ? err.message : "unknown error"}.`
        );
      }),
      // 3b. Citable purchase-order reference for receipts posted without a number.
      attachReceiptReferences(
        relevantMovements,
        directusBase,
        directusToken,
        reconciled.map((branch) => branch.id)
      ).catch((err) => {
        // A missing reference must not break reconciliation; drawer falls back to supplier.
        warnings.push(
          `Unnumbered receipts could not be traced to their purchase orders: ${
            err instanceof Error ? err.message : "unknown error"
          }.`
        );
      }),
    ]);

    // ── Phase 4: Reconcile each branch, then merge ───────────────────────────
    const rows: StockMovementVarianceRow[] = [];

    for (const branch of reconciled) {
      const branchFilters: StockMovementVarianceFilters = {
        startDate,
        endDate,
        branchId: branch.id,
        categoryId: categoryIdRaw || undefined,
      };

      rows.push(
        ...buildVarianceRows({
          movements: ledgerByBranch.get(branch.id) ?? [],
          counts: countsByBranch.get(branch.id) ?? [],
          productMeta,
          filters: branchFilters,
          scopeBranchName: branch.name,
          voidedDocuments,
        })
      );
    }

    // Category filtering happens after reconciliation: the ledger view exposes no
    // category parameter, so the movement query stays a single round trip.
    let finalRows =
      requestedCategoryId !== null && Number.isFinite(requestedCategoryId)
        ? rows.filter((row) => productMeta[row.productId]?.categoryId === requestedCategoryId)
        : rows;

    // The ledger was queried by product NAME, and names repeat in this schema, so
    // the selected id is applied here to cut any same-name twin back out.
    if (requestedProductId !== null) {
      finalRows = finalRows.filter((row) => row.productId === requestedProductId);
    }

    const response: StockMovementVarianceReportResponse = {
      ok: true,
      generatedAt: new Date().toISOString(),
      filters: {
        startDate,
        endDate,
        branchId: singleBranch ? scopeIds[0] : undefined,
        categoryId: categoryIdRaw || undefined,
        productId: requestedProductId ?? undefined,
        productName: ledgerProductName || undefined,
      },
      branchName: singleBranch ? scope[0].name : null,
      branchesReconciled: reconciled.length,
      rows: finalRows,
      kpis: summariseKpis(finalRows),
      warnings,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected report failure";
    console.error("[stock-movement-variance] GET failed:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
