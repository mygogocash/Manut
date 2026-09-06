"use client";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  BellRing,
  ClipboardCheck,
  Download,
  Edit,
  Eye,
  GripVertical,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "nextjs-toploader/app";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { ProjectMobileCard } from "@/components/projects/project-mobile-card";
import {
  formatDate,
  isProjectColVisible,
  PROJECT_COL_DEFAULT_ORDER,
  PROJECT_COL_META,
  PROJECT_COL_STORAGE_KEY,
  type ProjectColKey,
  projectDetailHref,
  renderProjectCell,
} from "@/components/projects/projects-view-cells";
import { Badge, type BadgeVariant } from "@/components/shared/badge";
import { CrmImportDialog } from "@/components/shared/crm-import-dialog";
import { CrmReminderSettingsDialog } from "@/components/shared/crm-reminder-settings-dialog";
import { DataPagination } from "@/components/shared/data-pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { ExpandableText } from "@/components/shared/expandable-text";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionButton } from "@/components/shared/permission-button";
import {
  FilterGroup,
  FilterSheet,
  useFilterDraft,
} from "@/components/shared/responsive/filters";
import { ListSkeleton } from "@/components/shared/responsive/loading";
import { SearchInput } from "@/components/shared/responsive/search-input";
import { SortableColumnHead } from "@/components/shared/sortable-column-head";
import { Tabs } from "@/components/shared/tabs";
import { useColumnOrder } from "@/components/shared/use-column-order";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { type ExportFormat, exportRows } from "@/lib/crm-export";
import { stripHtmlToText } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import {
  type CrmSettingsModule,
  getCrmReminderSettings,
  updateCrmReminderSettings,
} from "@/services/crm-reminder-settings.service";
import {
  type AssignableUser,
  listAssignableUsers,
} from "@/services/directory.service";
import {
  AGREEMENT_OPTIONS,
  type AgreementValue,
  archiveProject,
  type CombinedImportProject,
  deleteProject,
  exportProjectTasks,
  getProjects,
  importCombinedProjects,
  moveProjectToPartner,
  type Project,
  PROJECT_STATUS_OPTIONS,
  type ProjectDepartment,
  type ProjectDetail,
  projectStatusLabel,
  type ProjectTaskExportRow,
  type ProjectTeam,
  reorderProjects,
  unarchiveProject,
} from "@/services/project.service";

// One row of the combined Projects+Tasks import sheet. `type` flags
// whether the row is a Project (opens a group) or a Task (attaches to
// the current group). All cells are strings as parsed from the sheet.
type CombinedImportRow = {
  type?: string;
  name?: string;
  description?: string;
  status?: string;
  priority?: string;
  department?: string;
  goLive?: string;
  dependency?: string;
  comment?: string;
  startDate?: string;
  endDate?: string;
  parentTitle?: string;
};

function getOwnerId(p: Project): string | undefined {
  return typeof p.owner === "object" && p.owner !== null
    ? p.owner.id
    : undefined;
}

// Per-team column overrides. Default = BD-style full set with three
// rollout dates, dependency, comment, department. Legal team's
// 2026-05-25 checklist xlsx only tracks Task | Owner | Date |
// Dependency | Status, so the workspace collapses to that shape
// while the underlying schema stays shared. Add an entry here to
// scope future teams (HR, etc.) without forking the table.
export interface ProjectColumnConfig {
  projectLabel: string;
  dateLabel: string;
  showProductionLive: boolean;
  showRevGoLive: boolean;
  showComment: boolean;
  showDepartment: boolean;
  // Project-team feedback (2026-06-10) — Agreement column (Signed /
  // Not Signed), shown after Rev. GoLive on the BD-style layout.
  showAgreement: boolean;
  // Legal team requested a different column shape AND a different
  // column order (Workstream | Legal Task | Owner | Due Date |
  // Status). When true, the header + row render the alternate
  // legal-only layout instead of the default BD-style one.
  legalLayout: boolean;
  // HR team layout (2026-05-26) — HR CRM uses Project rows as
  // operational tasks. Layout: # | Task | Task Type | Workflow
  // Status | Assigned Team | Due Date | Owner | actions. BD-style
  // GoLive / Dependency / Department cells are hidden.
  hrLayout: boolean;
}

const DEFAULT_COLUMN_CONFIG: ProjectColumnConfig = {
  projectLabel: "Project",
  dateLabel: "GoLive Date",
  showProductionLive: true,
  showRevGoLive: true,
  showComment: true,
  // Project-team feedback (2026-06-10): Department column dropped from
  // the Project CRM list (it only ever showed "Project"); replaced by
  // the new Agreement column. The `department` field/data is untouched.
  showDepartment: false,
  showAgreement: true,
  legalLayout: false,
  hrLayout: false,
};

const COLUMN_CONFIG_OVERRIDES: Partial<
  Record<ProjectTeam, ProjectColumnConfig>
> = {
  legal: {
    projectLabel: "Legal Task",
    dateLabel: "Due Date",
    showProductionLive: false,
    showRevGoLive: false,
    showComment: false,
    showDepartment: false,
    showAgreement: false,
    legalLayout: true,
    hrLayout: false,
  },
  accounting: {
    projectLabel: "Accounting Task",
    dateLabel: "Due Date",
    showProductionLive: false,
    showRevGoLive: false,
    showComment: false,
    showDepartment: false,
    showAgreement: false,
    legalLayout: true,
    hrLayout: false,
  },
  hr: {
    projectLabel: "Task",
    dateLabel: "Due Date",
    showProductionLive: false,
    showRevGoLive: false,
    showComment: false,
    showDepartment: false,
    showAgreement: false,
    legalLayout: false,
    hrLayout: true,
  },
};

function getColumnConfig(team: ProjectTeam): ProjectColumnConfig {
  return COLUMN_CONFIG_OVERRIDES[team] ?? DEFAULT_COLUMN_CONFIG;
}

// Agreement column (Project-team feedback, 2026-06-10). Signed reads as
// settled (green); Not Signed as an outstanding item that needs chasing
// (red), per Project-team feedback.

