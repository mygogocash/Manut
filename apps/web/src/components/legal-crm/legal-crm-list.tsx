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
  Download,
  Edit,
  Eye,
  GripVertical,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter } from "nextjs-toploader/app";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { LegalCrmBoard } from "@/components/legal-crm/legal-crm-board";
import { LegalCrmFormDialog } from "@/components/legal-crm/legal-crm-form-dialog";
import {
  LEGAL_PRIORITY_LABELS,
  LEGAL_PRIORITY_VARIANTS,
  normalizeLegalPriority,
} from "@/components/legal-crm/legal-priority";
import {
  normalizeLegalStatus,
  STATUS_LABELS,
  STATUS_OPTIONS,
  STATUS_VARIANTS,
} from "@/components/legal-crm/legal-status";
import { Badge } from "@/components/shared/badge";
import { CrmImportDialog } from "@/components/shared/crm-import-dialog";
import { CrmReminderSettingsDialog } from "@/components/shared/crm-reminder-settings-dialog";
import { DataPagination } from "@/components/shared/data-pagination";
import { ExpandableText } from "@/components/shared/expandable-text";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionButton } from "@/components/shared/permission-button";
import { SortableColumnHead } from "@/components/shared/sortable-column-head";
import { Tabs } from "@/components/shared/tabs";
import { useColumnOrder } from "@/components/shared/use-column-order";
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
import { useAuth } from "@/providers/auth-provider";
import {
  getCrmReminderSettings,
  updateCrmReminderSettings,
} from "@/services/crm-reminder-settings.service";
import {
  type AssignableUser,
  listAssignableUsers,
} from "@/services/directory.service";
import {
  archiveLegalProject,
  type CreateLegalProjectInput,
  deleteLegalProject,
  importLegalProjects,
  type LegalProject,
  listLegalProjects,
  reorderLegalProjects,
  unarchiveLegalProject,
} from "@/services/legal-crm.service";

// One row of the Legal-checklist xlsx import. Carries the spreadsheet's
// flat 7-column shape (Workstream | Legal Task | Owner | Date |
// Assignee | Description | Status) — the submit handler transforms
// it into a `CreateLegalProjectInput` per row.
type LegalImportRow = {
  workstream?: string;
  name?: string; // "Legal Task" cell — often blank in real data
  owner?: string;
  date?: string;
  dependency?: string;
  description?: string;
  status?: string;
  priority?: string;
};

// Source xlsx ships dates in several human formats — try them in
// order and skip anything we can't pin to a real day so a row with
// "TBD" still imports (just without a date).
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

// Reorderable column registry (drag handle + kebab stay fixed at the
// edges; everything between is user-rearrangeable and persisted to
// localStorage). Bump the storage key's version suffix if the default
// set changes in a way that should reset saved orders.
type LegColKey =
  | "rownum"
  | "workstream"
  | "name"
  | "owner"
  | "date"
  | "dependency"
  | "description"
  | "priority"
  | "status";

const LEG_COL_STORAGE_KEY = "legal-crm-col-order-v2";

const LEG_COL_DEFAULT_ORDER: readonly LegColKey[] = [
  "rownum",
  "workstream",
  "name",
  "owner",
  "date",
  "dependency",
  "description",
  "priority",
  "status",
];

// Widths live in LEG_COL_DEFAULT_WIDTHS (drag-to-resize, table-fixed);
// headClassName carries only alignment, never width.
const LEG_COL_META: Record<
  LegColKey,
  { label: string; headClassName?: string }
> = {
  rownum: { label: "#" },
  workstream: { label: "Workstream" },
  name: { label: "Legal Task" },
  owner: { label: "Owner" },
  date: { label: "Date" },
  dependency: { label: "Assignee" },
  description: { label: "Description" },
  priority: { label: "Priority" },
  status: { label: "Status" },
};

