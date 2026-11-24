/**
 * Print & Export HTML Generator for Warehouse Efficiency Intelligence Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Professional print stylesheet formatted for A4 landscape / portrait
 * - Shared reporting requirements: Period, Cutoff, Calculation Basis, and Missing Data Disclosures
 * - Clean executive layout suitable for browser window.print() or PDF export
 */

import { WarehouseEfficiencyReportPayload } from '../types';

export function generateWarehouseEfficiencyPrintHtml(report: WarehouseEfficiencyReportPayload): string {
    const { kpis, rows } = report;

    const rowsHtml = rows
        .map(
            (r, i) => `
        <tr style="border-bottom: 1px solid #e2e8f0; ${i % 2 === 0 ? 'background-color: #ffffff;' : 'background-color: #f8fafc;'}">
            <td style="padding: 8px 12px; font-weight: 500;">${r.warehouseName}</td>
            <td style="padding: 8px 12px; text-align: center;">${r.shift}</td>
            <td style="padding: 8px 12px; text-align: right;">${r.completedUnits.toLocaleString()}</td>
            <td style="padding: 8px 12px; text-align: right;">${r.pickRateDisplay}</td>
            <td style="padding: 8px 12px; text-align: right;">${r.dockUtilizationDisplay}</td>
            <td style="padding: 8px 12px; text-align: right;">${r.spaceUtilizationDisplay}</td>
            <td style="padding: 8px 12px; text-align: center;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; ${
                    r.bottleneck === 'SMOOTH_FLOW'
                        ? 'background-color: #dcfce7; color: #15803d;'
                        : r.bottleneck === 'DOCK_CONGESTION'
                        ? 'background-color: #fee2e2; color: #b91c1c;'
                        : 'background-color: #fef3c7; color: #b45309;'
                }">
                    ${r.bottleneck.replace(/_/g, ' ')}
                </span>
            </td>
        </tr>
    `
        )
        .join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Warehouse Efficiency Intelligence Report - ${kpis.metadata.selectedPeriod}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; padding: 32px; margin: 0; font-size: 13px; line-height: 1.5; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
        .title { font-size: 20px; font-weight: 700; color: #0f172a; }
        .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
        .badge { background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 11px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .kpi-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #f8fafc; }
        .kpi-label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; }
        .kpi-value { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #f1f5f9; border-bottom: 2px solid #cbd5e1; padding: 8px 12px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #475569; }
        .footer { border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #64748b; }
        @media print {
            body { padding: 0; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <div class="title">Warehouse Efficiency Intelligence Report</div>
            <div class="subtitle">Vertex Technologies Corporation &bull; Industrial Distribution System (IDS)</div>
        </div>
        <div style="text-align: right;">
            <div class="badge">Period: ${kpis.metadata.selectedPeriod}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Cutoff: ${kpis.metadata.sourceCutoff}</div>
        </div>
    </div>

    <div class="kpi-grid">
        <div class="kpi-card">
            <div class="kpi-label">Average Pick Rate</div>
            <div class="kpi-value">${kpis.averagePickRate !== null ? `${kpis.averagePickRate} u/hr` : 'Unavailable'}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Dock Utilization</div>
            <div class="kpi-value">${kpis.overallDockUtilizationRate !== null ? `${kpis.overallDockUtilizationRate}%` : 'Unavailable'}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Space Occupancy</div>
            <div class="kpi-value">${kpis.overallSpaceUtilizationRate !== null ? `${kpis.overallSpaceUtilizationRate}%` : 'Unavailable'}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Primary Constraint</div>
            <div class="kpi-value" style="font-size: 14px; color: #b45309;">${kpis.primaryIdentifiedBottleneck.replace(/_/g, ' ')}</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Warehouse / Depot</th>
                <th style="text-align: center;">Shift</th>
                <th style="text-align: right;">Completed Units</th>
                <th style="text-align: right;">Pick Throughput</th>
                <th style="text-align: right;">Dock Utilization</th>
                <th style="text-align: right;">Space Utilization</th>
                <th style="text-align: center;">Identified Bottleneck</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
    </table>

    <div class="footer">
        <div><strong>Calculation Basis:</strong> ${kpis.metadata.calculationBasis}</div>
        <div style="margin-top: 4px;"><strong>Disclosures & Limitations:</strong> ${kpis.metadata.missingDataNotice} Advisory only; AI proposals require human review before enactment.</div>
    </div>
</body>
</html>
    `;
}
