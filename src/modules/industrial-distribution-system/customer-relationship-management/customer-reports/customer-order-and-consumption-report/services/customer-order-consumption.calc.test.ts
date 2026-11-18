// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/services/customer-order-consumption.calc.test.ts
// ============================================================
// Unit tests for the core pure aggregation engine.
// Verifies Customer grouping, nested product metrics, net kg math,
// display labels, and strict exclusion of non-industrial or non-serialized items.
// ============================================================

import assert from "node:assert/strict";
import test from "node:test";
import { aggregateCustomerOrderConsumption } from "./customer-order-consumption.calc";
import type { ConsumptionSourceData } from "../types/customer-order-consumption.types";

function mockSource(): ConsumptionSourceData {
  return {
    branches: [
      { id: 1, branch_name: "Branch Alpha", branch_code: "BA-01", division_id: 1, isActive: 1 },
    ],
    categories: [
      { category_id: 10, category_name: "LPG 11KG REFILL", is_industrial: 1 },
      { category_id: 20, category_name: "LPG 50KG CYLINDER", is_industrial: 1 },
      { category_id: 30, category_name: "Groceries & Snacks", is_industrial: 0 },
    ],
    products: [
      {
        product_id: 100,
        product_code: "P-11",
        product_name: "Raw Product 11",
        description: "LPG 11KG Standard Refill", // Must be displayed per ids-guide
        product_weight: 11,
        weight: 11,
        weight_unit_id: 1,
        is_serialized: 1,
        product_category: 10,
      },
      {
        product_id: 200,
        product_code: "P-50",
        product_name: "Raw Product 50",
        description: "LPG 50KG Industrial Cylinder", // Must be displayed per ids-guide
        product_weight: 50,
        weight: 50,
        weight_unit_id: 1,
        is_serialized: 1,
        product_category: 20,
      },
      // Non-serialized / non-industrial product that must be ignored!
      {
        product_id: 300,
        product_code: "SNACK-01",
        product_name: "Richeese Wafer 48g",
        description: "Richeese Wafer",
        product_weight: 1,
        weight: 1,
        weight_unit_id: 1,
        is_serialized: 0,
        product_category: 30,
      },
    ],
    productLabels: [],
    customers: [
      {
        customer_id: 1,
        customer_code: "C-100",
        customer_name: "Acme Industrial Corp",
        store_name: "Main Plant",
        classification: 1,
        branch_id: 1,
      },
    ],
    classifications: [{ id: 1, classification_name: "Industrial Key Account" }],
    salesmen: [{ id: 1, salesman_code: "SM-1", salesman_name: "John Doe" }],
    units: [{ unit_id: 1, unit_name: "Piece", unit_shortcut: "pc" }],
    weightUnits: [{ id: 1, code: "KG", name: "Kilogram" }],
    lpgSites: [],
    invoices: [
      {
        invoice_id: 1001,
        order_id: "SO-1001",
        invoice_no: "SI-1001",
        customer_code: "C-100",
        branch_id: 1,
        salesman_id: 1,
        invoice_date: "2026-11-05T10:00:00Z",
        transaction_status: "POSTED",
        net_amount: 11000,
        gross_amount: 11000,
        discount_amount: 0,
      },
      {
        invoice_id: 1002,
        order_id: "SO-1002",
        invoice_no: "SI-1002",
        customer_code: "C-100",
        branch_id: 1,
        salesman_id: 1,
        invoice_date: "2026-11-12T14:00:00Z",
        transaction_status: "POSTED",
        net_amount: 25000,
        gross_amount: 25000,
        discount_amount: 0,
      },
    ],
    invoiceDetails: [
      // Order 1: 10 pcs of 11kg = 110 kg
      {
        detail_id: 1,
        invoice_no: 1001,
        product_id: 100,
        unit: 1,
        quantity: 10,
        unit_price: 1100,
        total_amount: 11000,
        discount_amount: 0,
        gross_amount: 11000,
      },
      // Non-serialized item in Order 1: must be skipped
      {
        detail_id: 2,
        invoice_no: 1001,
        product_id: 300,
        unit: 1,
        quantity: 50,
        unit_price: 20,
        total_amount: 1000,
        discount_amount: 0,
        gross_amount: 1000,
      },
      // Order 2: 5 pcs of 50kg = 250 kg
      {
        detail_id: 3,
        invoice_no: 1002,
        product_id: 200,
        unit: 1,
        quantity: 5,
        unit_price: 5000,
        total_amount: 25000,
        discount_amount: 0,
        gross_amount: 25000,
      },
    ],
    returns: [
      {
        return_id: 501,
        return_number: "SR-501",
        customer_code: "C-100",
        branch_id: 1,
        salesman_id: 1,
        return_date: "2026-11-15T09:00:00Z",
        gross_amount: 2200,
        order_id: "SO-1001",
        invoice_no: "SI-1001",
        status: "POSTED",
        deleted_at: null,
      },
    ],
    returnDetails: [
      // Return: 2 pcs of 11kg = 22 kg
      {
        detail_id: 1,
        return_no: "SR-501",
        product_id: 100,
        quantity: 2,
        total_amount: 2200,
        gross_amount: 2200,
        status: "POSTED",
      },
      // Non-serialized item return: must be skipped
      {
        detail_id: 2,
        return_no: "SR-501",
        product_id: 300,
        quantity: 10,
        total_amount: 200,
        gross_amount: 200,
        status: "POSTED",
      },
    ],
    returnLinks: [],
    postDispatch: [],
    postDispatchSerials: [],
    salesOrders: [],
    salesOrderDetails: [],
    salesOrderSerials: [],
    salesReturnSerials: [],
    unfulfilledTransactions: [],
    unfulfilledDetails: [],
    unifiedLpg: [],
    wiwoHeaders: [],
    wiwoDetails: [],
    meterReadings: [],
    transactionHeaders: [],
    headerInvoices: [],
  };
}

