/**
 * Printable HTML Generator for Demand Forecast Intelligence Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Report title with branch, period and print timestamp
 * - Executive KPI Grid (Demand, Stock On-Hand, Coverage, Undersupplied, Oversupplied)
 * - Tabular Product Dataset (Demand, Served, POs, On-Hand Full/Empty/Total, Coverage, Status)
 *
 * The sheet is data plus the scope that produced it: no letterhead (no logo, company name, address,
 * TIN or registration number) and no prepared/reviewed/approved signature blocks, because the system
 * records no such sign-off and inventing role titles on a printed page is a claim it cannot support.
 *
 * Paper, orientation and margins are not written into this template. They come from
 * DEMAND_PRINT_LAYOUT below, whose defaults are null so the browser print dialog decides —
 * see DemandPrintLayout for when to pin them in code instead. The module prints this sheet from an
 * off-screen frame, so the dialog is raised there and no print script belongs in the document.
 */

import { ProductDemandRow, DemandForecastKPIs, DemandForecastFilter } from '../types';

function escapeHtml(text: string | null | undefined): string {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Printable layout knobs. Deliberately a source constant, not an end-user setting: copies, scale and
 * background graphics are per-job and the print dialog already owns those, while paper and orientation
 * are a property of this report.
 *
 * `paperSize` / `orientation` / `marginMm` all default to null, which means no `@page` rule is emitted
 * at all. Declaring them would override the dialog: Chrome honours `@page size`/`margin` and greys the
 * matching control out for the reader, so a sheet that says `A4 landscape` cannot be printed on Letter
 * or in portrait without a code change. Leave them null to let the reader decide per print job.
 */
export interface DemandPrintLayout {
    /** Any CSS `@page size` keyword: 'A4', 'A3', 'Letter', 'Legal'. null = do not declare. */
    paperSize: string | null;
    /** null = do not declare, so the dialog's own orientation applies. */
    orientation: 'portrait' | 'landscape' | null;
    /** Printed page margin in millimetres. null = the dialog's margin setting. */
    marginMm: number | null;
}

export const DEMAND_PRINT_LAYOUT: DemandPrintLayout = {
    paperSize: null,
    orientation: null,
    marginMm: null,
};

/**
 * The `@page` body, assembled from the knobs so nothing about the paper is baked into the template.
 * Empty string = the rule is dropped entirely and the print dialog keeps control.
 */
function buildPageRule(layout: DemandPrintLayout): string {
    const size = [layout.paperSize, layout.orientation].filter(Boolean).join(' ');
    const declarations = [
        size ? `size: ${escapeHtml(size)};` : '',
        layout.marginMm !== null ? `margin: ${layout.marginMm}mm;` : '',
    ]
        .filter(Boolean)
        .join(' ');
    return declarations ? `@page { ${declarations} }` : '';
}

export function generateDemandForecastPrintHtml(
    products: ProductDemandRow[],
    kpis: DemandForecastKPIs | null,
    filter: DemandForecastFilter,
    branchName: string,
    layout: DemandPrintLayout = DEMAND_PRINT_LAYOUT
): string {
    const printDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    // The sheet's own name, which the browser also offers as the default "Save as PDF" file name.
    // It states the scope rather than the minute the sheet was raised; the Generated On line in the
    // body still carries the timestamp.
    const periodLabel = `${filter.startDate || 'All'} to ${filter.endDate || 'Current'}`;
    const sheetName = `Demand Forecast & Inventory Alignment Report - ${branchName} - ${periodLabel}`;

    const tableRows = products
        .map((p, idx) => {
            const runwayDisplay = p.daysOfSupply >= 999 ? '>90 d' : `${p.daysOfSupply} d`;
            const stockoutStr =
                p.runwayStatus === 'NO_DEMAND'
                    ? 'No depletion'
                    : p.stockOnHandFull === 0
                    ? 'Immediate (0d)'
                    : p.stockoutDaysRemaining !== null && p.stockoutDaysRemaining < 90
                    ? p.estimatedStockoutDate
                        ? `${p.estimatedStockoutDate.slice(5)} (${p.stockoutDaysRemaining}d)`
                        : ''
                    : '>90 d';

            const statusClass =
                p.runwayStatus === 'CRITICAL_STOCKOUT'
                    ? 'undersupplied'
                    : p.runwayStatus === 'LOW_RUNWAY'
                    ? 'oversupplied'
                    : p.runwayStatus === 'BALANCED'
                    ? 'balanced'
                    : 'nodata';

            return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td>
            <strong>${escapeHtml(p.productName)}</strong>
            <div style="font-size: 8px; color: #64748b;">ID: ${p.productId}</div>
          </td>
          <td>${escapeHtml(p.branchName) || 'All Branches'}</td>
          <td style="text-align: right; color: #475569;">${p.dailyBurnRate.toFixed(2)}/d</td>
          <td style="text-align: right; color: #059669; font-weight: bold;">${p.stockOnHandFull.toLocaleString()}</td>
          <td style="text-align: right; color: #d97706; font-weight: bold;">${(p.forecast7Day ?? Math.round(p.dailyBurnRate * 7)).toLocaleString()}</td>
          <td style="text-align: right; color: #4f46e5; font-weight: bold;">${p.projected30DayDemand.toLocaleString()}</td>
          <td style="text-align: center; font-weight: bold; color: ${
              p.runwayStatus === 'CRITICAL_STOCKOUT'
                  ? '#dc2626'
                  : p.runwayStatus === 'LOW_RUNWAY'
                  ? '#d97706'
                  : p.runwayStatus === 'BALANCED'
                  ? '#059669'
                  : '#475569'
          };">
            ${runwayDisplay}
          </td>
          <td style="text-align: center; font-size: 9px; color: ${p.runwayStatus === 'CRITICAL_STOCKOUT' ? '#dc2626; font-weight: bold;' : '#475569;'}">
            ${stockoutStr}
          </td>
          <td style="text-align: right; font-weight: bold; color: ${p.suggestedReplenishment > 0 ? '#dc2626' : '#64748b'};">
            ${p.suggestedReplenishment > 0 ? `+${p.suggestedReplenishment.toLocaleString()}` : '0'}
          </td>
          <td style="text-align: center;">
            <span class="badge ${statusClass}">${p.runwayStatus.replace('_', ' ')}</span>
          </td>
        </tr>
      `;
        })
        .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(sheetName)}</title>
  <style>
    ${buildPageRule(layout)}
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.4;
      margin: 0;
      padding: 10px;
    }
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .report-title {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .meta-box {
      text-align: right;
      font-size: 10px;
      color: #64748b;
    }
    .meta-box strong {
      color: #0f172a;
    }
    .kpi-grid {
      display: grid;
      /* auto-fit, not a fixed column count: the boxes reflow to whatever the chosen paper width is,
         so portrait wraps instead of crushing six boxes into a half-width sheet. */
      grid-template-columns: repeat(auto-fit, minmax(9em, 1fr));
      gap: 8px;
      margin-bottom: 14px;
    }
    .kpi-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background: #f8fafc;
    }
    .kpi-title {
      font-size: 8px;
      text-transform: uppercase;
      font-weight: 700;
      color: #475569;
      margin-bottom: 2px;
    }
    .kpi-value {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
    }
    .kpi-sub {
      font-size: 8px;
      color: #64748b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
      margin-bottom: 20px;
    }
    /* The column headers must survive a printer that drops background fills: near-black text and a
       heavy rule under the row carry the header even when the tint below never reaches the paper. */
    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      padding: 6px 6px;
      text-align: left;
      border: 1px solid #cbd5e1;
      border-bottom: 2px solid #0f172a;
      font-size: 8.5px;
      text-transform: uppercase;
    }
    td {
      padding: 5px 6px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .badge {
      display: inline-block;
      padding: 2px 5px;
      border-radius: 3px;
      font-size: 7.5px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge.balanced { background: #dcfce7; color: #166534; }
    .badge.oversupplied { background: #fef9c3; color: #854d0e; }
    .badge.undersupplied { background: #fee2e2; color: #991b1b; }
    .badge.nodata { background: #f1f5f9; color: #64748b; }
  </style>
</head>
<body>
  <!-- Report title and the scope that produced the numbers. No letterhead: this sheet is internal
       working data, and the company identity adds nothing the reader cannot see on the source screen. -->
  <div class="header">
    <h1 class="report-title">Demand Forecast &amp; Inventory Alignment Report</h1>
    <div class="meta-box">
      <div>Reporting Branch: <strong>${escapeHtml(branchName)}</strong></div>
      <div>Period: <strong>${escapeHtml(periodLabel)}</strong></div>
      <div>Generated On: <strong>${printDate}</strong></div>
    </div>
  </div>

  <!-- KPI Metrics Grid (6 Boxes) -->
  <div class="kpi-grid">
    <div class="kpi-card" style="border-left: 3px solid #3b82f6;">
      <div class="kpi-title">Evaluated SKUs</div>
      <div class="kpi-value" style="color: #2563eb;">${kpis?.totalProductsEvaluated ?? 0}</div>
      <div class="kpi-sub">Division 1 Items</div>
    </div>
    <div class="kpi-card" style="border-left: 3px solid #0284c7;">
      <div class="kpi-title">Period Demand</div>
      <div class="kpi-value" style="color: #0284c7;">${kpis?.totalDemandQty ? kpis.totalDemandQty.toLocaleString() : 0}</div>
      <div class="kpi-sub">Ordered Units</div>
    </div>
    <div class="kpi-card" style="border-left: 3px solid #10b981;">
      <div class="kpi-title">Full Stock On-Hand</div>
      <div class="kpi-value" style="color: #059669;">${kpis?.totalStockOnHand ? kpis.totalStockOnHand.toLocaleString() : 0}</div>
      <div class="kpi-sub">Usable Full Cylinders</div>
    </div>
    <div class="kpi-card" style="border-left: 3px solid #4f46e5;">
      <div class="kpi-title">30-Day Forecast</div>
      <div class="kpi-value" style="color: #4f46e5;">${kpis?.projectedTotalForecast30Day ? kpis.projectedTotalForecast30Day.toLocaleString() : 0}</div>
      <div class="kpi-sub">Projected Next 30d</div>
    </div>
    <div class="kpi-card" style="border-left: 3px solid #ef4444;">
      <div class="kpi-title">Critical Stockouts</div>
      <div class="kpi-value" style="color: #dc2626;">${kpis?.criticalStockoutCount ?? 0}</div>
      <div class="kpi-sub">Runway &lt; 7 Days</div>
    </div>
    <div class="kpi-card" style="border-left: 3px solid #f59e0b;">
      <div class="kpi-title">Suggested Reorder</div>
      <div class="kpi-value" style="color: #d97706;">${kpis?.recommendedReplenishmentTotal ? kpis.recommendedReplenishmentTotal.toLocaleString() : 0}</div>
      <div class="kpi-sub">Replenishment Units</div>
    </div>
  </div>

  <!-- Product Demand Table -->
  <!--
    Column widths are percentages, not the pixel hints this sheet used to carry. A pixel total
    (~650px before the description column) only fits a landscape sheet; on portrait paper it pushed
    the last columns off the page. Percentages track whatever width the print dialog is given.
  -->
  <table>
    <thead>
      <tr>
        <th style="width: 3%; text-align: center;">#</th>
        <th>Product Description</th>
        <th style="width: 9%;">Branch</th>
        <th style="width: 7%; text-align: right;">Daily Burn</th>
        <th style="width: 7%; text-align: right;">Full Stock</th>
        <th style="width: 7%; text-align: right;">7D Forecast</th>
        <th style="width: 8%; text-align: right;">30D Forecast</th>
        <th style="width: 6%; text-align: center;">Runway</th>
        <th style="width: 10%; text-align: center;">Est. Stockout</th>
        <th style="width: 7%; text-align: right;">Reorder Qty</th>
        <th style="width: 9%; text-align: center;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <!-- No approvals block: the system records no sign-off, so the sheet asserts none.
       No print script either — the module raises the browser print dialog on this document, which
       keeps the sheet plain markup that can be rendered anywhere. -->
</body>
</html>
`;
}
