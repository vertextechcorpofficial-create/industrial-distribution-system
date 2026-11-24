/**
 * Printable HTML generator — Logistics and Delivery Reliability Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Sections: report title with print timestamp, applied filter + methodology block, KPI grid, route
 * reliability, late trips with their delay reason, fleet activity and the full trip-level register.
 * There is no letterhead — no logo, company name, address, TIN or registration number — because the
 * sheet is working data, and the company identity adds nothing the reader cannot see on screen.
 *
 * The browser print dialog owns the per-job layout — paper, orientation, margins, Save as PDF. This
 * generator only carries the sheet's own shape (text scale, KPI reflow, optional pinned `@page`), and
 * every one of those knobs lives in LOGISTICS_PRINT_LAYOUT below rather than in the CSS.
 *
 * Every value sourced from user input (remarks, customer names, plate numbers) is HTML-escaped: the print
 * window is written with document.write, so an unescaped quote in a driver remark would be live markup.
 */

import {
    FleetActivityRow,
    LogisticsReportFilter,
    ReportExecutiveKPIs,
    RoutePerformanceRow,
    LateShipmentRootCauseRow,
    TripSummaryRow,
} from '../types';
import {
    ARRIVAL_STATE_LABELS,
    formatDurationMinutes,
    formatPeso,
    formatPhDateTime,
    formatPercent,
    ROOT_CAUSE_LABELS,
} from '../services/logisticsMetrics';

/**
 * Printable layout knobs for the register. Deliberately a source constant, not an end-user setting:
 * the browser print dialog already covers per-job things like copies, scale and background graphics,
 * while these are a property of this report and change between builds, not between prints.
 *
 * Everything here is a fallback shape, not a mandate. No paper, orientation or margin is declared by
 * default, because `@page size`/`margin` overrides the dialog and greys the control out — and A4 is
 * not this company's only paper. Set them only when a sheet must be pinned for everyone.
 */
export interface LogisticsPrintLayout {
    /** Any CSS `@page size` keyword: 'A4', 'A3', 'Letter', 'Legal'. null = leave it to the dialog. */
    paperSize: string | null;
    /** null = leave it to the dialog. */
    orientation: 'portrait' | 'landscape' | null;
    /** Printed page margin in millimetres; null = the dialog's margin setting. Also the on-screen gutter, in px. */
    marginMm: number | null;
    /** Landscape body text in px. Every other text size is an em multiple, so this scales the whole sheet. */
    baseFontPx: number;
    /** Portrait body text as a multiple of baseFontPx — 11-column tables need the smaller step to fit. */
    portraitScale: number;
    /** Narrowest a KPI box may get before the grid reflows, so the row count follows the chosen paper. */
    kpiMinWidthPx: number;
}

/** The `@page` body built from the knobs; '' drops the rule so the print dialog keeps control. */
function buildPageRule(layout: LogisticsPrintLayout): string {
    const size = [layout.paperSize, layout.orientation].filter(Boolean).join(' ');
    const declarations = [
        size ? `size: ${escapeHtml(size)};` : '',
        layout.marginMm !== null ? `margin: ${layout.marginMm}mm;` : '',
    ]
        .filter(Boolean)
        .join(' ');
    return declarations ? `@page { ${declarations} }` : '';
}

export const LOGISTICS_PRINT_LAYOUT: LogisticsPrintLayout = {
    paperSize: null,
    orientation: null,
    marginMm: null,
    baseFontPx: 10,
    portraitScale: 0.9,
    kpiMinWidthPx: 250,
};

export interface LogisticsPrintInput {
    kpis: ReportExecutiveKPIs | null;
    trips: TripSummaryRow[];
    routes: RoutePerformanceRow[];
    lateShipments: LateShipmentRootCauseRow[];
    fleet: FleetActivityRow[];
    filter: LogisticsReportFilter;
    branchLabel: string;
    productLabel: string;
    searchTerm: string;
    /** Omit to use LOGISTICS_PRINT_LAYOUT. */
    layout?: LogisticsPrintLayout;
}