// HR CRM Workflow-Status colours (2026-06-02). The shared Badge
// STATUS_MAP follows the BD project spec (in_progress = red,
// not_yet_started = amber) which doesn't read as urgency for HR's
// operational task list. HR's badges are recoloured on an urgency
// gradient instead — applied ONLY in the hrLayout branch so the BD /
// IT / Legal / Product CRMs keep the shared spec.
//   red    → blocked, needs a decision now   (pending_approval)
//   amber  → waiting / not begun yet         (pending_documents, not_yet_started)
//   blue   → active and on track             (in_progress)
//   green  → finished                        (completed, closed)
//   grey   → terminated, no action needed    (cancelled)
// Any status not listed returns undefined, so the Badge falls back to
// the shared STATUS_MAP.
const HR_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  pending_approval: "red",
  pending_documents: "amber",
  not_yet_started: "amber",
  in_progress: "blue",
  completed: "green",
  closed: "green",
  cancelled: "grey",
};

function hrStatusVariant(status?: string): BadgeVariant | undefined {
  if (!status) return undefined;
  return HR_STATUS_VARIANTS[status.toLowerCase()];
}

// Map a team to the sidebar CRM slug; used to annotate the
// project-detail URL with `?from=<crm>` so the sidebar highlights
// the CRM the user navigated from instead of falling back to
// "Project CRM" via the generic `/projects/` longest-match.

// Legal CRM import helpers. The Legal checklist xlsx ships dates in
// several human formats (e.g. "04/27", "5/13", "2026-07-05 00:00:00",
// or "TBD"); try them in order and skip anything we can't pin to a
// real day. Status values are free-text ("Complete", "In progress",
// "On hold", …) — normalise to the project status enum the rest of
// the system uses; unknown values fall through to "not_yet_started"
// so the row still imports.
function parseLegalDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s || /^tbd$/i.test(s)) return null;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const md = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (md) {
    const y = new Date().getFullYear();
    return `${y}-${md[1].padStart(2, "0")}-${md[2].padStart(2, "0")}`;
  }
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }
  const fallback = new Date(s);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toISOString().slice(0, 10);
  }
  return null;
}

function normalizeLegalStatus(raw: string | null | undefined): string {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "not_yet_started";
  if (/^complete/.test(s) || s === "done") return "completed";
  if (/^in[\s_-]*progress/.test(s) || s === "ongoing" || s === "wip") {
    return "in_progress";
  }
  if (/^on[\s_-]*hold/.test(s) || s === "blocked" || s === "paused") {
    return "on_hold";
  }
  if (s === "uat") return "uat";
  if (/^staging/.test(s)) return "staging_integrated";
  if (/^prod/.test(s) || s === "live" || s === "deployed") {
    return "prod_integrated";
  }
  if (/^not[\s_-]*yet/.test(s) || s === "todo" || s === "backlog") {
    return "not_yet_started";
  }
  return "not_yet_started";
}

type LegalImportRow = {
  workstream?: string;
  legalTask?: string;
  owner?: string;
  date?: string;
  dependency?: string;
  description?: string;
  status?: string;
};

function getColumnCount(cfg: ProjectColumnConfig): number {
  if (cfg.legalLayout) {
    // drag, #, Workstream, Legal Task, Details, Owner, Due Date,
    // Status, actions = 9
    return 9;
  }
  if (cfg.hrLayout) {
    // drag, #, Task, Task Type, Workflow Status, Assigned Team,
    // Due Date, Owner, actions = 9
    return 9;
  }
  // Default: drag handle, #, Project, Status, Date, Dependency,
  // Owner, actions = 8. Optional cells add on top.
  return (
    8 +
    (cfg.showProductionLive ? 1 : 0) +
    (cfg.showRevGoLive ? 1 : 0) +
    (cfg.showAgreement ? 1 : 0) +
    (cfg.showComment ? 1 : 0) +
    (cfg.showDepartment ? 1 : 0)
  );
}

export interface ProjectsViewProps {
  /**
   * Workspace the view is scoped to. `general` is the BD dashboard at
   * `/projects`; `it` is the IT Helpdesk → Projects tab. The team is
   * passed through to list queries, create payloads, and the form
   * dialog so a new project lands in the right bucket.
   */
  team: ProjectTeam;
  /**
   * Wrap with a `<PageHeader>`. False when the view is embedded inside
   * another page that already owns the header (e.g. IT Helpdesk tabs).
   */
  showPageHeader?: boolean;
  /** Override for the page header title — only used when `showPageHeader` is true. */
  title?: string;
  /** Override for the page header subtitle. Falls back to a role-aware default. */
  subtitle?: string;
  /**
   * Permission code gating the "New Project" button. Defaults to
   * `projects:create`; pass `it:create` (or similar) when embedding
   * inside a different module so the button mirrors the host module's
   * RBAC.
   */
  createPermission?: string;
}