test("aggregateCustomerOrderConsumption strictly excludes non-industrial / non-serialized products", () => {
  const source = mockSource();
  const { rows, overview, exceptions } = aggregateCustomerOrderConsumption(source);

  // Non-serialized products must not generate any data exceptions
  assert.equal(exceptions.length, 0);

  assert.equal(rows.length, 1);
  const cust = rows[0];

  assert.equal(cust.customerCode, "C-100");
  assert.equal(cust.customerName, "Acme Industrial Corp");
  assert.equal(cust.branchName, "Branch Alpha");
  assert.equal(cust.classificationName, "Industrial Key Account");

  // Customer Totals (strictly for serialized industrial products)
  assert.equal(cust.orderFrequency, 2); // 2 distinct orders
  assert.equal(cust.fulfilledQty, 15); // 10 pcs + 5 pcs (excludes 50 pcs of wafer)
  assert.equal(cust.returnedQty, 2); // 2 pcs returned (excludes 10 pcs of wafer)
  assert.equal(cust.netQty, 13); // 15 - 2 = 13 pcs

  // Weight Math: (10 * 11) + (5 * 50) = 110 + 250 = 360 kg gross; returned = 2 * 11 = 22 kg; net = 338 kg
  assert.equal(cust.grossKg, 360);
  assert.equal(cust.returnedKg, 22);
  assert.equal(cust.netKg, 338);

  // Average order size: 338 kg / 2 orders = 169 kg
  assert.equal(cust.avgOrderSizeKg, 169);

  // Products breakdown: Exactly 2 industrial products (wafer product 300 is excluded!)
  assert.equal(cust.products.length, 2);
  assert.ok(!cust.products.some((p) => p.productId === 300));

  // Product 1: 50kg (sorted first because 250 kg > 88 kg net)
  const prod50 = cust.products[0];
  assert.equal(prod50.productId, 200);
  assert.equal(prod50.productName, "LPG 50KG Industrial Cylinder"); // products.description per ids-guide
  assert.equal(prod50.cylinderSizeKg, 50);
  assert.equal(prod50.fulfilledQty, 5);
  assert.equal(prod50.returnedQty, 0);
  assert.equal(prod50.netKg, 250);

  // Product 2: 11kg
  const prod11 = cust.products[1];
  assert.equal(prod11.productId, 100);
  assert.equal(prod11.productName, "LPG 11KG Standard Refill"); // products.description per ids-guide
  assert.equal(prod11.cylinderSizeKg, 11);
  assert.equal(prod11.fulfilledQty, 10);
  assert.equal(prod11.returnedQty, 2);
  assert.equal(prod11.netQty, 8);
  assert.equal(prod11.grossKg, 110);
  assert.equal(prod11.returnedKg, 22);
  assert.equal(prod11.netKg, 88);

  // Overview verification
  assert.equal(overview.totalCustomers, 1);
  assert.equal(overview.cylinder.netKg, 338);
});

