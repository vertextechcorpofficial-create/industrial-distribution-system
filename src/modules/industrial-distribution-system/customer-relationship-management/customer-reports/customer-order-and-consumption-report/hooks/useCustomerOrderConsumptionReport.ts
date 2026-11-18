// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/hooks/useCustomerOrderConsumptionReport.ts
// ============================================================
// Hook to consume the Customer Order & Consumption Report Context.
// ============================================================

import {
  useCustomerOrderConsumptionReportContext,
  type CustomerOrderConsumptionReportContextValue,
} from "../providers/CustomerOrderConsumptionReportProvider";

export function useCustomerOrderConsumptionReport(): CustomerOrderConsumptionReportContextValue {
  return useCustomerOrderConsumptionReportContext();
}
