// ============================================================================
// Customer History — Pure Industrial Scope Resolution
// Enforces:
//   - branches: division_id = 1 AND isActive = 1
//   - products: parent_id IS NULL AND is_serialized = 1
//     (child variants resolve up to their parent; parent must pass both gates)
//   - product label: products.description (with fallback to "-" only if absent)
// ============================================================================

import type { RawBranchRow, RawProductRow } from "../types/customer-history.types";
import { display, isTruthyFlag } from "./customer-history.helpers";

export interface IndustrialScope {
  branchMap: Map<number, RawBranchRow>;
  authorizedBranchIds: number[];
  productMap: Map<number, RawProductRow>;
  parentProductMap: Map<number, RawProductRow>;
}

export function buildIndustrialScope(
  branches: RawBranchRow[],
  products: RawProductRow[]
): IndustrialScope {
  const branchMap = new Map<number, RawBranchRow>();
  for (const b of branches) {
    if (Number(b.division_id) === 1 && isTruthyFlag(b.isActive)) {
      branchMap.set(Number(b.id), b);
    }
  }

  const productMap = new Map<number, RawProductRow>();
  const parentProductMap = new Map<number, RawProductRow>();

  for (const p of products) {
    const pid = Number(p.product_id);
    productMap.set(pid, p);
    const isParent = p.parent_id === null || p.parent_id === undefined || Number(p.parent_id) <= 0;
    if (isParent && isTruthyFlag(p.is_serialized)) {
      parentProductMap.set(pid, p);
    }
  }

  return {
    branchMap,
    authorizedBranchIds: Array.from(branchMap.keys()),
    productMap,
    parentProductMap,
  };
}

/**
 * Checks if a branch_id belongs to an active division_id = 1 branch
 * and optionally matches a specific user-selected branchId.
 */
export function isInScopeBranch(
  branchId: number | null | undefined,
  scope: IndustrialScope,
  selectedBranchId?: string
): boolean {
  if (branchId === null || branchId === undefined) return false;
  const bid = Number(branchId);
  if (!scope.branchMap.has(bid)) return false;
  if (selectedBranchId && selectedBranchId !== "all") {
    return bid === Number(selectedBranchId);
  }
  return true;
}

/**
 * Resolves a raw product_id (either parent or child variant) to its
 * qualifying parent product_id (parent_id IS NULL and is_serialized = 1).
 * Returns null if the product is out of scope or filtered out.
 */
export function resolveQualifyingParentProductId(
  rawProductId: number | string | null | undefined,
  scope: IndustrialScope,
  selectedProductId?: string
): number | null {
  if (rawProductId === null || rawProductId === undefined) return null;
  const pid = Number(rawProductId);
  const prod = scope.productMap.get(pid);
  if (!prod) return null;

  const rootId =
    prod.parent_id !== null && prod.parent_id !== undefined && Number(prod.parent_id) > 0
      ? Number(prod.parent_id)
      : pid;

  const root = scope.parentProductMap.get(rootId);
  if (!root) return null;

  if (selectedProductId && selectedProductId !== "all") {
    if (Number(root.product_id) !== Number(selectedProductId)) return null;
  }

  return Number(root.product_id);
}

/**
 * Per ids-guide: shows products.description as product name.
 * Falls back to "-" only if description is genuinely absent.
 */
export function getParentProductName(
  parentProductId: number,
  scope: IndustrialScope
): string {
  const root = scope.parentProductMap.get(parentProductId);
  return display(root?.description);
}

export function getBranchName(
  branchId: number | null | undefined,
  scope: IndustrialScope
): string {
  if (branchId === null || branchId === undefined) return "-";
  const branch = scope.branchMap.get(Number(branchId));
  return display(branch?.branch_name);
}
