import { fetchItems, createItems, bulkUpdateItems } from "../../stock-transfer/services/api";
import type { 
  StockTransferSerialRow,
  SerialOnhandRow,
} from "../types/serialize.types";
import type { 
  StockTransferRow,
  OrderGroup,
} from "../../stock-transfer/types/stock-transfer.types";

const SPRING_API_BASE_URL = process.env.SPRING_API_BASE_URL;

/**
 * Fetches current serial availability from v_serial_onhand view (Spring Boot API).
 */
// AG-COMMENT: Ticket 1 & v_serial_onhand fix - Enforce exact-case query and exact-string comparison without forcing to upper case.
// Queries Spring Boot /api/v-serial-onhand/filter with fallback to server env tokens (vos_access_token) and normalized response parsing.
export async function fetchSerialAvailability(serialNumber: string, branchId?: number, token?: string): Promise<SerialOnhandRow[]> {
  if (!SPRING_API_BASE_URL) {
    console.error("[Serialize Repo] SPRING_API_BASE_URL is not defined");
    return [];
  }

  const rawSerial = serialNumber.trim();
  // Prefer server-side Spring API token over session cookie if missing or rejected
  const authToken = token || process.env.VOS_ACCESS_TOKEN || process.env.vos_access_token;

  // Use /api/v-serial-onhand/filter endpoint with serialNumber and optional branchId
  const filterUrl = new URL(`${SPRING_API_BASE_URL.replace(/\/$/, "")}/api/v-serial-onhand/filter`);
  filterUrl.searchParams.set("serialNumber", rawSerial);
  if (branchId) {
    filterUrl.searchParams.set("branchId", String(branchId));
  }

  const headers: Record<string, string> = {
    "Accept": "application/json",
    ...(authToken ? {
      "Authorization": `Bearer ${authToken}`,
      "Cookie": `vos_access_token=${authToken}`,
    } : {}),
  };

  try {
    let res = await fetch(filterUrl.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
    });

    // If /filter returns 404, fall back to /all endpoint
    if (res.status === 404) {
      const fallbackUrl = new URL(`${SPRING_API_BASE_URL.replace(/\/$/, "")}/api/v-serial-onhand/all`);
      fallbackUrl.searchParams.set("serialNumber", rawSerial);
      if (branchId) {
        fallbackUrl.searchParams.set("branchId", String(branchId));
      }
      res = await fetch(fallbackUrl.toString(), {
        method: "GET",
        headers,
        cache: "no-store",
      });
    }

    if (!res.ok) {
      console.error(`[Serialize Repo] Spring API returned ${res.status} for ${filterUrl.toString()}`);
      return [];
    }

    const data = await res.json();

    interface SerialOnhandRaw {
      serialNumber?: string;
      serial_number?: string;
      branch_id?: number;
      branchId?: number;
      productId?: number;
      product_id?: number;
      parentId?: number;
      parent_id?: number;
      qty_onhand?: number;
      [key: string]: unknown;
    }

    // Handle different shapes returned by Spring Boot (single object, array, or wrapped content/data)
    let rawItems: SerialOnhandRaw[] = [];
    if (Array.isArray(data)) {
      rawItems = data;
    } else if (data && typeof data === "object") {
      const jsonObj = data as Record<string, unknown>;
      if ("productId" in jsonObj || "product_id" in jsonObj || "serialNumber" in jsonObj || "serial_number" in jsonObj) {
        rawItems = [jsonObj as SerialOnhandRaw];
      } else if (Array.isArray(jsonObj.content)) {
        rawItems = jsonObj.content as SerialOnhandRaw[];
      } else if (Array.isArray(jsonObj.data)) {
        rawItems = jsonObj.data as SerialOnhandRaw[];
      }
    }

    // Filter by branchId if provided, enforcing exact case-sensitive serial comparison
    const filtered: SerialOnhandRow[] = rawItems
      .filter((i: SerialOnhandRaw) => {
        const itemSerial = String(i.serialNumber || i.serial_number || "").trim();
        const matchSerial = itemSerial === rawSerial;
        const matchBranch = branchId ? (i.branch_id === branchId || i.branchId === branchId) : true;
        return matchSerial && matchBranch;
      })
      .map((i: SerialOnhandRaw) => ({
        ...i,
        serial_number: String(i.serialNumber || i.serial_number || rawSerial).trim(),
        branch_id: i.branchId || i.branch_id,
        product_id: i.productId || i.product_id,
        parent_id: i.parentId || i.parent_id,
        qty_onhand: i.qty_onhand,
      }));

    return filtered;
  } catch (error) {
    console.error("[Serialize Repo] Failed to fetch serial availability:", error);
    return [];
  }
}

