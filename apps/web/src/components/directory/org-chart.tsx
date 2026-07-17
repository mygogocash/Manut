"use client";

import { ChevronDown, ChevronRight, GitBranch, Network } from "lucide-react";
import { useMemo, useState } from "react";

import styles from "@/components/directory/org-chart.module.css";
import { Avatar } from "@/components/shared/avatar";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import type { OrgChartNode } from "@/services/directory.service";

interface OrgTreeNode extends OrgChartNode {
  children: OrgTreeNode[];
}

type OrgChartLayout = "tree" | "pyramid";

function buildTree(nodes: OrgChartNode[]): OrgTreeNode[] {
  const map = new Map<string, OrgTreeNode>();
  const roots: OrgTreeNode[] = [];

  for (const node of nodes) {
    map.set(node.id, { ...node, children: [] });
  }

  for (const node of nodes) {
    const treeNode = map.get(node.id)!;
    if (node.reportingTo && map.has(node.reportingTo)) {
      map.get(node.reportingTo)!.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  }

  return roots;
}

// ─── Tree layout (vertical, indented) ───────────────────

function TreeNodeCard({
  node,
  depth = 0,
}: {
  node: OrgTreeNode;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div className={depth > 0 ? "border-border/50 ml-6 border-l pl-4" : ""}>
      <div
        className={`
          border-border bg-surface mb-1.5 flex items-center gap-2 rounded-lg
          border p-2.5 transition-colors
          hover:bg-accent/50
        `}
        onClick={() => hasChildren && setExpanded(!expanded)}
        role={hasChildren ? "button" : undefined}
        tabIndex={hasChildren ? 0 : undefined}
        onKeyDown={(e) => {
          if (hasChildren && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="text-muted-foreground size-3.5 shrink-0" />
          ) : (
            <ChevronRight className="text-muted-foreground size-3.5 shrink-0" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <Avatar name={node.name} src={node.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-[12px] font-medium">
            {node.name}
          </p>
          <p className="text-muted-foreground truncate text-[10px]">
            {node.jobTitle ?? node.department ?? "—"}
          </p>
        </div>
        {node.entity && (
          <Badge variant="grey" className="text-[9px]">
            {node.entity.code}
          </Badge>
        )}
        {hasChildren && (
          <span className="text-muted-foreground text-[10px] tabular-nums">
            {node.children.length}
          </span>
        )}
      </div>
      {expanded &&
        node.children.map((child) => (
          <TreeNodeCard key={child.id} node={child} depth={depth + 1} />
        ))}
    </div>
  );
}

// ─── Pyramid layout (horizontal, top-down) ──────────────
//
// Classic CSS-only org-chart with the `ul / li` pattern. Each `li`
// renders one node card, and its child `ul` lays the next row out as
// a flex row of `li`s. Connectors are drawn with `::before` / `::after`
// borders on each `li`:
//
//   - `::before` on every `li` (except the root) draws the vertical
//     stem from the horizontal sibling line down to the card.
//   - `::after` draws the horizontal half-line from the centre of the
//     card up to the sibling line. The first child hides its left
//     half, the last child hides its right half, so the row of
//     `::after`s is exactly the sibling line.
//
// The earlier hand-rolled version hard-coded the sibling-line width
// to `N × 12rem`, which assumed every child slot was exactly one card
// wide. Subtrees with their own grandchildren expanded past that and
// pushed siblings off the visible row. The `ul / li` pattern derives
// width from the actual subtree widths, so every sibling stays
// connected and visible regardless of how deep their descendants go.

function PyramidCard({ node }: { node: OrgTreeNode }) {
  const hasChildren = node.children.length > 0;
  return (
    <div
      className={`
        border-border bg-surface inline-flex w-44 flex-col items-center gap-1.5
        rounded-lg border px-3 py-2.5 text-center shadow-sm
      `}
    >
      <Avatar name={node.name} src={node.avatarUrl} />
      <div className="min-w-0">
        <p className="text-foreground truncate text-[12px] font-semibold">
          {node.name}
        </p>
        <p className="text-muted-foreground truncate text-[10px]">
          {node.jobTitle ?? node.department ?? "—"}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {node.entity && (
          <Badge variant="grey" className="text-[9px]">
            {node.entity.code}
          </Badge>
        )}
        {hasChildren && (
          <span className="text-muted-foreground text-[10px] tabular-nums">
            {node.children.length}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Public component ───────────────────────────────────

export function OrgChartView({ nodes }: { nodes: OrgChartNode[] }) {
  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const [layout, setLayout] = useState<OrgChartLayout>("tree");

  if (tree.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        No org chart data available
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">Layout</span>
        <div className="bg-muted/40 inline-flex rounded-md p-0.5">
          <Button
            type="button"
            size="sm"
            variant={layout === "tree" ? "default" : "ghost"}
            onClick={() => setLayout("tree")}
            className="h-7 gap-1.5 px-2.5 text-xs"
          >
            <GitBranch className="size-3.5" />
            Tree
          </Button>
          <Button
            type="button"
            size="sm"
            variant={layout === "pyramid" ? "default" : "ghost"}
            onClick={() => setLayout("pyramid")}
            className="h-7 gap-1.5 px-2.5 text-xs"
          >
            <Network className="size-3.5" />
            Pyramid
          </Button>
        </div>
      </div>

      {layout === "tree" ? (
        <div className="flex flex-col gap-1">
          {tree.map((root) => (
            <TreeNodeCard key={root.id} node={root} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          {/*
            Outer `<ul>` holds the chart root(s). Connectors are only
            drawn on `<li>`s that live INSIDE a `.children` `<ul>` (see
            `org-chart.module.css`), so the root rows render naked
            without phantom lines above them.
          */}
          <ul className={styles.tree}>
            {tree.map((root) => (
              <PyramidNode key={root.id} node={root} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// One `<li>` per node, plus a child `<ul>` when the node has direct
// reports. The earlier version wrapped each recursive call in its own
// `<ul>`, which double-nested every subtree and broke the connector
// math — siblings drifted away from their parent's stem and some
// cards rendered outside the visible area.
function PyramidNode({ node }: { node: OrgTreeNode }) {
  return (
    <li className={styles.node}>
      <PyramidCard node={node} />
      {node.children.length > 0 && (
        <ul className={styles.children}>
          {node.children.map((child) => (
            <PyramidNode key={child.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}
