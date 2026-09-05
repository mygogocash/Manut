"use client";

import {
  Archive,
  ArchiveRestore,
  Eye,
  FolderInput,
  Pencil,
  Trash2,
} from "lucide-react";

import {
  PROJECT_COL_META,
  projectCellContent,
  type ProjectColKey,
  type ProjectTeam,
} from "@/components/projects/projects-view-cells";
import { RecordCard } from "@/components/shared/responsive/record-card";
import {
  type ResponsiveAction,
  ResponsiveActions,
} from "@/components/shared/responsive/responsive-actions";
import type { Project } from "@/services/project.service";

// One project, as a card, for viewports too narrow for the table.
//
// The desktop table shows nine columns across roughly 1,100px. At 320px that is
// a horizontal scroll through a wall of dates — technically all the data, and
// practically unusable. This shows the same record with the identifier and the
// two most-scanned fields up front, and everything else one tap away.
//
// Nothing is dropped: every column the table would show is either on the face of
// the card or inside its expansion. The values come from `projectCellContent`,
// the SAME function the table cells use, so a date or a badge cannot render
// differently here than it does on desktop.

/** Shown on the collapsed card, in this order, when visible for the layout. */
const FACE_COLS: ProjectColKey[] = ["owner", "goLive"];

export interface ProjectMobileCardProps {
  project: Project;
  /** Row number, matching the table's `#` column across pages. */
  index: number;
  /** Column keys visible for this team's layout — the same list the table uses. */
  visibleCols: ProjectColKey[];
  team: ProjectTeam;
  /** Whether this user may act on this row. Mirrors the table's own check. */
  canManageRow: boolean;
  isArchivedView: boolean;
  onView: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  /** Only present when the user may move between workspaces. */
  onMove?: () => void;
}

export function ProjectMobileCard({
  project,
  index,
  visibleCols,
  team,
  canManageRow,
  isArchivedView,
  onView,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
  onMove,
}: ProjectMobileCardProps) {
  const field = (key: ProjectColKey) => ({
    label: PROJECT_COL_META[key]?.label ?? key,
    value: projectCellContent(key, project, team),
  });

  // `project` is the title and `status` is the badge, so neither repeats in the
  // field lists. Everything else that the table would show goes on the face or
  // into the expansion — nothing is silently dropped.
  const shown: ProjectColKey[] = visibleCols.filter(
    (k) => k !== "project" && k !== "status",
  );
  const shownSet = new Set<string>(shown);
  const face = FACE_COLS.filter((k) => shownSet.has(k));
  const faceSet = new Set<string>(face);
  const rest = shown.filter((k) => !faceSet.has(k));

  // Identity mirrors the table's action menu exactly — same handlers, same
  // permission check, same archived/unarchived split. Demotion is presentation:
  // every action stays reachable, it just moves into the overflow.
  const actions: ResponsiveAction[] = [
    {
      id: "view",
      label: "View",
      icon: Eye,
      variant: "primary",
      onSelect: onView,
    },
    {
      id: "edit",
      label: "Edit",
      icon: Pencil,
      variant: "secondary",
      onSelect: onEdit,
      hidden: !canManageRow,
    },
    {
      id: "archive",
      label: isArchivedView ? "Unarchive" : "Archive",
      icon: isArchivedView ? ArchiveRestore : Archive,
      variant: "secondary",
      onSelect: isArchivedView ? onUnarchive : onArchive,
      hidden: !canManageRow,
    },
    {
      id: "move",
      label: "Move",
      icon: FolderInput,
      variant: "secondary",
      onSelect: () => onMove?.(),
      hidden: !canManageRow || !onMove,
    },
    {
      id: "delete",
      label: "Delete",
      icon: Trash2,
      variant: "destructive",
      onSelect: onDelete,
      hidden: !canManageRow,
    },
  ];

  return (
    <RecordCard
      title={
        <span className="flex items-baseline gap-2">
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {index}
          </span>
          <span className="min-w-0">{project.name}</span>
        </span>
      }
      subtitle={project.description || undefined}
      badge={projectCellContent("status", project, team)}
      fields={face.map(field)}
      details={rest.length > 0 ? rest.map(field) : undefined}
      // Tapping the card opens the project — the same destination as the row's
      // name link and its View action.
      onClick={onView}
      actions={<ResponsiveActions actions={actions} maxVisibleMobile={1} />}
    />
  );
}