function escapeHtml(text: string | number | null | undefined): string {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const td = (value: string | number | null | undefined, style = ''): string =>
    `<td${style ? ` style="${style}"` : ''}>${escapeHtml(value)}</td>`;

export function generateLogisticsPrintHtml(input: LogisticsPrintInput): string {
    const { kpis, trips, routes, lateShipments, fleet, filter, branchLabel, productLabel, searchTerm } = input;
    const layout = input.layout ?? LOGISTICS_PRINT_LAYOUT;
    // With no declared @page margin the dialog owns the printed margin, but the sheet still needs a
    // small gutter so a portrait sheet does not set its text flush against the trim.
    const gutterPx = layout.marginMm ?? 10;
    const tolerance = kpis?.toleranceMinutes ?? filter.toleranceMinutes ?? 15;

    const printDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    // The sheet's own name, which the browser also offers as the default "Save as PDF" file name.
    // It states the scope rather than the minute the sheet was raised; the Printed line in the body
    // still carries the timestamp.
    const periodLabel = `${filter.startDate || 'start'} to ${filter.endDate || 'today'}`;
    const sheetName = `Logistics and Delivery Reliability Report - ${branchLabel} - ${periodLabel}`;

    const kpiBoxes: Array<[string, string, string]> = [
        [
            'Arrived On Time',
            formatPercent(kpis?.onTimeSharePercentage),
            `${kpis?.measurableTripsCount ?? 0} trip(s) with a promised arrival, ±${tolerance} min`,
        ],
        [
            'Average Arrival Gap',
            formatDurationMinutes(kpis?.meanAbsoluteErrorMinutes ?? null),
            `Median ${formatDurationMinutes(kpis?.medianEtaErrorMinutes ?? null)}`,
        ],
        [
            'Posted Trips',
            String(kpis?.totalTripsEvaluated ?? 0),
            `${kpis?.uncommittedTripsCount ?? 0} without an arrival promise · ${kpis?.missingArrivalCount ?? 0} never closed`,
        ],
        [
            'Late Arrivals',
            String(kpis?.lateTripsCount ?? 0),
            `${kpis?.depotLateDeparturesCount ?? 0} left late · ${kpis?.roadLateArrivalsCount ?? 0} late on the road`,
        ],
        [
            'Stops Unfulfilled',
            `${kpis?.unfulfilledStopsCount ?? 0} / ${kpis?.totalStops ?? 0}`,
            `${formatPercent(kpis?.unfulfilledStopsPercentage)} shortfall · ${kpis?.returnsStopsCount ?? 0} with returns`,
        ],
        [
            'Delivery Cost Per Unit',
            formatPeso(kpis?.averageCostPerDeliveredUnit),
            `${formatPeso(kpis?.totalTripCost)} over ${kpis?.totalDeliveredUnits ?? 0} unit(s) delivered`,
        ],
    ];

    const routeRows = routes
        .map(
            (r) => `<tr>
        ${td(`${r.depotBranchName} → ${r.destinationCluster}`)}
        ${td(r.totalTrips, 'text-align:center;')}
        ${td(r.measurableTrips, 'text-align:center;')}
        ${td(r.onTimeRatePercentage === null ? 'No promise' : formatPercent(r.onTimeRatePercentage), 'text-align:center;font-weight:bold;')}
        ${td(r.lateTrips, 'text-align:center;')}
        ${td(r.earlyTrips, 'text-align:center;')}
        ${td(formatDurationMinutes(r.meanAbsoluteErrorMinutes), 'text-align:right;')}
        ${td(r.totalStops, 'text-align:center;')}
        ${td(r.totalDeliveredUnits, 'text-align:right;')}
        ${td(formatPeso(r.totalRouteCost), 'text-align:right;')}
        ${td(r.costPerDeliveredUnit === null ? '—' : formatPeso(r.costPerDeliveredUnit), 'text-align:right;')}
      </tr>`
        )
        .join('');

    const lateRows = lateShipments
        .map(
            (r) => `<tr>
        ${td(r.docNo, 'font-weight:bold;')}
        ${td(r.date)}
        ${td(`${r.depotBranchName} → ${r.clusterName}`)}
        ${td(`${r.vehiclePlate} / ${r.driverName}`)}
        ${td(`+${formatDurationMinutes(r.etaErrorMinutes)}`, 'text-align:right;color:#991b1b;font-weight:bold;')}
        ${td(ROOT_CAUSE_LABELS[r.rootCauseCategory])}
        ${td(r.departureLagMinutes === null ? '—' : formatDurationMinutes(r.departureLagMinutes), 'text-align:right;')}
        ${td(`${r.unfulfilledStops} of ${r.stopsCount}`, 'text-align:center;')}
      </tr>`
        )
        .join('');

    const fleetRows = fleet
        .map(
            (v) => `<tr>
        ${td(`${v.vehiclePlate}${v.vehicleName ? ` — ${v.vehicleName}` : ''}`, 'font-weight:bold;')}
        ${td(v.vehicleType ?? '—')}
        ${td(v.registeredHomeBranch ?? '-')}
        ${td(v.totalTrips, 'text-align:center;')}
        ${td(v.activeDays, 'text-align:center;')}
        ${td(v.totalStops, 'text-align:center;')}
        ${td(v.totalDeliveredUnits, 'text-align:right;')}
        ${td(v.unfulfilledStops, 'text-align:center;')}
        ${td(v.onTimeRatePercentage === null ? 'No promise' : formatPercent(v.onTimeRatePercentage), 'text-align:center;')}
        ${td(formatPeso(v.totalCost), 'text-align:right;')}
        ${td(v.costPerDeliveredUnit === null ? '—' : formatPeso(v.costPerDeliveredUnit), 'text-align:right;')}
      </tr>`
        )
        .join('');

    const tripRows = trips
        .map(
            (t) => `<tr>
        ${td(t.docNo, 'font-weight:bold;')}
        ${td(t.date)}
        ${td(`${t.depotBranchName} → ${t.clusterName}`)}
        ${td(`${t.vehiclePlate} / ${t.driverName}`)}
        ${td(t.hasArrivalCommitment ? formatPhDateTime(t.plannedArrival) : 'Not promised')}
        ${td(t.actualArrival ? formatPhDateTime(t.actualArrival) : 'Not closed')}
        ${td(
            t.etaErrorMinutes === null
                ? '—'
                : `${t.etaErrorMinutes > 0 ? '+' : ''}${formatDurationMinutes(t.etaErrorMinutes)}`,
            `text-align:right;font-weight:bold;color:${
                t.arrivalState === 'LATE' ? '#991b1b' : t.arrivalState === 'ON_TIME' ? '#166534' : '#334155'
            };`
        )}
        ${td(ARRIVAL_STATE_LABELS[t.arrivalState], 'text-align:center;')}
        ${td(`${t.fulfilledStops}/${t.stopsCount}`, 'text-align:center;')}
        ${td(t.deliveredUnits, 'text-align:right;')}
        ${td(formatPeso(t.tripCost), 'text-align:right;')}
      </tr>`
        )
        .join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(sheetName)}</title>
  <style>
    ${buildPageRule(layout)}
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; background: #fff; font-size: ${layout.baseFontPx}px; line-height: 1.4; margin: 0; padding: ${gutterPx}px; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 1em; margin-bottom: 1.2em; display: flex; justify-content: space-between; align-items: flex-start; }
    .report-title { font-size: 1.4em; font-weight: 800; color: #0f172a; margin: 0; }
    .meta-box { text-align: right; font-size: 0.9em; color: #64748b; }
    .filters { display: flex; flex-wrap: wrap; gap: 0.8em 1.8em; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.6em; padding: 0.8em 1em; margin-bottom: 1.2em; font-size: 0.95em; }
    .filters b { color: #0f172a; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(${layout.kpiMinWidthPx}px, 1fr)); gap: 0.8em; margin-bottom: 1.2em; }
    .kpi-box { border: 1px solid #e2e8f0; border-left: 0.3em solid #0f172a; border-radius: 0.6em; padding: 0.8em 1em; }
    .kpi-label { font-size: 0.85em; text-transform: uppercase; letter-spacing: .04em; color: #64748b; font-weight: 700; }
    .kpi-value { font-size: 1.7em; font-weight: 800; color: #0f172a; }
    .kpi-note { font-size: 0.85em; color: #64748b; }
    h2 { font-size: 1.15em; text-transform: uppercase; letter-spacing: .04em; margin: 1.6em 0 0.6em 0; padding-bottom: 0.3em; border-bottom: 1px solid #cbd5e1; }
    table { width: 100%; border-collapse: collapse; }
    /* Near-black labels and a heavy rule, not a dark fill: the print dialog drops background
       colours, and a header drawn white-on-navy then arrives as an empty band. */
    th { background: #f1f5f9; border-bottom: 2px solid #0f172a; padding: 0.5em 0.6em; text-align: left; font-size: 0.88em; text-transform: uppercase; letter-spacing: .02em; color: #0f172a; }
    td { padding: 0.4em 0.6em; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
    .note { font-size: 0.88em; color: #64748b; background: #fffbeb; border: 1px solid #fde68a; border-radius: 0.6em; padding: 0.7em 0.9em; margin-bottom: 1em; }
    .signoff { margin-top: 2.6em; display: flex; gap: 4em; }
    .sign-block { flex: 1; border-top: 1px solid #0f172a; padding-top: 0.5em; font-size: 0.9em; text-align: center; color: #475569; }
    .footprint { margin-top: 1.8em; font-size: 0.8em; color: #94a3b8; text-align: center; border-top: 1px dashed #e2e8f0; padding-top: 0.6em; }
    /* The reader picks portrait or landscape in the dialog, so the sheet has to survive both: these
       registers carry eleven columns, and portrait only stays legible on the smaller text step. */
    @media (orientation: portrait) {
      body { font-size: ${(layout.baseFontPx * layout.portraitScale).toFixed(2)}px; }
      .header { flex-direction: column; gap: 0.8em; }
      .meta-box { text-align: left; }
    }
  </style>
</head>
<body>
  <!-- Report title and the moment the sheet was raised. No letterhead, no application name and no
       advisory-tier claim: the page carries data and the scope that produced it, nothing else. -->
  <div class="header">
    <p class="report-title">Logistics and Delivery Reliability Report</p>
    <div class="meta-box">
      <div><b>Printed:</b> ${escapeHtml(printDate)}</div>
    </div>
  </div>

  <div class="filters">
    <div><b>Branch:</b> ${escapeHtml(branchLabel)}</div>
    <div><b>Product:</b> ${escapeHtml(productLabel)}</div>
    <div><b>Period:</b> ${escapeHtml(periodLabel)}</div>
    <div><b>On-time window:</b> ±${escapeHtml(tolerance)} min</div>
    <div><b>Trips shown:</b> ${escapeHtml(trips.length)}</div>
    ${searchTerm ? `<div><b>Search:</b> ${escapeHtml(searchTerm)}</div>` : ''}
  </div>

  <div class="kpi-grid">
    ${kpiBoxes
        .map(
            ([label, value, note]) => `<div class="kpi-box">
      <div class="kpi-label">${escapeHtml(label)}</div>
      <div class="kpi-value">${escapeHtml(value)}</div>
      <div class="kpi-note">${escapeHtml(note)}</div>
    </div>`
        )
        .join('')}
  </div>


  <h2>1. Route Reliability and Cost (Branch → Destination Cluster)</h2>
  ${
    routes.length === 0
        ? '<p style="color:#64748b;">No routes were dispatched in this period.</p>'
        : `<table>
    <thead><tr>
      <th>Route</th><th style="text-align:center;">Trips</th><th style="text-align:center;">Scored</th>
      <th style="text-align:center;">On-time</th><th style="text-align:center;">Late</th><th style="text-align:center;">Early</th>
      <th style="text-align:right;">Avg Gap (early or late)</th><th style="text-align:center;">Stops</th>
      <th style="text-align:right;">Units</th><th style="text-align:right;">Budget</th><th style="text-align:right;">/Cost/Unit</th>
    </tr></thead>
    <tbody>${routeRows}</tbody></table>`
  }

  <h2>2. Late Trips and Their Delay Reason</h2>
  ${
    lateShipments.length === 0
        ? `<p style="color:#64748b;">No trip arrived more than ${escapeHtml(tolerance)} minutes after its promised time.</p>`
        : `<table>
    <thead><tr>
      <th>Trip No.</th><th>Date</th><th>Route</th><th>Vehicle / Driver</th>
      <th style="text-align:right;">How Late</th><th>Delay Reason</th>
      <th style="text-align:right;">Dispatch Delay</th><th style="text-align:center;">Stops Unfulfilled</th>
    </tr></thead>
    <tbody>${lateRows}</tbody></table>`
  }

  <h2>3. Fleet Activity and Cost Efficiency</h2>
  ${
    fleet.length === 0
        ? '<p style="color:#64748b;">No vehicle was dispatched under these filters.</p>'
        : `<table>
    <thead><tr>
      <th>Vehicle</th><th>Type</th><th>Home Branch</th>
      <th style="text-align:center;">Trips</th><th style="text-align:center;">Days Used</th>
      <th style="text-align:center;">Stops</th><th style="text-align:right;">Units</th>
      <th style="text-align:center;">Unfulfilled</th><th style="text-align:center;">On-time</th>
      <th style="text-align:right;">Budget</th><th style="text-align:right;">Cost/Unit</th>
    </tr></thead>
    <tbody>${fleetRows}</tbody></table>`
  }

  <h2>4. Trip-level Arrival Register</h2>
  ${
    trips.length === 0
        ? '<p style="color:#64748b;">No posted trips matched the applied filters.</p>'
        : `<table>
    <thead><tr>
      <th>Trip No.</th><th>Date</th><th>Route</th><th>Vehicle / Driver</th>
      <th>Promised Arrival</th><th>Recorded Arrival</th><th style="text-align:right;">Gap</th>
      <th style="text-align:center;">Verdict</th><th style="text-align:center;">Delivered</th>
      <th style="text-align:right;">Units</th><th style="text-align:right;">Budget</th>
    </tr></thead>
    <tbody>${tripRows}</tbody></table>`
  }




  <!-- No print script here: the module invokes the browser print dialog on this document, so the
       sheet is just markup and can be rendered anywhere. -->
</body>
</html>`;
}
