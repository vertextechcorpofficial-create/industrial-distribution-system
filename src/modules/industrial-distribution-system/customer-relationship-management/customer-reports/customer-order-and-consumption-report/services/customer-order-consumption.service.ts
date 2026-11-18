// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/services/customer-order-consumption.service.ts
// ============================================================
// Orchestrator service coordinating I/O and pure calculation.
// Provides both main report aggregation and customer/product drill-down.
// ============================================================

import type {
  AppliedFilterContext,
  CustomerOrderConsumptionDetail,
  CustomerOrderConsumptionReportResponse,
} from "../types/customer-order-consumption.types";
import { aggregateCustomerOrderConsumption } from "./customer-order-consumption.calc";
import {
  fetchCustomerOrderConsumptionSources,
  fetchSupportingDocumentsForCustomer,
  type RepoOptions,
} from "./customer-order-consumption.repo";

export async function fetchCustomerOrderConsumptionReport(
  filters: AppliedFilterContext,
  options: RepoOptions = {}
): Promise<CustomerOrderConsumptionReportResponse> {
  const sources = await fetchCustomerOrderConsumptionSources(filters, options);
  const { rows, exceptions, overview, overallTrend } = aggregateCustomerOrderConsumption(
    sources,
    filters
  );

  const totalSourceRows =
    sources.invoices.length +
    sources.returns.length +
    sources.wiwoHeaders.length +
    sources.meterReadings.length +
    sources.unfulfilledTransactions.length;

  return {
    filters,
    generatedAt: new Date().toISOString(),
    reportingCutoff: filters.endDate,
    sourceRowCount: totalSourceRows,
    overview,
    rows,
    exceptions,
    monthlyTrend: overallTrend,
  };
}

export async function fetchCustomerOrderConsumptionDetail(
  filters: AppliedFilterContext,
  customerCode: string,
  productId?: number,
  options: RepoOptions = {}
): Promise<CustomerOrderConsumptionDetail> {
  const documents = await fetchSupportingDocumentsForCustomer(
    filters,
    customerCode,
    productId,
    options
  );

  return {
    customerCode,
    customerName: customerCode,
    storeName: "",
    classificationName: "Standard",
    branchName: "Branch",
    productId: productId ?? null,
    productName: productId ? `Product #${productId}` : null,
    window: { startDate: filters.startDate, endDate: filters.endDate },
    documents,
    exceptions: [],
  };
}