const LEG_COL_WIDTH_STORAGE_KEY = "legal-crm-col-width-v1";
const LEG_COL_DEFAULT_WIDTHS: Record<LegColKey, number> = {
  rownum: 48,
  workstream: 220,
  name: 280,
  owner: 160,
  date: 120,
  dependency: 160,
  description: 240,
  priority: 120,
  status: 160,
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

export function LegalCrmList() {
  const router = useRouter();
  const { user, hasAnyPermission } = useAuth();
  const canManageAny = hasAnyPermission(
    "legal-crm:update",
    "legal-crm:manage",
    "projects:update",
    "projects:manage",
  );
  const canDeleteAny = hasAnyPermission(
    "legal-crm:delete",
    "legal-crm:manage",
    "projects:delete",
    "projects:manage",
  );
  // The org-wide reminder-recipients setting is manage-only on the backend —
  // gate its button/dialog on the same level so an update-only holder isn't
  // shown a control that would 403 on save.
  const canManageSettings = hasAnyPermission(
    "legal-crm:manage",
    "projects:manage",
  );

  const [projects, setProjects] = useState<LegalProject[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [editing, setEditing] = useState<LegalProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LegalProject | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  // List (table) vs Board (kanban grouped by status). The board fetches
  // its own snapshot; `boardRefreshKey` bumps after a save/delete so it
  // reloads in step with the table.
  const [view, setView] = useState<"list" | "board">("list");
  const [boardRefreshKey, setBoardRefreshKey] = useState(0);

  // Stable load/save fns for the shared reminder-settings dialog —
  // it keys its load-on-open effect on `load`.
  const loadReminderSettings = useCallback(
    async () => (await getCrmReminderSettings("legal")).data,
    [],
  );
  const saveReminderSettings = useCallback(
    async (recipients: string[]) =>
      (await updateCrmReminderSettings("legal", recipients)).data,
    [],
  );

  const { colOrder, isColumnId, reorderColumns } = useColumnOrder(
    LEG_COL_STORAGE_KEY,
    LEG_COL_DEFAULT_ORDER,
  );
  const { widths, setWidth } = useColumnWidths(
    LEG_COL_WIDTH_STORAGE_KEY,
    LEG_COL_DEFAULT_WIDTHS,
  );

  // Drag-to-reorder is disabled while a filter / search is active so a
  // partial view can't corrupt the global ordering.
  const reorderEnabled = useMemo(
    () => !debouncedSearch.trim() && !statusFilter && !archived && !loading,
    [debouncedSearch, statusFilter, archived, loading],
  );
  const prePersistOrder = useRef<LegalProject[] | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listLegalProjects({
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
        err instanceof ApiError ? err.message : "Failed to load Legal Tasks";
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
      await reorderLegalProjects(next.map((p) => p.id));
    } catch (err) {
      if (prePersistOrder.current) setProjects(prePersistOrder.current);
      const msg =
        err instanceof ApiError ? err.message : "Failed to reorder Legal Tasks";
      toast.error(msg);
    } finally {
      prePersistOrder.current = null;
    }
  }

  const handleCreate = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((p: LegalProject) => {
    setEditing(p);
    setFormOpen(true);
  }, []);

  // Open the workstream's Kanban board. Legal projects are mirrored into
  // the shared `projects` table (team='legal') by the legal-crm native
  // workspace migration, so the shared /projects board renders the board
  // + the AI Generate breakdown for them — same flow as IT CRM.
  const openBoard = useCallback(
    (p: LegalProject) => {
      router.push(`/projects/${p.id}?from=legal-crm`);
    },
    [router],
  );

  const handleSaved = useCallback(
    (saved: LegalProject) => {
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
      // Keep the board's own snapshot in sync after a create/edit.
      setBoardRefreshKey((k) => k + 1);
    },
    [editing, archived, page, pageSize, setTotalCount],
  );

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setExporting(true);
      try {
        const res = await listLegalProjects({
          page: 1,
          limit: 500,
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
          archived: archived || undefined,
        });
        if (res.data.length === 0) {
          toast.error("Nothing to export");
          return;
        }
        exportRows(
          "legal-crm",
          [
            {
              header: "Workstream",
              value: (r: LegalProject) => r.workstream ?? "",
            },
            { header: "Legal Task", value: (r: LegalProject) => r.name },
            {
              header: "Owner",
              value: (r: LegalProject) => r.owner?.name ?? "",
            },
            { header: "Date", value: (r: LegalProject) => r.goLiveDate ?? "" },
            {
              header: "Assignee",
              value: (r: LegalProject) => r.dependency ?? "",
            },
            {
              header: "Description",
              value: (r: LegalProject) => r.description ?? "",
            },
            {
              header: "Priority",
              value: (r: LegalProject) =>
                LEGAL_PRIORITY_LABELS[r.priority] ?? r.priority,
            },
            { header: "Status", value: (r: LegalProject) => r.status },
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
      await deleteLegalProject(deleteTarget.id);
      toast.success("Legal Task deleted");
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setTotalCount((c) => Math.max(0, c - 1));
      setBoardRefreshKey((k) => k + 1);
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
  // drop it optimistically and adjust the total. Bump the board snapshot too
  // so the Board view (active-only fetch) stays in step, same as delete.
  const handleArchive = useCallback(
    async (p: LegalProject) => {
      try {
        await archiveLegalProject(p.id);
        setProjects((prev) => prev.filter((x) => x.id !== p.id));
        setTotalCount((c) => Math.max(0, c - 1));
        setBoardRefreshKey((k) => k + 1);
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
    async (p: LegalProject) => {
      try {
        await unarchiveLegalProject(p.id);
        setProjects((prev) => prev.filter((x) => x.id !== p.id));
        setTotalCount((c) => Math.max(0, c - 1));
        setBoardRefreshKey((k) => k + 1);
        toast.success("Project restored");
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Failed to restore project",
        );
      }
    },
    [setTotalCount],
  );

  const skeletonRows = useMemo(
    () => Array.from({ length: 6 }, (_, i) => i),
    [],
  );

  return (
    <div>
      <PageHeader
        title="Legal CRM"
        subtitle="Every project owned by the Legal team"
      >
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
            permission="legal-crm:create"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="size-3.5" />
            Import
          </PermissionButton>
          <PermissionButton
            variant="accent"
            permission="legal-crm:create"
            onClick={handleCreate}
          >
            <Plus className="size-3.5" />
            New workstream
          </PermissionButton>
        </div>
      </PageHeader>

      <div className="mb-4 flex items-center gap-1">
        <Button
          variant={view === "list" ? "accent" : "outline"}
          size="sm"
          onClick={() => setView("list")}
        >
          <List className="size-3.5" />
          List
        </Button>
        <Button
          variant={view === "board" ? "accent" : "outline"}
          size="sm"
          onClick={() => setView("board")}
        >
          <LayoutGrid className="size-3.5" />
          Board
        </Button>
      </div>

      {view === "board" ? (
        <LegalCrmBoard
          refreshKey={boardRefreshKey}
          onEdit={openBoard}
          onCreate={handleCreate}
        />
      ) : (
        <>
          <Tabs
            tabs={[
              { id: "active", label: "Active" },
              { id: "archived", label: "Archived" },
            ]}
            active={archived ? "archived" : "active"}
            onChange={(v) => setArchived(v === "archived")}
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
                placeholder="Search Legal Tasks..."
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
                    {colOrder.map((key) => (
                      <SortableColumnHead
                        key={key}
                        colKey={key}
                        label={LEG_COL_META[key].label}
                        className={LEG_COL_META[key].headClassName}
                        width={widths[key]}
                        onResize={(k, w) => setWidth(k as LegColKey, w)}
                      />
                    ))}
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
                      <TableCell colSpan={colOrder.length + 3}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : projects.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={colOrder.length + 3}
                      className={`
                        text-muted-foreground py-10 text-center text-xs
                      `}
                    >
                      No Legal Tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  <SortableContext
                    items={projects.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {projects.map((p, index) => (
                      <SortableItRow
                        key={p.id}
                        project={p}
                        index={(page - 1) * pageSize + index + 1}
                        colOrder={colOrder}
                        canDrag={reorderEnabled}
                        canManageRow={p.ownerId === user?.id || canManageAny}
                        canDelete={canDeleteAny}
                        isArchivedView={archived}
                        // Row click opens the workstream's Kanban board on
                        // the shared /projects page (legal projects are
                        // mirrored there as team='legal'); the kebab "Edit"
                        // still opens the field dialog.
                        onView={() => openBoard(p)}
                        onEdit={() => handleEdit(p)}
                        onArchive={() => void handleArchive(p)}
                        onUnarchive={() => void handleUnarchive(p)}
                        onDelete={() => setDeleteTarget(p)}
                      />
                    ))}
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
        </>
      )}

      <LegalCrmFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        users={users}
        project={editing}
        onSaved={handleSaved}
      />

      {canManageSettings ? (
        <CrmReminderSettingsDialog
          open={reminderOpen}
          onOpenChange={setReminderOpen}
          load={loadReminderSettings}
          save={saveReminderSettings}
        />
      ) : null}

      <CrmImportDialog<LegalImportRow>
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void fetchProjects()}
        title="Import Legal Tasks"
        entityLabel="tasks"
        templateName="legal-crm-import-template"
        fields={[
          // Workstream is the row identity in the team's source xlsx
          // — every real row has it, while the "Legal Task" cell is
          // often left blank. Marking it required (instead of name)
          // matches the real shape and stops the dialog rejecting
          // every row when Legal Task is empty.
          {
            key: "workstream",
            headers: ["Workstream"],
            type: "string",
            required: true,
          },
          { key: "name", headers: ["Legal Task", "Name"], type: "string" },
          { key: "owner", headers: ["Owner"], type: "string" },
          { key: "date", headers: ["Date", "Due Date"], type: "string" },
          {
            key: "dependency",
            headers: ["Assignee", "Dependency"],
            type: "string",
          },
          { key: "description", headers: ["Description"], type: "string" },
          { key: "priority", headers: ["Priority"], type: "string" },
          { key: "status", headers: ["Status"], type: "string" },
        ]}
        submit={async (rows) => {
          // Owner is intentionally not threaded through: the xlsx
          // ships free-text names ("Maysa/Kit") and the API takes an
          // ownerId. Rows import owner-less and get re-assigned via
          // the UI after import.
          const payload: CreateLegalProjectInput[] = rows.map((r) => {
            const workstream = r.workstream?.trim();
            const legalTask = r.name?.trim();
            return {
              name: legalTask || workstream || "Untitled",
              workstream: workstream || undefined,
              dependency: r.dependency?.trim() || undefined,
              description: r.description?.trim() || undefined,
              goLiveDate: parseLegalDate(r.date) ?? undefined,
              status: normalizeLegalStatus(r.status),
              priority: normalizeLegalPriority(r.priority),
            };
          });
          const res = await importLegalProjects(payload);
          return res.data;
        }}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Legal Task?</AlertDialogTitle>
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
  project: LegalProject;
  index: number;
  colOrder: LegColKey[];
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
                {index}
              </TableCell>
            );
          case "workstream":
            return (
              <TableCell key={key} className="overflow-hidden text-xs">
                {project.workstream ? (
                  <button
                    type="button"
                    onClick={onView}
                    title={project.workstream}
                    className={`
                      block w-full truncate text-left text-xs
                      hover:underline
                    `}
                  >
                    {project.workstream}
                  </button>
                ) : (
                  "—"
                )}
              </TableCell>
            );
          case "name":
            return (
              <TableCell key={key} className="overflow-hidden">
                <button
                  type="button"
                  onClick={onView}
                  title={project.name}
                  className={`
                    block w-full truncate text-left text-xs font-medium
                    hover:underline
                  `}
                >
                  {project.name}
                </button>
              </TableCell>
            );
          case "owner":
            return (
              <TableCell key={key} className="truncate text-xs">
                {project.owner?.name ?? "—"}
              </TableCell>
            );
          case "date":
            return (
              <TableCell key={key} className="truncate text-xs">
                {formatDate(project.goLiveDate)}
              </TableCell>
            );
          case "dependency":
            return (
              <TableCell key={key} className="truncate text-xs">
                {project.dependency ?? "—"}
              </TableCell>
            );
          case "description":
            return (
              <TableCell key={key} className="overflow-hidden text-xs">
                {project.description ? (
                  <ExpandableText text={project.description} max={200} />
                ) : (
                  "—"
                )}
              </TableCell>
            );
          case "priority": {
            const p = normalizeLegalPriority(project.priority);
            return (
              <TableCell key={key}>
                <Badge variant={LEGAL_PRIORITY_VARIANTS[p] ?? "grey"}>
                  {LEGAL_PRIORITY_LABELS[p] ?? p}
                </Badge>
              </TableCell>
            );
          }
          case "status":
            return (
              <TableCell key={key}>
                <Badge variant={STATUS_VARIANTS[project.status] ?? "grey"}>
                  {STATUS_LABELS[project.status] ?? project.status}
                </Badge>
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
