"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DirectoryNode } from "@/hooks/useDirectory";
import type { DirectoryBranch } from "@/hooks/useDirectory";

/* ── Flat datum used by d3-org-chart ── */
type OrgChartDatum = {
  id: string;
  parentId: string | null;
  displayName: string;
  jobTitle: string | null;
  department: string | null;
  employeeType?: string | null;
  photoUrl?: string;
  branchName?: string | null;
  _isSyntheticRoot?: boolean;
};

const SYNTHETIC_ROOT_ID = "__company_root__";

/* ── Dark / Light colour tokens ── */
const THEME = {
  light: {
    cardBg: "#ffffff",
    cardBorder: "#e5e7eb",
    cardShadow: "0 1px 2px rgba(0,0,0,0.06)",
    nameColor: "#111827",
    titleColor: "#64748b",
    deptColor: "#475569",
    imgBorder: "#e5e7eb",
    linkColor: "#d1d5db",
    containerBg: "bg-gray-50/40",
    containerBorder: "border-gray-100",
  },
  dark: {
    cardBg: "#111827",
    cardBorder: "#1f2937",
    cardShadow: "0 1px 3px rgba(0,0,0,0.3)",
    nameColor: "#f3f4f6",
    titleColor: "#9ca3af",
    deptColor: "#9ca3af",
    imgBorder: "#374151",
    linkColor: "#4b5563",
    containerBg: "dark:bg-gray-950",
    containerBorder: "dark:border-gray-800",
  },
} as const;

function getPhotoUrl(
  user: { id: string; displayName: string; photoUrl?: string },
  size = 96
) {
  return `/api/directory/photo?userId=${encodeURIComponent(user.id)}&name=${encodeURIComponent(user.displayName)}&size=${size}x${size}`;
}

function sortNodesByHierarchy(
  nodes: DirectoryNode[],
  branchOrderMap?: Map<string, number>
): DirectoryNode[] {
  return [...nodes].sort((a, b) => {
    // Sort by branch order first (if branch data provided)
    if (branchOrderMap) {
      const aBranch = branchOrderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bBranch = branchOrderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      if (aBranch !== bBranch) return aBranch - bBranch;
    }
    const aHasReports = (a.directReports?.length ?? 0) > 0;
    const bHasReports = (b.directReports?.length ?? 0) > 0;
    if (aHasReports !== bHasReports) return aHasReports ? -1 : 1;
    return (a.displayName ?? "").localeCompare(b.displayName ?? "", undefined, { sensitivity: "base" });
  });
}

function flattenForChart(
  nodes: DirectoryNode[],
  branchOrderMap: Map<string, number>,
  branchNameMap: Map<string, string>
): OrgChartDatum[] {
  const rows: OrgChartDatum[] = [];

  const walk = (list: DirectoryNode[], parentId: string | null) => {
    const ordered = sortNodesByHierarchy(list, parentId ? branchOrderMap : undefined);
    for (const node of ordered) {
      rows.push({
        id: node.id,
        parentId,
        displayName: node.displayName,
        jobTitle: node.jobTitle,
        department: node.department,
        employeeType: node.employeeType,
        photoUrl: node.photoUrl,
        branchName: branchNameMap.get(node.id) ?? null,
      });
      if (node.directReports?.length) {
        walk(node.directReports, node.id);
      }
    }
  };

  if (nodes.length > 1) {
    rows.push({
      id: SYNTHETIC_ROOT_ID,
      parentId: null,
      displayName: "MortgagePros",
      jobTitle: "Company",
      department: null,
      employeeType: null,
      photoUrl: undefined,
      _isSyntheticRoot: true,
    });
    walk(nodes, SYNTHETIC_ROOT_ID);
  } else {
    walk(nodes, null);
    if (rows.length > 0 && rows[0].parentId === null) {
      rows[0]._isSyntheticRoot = true;
    }
  }

  return rows;
}

function useDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    setIsDark(html.classList.contains("dark"));
    const observer = new MutationObserver(() => setIsDark(html.classList.contains("dark")));
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

