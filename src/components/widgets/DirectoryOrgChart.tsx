"use client";

import { useEffect, useMemo, useRef } from "react";
import type { DirectoryNode } from "@/hooks/useDirectory";

/* ── Flat datum used by d3-org-chart ── */
type OrgChartDatum = {
  id: string;
  parentId: string | null;
  displayName: string;
  jobTitle: string | null;
  department: string | null;
  employeeType?: string | null;
  photoUrl?: string;
  _isSyntheticRoot?: boolean;
};

const SYNTHETIC_ROOT_ID = "__company_root__";

function getPhotoUrl(
  user: { id: string; displayName: string; photoUrl?: string },
  size = 96
) {
  return (
    user.photoUrl ||
    `/api/directory/photo?userId=${encodeURIComponent(user.id)}&name=${encodeURIComponent(user.displayName)}&size=${size}x${size}`
  );
}

/**
 * Flatten the tree into a flat array for d3-org-chart.
 * If there are multiple root-level nodes we add a single synthetic
 * company root so the library doesn't throw "multiple roots".
 */
function sortNodesByHierarchy(nodes: DirectoryNode[]): DirectoryNode[] {
  return [...nodes].sort((a, b) => {
    const aHasReports = (a.directReports?.length ?? 0) > 0;
    const bHasReports = (b.directReports?.length ?? 0) > 0;
    if (aHasReports !== bHasReports) {
      return aHasReports ? -1 : 1;
    }
    const aName = a.displayName ?? "";
    const bName = b.displayName ?? "";
    return aName.localeCompare(bName, undefined, {
      sensitivity: "base",
    });
  });
}

function flattenForChart(nodes: DirectoryNode[]): OrgChartDatum[] {
  const rows: OrgChartDatum[] = [];

  const walk = (list: DirectoryNode[], parentId: string | null) => {
    const ordered = sortNodesByHierarchy(list);
    for (const node of ordered) {
      rows.push({
        id: node.id,
        parentId,
        displayName: node.displayName,
        jobTitle: node.jobTitle,
        department: node.department,
        employeeType: node.employeeType,
        photoUrl: node.photoUrl,
      });
      if (node.directReports?.length) {
        walk(node.directReports, node.id);
      }
    }
  };

  if (nodes.length > 1) {
    // Synthetic single root so d3-org-chart doesn't error
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
  }

  return rows;
}

export function DirectoryOrgChart({
  users,
  onSelect,
}: {
  users: DirectoryNode[];
  onSelect: (user: DirectoryNode) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);

  const flatChartData = useMemo(() => flattenForChart(users), [users]);

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

  useEffect(() => {
    if (!containerRef.current || flatChartData.length === 0) {
      return;
    }

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
        .nodeWidth(() => 230)
        .nodeHeight(() => 120)
        .childrenMargin(() => 50)
        .siblingsMargin(() => 30)
        .compactMarginBetween(() => 25)
        .compactMarginPair(() => 20)
        .initialZoom(0.6)
        .onNodeClick((d: any) => {
          const nodeId = d?.data?.id ?? d?.id;
          if (!nodeId || nodeId === SYNTHETIC_ROOT_ID) return;
          const selected = userById.get(nodeId);
          if (selected) onSelect(selected);
        })
        .nodeContent((d: any) => {
          const data: OrgChartDatum = d.data ?? d;

          // Synthetic root — branded company card
          if (data._isSyntheticRoot || data.id === SYNTHETIC_ROOT_ID) {
            return `
              <div style="
                width:220px; height:110px;
                border:2px solid #06427F;
                border-radius:14px;
                background:linear-gradient(135deg,#06427F 0%,#1a6bbf 100%);
                display:flex; align-items:center; justify-content:center;
                box-sizing:border-box; cursor:default;
              ">
                <div style="text-align:center;">
                  <div style="font-size:16px;font-weight:700;color:#fff;">${data.displayName}</div>
                  <div style="font-size:11px;color:rgba(255,255,255,0.7);margin-top:4px;">Organization</div>
                </div>
              </div>
            `;
          }

          const imageUrl = getPhotoUrl(
            { id: data.id, displayName: data.displayName, photoUrl: data.photoUrl },
            96
          );
          const dept = data.department
            ? `<div style="font-size:10px;color:#475569;margin-top:2px;">${data.department}</div>`
            : "";

          return `
            <div style="
              width:220px; height:110px;
              border:1px solid #e5e7eb;
              border-radius:12px;
              background:#ffffff;
              box-shadow:0 1px 2px rgba(0,0,0,0.06);
              display:flex; gap:10px; align-items:center;
              padding:10px; box-sizing:border-box; cursor:pointer;
            ">
              <img
                src="${imageUrl}"
                alt="${data.displayName}"
                loading="lazy"
                style="width:44px;height:44px;border-radius:999px;object-fit:cover;flex-shrink:0;border:1px solid #e5e7eb;"
                onerror="this.style.display='none'"
              />
              <div style="min-width:0;overflow:hidden;">
                <div style="font-size:13px;font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${data.displayName}</div>
                <div style="font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${data.jobTitle || "Team Member"}</div>
                ${dept}
              </div>
            </div>
          `;
        })
        .render();

      // Auto-fit after short delay to let SVG settle
      setTimeout(() => {
        try { chart.fit(); } catch { /* ignore */ }
      }, 300);

    };

    void mount();

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      chartRef.current = null;
    };
  }, [flatChartData, onSelect, userById]);

  if (flatChartData.length === 0) {
    return null;
  }

  return (
    <div
      className="w-full overflow-hidden rounded-lg border border-gray-100 bg-gray-50/40"
      style={{ height: "72vh" }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
