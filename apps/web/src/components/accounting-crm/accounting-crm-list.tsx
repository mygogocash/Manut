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

import { AccountingCrmBoard } from "@/components/accounting-crm/accounting-crm-board";
import { AccountingCrmFormDialog } from "@/components/accounting-crm/accounting-crm-form-dialog";
import {
  ACCOUNTING_PRIORITY_LABELS,
  ACCOUNTING_PRIORITY_VARIANTS,
  normalizeAccountingPriority,
} from "@/components/accounting-crm/accounting-priority";
import {
  normalizeAccountingStatus,
  STATUS_LABELS,
  STATUS_OPTIONS,
  STATUS_VARIANTS,
} from "@/components/accounting-crm/accounting-status";
import { Badge } from "@/components/shared/badge";
import { CrmImportDialog } from "@/components/shared/crm-import-dialog";
import { DataPagination } from "@/components/shared/data-pagination";
import { ExpandableText } from "@/components/shared/expandable-text";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionButton } from "@/components/shared/permission-button";
import { SortableColumnHead } from "@/components/shared/sortable-column-head";
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
  type AccountingProject,
  type CreateAccountingProjectInput,
  deleteAccountingProject,
  importAccountingProjects,
  listAccountingProjects,
  reorderAccountingProjects,
} from "@/services/accounting-crm.service";
import {
  type AssignableUser,
  listAssignableUsers,
} from "@/services/directory.service";

// One row of the Accounting-checklist xlsx import. Carries the spreadsheet's
// flat 7-column shape (Workstream | Accounting Task | Owner | Date |
// Dependency | Description | Status) — the submit handler transforms
// it into a `CreateAccountingProjectInput` per row.
type AccountingImportRow = {
  workstream?: string;
  name?: string; // "Accounting Task" cell — optional in imported rows
  owner?: string;
  date?: string;
  dependency?: string;
  description?: string;
  status?: string;
  priority?: string;
};

