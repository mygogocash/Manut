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
  BellRing,
  ChevronDown,
  ChevronRight,
  Download,
  Edit,
  Eye,
  GripVertical,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter } from "nextjs-toploader/app";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { ItWorkspaceTabs } from "@/components/it/it-workspace-tabs";
import { ItCrmFormDialog } from "@/components/it-crm/it-crm-form-dialog";
import { ItCrmReminderSettingsDialog } from "@/components/it-crm/it-crm-reminder-settings-dialog";
import { Badge } from "@/components/shared/badge";
import { CrmImportDialog } from "@/components/shared/crm-import-dialog";
import { DataPagination } from "@/components/shared/data-pagination";
import { ExpandableText } from "@/components/shared/expandable-text";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionButton } from "@/components/shared/permission-button";
import { SortableColumnHead } from "@/components/shared/sortable-column-head";
import { Tabs } from "@/components/shared/tabs";
import { useColumnWidths } from "@/components/shared/use-column-widths";
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
  type AssignableUser,
  listAssignableUsers,
} from "@/services/directory.service";
import {
  archiveItProject,
  type CreateItProjectInput,
  deleteItProject,
  getItProjectBoard,
  importItProjects,
  type ItProject,
  type ItProjectBoard,
  type ItProjectTask,
  listItProjects,
  reorderItProjects,
  unarchiveItProject,
} from "@/services/it-crm.service";

const STATUS_OPTIONS = [
  { value: "not_yet_started", label: "Not Yet Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "uat", label: "UAT" },
  { value: "staging_integrated", label: "Staging Integrated" },
  { value: "prod_integrated", label: "Prod. Integrated" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
];

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.label]),
);

const STATUS_VARIANTS: Record<
  string,
  "green" | "amber" | "red" | "gold" | "blue" | "grey" | "purple" | "teal"
> = {
  not_yet_started: "grey",
  in_progress: "blue",
  uat: "amber",
  staging_integrated: "purple",
  prod_integrated: "teal",
  on_hold: "red",
  completed: "green",
};

// Per-CRM, reorderable column registry. The drag handle (left) and
// kebab actions (right) are fixed — only these middle columns can be
// rearranged via the header drag affordance. localStorage persists
// the chosen order per browser; resetting the key (or clearing
// storage) restores the default sequence below.
// IT-team feedback (2026-05-26): drop Rev. GoLive + Dependency from
// the visible list; rename them to Deadline + Blocker (re-using the
// same backing fields so no schema migration is needed). Bumped the
// storage version so any browser carrying a v1 order falls back to
// the new default. Comment column kept.
const IT_COL_STORAGE_KEY = "it-crm-col-order-v2";
type ItColKey =
  | "rownum"
  | "project"
  | "status"
  | "owner"
  | "goLive"
  | "deadline"
  | "blocker"
  | "comment";
const IT_COL_DEFAULT_ORDER: ItColKey[] = [
  "rownum",
  "project",
  "status",
  "owner",
  "goLive",
  "deadline",
  "blocker",
  "comment",
];

// Header metadata used by SortableColumnHead. Row cells are rendered
// inline inside SortableItRow (they capture row-scoped callbacks).
// Widths live in IT_COL_DEFAULT_WIDTHS (drag-to-resize, table-fixed);
// headClassName carries only alignment, never width.
const IT_COL_META: Record<ItColKey, { label: string; headClassName?: string }> =
  {
    rownum: { label: "#" },
    project: { label: "Project" },
    status: { label: "Status" },
    owner: { label: "Owner" },
    goLive: { label: "GoLive" },
    deadline: { label: "Deadline" },
    blocker: { label: "Blocker" },
    comment: { label: "Comment" },
  };

