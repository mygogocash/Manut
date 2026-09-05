"use client";

import { Check, Circle, X } from "lucide-react";

import {
  WORKFLOW_CHAIN,
  WORKFLOW_STATUS_LABELS,
  type WorkflowHistoryEntry,
  type WorkflowStatus,
} from "@/services/workflow.service";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Progress rail, where the request sits in the fixed chain. A rejected
 * request shows the rail up to the point it was stopped.
 */
export function WorkflowProgress({ status }: { status: WorkflowStatus }) {
  const rejected = status === "rejected";
  // A row still on the name `approved` carried before is approved, and must land
  // on the same step. Normalising here rather than relying on the data migration
  // matters because staging syncs schema with `db:push`, which never runs the
  // data SQL inside a migration — so those rows persist there and would
  // otherwise render an empty rail.
  const onRail = status === "pending_development" ? "approved" : status;
  const currentIndex = rejected ? -1 : WORKFLOW_CHAIN.indexOf(onRail);

  return (
    <ol
      className={`
        flex flex-col gap-2
        sm:flex-row sm:items-center sm:gap-1
      `}
    >
      {WORKFLOW_CHAIN.map((step, i) => {
        const done = !rejected && i < currentIndex;
        const active = !rejected && i === currentIndex;
        return (
          <li key={step} className="flex flex-1 items-center gap-2">
            <span
              className={`
                flex size-5 shrink-0 items-center justify-center rounded-full
                text-[10px]
                ${
                  done
                    ? "bg-emerald-500/15 text-emerald-600"
                    : active
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                }
              `}
            >
              {done ? (
                <Check className="size-3" />
              ) : (
                <Circle className="size-2 fill-current" />
              )}
            </span>
            <span
              className={`
                truncate text-xs
                ${
                  active
                    ? "text-foreground font-medium"
                    : `text-muted-foreground`
                }
              `}
            >
              {WORKFLOW_STATUS_LABELS[step]}
            </span>
            {i < WORKFLOW_CHAIN.length - 1 && (
              <span
                className={`
                  bg-border hidden h-px flex-1
                  sm:block
                `}
                aria-hidden
              />
            )}
          </li>
        );
      })}
      {rejected && (
        <li className="flex items-center gap-2">
          <span
            className={`
              flex size-5 shrink-0 items-center justify-center rounded-full
              bg-red-500/15 text-red-600
            `}
          >
            <X className="size-3" />
          </span>
          <span className="text-xs font-medium text-red-600">Rejected</span>
        </li>
      )}
    </ol>
  );
}

/** Approval history, every recorded transition, oldest first. */
export function WorkflowHistory({
  history,
}: {
  history: WorkflowHistoryEntry[];
}) {
  if (history.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No approval activity yet.</p>
    );
  }
  return (
    <ol className="border-border relative ml-2 space-y-4 border-l pl-4">
      {history.map((h) => (
        <li key={h.id} className="relative">
          <span
            className={`
              bg-primary absolute top-1.5 -left-[21px] size-2 rounded-full
            `}
            aria-hidden
          />
          <p className="text-sm font-medium">
            {h.fromStatus
              ? `${WORKFLOW_STATUS_LABELS[h.fromStatus as WorkflowStatus] ?? h.fromStatus} → ${
                  WORKFLOW_STATUS_LABELS[h.toStatus as WorkflowStatus] ??
                  h.toStatus
                }`
              : (WORKFLOW_STATUS_LABELS[h.toStatus as WorkflowStatus] ??
                h.toStatus)}
          </p>
          <p className="text-muted-foreground text-xs">
            {h.actor} · {fmt(h.at)}
          </p>
          {h.comment && <p className="mt-1 text-sm">{h.comment}</p>}
        </li>
      ))}
    </ol>
  );
}
