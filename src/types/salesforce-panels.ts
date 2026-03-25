// ProConnect — Salesforce Report Panels: Shared Types

export interface SfReportPanel {
  id: string;
  enabled: boolean;
  title: string;
  displayMode: "table" | "stat";
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
  displayMode: "table" | "stat";
  highlightTopN: number;
  columns?: { name: string; label: string }[];
  rows?: { cells: { label: string; value: string }[] }[];
  totalRows?: number;
  maxRows?: number;
  statValue?: string;
  statLabel?: string;
  fetchedAt?: string;
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
