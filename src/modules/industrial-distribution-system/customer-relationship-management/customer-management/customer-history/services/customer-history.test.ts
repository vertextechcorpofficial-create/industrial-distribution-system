// ============================================================================
// Customer History — Unit Tests (node:test)
// Covers industrial scope, helpers/fallback, event builders, and schema.
// ============================================================================

import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomerEventStreams } from "./customer-history.events";
import {
  compareValues,
  display,
  getCurrentMonthRange,
} from "./customer-history.helpers";
import {
  buildIndustrialScope,
  getParentProductName,
  isInScopeBranch,
  resolveQualifyingParentProductId,
} from "./customer-history.scope";
import { customerHistoryFilterSchema } from "../types/customer-history.schema";
import type { RawCustomerRow } from "../types/customer-history.types";

test("display() preserves numeric 0 and falls back to '-' only when absent", () => {
  assert.equal(display(0), "0");
  assert.equal(display(42), "42");
  assert.equal(display(false), "No");
  assert.equal(display(null), "-");
  assert.equal(display(undefined), "-");
  assert.equal(display(""), "-");
  assert.equal(display("   "), "-");
  assert.equal(display("0"), "-"); // legacy DB '0' default
  assert.equal(display("ABC Trading"), "ABC Trading");
});

test("getCurrentMonthRange() returns 1st of month through given date", () => {
  const range = getCurrentMonthRange(new Date("2026-11-25T10:00:00"));
  assert.deepEqual(range, {
    startDate: "2026-11-01",
    endDate: "2026-11-25",
  });
});

test("compareValues() sorts numbers numerically and pushes '-' to bottom", () => {
  assert.ok(compareValues(2, 10, "asc") < 0);
  assert.ok(compareValues(2, 10, "desc") > 0);
  assert.equal(compareValues("-", 10, "asc"), 1);
  assert.equal(compareValues(10, "-", "desc"), -1);
});

test("industrial scope enforces division_id = 1, isActive = 1, parent_id IS NULL, is_serialized = 1", () => {
  const scope = buildIndustrialScope(
    [
      { id: 1, branch_name: "Ind Main", branch_code: "IM", division_id: 1, isActive: 1 },
      { id: 2, branch_name: "Ind Inactive", branch_code: "II", division_id: 1, isActive: 0 },
      { id: 3, branch_name: "Non Ind", branch_code: "NI", division_id: 2, isActive: 1 },
    ],
    [
      {
        product_id: 100,
        parent_id: null,
        product_code: "LPG-50",
        product_name: "LPG 50kg",
        description: "50KG Industrial Cylinder",
        is_serialized: 1,
      },
      {
        product_id: 101,
        parent_id: 100,
        product_code: "LPG-50-EMPTY",
        product_name: "Empty",
        description: "50KG Empty",
        is_serialized: 1,
      },
      {
        product_id: 200,
        parent_id: null,
        product_code: "REG-1",
        product_name: "Non Serialized",
        description: "Regulator",
        is_serialized: 0,
      },
    ]
  );

  assert.equal(isInScopeBranch(1, scope), true);
  assert.equal(isInScopeBranch(2, scope), false);
  assert.equal(isInScopeBranch(3, scope), false);

  // Child variant resolves to parent 100, and displays parent's description
  assert.equal(resolveQualifyingParentProductId(100, scope), 100);
  assert.equal(resolveQualifyingParentProductId(101, scope), 100);
  assert.equal(resolveQualifyingParentProductId(200, scope), null);
  assert.equal(getParentProductName(100, scope), "50KG Industrial Cylinder");
});

