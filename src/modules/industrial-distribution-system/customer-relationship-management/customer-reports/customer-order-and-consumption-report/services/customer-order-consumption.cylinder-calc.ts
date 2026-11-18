// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/services/customer-order-consumption.cylinder-calc.ts
// ============================================================
// Serialized Cylinder quantity and weight calculations.
// Adheres strictly to rules:
// - is_serialized = 1 required for cylinder products
// - is_industrial = 1 categories extract cylinder sizes (1.4kg, 11kg, 50kg)
// - Fallback to product description for size resolution if category label is generic
// ============================================================

import type {

  RawCategoryRow,
  RawProductRow,
  ReportException,
} from "../types/customer-order-consumption.types";
import { isTruthyFlag, toNumber } from "./customer-order-consumption.helpers";

export function parseCategorySizeKg(
  text: string | null | undefined
): number | null {
  if (!text) return null;
  // AG-COMMENT: Parses cylinder size e.g. "11kg", "11 kg", "11-kg", "1.4kg", "50kg"
  const match = /\b(\d+(?:\.\d+)?)[-\s]*kgs?\b/i.exec(text);
  if (!match) return null;
  const size = Number.parseFloat(match[1]);
  return Number.isFinite(size) && size > 0 ? size : null;
}

export function resolveCylinderSizeKg(
  category: RawCategoryRow | undefined,
  product: RawProductRow | undefined
): number | null {
  // 1. Try category name (e.g. "11kg", "1.4kg", "50kg")
  const fromCategory = parseCategorySizeKg(category?.category_name);
  if (fromCategory != null && fromCategory > 0) return fromCategory;

  // 2. Try product description (e.g. "LPG (11KG AS Cylinder) CTA - ECTA# 71932")
  const fromDesc = parseCategorySizeKg(product?.description);
  if (fromDesc != null && fromDesc > 0) return fromDesc;

  // 3. Try product name
  const fromName = parseCategorySizeKg(product?.product_name);
  if (fromName != null && fromName > 0) return fromName;

  return null;
}

export interface CylinderEvaluation {
  isSerialized: boolean;
  isIndustrial: boolean;
  cylinderSizeKg: number | null;
  effectiveKgPerUnit: number;
  exceptions: ReportException[];
}

export function evaluateCylinderProduct(
  product: RawProductRow | undefined,
  category: RawCategoryRow | undefined,
  customerCode: string,
  customerName: string,
  docType: "SALES_ORDER" | "SALES_INVOICE" | "SALES_RETURN" | "PRODUCT",
  docNo: string
): CylinderEvaluation {
  const exceptions: ReportException[] = [];

  if (!product) {
    return {
      isSerialized: false,
      isIndustrial: false,
      cylinderSizeKg: null,
      effectiveKgPerUnit: 0,
      exceptions,
    };
  }

  const isSerialized = isTruthyFlag(product.is_serialized);
  // AG-COMMENT: Non-serialized products are completely excluded from the report and do not generate exceptions
  if (!isSerialized) {
    return {
      isSerialized: false,
      isIndustrial: false,
      cylinderSizeKg: null,
      effectiveKgPerUnit: 0,
      exceptions: [],
    };
  }

  const isIndustrial = category ? isTruthyFlag(category.is_industrial) : false;
  // AG-COMMENT: Non-industrial categories are completely excluded from the report and do not generate exceptions
  if (!isIndustrial) {
    return {
      isSerialized: true,
      isIndustrial: false,
      cylinderSizeKg: null,
      effectiveKgPerUnit: 0,
      exceptions: [],
    };
  }

  // Resolve standard cylinder size: 1.4kg, 11kg, 50kg
  const resolvedSize = resolveCylinderSizeKg(category, product);
  let effectiveKg = resolvedSize;

  if (effectiveKg == null || effectiveKg <= 0) {
    const fallback = toNumber(product.weight || product.product_weight, 0);
    if (fallback > 0) {
      effectiveKg = fallback;
    } else {
      exceptions.push({
        code: "MISSING_PRODUCT_WEIGHT",
        channel: "CYLINDER",
        customerCode,
        customerName,
        productName: product.description || product.product_name || "Unknown Product",
        referenceType: docType,
        referenceNo: docNo,
        detail: `No cylinder size could be parsed from category '${category?.category_name ?? ""}' or description '${product.description ?? ""}', and product weight is 0.`,
        quantity: 0,
        kg: 0,
      });
      effectiveKg = 0;
    }
  }

  return {
    isSerialized,
    isIndustrial,
    cylinderSizeKg: resolvedSize,
    effectiveKgPerUnit: effectiveKg,
    exceptions,
  };
}
