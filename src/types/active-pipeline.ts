// ProConnect — Active Pipeline: Shared Types
// Per-user Salesforce report filtering — each panel runs a report
// filtered by the logged-in user's name or email at runtime.

/** A single filter from the SF report, with optional user-replacement config */
export interface ReportFilterConfig {
  column: string;
  operator: string;
  value: string; // original value from the report (may contain "$USER")
  replaceWithUser?: boolean; // if true, replace value with logged-in user identity
  matchBy?: "name" | "email"; // what user attribute to substitute
}

export interface PipelinePanel {
  id: string;
  enabled: boolean;
  title: string;
  displayMode: "table" | "stat" | "chart";
  reportUrl: string;
  reportId: string;
  reportName: string;
  visibleColumns: string[];
  columnLabels: Record<string, string>;
  maxRows: number;
  refreshMinutes: number;
  highlightTopN: number;
  statColumn?: string;
  statLabel?: string;
  // ─── Chart mode settings ─────────────────────────────
  chartValueColumn?: string; // column API name for slice values (e.g. "RowCount"); first grouping col = labels
  chartLabelColumn?: string; // override label column (defaults to first column)
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  visibleToRoles?: string[];
  visibleToSuperAdminOnly?: boolean; // preview mode: only SUPER_ADMIN can see this panel
  // ─── Per-user filter settings ────────────────────────
  // Legacy single-filter fields (still supported as fallback)
  filterColumn: string;
  filterMatchBy: "name" | "email";
  filterOperator: "equals" | "contains";
  // New: report's built-in filters with per-user replacement
  reportFilters?: ReportFilterConfig[];
  filterLogic?: string; // SF boolean filter logic (e.g. "1 AND 2 AND 3")
  order: number;
}

export interface PipelineConfig {
  widgetVisible: boolean;
  panels: PipelinePanel[];
}

export interface PipelinePanelData {
  id: string;
  title: string;
  displayMode: "table" | "stat" | "chart";
  highlightTopN: number;
  columns?: { name: string; label: string }[];
  rows?: { cells: { label: string; value: string }[] }[];
  totalRows?: number;
  maxRows?: number;
  statValue?: string;
  statLabel?: string;
  fetchedAt?: string;
  chartData?: { label: string; value: number }[];
  grandTotals?: { name: string; label: string; value: string }[];
}

export const DEFAULT_PIPELINE_PANEL: Omit<PipelinePanel, "id" | "order"> = {
  enabled: true,
  title: "New Pipeline Report",
  displayMode: "table",
  reportUrl: "",
  reportId: "",
  reportName: "",
  visibleColumns: [],
  columnLabels: {},
  maxRows: 25,
  refreshMinutes: 15,
  highlightTopN: 0,
  visibleToSuperAdminOnly: false,
  filterColumn: "",
  filterMatchBy: "name",
  filterOperator: "equals",
};
