// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/services/customer-order-consumption.lpg-calc.ts
// ============================================================
// Metered and Weigh-In/Weigh-Out (WIWO) LPG calculations & variances.
// ============================================================

import type {
  BillingMode,
  RawLpgSiteRow,
  RawMeterReadingRow,
  RawUnifiedLpgRow,
  RawWiwoDetailRow,
  RawWiwoHeaderRow,
  ReportException,
} from "../types/customer-order-consumption.types";
import { safeRatio, toNumber } from "./customer-order-consumption.helpers";

export const LPG_METERED_PRODUCT_ID = -1;
export const LPG_WIWO_PRODUCT_ID = -2;

export type ClassifiedLpgMode = "METERED" | "WIWO";

export interface ClassifiedUnifiedLpg {
  mode: ClassifiedLpgMode;
  isOnboardingBaseline: boolean;
  effectiveKg: number;
  varianceKg: number;
  variancePct: number;
  syntheticProductId: number;
  productCode: string;
  productName: string;
  categoryName: string;
  gasType: string;
  documentType: "METER_READING" | "LPG_WIWO";
}

/**
 * Classifies a row from vos_database.lpg_metered_wiwo_transactions into
 * Metered ('METERED') vs WIWO / Kg ('WIWO') using billable_source as primary truth.
 * Excludes ONBOARDING_BASELINE initial fills from consumption metrics.
 */
export function classifyUnifiedLpgTransaction(
  row: RawUnifiedLpgRow,
  site?: RawLpgSiteRow
): ClassifiedUnifiedLpg {
  const txnType = String(row.transaction_type ?? "").trim().toUpperCase();
  const isOnboardingBaseline = txnType === "ONBOARDING_BASELINE";

  const source = String(row.billable_source ?? "").trim().toUpperCase();
  const meteredKg = toNumber(row.metered_kg, 0);
  const wiwoKg = toNumber(row.wiwo_kg, 0);
  const billableKg = toNumber(row.billable_kg, 0);

  let mode: ClassifiedLpgMode;
  if (source === "METERED") {
    mode = "METERED";
  } else if (source === "WIWO") {
    mode = "WIWO";
  } else if (row.meter_reading_id != null && meteredKg > 0 && !(row.wiwo_header_id != null && wiwoKg > 0)) {
    mode = "METERED";
  } else if (row.wiwo_header_id != null && wiwoKg > 0) {
    mode = "WIWO";
  } else if (site?.billing_mode === "METERED") {
    mode = "METERED";
  } else {
    mode = "WIWO";
  }

  const effectiveKg =
    billableKg > 0 ? billableKg : mode === "METERED" ? meteredKg : wiwoKg;

  const varianceKg =
    row.variance_kg != null
      ? Math.abs(toNumber(row.variance_kg, 0))
      : meteredKg > 0 && wiwoKg > 0
      ? Math.round(Math.abs(meteredKg - wiwoKg) * 100) / 100
      : 0;
  const varianceBase = Math.max(meteredKg, wiwoKg, 0);
  const variancePct =
    meteredKg > 0 && wiwoKg > 0 && varianceBase > 0
      ? safeRatio(varianceKg * 100, varianceBase)
      : 0;

  if (mode === "METERED") {
    return {
      mode,
      isOnboardingBaseline,
      effectiveKg,
      varianceKg,
      variancePct,
      syntheticProductId: LPG_METERED_PRODUCT_ID,
      productCode: "LPG-METERED",
      productName: "LPG Metered Consumption",
      categoryName: "Metered LPG",
      gasType: "LPG (Metered)",
      documentType: "METER_READING",
    };
  }

  return {
    mode,
    isOnboardingBaseline,
    effectiveKg,
    varianceKg,
    variancePct,
    syntheticProductId: LPG_WIWO_PRODUCT_ID,
    productCode: "LPG-WIWO",
    productName: "LPG WIWO (Kg) Consumption",
    categoryName: "WIWO LPG (Kg)",
    gasType: "LPG (WIWO / Kg)",
    documentType: "LPG_WIWO",
  };
}

export interface LpgArbitrationResult {
  billableKg: number;
  varianceKg: number;
  variancePct: number;
  exceptions: ReportException[];
}

export function arbitrateLpgConsumption(
  billingMode: BillingMode,
  meteredKg: number,
  wiwoKg: number,
  customerCode: string,
  customerName: string,
  docNo: string
): LpgArbitrationResult {
  const exceptions: ReportException[] = [];
  let billableKg = 0;
  let varianceKg = 0;
  let variancePct = 0;

  if (billingMode === "BOTH") {
    varianceKg = Math.round(Math.abs(meteredKg - wiwoKg) * 100) / 100;
    const base = Math.max(meteredKg, wiwoKg, 1);
    variancePct = safeRatio(varianceKg * 100, base);
    billableKg = Math.max(meteredKg, wiwoKg);

    // Variance threshold: 5% tolerance
    if (variancePct > 5) {
      exceptions.push({
        code: "LPG_VARIANCE",
        channel: "LPG",
        customerCode,
        customerName,
        referenceType: "WIWO",
        referenceNo: docNo,
        detail: `LPG Metered vs WIWO variance is ${varianceKg} kg (${variancePct}%), exceeding 5% threshold.`,
        quantity: 0,
        kg: varianceKg,
      });
    }
  } else if (billingMode === "METERED") {
    billableKg = meteredKg;
  } else {
    // KILO / WIWO
    billableKg = wiwoKg;
  }

  return {
    billableKg,
    varianceKg,
    variancePct,
    exceptions,
  };
}
