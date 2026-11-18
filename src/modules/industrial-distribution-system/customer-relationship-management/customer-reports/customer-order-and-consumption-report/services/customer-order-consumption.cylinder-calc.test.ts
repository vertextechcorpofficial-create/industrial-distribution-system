// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/services/customer-order-consumption.cylinder-calc.test.ts
// ============================================================
// Unit tests for cylinder size parsing, serial scoping, and exceptions.
// Uses node:test and node:assert/strict.
// ============================================================

import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCylinderProduct, parseCategorySizeKg } from "./customer-order-consumption.cylinder-calc";
import type { RawCategoryRow, RawProductRow } from "../types/customer-order-consumption.types";

test("parseCategorySizeKg extracts kg sizes from category names", () => {
  assert.equal(parseCategorySizeKg("LPG 11KG REFILL"), 11);
  assert.equal(parseCategorySizeKg("11kg Cylinder"), 11);
  assert.equal(parseCategorySizeKg("LPG 50KG Industrial"), 50);
  assert.equal(parseCategorySizeKg("LPG 1.4KG SWAP"), 1.4);
  assert.equal(parseCategorySizeKg("Non-cylinder Product"), null);
  assert.equal(parseCategorySizeKg(""), null);
  assert.equal(parseCategorySizeKg(null), null);
});

test("evaluateCylinderProduct validates serialized status and category industrial flag", () => {
  const product: RawProductRow = {
    product_id: 1,
    product_code: "P-11",
    product_name: "LPG 11KG",
    description: "LPG 11KG REFILL",
    product_weight: 11,
    weight: 11,
    weight_unit_id: 1,
    is_serialized: 1,
    product_category: 10,
  };

  const category: RawCategoryRow = {
    category_id: 10,
    category_name: "LPG 11KG",
    is_industrial: 1,
  };

  const res = evaluateCylinderProduct(
    product,
    category,
    "C-001",
    "Customer 1",
    "SALES_INVOICE",
    "SI-101"
  );

  assert.equal(res.isSerialized, true);
  assert.equal(res.isIndustrial, true);
  assert.equal(res.cylinderSizeKg, 11);
  assert.equal(res.effectiveKgPerUnit, 11);
  assert.equal(res.exceptions.length, 0);
});

test("evaluateCylinderProduct completely ignores non-serialized products with zero exceptions", () => {
  const product: RawProductRow = {
    product_id: 2,
    product_code: "P-UNSERIAL",
    product_name: "Unserialized Product",
    description: "Product without serial",
    product_weight: 11,
    weight: 11,
    weight_unit_id: 1,
    is_serialized: 0,
    product_category: 10,
  };

  const category: RawCategoryRow = {
    category_id: 10,
    category_name: "LPG 11KG",
    is_industrial: 1,
  };

  const res = evaluateCylinderProduct(
    product,
    category,
    "C-001",
    "Customer 1",
    "SALES_INVOICE",
    "SI-102"
  );

  assert.equal(res.isSerialized, false);
  // Non-serialized items are strictly excluded and yield NO exceptions
  assert.equal(res.exceptions.length, 0);
  assert.equal(res.effectiveKgPerUnit, 0);
});

test("evaluateCylinderProduct completely ignores non-industrial category with zero exceptions", () => {
  const product: RawProductRow = {
    product_id: 3,
    product_code: "P-NONIND",
    product_name: "Non-industrial Cyl",
    description: "Domestic Cyl",
    product_weight: 11,
    weight: 11,
    weight_unit_id: 1,
    is_serialized: 1,
    product_category: 20,
  };

  const category: RawCategoryRow = {
    category_id: 20,
    category_name: "Domestic LPG 11KG",
    is_industrial: 0,
  };

  const res = evaluateCylinderProduct(
    product,
    category,
    "C-001",
    "Customer 1",
    "SALES_INVOICE",
    "SI-103"
  );

  assert.equal(res.isIndustrial, false);
  // Non-industrial items are strictly excluded and yield NO exceptions
  assert.equal(res.exceptions.length, 0);
  assert.equal(res.effectiveKgPerUnit, 0);
});
