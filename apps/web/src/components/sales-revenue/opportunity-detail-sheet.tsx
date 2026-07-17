"use client";

import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AccountDetailsSection } from "@/components/sales-revenue/account-details-section";
import { Badge } from "@/components/shared/badge";
import { PermissionButton } from "@/components/shared/permission-button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  labelForLostReasonCode,
  useLostReasons,
} from "@/hooks/use-revenue-lost-reasons";
import { ApiError } from "@/lib/api-client";
import { type Account, getAccount } from "@/services/revenue-account.service";
import {
  ACTIVITY_TYPE_LABELS,
  type ActivityType,
  type CrmActivity,
  listCrmActivities,
} from "@/services/revenue-activity.service";
import {
  closeOpportunityAsLost,
  deleteOpportunity,
  getOpportunity,
  type Opportunity,
  OPPORTUNITY_STAGE_LABELS,
  type OpportunityStage,
  REOPEN_STAGES,
  reopenOpportunity,
} from "@/services/revenue-opportunity.service";
import {
  type CrmTask,
  listCrmTasks,
  TASK_STATUS_LABELS,
  type TaskStatus,
} from "@/services/revenue-task.service";

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div
      className={`
        border-border/60 flex items-start justify-between gap-3 border-b py-2
        last:border-b-0
      `}
    >
      <span
        className={`
          text-muted-foreground text-[11px] font-medium tracking-wide uppercase
        `}
      >
        {label}
      </span>
      <span className="text-foreground text-right text-sm">{value}</span>
    </div>
  );
}

interface OpportunityDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string | null;
  onEdit?: (opportunity: Opportunity) => void;
  // Fired after a successful close-lost or reopen so the parent (kanban /
  // sales page) can refetch totals and stage columns. Detail sheet
  // handles both dialogs internally to keep call sites simple.
  onClosedLost?: (opportunity: Opportunity) => void;
  onReopened?: (opportunity: Opportunity) => void;
  // Let owners purge a stale card from
  // any stage. Sheet closes itself; parent refetches the pipeline.
  onDeleted?: (opportunityId: string) => void;
}

