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
  Edit,
  GripVertical,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useRouter } from "nextjs-toploader/app";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { QaCrmProjectDialog } from "@/components/qa-crm/qa-crm-project-dialog";
import { Badge } from "@/components/shared/badge";
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
import { useAuth } from "@/providers/auth-provider";
import {
  type AssignableUser,
  listAssignableUsers,
} from "@/services/directory.service";
import {
  deleteQaProject,
  listQaProjects,
  type QaProject,
  reorderQaProjects,
} from "@/services/qa-crm.service";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
];

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.label]),
);

const STATUS_VARIANTS: Record<string, "green" | "amber" | "grey"> = {
  active: "green",
  paused: "amber",
  archived: "grey",
};

// Reorderable column registry — drag handle + kebab stay pinned at the
// edges; the columns between persist their order via useColumnOrder.
type QaColKey = "rownum" | "name" | "status" | "owner" | "created" | "comment";

const QA_COL_STORAGE_KEY = "qa-crm-col-order-v1";

const QA_COL_DEFAULT_ORDER: readonly QaColKey[] = [
  "rownum",
  "name",
  "status",
  "owner",
  "created",
  "comment",
];

// Widths live in QA_COL_DEFAULT_WIDTHS (drag-to-resize, table-fixed);
// headClassName carries only alignment, never width.
const QA_COL_META: Record<QaColKey, { label: string; headClassName?: string }> =
  {
    rownum: { label: "#" },
    name: { label: "Project" },
    status: { label: "Status" },
    owner: { label: "Owner" },
    created: { label: "Created" },
    comment: { label: "Comment" },
  };

const QA_COL_WIDTH_STORAGE_KEY = "qa-crm-col-width-v1";
const QA_COL_DEFAULT_WIDTHS: Record<QaColKey, number> = {
  rownum: 48,
  name: 280,
  status: 160,
  owner: 140,
  created: 120,
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

export function QaCrmList() {
  const router = useRouter();
  const { user, hasAnyPermission } = useAuth();
  const canManageAny = hasAnyPermission("qa-crm:update", "qa-crm:manage");
  const canDeleteAny = hasAnyPermission("qa-crm:delete", "qa-crm:manage");

  const [projects, setProjects] = useState<QaProject[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const pagination = usePagination();
  const { page, pageSize, setPage, setPageSize, setTotalCount, totalPages } =
    pagination;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<QaProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QaProject | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { colOrder, isColumnId, reorderColumns } = useColumnOrder(
    QA_COL_STORAGE_KEY,
    QA_COL_DEFAULT_ORDER,
  );
  const { widths, setWidth } = useColumnWidths(
    QA_COL_WIDTH_STORAGE_KEY,
    QA_COL_DEFAULT_WIDTHS,
  );

  // Drag-to-reorder disabled while filter/search active so a partial
  // view can't corrupt global ordering.
  const reorderEnabled = useMemo(
    () => !debouncedSearch.trim() && !statusFilter && !loading,
    [debouncedSearch, statusFilter, loading],
  );
  const prePersistOrder = useRef<QaProject[] | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listQaProjects({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
      });
      setProjects(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load QA projects";
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
      await reorderQaProjects(next.map((p) => p.id));
    } catch (err) {
      if (prePersistOrder.current) setProjects(prePersistOrder.current);
      const msg =
        err instanceof ApiError ? err.message : "Failed to reorder QA projects";
      toast.error(msg);
    } finally {
      prePersistOrder.current = null;
    }
  }

  const handleCreate = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((p: QaProject) => {
    setEditing(p);
    setFormOpen(true);
  }, []);

  const handleSaved = useCallback(
    (saved: QaProject) => {
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
    },
    [editing, page, pageSize, setTotalCount],
  );

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteQaProject(deleteTarget.id);
      toast.success("QA project deleted");
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

  const skeletonRows = useMemo(
    () => Array.from({ length: 6 }, (_, i) => i),
    [],
  );

  return (
    <div>
      <PageHeader
        title="QA CRM"
        subtitle="QA issue tracking — group by release, product, or regression sweep"
      >
        <PermissionButton
          variant="accent"
          permission="qa-crm:create"
          onClick={handleCreate}
        >
          <Plus className="size-3.5" />
          New project
        </PermissionButton>
      </PageHeader>

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
            placeholder="Search QA projects..."
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
                    label={QA_COL_META[key].label}
                    className={QA_COL_META[key].headClassName}
                    width={widths[key]}
                    onResize={(k, w) => setWidth(k as QaColKey, w)}
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
                  className="text-muted-foreground py-10 text-center text-xs"
                >
                  No QA projects yet — create one to start logging issues.
                </TableCell>
              </TableRow>
            ) : (
              <SortableContext
                items={projects.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {projects.map((p, index) => (
                  <SortableQaRow
                    key={p.id}
                    project={p}
                    index={(page - 1) * pageSize + index + 1}
                    colOrder={colOrder}
                    canDrag={reorderEnabled}
                    canManageRow={p.ownerId === user?.id || canManageAny}
                    canDelete={canDeleteAny}
                    onOpen={() => router.push(`/qa-crm/${p.id}`)}
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

      <QaCrmProjectDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        users={users}
        project={editing}
        onSaved={handleSaved}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete QA project?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting <span className="font-medium">{deleteTarget?.name}</span>{" "}
              removes all of its QA issues, comments, columns, and members. This
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

function SortableQaRow({
  project,
  index,
  colOrder,
  canDrag,
  canManageRow,
  canDelete,
  onOpen,
  onEdit,
  onDelete,
}: {
  project: QaProject;
  index: number;
  colOrder: QaColKey[];
  canDrag: boolean;
  canManageRow: boolean;
  canDelete: boolean;
  onOpen: () => void;
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
          case "name":
            return (
              <TableCell key={key}>
                <button
                  type="button"
                  onClick={onOpen}
                  className={`
                    truncate text-left text-xs font-medium
                    hover:underline
                  `}
                >
                  {project.name}
                </button>
                {project.description ? (
                  <ExpandableText text={project.description} max={200} />
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
          case "created":
            return (
              <TableCell key={key} className="text-xs">
                {formatDate(project.createdAt)}
              </TableCell>
            );
          case "comment":
            return (
              <TableCell
                key={key}
                className="text-muted-foreground line-clamp-2 text-[11px]"
              >
                {project.comment ?? "—"}
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
