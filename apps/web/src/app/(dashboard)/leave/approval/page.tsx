"use client";

import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { LeaveApprovalStepDialog } from "@/components/leave/leave-approval-step-dialog";
import { NotificationRecipientsCard } from "@/components/shared/notification-recipients-card";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  deleteLeaveApprovalStep,
  getLeaveNotificationRecipients,
  type LeaveApprovalStep,
  listLeaveApprovalSteps,
  reorderLeaveApprovalSteps,
  setLeaveNotificationRecipients,
} from "@/services/leave.service";
import { listUsers, type UserListItem } from "@/services/user.service";

export default function LeaveApprovalConfigPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("leave:assign-approver");
  const canEditSettings = hasPermission("leave:hr-settings");

  const [steps, setSteps] = useState<LeaveApprovalStep[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveApprovalStep | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LeaveApprovalStep | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [stepsRes, usersRes] = await Promise.all([
        listLeaveApprovalSteps(),
        listUsers({ limit: 200 }),
      ]);
      setSteps(stepsRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load approval chain";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  const fetchLeaveRecipients = useCallback(async () => {
    const res = await getLeaveNotificationRecipients();
    return res.data;
  }, []);

  const saveLeaveRecipients = useCallback(async (emails: string[]) => {
    const res = await setLeaveNotificationRecipients(emails);
    return res.data;
  }, []);

  async function move(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= steps.length) return;
    const reordered = [...steps];
    const [item] = reordered.splice(idx, 1);
    reordered.splice(next, 0, item!);
    setSteps(reordered);
    try {
      setReordering(true);
      const res = await reorderLeaveApprovalSteps(reordered.map((s) => s.id));
      setSteps(res.data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to reorder";
      toast.error(message);
      void load();
    } finally {
      setReordering(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      setDeleting(true);
      await deleteLeaveApprovalStep(pendingDelete.id);
      toast.success(`Step "${pendingDelete.name}" deleted`);
      setPendingDelete(null);
      await load();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete step";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  if (!canManage) {
    return (
      <div className="px-6 py-10">
        <PageHeader
          title="Leave Approval"
          subtitle="You do not have permission to configure leave approvals."
        />
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Leave Approval Chain"
        subtitle="Define the ordered stages every leave request must pass through."
      >
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add step
        </Button>
      </PageHeader>

      <div
        className={`
          bg-muted/40 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1
          rounded-md border p-3 text-xs
        `}
      >
        <Badge variant="secondary">Default chain</Badge>
        <span className="text-muted-foreground">
          Applies to leave types that don&apos;t define their own chain. A leave
          policy with its own approval chain overrides this for that type.
        </span>
        <Link
          href="/leave/policies"
          className="ml-auto underline underline-offset-2"
        >
          Manage per-policy overrides →
        </Link>
      </div>

      {steps.length === 0 && !loading ? (
        <div className="bg-card rounded-md border p-8 text-center">
          <p className="text-muted-foreground text-sm">
            No default approval steps configured. Requests fall back to a leave
            type&apos;s own chain (if set), otherwise the submitter&apos;s
            direct manager.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Order</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Approver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[160px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center">
                    <Loader2
                      className={`
                        text-muted-foreground mx-auto h-5 w-5 animate-spin
                      `}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                steps.map((s, idx) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm">
                      {s.order}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{s.name}</div>
                      {s.description && (
                        <div
                          className={`
                            text-muted-foreground mt-0.5 max-w-md text-xs
                          `}
                        >
                          {s.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.approverType === "manager" ? (
                        <span>Submitter&apos;s manager</span>
                      ) : s.approverUser ? (
                        <span>
                          {s.approverUser.name}
                          <span className="text-muted-foreground ml-2 text-xs">
                            {s.approverUser.email}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">
                          User removed
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.isActive ? (
                        <Badge>Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={idx === 0 || reordering}
                          onClick={() => move(idx, -1)}
                          aria-label="Move up"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={idx === steps.length - 1 || reordering}
                          onClick={() => move(idx, 1)}
                          aria-label="Move down"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditing(s);
                            setDialogOpen(true);
                          }}
                          aria-label={`Edit ${s.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setPendingDelete(s)}
                          aria-label={`Delete ${s.name}`}
                        >
                          <Trash2 className="text-destructive h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {canEditSettings && (
        <NotificationRecipientsCard
          title="HR-desk notifications"
          description="These addresses receive a long-form summary email every time a leave request is fully approved. Use it to route the brief to HR / the people-ops admin."
          placeholder="hr-desk@manut.xyz"
          fetcher={fetchLeaveRecipients}
          persister={saveLeaveRecipients}
        />
      )}

      <LeaveApprovalStepDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        step={editing}
        users={users}
        onSaved={load}
      />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete approval step?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete &&
                `"${pendingDelete.name}" will be removed from the chain. In-flight requests already routed through this stage are unaffected.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
