// ProConnect — Salesforce Report Panels: Shared Types

export interface SfReportPanel {
  id: string;
  enabled: boolean;
  title: string;
  displayMode: "table" | "stat" | "chart" | "bar";
  reportUrl: string;
  reportId: string;
  reportName: string;
  visibleColumns: string[];
  columnLabels: Record<string, string>;
  maxRows: number;
  refreshMinutes: number;
  highlightTopN: number; // 0 = none, 1–5 = highlight that many rows
  statColumn?: string; // for stat mode: which column to pull value from
  statLabel?: string; // for stat mode: label above the big number
  chartValueColumn?: string; // for chart mode: which column provides slice values
  chartLabelColumn?: string; // for chart mode: which column provides labels
  barXAxisColumn?: string; // for bar mode: which column provides x-axis categories
  barYAxisColumn?: string; // for bar mode: which column provides y-axis numeric values
  barUnits?: "currency" | "number" | "percent"; // for bar mode: how to format y-axis values
  barLayout?: "vertical" | "horizontal"; // for bar mode: bar orientation (default vertical)
  sortColumn?: string; // column API name to sort rows by (empty = Salesforce default order)
  sortDirection?: "asc" | "desc"; // sort direction (default "asc")
  visibleToRoles?: string[]; // Logto role names that can see this section (empty = everyone)
  visibleToSuperAdminOnly?: boolean; // preview mode: only SUPER_ADMIN can see this panel
  order: number;
}

export interface SfReportPanelsConfig {
  widgetVisible: boolean;
  panels: SfReportPanel[];
}

export interface PanelData {
  id: string;
  title: string;
  displayMode: "table" | "stat" | "chart" | "bar";
  highlightTopN: number;
  columns?: { name: string; label: string }[];
  rows?: { cells: { label: string; value: string }[] }[];
  totalRows?: number;
  maxRows?: number;
  statValue?: string;
  statLabel?: string;
  fetchedAt?: string;
  chartData?: { label: string; value: number }[];
  barUnits?: "currency" | "number" | "percent";
  barLayout?: "vertical" | "horizontal";
  grandTotals?: { name: string; label: string; value: string }[];
}

export const DEFAULT_PANEL: Omit<SfReportPanel, "id" | "order"> = {
  enabled: true,
  title: "New Report",
  displayMode: "table",
  reportUrl: "",
  reportId: "",
  reportName: "",
  visibleColumns: [],
  columnLabels: {},
  maxRows: 15,
  refreshMinutes: 30,
  highlightTopN: 0,
  sortColumn: undefined,
  sortDirection: "asc",
  visibleToSuperAdminOnly: false,
};