export function OpportunityDetailSheet({
  open,
  onOpenChange,
  opportunityId,
  onEdit,
  onClosedLost,
  onReopened,
  onDeleted,
}: OpportunityDetailSheetProps) {
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenStage, setReopenStage] =
    useState<(typeof REOPEN_STAGES)[number]>("qualified");
  const [reopenLoading, setReopenLoading] = useState(false);
  // Close-lost dialog with lookup-table reason picker.
  const [closeLostOpen, setCloseLostOpen] = useState(false);
  const [closeLostReason, setCloseLostReason] = useState("");
  const [closeLostLoading, setCloseLostLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { reasons: lostReasons } = useLostReasons();

  const fetchData = useCallback(async () => {
    if (!opportunityId) return;
    try {
      setLoading(true);
      // Opportunity first so we know its accountId; then fan out for
      // the account record + activity / task lists in parallel.
      const oppRes = await getOpportunity(opportunityId);
      setOpportunity(oppRes.data);
      const accountId = oppRes.data.accountId;
      const [accountRes, actsRes, tasksRes] = await Promise.all([
        getAccount(accountId).catch(() => null),
        listCrmActivities({ opportunityId, limit: 50 }).catch(() => ({
          data: [] as CrmActivity[],
          meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
        })),
        listCrmTasks({ opportunityId, limit: 50 }).catch(() => ({
          data: [] as CrmTask[],
          meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
        })),
      ]);
      setAccount(accountRes ? accountRes.data : null);
      setActivities(actsRes.data);
      setTasks(tasksRes.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load opportunity";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    if (!open || !opportunityId) return;
    fetchData();
  }, [open, opportunityId, fetchData]);

  useEffect(() => {
    if (!open) {
      setOpportunity(null);
      setAccount(null);
      setActivities([]);
      setTasks([]);
      setReopenOpen(false);
      setReopenStage("qualified");
      setCloseLostOpen(false);
      setCloseLostReason("");
      setDeleteOpen(false);
    }
  }, [open]);

  const isTerminal =
    opportunity?.stage === "closed_won" || opportunity?.stage === "closed_lost";

  async function handleCloseLost() {
    if (!opportunity) return;
    try {
      setCloseLostLoading(true);
      const res = await closeOpportunityAsLost(opportunity.id, {
        // Send the code; server stores it on Opportunity.lostReason. Empty
        // selection submits no reason — server accepts that.
        lostReason: closeLostReason || undefined,
      });
      setOpportunity(res.data);
      setCloseLostOpen(false);
      toast.success("Marked as closed lost");
      onClosedLost?.(res.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to close as lost";
      toast.error(message);
    } finally {
      setCloseLostLoading(false);
    }
  }

  async function handleReopen() {
    if (!opportunity) return;
    try {
      setReopenLoading(true);
      const res = await reopenOpportunity(opportunity.id, {
        stage: reopenStage,
      });
      setOpportunity(res.data);
      setReopenOpen(false);
      toast.success(
        `Reopened — moved to ${OPPORTUNITY_STAGE_LABELS[reopenStage]}`,
      );
      onReopened?.(res.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to reopen opportunity";
      toast.error(message);
    } finally {
      setReopenLoading(false);
    }
  }

  async function handleDelete() {
    if (!opportunity) return;
    const id = opportunity.id;
    try {
      setDeleteLoading(true);
      await deleteOpportunity(id);
      toast.success("Opportunity deleted");
      setDeleteOpen(false);
      onDeleted?.(id);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete opportunity";
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={`
          flex w-full flex-col gap-0
          sm:max-w-xl
        `}
      >
        <SheetHeader className="border-border border-b">
          <SheetTitle>
            {opportunity
              ? opportunity.name
              : loading
                ? "Loading…"
                : "Opportunity"}
          </SheetTitle>
          <SheetDescription>
            {opportunity?.account?.name ?? "Opportunity detail"}
          </SheetDescription>
        </SheetHeader>

        {loading && !opportunity ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : opportunity ? (
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
            <section className="flex flex-col">
              <p
                className={`
                  text-muted-foreground mb-2 text-[10px] font-bold
                  tracking-widest uppercase
                `}
              >
                Identity
              </p>
              <DetailRow
                label="Stage"
                value={
                  <Badge status={opportunity.stage}>
                    {OPPORTUNITY_STAGE_LABELS[
                      opportunity.stage as OpportunityStage
                    ] ?? opportunity.stage}
                  </Badge>
                }
              />
              <DetailRow
                label="Value"
                value={
                  <span className="tabular-nums">
                    {formatCurrency(
                      Number(opportunity.value),
                      opportunity.currency,
                    )}
                  </span>
                }
              />
              <DetailRow
                label="Probability"
                value={
                  <span className="tabular-nums">
                    {opportunity.probability}%
                    {opportunity.probabilityCustom ? (
                      <span className="text-muted-foreground ml-1 text-[11px]">
                        (rep-set)
                      </span>
                    ) : null}
                  </span>
                }
              />
              <DetailRow
                label="Contact"
                value={
                  opportunity.contact
                    ? `${opportunity.contact.firstName} ${opportunity.contact.lastName}`
                    : null
                }
              />
              <DetailRow label="Type" value={opportunity.type} />
              <DetailRow label="Owner" value={opportunity.owner?.name} />
              <DetailRow
                label="Close date"
                value={
                  opportunity.closeDate
                    ? format(
                        new Date(
                          String(opportunity.closeDate).slice(0, 10) +
                            "T00:00:00",
                        ),
                        "MMM d, yyyy",
                      )
                    : null
                }
              />
              <DetailRow
                label="Created"
                value={format(new Date(opportunity.createdAt), "MMM d, yyyy")}
              />
              {opportunity.stage === "closed_lost" && opportunity.lostReason ? (
                <DetailRow
                  label="Lost reason"
                  value={
                    lostReasons.find((r) => r.code === opportunity.lostReason)
                      ?.label ?? labelForLostReasonCode(opportunity.lostReason)
                  }
                />
              ) : null}
            </section>

            <section className="flex flex-col">
              <p
                className={`
                  text-muted-foreground mb-2 text-[10px] font-bold
                  tracking-widest uppercase
                `}
              >
                Account
              </p>
              {account ? (
                <AccountDetailsSection account={account} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  {loading
                    ? "Loading account details…"
                    : `Account ${opportunity.account?.name ?? "details"} could not be loaded.`}
                </p>
              )}
            </section>

            {/*
             * Notes were previously rendered here from
             * `opportunity.notes`. After the Pipeline ↔ Accounts notes-
             * sync change; notes live
             * on the linked Account record — surfaced by the
             * `<AccountDetailsSection />` block above. The legacy
             * `opportunity.notes` column is still written for
             * backward compat with reports, but rendering it here
             * would duplicate the same text.
             */}

            <section className="flex flex-col gap-2">
              <p
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                Activities ({activities.length})
              </p>
              {activities.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No activities logged on this opportunity.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {activities.map((a) => (
                    <li
                      key={a.id}
                      className={`
                        border-border bg-background flex flex-col gap-0.5
                        rounded-md border p-2
                      `}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-foreground text-sm font-medium">
                          {a.subject}
                        </span>
                        <Badge status={a.type}>
                          {ACTIVITY_TYPE_LABELS[a.type as ActivityType] ??
                            a.type}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        {format(new Date(a.occurredAt), "MMM d · h:mm a")}
                        {a.durationMins !== null ? ` · ${a.durationMins}m` : ""}
                        {a.owner ? ` · ${a.owner.name}` : ""}
                      </p>
                      {a.body ? (
                        <p
                          className={`
                            text-foreground mt-1 text-xs whitespace-pre-wrap
                          `}
                        >
                          {a.body}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <p
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                Tasks ({tasks.length})
              </p>
              {tasks.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No follow-up tasks tied to this opportunity.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {tasks.map((t) => (
                    <li
                      key={t.id}
                      className={`
                        border-border bg-background flex items-center
                        justify-between gap-2 rounded-md border px-2 py-1.5
                      `}
                    >
                      <span
                        className={
                          t.status === "done"
                            ? `text-muted-foreground line-through`
                            : "text-foreground text-sm"
                        }
                      >
                        {t.subject}
                      </span>
                      <span
                        className={`
                          text-muted-foreground flex items-center gap-2
                          text-[11px]
                        `}
                      >
                        <span>
                          Due{" "}
                          {t.dueDate
                            ? format(
                                new Date(
                                  String(t.dueDate).slice(0, 10) + "T00:00:00",
                                ),
                                "MMM d",
                              )
                            : "—"}
                        </span>
                        <Badge status={t.status}>
                          {TASK_STATUS_LABELS[t.status as TaskStatus] ??
                            t.status}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}

        {opportunity ? (
          <div
            className={`
              border-border flex flex-wrap items-center justify-end gap-2
              border-t p-4
            `}
          >
            {!isTerminal && onEdit ? (
              <PermissionButton
                permission="sales-revenue:update"
                variant="outline"
                onClick={() => onEdit(opportunity)}
              >
                Edit
              </PermissionButton>
            ) : null}
            {!isTerminal ? (
              <PermissionButton
                permission="sales-revenue:update"
                variant="outline"
                onClick={() => {
                  setCloseLostReason("");
                  setCloseLostOpen(true);
                }}
              >
                Close lost
              </PermissionButton>
            ) : null}
            {isTerminal ? (
              <PermissionButton
                permission="sales-revenue:update"
                variant="outline"
                onClick={() => setReopenOpen(true)}
              >
                Reopen
              </PermissionButton>
            ) : null}
            <PermissionButton
              permission="sales-revenue:delete"
              variant="outline"
              className={`
                text-destructive
                hover:bg-destructive/10 hover:text-destructive
              `}
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </PermissionButton>
          </div>
        ) : null}
      </SheetContent>

      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen opportunity</DialogTitle>
            <DialogDescription>
              Move this {opportunity?.stage === "closed_won" ? "won" : "lost"}{" "}
              opportunity back into the pipeline. Pick the stage it should land
              in.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label className="text-foreground text-sm font-medium">
              Target stage
            </label>
            <Select
              value={reopenStage}
              onValueChange={(v) =>
                setReopenStage(v as (typeof REOPEN_STAGES)[number])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REOPEN_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {OPPORTUNITY_STAGE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {opportunity?.probabilityCustom ? (
              <p className="text-muted-foreground text-[11px]">
                Probability stays at {opportunity.probability}% (rep-set).
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReopenOpen(false)}
              disabled={reopenLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleReopen}
              disabled={reopenLoading}
            >
              {reopenLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Reopen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeLostOpen} onOpenChange={setCloseLostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close as lost</DialogTitle>
            <DialogDescription>
              Mark {opportunity?.name ?? "this opportunity"} as closed_lost.
              Picking a reason is optional but helps the team learn from the
              loss.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label className="text-foreground text-sm font-medium">
              Lost reason
            </label>
            <Select
              value={closeLostReason}
              onValueChange={(v) => setCloseLostReason(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a reason (optional)" />
              </SelectTrigger>
              <SelectContent>
                {lostReasons.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-[11px]">
              Probability snaps to 0%. Reopen later to move the deal back into
              the pipeline.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCloseLostOpen(false)}
              disabled={closeLostLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleCloseLost}
              disabled={closeLostLoading}
            >
              {closeLostLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Close lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this opportunity?</AlertDialogTitle>
            <AlertDialogDescription>
              {opportunity
                ? `${opportunity.name} will be permanently removed. Activities and tasks tied to this opportunity are removed too.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
