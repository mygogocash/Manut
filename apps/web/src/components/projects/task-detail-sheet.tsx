"use client";

import {
  ChevronRight,
  CornerDownRight,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  formatDateLong,
  formatTaskPriority,
  getAssigneeId,
  getInitials,
  PRIORITY_COLORS,
} from "@/components/projects/project-board-utils";
import {
  normalizeProjectTaskPriority,
  PROJECT_TASK_PRIORITY_DEFAULT,
  PROJECT_TASK_PRIORITY_OPTIONS,
} from "@/components/projects/task-priority";
import { Badge } from "@/components/shared/badge";
import { FormDatePicker } from "@/components/shared/form-date-picker";
import {
  RichTextEditor,
  RichTextViewer,
} from "@/components/shared/rich-text-editor";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import type {
  ProjectColumn,
  ProjectMember,
  ProjectMilestone,
  Task,
  TaskActivity,
  TaskDetailPayload,
} from "@/services/project.service";
import {
  addTaskDependency,
  addTaskResource,
  createTask,
  createTaskComment,
  deleteTask,
  getResourceDownloadUrl,
  getTaskDetail,
  removeTaskDependency,
  removeTaskResource,
  setTaskAssignees,
  updateTask,
} from "@/services/project.service";
import { uploadFile } from "@/services/upload.service";

