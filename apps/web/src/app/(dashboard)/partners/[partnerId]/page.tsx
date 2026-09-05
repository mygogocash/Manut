"use client";

import { ArrowLeft, Loader2, Plus, Users } from "lucide-react";
import { useParams } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  PartnerBoard,
  type PartnerTaskMoveUpdate,
} from "@/components/partners/partner-board";
import { PartnerMembersDialog } from "@/components/partners/partner-members-dialog";
import { PartnerTaskDetailSheet } from "@/components/partners/partner-task-detail-sheet";
import { PartnerTaskDialog } from "@/components/partners/partner-task-dialog";
import { PageHeader } from "@/components/shared/page-header";
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
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  type AssignableUser,
  listAssignableUsers,
} from "@/services/directory.service";
import {
  deletePartnerTask,
  getPartnerBoard,
  type PartnerBoard as PartnerBoardData,
  type PartnerMember,
  type PartnerTask,
  updatePartnerTask,
} from "@/services/partner-workspace.service";

// Phase 3 of the Partner ↔ Project decouple. Replaces the
// redirect-shim that bounced every Partner detail click into
// `/projects/<primaryProjectId>`. Now renders a native board view
// backed by the Phase 2 endpoints (#605).
export default function PartnerDetailPage() {
  const params = useParams<{ partnerId: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const partnerId =
    typeof params?.partnerId === "string" ? params.partnerId : "";

  const canEdit = hasPermission("partners:update");

  const [board, setBoard] = useState<PartnerBoardData | null>(null);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PartnerTask | null>(null);
  const [defaultColumnKey, setDefaultColumnKey] = useState<string | undefined>(
    undefined,
  );

  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState<PartnerTask | null>(null);

  const [membersDialogOpen, setMembersDialogOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PartnerTask | null>(null);
  const [deletingTask, setDeletingTask] = useState(false);

  const fetchBoard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getPartnerBoard(partnerId);
      setBoard(res.data);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load partner workspace";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    void fetchBoard();
  }, [fetchBoard]);

  useEffect(() => {
    const slug = board?.partner.slug;
    if (!slug || partnerId === slug) return;
    router.replace(`/partners/${slug}`, { scroll: false });
  }, [board?.partner.slug, partnerId, router]);

  useEffect(() => {
    let cancelled = false;
    void listAssignableUsers({ page: 1, limit: 500 })
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

  function handleAddTask(columnKey: string) {
    setEditingTask(null);
    setDefaultColumnKey(columnKey);
    setTaskDialogOpen(true);
  }

  function handleEditTask(task: PartnerTask) {
    setEditingTask(task);
    setDefaultColumnKey(undefined);
    setTaskDialogOpen(true);
  }

  function handleViewTask(task: PartnerTask) {
    setViewingTask(task);
    setDetailSheetOpen(true);
  }

  function handleEditFromSheet(task: PartnerTask) {
    setDetailSheetOpen(false);
    handleEditTask(task);
  }

  async function handleMoveTasks(updates: PartnerTaskMoveUpdate[]) {
    if (!board || updates.length === 0) return;
    // Snapshot for rollback. The board emits a batch per drop, so a
    // single failure reverts the whole move rather than leaving the
    // affected columns half-renumbered.
    const previousTasks = board.tasks;
    const updateMap = new Map(updates.map((u) => [u.taskId, u]));
    setBoard((prev) => {
      if (!prev) return prev;
      const tasks = prev.tasks.map((t) => {
        const u = updateMap.get(t.id);
        return u ? { ...t, status: u.status, sortOrder: u.sortOrder } : t;
      });
      return { ...prev, tasks };
    });
    // Keep the open detail sheet's task in sync if it was moved.
    setViewingTask((prev) => {
      if (!prev) return prev;
      const u = updateMap.get(prev.id);
      return u ? { ...prev, status: u.status, sortOrder: u.sortOrder } : prev;
    });
    try {
      // No bulk-reorder endpoint on partner tasks yet — fan out one
      // PUT per changed row. Columns rarely hold more than a handful
      // of tasks so the chatter is acceptable; revisit if the board
      // grows into hundreds of rows per column.
      await Promise.all(
        updates.map((u) =>
          updatePartnerTask(partnerId, u.taskId, {
            status: u.status,
            sortOrder: u.sortOrder,
          }),
        ),
      );
    } catch (err) {
      setBoard((prev) => (prev ? { ...prev, tasks: previousTasks } : prev));
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to move task";
      toast.error(msg);
    }
  }

  function handleTaskSaved(saved: PartnerTask) {
    setTaskDialogOpen(false);
    setEditingTask(null);
    // Keep the detail sheet in sync if it's showing the saved task.
    setViewingTask((prev) => (prev?.id === saved.id ? saved : prev));
    setBoard((prev) => {
      if (!prev) return prev;
      const idx = prev.tasks.findIndex((t) => t.id === saved.id);
      const tasks =
        idx >= 0
          ? prev.tasks.map((t) => (t.id === saved.id ? saved : t))
          : [...prev.tasks, saved];
      return { ...prev, tasks };
    });
  }

  function handleMembersSaved(members: PartnerMember[]) {
    setMembersDialogOpen(false);
    setBoard((prev) => (prev ? { ...prev, members } : prev));
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    const deletedId = deleteTarget.id;
    const previousTasks = board?.tasks;
    setDeleteTarget(null);
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.filter(
          (t) => t.id !== deletedId && t.parentTaskId !== deletedId,
        ),
      };
    });
    try {
      setDeletingTask(true);
      await deletePartnerTask(partnerId, deletedId);
      toast.success("Task deleted");
    } catch (err) {
      if (previousTasks) {
        setBoard((prev) => (prev ? { ...prev, tasks: previousTasks } : prev));
      }
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete task";
      toast.error(msg);
    } finally {
      setDeletingTask(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-96 flex-col items-center justify-center gap-3">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
        <p className="text-muted-foreground text-sm">Loading workspace…</p>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="flex min-h-96 flex-col items-center justify-center gap-4">
        <p className="text-foreground text-base font-medium">
          {error ?? "Partner workspace not found"}
        </p>
        <p className="text-muted-foreground max-w-md text-center text-sm">
          The partner may have been removed, or you may not have permission to
          view its workspace.
        </p>
        <Button variant="outline" onClick={() => router.push("/partners")}>
          <ArrowLeft className="mr-2 size-4" /> Back to Marketing CRM
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <PageHeader title={board.partner.company} subtitle="Partner workspace">
        <Button variant="ghost" onClick={() => router.push("/partners")}>
          <ArrowLeft className="size-3.5" /> Back
        </Button>
        {canEdit ? (
          <Button variant="outline" onClick={() => setMembersDialogOpen(true)}>
            <Users className="size-3.5" />
            Manage Members
            <span
              className={`text-muted-foreground ml-1 text-[11px] tabular-nums`}
            >
              {board.members.length}
            </span>
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            onClick={() => handleAddTask(board.columns[0]?.key ?? "todo")}
          >
            <Plus className="size-3.5" /> Add Task
          </Button>
        ) : null}
      </PageHeader>

      <div className="min-h-0 flex-1">
        <PartnerBoard
          columns={board.columns}
          tasks={board.tasks}
          canEdit={canEdit}
          onAddTask={handleAddTask}
          onViewTask={handleViewTask}
          onEditTask={handleEditTask}
          onDeleteTask={(task) => setDeleteTarget(task)}
          onMoveTasks={canEdit ? handleMoveTasks : () => {}}
        />
      </div>

      <PartnerTaskDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        task={viewingTask}
        subtasks={
          viewingTask
            ? board.tasks.filter((t) => t.parentTaskId === viewingTask.id)
            : []
        }
        columns={board.columns}
        partnerName={board.partner.company}
        canEdit={canEdit}
        onEdit={handleEditFromSheet}
      />

      <PartnerTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        partnerId={partnerId}
        columns={board.columns}
        users={users}
        task={editingTask}
        defaultColumnKey={defaultColumnKey}
        onSaved={handleTaskSaved}
      />

      <PartnerMembersDialog
        open={membersDialogOpen}
        onOpenChange={setMembersDialogOpen}
        partnerId={partnerId}
        users={users}
        currentMembers={board.members}
        onSaved={handleMembersSaved}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete &quot;{deleteTarget?.title}&quot;? This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingTask}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteConfirmed}
              disabled={deletingTask}
            >
              {deletingTask ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