test("aggregateCustomerOrderConsumption resolves numeric and order_no references to the same canonical Sales Order", () => {
  const source = mockSource();
  source.salesOrders = [
    {
      order_id: 501,
      order_no: "SO-1001",
      customer_code: "C-100",
      branch_id: 1,
      order_date: "2026-11-04",
      order_status: "FULFILLED",
      total_amount: 36000,
    },
  ];
  // Point the second invoice to the numeric PK (501) of SO-1001
  source.invoices[1].order_id = "501";

  const { rows } = aggregateCustomerOrderConsumption(source);
  assert.equal(rows.length, 1);
  // Both invoices belong to canonical SO-1001, so orderFrequency must be 1
  assert.equal(rows[0].orderFrequency, 1);
});

test("aggregateCustomerOrderConsumption classifies lpg_metered_wiwo_transactions by billable_source (METERED vs WIWO) and deduplicates child headers", () => {
  const source = mockSource();
  source.invoices = [];
  source.invoiceDetails = [];
  source.returns = [];
  source.returnDetails = [];

  source.unifiedLpg = [
    {
      id: 1,
      transaction_no: "MW-001",
      transaction_type: "REGULAR_BILLING",
      lpg_site_id: 10,
      customer_code: "C-100",
      meter_reading_id: 901,
      wiwo_header_id: null,
      transaction_date: "2026-11-10",
      metered_kg: 120,
      wiwo_kg: 0,
      variance_kg: 0,
      billable_source: "METERED",
      billable_kg: 120,
      price_per_kg: 90,
      net_amount: 10800,
      sales_invoice_id: 2001,
      sales_invoice_no: "SI-2001",
      status: "POSTED",
    },
    {
      id: 2,
      transaction_no: "MW-002",
      transaction_type: "REGULAR_BILLING",
      lpg_site_id: 10,
      customer_code: "C-100",
      meter_reading_id: null,
      wiwo_header_id: 801,
      transaction_date: "2026-11-14",
      metered_kg: 0,
      wiwo_kg: 250,
      variance_kg: 0,
      billable_source: "WIWO",
      billable_kg: 250,
      price_per_kg: 90,
      net_amount: 22500,
      sales_invoice_id: 2002,
      sales_invoice_no: "SI-2002",
      status: "POSTED",
    },
    // Onboarding baseline must be ignored
    {
      id: 3,
      transaction_no: "MW-BASE",
      transaction_type: "ONBOARDING_BASELINE",
      lpg_site_id: 10,
      customer_code: "C-100",
      meter_reading_id: null,
      wiwo_header_id: 802,
      transaction_date: "2026-11-01",
      metered_kg: 0,
      wiwo_kg: 500,
      variance_kg: 0,
      billable_source: "WIWO",
      billable_kg: 500,
      price_per_kg: 90,
      net_amount: 45000,
      sales_invoice_id: null,
      sales_invoice_no: null,
      status: "POSTED",
    },
  ];

  // Already covered by MW-002 and MW-BASE — must NOT double-count
  source.wiwoHeaders = [
    {
      id: 801,
      wiwo_no: "WIWO-801",
      lpg_site_id: 10,
      customer_code: "C-100",
      transaction_date: "2026-11-14",
      wiwo_type: "REGULAR",
      total_billable_kg: 250,
      gross_amount: 22500,
      net_amount: 22500,
      wiwo_status: "POSTED",
      sales_invoice_id: 2002,
      sales_invoice_no: "SI-2002",
    },
  ];
  source.meterReadings = [
    {
      id: 901,
      lpg_site_id: 10,
      customer_code: "C-100",
      reading_no: "MR-901",
      reading_date: "2026-11-10",
      billing_period_from: null,
      billing_period_to: null,
      meter_unit: "KG",
      kg_consumed: 120,
      price_per_kg: 90,
      gross_amount: 10800,
      net_amount: 10800,
      reading_status: "POSTED",
      sales_invoice_id: 2001,
      sales_invoice_no: "SI-2001",
    },
  ];

  const { rows, overview } = aggregateCustomerOrderConsumption(source);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].netKg, 370); // 120 (METERED) + 250 (WIWO), excluding 500 baseline & duplicates
  assert.equal(overview.lpg.netKg, 370);

  const meteredRow = rows[0].products.find((p) => p.productCode === "LPG-METERED");
  const wiwoRow = rows[0].products.find((p) => p.productCode === "LPG-WIWO");
  assert.ok(meteredRow);
  assert.ok(wiwoRow);
  assert.equal(meteredRow.gasType, "LPG (Metered)");
  assert.equal(meteredRow.netKg, 120);
  assert.equal(wiwoRow.gasType, "LPG (WIWO / Kg)");
  assert.equal(wiwoRow.netKg, 250);
});