export function ProjectsView({
  team,
  showPageHeader = true,
  title = "Integration CRM",
  subtitle,
  createPermission = "projects:create",
}: ProjectsViewProps) {
  const { user, hasAnyPermission } = useAuth();
  const router = useRouter();

  // `projects:read-all` lets HR / leadership see every project on the
  // general workspace. Each team-CRM `*:read-all` widens its own
  // workspace to the team's audience. `projects:manage` admins always
  // get Edit / Delete in the row dropdown; team-CRM `*:manage` holders
  // get the same privileges within their own workspace.
  const canSeeAllProjects = hasAnyPermission("projects:read-all");
  const canSeeAllIt = hasAnyPermission("it-crm:read-all");
  const canSeeAllProduct = hasAnyPermission("product-crm:read-all");
  const canSeeAllLegal = hasAnyPermission("legal-crm:read-all");
  const canSeeAllAccounting = hasAnyPermission("accounting-crm:read-all");
  const canSeeAllHr = hasAnyPermission("hr-crm:read-all");
  const canSeeAll =
    canSeeAllProjects ||
    (team === "it" && canSeeAllIt) ||
    (team === "product" && canSeeAllProduct) ||
    (team === "legal" && canSeeAllLegal) ||
    (team === "accounting" && canSeeAllAccounting) ||
    (team === "hr" && canSeeAllHr);
  const canManageAny =
    hasAnyPermission("projects:manage") ||
    (team === "it" && hasAnyPermission("it-crm:manage")) ||
    (team === "product" && hasAnyPermission("product-crm:manage")) ||
    (team === "legal" && hasAnyPermission("legal-crm:manage")) ||
    (team === "accounting" && hasAnyPermission("accounting-crm:manage")) ||
    (team === "hr" && hasAnyPermission("hr-crm:manage"));
  // Deadline-reminder recipients. This component only owns the button
  // for the general (/projects) and HR (/hr-crm) workspaces — every
  // other team CRM mounts its own on its standalone list. The setting
  // is manage-only on the backend, so gate the button/dialog at the
  // same level to avoid a control that would 403 on save.
  const reminderModule: CrmSettingsModule = team === "hr" ? "hr" : "general";
  const canManageReminders =
    (team === "general" || team === "hr") &&
    (team === "hr"
      ? hasAnyPermission("hr-crm:manage", "projects:manage")
      : hasAnyPermission("projects:manage"));

  const colConfig = getColumnConfig(team);
  const colCount = getColumnCount(colConfig);

  // Default-layout column drag-to-reorder (persisted to localStorage).
  // Only the BD-style layout is reorderable; legal / HR keep their fixed
  // bespoke order. `visibleProjectCols` drops columns whose config flag
  // is off so the header and body stay in lockstep.
  const { colOrder, isColumnId, reorderColumns } = useColumnOrder(
    PROJECT_COL_STORAGE_KEY,
    PROJECT_COL_DEFAULT_ORDER,
  );
  const visibleProjectCols = useMemo(
    () => colOrder.filter((k) => isProjectColVisible(k, colConfig)),
    [colOrder, colConfig],
  );

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const pagination = usePagination();
  const { page, pageSize, setPage, setTotalCount, totalPages } = pagination;

  // Owner / Members picker source. Switched from `listUsers` (which
  // requires `user:read`) to the lean `/directory/assignable`
  // endpoint — auth-only, no perm gate — so team-CRM-only users
  // (Tanny / HR, Kunanon / IT, etc.) can populate the picker
  // without holding the HR-side `user:read` perm. Mirrors the
  // pattern the project detail page already uses for the
  // multi-assign picker (see #project_detail_page).
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  // Agreement filter (Project-team feedback), "" = All, else a value
  // from AGREEMENT_OPTIONS ("signed" / "not_signed"). Server-side so
  // paging covers the whole filtered set, mirroring the status filter.
  const [agreementFilter, setAgreementFilter] = useState<string>("");

  // Mobile filter sheet. The draft mirrors whatever is applied and resyncs
  // whenever the sheet opens, so abandoning it cannot leak into the next open.
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const appliedFilters = useMemo(
    () => ({ status: statusFilter, agreement: agreementFilter }),
    [statusFilter, agreementFilter],
  );
  const {
    draft: filterDraft,
    setDraft: setFilterDraft,
    dirty: filterDraftDirty,
  } = useFilterDraft(appliedFilters, filterSheetOpen);
  const activeFilterCount = (statusFilter ? 1 : 0) + (agreementFilter ? 1 : 0);
  // Active | Archived view. Orthogonal to the status filter, Archived shows
  // projects that were archived regardless of their board status.
  const [archived, setArchived] = useState(false);
  // Department filter UI removed (2026-06-10); kept as a constant "" so
  // the existing list-param / dependency plumbing stays intact.
  const [departmentFilter] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Stable load/save fns for the shared reminder-settings dialog —
  // it keys its load-on-open effect on `load`.
  const loadReminderSettings = useCallback(
    async () => (await getCrmReminderSettings(reminderModule)).data,
    [reminderModule],
  );
  const saveReminderSettings = useCallback(
    async (recipients: string[]) =>
      (await updateCrmReminderSettings(reminderModule, recipients)).data,
    [reminderModule],
  );
  // Move-to-Partner: only offered on the general Project CRM, to admins
  // / managers who can also create partners.
  const [moveTarget, setMoveTarget] = useState<Project | null>(null);
  const [moveCompany, setMoveCompany] = useState("");
  const [moving, setMoving] = useState(false);
  const canMoveToPartner =
    team === "general" && hasAnyPermission("partners:create");

  const prePersistOrder = useRef<Project[] | null>(null);

  function projectDetailToRow(d: ProjectDetail): Project {
    const { tasks: _t, columns: _c, ...row } = d;
    return row as Project;
  }

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages, setPage]);

  // Owner / Members picker source. Always-unfiltered roster; the
  // team→department filter (#592) returned 0 rows in prod because
  // the `User.department` taxonomy doesn't match the team labels.
  // Re-enable filtering after that data is normalised (separate
  // cleanup, out of scope here).
  useEffect(() => {
    let cancelled = false;
    listAssignableUsers({ page: 1, limit: 500 })
      .then((res) => {
        if (!cancelled) setUsers(res.data);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getProjects({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        department: (departmentFilter || undefined) as
          ProjectDepartment | undefined,
        agreement: (agreementFilter || undefined) as AgreementValue | undefined,
        team,
        archived: archived || undefined,
      });
      setProjects(result.data);
      setTotalCount(result.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load projects";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    debouncedSearch,
    statusFilter,
    departmentFilter,
    agreementFilter,
    team,
    archived,
    setTotalCount,
  ]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  // Reset to page 1 when switching Active ⇄ Archived so the new view opens
  // at its first page instead of a stale page index from the prior tab.
  useEffect(() => {
    setPage(1);
  }, [archived, setPage]);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const id = deleteTarget.id;
      await deleteProject(id);
      toast.success("Project deleted");
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setTotalCount((c) => Math.max(0, c - 1));
    } catch {
      toast.error("Failed to delete project");
    }
  }

  function openMoveDialog(p: Project) {
    setMoveTarget(p);
    setMoveCompany(p.name);
  }

  async function handleMoveConfirm() {
    if (!moveTarget) return;
    const company = moveCompany.trim();
    if (!company) {
      toast.error("Company name is required");
      return;
    }
    setMoving(true);
    try {
      const id = moveTarget.id;
      await moveProjectToPartner(id, company);
      toast.success(`Moved to Partner CRM as "${company}"`);
      setMoveTarget(null);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setTotalCount((c) => Math.max(0, c - 1));
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to move project";
      toast.error(msg);
    } finally {
      setMoving(false);
    }
  }

  const handleProjectSaved = useCallback(
    (saved: ProjectDetail) => {
      const row = projectDetailToRow(saved);
      if (editProject) {
        setProjects((prev) => prev.map((p) => (p.id === row.id ? row : p)));
        // HR / Tanny feedback (2026-05-26): a stale `editProject` ref
        // here meant reopening the dialog right after a save replayed
        // the old field values — the list state was up to date but
        // the dialog's `project` prop pointed at the row from before
        // the update. Refresh the ref so the next open hits a fresh
        // snapshot.
        setEditProject(row);
      } else if (!archived) {
        // A newly created project is active, it belongs to the Active view
        // only. On the Archived tab, skip the optimistic insert + count bump.
        setTotalCount((c) => c + 1);
        if (page === 1) {
          setProjects((prev) => {
            const next = [row, ...prev];
            return next.length > pageSize ? next.slice(0, pageSize) : next;
          });
        }
      }
    },
    [editProject, archived, page, pageSize, setTotalCount],
  );

  function handleEdit(p: Project) {
    setEditProject(p);
    setDialogOpen(true);
  }

  function handleNew() {
    setEditProject(null);
    setDialogOpen(true);
  }

  // Archive / restore. The current view (active vs archived) is the opposite
  // of the row's new state, so the row leaves the current list either way
  // drop it optimistically and adjust the total.
  const handleArchive = useCallback(
    async (p: Project) => {
      try {
        await archiveProject(p.id);
        setProjects((prev) => prev.filter((x) => x.id !== p.id));
        setTotalCount((c) => Math.max(0, c - 1));
        toast.success("Project archived");
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Failed to archive project",
        );
      }
    },
    [setTotalCount],
  );

  const handleUnarchive = useCallback(
    async (p: Project) => {
      try {
        await unarchiveProject(p.id);
        setProjects((prev) => prev.filter((x) => x.id !== p.id));
        setTotalCount((c) => Math.max(0, c - 1));
        toast.success("Project restored");
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Failed to restore project",
        );
      }
    },
    [setTotalCount],
  );

  // Combined export — one file carrying each project row immediately
  // followed by its task rows (incl. subtasks), distinguished by a
  // `Type` column. Mirrors the combined import below.
  const handleExportCombined = useCallback(
    async (format: ExportFormat) => {
      setExporting(true);
      try {
        const filters = {
          team,
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
          department: (departmentFilter || undefined) as
            ProjectDepartment | undefined,
          agreement: (agreementFilter || undefined) as
            AgreementValue | undefined,
        };
        const [projectsRes, tasksRes] = await Promise.all([
          getProjects({ page: 1, limit: 1000, ...filters }),
          exportProjectTasks(filters),
        ]);
        const projects = projectsRes.data;
        if (projects.length === 0) {
          toast.error("Nothing to export");
          return;
        }

        // Legal CRM export — emits the 7-column "Legal checklist"
        // shape (Workstream | Legal Task | Owner | Date | Dependency
        // | Description | Status) used by the Legal team's source
        // xlsx. Round-trips cleanly with the matching import branch
        // below. Tasks are intentionally NOT expanded: the Legal
        // list is project-only (no subtasks today).
        if (team === "legal") {
          exportRows(
            "legal-checklist",
            [
              {
                header: "Workstream",
                value: (r: Project) => r.workstream ?? "",
              },
              { header: "Legal Task", value: (r: Project) => r.name ?? "" },
              {
                header: "Owner",
                value: (r: Project) =>
                  typeof r.owner === "object" && r.owner
                    ? r.owner.name
                    : (r.owner ?? ""),
              },
              { header: "Date", value: (r: Project) => r.goLiveDate ?? "" },
              {
                header: "Dependency",
                value: (r: Project) => r.dependency ?? "",
              },
              {
                header: "Description",
                value: (r: Project) => r.details ?? "",
              },
              { header: "Status", value: (r: Project) => r.status ?? "" },
            ],
            projects,
            format,
          );
          return;
        }

        const tasksByProject = new Map<string, ProjectTaskExportRow[]>();
        for (const t of tasksRes.data) {
          const arr = tasksByProject.get(t.project);
          if (arr) arr.push(t);
          else tasksByProject.set(t.project, [t]);
        }
        const ownerName = (p: Project) =>
          typeof p.owner === "object" && p.owner
            ? p.owner.name
            : (p.owner ?? "");

        type CombinedRow = {
          type: string;
          name: string;
          description: string;
          status: string;
          priority: string;
          owner: string;
          department: string;
          goLive: string;
          dependency: string;
          comment: string;
          startDate: string;
          endDate: string;
          parentTitle: string;
        };
        const blank = {
          priority: "",
          department: "",
          goLive: "",
          dependency: "",
          comment: "",
          startDate: "",
          endDate: "",
          parentTitle: "",
        };
        const rows: CombinedRow[] = [];
        for (const p of projects) {
          rows.push({
            ...blank,
            type: "Project",
            name: p.name,
            description: "",
            status: p.status,
            owner: ownerName(p),
            department: p.department ?? "",
            goLive: p.goLiveDate ?? "",
            dependency: p.dependency ?? "",
            comment: p.comment ?? "",
          });
          for (const t of tasksByProject.get(p.name) ?? []) {
            rows.push({
              ...blank,
              type: "Task",
              name: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              owner: t.owner,
              startDate: t.startDate,
              endDate: t.endDate,
              parentTitle: t.parentTitle,
            });
          }
        }
        exportRows(
          team ? `${team}-projects-tasks` : "projects-tasks",
          [
            { header: "Type", value: (r: CombinedRow) => r.type },
            { header: "Name", value: (r: CombinedRow) => r.name },
            {
              header: "Description",
              value: (r: CombinedRow) => stripHtmlToText(r.description),
            },
            { header: "Status", value: (r: CombinedRow) => r.status },
            { header: "Priority", value: (r: CombinedRow) => r.priority },
            { header: "Owner", value: (r: CombinedRow) => r.owner },
            { header: "Department", value: (r: CombinedRow) => r.department },
            { header: "GoLive", value: (r: CombinedRow) => r.goLive },
            { header: "Dependency", value: (r: CombinedRow) => r.dependency },
            {
              header: "Comment",
              value: (r: CombinedRow) => stripHtmlToText(r.comment),
            },
            { header: "Start Date", value: (r: CombinedRow) => r.startDate },
            { header: "End Date", value: (r: CombinedRow) => r.endDate },
            { header: "Parent Task", value: (r: CombinedRow) => r.parentTitle },
          ],
          rows,
          format,
        );
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Failed to export";
        toast.error(msg);
      } finally {
        setExporting(false);
      }
    },
    [team, debouncedSearch, statusFilter, departmentFilter, agreementFilter],
  );

  // Reordering is page-local: API persists a global sort_order but we
  // only ship the ids visible on the current page. Searching/filtering
  // disables the drag handle to avoid persisting a permutation of a
  // subset.
  const reorderEnabled =
    !debouncedSearch.trim() &&
    !statusFilter &&
    !departmentFilter &&
    !agreementFilter &&
    !archived &&
    !loading &&
    projects.length > 1;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Header drag → column reorder. Column ids are short literals,
    // distinct from the project UUIDs used for row drag.
    if (isColumnId(active.id)) {
      if (isColumnId(over.id)) reorderColumns(active.id, over.id);
      return;
    }

    const oldIndex = projects.findIndex((p) => p.id === active.id);
    const newIndex = projects.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    prePersistOrder.current = projects;
    const next = arrayMove(projects, oldIndex, newIndex);
    setProjects(next);

    try {
      await reorderProjects(next.map((p) => p.id));
    } catch (err) {
      if (prePersistOrder.current) {
        setProjects(prePersistOrder.current);
      }
      const msg =
        err instanceof ApiError ? err.message : "Failed to reorder projects";
      toast.error(msg);
    } finally {
      prePersistOrder.current = null;
    }
  }

  const skeletonRows = useMemo(
    () => Array.from({ length: 6 }, (_, i) => i),
    [],
  );

  const resolvedSubtitle =
    subtitle ??
    (canSeeAll
      ? "Every project in the workspace"
      : "Projects you own or are assigned to as a member");

  const headerActions = (
    <div className="flex items-center gap-2">
      {team === "general" ? (
        <Button asChild variant="outline" size="sm">
          <Link href="/projects/dashboard">
            <LayoutDashboard className="size-3.5" />
            Dashboard
          </Link>
        </Button>
      ) : null}
      {team === "general" ? (
        // Single entry point into the approval workflow, the five request
        // views live behind this one link, so navigation stays one level deep.
        <Button asChild variant="outline" size="sm">
          <Link href="/projects/requests">
            <ClipboardCheck className="size-3.5" />
            Requests
          </Link>
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={exporting}>
            <Download className="size-3.5" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => void handleExportCombined("csv")}>
            CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleExportCombined("xlsx")}>
            Excel (.xlsx)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {canManageReminders ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setReminderOpen(true)}
        >
          <BellRing className="size-3.5" />
          Reminders
        </Button>
      ) : null}
      <PermissionButton
        variant="outline"
        permission={createPermission}
        onClick={() => setImportOpen(true)}
      >
        <Upload className="size-3.5" />
        Import
      </PermissionButton>
      <PermissionButton permission={createPermission} onClick={handleNew}>
        <Plus className="size-3.5" />
        New Project
      </PermissionButton>
    </div>
  );

  return (
    <div>
      {showPageHeader ? (
        <PageHeader title={title} subtitle={resolvedSubtitle}>
          {headerActions}
        </PageHeader>
      ) : (
        <div className="mb-4 flex items-center justify-end">
          {headerActions}
        </div>
      )}

      <Tabs
        tabs={[
          { id: "active", label: "Active" },
          { id: "archived", label: "Archived" },
        ]}
        active={archived ? "archived" : "active"}
        onChange={(v) => setArchived(v === "archived")}
      />

      {/* Toolbar.

          Desktop keeps the inline selects it has always had. Below `md` they
          would not fit — a flex row of a search box plus a 180px and a 160px
          select overflows a 320px screen — so the same two filters move into a
          sheet. The FILTER VALUES AND SEMANTICS ARE UNCHANGED: same state, same
          option lists, same server query. Only where you tap them differs. */}
      <div
        className={`
          mb-4 flex flex-col gap-2
          md:flex-row md:items-center md:gap-3
        `}
      >
        <div
          className={`
            min-w-0
            md:max-w-sm md:flex-1
          `}
        >
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search projects..."
            aria-label="Search projects"
          />
        </div>

        {/* Mobile: chips summarise what is applied, and open the sheet. */}
        <div
          className={`
            flex items-center gap-2
            md:hidden
          `}
        >
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => setFilterSheetOpen(true)}
          >
            <SlidersHorizontal className="size-3.5" />
            Filters
            {activeFilterCount > 0 ? (
              <span
                className={`
                  bg-primary text-primary-foreground ml-0.5 rounded-full px-1.5
                  text-[10px] font-semibold tabular-nums
                `}
              >
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
          {activeFilterCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-9"
              onClick={() => {
                setStatusFilter("");
                setAgreementFilter("");
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>

        {/* Desktop: unchanged. */}
        <div
          className={`
            hidden items-center gap-3
            md:flex
          `}
        >
          <Select
            value={statusFilter || "all"}
            onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-10 w-[180px] text-xs">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {PROJECT_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Agreement filter (Project-team feedback) — gated on the same
              flag as the Agreement column, so it appears wherever that
              column does (the default Project CRM layout) and is hidden on
              the HR layout, which doesn't track agreements. */}
          {colConfig.showAgreement ? (
            <Select
              value={agreementFilter || "all"}
              onValueChange={(v) => setAgreementFilter(v === "all" ? "" : v)}
            >
              <SelectTrigger className="h-10 w-[160px] text-xs">
                <SelectValue placeholder="All agreements" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agreements</SelectItem>
                {AGREEMENT_OPTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {/* Department filter removed (Project-team feedback, 2026-06-10)
              along with the Department column. The `department` field still
              exists on the model + project dialog; it's just no longer a
              list filter. */}
        </div>
      </div>

      {/* The same two filters, in a sheet. Selections are held as a draft and
          only committed on Apply, so the list behind does not churn on every
          tap and Cancel genuinely discards. */}
      <FilterSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        applyDisabled={!filterDraftDirty}
        onReset={() => setFilterDraft({ status: "", agreement: "" })}
        onApply={() => {
          setStatusFilter(filterDraft.status);
          setAgreementFilter(filterDraft.agreement);
        }}
      >
        <FilterGroup
          title="Status"
          includeAll
          allLabel="All statuses"
          selected={filterDraft.status}
          onChange={(v) =>
            setFilterDraft((d) => ({ ...d, status: v as string }))
          }
          options={PROJECT_STATUS_OPTIONS.map((s) => ({
            value: s.value,
            label: s.label,
          }))}
        />
        {colConfig.showAgreement ? (
          <FilterGroup
            title="Agreement"
            includeAll
            allLabel="All agreements"
            selected={filterDraft.agreement}
            onChange={(v) =>
              setFilterDraft((d) => ({ ...d, agreement: v as string }))
            }
            options={AGREEMENT_OPTIONS.map((a) => ({
              value: a.value,
              label: a.label,
            }))}
          />
        ) : null}
      </FilterSheet>

      {!reorderEnabled &&
      (debouncedSearch.trim() ||
        statusFilter ||
        departmentFilter ||
        agreementFilter ||
        archived) ? (
        <p className="text-muted-foreground mb-2 text-[11px]">
          {archived
            ? "Drag-to-reorder is disabled in the Archived view."
            : "Drag-to-reorder is disabled while a filter or search is active."}
        </p>
      ) : null}

      {/*
       * Sticky table header — height + scroll moved INTO the Table
       * primitive's own wrapper via `containerClassName`. The
       * primitive already wraps `<table>` in a `<div overflow-x-auto>`;
       * if we instead wrap that primitive in our OWN scrolling div,
       * the inner one wins the sticky context (CSS spec: when one
       * overflow axis is auto/scroll the other is implicitly auto too)
       * and the sticky thead resolves against a non-scrolling parent.
       * Net effect was the header looking pinned in dev but vanishing
       * on real-size data (#503 + this PR's bug report).
       */}
      {/* Mobile: one card per project.
          The table below is hidden rather than unmounted-by-JS so there is no
          layout flash while a media query resolves, and so both paths render
          from exactly the same `projects` array, filters, sort and page. */}
      <div
        className={`
          space-y-2.5
          md:hidden
        `}
      >
        {loading ? (
          <ListSkeleton rows={5} />
        ) : projects.length === 0 ? (
          <EmptyState
            title={
              search || statusFilter || agreementFilter
                ? "No projects match your filters"
                : archived
                  ? "No archived projects"
                  : "No projects yet"
            }
            description={
              search || statusFilter || agreementFilter
                ? "Try clearing a filter or searching for something else."
                : undefined
            }
          />
        ) : (
          projects.map((p, index) => (
            <ProjectMobileCard
              key={p.id}
              project={p}
              index={(page - 1) * pageSize + index + 1}
              visibleCols={visibleProjectCols}
              team={team}
              canManageRow={getOwnerId(p) === user?.id || canManageAny}
              isArchivedView={archived}
              onView={() => router.push(`/projects/${p.slug ?? p.id}`)}
              onEdit={() => handleEdit(p)}
              onArchive={() => void handleArchive(p)}
              onUnarchive={() => void handleUnarchive(p)}
              onDelete={() => {
                setDeleteTarget(p);
                setDeleteDialogOpen(true);
              }}
              onMove={canMoveToPartner ? () => openMoveDialog(p) : undefined}
            />
          ))
        )}
      </div>

      {/* Desktop / tablet: the table, unchanged. Drag-to-reorder is desktop-only
          — on a touch list the drag gesture competes with scrolling. */}
      <div
        className={`
          hidden
          md:block
        `}
      >
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <Table
            containerClassName={`
            max-h-[60svh] md:max-h-[calc(100vh-280px)] overflow-auto rounded-lg border
          `}
          >
            <TableHeader
              // bg-background covers the body rows when they scroll
              // under; z-10 keeps the header above sticky cells in the
              // first column (none here, but defensive).
              className="bg-background sticky top-0 z-10"
            >
              {colConfig.legalLayout ? (
                <TableRow>
                  <TableHead className="w-[36px]" />
                  <TableHead className="w-[48px]">#</TableHead>
                  <TableHead className="w-[180px]">Workstream</TableHead>
                  <TableHead>{colConfig.projectLabel}</TableHead>
                  <TableHead className="w-[320px]">Details</TableHead>
                  <TableHead className="w-[160px]">Owner</TableHead>
                  <TableHead className="w-[120px]">
                    {colConfig.dateLabel}
                  </TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              ) : colConfig.hrLayout ? (
                <TableRow>
                  <TableHead className="w-[36px]" />
                  <TableHead className="w-[48px]">#</TableHead>
                  <TableHead>{colConfig.projectLabel}</TableHead>
                  <TableHead className="w-[120px]">Task Type</TableHead>
                  <TableHead className="w-[160px]">Workflow Status</TableHead>
                  <TableHead className="w-[120px]">Assigned Team</TableHead>
                  <TableHead className="w-[120px]">
                    {colConfig.dateLabel}
                  </TableHead>
                  <TableHead className="w-[160px]">Owner</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              ) : (
                <TableRow>
                  <TableHead className="w-[36px]" />
                  <TableHead className="w-[48px]">#</TableHead>
                  {/* Reorderable data columns. The "#" + drag handle stay
                    fixed on the left and the actions menu on the right;
                    everything between can be dragged via its header. */}
                  <SortableContext
                    items={visibleProjectCols}
                    strategy={horizontalListSortingStrategy}
                  >
                    {visibleProjectCols.map((key) => (
                      <SortableColumnHead
                        key={key}
                        colKey={key}
                        label={PROJECT_COL_META[key].label}
                        className={PROJECT_COL_META[key].headClassName}
                      />
                    ))}
                  </SortableContext>
                  <TableHead className="w-[40px]" />
                </TableRow>
              )}
            </TableHeader>
            <TableBody>
              {loading ? (
                skeletonRows.map((i) => (
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell colSpan={colCount}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : projects.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={colCount}
                    className="text-muted-foreground py-10 text-center text-xs"
                  >
                    No projects found
                  </TableCell>
                </TableRow>
              ) : (
                <SortableContext
                  items={projects.map((p) => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {projects.map((p, index) => (
                    <SortableProjectRow
                      key={p.id}
                      project={p}
                      index={(page - 1) * pageSize + index + 1}
                      canDrag={reorderEnabled}
                      canManageRow={getOwnerId(p) === user?.id || canManageAny}
                      colConfig={colConfig}
                      visibleCols={visibleProjectCols}
                      team={team}
                      isArchivedView={archived}
                      onView={() => router.push(`/projects/${p.slug ?? p.id}`)}
                      onEdit={() => handleEdit(p)}
                      onArchive={() => void handleArchive(p)}
                      onUnarchive={() => void handleUnarchive(p)}
                      onDelete={() => {
                        setDeleteTarget(p);
                        setDeleteDialogOpen(true);
                      }}
                      onMove={
                        canMoveToPartner ? () => openMoveDialog(p) : undefined
                      }
                    />
                  ))}
                </SortableContext>
              )}
            </TableBody>
          </Table>
        </DndContext>
      </div>

      <div className="mt-3">
        <DataPagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalCount={pagination.totalCount}
          totalPages={pagination.totalPages}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </div>

      <ProjectFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        project={editProject}
        users={users}
        team={team}
        onSuccess={handleProjectSaved}
      />

      {canManageReminders ? (
        <CrmReminderSettingsDialog
          open={reminderOpen}
          onOpenChange={setReminderOpen}
          load={loadReminderSettings}
          save={saveReminderSettings}
        />
      ) : null}

      {/* Legal CRM uses the team's own xlsx template — a flat row
          per project with Workstream | Legal Task | Owner | Date |
          Dependency | Description | Status, no Type discrimination,
          no nested tasks. The generic Type-column importer below
          handles every other team. */}
      {team === "legal" ? (
        <CrmImportDialog<LegalImportRow>
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={() => void fetchProjects()}
          title="Import Legal checklist"
          entityLabel="rows"
          templateName="legal-checklist-import-template"
          fields={[
            {
              key: "workstream",
              headers: ["Workstream"],
              type: "string",
            },
            {
              key: "legalTask",
              headers: ["Legal Task", "Legal task"],
              type: "string",
            },
            { key: "owner", headers: ["Owner"], type: "string" },
            { key: "date", headers: ["Date", "Due Date"], type: "string" },
            {
              key: "dependency",
              headers: ["Dependency"],
              type: "string",
            },
            {
              key: "description",
              headers: ["Description"],
              type: "string",
            },
            { key: "status", headers: ["Status"], type: "string" },
          ]}
          submit={async (rows) => {
            // Owner is intentionally not threaded through: the
            // server's import payload takes an owner-id and the xlsx
            // ships a free-text name ("Maysa/Kit", "Shahab/Maysa").
            // Importers re-assign owners via the row dropdown after
            // import — same pattern the existing combined import
            // already follows.
            const groups: CombinedImportProject[] = rows.map((r) => {
              const workstream = r.workstream?.trim() ?? "";
              const legalTask = r.legalTask?.trim() ?? "";
              const goLiveDate = parseLegalDate(r.date) ?? undefined;
              return {
                name: legalTask,
                workstream: workstream || undefined,
                details: r.description?.trim() || undefined,
                dependency: r.dependency?.trim() || undefined,
                goLiveDate,
                status: normalizeLegalStatus(r.status),
                tasks: [],
              };
            });
            // Drop entirely blank rows so a few trailing empty lines
            // at the end of the sheet don't create "Untitled" rows.
            const filtered = groups.filter(
              (g) => g.name.length > 0 || (g.workstream ?? "").length > 0,
            );
            if (filtered.length === 0) {
              throw new Error("No rows to import");
            }
            const res = await importCombinedProjects(team, filtered);
            return { created: res.data.created };
          }}
        />
      ) : (
        <CrmImportDialog<CombinedImportRow>
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={() => void fetchProjects()}
          title="Import projects + tasks"
          entityLabel="rows"
          templateName={
            team
              ? `${team}-projects-tasks-import-template`
              : "projects-tasks-import-template"
          }
          fields={[
            { key: "type", headers: ["Type"], type: "string", required: true },
            {
              key: "name",
              headers: ["Name", "Project", "Task"],
              type: "string",
              required: true,
            },
            { key: "description", headers: ["Description"], type: "string" },
            { key: "status", headers: ["Status"], type: "string" },
            { key: "priority", headers: ["Priority"], type: "string" },
            { key: "department", headers: ["Department"], type: "string" },
            {
              key: "goLive",
              headers: ["GoLive", "GoLive Date"],
              type: "string",
            },
            { key: "dependency", headers: ["Dependency"], type: "string" },
            { key: "comment", headers: ["Comment"], type: "string" },
            {
              key: "startDate",
              headers: ["Start Date", "Start"],
              type: "string",
            },
            { key: "endDate", headers: ["End Date", "End"], type: "string" },
            {
              key: "parentTitle",
              headers: ["Parent Task", "Parent"],
              type: "string",
            },
          ]}
          submit={async (rows) => {
            // Walk rows in order: a Project row opens a group; following
            // Task rows attach to it. Tasks before any Project row are
            // dropped (export always leads with the Project row).
            const groups: CombinedImportProject[] = [];
            let current: CombinedImportProject | null = null;
            for (const r of rows) {
              const isTask =
                String(r.type ?? "")
                  .trim()
                  .toLowerCase() === "task";
              if (isTask) {
                current?.tasks.push({
                  title: r.name ?? "",
                  description: r.description || undefined,
                  status: r.status || undefined,
                  priority: r.priority || undefined,
                  startDate: r.startDate || undefined,
                  endDate: r.endDate || undefined,
                  parentTitle: r.parentTitle || undefined,
                });
              } else {
                current = {
                  name: r.name ?? "",
                  status: r.status || undefined,
                  department: r.department || undefined,
                  dependency: r.dependency || undefined,
                  comment: r.comment || undefined,
                  goLiveDate: r.goLive || undefined,
                  tasks: [],
                };
                groups.push(current);
              }
            }
            const res = await importCombinedProjects(team, groups);
            return { created: res.data.created };
          }}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;
              and all its tasks? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!moveTarget}
        onOpenChange={(o) => {
          if (!o) setMoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Partner CRM</AlertDialogTitle>
            <AlertDialogDescription>
              Copies this project and all its tasks into Partner CRM, then
              removes it from Integration CRM. The project name becomes the
              partner Company — recheck it below before moving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs">Company</p>
            <Input
              value={moveCompany}
              onChange={(e) => setMoveCompany(e.target.value)}
              placeholder="Company name"
              className="h-9 text-sm"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={moving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleMoveConfirm();
              }}
              disabled={moving || !moveCompany.trim()}
            >
              {moving ? "Moving..." : "Move"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableProjectRow({
  project,
  index,
  canDrag,
  canManageRow,
  colConfig,
  visibleCols,
  team,
  isArchivedView,
  onView,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
  onMove,
}: {
  project: Project;
  index: number;
  canDrag: boolean;
  canManageRow: boolean;
  colConfig: ProjectColumnConfig;
  visibleCols: ProjectColKey[];
  team: ProjectTeam;
  isArchivedView: boolean;
  onView: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onMove?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id, disabled: !canDrag });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={isDragging ? "bg-muted/40" : undefined}
    >
      <TableCell className="w-[36px]">
        <button
          type="button"
          aria-label="Drag to reorder"
          disabled={!canDrag}
          className={`
            text-muted-foreground inline-flex size-6 items-center justify-center
            rounded transition-colors
            hover:text-foreground
            disabled:cursor-not-allowed disabled:opacity-30
            ${
              canDrag
                ? `
                  cursor-grab
                  active:cursor-grabbing
                `
                : ""
            }
          `}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
      </TableCell>
      <TableCell>
        <span className="text-muted-foreground text-xs tabular-nums">
          {index}
        </span>
      </TableCell>
      {colConfig.legalLayout ? (
        <>
          <TableCell>
            <span className="text-foreground-secondary text-xs">
              {project.workstream || "—"}
            </span>
          </TableCell>
          <TableCell>
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
              {project.description ? (
                <ExpandableText
                  text={stripHtmlToText(project.description)}
                  max={200}
                  className="max-w-[320px] font-normal"
                />
              ) : null}
            </Link>
          </TableCell>
          <TableCell>
            {project.details ? (
              <p
                className={`
                  text-foreground-secondary line-clamp-3 max-w-[320px] text-xs
                  whitespace-pre-wrap
                `}
                title={project.details}
              >
                {project.details}
              </p>
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            )}
          </TableCell>
          <TableCell>
            <span className="text-foreground-secondary text-xs">
              {typeof project.owner === "string"
                ? project.owner
                : (project.owner?.name ?? "—")}
            </span>
          </TableCell>
          <TableCell>
            <span className="text-xs tabular-nums">
              {formatDate(project.goLiveDate)}
            </span>
          </TableCell>
          <TableCell>
            <Badge status={project.status}>
              {projectStatusLabel(project.status)}
            </Badge>
          </TableCell>
        </>
      ) : colConfig.hrLayout ? (
        <>
          <TableCell>
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
              {project.description ? (
                <p
                  className={`
                    text-muted-foreground mt-0.5 max-w-[320px] truncate
                    text-[11px] font-normal
                  `}
                  title={stripHtmlToText(project.description)}
                >
                  {stripHtmlToText(project.description)}
                </p>
              ) : null}
            </Link>
          </TableCell>
          <TableCell>
            <span className="text-foreground-secondary text-xs">
              {project.taskType || "—"}
            </span>
          </TableCell>
          <TableCell>
            <Badge
              status={project.status}
              variant={hrStatusVariant(project.status)}
            >
              {projectStatusLabel(project.status)}
            </Badge>
          </TableCell>
          <TableCell>
            <span className="text-foreground-secondary text-xs">
              {project.assignedTeam || "—"}
            </span>
          </TableCell>
          <TableCell>
            <span className="text-xs tabular-nums">
              {formatDate(project.goLiveDate)}
            </span>
          </TableCell>
          <TableCell>
            <span className="text-foreground-secondary text-xs">
              {typeof project.owner === "string"
                ? project.owner
                : (project.owner?.name ?? "—")}
            </span>
          </TableCell>
        </>
      ) : (
        // Default (BD-style) layout — cells render in the user's saved
        // column order. Comment / Agreement / etc. resolve by key so the
        // body stays in lockstep with the reorderable header.
        <>{visibleCols.map((key) => renderProjectCell(key, project, team))}</>
      )}
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onView}>
              <Eye className="mr-2 size-3.5" />
              View
            </DropdownMenuItem>
            {canManageRow && (
              <>
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="mr-2 size-3.5" />
                  Edit
                </DropdownMenuItem>
                {isArchivedView ? (
                  <DropdownMenuItem onClick={onUnarchive}>
                    <ArchiveRestore className="mr-2 size-3.5" />
                    Restore
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={onArchive}>
                    <Archive className="mr-2 size-3.5" />
                    Archive
                  </DropdownMenuItem>
                )}
                {onMove ? (
                  <DropdownMenuItem onClick={onMove}>
                    <ArrowRightLeft className="mr-2 size-3.5" />
                    Move to Partner CRM
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className={`
                    text-destructive
                    focus:text-destructive
                  `}
                  onClick={onDelete}
                >
                  <Trash2 className="mr-2 size-3.5" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
