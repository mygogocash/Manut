"use client";

import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  getFirstCollision,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  ArrowLeft,
  CalendarRange,
  KanbanSquare,
  Lock,
  Plus,
  Settings,
  Sparkles,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AIGenerateTasksDialog } from "@/components/projects/ai-generate-tasks-dialog";
import {
  ColumnDragOverlay,
  DroppableColumn,
  getColumnSortableId,
} from "@/components/projects/board-column";
import { ColumnDialog } from "@/components/projects/column-dialog";
import { CreateTaskDialog } from "@/components/projects/create-task-dialog";
import { ManageMembersDialog } from "@/components/projects/manage-members-dialog";
import { MilestoneDialog } from "@/components/projects/milestone-dialog";
import { MoveToSheet } from "@/components/projects/move-to-sheet";
import {
  DEFAULT_COLUMNS,
  getInitials,
} from "@/components/projects/project-board-utils";
import { TaskCardOverlay } from "@/components/projects/task-card";
import { TaskDetailSheet } from "@/components/projects/task-detail-sheet";
import { TaskMobileCard } from "@/components/projects/task-mobile-card";
import { TimelineMobileList } from "@/components/projects/timeline-mobile-list";
import { TimelineView } from "@/components/projects/timeline-view";
import { PageHeader } from "@/components/shared/page-header";
import { StateView } from "@/components/shared/responsive/state-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsBelow } from "@/hooks/use-breakpoint";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import {
  type AssignableUser,
  listAssignableUsers,
} from "@/services/directory.service";
import {
  deleteColumn,
  getMilestones,
  getProject,
  getTimeline,
  type ProjectColumn,
  type ProjectDetail,
  type ProjectMember,
  type ProjectMilestone,
  reorderTasks,
  type Task,
  type TimelineSnapshot,
  updateColumn,
  updateTask,
} from "@/services/project.service";

// Tanny / 2026-05-26: the Back button hard-coded `/projects`, so a
// user who entered the detail page from /it-crm / /product-crm /
// /legal-crm / /hr-crm landed in the wrong workspace on click. Map
// the project's `team` back to its CRM list URL; `qa` doesn't share
// the legacy `/projects/:id` route so it doesn't appear here.
function backHrefFor(team: string | undefined): string {
  switch (team) {
    case "it":
      return "/it-crm";
    case "product":
      return "/product-crm";
    case "legal":
      return "/legal-crm";
    case "accounting":
      return "/accounting-crm";
    case "hr":
      return "/hr-crm";
    default:
      return "/projects";
  }
}