export function DirectoryOrgChart({
  users,
  branches = [],
  onSelect,
  expandAll = false,
  matchedNodeIds,
}: {
  users: DirectoryNode[];
  branches?: DirectoryBranch[];
  onSelect: (user: DirectoryNode) => void;
  expandAll?: boolean;
  // When set (search active), the chart collapses everything, then expands the
  // path from root to each matched node plus one level below (so the match's
  // direct reports are visible but their teams stay collapsed), and centers the
  // viewport on the first match. Takes precedence over expandAll.
  matchedNodeIds?: string[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const isDark = useDarkMode();

  // userId -> branch sort order (for sorting root's direct reports by branch)
  const branchOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const branch of branches) {
      for (const userId of branch.memberIds) {
        map.set(userId, branch.sortOrder);
      }
    }
    return map;
  }, [branches]);

  // userId -> branch name (for showing branch label on node card)
  const branchNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const branch of branches) {
      for (const userId of branch.memberIds) {
        map.set(userId, branch.name);
      }
    }
    return map;
  }, [branches]);

  const flatChartData = useMemo(
    () => flattenForChart(users, branchOrderMap, branchNameMap),
    [users, branchOrderMap, branchNameMap]
  );

  const userById = useMemo(() => {
    const map = new Map<string, DirectoryNode>();
    const walk = (nodes: DirectoryNode[]) => {
      for (const node of nodes) {
        map.set(node.id, node);
        if (node.directReports?.length) walk(node.directReports);
      }
    };
    walk(users);
    return map;
  }, [users]);

  const matchedKey = useMemo(() => (matchedNodeIds ?? []).join(","), [matchedNodeIds]);

  useEffect(() => {
    if (!containerRef.current || flatChartData.length === 0) return;

    const t = isDark ? THEME.dark : THEME.light;

    const mount = async () => {
      const { OrgChart } = await import("d3-org-chart");

      const container = containerRef.current;
      if (!container) return;
      container.innerHTML = "";

      const chart = new OrgChart();
      chartRef.current = chart;

      chart
        .container(container)
        .data(flatChartData)
        .nodeId((d: OrgChartDatum) => d.id)
        .parentNodeId((d: OrgChartDatum) => d.parentId)
        .compact(false)
        .initialExpandLevel(
          matchedNodeIds && matchedNodeIds.length > 0
            ? 0 // search active — expansion is driven programmatically below
            : expandAll
              ? 100
              : 1
        )
        .nodeWidth((d: any) => {
          const data: OrgChartDatum = d.data ?? d;
          return (data._isSyntheticRoot || data.id === SYNTHETIC_ROOT_ID) ? 280 : 230;
        })
        .nodeHeight((d: any) => {
          const data: OrgChartDatum = d.data ?? d;
          if (data._isSyntheticRoot || data.id === SYNTHETIC_ROOT_ID) return 90;
          return 120;
        })
        .childrenMargin(() => 50)
        .siblingsMargin(() => 30)
        .compactMarginBetween(() => 25)
        .compactMarginPair(() => 20)
        .initialZoom(0.6)
        .linkUpdate(function (this: any, _d: any) {
          // d3-org-chart calls this via selection.each(), so `this` is the raw
          // <path> DOM node — not a d3 selection. Set attributes directly.
          const el = this as SVGPathElement | null;
          if (el && typeof el.setAttribute === "function") {
            el.setAttribute("stroke", t.linkColor);
            el.setAttribute("stroke-width", "1.5");
            el.setAttribute("fill", "none");
          }
        })
        .onNodeClick((d: any) => {
          const nodeId = d?.data?.id ?? d?.id;
          const nodeData: OrgChartDatum = d?.data ?? d;
          if (!nodeId || nodeId === SYNTHETIC_ROOT_ID || nodeData?._isSyntheticRoot) return;
          const selected = userById.get(nodeId);
          if (selected) onSelect(selected);
        })
        .nodeContent((d: any) => {
          const data: OrgChartDatum = d.data ?? d;

          // Synthetic root — branded card
          if (data._isSyntheticRoot || data.id === SYNTHETIC_ROOT_ID) {
            const rootBg = isDark ? "#0c2d4d" : "#f0f6fc";
            const teamMembers = flatChartData.length - 1; // exclude root itself
            const parentIds = new Set(flatChartData.map((n) => n.parentId).filter(Boolean));
            const leaders = flatChartData.filter((n) => n.id !== SYNTHETIC_ROOT_ID && parentIds.has(n.id)).length;

            return `
              <div style="
                width:270px; height:80px;
                border:1.5px solid #06427F;
                border-radius:14px;
                background:${rootBg};
                box-shadow:${t.cardShadow};
                display:flex; flex-direction:column; justify-content:center; align-items:center;
                padding:12px; box-sizing:border-box; cursor:default;
              ">
                <div style="font-size:15px; font-weight:600; color:${t.nameColor};">${data.displayName}</div>
              </div>
            `;
          }

          const imageUrl = getPhotoUrl(
            { id: data.id, displayName: data.displayName, photoUrl: data.photoUrl },
            96
          );
          const dept = data.department
            ? `<div style="font-size:10px;color:${t.deptColor};margin-top:2px;">${data.department}</div>`
            : "";

          const cardHeight = 110;

          return `
            <div style="
              width:220px; height:${cardHeight}px;
              border:1px solid ${t.cardBorder};
              border-radius:12px;
              background:${t.cardBg};
              box-shadow:${t.cardShadow};
              display:flex; flex-direction:column; justify-content:center;
              padding:10px; box-sizing:border-box; cursor:pointer;
              transition:all 0.2s ease;
            "
            onmouseenter="this.style.transform='translateY(-4px) scale(1.02)'; this.style.boxShadow='0 12px 24px rgba(0,0,0,0.15)';"
            onmouseleave="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='${t.cardShadow}';"
            >
              <div style="display:flex; gap:10px; align-items:center;">
                <img
                  src="${imageUrl}"
                  alt="${data.displayName}"
                  loading="lazy"
                  style="width:44px;height:44px;border-radius:999px;object-fit:cover;flex-shrink:0;border:1px solid ${t.imgBorder};"
                  onerror="this.style.display='none'"
                />
                <div style="min-width:0;overflow:hidden;">
                  <div style="font-size:13px;font-weight:600;color:${t.nameColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${data.displayName}</div>
                  <div style="font-size:11px;color:${t.titleColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${data.jobTitle || (data.branchName ? "Managing Partner" : "Team Member")}</div>
                  ${dept}
                </div>
              </div>
            </div>
          `;
        })
        .render();

      const hasMatches = !!matchedNodeIds && matchedNodeIds.length > 0;

      if (hasMatches) {
        // Collapse everything, then for each match expand the path from root to
        // it (setCentered handles ancestors) plus one level below the match so
        // its direct reports are visible but their teams stay collapsed.
        chart.collapseAll();
        for (const id of matchedNodeIds!) {
          chart.setCentered(id); // expands ancestors + the match, marks centered
          chart.setExpanded(id, true); // reveal the match's direct reports
        }
        chart.render();
        // setCentered scrolls to the (last) centered node; nudge it to settle.
        setTimeout(() => {
          try { chart.setCentered(matchedNodeIds![0]).render(); } catch { /* ignore */ }
        }, 300);
      } else {
        setTimeout(() => {
          try { chart.fit(); } catch { /* ignore */ }
        }, 300);
      }
    };

    void mount();

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
      chartRef.current = null;
    };
    // matchedKey makes the array a stable dependency (re-run only when the set
    // of matched IDs actually changes, not on every parent render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatChartData, onSelect, userById, isDark, expandAll, matchedKey]);

  if (flatChartData.length === 0) return null;

  return (
    <div
      className="w-full overflow-hidden rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-950"
      style={{ height: "72vh" }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
