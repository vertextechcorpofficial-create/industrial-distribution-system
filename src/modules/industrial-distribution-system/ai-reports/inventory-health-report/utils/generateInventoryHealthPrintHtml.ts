/**
 * High-Fidelity Printable HTML Generator for Inventory Health Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Report title with branch, reporting period and print timestamp
 * - Scope block: calculation basis and data limits
 * - Executive 4-card KPI Metric Grid
 * - Formatted Tabular Dataset of Parent Serialized SKUs with Fleet Breakdown and Risk Bands
 *
 * Printable-only contract: the document carries data and the scope that produced it. No letterhead
 * (no logo, company name, address, TIN or registration number), no advisory or legal boilerplate, no
 * prepared/reviewed/approved signature blocks, and no role titles the system cannot verify. Nothing
 * here is AI commentary. Paper size, orientation, margins and scale are left entirely to the browser
 * print dialog: declaring them in a page rule overrides that dialog and greys the orientation control
 * out for the reader, and this company does not print on one size.
 *
 * Layout rules that exist because of how the document gets consumed:
 * - The module prints this sheet from an off-screen frame, so nothing on screen shows it. The body
 *   padding therefore only matters to anyone who saves the file and opens it in a browser: it gives
 *   the page a frame there, and print zeroes it because margins belong to the dialog.
 * - A page break must land between rows, never through one: a split row loses its bottom border and
 *   reads as a rendering failure on the printed page. The header row repeats on every page.
 * - The KPI grid is a fixed four-across in wide pages and two-by-two in tall pages. It is deliberately
 *   not sized to content: at a narrow wide-page width, content sizing resolves to three columns and
 *   strands the fourth card alone on its own row. Only the aspect the dialog was left in is read here,
 *   never a paper size.
 */

import { SkuHealthRow, InventoryHealthExecutiveKPIs, InventoryHealthFilter } from '../types';