function taskKeyLabel(taskId: string) {
  return `TASK-${taskId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function memberLabel(
  members: ProjectMember[],
  userId: string | null | undefined,
) {
  if (!userId) return "Unassigned";
  const m = members.find((x) => x.user.id === userId);
  return m?.user.name ?? userId.slice(0, 8);
}

function StatusTransition({
  oldKey,
  newKey,
  columns,
}: {
  oldKey: string | null;
  newKey: string | null;
  columns: ProjectColumn[];
}) {
  const oldCol = oldKey ? columns.find((c) => c.key === oldKey) : null;
  const newCol = newKey ? columns.find((c) => c.key === newKey) : null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <span
        className={`
          border-border bg-muted/40 inline-flex items-center gap-1 rounded
          border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase
        `}
      >
        {oldCol && (
          <span
            className={cn("size-1.5 shrink-0 rounded-full", oldCol.color)}
          />
        )}
        {oldCol?.label ?? oldKey ?? "—"}
      </span>
      <ChevronRight className="text-muted-foreground size-3.5 shrink-0" />
      <span
        className={`
          border-border bg-muted/40 inline-flex items-center gap-1 rounded
          border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase
        `}
      >
        {newCol && (
          <span
            className={cn("size-1.5 shrink-0 rounded-full", newCol.color)}
          />
        )}
        {newCol?.label ?? newKey ?? "—"}
      </span>
    </div>
  );
}

type ActivityTab = "all" | "comments" | "history";

export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  projectId,
  projectName,
  columns,
  members,
  assignableUsers,
  milestones,
  allTasks,
  onOpenSubtask,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, data: Partial<Task>) => void;
  onDelete: (id: string) => void;
  projectId: string;
  projectName: string;
  columns: ProjectColumn[];
  members: ProjectMember[];
  /**
   * Full workspace user pool. The primary Assignee (task owner) picker
   * lists everyone from here — owner connects to any User, no project
   * membership constraint. The "+ Add assignee" multi-picker still uses
   * `members` (the project_task_assignees join is membership-gated).
   */
  assignableUsers?: Array<{ id: string; name: string; email: string }>;
  milestones?: ProjectMilestone[];
  /** Full task list for the dependency search picker. */
  allTasks?: Task[];
  onOpenSubtask?: (task: Task) => void;
}) {
  const [detail, setDetail] = useState<TaskDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activityTab, setActivityTab] = useState<ActivityTab>("all");
  const [commentDraft, setCommentDraft] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  // HR / Tanny feedback (2026-05-26): the task detail sheet had no
  // way to delete a task — parent passed `onDelete` but the sheet
  // never wired it to UI. AlertDialog gating the action so an
  // accidental click can't nuke a task with subtasks / activity.
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Phase 3b — Assignee picker. The full multi-assign set replaces
  // every time a chip is added/removed (server semantics for
  // `PUT /assignees`). Local draft = empty string when no pending
  // selection.
  const [assigneeDraft, setAssigneeDraft] = useState("");
  // Dependency picker.
  const [depDraft, setDepDraft] = useState("");

  // The primary Assignee (task owner) connects to any User — no project
  // membership constraint (unlike the multi-assignee join) — so the picker
  // lists every workspace user, like the project Owner dropdown. Members are
  // merged in case the list endpoint is unavailable. Deduped + sorted.
  const assigneePool = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const u of assignableUsers ?? []) {
      byId.set(u.id, { id: u.id, name: u.name });
    }
    for (const m of members) {
      if (!byId.has(m.user.id)) {
        byId.set(m.user.id, { id: m.user.id, name: m.user.name });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [assignableUsers, members]);
  // Resource form.
  const [resKind, setResKind] = useState<"file" | "link" | "doc">("link");
  const [resLabel, setResLabel] = useState("");
  const [resUrl, setResUrl] = useState("");
  const [addingResource, setAddingResource] = useState(false);
  const [uploadingResource, setUploadingResource] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const taskId = task?.id;

  const loadDetail = useCallback(async () => {
    if (!taskId) return;
    setDetailLoading(true);
    try {
      const res = await getTaskDetail(projectId, taskId);
      const payload = res?.data;
      if (payload && typeof payload === "object" && "task" in payload) {
        setDetail(payload as TaskDetailPayload);
      } else {
        setDetail(null);
        toast.error("Invalid task detail response");
      }
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load task detail";
      toast.error(msg);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [projectId, taskId]);

  useEffect(() => {
    if (open && taskId) {
      void loadDetail();
      setActivityTab("all");
      setCommentDraft("");
      setSubtaskDraft("");
    } else if (!open) {
      setDetail(null);
    }
  }, [open, taskId, loadDetail]);

  useEffect(() => {
    const t = detail?.task ?? task;
    if (t) {
      setTitle(t.title);
      setDescription(t.description ?? "");
      setEditingTitle(false);
      setEditingDesc(false);
    }
  }, [detail?.task, task]);

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus();
  }, [editingTitle]);

  const effectiveTask = detail?.task ?? task;
  const isRootTask = !effectiveTask?.parentTaskId;

  const mergedFeed = useMemo(() => {
    if (!detail) return [];
    const toTime = (iso: string) => {
      const t = new Date(iso).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    const comments = detail.comments.map((c) => ({
      sort: toTime(c.createdAt),
      kind: "comment" as const,
      comment: c,
    }));
    const activities = detail.activities.map((a) => ({
      sort: toTime(a.createdAt),
      kind: "history" as const,
      activity: a,
    }));
    return [...comments, ...activities].sort((a, b) => b.sort - a.sort);
  }, [detail]);

  if (!task) return null;

  async function saveField(field: string, value: string | null | undefined) {
    if (!effectiveTask) return;
    setSaving(true);
    try {
      // `null` clears the field (sent verbatim so JSON.stringify keeps it);
      // empty string / undefined mean "no change" and are omitted from the
      // PATCH. Without this, clearing a date sent `undefined`, which the
      // body dropped, so the server never wiped it.
      const payload = value === null ? null : value || undefined;
      await updateTask(projectId, effectiveTask.id, {
        [field]: payload,
      } as Parameters<typeof updateTask>[2]);
      if (!effectiveTask.parentTaskId) {
        onUpdate(effectiveTask.id, {
          [field]: value || null,
        } as unknown as Partial<Task>);
      }
      await loadDetail();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to update";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTitleBlur() {
    setEditingTitle(false);
    if (!effectiveTask) return;
    if (title.trim() && title !== effectiveTask.title) {
      await saveField("title", title.trim());
    } else {
      setTitle(effectiveTask.title);
    }
  }

  async function handleDescSave() {
    setEditingDesc(false);
    if (!effectiveTask) return;
    if (description !== (effectiveTask.description ?? "")) {
      await saveField("description", description);
    }
  }

  async function handlePostComment() {
    if (!effectiveTask || !commentDraft.trim()) return;
    setPostingComment(true);
    try {
      await createTaskComment(projectId, effectiveTask.id, {
        body: commentDraft.trim(),
      });
      setCommentDraft("");
      await loadDetail();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to post comment";
      toast.error(message);
    } finally {
      setPostingComment(false);
    }
  }

  async function handleDeleteTask() {
    if (!effectiveTask || deleting) return;
    setDeleting(true);
    try {
      await deleteTask(projectId, effectiveTask.id);
      toast.success("Task deleted");
      onDelete?.(effectiveTask.id);
      setDeleteConfirmOpen(false);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete task";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddSubtask() {
    if (!effectiveTask || !subtaskDraft.trim() || !isRootTask) return;
    setAddingSubtask(true);
    try {
      await createTask(projectId, {
        title: subtaskDraft.trim(),
        status: "todo",
        priority: PROJECT_TASK_PRIORITY_DEFAULT,
        parentTaskId: effectiveTask.id,
      });
      setSubtaskDraft("");
      await loadDetail();
      toast.success("Subtask created");
    } catch (err) {
      // Marketing reported "Failed to create task" with no detail. Surface
      // the real server message so reps can tell whether it's a permission
      // problem (403 — not a project participant), a validation failure
      // (e.g. nested-subtask block), or something else.
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to create subtask";
      toast.error(message);
    } finally {
      setAddingSubtask(false);
    }
  }

  // ─── Phase 3b: multi-assign / dependencies / resources ────

  async function handleAddAssignee(userId: string) {
    if (!effectiveTask) return;
    const current = detail?.task.assignees ?? [];
    if (current.some((a) => a.userId === userId)) return;
    const nextIds = [...current.map((a) => a.userId), userId];
    try {
      await setTaskAssignees(
        projectId,
        effectiveTask.id,
        nextIds.map((id) => ({ userId: id })),
      );
      setAssigneeDraft("");
      await loadDetail();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update assignees";
      toast.error(message);
    }
  }

  async function handleRemoveAssignee(userId: string) {
    if (!effectiveTask) return;
    const current = detail?.task.assignees ?? [];
    const nextIds = current.map((a) => a.userId).filter((id) => id !== userId);
    try {
      await setTaskAssignees(
        projectId,
        effectiveTask.id,
        nextIds.map((id) => ({ userId: id })),
      );
      await loadDetail();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update assignees";
      toast.error(message);
    }
  }

  async function handleAddDependency(dependsOnTaskId: string) {
    if (!effectiveTask) return;
    if (dependsOnTaskId === effectiveTask.id) {
      toast.error("Task cannot depend on itself");
      return;
    }
    try {
      await addTaskDependency(projectId, effectiveTask.id, {
        dependsOnTaskId,
        type: "finish_to_start",
      });
      setDepDraft("");
      await loadDetail();
    } catch (err) {
      // Cycle errors come back as 400 with a helpful message — surface
      // the server text so the user knows what loop they tried to form.
      const message =
        err instanceof ApiError ? err.message : "Failed to add dependency";
      toast.error(message);
    }
  }

  async function handleRemoveDependency(dependencyId: string) {
    if (!effectiveTask) return;
    try {
      await removeTaskDependency(projectId, effectiveTask.id, dependencyId);
      await loadDetail();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to remove dependency";
      toast.error(message);
    }
  }

  async function handleAddResource() {
    if (!effectiveTask || !resLabel.trim() || !resUrl.trim()) return;
    setAddingResource(true);
    try {
      await addTaskResource(projectId, effectiveTask.id, {
        kind: resKind,
        label: resLabel.trim(),
        url: resUrl.trim(),
      });
      setResLabel("");
      setResUrl("");
      await loadDetail();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to add resource";
      toast.error(message);
    } finally {
      setAddingResource(false);
    }
  }

  async function handleRemoveResource(resourceId: string) {
    if (!effectiveTask) return;
    try {
      await removeTaskResource(projectId, effectiveTask.id, resourceId);
      await loadDetail();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to remove resource";
      toast.error(message);
    }
  }

  async function handleFilePicked(file: File) {
    if (!effectiveTask) return;
    setUploadingResource(true);
    try {
      // Documents bucket is private — `uploadFile` returns a signed
      // display URL but the stored row holds the public storage path
      // that the backend can re-sign on download.
      const uploaded = await uploadFile(file, {
        bucket: "documents",
        purpose: "project_resource",
        linkedTo: "task",
        linkedId: effectiveTask.id,
      });
      await addTaskResource(projectId, effectiveTask.id, {
        kind: "file",
        label: uploaded.originalName,
        url: uploaded.url,
      });
      await loadDetail();
    } catch (err) {
      toast.error(getErrorMessage(err, "We couldn't upload that file."));
    } finally {
      setUploadingResource(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleOpenResource(r: {
    id: string;
    kind: "file" | "link" | "doc";
    url: string;
  }) {
    // Link / doc URLs open directly. File URLs go through the signed-
    // URL mint route so private-bucket downloads work in the browser
    // for users who are project participants.
    if (r.kind !== "file" || !effectiveTask) {
      window.open(r.url, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const res = await getResourceDownloadUrl(
        projectId,
        effectiveTask.id,
        r.id,
      );
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to open file";
      toast.error(message);
    }
  }

  function renderHistoryBody(a: TaskActivity) {
    if (a.kind === "subtask_added") {
      return (
        <p className="text-foreground mt-0.5 text-[13px]">
          Added subtask <span className="font-medium">{a.newValue ?? "—"}</span>
        </p>
      );
    }
    if (a.kind === "subtask_removed") {
      return (
        <p className="text-foreground mt-0.5 text-[13px]">
          Removed subtask{" "}
          <span className="font-medium">{a.oldValue ?? "—"}</span>
        </p>
      );
    }
    if (a.kind === "field_change" && a.field === "status") {
      return (
        <StatusTransition
          oldKey={a.oldValue}
          newKey={a.newValue}
          columns={columns}
        />
      );
    }
    if (a.kind === "field_change" && a.field === "assignee") {
      return (
        <p className="text-foreground mt-0.5 text-[13px]">
          <span className="text-muted-foreground">From </span>
          {memberLabel(members, a.oldValue)}
          <span className="text-muted-foreground"> to </span>
          {memberLabel(members, a.newValue)}
        </p>
      );
    }
    if (a.kind === "field_change" && a.field === "priority") {
      return (
        <p className="text-foreground mt-0.5 text-[13px]">
          <span className="text-muted-foreground">From </span>
          <span>{formatTaskPriority(a.oldValue)}</span>
          <span className="text-muted-foreground"> to </span>
          <span>{formatTaskPriority(a.newValue)}</span>
        </p>
      );
    }
    if (a.kind === "field_change" && a.field === "dueDate") {
      return (
        <p className="text-foreground mt-0.5 text-[13px]">
          <span className="text-muted-foreground">From </span>
          {a.oldValue ?? "None"}
          <span className="text-muted-foreground"> to </span>
          {a.newValue ?? "None"}
        </p>
      );
    }
    if (a.kind === "field_change" && a.field === "title") {
      return (
        <p className="text-foreground mt-0.5 text-[13px]">
          <span className="text-muted-foreground">Was: </span>
          <span className="line-through opacity-70">{a.oldValue}</span>
          <br />
          <span className="text-muted-foreground">Now: </span>
          <span className="font-medium">{a.newValue}</span>
        </p>
      );
    }
    if (a.kind === "field_change" && a.field === "description") {
      return (
        <p className="text-muted-foreground mt-0.5 text-[12px]">
          Description updated
        </p>
      );
    }
    return null;
  }

  function historySummary(a: TaskActivity) {
    if (a.kind === "subtask_added") return "added a subtask";
    if (a.kind === "subtask_removed") return "removed a subtask";
    if (a.kind === "field_change" && a.field) {
      const labels: Record<string, string> = {
        title: "Title",
        description: "Description",
        status: "Status",
        priority: "Priority",
        assignee: "Assignee",
        startDate: "Start date",
        endDate: "End date",
        milestone: "Milestone",
        // `dueDate` retained so historical activity rows written
        // before Phase 4c still render with a friendly label.
        dueDate: "Due date",
      };
      return `updated ${labels[a.field] ?? a.field}`;
    }
    return "updated this task";
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/*
        Two mobile geometry fixes, both scoped so nothing at md+ moves.

        Width: the Sheet primitive sets `data-[side=right]:w-3/4`, and an
        attribute-prefixed utility outranks a plain `w-full` however the classes
        are ordered — which is why the `sm:max-w-...` below already needed `!`.
        Measured at 390px the sheet came out 292.5px wide, leaving a 98px dead
        strip; at 768px it was 576px, and because the row splits into a 300px
        sidebar at `md` the content column came to 275px — narrower than the
        same content gets on a 320px phone, and narrower than the sidebar
        annotating it. `max-lg:w-full!` forces full width below `lg`, the same
        1024px boundary the board uses (Phase 7C). At `lg` and above the
        `sm:max-w-...` cap still governs and the geometry is unchanged.

        Close button: 28px, from the primitive. Raised to 44px below `md` here
        rather than in sheet.tsx, so no other sheet in the app changes.
        `size-11` and not the `.touch-target` utility, because Tailwind cannot
        re-emit a hand-written utility through an arbitrary variant —
        `[&_...]:touch-target` silently produced nothing, confirmed by measuring
        the pseudo-element, which stayed `auto`.
      */}
      <SheetContent
        className={cn(
          `
            flex h-full w-full max-w-none flex-col gap-0 overflow-hidden p-0
            sm:max-w-[min(1080px,calc(100vw-24px))]!
            max-lg:w-full!
            max-md:[&_[data-slot=sheet-close]]:size-11
          `,
        )}
        showCloseButton
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Task Details</SheetTitle>
          <SheetDescription>View and edit task details</SheetDescription>
        </SheetHeader>

        {/* Header — Jira-style breadcrumb + actions */}
        <div
          className={`
            border-border bg-muted/20 flex shrink-0 items-center justify-between
            border-b px-4 py-2.5
          `}
        >
          <div className="min-w-0 flex-1">
            <p
              className={`
                text-muted-foreground truncate text-[11px] font-medium
                tracking-wide
              `}
            >
              <span className="text-foreground/80">{projectName}</span>
              <span className="text-muted-foreground/70 mx-1.5">/</span>
              <span className="font-mono text-[10px]">
                {taskKeyLabel(task.id)}
              </span>
            </p>
          </div>
        </div>

        {detailLoading && !detail ? (
          <div
            className={`
              text-muted-foreground flex flex-1 items-center justify-center
              gap-2 py-20 text-sm
            `}
          >
            <Spinner className="size-4" />
            Loading…
          </div>
        ) : (
          /*
            Scroll ownership.

            Below `md` the sheet is one column and the SHEET BODY scrolls: main
            content, then the metadata rail, read top to bottom. Previously main
            owned the only scroller while the rail sat below it as `shrink-0`
            inside an `overflow-hidden` sheet, so the two competed for a fixed
            height — measured at 390px, the rail took 381px of an 844px viewport
            and left main 426px to scroll 1,815px of content, with no way to
            push the metadata out of the way.

            At `md` and above nothing changes: the row splits, main regains its
            own scroller and the rail becomes the 300px sidebar it has always
            been.
          */
          <div
            className={`
              flex min-h-0 flex-1 flex-col overflow-y-auto
              md:flex-row md:overflow-hidden
            `}
          >
            {/* Main column */}
            <div
              className={`
                flex min-w-0 flex-col px-4 py-4
                md:min-h-0 md:flex-1 md:overflow-y-auto md:px-5
              `}
            >
              {effectiveTask?.parent && (
                <button
                  type="button"
                  className={`
                    text-muted-foreground border-border mb-3 flex w-fit
                    items-center gap-1.5 rounded-md border border-dashed px-2
                    py-1 text-left text-[11px] transition-colors
                    hover:text-foreground
                  `}
                  onClick={() => {
                    const p = effectiveTask.parent;
                    if (p && onOpenSubtask) {
                      onOpenSubtask({
                        id: p.id,
                        title: p.title,
                        description: null,
                        status: "todo",
                        priority: PROJECT_TASK_PRIORITY_DEFAULT,
                        order: 0,
                        assigneeId: null,
                        assigneeName: null,
                        projectId,
                        createdAt: new Date().toISOString(),
                      });
                    }
                  }}
                >
                  <CornerDownRight className="size-3" />
                  Subtask of{" "}
                  <span className="text-foreground font-medium">
                    {effectiveTask.parent.title}
                  </span>
                </button>
              )}

              {editingTitle ? (
                <Input
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => void handleTitleBlur()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleTitleBlur();
                    if (e.key === "Escape") {
                      setTitle(effectiveTask?.title ?? "");
                      setEditingTitle(false);
                    }
                  }}
                  className={`
                    mb-1 h-auto border-none px-0 text-xl font-semibold
                    shadow-none
                    focus-visible:ring-0
                  `}
                />
              ) : (
                <h2
                  className={`
                    hover:text-primary
                    mb-1 cursor-pointer text-xl font-semibold tracking-tight
                    transition-colors
                  `}
                  onClick={() => setEditingTitle(true)}
                >
                  {effectiveTask?.title}
                </h2>
              )}

              <div className="mt-5">
                <h3
                  className={`
                    text-muted-foreground mb-2 text-[11px] font-bold
                    tracking-wider uppercase
                  `}
                >
                  Description
                </h3>
                {editingDesc ? (
                  <div className="flex flex-col gap-2">
                    <RichTextEditor
                      value={description}
                      onChange={setDescription}
                      placeholder="Add a description…"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void handleDescSave()}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDescription(effectiveTask?.description ?? "");
                          setEditingDesc(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`
                      hover:border-border hover:bg-muted/40
                      min-h-[56px] cursor-pointer rounded-lg border
                      border-transparent px-2 py-2 text-[13px] transition-colors
                    `}
                    onClick={() => setEditingDesc(true)}
                  >
                    {effectiveTask?.description ? (
                      <RichTextViewer html={effectiveTask.description} />
                    ) : (
                      <p className="text-muted-foreground italic">
                        Add a description…
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ─── Multi-assign ─────────────────────────── */}
              {effectiveTask && (
                <div className="mt-8">
                  <h3
                    className={`
                      text-muted-foreground mb-2 text-[11px] font-bold
                      tracking-wider uppercase
                    `}
                  >
                    Assignees
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(detail?.task.assignees ?? []).length === 0 ? (
                      <span className="text-muted-foreground text-[11px]">
                        No assignees
                      </span>
                    ) : (
                      (detail?.task.assignees ?? []).map((a) => (
                        <span
                          key={a.id}
                          className={`
                            bg-muted/60 inline-flex items-center gap-1.5
                            rounded-full px-2 py-0.5 text-[11px]
                          `}
                        >
                          <Avatar className="size-4">
                            <AvatarFallback className="text-[6px] font-bold">
                              {getInitials(a.user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{a.user.name}</span>
                          <button
                            type="button"
                            className={`
                              text-muted-foreground
                              hover:text-foreground
                            `}
                            onClick={() => void handleRemoveAssignee(a.userId)}
                            aria-label={`Remove ${a.user.name}`}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                  <Select
                    value={assigneeDraft}
                    onValueChange={(v) => {
                      setAssigneeDraft(v);
                      void handleAddAssignee(v);
                    }}
                  >
                    <SelectTrigger className="mt-2 h-9 text-xs">
                      <SelectValue placeholder="+ Add assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        // Assignees must be members of this project (set
                        // via "Manage Members"), so the picker lists the
                        // project-members pool. Dedup by id so a user
                        // doesn't show twice.
                        const pool = members.map((m) => ({
                          id: m.user.id,
                          name: m.user.name,
                        }));
                        const taken = new Set(
                          (detail?.task.assignees ?? []).map((a) => a.userId),
                        );
                        const seen = new Set<string>();
                        return pool
                          .filter((u) => {
                            if (taken.has(u.id) || seen.has(u.id)) return false;
                            seen.add(u.id);
                            return true;
                          })
                          .map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ));
                      })()}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* ─── Dependencies ────────────────────────── */}
              {effectiveTask && (
                <div className="mt-8">
                  <h3
                    className={`
                      text-muted-foreground mb-2 text-[11px] font-bold
                      tracking-wider uppercase
                    `}
                  >
                    Dependencies
                  </h3>
                  <div
                    className={`
                      grid grid-cols-1 gap-3
                      md:grid-cols-2
                    `}
                  >
                    <div>
                      <span className="text-muted-foreground text-[11px]">
                        Blocked by
                      </span>
                      <ul className="mt-1 space-y-1">
                        {(detail?.task.dependencies ?? []).length === 0 ? (
                          <li className="text-muted-foreground text-[11px]">
                            None
                          </li>
                        ) : (
                          (detail?.task.dependencies ?? []).map((d) => (
                            <li
                              key={d.id}
                              className={`
                                bg-muted/40 flex items-center gap-2 rounded-md
                                px-2 py-1 text-[12px]
                              `}
                            >
                              <span className="truncate">
                                {d.dependsOnTask?.title ?? d.dependsOnTaskId}
                              </span>
                              <Badge
                                status="neutral"
                                className={`
                                  ml-auto h-4 px-1 text-[9px] uppercase
                                `}
                              >
                                {d.dependsOnTask?.status.replace(/_/g, " ") ??
                                  "—"}
                              </Badge>
                              <button
                                type="button"
                                className={`
                                  text-muted-foreground
                                  hover:text-foreground
                                `}
                                onClick={() =>
                                  void handleRemoveDependency(d.id)
                                }
                                aria-label="Remove dependency"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[11px]">
                        Blocking
                      </span>
                      <ul className="mt-1 space-y-1">
                        {(detail?.task.dependents ?? []).length === 0 ? (
                          <li className="text-muted-foreground text-[11px]">
                            None
                          </li>
                        ) : (
                          (detail?.task.dependents ?? []).map((d) => (
                            <li
                              key={d.id}
                              className={`
                                bg-muted/40 flex items-center gap-2 rounded-md
                                px-2 py-1 text-[12px]
                              `}
                            >
                              <span className="truncate">
                                {d.task?.title ?? d.taskId}
                              </span>
                              <Badge
                                status="neutral"
                                className={`
                                  ml-auto h-4 px-1 text-[9px] uppercase
                                `}
                              >
                                {d.task?.status.replace(/_/g, " ") ?? "—"}
                              </Badge>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </div>
                  {allTasks && allTasks.length > 0 ? (
                    <Select
                      value={depDraft}
                      onValueChange={(v) => {
                        setDepDraft(v);
                        void handleAddDependency(v);
                      }}
                    >
                      <SelectTrigger className="mt-2 h-9 text-xs">
                        <SelectValue placeholder="+ Add blocked-by task" />
                      </SelectTrigger>
                      <SelectContent>
                        {allTasks
                          .filter(
                            (t) =>
                              t.id !== effectiveTask.id &&
                              !(detail?.task.dependencies ?? []).some(
                                (d) => d.dependsOnTaskId === t.id,
                              ),
                          )
                          .map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
              )}

              {/* ─── Resources ─────────────────────────────── */}
              {effectiveTask && (
                <div className="mt-8">
                  <h3
                    className={`
                      text-muted-foreground mb-2 text-[11px] font-bold
                      tracking-wider uppercase
                    `}
                  >
                    Resources
                  </h3>
                  <ul className="space-y-1">
                    {(detail?.task.resources ?? []).length === 0 ? (
                      <li className="text-muted-foreground text-[11px]">
                        No resources
                      </li>
                    ) : (
                      (detail?.task.resources ?? []).map((r) => (
                        <li
                          key={r.id}
                          className={`
                            bg-muted/40 flex items-center gap-2 rounded-md px-2
                            py-1 text-[12px]
                          `}
                        >
                          <Badge
                            status="neutral"
                            className="h-4 px-1 text-[9px] uppercase"
                          >
                            {r.kind}
                          </Badge>
                          <button
                            type="button"
                            onClick={() => void handleOpenResource(r)}
                            className={`
                              truncate text-blue-600
                              hover:underline
                            `}
                          >
                            {r.label}
                          </button>
                          <button
                            type="button"
                            className={`
                              text-muted-foreground ml-auto
                              hover:text-foreground
                            `}
                            onClick={() => void handleRemoveResource(r.id)}
                            aria-label="Remove resource"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                  {/* File upload trigger — sits above the link/doc form
                      so the more common case (drag a PDF in) is the
                      one-click path. */}
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleFilePicked(f);
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={uploadingResource}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadingResource ? (
                        <Spinner className="mr-1.5 size-3" />
                      ) : (
                        <Plus className="mr-1.5 size-3" />
                      )}
                      Upload file
                    </Button>
                    <span className="text-muted-foreground text-[11px]">
                      … or attach a link / doc below
                    </span>
                  </div>

                  {/* Four controls on one row needs ~400px. Inside a 293px
                      sheet the two text inputs were squeezed to about 50px
                      each — technically not overflowing, because `Input`
                      carries `min-w-0`, and entirely unusable. Stacked below
                      `sm`; the desktop row is untouched. */}
                  <div
                    className={`
                      mt-2 grid grid-cols-1 gap-2
                      sm:grid-cols-[120px_1fr_1fr_auto]
                    `}
                  >
                    <Select
                      value={resKind}
                      onValueChange={(v) =>
                        setResKind(v as "file" | "link" | "doc")
                      }
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="link">Link</SelectItem>
                        <SelectItem value="file">File</SelectItem>
                        <SelectItem value="doc">Doc</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={resLabel}
                      onChange={(e) => setResLabel(e.target.value)}
                      placeholder="Label"
                      className="h-9 text-base md:text-[13px]"
                    />
                    <Input
                      value={resUrl}
                      onChange={(e) => setResUrl(e.target.value)}
                      placeholder="URL"
                      className="h-9 text-base md:text-[13px]"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-9 shrink-0"
                      disabled={
                        addingResource || !resLabel.trim() || !resUrl.trim()
                      }
                      onClick={() => void handleAddResource()}
                    >
                      {addingResource ? (
                        <Spinner className="size-3.5" />
                      ) : (
                        <Plus className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {isRootTask && (
                <div className="mt-8">
                  <div className="mb-2 flex items-center justify-between">
                    <h3
                      className={`
                        text-muted-foreground text-[11px] font-bold
                        tracking-wider uppercase
                      `}
                    >
                      Subtasks
                    </h3>
                  </div>
                  <ul className="space-y-1">
                    {(detail?.subtasks ?? []).map((st) => {
                      const stCol = columns.find((c) => c.key === st.status);
                      return (
                        <li key={st.id}>
                          <button
                            type="button"
                            className={`
                              hover:bg-muted/60
                              flex w-full items-center gap-2 rounded-md px-2
                              py-1.5 text-left text-[13px] transition-colors
                            `}
                            onClick={() => onOpenSubtask?.(st)}
                          >
                            <span
                              className={cn(
                                "size-2 shrink-0 rounded-full",
                                stCol?.color ?? "bg-zinc-400",
                              )}
                            />
                            <span className="truncate font-medium">
                              {st.title}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={subtaskDraft}
                      onChange={(e) => setSubtaskDraft(e.target.value)}
                      placeholder="Add subtask…"
                      className="h-9 text-base md:text-[13px]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleAddSubtask();
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-9 shrink-0"
                      disabled={addingSubtask || !subtaskDraft.trim()}
                      onClick={() => void handleAddSubtask()}
                    >
                      {addingSubtask ? (
                        <Spinner className="size-3.5" />
                      ) : (
                        <Plus className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-10">
                <h3
                  className={`
                    text-muted-foreground mb-3 text-[11px] font-bold
                    tracking-wider uppercase
                  `}
                >
                  Activity
                </h3>
                <Tabs
                  value={activityTab}
                  onValueChange={(v) => setActivityTab(v as ActivityTab)}
                  orientation="horizontal"
                  className="gap-0"
                >
                  <TabsList
                    variant="line"
                    className={`
                      border-border mb-4 h-9 w-full justify-start gap-0
                      rounded-none border-b bg-transparent p-0
                    `}
                  >
                    <TabsTrigger value="all" className="rounded-none px-3">
                      All
                    </TabsTrigger>
                    <TabsTrigger value="comments" className="rounded-none px-3">
                      Comments
                    </TabsTrigger>
                    <TabsTrigger value="history" className="rounded-none px-3">
                      History
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="all" className="mt-0 space-y-0">
                    <div className="mb-4">
                      <Textarea
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        placeholder="Add a comment…"
                        rows={3}
                        className="resize-y text-base md:text-[13px]"
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="mt-2"
                        disabled={postingComment || !commentDraft.trim()}
                        onClick={() => void handlePostComment()}
                      >
                        {postingComment && (
                          <Spinner className="mr-1.5 inline size-3" />
                        )}
                        Comment
                      </Button>
                    </div>
                    <ul className="space-y-4">
                      {mergedFeed.map((item) =>
                        item.kind === "comment" ? (
                          <li
                            key={`c-${item.comment.id}`}
                            className="flex gap-3"
                          >
                            <Avatar className="size-8 shrink-0 rounded-md">
                              <AvatarFallback className="rounded-md text-[10px]">
                                {getInitials(item.comment.author.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div
                                className={`flex flex-wrap items-baseline gap-2`}
                              >
                                <span className="text-[13px] font-semibold">
                                  {item.comment.author.name}
                                </span>
                                <span
                                  className={`text-muted-foreground text-[11px]`}
                                >
                                  {formatDateLong(item.comment.createdAt)}
                                </span>
                                <Badge
                                  status="neutral"
                                  className="h-5 px-1 text-[9px] uppercase"
                                >
                                  Comment
                                </Badge>
                              </div>
                              <p
                                className={`
                                  text-foreground mt-1 text-[13px]
                                  leading-relaxed whitespace-pre-wrap
                                `}
                              >
                                {item.comment.body}
                              </p>
                            </div>
                          </li>
                        ) : (
                          <li
                            key={`a-${item.activity.id}`}
                            className="flex gap-3"
                          >
                            <Avatar className="size-8 shrink-0 rounded-md">
                              <AvatarFallback className="rounded-md text-[10px]">
                                {getInitials(item.activity.actor.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div
                                className={`flex flex-wrap items-baseline gap-2`}
                              >
                                <span className="text-[13px] font-semibold">
                                  {item.activity.actor.name}
                                </span>
                                <span
                                  className={`text-muted-foreground text-[11px]`}
                                >
                                  {formatDateLong(item.activity.createdAt)}
                                </span>
                                <Badge
                                  status="in_progress"
                                  className="h-5 px-1 text-[9px] uppercase"
                                >
                                  History
                                </Badge>
                              </div>
                              <p
                                className={`
                                  text-muted-foreground mt-0.5 text-[12px]
                                `}
                              >
                                {historySummary(item.activity)}
                              </p>
                              {renderHistoryBody(item.activity)}
                            </div>
                          </li>
                        ),
                      )}
                    </ul>
                    {mergedFeed.length === 0 && (
                      <p
                        className={`
                          text-muted-foreground py-6 text-center text-[13px]
                        `}
                      >
                        No activity yet.
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="comments" className="mt-0">
                    <div className="mb-4">
                      <Textarea
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        placeholder="Add a comment…"
                        rows={3}
                        className="resize-y text-base md:text-[13px]"
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="mt-2"
                        disabled={postingComment || !commentDraft.trim()}
                        onClick={() => void handlePostComment()}
                      >
                        {postingComment && (
                          <Spinner className="mr-1.5 inline size-3" />
                        )}
                        Comment
                      </Button>
                    </div>
                    <ul className="space-y-4">
                      {(detail?.comments ?? []).map((c) => (
                        <li key={c.id} className="flex gap-3">
                          <Avatar className="size-8 shrink-0 rounded-md">
                            <AvatarFallback className="rounded-md text-[10px]">
                              {getInitials(c.author.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-2">
                              <span className="text-[13px] font-semibold">
                                {c.author.name}
                              </span>
                              <span
                                className={`text-muted-foreground text-[11px]`}
                              >
                                {formatDateLong(c.createdAt)}
                              </span>
                            </div>
                            <p
                              className={`
                                text-foreground mt-1 text-[13px] leading-relaxed
                                whitespace-pre-wrap
                              `}
                            >
                              {c.body}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {(detail?.comments ?? []).length === 0 && (
                      <p
                        className={`
                          text-muted-foreground py-6 text-center text-[13px]
                        `}
                      >
                        No comments yet.
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="history" className="mt-0">
                    <ul className="space-y-4">
                      {(detail?.activities ?? []).map((a) => (
                        <li key={a.id} className="flex gap-3">
                          <Avatar className="size-8 shrink-0 rounded-md">
                            <AvatarFallback className="rounded-md text-[10px]">
                              {getInitials(a.actor.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-2">
                              <span className="text-[13px] font-semibold">
                                {a.actor.name}
                              </span>
                              <span
                                className={`text-muted-foreground text-[11px]`}
                              >
                                {formatDateLong(a.createdAt)}
                              </span>
                            </div>
                            <p
                              className={`
                                text-muted-foreground mt-0.5 text-[12px]
                              `}
                            >
                              {historySummary(a)}
                            </p>
                            {renderHistoryBody(a)}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {(detail?.activities ?? []).length === 0 && (
                      <p
                        className={`
                          text-muted-foreground py-6 text-center text-[13px]
                        `}
                      >
                        No history yet.
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* Sidebar — status + details */}
            <aside
              className={`
                border-border bg-muted/10 flex w-full shrink-0 flex-col border-t
                px-4 py-4
                md:w-[300px] md:border-t-0 md:border-l
              `}
            >
              <div className="mb-4">
                <Label
                  className={`
                    text-muted-foreground mb-1.5 block text-[10px] font-bold
                    tracking-wider uppercase
                  `}
                >
                  Status
                </Label>
                {effectiveTask && (
                  <Select
                    value={effectiveTask.status}
                    onValueChange={(v) => void saveField("status", v)}
                  >
                    <SelectTrigger className="h-10 w-full font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {effectiveTask &&
                        !columns.some(
                          (c) => c.key === effectiveTask.status,
                        ) && (
                          <SelectItem value={effectiveTask.status}>
                            <span className="text-muted-foreground text-xs">
                              {effectiveTask.status} (legacy)
                            </span>
                          </SelectItem>
                        )}
                      {columns.map((col) => (
                        <SelectItem key={col.key} value={col.key}>
                          <div className="flex items-center gap-2">
                            <div
                              className={cn("size-2 rounded-full", col.color)}
                            />
                            {col.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <h3
                  className={`
                    text-muted-foreground mb-3 text-[10px] font-bold
                    tracking-wider uppercase
                  `}
                >
                  Details
                </h3>
                <div className="flex flex-col gap-3.5">
                  <div className="grid grid-cols-[88px_1fr] items-center gap-2">
                    <span className="text-muted-foreground text-[11px]">
                      Priority
                    </span>
                    {effectiveTask && (
                      <Select
                        value={normalizeProjectTaskPriority(
                          effectiveTask.priority,
                        )}
                        onValueChange={(v) => void saveField("priority", v)}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROJECT_TASK_PRIORITY_OPTIONS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              <span className={cn(PRIORITY_COLORS[p.value])}>
                                {p.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="grid grid-cols-[88px_1fr] items-center gap-2">
                    <span className="text-muted-foreground text-[11px]">
                      Assignee
                    </span>
                    {effectiveTask && (
                      <Select
                        value={getAssigneeId(effectiveTask) ?? "unassigned"}
                        onValueChange={(v) =>
                          void saveField(
                            "ownerId",
                            v === "unassigned" ? undefined : v,
                          )
                        }
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">
                            <span
                              className={`
                                text-muted-foreground flex items-center gap-1.5
                              `}
                            >
                              <User className="size-3.5" />
                              Unassigned
                            </span>
                          </SelectItem>
                          {assigneePool.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              <div className="flex items-center gap-2">
                                <Avatar className="size-4">
                                  <AvatarFallback
                                    className={`text-[6px] font-bold`}
                                  >
                                    {getInitials(u.name)}
                                  </AvatarFallback>
                                </Avatar>
                                {u.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="grid grid-cols-[88px_1fr] items-center gap-2">
                    <span className="text-muted-foreground text-[11px]">
                      Start date
                    </span>
                    {effectiveTask && (
                      <FormDatePicker
                        value={effectiveTask.startDate ?? ""}
                        onChange={(v) => void saveField("startDate", v || null)}
                        placeholder="None"
                        className="h-9 text-xs"
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-[88px_1fr] items-center gap-2">
                    <span className="text-muted-foreground text-[11px]">
                      End date
                    </span>
                    {effectiveTask && (
                      <FormDatePicker
                        value={effectiveTask.endDate ?? ""}
                        onChange={(v) => void saveField("endDate", v || null)}
                        placeholder="None"
                        className="h-9 text-xs"
                      />
                    )}
                  </div>

                  {milestones && milestones.length > 0 && effectiveTask ? (
                    <div
                      className={`grid grid-cols-[88px_1fr] items-center gap-2`}
                    >
                      <span className="text-muted-foreground text-[11px]">
                        Milestone
                      </span>
                      <Select
                        value={effectiveTask.milestoneId ?? "none"}
                        onValueChange={(v) =>
                          void saveField(
                            "milestoneId",
                            v === "none" ? undefined : v,
                          )
                        }
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {milestones.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
              </div>

              {effectiveTask && (
                <div className="border-border mt-auto border-t pt-4">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={`
                        text-destructive border-destructive/40 h-8 px-3 text-xs
                        hover:bg-destructive/10 hover:text-destructive
                      `}
                      onClick={() => setDeleteConfirmOpen(true)}
                      disabled={deleting}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </div>
                  <div
                    className={`
                      text-muted-foreground mt-3 space-y-1 text-[10px]
                    `}
                  >
                    <p>Created {formatDateLong(effectiveTask.createdAt)}</p>
                    {effectiveTask.updatedAt && (
                      <p>Updated {formatDateLong(effectiveTask.updatedAt)}</p>
                    )}
                  </div>
                </div>
              )}

              {saving && (
                <p
                  className={`
                    text-muted-foreground mt-3 flex items-center gap-1
                    text-[10px]
                  `}
                >
                  <Spinner className="size-3" />
                  Saving…
                </p>
              )}
            </aside>
          </div>
        )}
      </SheetContent>
      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={(o) => !o && setDeleteConfirmOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              {effectiveTask?.title ? (
                <>
                  <span className="font-medium">{effectiveTask.title}</span> and
                  any subtasks, comments, dependencies, and resources will be
                  removed. This cannot be undone.
                </>
              ) : (
                "This task and any subtasks, comments, dependencies, and resources will be removed. This cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteTask();
              }}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