const IT_COL_WIDTH_STORAGE_KEY = "it-crm-col-width-v1";
const IT_COL_DEFAULT_WIDTHS: Record<ItColKey, number> = {
  rownum: 48,
  project: 280,
  status: 160,
  owner: 140,
  goLive: 120,
  deadline: 120,
  blocker: 140,
  comment: 240,
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Colour the per-task priority pill in the expanded breakdown. Unknown
// values fall back to a neutral grey.
function priorityVariant(priority: string): "red" | "amber" | "blue" | "grey" {
  switch (priority.toLowerCase()) {
    case "urgent":
    case "high":
    case "p0":
      return "red";
    case "medium":
    case "p1":
      return "amber";
    case "low":
    case "p2":
      return "blue";
    default:
      return "grey";
  }
}

export function ItCrmList() {
  const router = useRouter();
  const { user, hasAnyPermission } = useAuth();
  const canManageAny = hasAnyPermission(
    "it-crm:update",
    "it-crm:manage",
    "projects:update",
    "projects:manage",
  );
  // The org-wide reminder-recipients setting is manage-only on the backend —
  // gate its button/dialog on the same level so an update-only holder isn't
  // shown a control that would 403 on save.
  const canManageSettings = hasAnyPermission(
    "it-crm:manage",
    "projects:manage",
  );
  const canDeleteAny = hasAnyPermission(
    "it-crm:delete",
    "it-crm:manage",
    "projects:delete",
    "projects:manage",
  );

  const [projects, setProjects] = useState<ItProject[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Column order — initialised from localStorage on mount (client-only;
  // SSR pass uses the default). Any unknown keys are dropped and any
  // missing default keys are appended so the schema can evolve safely.
  const [colOrder, setColOrder] = useState<ItColKey[]>(IT_COL_DEFAULT_ORDER);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(IT_COL_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const filtered = parsed.filter((k): k is ItColKey =>
        IT_COL_DEFAULT_ORDER.includes(k as ItColKey),
      );
      const missing = IT_COL_DEFAULT_ORDER.filter((k) => !filtered.includes(k));
      setColOrder([...filtered, ...missing]);
    } catch {
      // ignore corrupt storage; keep default
    }
  }, []);
  const persistColOrder = useCallback((next: ItColKey[]) => {
    setColOrder(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(IT_COL_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota / disabled storage
      }
    }
  }, []);

  const { widths, setWidth } = useColumnWidths(
    IT_COL_WIDTH_STORAGE_KEY,
    IT_COL_DEFAULT_WIDTHS,
  );

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [statusFilter, setStatusFilter] = useState<string>("");
  // Active | Archived view. Archived is orthogonal to the status filter — it
  // shows projects that were archived regardless of their status.
  const [archived, setArchived] = useState(false);

  const pagination = usePagination();
  const { page, pageSize, setPage, setPageSize, setTotalCount, totalPages } =
    pagination;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ItProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ItProject | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Expandable rows — click the chevron to reveal tasks grouped by
  // the project's own status board columns (Notion-style nested rows).
  // Boards are lazy-fetched and cached per project id.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  type BoardState = ItProjectBoard | "loading" | "error";
  const [boards, setBoards] = useState<Record<string, BoardState>>({});
  const toggleExpand = useCallback(
    (projectId: string) => {
      const isOpen = expanded.has(projectId);
      setExpanded((prev) => {
        const next = new Set(prev);
        if (isOpen) {
          next.delete(projectId);
        } else {
          next.add(projectId);
        }
        return next;
      });
      if (isOpen) {
        // Collapse: drop the cached board so the next expand re-fetches.
        // Without this, a board edited in the meantime (the /projects
        // board writes the live project_tasks rows) would resurface its
        // pre-edit snapshot on re-expand.
        setBoards((prev) => {
          const next = { ...prev };
          delete next[projectId];
          return next;
        });
      } else {
        // Expand: always fetch fresh so the dropdown reflects the latest
        // board state.
        setBoards((prev) => ({ ...prev, [projectId]: "loading" }));
        void getItProjectBoard(projectId)
          .then((res) => setBoards((p) => ({ ...p, [projectId]: res.data })))
          .catch(() => setBoards((p) => ({ ...p, [projectId]: "error" })));
      }
    },
    [expanded],
  );

  // Drag-to-reorder is disabled while a filter / search is active so a
  // partial view can't corrupt the global ordering.
  const reorderEnabled = useMemo(
    () => !debouncedSearch.trim() && !statusFilter && !archived && !loading,
    [debouncedSearch, statusFilter, archived, loading],
  );
  const prePersistOrder = useRef<ItProject[] | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listItProjects({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        archived: archived || undefined,
      });
      setProjects(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load IT projects";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter, archived, setTotalCount]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, archived, setPage]);

  // Owner picker — lean list via `/directory/assignable` (auth-only).
  useEffect(() => {
    listAssignableUsers({ limit: 500 })
      .then((res) => setUsers(res.data))
      .catch(() => {
        // Picker stays empty; form still saves with current user as owner.
      });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Column reorder (header drag). Column keys are short strings —
    // distinct from project UUIDs — so we route on the active id.
    if (IT_COL_DEFAULT_ORDER.includes(active.id as ItColKey)) {
      const fromIdx = colOrder.indexOf(active.id as ItColKey);
      const toIdx = colOrder.indexOf(over.id as ItColKey);
      if (fromIdx < 0 || toIdx < 0) return;
      persistColOrder(arrayMove(colOrder, fromIdx, toIdx));
      return;
    }

    const oldIndex = projects.findIndex((p) => p.id === active.id);
    const newIndex = projects.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    prePersistOrder.current = projects;
    const next = arrayMove(projects, oldIndex, newIndex);
    setProjects(next);

    try {
      await reorderItProjects(next.map((p) => p.id));
    } catch (err) {
      if (prePersistOrder.current) setProjects(prePersistOrder.current);
      const msg =
        err instanceof ApiError ? err.message : "Failed to reorder IT projects";
      toast.error(msg);
    } finally {
      prePersistOrder.current = null;
    }
  }

  const handleCreate = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((p: ItProject) => {
    setEditing(p);
    setFormOpen(true);
  }, []);

  const handleSaved = useCallback(
    (saved: ItProject) => {
      if (editing) {
        setProjects((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      } else if (!archived) {
        // A newly created project is active — it belongs to the Active view
        // only. On the Archived tab, skip the optimistic insert + count bump.
        setTotalCount((c) => c + 1);
        if (page === 1) {
          setProjects((prev) => {
            const next = [saved, ...prev];
            return next.length > pageSize ? next.slice(0, pageSize) : next;
          });
        }
      }
    },
    [editing, archived, page, pageSize, setTotalCount],
  );

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setExporting(true);
      try {
        const res = await listItProjects({
          page: 1,
          limit: 500,
          search: debouncedSearch.trim() || undefined,
          status: statusFilter || undefined,
          archived: archived || undefined,
        });
        if (res.data.length === 0) {
          toast.error("Nothing to export");
          return;
        }
        exportRows(
          "it-crm",
          [
            { header: "Project", value: (r: ItProject) => r.name },
            { header: "Status", value: (r: ItProject) => r.status },
            { header: "Owner", value: (r: ItProject) => r.owner?.name ?? "" },
            { header: "GoLive", value: (r: ItProject) => r.goLiveDate ?? "" },
            {
              header: "Deadline",
              value: (r: ItProject) => r.revisedGoLiveDate ?? "",
            },
            { header: "Blocker", value: (r: ItProject) => r.dependency ?? "" },
            {
              header: "Comment",
              value: (r: ItProject) => stripHtmlToText(r.comment),
            },
          ],
          res.data,
          format,
        );
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Failed to export";
        toast.error(msg);
      } finally {
        setExporting(false);
      }
    },
    [debouncedSearch, statusFilter, archived],
  );

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteItProject(deleteTarget.id);
      toast.success("IT project deleted");
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setTotalCount((c) => Math.max(0, c - 1));
      setDeleteTarget(null);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to delete project";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  // Archive / restore. The current view (active vs archived) is the opposite
  // of the row's new state, so the row leaves the current list either way —
  // drop it optimistically and adjust the total.
  // Drop any cached expand/board state for a row leaving the current view, so
  // a stale snapshot can't resurface when it reappears under the other tab.
  const dropRowState = useCallback((id: string) => {
    setExpanded((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setBoards((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleArchive = useCallback(
    async (p: ItProject) => {
      try {
        await archiveItProject(p.id);
        setProjects((prev) => prev.filter((x) => x.id !== p.id));
        setTotalCount((c) => Math.max(0, c - 1));
        dropRowState(p.id);
        toast.success("Project archived");
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Failed to archive project",
        );
      }
    },
    [dropRowState, setTotalCount],
  );

  const handleUnarchive = useCallback(
    async (p: ItProject) => {
      try {
        await unarchiveItProject(p.id);
        setProjects((prev) => prev.filter((x) => x.id !== p.id));
        setTotalCount((c) => Math.max(0, c - 1));
        dropRowState(p.id);
        toast.success("Project restored");
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Failed to restore project",
        );
      }
    },
    [dropRowState, setTotalCount],
  );

  const skeletonRows = useMemo(
    () => Array.from({ length: 6 }, (_, i) => i),
    [],
  );

  return (
    <div>
      <PageHeader title="IT CRM" subtitle="Every project owned by the IT team">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting}>
                <Download className="size-3.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void handleExport("csv")}>
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExport("xlsx")}>
                Excel (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canManageSettings ? (
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
            permission="it-crm:create"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="size-3.5" />
            Import
          </PermissionButton>
          <PermissionButton
            variant="accent"
            permission="it-crm:create"
            onClick={handleCreate}
          >
            <Plus className="size-3.5" />
            New project
          </PermissionButton>
        </div>
      </PageHeader>

      <ItWorkspaceTabs />

      {/*
        Active | Archived filters THIS surface; it is not a peer of the
        workspace tabs above, so the two strips stay separate.
      */}
      <Tabs
        tabs={[
          { id: "active", label: "Active" },
          { id: "archived", label: "Archived" },
        ]}
        active={archived ? "archived" : "active"}
        onChange={(v) => setArchived(v === "archived")}
        variant="line"
      />

      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search
            className={`
              text-muted-foreground absolute top-1/2 left-2.5 size-3.5
              -translate-y-1/2
            `}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search IT projects..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}
        >
          <SelectTrigger className="h-10 w-[180px] text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!reorderEnabled &&
      (debouncedSearch.trim() || statusFilter || archived) ? (
        <p className="text-muted-foreground mb-2 text-[11px]">
          {archived
            ? "Drag-to-reorder is disabled in the Archived view."
            : "Drag-to-reorder is disabled while a filter or search is active."}
        </p>
      ) : null}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <Table
          // table-fixed makes per-column widths authoritative for
          // drag-to-resize (Notion-style).
          className="table-fixed"
          containerClassName={`
            max-h-[60svh] md:max-h-[calc(100vh-280px)] overflow-auto rounded-lg border
          `}
        >
          <TableHeader className="bg-background sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-[36px]" />
              <SortableContext
                items={colOrder}
                strategy={horizontalListSortingStrategy}
              >
                {colOrder.map((key) => {
                  const meta = IT_COL_META[key];
                  return (
                    <SortableColumnHead
                      key={key}
                      colKey={key}
                      label={meta.label}
                      className={meta.headClassName}
                      width={widths[key]}
                      onResize={(k, w) => setWidth(k as ItColKey, w)}
                    />
                  );
                })}
              </SortableContext>
              {/* Auto-width spacer absorbs leftover table width. */}
              <TableHead />
              <TableHead className="w-[40px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              skeletonRows.map((i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell colSpan={11}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="text-muted-foreground py-10 text-center text-xs"
                >
                  No IT projects found
                </TableCell>
              </TableRow>
            ) : (
              <SortableContext
                items={projects.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {projects.flatMap((p, index) => {
                  const isOpen = expanded.has(p.id);
                  const board = boards[p.id];
                  const totalCols = colOrder.length + 3; // drag + cols + spacer + kebab
                  const rows: React.ReactNode[] = [
                    <SortableItRow
                      key={p.id}
                      project={p}
                      index={(page - 1) * pageSize + index + 1}
                      colOrder={colOrder}
                      expanded={isOpen}
                      onToggleExpand={() => toggleExpand(p.id)}
                      canDrag={reorderEnabled}
                      canManageRow={p.ownerId === user?.id || canManageAny}
                      canDelete={canDeleteAny}
                      isArchivedView={archived}
                      onView={() =>
                        router.push(`/projects/${p.id}?from=it-crm`)
                      }
                      onEdit={() => handleEdit(p)}
                      onArchive={() => void handleArchive(p)}
                      onUnarchive={() => void handleUnarchive(p)}
                      onDelete={() => setDeleteTarget(p)}
                    />,
                  ];
                  if (isOpen) {
                    rows.push(
                      <ExpandedTaskRows
                        key={`${p.id}-tasks`}
                        projectId={p.id}
                        colSpan={totalCols}
                        board={board}
                        colOrder={colOrder}
                        onViewTask={(taskId) =>
                          router.push(
                            `/projects/${p.id}?task=${taskId}&from=it-crm`,
                          )
                        }
                      />,
                    );
                  }
                  return rows;
                })}
              </SortableContext>
            )}
          </TableBody>
        </Table>
      </DndContext>

      <div className="mt-3">
        <DataPagination
          page={page}
          pageSize={pageSize}
          totalCount={pagination.totalCount}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      <ItCrmFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        users={users}
        project={editing}
        onSaved={handleSaved}
      />

      {canManageSettings ? (
        <ItCrmReminderSettingsDialog
          open={reminderOpen}
          onOpenChange={setReminderOpen}
        />
      ) : null}

      <CrmImportDialog<CreateItProjectInput>
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void fetchProjects()}
        title="Import IT projects"
        entityLabel="projects"
        templateName="it-crm-import-template"
        fields={[
          {
            key: "name",
            headers: ["Project", "Name"],
            type: "string",
            required: true,
          },
          { key: "status", headers: ["Status"], type: "string" },
          {
            key: "dependency",
            headers: ["Blocker", "Dependency"],
            type: "string",
          },
          { key: "comment", headers: ["Comment"], type: "string" },
        ]}
        submit={async (rows) => {
          const res = await importItProjects(rows);
          return res.data;
        }}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete IT project?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting <span className="font-medium">{deleteTarget?.name}</span>{" "}
              removes its tasks, comments, columns, and member assignments. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableItRow({
  project,
  index,
  colOrder,
  expanded,
  onToggleExpand,
  canDrag,
  canManageRow,
  canDelete,
  isArchivedView,
  onView,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  project: ItProject;
  index: number;
  colOrder: ItColKey[];
  expanded: boolean;
  onToggleExpand: () => void;
  canDrag: boolean;
  canManageRow: boolean;
  canDelete: boolean;
  isArchivedView: boolean;
  onView: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
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
      className={isDragging ? "bg-muted/40" : "hover:bg-muted/40"}
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
      {colOrder.map((key) => {
        switch (key) {
          case "rownum":
            return (
              <TableCell key={key} className="text-muted-foreground text-xs">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onToggleExpand}
                    aria-label={expanded ? "Collapse tasks" : "Expand tasks"}
                    className={`
                      hover:bg-muted hover:text-foreground
                      inline-flex size-4 items-center justify-center rounded
                      transition-colors
                    `}
                  >
                    {expanded ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                  </button>
                  <span>{index}</span>
                </div>
              </TableCell>
            );
          case "project":
            return (
              <TableCell key={key}>
                <button
                  type="button"
                  onClick={onView}
                  className={`
                    truncate text-left text-xs font-medium
                    hover:underline
                  `}
                >
                  {project.name}
                </button>
                {project.description ? (
                  <ExpandableText
                    text={stripHtmlToText(project.description)}
                    max={200}
                  />
                ) : null}
              </TableCell>
            );
          case "status":
            return (
              <TableCell key={key}>
                <Badge variant={STATUS_VARIANTS[project.status] ?? "grey"}>
                  {STATUS_LABELS[project.status] ?? project.status}
                </Badge>
              </TableCell>
            );
          case "owner":
            return (
              <TableCell key={key} className="text-xs">
                {project.owner?.name ?? "—"}
              </TableCell>
            );
          case "goLive":
            return (
              <TableCell key={key} className="text-xs">
                {formatDate(project.goLiveDate)}
              </TableCell>
            );
          case "deadline":
            return (
              <TableCell key={key} className="text-xs">
                {formatDate(project.revisedGoLiveDate)}
              </TableCell>
            );
          case "blocker":
            return (
              <TableCell key={key} className="text-xs">
                {project.dependency ?? "—"}
              </TableCell>
            );
          case "comment":
            return (
              <TableCell
                key={key}
                className={`text-muted-foreground line-clamp-2 text-[11px]`}
                title={
                  project.comment ? stripHtmlToText(project.comment) : undefined
                }
              >
                {project.comment ? stripHtmlToText(project.comment) : "—"}
              </TableCell>
            );
          default:
            return null;
        }
      })}
      <TableCell />
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7">
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onView}>
              <Eye className="size-3.5" />
              View
            </DropdownMenuItem>
            {canManageRow ? (
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="size-3.5" />
                Edit
              </DropdownMenuItem>
            ) : null}
            {canManageRow ? (
              isArchivedView ? (
                <DropdownMenuItem onClick={onUnarchive}>
                  <ArchiveRestore className="size-3.5" />
                  Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onArchive}>
                  <Archive className="size-3.5" />
                  Archive
                </DropdownMenuItem>
              )
            ) : null}
            {canDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 className="size-3.5" />
                  Delete
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// Renders the nested-tasks block for one expanded project row.
// Lazy-loaded board state is passed in from the parent; "loading"
// and "error" sentinels keep the markup local. Tasks are bucketed by
// the project's own status board columns so the grouping always
// matches what the user sees in the project workspace.
function ExpandedTaskRows({
  projectId,
  colSpan,
  board,
  colOrder,
  onViewTask,
}: {
  projectId: string;
  colSpan: number;
  board: ItProjectBoard | "loading" | "error" | undefined;
  colOrder: ItColKey[];
  onViewTask: (taskId: string) => void;
}) {
  // Which parent tasks are expanded to reveal their subtasks. Hooks
  // must precede the early returns below (rules of hooks).
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const toggleTask = (id: string) =>
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (board === undefined || board === "loading") {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="bg-muted/20 py-3">
          <div className="text-muted-foreground pl-12 text-[11px]">
            Loading tasks…
          </div>
        </TableCell>
      </TableRow>
    );
  }
  if (board === "error") {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="bg-muted/20 py-3">
          <div className="text-destructive pl-12 text-[11px]">
            Failed to load tasks.
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (board.tasks.length === 0) {
    return (
      <TableRow key={`${projectId}-empty`}>
        <TableCell colSpan={colSpan} className="bg-muted/20 py-3">
          <div className="text-muted-foreground pl-12 text-[11px]">
            No tasks yet.
          </div>
        </TableCell>
      </TableRow>
    );
  }

  const colLabel = new Map(board.columns.map((c) => [c.key, c.label]));
  const orderedCols = [...board.columns].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const colIndex = new Map(orderedCols.map((c, i) => [c.key, i] as const));

  // Split tasks into a parent → children tree. Top-level tasks
  // (no parent, or a parent outside this board) render by default;
  // subtasks stay hidden until their parent's chevron is expanded.
  const childrenByParent = new Map<string, ItProjectTask[]>();
  const ids = new Set(board.tasks.map((t) => t.id));
  const roots: ItProjectTask[] = [];
  for (const t of board.tasks) {
    if (t.parentTaskId && ids.has(t.parentTaskId)) {
      const arr = childrenByParent.get(t.parentTaskId) ?? [];
      arr.push(t);
      childrenByParent.set(t.parentTaskId, arr);
    } else {
      roots.push(t);
    }
  }
  const sortTasks = (arr: ItProjectTask[]) =>
    [...arr].sort((a, b) => {
      const byCol =
        (colIndex.get(a.status) ?? 99) - (colIndex.get(b.status) ?? 99);
      return byCol !== 0 ? byCol : a.sortOrder - b.sortOrder;
    });

  const renderCell = (key: ItColKey, task: ItProjectTask) => {
    switch (key) {
      case "status":
        return (
          <TableCell key={key} className="bg-muted/15">
            <Badge variant="grey">
              {colLabel.get(task.status) ?? task.status}
            </Badge>
          </TableCell>
        );
      case "owner":
        return (
          <TableCell key={key} className="bg-muted/15 text-xs">
            {task.owner?.name ?? "—"}
          </TableCell>
        );
      case "deadline":
        return (
          <TableCell key={key} className="bg-muted/15 text-xs">
            {task.endDate ? formatDate(task.endDate) : "—"}
          </TableCell>
        );
      case "comment":
        return (
          <TableCell key={key} className="bg-muted/15 align-top">
            {task.description ? (
              <span
                className={`
                  text-muted-foreground line-clamp-2 block text-[11px]
                `}
                title={stripHtmlToText(task.description)}
              >
                {stripHtmlToText(task.description)}
              </span>
            ) : (
              <span className="text-muted-foreground text-[11px]">—</span>
            )}
          </TableCell>
        );
      // rownum + goLive / blocker have no per-task equivalent. (The
      // `project` column is rendered separately so it can carry the
      // depth indent + expand chevron.)
      default:
        return <TableCell key={key} className="bg-muted/15" />;
    }
  };

  const renderProjectCell = (
    task: ItProjectTask,
    depth: number,
    hasChildren: boolean,
    isOpen: boolean,
  ) => (
    <TableCell key="project" className="bg-muted/15">
      <div
        className="flex items-center gap-1.5"
        style={{ paddingLeft: 12 + depth * 16 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggleTask(task.id)}
            aria-label={isOpen ? "Collapse subtasks" : "Expand subtasks"}
            className={`
              text-muted-foreground inline-flex size-4 shrink-0 items-center
              justify-center rounded
              hover:text-foreground
            `}
          >
            {isOpen ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
          </button>
        ) : (
          <span className="inline-block size-4 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onViewTask(task.id)}
          className={`
            truncate text-left text-xs font-medium
            hover:underline
          `}
        >
          {task.title}
        </button>
        <Badge variant={priorityVariant(task.priority)} className="shrink-0">
          {task.priority}
        </Badge>
      </div>
    </TableCell>
  );

  const rows: ReactNode[] = [];
  const pushRows = (task: ItProjectTask, depth: number) => {
    const children = sortTasks(childrenByParent.get(task.id) ?? []);
    const hasChildren = children.length > 0;
    const isOpen = expandedTasks.has(task.id);
    rows.push(
      <TableRow
        key={task.id}
        className={`
          hover:bg-muted/30
          align-top
        `}
      >
        <TableCell className="bg-muted/15" />
        {colOrder.map((key) =>
          key === "project"
            ? renderProjectCell(task, depth, hasChildren, isOpen)
            : renderCell(key, task),
        )}
        <TableCell className="bg-muted/15" />
        <TableCell className="bg-muted/15" />
      </TableRow>,
    );
    if (hasChildren && isOpen) {
      children.forEach((child) => pushRows(child, depth + 1));
    }
  };
  sortTasks(roots).forEach((root) => pushRows(root, 0));

  return <>{rows}</>;
}