function escapeHtml(text: string | null | undefined): string {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function generateInventoryHealthPrintHtml(
    skus: SkuHealthRow[],
    kpis: InventoryHealthExecutiveKPIs | null,
    filter: InventoryHealthFilter,
    branchName: string
): string {
    const printDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    // The sheet's own name, which the browser also offers as the default "Save as PDF" file name.
    // It states the scope, not the minute the sheet was raised: two sheets printed for the same
    // window are the same document, and the printed timestamp in the body still tells them apart.
    const periodLabel = kpis?.metadata?.selectedPeriod || 'Current Window';
    const sheetName = `Inventory Health Report - ${branchName} - ${periodLabel}`;

    const tableRows = skus.map((s, idx) => {
        const coverageDisplay = s.coverageDays !== null ? `${s.coverageDays} d` : 'Unavailable';
        const adsDisplay = s.averageDailyDemand > 0 ? s.averageDailyDemand.toFixed(1) : '0.0';
        
        let riskBadgeClass = 'badge-healthy';
        if (s.riskBand === 'CRITICAL') riskBadgeClass = 'badge-critical';
        else if (s.riskBand === 'ELEVATED') riskBadgeClass = 'badge-elevated';
        else if (s.riskBand === 'MODERATE') riskBadgeClass = 'badge-moderate';
        else if (s.riskBand === 'EXCESS') riskBadgeClass = 'badge-excess';
        else if (s.riskBand === 'NO_DEMAND') riskBadgeClass = 'badge-nodemand';

        return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td>
            <strong>${escapeHtml(s.productName)}</strong>
            <br/>
            <small style="color: #64748b;">Code: ${escapeHtml(s.productCode)} | Cat: ${escapeHtml(s.category)}</small>
          </td>
          <td style="text-align: center; font-weight: bold; color: ${s.fleet.usableAvailableQuantity === 0 ? '#991b1b' : '#166534'};">
            ${s.fleet.usableAvailableQuantity}
          </td>
          <td style="text-align: center;">${s.fleet.emptyQuantity}</td>
          <td style="text-align: center; font-weight: 500;">${s.fleet.customerHeldQuantity}</td>
          <td style="text-align: center; color: ${s.fleet.defectiveQuantity > 0 ? '#b91c1c' : '#64748b'};">
            ${s.fleet.defectiveQuantity}
          </td>
          <td style="text-align: center; font-weight: bold;">${s.fleet.totalFleetQuantity}</td>
          <td style="text-align: center;">${adsDisplay}</td>
          <td style="text-align: center; font-weight: bold; color: ${s.coverageDays !== null && s.coverageDays < 7 ? '#991b1b' : '#0f172a'};">
            ${coverageDisplay}
          </td>
          <td style="text-align: center; font-weight: 600;">${s.safetyStockRecommendation}</td>
          <td style="text-align: center;">
            <span class="badge ${riskBadgeClass}">${s.riskBand}</span>
          </td>
        </tr>
        `;
    }).join('');

    const tiedUpCapitalStr = `PHP ${(kpis?.totalTiedUpCapital ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const utilStr = kpis?.fleetUtilizationRate !== null && kpis?.fleetUtilizationRate !== undefined ? `${kpis.fleetUtilizationRate}%` : 'N/A';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(sheetName)}</title>
  <style>
    /* No page rule: the print dialog sets paper, orientation and margins. */
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 10px;
      line-height: 1.35;
      color: #1e293b;
      margin: 0;
      padding: 24px 28px;
    }
    @media print {
      body { padding: 0; }
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .report-title h1 {
      font-size: 15px;
      font-weight: 800;
      margin: 0;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .report-meta {
      text-align: right;
    }
    .report-meta p {
      margin: 0;
      font-size: 9px;
      color: #64748b;
    }

    /* KPI summary cards: four across in a wide page, two-by-two in a tall one. */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    @media (orientation: portrait) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    }
    .kpi-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      background: #f8fafc;
    }
    .kpi-card .label {
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 2px;
    }
    .kpi-card .value {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
    }
    .kpi-card .sub {
      font-size: 8px;
      color: #94a3b8;
    }

    /* Context Banner */
    .context-bar {
      background: #f1f5f9;
      border-left: 3px solid #0284c7;
      padding: 5px 8px;
      font-size: 8.5px;
      margin-bottom: 12px;
      color: #334155;
    }

    /* Table */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
      margin-bottom: 14px;
    }
    /* Breaks fall between rows, never through one; the header row repeats on every page. */
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    .header, .kpi-grid, .context-bar { break-inside: avoid; page-break-inside: avoid; }
    /* The column headers must survive a printer that drops background fills: near-black text and a
       heavy rule under the row carry the header even when the tint below never reaches the paper. */
    th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 8px;
      letter-spacing: 0.3px;
      padding: 6px 4px;
      border: 1px solid #cbd5e1;
      border-bottom: 2px solid #0f172a;
    }
    td {
      padding: 5px 4px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 7.5px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-critical { background: #fee2e2; color: #991b1b; border: 1px solid #f87171; }
    .badge-elevated { background: #ffedd5; color: #9a3412; border: 1px solid #fb923c; }
    .badge-moderate { background: #fef3c7; color: #854d0e; border: 1px solid #facc15; }
    .badge-healthy  { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
    .badge-excess   { background: #e0e7ff; color: #3730a3; border: 1px solid #a5b4fc; }
    .badge-nodemand { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
  </style>
</head>
<body>

  <!-- Report title and the scope that produced the numbers. No letterhead: this sheet is
     internal working data, and the company identity adds nothing the reader cannot see elsewhere. -->
  <div class="header">
    <div class="report-title">
      <h1>Inventory Health Report</h1>
    </div>
    <div class="report-meta">
      <p><strong>Branch:</strong> ${escapeHtml(branchName)}</p>
      <p><strong>Period:</strong> ${escapeHtml(periodLabel)}</p>
      <p><strong>Printed:</strong> ${printDate}</p>
    </div>
  </div>

  <!-- KPI Grid -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="label">Stockout Risk Exposure</div>
      <div class="value" style="color: #e11d48;">${kpis?.criticalStockoutSkusCount ?? 0} SKUs</div>
      <div class="sub">Under 7 days remaining coverage</div>
    </div>
    <div class="kpi-card">
      <div class="label">Usable Stock on Hand</div>
      <div class="value" style="color: #059669;">${kpis?.totalUsableFleet ?? 0} Cylinders</div>
      <div class="sub">Full cylinders in good condition</div>
    </div>
    <div class="kpi-card">
      <div class="label">Fleet Utilization</div>
      <div class="value" style="color: #4f46e5;">${utilStr}</div>
      <div class="sub">${kpis?.totalCustomerHeld ?? 0} deployed with customers</div>
    </div>
    <div class="kpi-card">
      <div class="label">Dead Stock Capital Drag</div>
      <div class="value" style="color: #d97706;">${tiedUpCapitalStr}</div>
      <div class="sub">${kpis?.deadStockSkusCount ?? 0} dead-stock SKUs (no in-period demand, or 90+ days since last sale)</div>
    </div>
  </div>

  <!-- Audit Context Banner -->
  <div class="context-bar">
    <strong>Calculation Basis:</strong> ${escapeHtml(kpis?.metadata?.calculationBasis || 'N/A')}
    <br/>
    <strong>Data Scope:</strong> ${escapeHtml(kpis?.metadata?.missingDataNotice || 'Parent serialized cylinders only.')}
  </div>

  <!-- SKU Scorecard Table -->
  <table>
    <thead>
      <tr>
        <th style="width: 25px;">#</th>
        <th style="text-align: left;">Product Description / SKU</th>
        <th style="width: 50px;">Usable</th>
        <th style="width: 45px;">Empty</th>
        <th style="width: 55px;">With Cust</th>
        <th style="width: 50px;">Defect</th>
        <th style="width: 50px;">Total</th>
        <th style="width: 45px;">ADS</th>
        <th style="width: 60px;">Coverage</th>
        <th style="width: 55px;">Safety</th>
        <th style="width: 75px;">Risk Band</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || '<tr><td colspan="11" style="text-align:center; padding: 20px;">No inventory records match the selected parameters.</td></tr>'}
    </tbody>
  </table>

</body>
</html>`;
}
