"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import type { BadgeVariant } from "@/components/shared/badge";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { PermissionButton } from "@/components/shared/permission-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { listInvestors } from "@/services/investor.service";
import {
  createInvestorActivity,
  deleteInvestorActivity,
  INVESTOR_ACTIVITY_TYPE_LABELS,
  INVESTOR_ACTIVITY_TYPES,
  type InvestorActivity,
  type InvestorActivityType,
  listInvestorActivities,
  updateInvestorActivity,
} from "@/services/investor-activity.service";

const TYPE_VARIANT: Record<string, BadgeVariant> = {
  call: "blue",
  email: "teal",
  meeting: "purple",
  note: "grey",
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Convert an ISO timestamp into the value a <input type="datetime-local">
// expects (local "YYYY-MM-DDTHH:mm", no seconds / tz).
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface InvestorOption {
  id: string;
  name: string;
}

export function InvestorActivitiesTab() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("investors:create");
  const canUpdate = hasPermission("investors:update");
  const canDelete = hasPermission("investors:delete");

  const [activities, setActivities] = useState<InvestorActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [investorOptions, setInvestorOptions] = useState<InvestorOption[]>([]);

  const {
    page,
    pageSize,
    setPage,
    setPageSize,
    setTotalCount,
    totalPages,
    totalCount,
  } = usePagination();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InvestorActivity | null>(null);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listInvestorActivities({
        page,
        limit: pageSize,
        type: typeFilter || undefined,
      });
      setActivities(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load activities";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeFilter, setTotalCount]);

  useEffect(() => {
    void fetchActivities();
  }, [fetchActivities]);

  useEffect(() => {
    listInvestors({ limit: 200 })
      .then((r) =>
        setInvestorOptions(r.data.map((i) => ({ id: i.id, name: i.name }))),
      )
      .catch(() => undefined);
  }, []);

  async function remove(a: InvestorActivity) {
    if (!canDelete) return;
    if (!window.confirm(`Delete this ${a.type}?`)) return;
    const previous = activities;
    setActivities((prev) => prev.filter((x) => x.id !== a.id));
    try {
      await deleteInvestorActivity(a.id);
      toast.success("Activity deleted");
    } catch (err) {
      setActivities(previous);
      const msg =
        err instanceof ApiError ? err.message : "Failed to delete activity";
      toast.error(msg);
    }
  }

  const skeleton = Array.from({ length: Math.min(pageSize, 6) });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className={`
            border-border bg-background h-8 rounded-md border px-2 text-xs
          `}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          {INVESTOR_ACTIVITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {INVESTOR_ACTIVITY_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <PermissionButton
          permission="investors:create"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1.5 size-3.5" />
          Log activity
        </PermissionButton>
      </div>

      <Table containerClassName="max-h-[calc(100vh-340px)] overflow-auto rounded-lg border">
        <TableHeader className="bg-background sticky top-0 z-10">
          <TableRow>
            <TableHead className="w-[90px]">Type</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Investor</TableHead>
            <TableHead>When</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            skeleton.map((_, i) => (
              <TableRow key={`s-${i}`}>
                <TableCell colSpan={6}>
                  <div className="bg-muted h-5 w-full animate-pulse rounded" />
                </TableCell>
              </TableRow>
            ))
          ) : activities.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-muted-foreground py-10 text-center text-xs"
              >
                No activities logged yet
              </TableCell>
            </TableRow>
          ) : (
            activities.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Badge variant={TYPE_VARIANT[a.type] ?? "grey"}>
                    {INVESTOR_ACTIVITY_TYPE_LABELS[a.type] ?? a.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {a.subject}
                  {a.durationMins ? (
                    <span className="text-muted-foreground ml-2 text-[11px]">
                      {a.durationMins}m
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {a.investor?.name ?? "—"}
                </TableCell>
                <TableCell
                  className={`text-muted-foreground text-xs tabular-nums`}
                >
                  {fmtDateTime(a.occurredAt)}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {a.owner?.name ?? "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {canUpdate ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(a);
                          setFormOpen(true);
                        }}
                        aria-label="Edit activity"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void remove(a)}
                        aria-label="Delete activity"
                      >
                        <Trash2 className="text-destructive size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <DataPagination
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <ActivityFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        activity={editing}
        investorOptions={investorOptions}
        canSubmit={editing ? canUpdate : canCreate}
        onSaved={() => {
          setFormOpen(false);
          void fetchActivities();
        }}
      />
    </div>
  );
}

function ActivityFormDialog({
  open,
  onOpenChange,
  activity,
  investorOptions,
  canSubmit,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  activity: InvestorActivity | null;
  investorOptions: InvestorOption[];
  canSubmit: boolean;
  onSaved: () => void;
}) {
  const [type, setType] = useState<InvestorActivityType>("call");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [durationMins, setDurationMins] = useState("");
  const [investorId, setInvestorId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType((activity?.type as InvestorActivityType) ?? "call");
    setSubject(activity?.subject ?? "");
    setBody(activity?.body ?? "");
    setOccurredAt(toLocalInput(activity?.occurredAt ?? null));
    setDurationMins(
      activity?.durationMins ? String(activity.durationMins) : "",
    );
    setInvestorId(activity?.investorId ?? "");
  }, [open, activity]);

  async function submit() {
    if (!subject.trim() || !occurredAt) {
      toast.error("Subject and date/time are required");
      return;
    }
    if (!activity && !investorId) {
      toast.error("Pick an investor");
      return;
    }
    const duration = durationMins ? Number(durationMins) : undefined;
    try {
      setSaving(true);
      if (activity) {
        await updateInvestorActivity(activity.id, {
          type,
          subject: subject.trim(),
          body: body.trim() || null,
          occurredAt,
          durationMins: duration ?? null,
        });
        toast.success("Activity updated");
      } else {
        await createInvestorActivity({
          type,
          subject: subject.trim(),
          body: body.trim() || undefined,
          occurredAt,
          durationMins: duration,
          investorId,
        });
        toast.success("Activity logged");
      }
      onSaved();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to save activity";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {activity ? "Edit activity" : "Log activity"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {!activity ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="act-investor">Investor</Label>
              <select
                id="act-investor"
                value={investorId}
                onChange={(e) => setInvestorId(e.target.value)}
                className={`
                  border-border bg-background h-9 rounded-md border px-2 text-sm
                `}
              >
                <option value="">Select investor…</option>
                {investorOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="act-type">Type</Label>
            <select
              id="act-type"
              value={type}
              onChange={(e) => setType(e.target.value as InvestorActivityType)}
              className={`
                border-border bg-background h-9 rounded-md border px-2 text-sm
              `}
            >
              {INVESTOR_ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {INVESTOR_ACTIVITY_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="act-subject">Subject</Label>
            <Input
              id="act-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Intro call with the GP…"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="act-when">Date / time</Label>
            <Input
              id="act-when"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="act-duration">Duration (minutes, optional)</Label>
            <Input
              id="act-duration"
              type="number"
              min={1}
              value={durationMins}
              onChange={(e) => setDurationMins(e.target.value)}
              placeholder="30"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="act-body">Notes (optional)</Label>
            <Textarea
              id="act-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving || !canSubmit}>
            {saving ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : null}
            {activity ? "Save" : "Log"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
