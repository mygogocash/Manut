"use client";

import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { PermissionButton } from "@/components/shared/permission-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLeadSources } from "@/hooks/use-lead-sources";
import { ApiError } from "@/lib/api-client";
import {
  ACTIVITY_TYPE_LABELS,
  type ActivityType,
  type CrmActivity,
  listCrmActivities,
} from "@/services/crm-activity.service";
import {
  getLead,
  type Lead,
  LEAD_STATUS_LABELS,
} from "@/services/crm-lead.service";
import {
  type CrmTask,
  listCrmTasks,
  TASK_STATUS_LABELS,
  type TaskStatus,
} from "@/services/crm-task.service";

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

interface LeadDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string | null;
  onConvert?: (lead: Lead) => void;
  onDisqualify?: (lead: Lead) => void;
  onEdit?: (lead: Lead) => void;
}

export function LeadDetailSheet({
  open,
  onOpenChange,
  leadId,
  onConvert,
  onDisqualify,
  onEdit,
}: LeadDetailSheetProps) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(false);
  const { sources: leadSources } = useLeadSources();
  const sourceLabel =
    leadSources.find((s) => s.code === lead?.source)?.label ??
    lead?.source ??
    "";

  const fetchData = useCallback(async () => {
    if (!leadId) return;
    try {
      setLoading(true);
      const [leadRes, actsRes, tasksRes] = await Promise.all([
        getLead(leadId),
        listCrmActivities({ leadId, limit: 50 }).catch(() => ({
          data: [] as CrmActivity[],
          meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
        })),
        listCrmTasks({ leadId, limit: 50 }).catch(() => ({
          data: [] as CrmTask[],
          meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
        })),
      ]);
      setLead(leadRes.data);
      setActivities(actsRes.data);
      setTasks(tasksRes.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load lead";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (!open || !leadId) return;
    fetchData();
  }, [open, leadId, fetchData]);

  // Reset when sheet closes so reopening on a different lead doesn't flash
  // stale data.
  useEffect(() => {
    if (!open) {
      setLead(null);
      setActivities([]);
      setTasks([]);
    }
  }, [open]);

  const isTerminal =
    lead?.status === "converted" || lead?.status === "disqualified";

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
            {lead
              ? `${lead.firstName} ${lead.lastName}`
              : loading
                ? "Loading…"
                : "Lead"}
          </SheetTitle>
          <SheetDescription>
            {lead ? lead.company : "Lead detail"}
          </SheetDescription>
        </SheetHeader>

        {loading && !lead ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : lead ? (
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
                label="Status"
                value={
                  <Badge status={lead.status}>
                    {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
                  </Badge>
                }
              />
              <DetailRow label="Source" value={sourceLabel} />
              <DetailRow label="Company" value={lead.company} />
              <DetailRow label="Title" value={lead.title} />
              <DetailRow label="Email" value={lead.email} />
              <DetailRow label="Phone" value={lead.phone} />
              <DetailRow label="Owner" value={lead.owner?.name} />
              <DetailRow
                label="Created"
                value={format(new Date(lead.createdAt), "MMM d, yyyy")}
              />
              {lead.status === "converted" && lead.convertedOpportunity ? (
                <DetailRow
                  label="Converted to"
                  value={lead.convertedOpportunity.name}
                />
              ) : null}
              {lead.status === "disqualified" && lead.disqualifyReason ? (
                <DetailRow label="Reason" value={lead.disqualifyReason} />
              ) : null}
            </section>

            {lead.notes ? (
              <section className="flex flex-col gap-2">
                <p
                  className={`
                    text-muted-foreground text-[10px] font-bold tracking-widest
                    uppercase
                  `}
                >
                  Notes
                </p>
                <p className="text-foreground text-sm whitespace-pre-wrap">
                  {lead.notes}
                </p>
              </section>
            ) : null}

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
                  No activities logged on this lead.
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
                  No follow-up tasks tied to this lead.
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

        {lead && !isTerminal ? (
          <div
            className={`
              border-border flex flex-wrap items-center justify-end gap-2
              border-t p-4
            `}
          >
            {onEdit ? (
              <PermissionButton
                permission="crm:update"
                variant="outline"
                onClick={() => onEdit(lead)}
              >
                Edit
              </PermissionButton>
            ) : null}
            {onDisqualify ? (
              <PermissionButton
                permission="crm:update"
                variant="outline"
                onClick={() => onDisqualify(lead)}
              >
                Disqualify
              </PermissionButton>
            ) : null}
            {onConvert ? (
              <PermissionButton
                permission="crm:update"
                variant="gradient"
                onClick={() => onConvert(lead)}
              >
                Convert
              </PermissionButton>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
