// ProConnect — Salesforce API Client
// Authenticates via Client Credentials flow and fetches report data.

const SF_CLIENT_ID = process.env.SF_CLIENT_ID ?? "";
const SF_CLIENT_SECRET = process.env.SF_CLIENT_SECRET ?? "";
const SF_LOGIN_URL =
  process.env.SF_LOGIN_URL ?? "https://login.salesforce.com";
const SF_API_VERSION = "v62.0";

interface TokenResponse {
  access_token: string;
  instance_url: string;
  token_type: string;
}

let cachedToken: { token: string; instanceUrl: string; expiresAt: number } | null = null;

/** Authenticate and return an access token (cached for 55 min). */
async function getAccessToken(): Promise<{ token: string; instanceUrl: string }> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return { token: cachedToken.token, instanceUrl: cachedToken.instanceUrl };
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: SF_CLIENT_ID,
    client_secret: SF_CLIENT_SECRET,
  });

  const res = await fetch(`${SF_LOGIN_URL}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Salesforce auth failed (${res.status}): ${err}`);
  }

  const body: TokenResponse = await res.json();

  cachedToken = {
    token: body.access_token,
    instanceUrl: body.instance_url,
    expiresAt: Date.now() + 55 * 60 * 1000, // 55 minutes
  };

  return { token: cachedToken.token, instanceUrl: cachedToken.instanceUrl };
}

/** Extract a Salesforce Report ID from a full Lightning URL or a bare 15/18-char ID. */
export function extractReportId(input: string): string | null {
  const trimmed = input.trim();
  // Bare 15 or 18-char ID starting with 00O
  if (/^00O[A-Za-z0-9]{12,15}$/.test(trimmed)) return trimmed;
  // URL containing /Report/<id>/
  const match = trimmed.match(/\/Report\/([A-Za-z0-9]{15,18})/i);
  return match?.[1] ?? null;
}

export interface SfReportColumn {
  name: string;
  label: string;
  dataType: string;
}

export interface SfReportRow {
  cells: { label: string; value: string }[];
}

export interface SfReportResult {
  reportName: string;
  reportFormat: string;
  columns: SfReportColumn[];
  rows: SfReportRow[];
  totalRows: number;
  grandTotals?: { name: string; label: string; value: string }[]; // T!T grand total aggregates for SUMMARY reports
}

