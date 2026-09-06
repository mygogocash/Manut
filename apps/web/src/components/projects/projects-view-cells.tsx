"use client";

import Link from "next/link";
import type * as React from "react";

import type { ProjectColumnConfig } from "@/components/projects/projects-view";
import { Badge, type BadgeVariant } from "@/components/shared/badge";
import { TableCell } from "@/components/ui/table";
import { stripHtmlToText } from "@/lib/utils";
import {
  AGREEMENT_OPTIONS,
  type Project,
  projectStatusLabel,
  type ProjectTeam,
} from "@/services/project.service";

// Project CRM table/card cell rendering.
//
// Extracted from `projects-view.tsx` in Phase 7 so the desktop table and the
// mobile card can render a value the SAME way. Nothing here changed in the move
// except the split between `projectCellContent` (the value) and
// `renderProjectCell` (the value inside a `<TableCell>`).
//
// It lives in its own module rather than being exported from `projects-view`
// because the mobile card imports it and `projects-view` imports the card —
// exporting from there would be a cycle.

export type { ProjectTeam };

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function teamCrmSlug(team: ProjectTeam): string | null {
  switch (team) {
    case "it":
      return "it-crm";
    case "product":
      return "product-crm";
    case "legal":
      return "legal-crm";
    case "accounting":
      return "accounting-crm";
    case "hr":
      return "hr-crm";
    default:
      return null;
  }
}

export function projectDetailHref(
  project: { id: string; slug?: string | null },
  team: ProjectTeam,
): string {
  const base = `/projects/${project.slug ?? project.id}`;
  const from = teamCrmSlug(team);
  return from ? `${base}?from=${from}` : base;
}

export const AGREEMENT_LABELS: Record<string, string> = Object.fromEntries(
  AGREEMENT_OPTIONS.map((a) => [a.value, a.label]),
);
export const AGREEMENT_VARIANTS: Record<string, BadgeVariant> = {
  signed: "green",
  not_signed: "red",
};

// ── Default (BD-style) layout column reorder (2026-06-10) ──────────────
// Drag-to-reorder columns on the general Project CRM list, persisted to
// localStorage via useColumnOrder. The drag handle + "#" stay fixed on
// the left and the actions menu on the right; everything between is
// reorderable. Legal / HR layouts keep their bespoke fixed order.
export type ProjectColKey =
  | "project"
  | "status"
  | "productionLive"
  | "goLive"
  | "revGoLive"
  | "agreement"
  | "dependency"
  | "comment"
  | "owner";

export const PROJECT_COL_STORAGE_KEY = "project-crm-col-order-v1";

export const PROJECT_COL_DEFAULT_ORDER: readonly ProjectColKey[] = [
  "project",
  "status",
  "productionLive",
  "goLive",
  "revGoLive",
  "agreement",
  "dependency",
  "comment",
  "owner",
];

export const PROJECT_COL_META: Record<
  ProjectColKey,
  { label: string; headClassName?: string }
> = {
  project: { label: "Project" },
  status: { label: "Status" },
  productionLive: { label: "Production Live", headClassName: "w-[120px]" },
  goLive: { label: "GoLive Date", headClassName: "w-[120px]" },
  revGoLive: { label: "Rev. GoLive", headClassName: "w-[120px]" },
  agreement: { label: "Agreement", headClassName: "w-[120px]" },
  dependency: { label: "Dependency", headClassName: "w-[140px]" },
  comment: { label: "Comment", headClassName: "w-[240px]" },
  owner: { label: "Owner", headClassName: "w-[140px]" },
};

// A column is shown only when its config flag is on (mirrors the old
// hardcoded `colConfig.show*` guards). Project / Status / GoLive /
// Dependency / Owner are always present in the default layout.
export function isProjectColVisible(
  key: ProjectColKey,
  cfg: ProjectColumnConfig,
): boolean {
  switch (key) {
    case "productionLive":
      return cfg.showProductionLive;
    case "revGoLive":
      return cfg.showRevGoLive;
    case "agreement":
      return cfg.showAgreement;
    case "comment":
      return cfg.showComment;
    default:
      return true;
  }
}

// Render one default-layout body cell by column key. Mirrors the JSX
// that used to be inlined in SortableProjectRow's default branch.
export function projectCellContent(
  key: ProjectColKey,
  project: Project,
  team: ProjectTeam,
): React.ReactNode {
  switch (key) {
    case "project":
      return (
        <Link
          href={projectDetailHref(project, team)}
          className={`
            hover:text-primary
            group block
          `}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <span
            className={`
              font-medium
              group-hover:underline
            `}
          >
            {project.name}
          </span>
          {project.description && (
            <p
              className={`
                text-muted-foreground mt-0.5 max-w-[280px] truncate text-[11px]
              `}
              title={stripHtmlToText(project.description)}
            >
              {stripHtmlToText(project.description)}
            </p>
          )}
        </Link>
      );
    case "status":
      return (
        <Badge status={project.status}>
          {projectStatusLabel(project.status)}
        </Badge>
      );
    case "productionLive":
      return (
        <span className="text-xs tabular-nums">
          {formatDate(project.productionLiveDate)}
        </span>
      );
    case "goLive":
      return (
        <span className="text-xs tabular-nums">
          {formatDate(project.goLiveDate)}
        </span>
      );
    case "revGoLive":
      return (
        <span className="text-xs tabular-nums">
          {formatDate(project.revisedGoLiveDate)}
        </span>
      );
    case "agreement":
      // A ternary, not an element: it cannot be returned wrapped in braces.
      return project.agreement ? (
        <Badge variant={AGREEMENT_VARIANTS[project.agreement] ?? "grey"}>
          {AGREEMENT_LABELS[project.agreement] ?? project.agreement}
        </Badge>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      );
    case "dependency":
      return (
        <span
          className={`
            text-foreground-secondary block max-w-[220px] truncate text-xs
          `}
        >
          {project.dependency || "—"}
        </span>
      );
    case "comment":
      return (
        <span
          className={`
            text-foreground-secondary line-clamp-2 block max-w-[240px] text-xs
            break-words whitespace-normal
          `}
          title={project.comment ? stripHtmlToText(project.comment) : undefined}
        >
          {project.comment ? stripHtmlToText(project.comment) : "—"}
        </span>
      );
    case "owner":
      return (
        <span className="text-foreground-secondary text-xs">
          {typeof project.owner === "string"
            ? project.owner
            : (project.owner?.name ?? "—")}
        </span>
      );
    default:
      return null;
  }
}

/**
 * One body cell, by column key.
 *
 * Thin wrapper over `projectCellContent` so the table and the mobile card
 * render the SAME value with the SAME formatting. Splitting the content out
 * (rather than duplicating it for the card) is what stops the two
 * representations drifting — a date formatted one way on desktop and another on
 * a phone is the kind of difference nobody notices until it is wrong.
 */
export function renderProjectCell(
  key: ProjectColKey,
  project: Project,
  team: ProjectTeam,
): React.ReactElement {
  return (
    <TableCell
      key={key}
      // Preserved from the original: only `comment` carried cell-level classes.
      className={key === "comment" ? "max-w-[240px] align-top" : undefined}
    >
      {projectCellContent(key, project, team)}
    </TableCell>
  );
}