/**
 * Records serial tracking entries in the stock_transfer_serial table.
 */
export async function insertSerialTracking(entries: StockTransferSerialRow[]): Promise<void> {
  if (entries.length === 0) return;
  await createItems("items/stock_transfer_serial", entries);
}

/**
 * Fetches recorded serials for a set of stock transfer IDs.
 * AG-COMMENT: Solves 422 error by querying both Directus scalar integer and relational object filters,
 * then normalizing stock_transfer_id to ensure clean matching in receive verification.
 */
export async function fetchRecordedSerials(transferIds: number[]): Promise<StockTransferSerialRow[]> {
  if (transferIds.length === 0) return [];

  const idList = transferIds.map(Number).filter(Boolean);
  if (idList.length === 0) return [];

  const res = await fetchItems<StockTransferSerialRow>("items/stock_transfer_serial", {
    "filter[_or][0][stock_transfer_id][_in]": idList.join(","),
    "filter[_or][1][stock_transfer_id][id][_in]": idList.join(","),
    "fields": "id,stock_transfer_id,serial_number,scan_type,created_at,created_by",
    limit: -1,
  });
  
  const rawRows = res.data || [];
  return rawRows.map(row => {
    const rawStId = row.stock_transfer_id as unknown;
    const normalizedId = typeof rawStId === "object" && rawStId !== null && "id" in rawStId
      ? Number((rawStId as { id: number }).id)
      : Number(rawStId);

    return {
      ...row,
      stock_transfer_id: normalizedId,
      serial_number: String(row.serial_number || "").trim(),
    };
  });
}

interface TransferUpdatePayload {
  id: number;
  status?: string;
  received_quantity?: number;
  picked_quantity?: number;
  date_encoded?: string;
  date_received?: string;
  receiver_id?: number | null;
  dispatched_by?: number | null;
  dispatched_at?: string;
  approved_by?: number | null;
  rejected_by?: number | null;
  rejected_at?: string;
}

/**
 * Updates status and other fields for a batch of transfers.
 */
export async function bulkUpdateTransfers(items: TransferUpdatePayload[]): Promise<void> {
  if (items.length === 0) return;

  // Group by update payload to use bulk PATCH
  const grouped: Record<string, number[]> = {};
  items.forEach((item) => {
    const { id, ...data } = item;
    const key = JSON.stringify(data);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(id);
  });

  await Promise.all(
    Object.entries(grouped).map(([dataJson, ids]) =>
      bulkUpdateItems("items/stock_transfer", ids, JSON.parse(dataJson))
    )
  );
}

/**
 * Resolves the receiving target branch ID for a set of stock transfer IDs.
 * Used to identify the destination branch during Stock Transfer Receive.
 */
export async function fetchTransferTargetBranch(transferIds: number[]): Promise<number | null> {
  if (transferIds.length === 0) return null;

  interface TransferTargetBranchRow {
    target_branch?: number | { id?: number } | null;
  }

  const res = await fetchItems<TransferTargetBranchRow>("items/stock_transfer", {
    "filter[id][_in]": transferIds.join(","),
    "fields": "target_branch",
    "limit": 1,
  });

  const row = res.data?.[0];
  if (!row || !row.target_branch) return null;

  if (typeof row.target_branch === "object") {
    return row.target_branch.id ? Number(row.target_branch.id) : null;
  }
  return Number(row.target_branch) || null;
}

/**
 * Bulk updates current_branch_id in cylinder_assets for transferred serial numbers upon Receive.
 * Ensures cylinder_assets in Directus matches destination branch in Spring API ledger.
 */
