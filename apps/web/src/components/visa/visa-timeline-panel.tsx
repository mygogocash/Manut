"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  CircleDot,
  FilePlus2,
  Loader2,
  PencilLine,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  getVisaTimeline,
  VISA_STATUS_LABELS,
  type VisaEvent,
} from "@/services/visa.service";

function statusLabel(value: string | null): string {
  if (!value) return "—";
  return VISA_STATUS_LABELS[value] ?? value;
}

// One-line human description per event kind. Date kinds show old → new.
function describe(e: VisaEvent): string {
  switch (e.kind) {
    case "created":
      return `Record created (${statusLabel(e.newValue)})`;
    case "status_change":
      return `Status changed: ${statusLabel(e.oldValue)} → ${statusLabel(e.newValue)}`;
    case "expiry_updated":
      return `Visa expiry set to ${e.newValue ?? "—"}${e.oldValue ? ` (was ${e.oldValue})` : ""}`;
    case "issue_updated":
      return `Issue date set to ${e.newValue ?? "—"}${e.oldValue ? ` (was ${e.oldValue})` : ""}`;
    case "work_permit_updated":
      return `Work-permit expiry set to ${e.newValue ?? "—"}${e.oldValue ? ` (was ${e.oldValue})` : ""}`;
    case "note_added":
      return "Notes updated";
    case "document_added":
      return "Document attached";
    case "reminder_sent":
      return `Expiry reminder sent${e.newValue ? ` (${e.newValue} days out)` : ""}`;
    default:
      return e.kind;
  }
}

function EventIcon({ kind }: { kind: string }) {
  const cls = "size-3.5";
  switch (kind) {
    case "created":
      return <FilePlus2 className={cls} />;
    case "status_change":
      return <RefreshCw className={cls} />;
    case "reminder_sent":
      return <Bell className={cls} />;
    case "document_added":
      return <FilePlus2 className={cls} />;
    case "expiry_updated":
    case "issue_updated":
    case "work_permit_updated":
    case "note_added":
      return <PencilLine className={cls} />;
    default:
      return <CircleDot className={cls} />;
  }
}

export function VisaTimelinePanel({ visaId }: { visaId: string }) {
  const [events, setEvents] = useState<VisaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getVisaTimeline(visaId)
      .then((res) => {
        if (!cancelled) setEvents(res.data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visaId]);

  return (
    <div className="border-border/60 rounded-md border p-3">
      <div className="text-foreground mb-2 text-sm font-semibold">Activity</div>
      {loading ? (
        <div className="flex h-16 items-center justify-center">
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
        </div>
      ) : error ? (
        <p className="text-muted-foreground text-xs">
          Couldn&apos;t load the activity timeline.
        </p>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground text-xs">No activity yet.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {events.map((e) => (
            <li key={e.id} className="flex gap-2.5">
              <div
                className={`
                  bg-muted text-muted-foreground mt-0.5 flex size-6 shrink-0
                  items-center justify-center rounded-full
                `}
              >
                <EventIcon kind={e.kind} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-sm">{describe(e)}</p>
                <p className="text-muted-foreground text-[11px]">
                  {e.actorType === "system"
                    ? "System"
                    : (e.actor?.name ?? "Someone")}{" "}
                  ·{" "}
                  {formatDistanceToNow(new Date(e.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
