// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/types/customer-order-consumption.schema.test.ts
// ============================================================
// Unit tests for schema validation and URL search param helpers.
// ============================================================

import assert from "node:assert/strict";
import test from "node:test";
import {
  customerOrderConsumptionDetailSchema,
  customerOrderConsumptionFilterSchema,
  readFilterParams,
} from "./customer-order-consumption.schema";

test("customerOrderConsumptionFilterSchema validates valid date windows", () => {
  const valid = {
    startDate: "2026-11-01",
    endDate: "2026-11-30",
    channel: "CYLINDER",
  };
  const parsed = customerOrderConsumptionFilterSchema.safeParse(valid);
  assert.equal(parsed.success, true);
});

test("customerOrderConsumptionFilterSchema rejects invalid date order", () => {
  const invalid = {
    startDate: "2026-11-30",
    endDate: "2026-11-01",
  };
  const parsed = customerOrderConsumptionFilterSchema.safeParse(invalid);
  assert.equal(parsed.success, false);
});

test("customerOrderConsumptionDetailSchema validates customerDetail", () => {
  const valid = {
    startDate: "2026-11-01",
    endDate: "2026-11-30",
    customerDetail: "CUST-001",
    productDetail: 100,
  };
  const parsed = customerOrderConsumptionDetailSchema.safeParse(valid);
  assert.equal(parsed.success, true);
});

test("readFilterParams parses query params accurately", () => {
  const params = new URLSearchParams(
    "startDate=2026-11-01&endDate=2026-11-30&customerCodes=C1,C2&branchIds=1,2&customerDetail=C1&productDetail=100"
  );
  const res = readFilterParams(params);
  assert.equal(res.startDate, "2026-11-01");
  assert.equal(res.endDate, "2026-11-30");
  assert.deepEqual(res.customerCodes, ["C1", "C2"]);
  assert.deepEqual(res.branchIds, [1, 2]);
  assert.equal(res.customerDetail, "C1");
  assert.equal(res.productDetail, 100);
});