test("aggregateCustomerOrderConsumption filters out child variant products (EMPTY) and resolves linked LPG WIWO/Metered onto the real Parent Product", () => {
  const source = mockSource();
  // Add a child EMPTY variant of product 200 (parent_id = 200)
  source.products.push({
    product_id: 201,
    parent_id: 200,
    uom_ids: "EMPTY",
    product_code: "P-50-EMPTY",
    product_name: "LPG 50KG EMPTY",
    description: "LPG 50KG Industrial Cylinder EMPTY",
    product_weight: 50,
    weight: 50,
    weight_unit_id: 1,
    is_serialized: 1,
    product_category: 20,
  });

  // Invoice 1002 is linked to SO-1002 (50kg cylinder) and governed by a POSTED WIWO transaction (39 kg)
  source.invoices = [source.invoices[1]];
  source.invoiceDetails = [
    {
      detail_id: 3,
      invoice_no: 1002,
      product_id: 200,
      unit: 1,
      quantity: 5,
      unit_price: 0,
      total_amount: 0,
      discount_amount: 0,
      gross_amount: 0,
    },
    // Child EMPTY variant line — must be strictly excluded!
    {
      detail_id: 4,
      invoice_no: 1002,
      product_id: 201,
      unit: 1,
      quantity: 5,
      unit_price: 0,
      total_amount: 0,
      discount_amount: 0,
      gross_amount: 0,
    },
  ];
  source.returns = [];
  source.returnDetails = [];
  source.salesOrders = [
    {
      order_id: 700,
      order_no: "SO-1002",
      customer_code: "C-100",
      branch_id: 1,
      order_date: "2026-11-12",
      order_status: "FULFILLED",
      total_amount: 0,
    },
  ];
  source.salesOrderDetails = [
    {
      detail_id: 701,
      order_id: 700,
      product_id: 200,
      ordered_quantity: 5,
      net_amount: 0,
    },
  ];
  source.unifiedLpg = [
    {
      id: 10,
      transaction_no: "TX-WIWO-10",
      transaction_type: "REGULAR_BILLING",
      lpg_site_id: 1,
      customer_code: "C-100",
      sales_order_id: 700,
      sales_order_no: "SO-1002",
      meter_reading_id: null,
      wiwo_header_id: 1,
      transaction_date: "2026-11-12",
      metered_kg: 0,
      wiwo_kg: 39,
      variance_kg: 0,
      billable_source: "WIWO",
      billable_kg: 39,
      price_per_kg: 90,
      net_amount: 3510,
      sales_invoice_id: 1002,
      sales_invoice_no: "SI-1002",
      status: "POSTED",
    },
  ];

  const { rows, overview, overallTrend } = aggregateCustomerOrderConsumption(source);
  assert.equal(rows.length, 1);
  // Only ONE parent product row (200) — NO EMPTY variant (201) and NO separate LPG-WIWO row!
  assert.equal(rows[0].products.length, 1);
  assert.equal(rows[0].products[0].productId, 200);
  assert.equal(rows[0].products[0].netKg, 39);
  assert.equal(rows[0].products[0].fulfilledQty, 5);
  assert.equal(rows[0].products[0].gasType, "LPG (WIWO / Kg)");
  // Movement-level LPG attribution: KPI overview.lpg and monthlyTrend channel "LPG" MUST record 39 kg (never 0)
  assert.equal(overview.lpg.netKg, 39);
  assert.equal(overview.cylinder.netKg, 0);
  const lpgTrend = overallTrend.find((pt) => pt.channel === "LPG" && pt.yearMonth === "2026-11");
  assert.ok(lpgTrend, "Monthly trend must include LPG channel point");
  assert.equal(lpgTrend.netKg, 39);
});