// Imports can contain dates in several human formats — try them in
// order and skip anything we can't pin to a real day so a row with
// "TBD" still imports (just without a date).
function parseAccountingDate(raw: string | null | undefined): string | null {
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
type AcctColKey =
  | "rownum"
  | "workstream"
  | "name"
  | "owner"
  | "date"
  | "dependency"
  | "description"
  | "priority"
  | "status";

const ACCT_COL_STORAGE_KEY = "accounting-crm-col-order-v2";

const ACCT_COL_DEFAULT_ORDER: readonly AcctColKey[] = [
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

// Widths live in ACCT_COL_DEFAULT_WIDTHS (drag-to-resize, table-fixed);
// headClassName carries only alignment, never width.
const ACCT_COL_META: Record<
  AcctColKey,
  { label: string; headClassName?: string }
> = {
  rownum: { label: "#" },
  workstream: { label: "Workstream" },
  name: { label: "Accounting Task" },
  owner: { label: "Owner" },
  date: { label: "Date" },
  dependency: { label: "Dependency" },
  description: { label: "Description" },
  priority: { label: "Priority" },
  status: { label: "Status" },
};

const ACCT_COL_WIDTH_STORAGE_KEY = "accounting-crm-col-width-v1";
const ACCT_COL_DEFAULT_WIDTHS: Record<AcctColKey, number> = {
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

export function AccountingCrmList() {
  const router = useRouter();
  const { user, hasAnyPermission } = useAuth();
  const canManageAny = hasAnyPermission(
    "accounting-crm:update",
    "accounting-crm:manage",
    "projects:update",
    "projects:manage",
  );
  const canDeleteAny = hasAnyPermission(
    "accounting-crm:delete",
    "accounting-crm:manage",
    "projects:delete",
    "projects:manage",
  );

  const [projects, setProjects] = useState<AccountingProject[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const pagination = usePagination();
  const { page, pageSize, setPage, setPageSize, setTotalCount, totalPages } =
    pagination;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountingProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountingProject | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  // List (table) vs Board (kanban grouped by status). The board fetches
  // its own snapshot; `boardRefreshKey` bumps after a save/delete so it
  // reloads in step with the table.
  const [view, setView] = useState<"list" | "board">("list");
  const [boardRefreshKey, setBoardRefreshKey] = useState(0);

  const { colOrder, isColumnId, reorderColumns } = useColumnOrder(
    ACCT_COL_STORAGE_KEY,
    ACCT_COL_DEFAULT_ORDER,
  );
  const { widths, setWidth } = useColumnWidths(
    ACCT_COL_WIDTH_STORAGE_KEY,
    ACCT_COL_DEFAULT_WIDTHS,
  );

  // Drag-to-reorder is disabled while a filter / search is active so a
  // partial view can't corrupt the global ordering.
  const reorderEnabled = useMemo(
    () => !debouncedSearch.trim() && !statusFilter && !loading,
    [debouncedSearch, statusFilter, loading],
  );
  const prePersistOrder = useRef<AccountingProject[] | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listAccountingProjects({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
      });
      setProjects(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to load Accounting Tasks";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter, setTotalCount]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, setPage]);

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
      await reorderAccountingProjects(next.map((p) => p.id));
    } catch (err) {
      if (prePersistOrder.current) setProjects(prePersistOrder.current);
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to reorder Accounting Tasks";
      toast.error(msg);
    } finally {
      prePersistOrder.current = null;
    }
  }

  const handleCreate = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((p: AccountingProject) => {
    setEditing(p);
    setFormOpen(true);
  }, []);

  // Open the workstream's Kanban board. Accounting projects are mirrored into
  // the shared `projects` table (team='accounting') by the accounting-crm native
  // workspace migration, so the shared /projects board renders the board
  // + the AI Generate breakdown for them — same flow as IT CRM.
  const openBoard = useCallback(
    (p: AccountingProject) => {
      router.push(`/projects/${p.id}?from=accounting-crm`);
    },
    [router],
  );

  const handleSaved = useCallback(
    (saved: AccountingProject) => {
      if (editing) {
        setProjects((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      } else {
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
    [editing, page, pageSize, setTotalCount],
  );

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setExporting(true);
      try {
        const res = await listAccountingProjects({
          page: 1,
          limit: 500,
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
        });
        if (res.data.length === 0) {
          toast.error("Nothing to export");
          return;
        }
        exportRows(
          "accounting-crm",
          [
            {
              header: "Workstream",
              value: (r: AccountingProject) => r.workstream ?? "",
            },
            {
              header: "Accounting Task",
              value: (r: AccountingProject) => r.name,
            },
            {
              header: "Owner",
              value: (r: AccountingProject) => r.owner?.name ?? "",
            },
            {
              header: "Date",
              value: (r: AccountingProject) => r.goLiveDate ?? "",
            },
            {
              header: "Dependency",
              value: (r: AccountingProject) => r.dependency ?? "",
            },
            {
              header: "Description",
              value: (r: AccountingProject) => r.description ?? "",
            },
            {
              header: "Priority",
              value: (r: AccountingProject) =>
                ACCOUNTING_PRIORITY_LABELS[r.priority] ?? r.priority,
            },
            { header: "Status", value: (r: AccountingProject) => r.status },
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
    [debouncedSearch, statusFilter],
  );

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAccountingProject(deleteTarget.id);
      toast.success("Accounting Task deleted");
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

  const skeletonRows = useMemo(
    () => Array.from({ length: 6 }, (_, i) => i),
    [],
  );

  return (
    <div>
      <PageHeader
        title="Accounting CRM"
        subtitle="Every project owned by the Accounting team"
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
          <PermissionButton
            variant="outline"
            permission="accounting-crm:create"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="size-3.5" />
            Import
          </PermissionButton>
          <PermissionButton
            variant="accent"
            permission="accounting-crm:create"
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
        <AccountingCrmBoard
          refreshKey={boardRefreshKey}
          onEdit={openBoard}
          onCreate={handleCreate}
        />
      ) : (
        <>
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
                placeholder="Search Accounting Tasks..."
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

          {!reorderEnabled && (debouncedSearch.trim() || statusFilter) ? (
            <p className="text-muted-foreground mb-2 text-[11px]">
              Drag-to-reorder is disabled while a filter or search is active.
            </p>
          ) : null}

          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <Table
              // table-fixed makes per-column widths authoritative for
              // drag-to-resize (Notion-style).
              className="table-fixed"
              containerClassName={`
            max-h-[calc(100vh-280px)] overflow-auto rounded-lg border
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
                        label={ACCT_COL_META[key].label}
                        className={ACCT_COL_META[key].headClassName}
                        width={widths[key]}
                        onResize={(k, w) => setWidth(k as AcctColKey, w)}
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
                      No Accounting Tasks found
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
                        // Row click opens the workstream's Kanban board on
                        // the shared /projects page (accounting projects are
                        // mirrored there as team='accounting'); the kebab "Edit"
                        // still opens the field dialog.
                        onView={() => openBoard(p)}
                        onEdit={() => handleEdit(p)}
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

      <AccountingCrmFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        users={users}
        project={editing}
        onSaved={handleSaved}
      />

      <CrmImportDialog<AccountingImportRow>
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void fetchProjects()}
        title="Import Accounting Tasks"
        entityLabel="tasks"
        templateName="accounting-crm-import-template"
        fields={[
          // Workstream is the imported row identity
          // — every real row has it, while the "Accounting Task" cell is
          // often left blank. Marking it required (instead of name)
          // matches the real shape and stops the dialog rejecting
          // every row when Accounting Task is empty.
          {
            key: "workstream",
            headers: ["Workstream"],
            type: "string",
            required: true,
          },
          { key: "name", headers: ["Accounting Task", "Name"], type: "string" },
          { key: "owner", headers: ["Owner"], type: "string" },
          { key: "date", headers: ["Date", "Due Date"], type: "string" },
          { key: "dependency", headers: ["Dependency"], type: "string" },
          { key: "description", headers: ["Description"], type: "string" },
          { key: "priority", headers: ["Priority"], type: "string" },
          { key: "status", headers: ["Status"], type: "string" },
        ]}
        submit={async (rows) => {
          // Owner is intentionally not threaded through: the xlsx
          // ships free-text names ("Alex/Jordan") and the API takes an
          // ownerId. Rows import owner-less and get re-assigned via
          // the UI after import.
          const payload: CreateAccountingProjectInput[] = rows.map((r) => {
            const workstream = r.workstream?.trim();
            const accountingTask = r.name?.trim();
            return {
              name: accountingTask || workstream || "Untitled",
              workstream: workstream || undefined,
              dependency: r.dependency?.trim() || undefined,
              description: r.description?.trim() || undefined,
              goLiveDate: parseAccountingDate(r.date) ?? undefined,
              status: normalizeAccountingStatus(r.status),
              priority: normalizeAccountingPriority(r.priority),
            };
          });
          const res = await importAccountingProjects(payload);
          return res.data;
        }}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Accounting Task?</AlertDialogTitle>
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
  onView,
  onEdit,
  onDelete,
}: {
  project: AccountingProject;
  index: number;
  colOrder: AcctColKey[];
  canDrag: boolean;
  canManageRow: boolean;
  canDelete: boolean;
  onView: () => void;
  onEdit: () => void;
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
            const p = normalizeAccountingPriority(project.priority);
            return (
              <TableCell key={key}>
                <Badge variant={ACCOUNTING_PRIORITY_VARIANTS[p] ?? "grey"}>
                  {ACCOUNTING_PRIORITY_LABELS[p] ?? p}
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
