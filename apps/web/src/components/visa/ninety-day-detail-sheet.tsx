"use client";

import { format } from "date-fns";
import {
  CalendarClock,
  Download,
  Loader2,
  Mail,
  MapPin,
  User2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ApiError } from "@/lib/api-client";
import {
  getNinetyDayReceiptDownloadUrl,
  NINETY_DAY_STATUS_LABELS,
  type NinetyDayNotification,
  type NinetyDayStatus,
} from "@/services/ninety-day.service";

function fmt(dateStr: string | null): string {
  if (!dateStr) return "—";
  return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy");
}

function fmtTimestamp(iso: string | null): string {
  if (!iso) return "—";
  return format(new Date(iso), "MMM d, yyyy 'at' HH:mm");
}

// Same tone map as the table — keeps the row badge and the detail
// badge identical so the user has a visual anchor.
function statusTone(
  status: NinetyDayStatus,
): "green" | "grey" | "amber" | "blue" {
  switch (status) {
    case "approved":
      return "green";
    case "no_required":
      return "grey";
    case "to_be_notifying":
      return "blue";
    default:
      return "amber";
  }
}

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={`
        border-border/60 flex items-start justify-between gap-3 border-b py-2
        last:border-b-0
      `}
    >
      <span
        className={`
          text-muted-foreground flex items-center gap-1.5 text-[11px]
          font-medium tracking-wide uppercase
        `}
      >
        {icon}
        {label}
      </span>
      <span className="text-foreground text-right text-sm">{value}</span>
    </div>
  );
}

interface NinetyDayDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: NinetyDayNotification | null;
  /** Show an `Edit` shortcut when the caller can manage the row. */
  canManage?: boolean;
  onEdit?: (record: NinetyDayNotification) => void;
}

function ReceiptRow({ record }: { record: NinetyDayNotification }) {
  const [loading, setLoading] = useState(false);

  if (!record.receipt) return null;

  async function openReceipt() {
    try {
      setLoading(true);
      const res = await getNinetyDayReceiptDownloadUrl(record.id);
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to open receipt";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <p
        className={`
          text-muted-foreground text-[10px] font-bold tracking-widest uppercase
        `}
      >
        Receipt
      </p>
      <div
        className={`
          border-border/60 flex items-center justify-between gap-2 rounded-md
          border p-2
        `}
      >
        <span className="text-foreground truncate text-sm">
          {record.receipt.name}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void openReceipt()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          Open
        </Button>
      </div>
    </section>
  );
}

export function NinetyDayDetailSheet({
  open,
  onOpenChange,
  record,
  canManage = false,
  onEdit,
}: NinetyDayDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={`
          flex w-full flex-col gap-0
          sm:max-w-md
        `}
      >
        <SheetHeader className="border-border border-b">
          <SheetTitle>
            {record
              ? record.holderType === "dependent" && record.holderName
                ? record.holderName
                : record.employee.name
              : "90-day notification"}
          </SheetTitle>
          <SheetDescription>
            {record
              ? "TM.47 reminder schedule + applicant details"
              : "Loading…"}
          </SheetDescription>
        </SheetHeader>

        {record ? (
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
            <section className="flex flex-col">
              <p
                className={`
                  text-muted-foreground mb-2 text-[10px] font-bold
                  tracking-widest uppercase
                `}
              >
                Applicant
              </p>
              {record.holderType === "dependent" && record.holderName ? (
                <>
                  <DetailRow
                    label="Name"
                    value={record.holderName}
                    icon={<User2 className="size-3" aria-hidden />}
                  />
                  {record.holderRelationship ? (
                    <DetailRow
                      label="Relationship"
                      value={record.holderRelationship}
                    />
                  ) : null}
                  <DetailRow
                    label="Sponsor employee"
                    value={record.employee.name}
                  />
                  <DetailRow
                    label="Sponsor email"
                    value={record.employee.email}
                    icon={<Mail className="size-3" aria-hidden />}
                  />
                </>
              ) : (
                <>
                  <DetailRow
                    label="Name"
                    value={record.employee.name}
                    icon={<User2 className="size-3" aria-hidden />}
                  />
                  <DetailRow
                    label="Email"
                    value={record.employee.email}
                    icon={<Mail className="size-3" aria-hidden />}
                  />
                </>
              )}
              {record.employee.department ? (
                <DetailRow
                  label="Department"
                  value={record.employee.department}
                  icon={<MapPin className="size-3" aria-hidden />}
                />
              ) : null}
              <DetailRow
                label="Status"
                value={
                  <Badge variant={statusTone(record.status)}>
                    {NINETY_DAY_STATUS_LABELS[record.status]}
                  </Badge>
                }
              />
            </section>

            <section className="flex flex-col">
              <p
                className={`
                  text-muted-foreground mb-2 text-[10px] font-bold
                  tracking-widest uppercase
                `}
              >
                Reminder schedule
              </p>
              <DetailRow
                label="Last arrival"
                value={fmt(record.lastArrivalDate)}
                icon={<CalendarClock className="size-3" aria-hidden />}
              />
              <DetailRow label="90-day due" value={fmt(record.dueDate)} />
              <DetailRow
                label="21-day notice"
                value={fmt(record.notification21Date)}
              />
              <DetailRow
                label="15-day advance"
                value={fmt(record.notification15Date)}
              />
              <DetailRow
                label="Last 7-day submission"
                value={fmt(record.finalReportDate)}
              />
            </section>

            <section className="flex flex-col">
              <p
                className={`
                  text-muted-foreground mb-2 text-[10px] font-bold
                  tracking-widest uppercase
                `}
              >
                Last reminder
              </p>
              <DetailRow
                label="Sent at"
                value={fmtTimestamp(record.lastReminderSentAt)}
              />
              <DetailRow
                label="Milestone"
                value={
                  record.lastReminderMilestoneDays === null
                    ? "—"
                    : record.lastReminderMilestoneDays === 21
                      ? "T-21 days"
                      : record.lastReminderMilestoneDays === 15
                        ? "T-15 days"
                        : record.lastReminderMilestoneDays === -7
                          ? "T+7 days (final)"
                          : `${record.lastReminderMilestoneDays} days`
                }
              />
            </section>

            <ReceiptRow record={record} />

            {record.notes ? (
              <section className="flex flex-col gap-1">
                <p
                  className={`
                    text-muted-foreground text-[10px] font-bold tracking-widest
                    uppercase
                  `}
                >
                  Notes
                </p>
                <p
                  className={`
                    text-foreground border-border/50 bg-muted/20 rounded-md
                    border p-2.5 text-sm whitespace-pre-wrap
                  `}
                >
                  {record.notes}
                </p>
              </section>
            ) : null}
          </div>
        ) : null}

        <SheetFooter className="border-border border-t p-4">
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            {canManage && onEdit && record ? (
              <Button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(record);
                }}
              >
                Edit
              </Button>
            ) : null}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