/** Describe a report — returns available columns without executing it. */
export async function describeReport(reportId: string): Promise<{
  reportName: string;
  reportFormat: string;
  columns: SfReportColumn[];
  filters: { column: string; operator: string; value: string }[];
  filterLogic: string | null;
}> {
  const { token, instanceUrl } = await getAccessToken();

  const res = await fetch(
    `${instanceUrl}/services/data/${SF_API_VERSION}/analytics/reports/${reportId}/describe`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Salesforce report describe failed (${res.status}): ${err}`);
  }

  const body = await res.json();
  const meta = body.reportMetadata;
  const extendedMeta = body.reportExtendedMetadata;
  const reportFormat = meta?.reportFormat ?? "TABULAR";

  const columns: SfReportColumn[] = [];

  if (reportFormat === "TABULAR") {
    // TABULAR: show detail columns
    const detailCols: string[] = meta?.detailColumns ?? [];
    const detailColInfo = extendedMeta?.detailColumnInfo ?? {};
    for (const apiName of detailCols) {
      const info = detailColInfo[apiName] ?? {};
      columns.push({
        name: apiName,
        label: info.label ?? apiName,
        dataType: info.dataType ?? "string",
      });
    }
  } else if (reportFormat === "SUMMARY" || reportFormat === "MATRIX" || reportFormat === "MULTI_BLOCK") {
    // SUMMARY/MATRIX/MULTI_BLOCK: show grouping columns + aggregate columns (no detail columns)
    const groupingColInfo = extendedMeta?.groupingColumnInfo ?? {};
    const groupingsDown: { name: string }[] = meta?.groupingsDown ?? [];
    const groupingsAcross: { name: string }[] = meta?.groupingsAcross ?? [];
    const allGroupings = [...groupingsDown, ...groupingsAcross];
    for (const g of allGroupings) {
      const info = groupingColInfo[g.name] ?? {};
      columns.push({
        name: g.name,
        label: info.label ?? g.name,
        dataType: info.dataType ?? "string",
      });
    }

    // Aggregate columns
    const aggregates: string[] = meta?.aggregates ?? [];
    const aggColInfo = extendedMeta?.aggregateColumnInfo ?? {};
    for (const aggName of aggregates) {
      const info = aggColInfo[aggName] ?? {};
      columns.push({
        name: aggName,
        label: info.fullLabel ?? info.label ?? aggName,
        dataType: info.dataType ?? "string",
      });
    }
  }

  // Extract report filters and boolean filter logic
  const rawFilters: { column: string; operator: string; value: string }[] =
    (meta?.reportFilters ?? []).map((f: { column?: string; operator?: string; value?: string }) => ({
      column: String(f.column ?? ""),
      operator: String(f.operator ?? "equals"),
      value: String(f.value ?? ""),
    }));
  const filterLogic: string | null = meta?.reportBooleanFilter ?? null;

  return {
    reportName: meta?.name ?? "Unknown Report",
    reportFormat,
    columns,
    filters: rawFilters,
    filterLogic,
  };
}

/** Execute a report and return structured row data. */
export async function executeReport(reportId: string): Promise<SfReportResult> {
  const { token, instanceUrl } = await getAccessToken();

  const res = await fetch(
    `${instanceUrl}/services/data/${SF_API_VERSION}/analytics/reports/${reportId}?includeDetails=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Salesforce report execute failed (${res.status}): ${err}`);
  }

  const body = await res.json();
  const meta = body.reportMetadata;
  const extendedMeta = body.reportExtendedMetadata;
  const reportFormat = meta?.reportFormat ?? "TABULAR";

  // ─── Column metadata & Row extraction ───────────────
  const factMap = body.factMap ?? {};
  const rows: SfReportRow[] = [];
  const columns: SfReportColumn[] = [];

  if (reportFormat === "TABULAR") {
    // TABULAR: columns from detailColumns, rows from factMap["T!T"]
    const detailCols: string[] = meta?.detailColumns ?? [];
    const detailColInfo = extendedMeta?.detailColumnInfo ?? {};
    for (const apiName of detailCols) {
      const info = detailColInfo[apiName] ?? {};
      columns.push({
        name: apiName,
        label: info.label ?? apiName,
        dataType: info.dataType ?? "string",
      });
    }

    for (const key of Object.keys(factMap)) {
      const group = factMap[key];
      if (!group?.rows) continue;
      for (const row of group.rows) {
        rows.push({
          cells: row.dataCells.map((c: { label?: string; value?: string }) => ({
            label: c.label ?? c.value ?? "",
            value: c.value ?? c.label ?? "",
          })),
        });
      }
    }
  } else if (reportFormat === "SUMMARY" || reportFormat === "MATRIX" || reportFormat === "MULTI_BLOCK") {
    // SUMMARY/MATRIX/MULTI_BLOCK: show the grouped/summary view
    // Columns = grouping columns + aggregate columns (no detail columns)
    const groupingsDown: { name: string }[] = meta?.groupingsDown ?? [];
    const groupingColInfo = extendedMeta?.groupingColumnInfo ?? {};
    const groupingNames: string[] = [];
    for (const g of groupingsDown) {
      const info = groupingColInfo[g.name] ?? {};
      columns.push({
        name: g.name,
        label: info.label ?? g.name,
        dataType: info.dataType ?? "string",
      });
      groupingNames.push(g.name);
    }

    // Aggregate columns (including Record Count)
    const aggregates: string[] = meta?.aggregates ?? [];
    const aggColInfo = extendedMeta?.aggregateColumnInfo ?? {};
    for (const aggName of aggregates) {
      const info = aggColInfo[aggName] ?? {};
      columns.push({
        name: aggName,
        label: info.fullLabel ?? info.label ?? aggName,
        dataType: info.dataType ?? "string",
      });
    }

    // Walk the grouping tree — one row per group using aggregate values
    const groupingData = body.groupingsDown ?? { groupings: [] };
    extractGroupedRows(groupingData.groupings, factMap, aggregates, [], rows);
  }

  // Extract grand total (T!T) for SUMMARY/MATRIX/MULTI_BLOCK reports
  let grandTotals: { name: string; label: string; value: string }[] | undefined;
  if ((reportFormat === "SUMMARY" || reportFormat === "MATRIX" || reportFormat === "MULTI_BLOCK") && factMap["T!T"]) {
    const gtAggs = factMap["T!T"].aggregates ?? [];
    const aggNames: string[] = meta?.aggregates ?? [];
    grandTotals = gtAggs.map((a: { label?: string; value?: unknown } | null, i: number) => ({
      name: aggNames[i] ?? "",
      label: String(a?.label ?? a?.value ?? ""),
      value: String(a?.value ?? a?.label ?? ""),
    }));
  }

  return {
    reportName: meta?.name ?? "Unknown Report",
    reportFormat,
    columns,
    rows,
    totalRows: rows.length,
    grandTotals,
  };
}

/**
 * Recursively walk SUMMARY/MATRIX groupings to produce flat summary rows.
 * Each leaf grouping maps to a factMap key like "0!T", "1!T", "0_0!T", etc.
 * We build one row per group using the group label(s) + aggregate values.
 */
function extractGroupedRows(
  groupings: { key: string; label: string; groupings?: unknown[] }[],
  factMap: Record<string, { aggregates?: { label?: string; value?: unknown }[] }>,
  aggNames: string[],
  parentLabels: string[],
  out: SfReportRow[],
): void {
  for (const group of groupings) {
    const labels = [...parentLabels, group.label ?? ""];

    // If there are sub-groupings, recurse
    if (group.groupings && (group.groupings as unknown[]).length > 0) {
      extractGroupedRows(
        group.groupings as { key: string; label: string; groupings?: unknown[] }[],
        factMap,
        aggNames,
        labels,
        out,
      );
      continue;
    }

    // Leaf grouping — look up factMap entry for aggregate values
    const factKey = `${group.key}!T`;
    const fact = factMap[factKey];
    if (!fact?.aggregates) continue;

    const groupCells = labels.map((l) => ({ label: l, value: l }));

    // fact.aggregates mirrors meta.aggregates in order (1:1 positional)
    const aggCells = fact.aggregates.map((a: { label?: string; value?: unknown } | null) => ({
      label: String(a?.label ?? a?.value ?? ""),
      value: String(a?.value ?? a?.label ?? ""),
    }));

    out.push({ cells: [...groupCells, ...aggCells] });
  }
}

// ─── Execute with runtime filters (for Active Pipeline) ─

export interface SfReportFilter {
  column: string;
  operator: string; // "equals", "contains", "startsWith", etc.
  value: string;
}

/** Execute a report with runtime filter overrides via POST body. */
export async function executeReportWithFilters(
  reportId: string,
  filters: SfReportFilter[],
  filterLogic?: string | null,
): Promise<SfReportResult> {
  const { token, instanceUrl } = await getAccessToken();

  const reportMetadata: Record<string, unknown> = {
    reportFilters: filters.map((f) => ({
      column: f.column,
      operator: f.operator,
      value: f.value,
    })),
  };
  if (filterLogic) {
    reportMetadata.reportBooleanFilter = filterLogic;
  }

  const res = await fetch(
    `${instanceUrl}/services/data/${SF_API_VERSION}/analytics/reports/${reportId}?includeDetails=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reportMetadata }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Salesforce filtered report execute failed (${res.status}): ${err}`);
  }

  const body = await res.json();
  const meta = body.reportMetadata;
  const extendedMeta = body.reportExtendedMetadata;
  const reportFormat = meta?.reportFormat ?? "TABULAR";

  const factMap = body.factMap ?? {};
  const rows: SfReportRow[] = [];
  const columns: SfReportColumn[] = [];

  if (reportFormat === "TABULAR") {
    const detailCols: string[] = meta?.detailColumns ?? [];
    const detailColInfo = extendedMeta?.detailColumnInfo ?? {};
    for (const apiName of detailCols) {
      const info = detailColInfo[apiName] ?? {};
      columns.push({
        name: apiName,
        label: info.label ?? apiName,
        dataType: info.dataType ?? "string",
      });
    }
    for (const key of Object.keys(factMap)) {
      const group = factMap[key];
      if (!group?.rows) continue;
      for (const row of group.rows) {
        rows.push({
          cells: row.dataCells.map((c: { label?: string; value?: string }) => ({
            label: c.label ?? c.value ?? "",
            value: c.value ?? c.label ?? "",
          })),
        });
      }
    }
  } else if (reportFormat === "SUMMARY" || reportFormat === "MATRIX" || reportFormat === "MULTI_BLOCK") {
    const groupingsDown: { name: string }[] = meta?.groupingsDown ?? [];
    const groupingColInfo = extendedMeta?.groupingColumnInfo ?? {};
    for (const g of groupingsDown) {
      const info = groupingColInfo[g.name] ?? {};
      columns.push({
        name: g.name,
        label: info.label ?? g.name,
        dataType: info.dataType ?? "string",
      });
    }
    const aggregates: string[] = meta?.aggregates ?? [];
    const aggColInfo = extendedMeta?.aggregateColumnInfo ?? {};
    for (const aggName of aggregates) {
      const info = aggColInfo[aggName] ?? {};
      columns.push({
        name: aggName,
        label: info.fullLabel ?? info.label ?? aggName,
        dataType: info.dataType ?? "string",
      });
    }
    const groupingData = body.groupingsDown ?? { groupings: [] };
    extractGroupedRows(groupingData.groupings, factMap, aggregates, [], rows);
  }

  // Extract grand total (T!T) for SUMMARY/MATRIX/MULTI_BLOCK reports
  let grandTotals: { name: string; label: string; value: string }[] | undefined;
  if ((reportFormat === "SUMMARY" || reportFormat === "MATRIX" || reportFormat === "MULTI_BLOCK") && factMap["T!T"]) {
    const gtAggs = factMap["T!T"].aggregates ?? [];
    const aggNames: string[] = meta?.aggregates ?? [];
    grandTotals = gtAggs.map((a: { label?: string; value?: unknown } | null, i: number) => ({
      name: aggNames[i] ?? "",
      label: String(a?.label ?? a?.value ?? ""),
      value: String(a?.value ?? a?.label ?? ""),
    }));
  }

  return {
    reportName: meta?.name ?? "Unknown Report",
    reportFormat,
    columns,
    rows,
    totalRows: rows.length,
    grandTotals,
  };
}