test("buildCustomerEventStreams() applies strict memo scoping and separates audit trail", () => {
  const scope = buildIndustrialScope(
    [{ id: 1, branch_name: "Ind Main", branch_code: "IM", division_id: 1, isActive: 1 }],
    [
      {
        product_id: 100,
        parent_id: null,
        product_code: "LPG-50",
        product_name: "LPG",
        description: "50KG Industrial Cylinder",
        is_serialized: 1,
      },
    ]
  );

  const customer: RawCustomerRow = {
    id: 55,
    customer_code: "CUST-055",
    customer_name: "ABC Trading",
    type: "Regular",
    customer_image: null,
    store_name: "ABC Store",
    store_signage: "0",
    brgy: null,
    city: null,
    province: null,
    contact_number: "09171234567",
    customer_email: "0",
    tel_number: null,
    customer_tin: null,
    payment_term: 30,
    store_type: 1,
    price_type: "A",
    date_entered: "2025-01-10T08:00:00",
    isActive: 1,
    isVAT: 1,
    isEWT: 0,
    classification: 1,
    location: null,
    credit_limit: 50000,
    house_no: null,
    unit_building: null,
    street: null,
    purok_sitio: null,
    subdivision: null,
    zip_code: null,
    region: null,
    otherDetails: null,
  };

  const streams = buildCustomerEventStreams({
    customer,
    scope,
    range: "all",
    users: [{ user_id: 9, user_fname: "Jane", user_lname: "Doe", user_email: null }],
    invoices: [
      {
        invoice_id: 10,
        order_id: "SO-1",
        customer_code: "CUST-055",
        invoice_no: "INV-010",
        salesman_id: null,
        branch_id: 1,
        invoice_date: "2026-11-10T09:00:00",
        due_date: null,
        transaction_status: "Posted",
        payment_status: "Paid",
        total_amount: 5000,
        net_amount: 5000,
        gross_amount: 5000,
        discount_amount: 0,
        sales_type: 1,
        price_type: "A",
        created_date: null,
        remarks: null,
        isDispatched: 1,
        isReplaced: 0,
      },
    ],
    invoiceDetails: [
      {
        detail_id: 1,
        invoice_no: 10,
        product_id: 100,
        quantity: 2,
        unit_price: 2500,
        total_amount: 5000,
        discount_amount: 0,
        gross_amount: 5000,
      },
    ],
    payments: [],
    posSerials: [],
    posTransactions: [],
    orders: [],
    orderDetails: [],
    orderSerials: [],
    dispatchPlans: [],
    dispatchPlanDetails: [],
    returns: [],
    returnDetails: [],
    returnSerials: [],
    consolidatorMappings: [],
    consolidatorDetails: [],
    consolidators: [],
    memos: [
      {
        id: 7,
        memo_number: "CM-007",
        customer_id: 55,
        amount: 500,
        applied_amount: 500,
        reason: "Price adjustment",
        status: "APPLIED",
        created_at: "2026-11-11T10:00:00",
        deleted_at: null,
      },
      {
        id: 8,
        memo_number: "CM-008",
        customer_id: 55,
        amount: 200,
        applied_amount: 0,
        reason: "Unapplied",
        status: "FOR APPROVAL",
        created_at: "2026-11-12T10:00:00",
        deleted_at: null,
      },
    ],
    memoInvoices: [
      {
        id: 1,
        invoice_id: 10,
        memo_id: 7,
        amount: 500,
        date_applied: "2026-11-11T11:00:00",
      },
    ],
    auditTrails: [
      {
        id: 1,
        timestamp: "2026-11-05T12:00:00",
        user_id: 9,
        action: "UPDATE",
        table_name: "customer",
        record_id: 55,
        field_name: "credit_limit",
        old_value: "25000",
        new_value: "50000",
      },
    ],
    discountLogs: [],
  });

  // Strict memo: only CM-007 (applied to invoice 10) is included; CM-008 is excluded
  assert.equal(streams.notes.length, 1);
  assert.equal(streams.notes[0]?.reference, "CM-007");

  // Audit is kept separate from business activity timeline
  assert.equal(streams.audit.length, 1);
  assert.equal(streams.audit[0]?.actorName, "Jane Doe");
  assert.equal(streams.timeline.some((e) => e.id.startsWith("audit-")), false);
});

test("customerHistoryFilterSchema defaults to current month", () => {
  const parsed = customerHistoryFilterSchema.parse({});
  const def = getCurrentMonthRange();
  assert.equal(parsed.startDate, def.startDate);
  assert.equal(parsed.endDate, def.endDate);
  assert.equal(parsed.branchId, "all");
  assert.equal(parsed.productId, "all");
});