export async function updateCylinderAssetsBranchForSerials(serials: string[], targetBranchId: number): Promise<void> {
  if (serials.length === 0 || !targetBranchId) return;

  const uniqueSerials = Array.from(new Set(serials.map(s => s.trim()))).filter(Boolean);
  if (uniqueSerials.length === 0) return;

  const upperSerials = uniqueSerials.map(s => s.toUpperCase());
  const lowerSerials = uniqueSerials.map(s => s.toLowerCase());

  interface CylinderAssetSimpleRow {
    id: number;
    serial_number?: string;
  }

  // Fetch matching cylinder assets by serial numbers (case-insensitive)
  const res = await fetchItems<CylinderAssetSimpleRow>("items/cylinder_assets", {
    "filter[_or][0][serial_number][_in]": upperSerials.join(","),
    "filter[_or][1][serial_number][_in]": lowerSerials.join(","),
    "fields": "id,serial_number",
    "limit": -1,
  });

  const matchingAssets = res.data || [];
  if (matchingAssets.length > 0) {
    const assetIds = matchingAssets.map(a => a.id);
    await bulkUpdateItems("items/cylinder_assets", assetIds, {
      current_branch_id: targetBranchId,
    });
  }
}

/**
 * Fetches stock transfers grouped by order_no with pagination and search support.
 * This version paginates by unique order numbers to ensure the sidebar fills correctly.
 */
export async function fetchStockTransferGroups(params: {
  status: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: OrderGroup[]; hasMore: boolean }> {
  const { status, search, limit = 10, offset = 0 } = params;

  // 1. Fetch unique order numbers matching the criteria
  // We use a larger limit for the inner fetch if needed, but the primary goal 
  // is to get the set of order_nos for this 'page' of orders.
  const distinctQueryParams: Record<string, string | number | boolean | undefined> = {
    "filter[status][_in]": status,
    // Restrict transfer groups strictly to Industrial division branches (division_id = 1)
    "filter[source_branch][division_id][_eq]": 1,
    "fields": "order_no,date_encoded",
    "sort": "-date_encoded",
    "limit": -1, // We'll handle the unique slicing in JS for simplicity with Directus
  };

  if (search) {
    distinctQueryParams["filter[_or][0][order_no][_icontains]"] = search;
    distinctQueryParams["filter[_or][1][source_branch][branch_name][_icontains]"] = search;
    distinctQueryParams["filter[_or][2][target_branch][branch_name][_icontains]"] = search;
  }

  const distinctRes = await fetchItems<StockTransferRow>("items/stock_transfer", distinctQueryParams);
  const allRows = distinctRes.data || [];
  
  // Get unique order numbers in order of date_encoded
  const uniqueOrderNos: string[] = [];
  const seen = new Set<string>();
  for (const row of allRows) {
    if (!seen.has(row.order_no)) {
      seen.add(row.order_no);
      uniqueOrderNos.push(row.order_no);
    }
  }

  // Slice for the current page of GROUPS
  const pagedOrderNos = uniqueOrderNos.slice(offset, offset + limit);
  const hasMore = uniqueOrderNos.length > offset + limit;

  if (pagedOrderNos.length === 0) {
    return { data: [], hasMore: false };
  }

  // 2. Fetch full details for the specific order numbers on this page
  const detailsQueryParams: Record<string, string | number | boolean | undefined> = {
    "filter[order_no][_in]": pagedOrderNos.join(","),
    "limit": -1,
    "sort": "-date_encoded",
    "fields": "*,product_id.*,product_id.is_serialized,source_branch.*,target_branch.*",
  };

  const detailsRes = await fetchItems<StockTransferRow>("items/stock_transfer", detailsQueryParams);
  const rawData = detailsRes.data || [];

  // Use the helper to group the details
  const { groupByOrderNo } = await import("../../stock-transfer/services/stock-transfer.helpers");
  const groups = groupByOrderNo(rawData);

  // Sort groups to match the order of pagedOrderNos
  const sortedGroups = pagedOrderNos.map(no => groups.find(g => g.orderNo === no)).filter(Boolean) as OrderGroup[];

  return {
    data: sortedGroups,
    hasMore,
  };
}