test("enforces multi-select categoryIds (Cylinder Size) and branchIds filters while excluding non-industrial branches", () => {
  const source = mockSource();
  // Add a second industrial branch and an orphan null-branch invoice that must NEVER appear as "All Branches"
  source.branches.push({
    id: 2,
    branch_name: "Branch Beta",
    branch_code: "BB-02",
    division_id: 1,
    isActive: 1,
  });
  source.invoices.push(
    {
      invoice_id: 1003,
      order_id: "SO-1003",
      invoice_no: "SI-1003",
      customer_code: "C-100",
      branch_id: 2,
      salesman_id: 1,
      invoice_date: "2026-11-16T10:00:00Z",
      transaction_status: "POSTED",
      net_amount: 10000,
      gross_amount: 10000,
      discount_amount: 0,
    },
    {
      invoice_id: 1004,
      order_id: "SO-1004",
      invoice_no: "SI-1004",
      customer_code: null,
      branch_id: null,
      salesman_id: 1,
      invoice_date: "2026-11-17T10:00:00Z",
      transaction_status: "POSTED",
      net_amount: 5000,
      gross_amount: 5000,
      discount_amount: 0,
    }
  );
  source.invoiceDetails.push(
    {
      detail_id: 4,
      invoice_no: 1003,
      product_id: 200, // 50kg (category 20) in Branch 2
      unit: 1,
      quantity: 2,
      unit_price: 5000,
      total_amount: 10000,
      discount_amount: 0,
      gross_amount: 10000,
    },
    {
      detail_id: 5,
      invoice_no: 1004,
      product_id: 200, // Null branch -> excluded from division_id = 1 report
      unit: 1,
      quantity: 9,
      unit_price: 500,
      total_amount: 4500,
      discount_amount: 0,
      gross_amount: 4500,
    }
  );

  // 1. Unfiltered: orphan null-branch invoice is excluded; no "All Branches" row exists
  const unfiltered = aggregateCustomerOrderConsumption(source);
  assert.equal(
    unfiltered.rows.some((r) => r.branchName === "All Branches"),
    false
  );
  assert.equal(unfiltered.rows.length, 2); // Branch 1 + Branch 2

  // 2. Filter strictly by categoryIds = [20] (50 KG only) -> excludes 11 KG (product 100) completely
  const only50Kg = aggregateCustomerOrderConsumption(source, { categoryIds: [20] });
  assert.equal(only50Kg.rows.length, 2);
  for (const r of only50Kg.rows) {
    assert.equal(
      r.products.every((p) => p.productId === 200),
      true
    );
  }
  assert.equal(only50Kg.overview.cylinder.netKg, 350); // 250kg (Branch 1) + 100kg (Branch 2)

  // 3. Multi-select branchIds = [2] & categoryIds = [20] -> only Branch Beta 50 KG (100 kg)
  const branch2Only = aggregateCustomerOrderConsumption(source, {
    branchIds: [2],
    categoryIds: [20],
  });
  assert.equal(branch2Only.rows.length, 1);
  assert.equal(branch2Only.rows[0].branchId, 2);
  assert.equal(branch2Only.rows[0].branchName, "Branch Beta");
  assert.equal(branch2Only.overview.cylinder.netKg, 100);
});
