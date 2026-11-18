// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/services/customer-order-consumption.errors.ts
// ============================================================
// Custom error hierarchy for upstream Directus & validation failures.
// ============================================================

export class UpstreamHttpError extends Error {
  readonly status: number | null;
  readonly statusText: string;

  constructor(status: number | null, statusText: string, options?: ErrorOptions) {
    super(
      status === null
        ? "Network connection to upstream data provider failed."
        : `Upstream returned status ${status} ${statusText}.`,
      options
    );
    this.name = "UpstreamHttpError";
    this.status = status;
    this.statusText = statusText;
  }
}

export class UpstreamContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamContractError";
  }
}