function resolveColumnSortableDropTarget(
  overId: string,
  columns: ProjectColumn[],
  tasks: Task[],
): string | null {
  if (overId.startsWith("col-")) return overId;
  if (overId.startsWith("column-")) {
    const key = overId.slice("column-".length);
    const col = columns.find((c) => c.key === key);
    return col ? getColumnSortableId(col) : null;
  }
  const task = tasks.find((t) => t.id === overId);
  if (task) {
    const col = columns.find((c) => c.key === task.status);
    return col ? getColumnSortableId(col) : null;
  }
  return null;
}

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const projectId =
    typeof params?.projectId === "string" ? params.projectId : "";
  // Deep-link: `?task=<id>` opens that task's detail sheet once the
  // board has loaded (e.g. clicking a task sub-row in the IT CRM list).
  const deepLinkOpened = useRef(false);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<ProjectColumn[]>(DEFAULT_COLUMNS);
  const [columnsPersisted, setColumnsPersisted] = useState(false);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumn, setActiveColumn] = useState<ProjectColumn | null>(null);

  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("todo");

  const [colDialogOpen, setColDialogOpen] = useState(false);
  const [editColumn, setEditColumn] = useState<ProjectColumn | null>(null);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [deleteColDialogOpen, setDeleteColDialogOpen] = useState(false);
  const [deleteColTarget, setDeleteColTarget] = useState<ProjectColumn | null>(
    null,
  );
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [view, setView] = useState<"board" | "timeline">("board");

  // Below `lg` the board is a status tab plus a card list. 1,414px of columns
  // in a 390px viewport shows about one column at a time, and a card cannot be
  // dragged on touch at all (PHASE_7B §11) — so the whole DndContext is simply
  // not rendered there rather than rendered and left broken.
  const isCompact = useIsBelow("lg");
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [moveTask, setMoveTask] = useState<Task | null>(null);
  const statusStripRef = useRef<HTMLDivElement | null>(null);
  const [timeline, setTimeline] = useState<TimelineSnapshot | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  // Broader user pool for the multi-assign picker. The legacy
  // `members` array is intentionally limited to project participants
  // (drives owner selection), but Phase 3b co-assignees can be any
  // workspace user — matches the backend, which has no
  // membership constraint on `project_task_assignees`.
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [editMilestone, setEditMilestone] = useState<ProjectMilestone | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // Board drag has never been keyboard-operable, on any device. The activator
    // is now a real focusable button on every card and column, so Space or
    // Enter picks a task up, the arrow keys move it between and within columns,
    // and Space or Enter drops it. Escape cancels without a write.
    //
    // `sortableKeyboardCoordinates` is the sortable package's own translator
    // from key presses to the coordinates the collision detector expects —
    // without it the arrow keys move a fixed 25px, which is meaningless against
    // 270px columns.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    const first = getFirstCollision(pointerCollisions, "id");
    if (first) return pointerCollisions;
    return rectIntersection(args);
  }, []);

  const fetchProject = useCallback(async () => {
    try {
      const result = await getProject(projectId);
      setProject(result.data);
      setTasks(result.data.tasks);
      setMembers(result.data.members ?? []);
      const apiCols = result.data.columns;
      const hasApiColumns = Boolean(apiCols && apiCols.length > 0);
      setColumnsPersisted(hasApiColumns);
      if (hasApiColumns && apiCols) {
        setColumns(apiCols);
      }
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load project";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchProject();
  }, [fetchProject]);

  useEffect(() => {
    if (deepLinkOpened.current) return;
    const taskId = searchParams?.get("task");
    if (!taskId || tasks.length === 0) return;
    const target = tasks.find((t) => t.id === taskId);
    if (target) {
      setDetailTask(target);
      setDetailOpen(true);
      deepLinkOpened.current = true;
    }
  }, [searchParams, tasks]);

  const fetchMilestones = useCallback(async () => {
    try {
      const result = await getMilestones(projectId);
      setMilestones(result.data);
    } catch {
      // Milestones are optional context for the create-task dialog
      // and the timeline (which fetches its own snapshot). A 403/404
      // here shouldn't block the board view, so the failure is
      // swallowed silently.
    }
  }, [projectId]);

  useEffect(() => {
    void fetchMilestones();
  }, [fetchMilestones]);

  // Eager-fetch the directory's assignable-user projection once per
  // page mount. Page size is bumped to 200 to cover most workspaces
  // in a single response; pagination only matters past that point
  // and the picker is searchable enough at 200 entries.
  useEffect(() => {
    void (async () => {
      try {
        const result = await listAssignableUsers({ page: 1, limit: 200 });
        setAssignableUsers(result.data);
      } catch {
        // Picker degrades to the project-members list if the directory
        // call fails (permission, network) — the legacy behaviour.
      }
    })();
  }, []);

  const fetchTimeline = useCallback(async () => {
    setTimelineLoading(true);
    try {
      const result = await getTimeline(projectId);
      setTimeline(result.data);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load timeline";
      toast.error(msg);
    } finally {
      setTimelineLoading(false);
    }
  }, [projectId]);

  // Lazy-load timeline data the first time the user flips to the
  // Timeline tab and re-fetch whenever they switch back so the bars
  // reflect any inline edits that happened on the board view.
  useEffect(() => {
    if (view === "timeline") void fetchTimeline();
  }, [view, fetchTimeline]);

  const isOwner = useMemo(() => {
    if (!project || !user) return false;
    const oid =
      typeof project.owner === "object" && project.owner !== null
        ? project.owner.id
        : undefined;
    return Boolean(oid && oid === user.id);
  }, [project, user]);

  // The selected status defaults to the board's FIRST column — the same one a
  // desktop user reads first, left to right. It is deliberately not persisted
  // and not in the URL: the board has never had either, and inventing routing
  // state here would change what `/projects/:id` means.
  //
  // Re-derived rather than only initialised, because columns arrive after the
  // first render and can be added, renamed or deleted while the page is open;
  // a selection pointing at a deleted column would show a permanently empty
  // list with no way back.
  useEffect(() => {
    if (columns.length === 0) return;
    setActiveStatus((current) =>
      current && columns.some((c) => c.key === current)
        ? current
        : (columns[0]?.key ?? null),
    );
  }, [columns]);

  const tasksByStatus = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const col of columns) map[col.key] = [];
    for (const task of tasks) {
      if (map[task.status]) {
        map[task.status].push(task);
      } else {
        if (map[columns[0]?.key]) {
          map[columns[0].key].push(task);
        }
      }
    }
    return map;
  }, [tasks, columns]);

  const activeTasks = useMemo(
    () => (activeStatus ? (tasksByStatus[activeStatus] ?? []) : []),
    [tasksByStatus, activeStatus],
  );
  const activeColumnLabel = useMemo(
    () => columns.find((c) => c.key === activeStatus)?.label,
    [columns, activeStatus],
  );

  // Keep the selected status on screen when the strip scrolls. Feature-checked
  // because an effect that throws during commit takes the page down over a
  // cosmetic scroll (same guard as the requests queue).
  useEffect(() => {
    const el = statusStripRef.current?.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    );
    if (typeof el?.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [activeStatus]);

  function findColumnForItem(id: string): string | null {
    if (id.startsWith("column-")) return id.replace("column-", "");
    if (id.startsWith("col-")) {
      const col = columns.find((c) => getColumnSortableId(c) === id);
      return col?.key ?? null;
    }
    const task = tasks.find((t) => t.id === id);
    return task?.status ?? null;
  }

  function handleOpenTask(task: Task) {
    setDetailTask(task);
    setDetailOpen(true);
  }

  function handleTaskUpdate(id: string, data: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
    if (detailTask?.id === id) {
      setDetailTask((prev) => (prev ? { ...prev, ...data } : prev));
    }
  }

  function handleAddClick(status: string) {
    setNewStatus(status);
    setDialogOpen(true);
  }

  // TaskDetailSheet owns the DELETE call + success toast and notifies
  // here once the server has confirmed. The page only needs to drop
  // the row from local state — re-calling `deleteTask` triggered a
  // 404 on the second hit and showed a misleading "Failed to delete
  // task" toast even though the row was already gone.
  function handleDeleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function handleDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === "board-column") {
      const col = event.active.data.current.column as ProjectColumn;
      setActiveColumn(col);
      setActiveTask(null);
      return;
    }
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
    setActiveColumn(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    setActiveColumn(null);
    if (!over) return;

    if (active.data.current?.type === "board-column") {
      if (!isOwner) return;
      const activeId = active.id as string;
      let overId = over.id as string;
      const resolved = resolveColumnSortableDropTarget(overId, columns, tasks);
      if (resolved) overId = resolved;
      if (!overId.startsWith("col-")) return;

      const oldIndex = columns.findIndex(
        (c) => getColumnSortableId(c) === activeId,
      );
      const newIndex = columns.findIndex(
        (c) => getColumnSortableId(c) === overId,
      );
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

      const reordered = arrayMove(columns, oldIndex, newIndex).map((c, i) => ({
        ...c,
        sortOrder: i,
      }));
      setColumns(reordered);

      if (columnsPersisted) {
        void Promise.all(
          reordered.map((c, i) =>
            updateColumn(projectId, c.id, { sortOrder: i }),
          ),
        ).catch(() => {
          toast.error("Failed to reorder columns");
          void fetchProject();
        });
      }
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;
    const draggedTask = tasks.find((t) => t.id === activeId);
    if (!draggedTask) return;

    const targetStatus = findColumnForItem(overId);
    if (!targetStatus) return;

    // The drop can land on another task (insert at that task's index) or on the
    // column container (append). `applyTaskMove` does the rest — the SAME
    // function the mobile "Move to" sheet calls, so a card moved by tap and a
    // card moved by drag take one code path to one endpoint.
    const isOverColumnContainer =
      overId.startsWith("col-") || overId.startsWith("column-");
    const overTask = !isOverColumnContainer
      ? tasks.find((t) => t.id === overId)
      : null;

    void applyTaskMove(activeId, targetStatus, overTask?.id ?? null);
  }

  /**
   * Move a task into a status, at a position.
   *
   * Extracted from the drag handler so the mobile list can reuse it verbatim.
   * `beforeTaskId` is the task to insert in front of; `null` appends, which is
   * what an explicit "Move to" means when there is no drop point.
   *
   * Optimistic, with the snapshot rollback the drag already had. Resolves
   * `true` when the write landed — the sheet needs that to decide whether to
   * close, and the drag path ignores it exactly as it ignored the old promise.
   * It never rejects: failure is a toast plus a rollback, as before.
   */
  async function applyTaskMove(
    activeId: string,
    targetStatus: string,
    beforeTaskId: string | null,
  ): Promise<boolean> {
    const draggedTask = tasks.find((t) => t.id === activeId);
    if (!draggedTask) return false;

    const originalStatus = draggedTask.status;

    const targetColCurrent = tasks.filter((t) => t.status === targetStatus);
    const targetWithoutActive = targetColCurrent.filter(
      (t) => t.id !== activeId,
    );
    const insertIdx = beforeTaskId
      ? targetWithoutActive.findIndex((t) => t.id === beforeTaskId)
      : targetWithoutActive.length;

    // No-op: dropped onto itself or back into the same slot.
    if (
      originalStatus === targetStatus &&
      targetColCurrent.findIndex((t) => t.id === activeId) === insertIdx
    ) {
      return true;
    }

    const movedTask = { ...draggedTask, status: targetStatus };
    const newTargetTasks = [
      ...targetWithoutActive.slice(0, Math.max(0, insertIdx)),
      movedTask,
      ...targetWithoutActive.slice(Math.max(0, insertIdx)),
    ];

    // Optimistic local reorder. Source column is left in its prior
    // relative order minus the dragged card; target column is the
    // freshly-computed array. Snapshot in `prev` so we can roll back
    // if the API rejects the write.
    const snapshot = tasks;
    setTasks((prev) => {
      const others = prev.filter(
        (t) => t.status !== originalStatus && t.status !== targetStatus,
      );
      const sourceColRemaining =
        originalStatus === targetStatus
          ? []
          : prev.filter(
              (t) => t.status === originalStatus && t.id !== activeId,
            );
      return [...others, ...sourceColRemaining, ...newTargetTasks];
    });

    try {
      await reorderTasks(
        projectId,
        newTargetTasks.map((t) => t.id),
        originalStatus !== targetStatus ? targetStatus : undefined,
      );
      return true;
    } catch {
      toast.error("Failed to save task order");
      setTasks(snapshot);
      void fetchProject();
      return false;
    }
  }

  async function handleDeleteColumn(colId: string) {
    try {
      await deleteColumn(projectId, colId);
      setColumns((prev) => prev.filter((c) => c.id !== colId));
      toast.success("Column deleted");
    } catch {
      toast.error("Failed to delete column");
    }
  }

  function handleEditColumn(col: ProjectColumn) {
    setEditColumn(col);
    setColDialogOpen(true);
  }

  function handleNewColumn() {
    setEditColumn(null);
    setColDialogOpen(true);
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton
              key={i}
              className="h-[400px] w-[270px] shrink-0 rounded-xl"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-96 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Project not found</p>
        <Button variant="outline" onClick={() => router.push("/projects")}>
          <ArrowLeft className="mr-2 size-4" /> Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <PageHeader
        title={
          // Legal workstreams use `workstream` as the descriptive title
          // (the Legal CRM list shows it as "Workstream"); `name` holds
          // the legal-task category (Research / Document / …). Match the
          // legal list/board so the board title is the workstream the
          // user clicked, not the category.
          project.team === "legal" || project.team === "accounting"
            ? project.workstream || project.name
            : project.name
        }
        subtitle={project.description ?? undefined}
      >
        <Button
          variant="ghost"
          onClick={() => router.push(backHrefFor(project.team))}
        >
          <ArrowLeft className="size-3.5" /> Back
        </Button>
        {/* Theme-aware view toggle. Earlier markup hardcoded
            `bg-white` on the container and used the shadcn `Button`
            default/ghost variants — both ignored the cream/bronze
            tokens and were unreadable on the dark theme. Drop down
            to plain `<button>`s with theme tokens (matches the drive
            page pattern). */}
        <div
          className={`
            border-border bg-muted/40 inline-flex items-center rounded-md border
            p-0.5
          `}
        >
          <button
            type="button"
            onClick={() => setView("board")}
            aria-pressed={view === "board"}
            className={cn(
              `
                inline-flex items-center gap-1 rounded px-2 py-1 text-xs
                font-medium transition-colors
              `,
              view === "board"
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <KanbanSquare className="size-3.5" /> Board
          </button>
          <button
            type="button"
            onClick={() => setView("timeline")}
            aria-pressed={view === "timeline"}
            className={cn(
              `
                inline-flex items-center gap-1 rounded px-2 py-1 text-xs
                font-medium transition-colors
              `,
              view === "timeline"
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <CalendarRange className="size-3.5" /> Timeline
          </button>
        </div>
        {isOwner && view === "board" && (
          <Button variant="outline" onClick={handleNewColumn}>
            <Settings className="size-3.5" /> Add Column
          </Button>
        )}
        <Button onClick={() => handleAddClick("todo")}>
          <Plus className="size-3.5" /> Add Task
        </Button>
        <Button
          variant="outline"
          onClick={() => setAiDialogOpen(true)}
          className={`
            border-violet-200 text-violet-700
            hover:bg-violet-50
            dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950
          `}
        >
          <Sparkles className="size-3.5" /> AI Generate
        </Button>
      </PageHeader>

      {/*
        Task work is blocked until the request is approved, so say so here
        rather than letting someone discover it by getting an error when they
        try to drag a card.
      */}
      {project?.workflowStatus &&
      project.workflowStatus !== "approved" &&
      /* The name `approved` carried before; a row on it is still approved. */
      project.workflowStatus !== "pending_development" &&
      project.workflowStatus !== "completed" ? (
        <Alert className="mb-4">
          <Lock className="size-4" />
          <AlertTitle>
            {project.workflowStatus === "rejected"
              ? "This request was rejected"
              : "This request is awaiting approval"}
          </AlertTitle>
          <AlertDescription>
            {project.workflowStatus === "rejected"
              ? "Its board is read-only. A Project Manager can reopen the request if the work should go ahead."
              : "Tasks cannot be added or moved until the request is approved."}{" "}
            <Link
              href={`/projects/requests/${projectId}`}
              className="underline"
            >
              View the request
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      {members.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-muted-foreground text-[11px] font-medium">
            Members:
          </span>
          <div className="flex -space-x-1.5">
            {members.slice(0, 8).map((m) => (
              <Tooltip key={m.user.id}>
                <TooltipTrigger asChild>
                  <Avatar className="border-background size-6 border-2">
                    <AvatarFallback className="text-[7px] font-bold">
                      {getInitials(m.user.name)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>{m.user.name}</TooltipContent>
              </Tooltip>
            ))}
            {members.length > 8 && (
              <span className="text-muted-foreground ml-2 text-[11px]">
                +{members.length - 8}
              </span>
            )}
          </div>
          {isOwner && (
            <Button
              variant="ghost"
              className="ml-1 h-6 px-2 text-[11px]"
              onClick={() => setMemberDialogOpen(true)}
            >
              <UserPlus className="mr-1 size-3" />
              Manage
            </Button>
          )}
        </div>
      )}

      {members.length === 0 && isOwner && (
        <div className="mb-4">
          <Button variant="outline" onClick={() => setMemberDialogOpen(true)}>
            <UserPlus className="mr-1 size-3.5" />
            Add Members
          </Button>
        </div>
      )}

      {project.customFields && project.customFields.length > 0 ? (
        <div
          className={`
            border-border bg-surface mb-4 flex flex-wrap gap-x-6 gap-y-2
            rounded-md border px-4 py-3 text-xs shadow-sm
          `}
        >
          {project.customFields.map((f) => (
            <span key={f.id} className="flex items-baseline gap-1.5">
              <span
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                {f.label}
              </span>
              <span className="text-foreground">
                {f.value || <span className="text-muted-foreground">—</span>}
              </span>
            </span>
          ))}
        </div>
      ) : null}

      {view === "timeline" ? (
        timelineLoading ? (
          <Skeleton className="h-[60vh] w-full rounded-md" />
        ) : timeline ? (
          isCompact ? (
            /* The Gantt's label pane is a non-shrinking 320px, so below `lg` it
               leaves the chart no room at all, and its reschedule gestures are
               mouse-only. Same snapshot, read as a chronology instead; tapping a
               row opens the same task sheet, which is where dates stay
               editable. */
            <TimelineMobileList
              snapshot={timeline}
              onTaskClick={(taskId) => {
                const task = tasks.find((t) => t.id === taskId);
                if (task) handleOpenTask(task);
              }}
            />
          ) : (
          <TimelineView
            snapshot={timeline}
            onTaskClick={(taskId) => {
              const task = tasks.find((t) => t.id === taskId);
              if (task) handleOpenTask(task);
            }}
            onAddMilestone={() => {
              setEditMilestone(null);
              setMilestoneDialogOpen(true);
            }}
            onMilestoneClick={(milestoneId) => {
              const m = milestones.find((x) => x.id === milestoneId);
              if (m) {
                setEditMilestone(m);
                setMilestoneDialogOpen(true);
              }
            }}
            onTaskDateChange={async (taskId, range) => {
              // Optimistic local update for the board view's mirror,
              // then persist. On error we re-fetch the timeline so the
              // bar snaps back to its server state.
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === taskId
                    ? {
                        ...t,
                        startDate: range.startDate,
                        endDate: range.endDate,
                        dueDate: range.endDate,
                      }
                    : t,
                ),
              );
              try {
                await updateTask(projectId, taskId, range);
                void fetchTimeline();
              } catch {
                toast.error("Failed to reschedule task");
                void fetchTimeline();
              }
            }}
          />
          )
        ) : null
      ) : isCompact ? (
        /* ── Board, below lg ──────────────────────────────────────────────
           Same columns, same tasks, same handlers — one status at a time.
           No DndContext at all: rendering one here would offer a drag that
           cannot complete on touch. */
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            ref={statusStripRef}
            role="tablist"
            aria-label="Task status"
            className={`
              allow-x-scroll border-border mb-3 flex min-w-0 flex-nowrap gap-1
              border-b pb-px
            `}
          >
            {columns.map((col) => {
              const active = col.key === activeStatus;
              const count = (tasksByStatus[col.key] ?? []).length;
              return (
                <button
                  key={col.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveStatus(col.key)}
                  className={cn(
                    `
                      -mb-px flex h-11 shrink-0 items-center gap-1.5
                      rounded-t-md border-b-2 px-3 text-sm whitespace-nowrap
                      transition-colors
                    `,
                    active
                      ? "border-primary text-foreground font-medium"
                      : `
                        text-muted-foreground border-transparent
                        hover:text-foreground
                      `,
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("size-2 shrink-0 rounded-full", col.color)}
                  />
                  {col.label}
                  {/* Counts come from the data already on screen — no extra
                      request, the same `tasksByStatus` the columns use. */}
                  <span
                    className={`
                      bg-muted text-muted-foreground rounded-full px-1.5 py-0.5
                      text-[10px] tabular-nums
                    `}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pb-4">
            {activeTasks.length === 0 ? (
              <StateView
                kind="empty"
                title="Nothing in this status"
                message={
                  activeColumnLabel
                    ? `No tasks are in ${activeColumnLabel} right now.`
                    : undefined
                }
                compact
              />
            ) : (
              activeTasks.map((task) => (
                <TaskMobileCard
                  key={task.id}
                  task={task}
                  onOpen={handleOpenTask}
                  onMove={(t) => setMoveTask(t)}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            className={`
              scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted
              min-h-0 flex-1 overflow-x-auto pb-4
              hover:scrollbar-thumb-muted-foreground
            `}
          >
            <SortableContext
              items={columns.map((c) => getColumnSortableId(c))}
              strategy={horizontalListSortingStrategy}
            >
              <div className={`flex h-full min-h-0 w-max items-stretch gap-4`}>
                {columns.map((col) => (
                  <DroppableColumn
                    key={col.id}
                    column={col}
                    tasks={tasksByStatus[col.key] ?? []}
                    canManageStructure={isOwner}
                    onAddClick={handleAddClick}
                    onOpenTask={handleOpenTask}
                    onEditColumn={handleEditColumn}
                    onDeleteColumn={(id) => {
                      const targetCol = columns.find((c) => c.id === id);
                      if (targetCol) {
                        setDeleteColTarget(targetCol);
                        setDeleteColDialogOpen(true);
                      }
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </div>

          <DragOverlay>
            {activeColumn ? (
              <ColumnDragOverlay
                column={activeColumn}
                tasks={tasksByStatus[activeColumn.key] ?? []}
              />
            ) : activeTask ? (
              <TaskCardOverlay task={activeTask} />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Mobile move. Destinations are the board's own columns and the write
          goes through `applyTaskMove` — the same function the desktop drag
          handler calls, to the same endpoint, with the same rollback. */}
      <MoveToSheet
        open={moveTask !== null}
        onOpenChange={(next) => {
          if (!next) setMoveTask(null);
        }}
        task={moveTask}
        columns={columns}
        onMove={(task, targetStatus) =>
          applyTaskMove(task.id, targetStatus, null)
        }
      />

      <TaskDetailSheet
        task={detailTask}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdate={handleTaskUpdate}
        onDelete={handleDeleteTask}
        projectId={projectId}
        projectName={project.name}
        columns={columns}
        members={members}
        assignableUsers={assignableUsers}
        milestones={milestones}
        allTasks={tasks}
        onOpenSubtask={(t) => setDetailTask(t)}
      />

      <CreateTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId}
        columns={columns}
        members={members}
        milestones={milestones}
        defaultStatus={newStatus}
        onCreated={(task) => {
          setTasks((prev) => [...prev, task]);
        }}
      />

      <ColumnDialog
        open={colDialogOpen}
        onOpenChange={setColDialogOpen}
        column={editColumn}
        projectId={projectId}
        onSuccess={fetchProject}
      />

      <ManageMembersDialog
        open={memberDialogOpen}
        onOpenChange={setMemberDialogOpen}
        projectId={projectId}
        currentMembers={members}
        ownerId={
          typeof project.owner === "object" && project.owner !== null
            ? project.owner.id
            : ""
        }
        onSuccess={fetchProject}
      />

      <MilestoneDialog
        open={milestoneDialogOpen}
        onOpenChange={setMilestoneDialogOpen}
        milestone={editMilestone}
        projectId={projectId}
        members={members}
        onSuccess={() => {
          void fetchMilestones();
          if (view === "timeline") void fetchTimeline();
        }}
      />

      <AIGenerateTasksDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        projectId={projectId}
        projectDescription={project.description}
        columns={columns}
        onTasksCreated={(newTasks) => {
          setTasks((prev) => [...prev, ...newTasks]);
        }}
      />

      <AlertDialog
        open={deleteColDialogOpen}
        onOpenChange={setDeleteColDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Column</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the &quot;
              {deleteColTarget?.label}&quot; column? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (deleteColTarget) {
                  await handleDeleteColumn(deleteColTarget.id);
                  setDeleteColDialogOpen(false);
                  setDeleteColTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
