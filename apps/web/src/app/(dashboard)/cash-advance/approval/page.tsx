"use client";

import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { CashAdvanceApprovalStepDialog } from "@/components/cash-advance/cash-advance-approval-step-dialog";
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
import { Input } from "@/components/ui/input";
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
  CASH_ADVANCE_PAYOUT_LABELS,
  type CashAdvanceApprovalStep,
  deleteCashAdvanceStep,
  getCashAdvanceRecipients,
  listCashAdvanceSteps,
  reorderCashAdvanceSteps,
  setCashAdvanceRecipients,
} from "@/services/cash-advance.service";
import { listUsers, type UserListItem } from "@/services/user.service";

function conditionSummary(s: CashAdvanceApprovalStep): string {
  const parts: string[] = [];
  if (s.amountMin != null || s.amountMax != null) {
    const min = s.amountMin != null ? s.amountMin.toLocaleString() : "0";
    const max = s.amountMax != null ? s.amountMax.toLocaleString() : "∞";
    parts.push(`amount ${min}–${max}`);
  }
  if (s.payoutModeFilter.length > 0) {
    parts.push(
      s.payoutModeFilter.map((m) => CASH_ADVANCE_PAYOUT_LABELS[m]).join(" / "),
    );
  }
  if (s.onlyWhenSubmitterIds.length > 0) {
    parts.push(`only ${s.onlyWhenSubmitterIds.length} submitter(s)`);
  }
  if (s.skipWhenSubmitterIds.length > 0) {
    parts.push(`skip ${s.skipWhenSubmitterIds.length} submitter(s)`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Always";
}

export default function CashAdvanceApprovalConfigPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("cash-advance:approve");

  const [steps, setSteps] = useState<CashAdvanceApprovalStep[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CashAdvanceApprovalStep | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<CashAdvanceApprovalStep | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [savingRecipients, setSavingRecipients] = useState(false);

  const loadRecipients = useCallback(async () => {
    try {
      const res = await getCashAdvanceRecipients();
      setRecipients(res.data.emails);
    } catch {
      // non-critical
    }
  }, []);

  async function persistRecipients(next: string[]) {
    try {
      setSavingRecipients(true);
      const res = await setCashAdvanceRecipients(next);
      setRecipients(res.data.emails);
      toast.success("Notification recipients updated");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to update recipients",
      );
    } finally {
      setSavingRecipients(false);
    }
  }

  function addRecipient() {
    const email = recipientInput.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email");
      return;
    }
    if (recipients.includes(email)) {
      setRecipientInput("");
      return;
    }
    setRecipientInput("");
    void persistRecipients([...recipients, email]);
  }

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [stepsRes, usersRes] = await Promise.all([
        listCashAdvanceSteps(),
        listUsers({ limit: 200 }),
      ]);
      setSteps(stepsRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load approval chain",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) {
      void load();
      void loadRecipients();
    }
  }, [canManage, load, loadRecipients]);

  async function move(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= steps.length) return;
    const reordered = [...steps];
    const [item] = reordered.splice(idx, 1);
    reordered.splice(next, 0, item!);
    setSteps(reordered);
    try {
      setReordering(true);
      const res = await reorderCashAdvanceSteps(reordered.map((s) => s.id));
      setSteps(res.data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to reorder");
      void load();
    } finally {
      setReordering(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      setDeleting(true);
      await deleteCashAdvanceStep(pendingDelete.id);
      toast.success(`Step "${pendingDelete.name}" deleted`);
      setPendingDelete(null);
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete step",
      );
    } finally {
      setDeleting(false);
    }
  }

  if (!canManage) {
    return (
      <div className="px-6 py-10">
        <PageHeader
          title="Cash Advance Approval"
          subtitle="You do not have permission to configure cash-advance approvals."
        />
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Cash Advance Approval Chain"
        subtitle="Define the ordered stages every cash-advance request passes through. Each step can carry conditions (amount band, payout mode, submitter)."
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

      {steps.length === 0 && !loading ? (
        <div className="bg-card rounded-md border p-8 text-center">
          <p className="text-muted-foreground text-sm">
            No approval steps configured. New requests fall back to the
            submitter&apos;s direct manager.
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
                <TableHead>Conditions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[160px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
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
                    <TableCell className="text-muted-foreground text-xs">
                      {conditionSummary(s)}
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

      <div className="bg-card mt-6 rounded-md border p-5">
        <div className="mb-3 flex items-start gap-2">
          <Mail className="text-muted-foreground mt-0.5 h-4 w-4" />
          <div>
            <h3 className="text-foreground text-sm font-semibold">
              HR / Finance notifications
            </h3>
            <p className="text-muted-foreground text-xs">
              These addresses receive a summary email (with payout / bank
              detail) every time a cash advance is fully approved — so HR /
              Finance can action the disbursement.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pb-3">
          {recipients.length === 0 ? (
            <span className="text-muted-foreground text-xs">
              No recipients yet — the summary email is skipped until at least
              one is added.
            </span>
          ) : (
            recipients.map((email) => (
              <span
                key={email}
                className={`
                  bg-muted text-foreground inline-flex items-center gap-1.5
                  rounded-full border px-2.5 py-1 text-xs
                `}
              >
                {email}
                <button
                  type="button"
                  aria-label={`Remove ${email}`}
                  className={`
                    text-muted-foreground rounded p-0.5
                    hover:text-foreground hover:bg-foreground/10
                  `}
                  onClick={() =>
                    void persistRecipients(
                      recipients.filter((r) => r !== email),
                    )
                  }
                  disabled={savingRecipients}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="finance@thebinaryholdings.com"
            value={recipientInput}
            onChange={(e) => setRecipientInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRecipient();
              }
            }}
            disabled={savingRecipients}
          />
          <Button onClick={addRecipient} disabled={savingRecipients}>
            {savingRecipients ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : null}
            Add
          </Button>
        </div>
      </div>

      <CashAdvanceApprovalStepDialog
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
