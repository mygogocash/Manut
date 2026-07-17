"use client";

import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { priorityBadgeVariant } from "@/components/helpdesk/ticket-detail-sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ApiError } from "@/lib/api-client";
import {
  type HelpdeskTicket,
  listTickets,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  type TicketStatus,
  updateTicket,
} from "@/services/helpdesk.service";

const COLUMN_PAGE_SIZE = 50;

// Kanban column accent matches the row "status pill" colour used in the
// detail sheet, so the IT team can scan the board without re-reading the
// header.
function statusBorderClass(s: TicketStatus): string {
  switch (s) {
    case "open":
      return "border-t-blue-500";
    case "in-progress":
      return "border-t-amber-500";
    case "review":
      return "border-t-orange-500";
    case "resolved":
      return "border-t-emerald-600";
    case "closed":
    default:
      return "border-t-muted-foreground";
  }
}

interface TicketKanbanProps {
  scope: "all" | "mine";
  refreshKey?: number;
  onSelect: (ticketId: string) => void;
  canMove: boolean;
}

export function TicketKanban({
  scope,
  refreshKey,
  onSelect,
  canMove,
}: TicketKanbanProps) {
  const [columns, setColumns] = useState<
    Record<TicketStatus, HelpdeskTicket[]>
  >(() => {
    const init = {} as Record<TicketStatus, HelpdeskTicket[]>;
    for (const s of TICKET_STATUSES) init[s] = [];
    return init;
  });
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TicketStatus | null>(
    null,
  );

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const results = await Promise.all(
        TICKET_STATUSES.map((status) =>
          listTickets({ scope, status, limit: COLUMN_PAGE_SIZE, page: 1 }),
        ),
      );
      const next = {} as Record<TicketStatus, HelpdeskTicket[]>;
      TICKET_STATUSES.forEach((status, idx) => {
        next[status] = results[idx]?.data ?? [];
      });
      setColumns(next);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load tickets";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll, refreshKey]);

  async function moveTicket(ticket: HelpdeskTicket, target: TicketStatus) {
    if (ticket.status === target) return;
    // Optimistic move — drop it into the new column locally, then revert
    // on error. This keeps drag-and-drop feel snappy on slow networks
    // without losing the safety net.
    const prev = columns;
    const stripped = TICKET_STATUSES.reduce(
      (acc, s) => {
        acc[s] = columns[s].filter((t) => t.id !== ticket.id);
        return acc;
      },
      {} as Record<TicketStatus, HelpdeskTicket[]>,
    );
    stripped[target] = [{ ...ticket, status: target }, ...stripped[target]];
    setColumns(stripped);

    try {
      await updateTicket(ticket.id, { status: target });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to move ticket";
      toast.error(msg);
      setColumns(prev);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {loading ? (
        <div
          className={`
            text-muted-foreground flex items-center gap-2 px-2 text-sm
          `}
        >
          <Loader2 className="size-4 animate-spin" />
          Loading tickets...
        </div>
      ) : null}

      <div
        className={`
          grid grid-cols-1 gap-3
          md:grid-cols-3
          xl:grid-cols-5
        `}
      >
        {TICKET_STATUSES.map((status) => {
          const items = columns[status];
          const isDropTarget = dragOverStatus === status;
          return (
            <div
              key={status}
              className={`
                bg-muted/30 flex max-h-[calc(100vh-13rem)] min-h-[60vh] flex-col
                rounded-md border border-t-4
                ${statusBorderClass(status)}
                ${isDropTarget ? "ring-primary/40 ring-2" : ""}
              `}
              onDragOver={(e) => {
                if (!canMove || !draggingId) return;
                e.preventDefault();
                setDragOverStatus(status);
              }}
              onDragLeave={() => {
                if (dragOverStatus === status) setDragOverStatus(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStatus(null);
                if (!canMove || !draggingId) return;
                const ticket = TICKET_STATUSES.flatMap((s) => columns[s]).find(
                  (t) => t.id === draggingId,
                );
                setDraggingId(null);
                if (ticket) void moveTicket(ticket, status);
              }}
            >
              <div
                className={`
                  flex items-center justify-between border-b px-3 py-2
                `}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold tracking-wide uppercase`}
                  >
                    {TICKET_STATUS_LABELS[status]}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {items.length}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                {items.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-xs">
                    No tickets
                  </p>
                ) : (
                  items.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      draggable={canMove}
                      onDragStart={() => setDraggingId(t.id)}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverStatus(null);
                      }}
                      onClick={() => onSelect(t.id)}
                      className={`
                        bg-background flex flex-col gap-2 rounded-md border px-3
                        py-2 text-left text-xs transition
                        hover:bg-accent
                        ${draggingId === t.id ? "opacity-50" : ""}
                      `}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`
                            text-muted-foreground font-mono text-[10px]
                          `}
                        >
                          IT-{t.ticketNumber}
                        </span>
                        <Badge
                          variant={priorityBadgeVariant(t.priority)}
                          className="text-[10px]"
                        >
                          {TICKET_PRIORITY_LABELS[t.priority]}
                        </Badge>
                      </div>
                      <p
                        className={`
                          text-foreground line-clamp-2 text-sm font-medium
                        `}
                      >
                        {t.title}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground text-[11px]">
                          {TICKET_CATEGORY_LABELS[t.category]}
                        </span>
                        <span className="text-muted-foreground text-[10px]">
                          {formatDistanceToNow(new Date(t.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-5">
                          <AvatarImage
                            src={t.createdBy.avatarUrl ?? undefined}
                          />
                          <AvatarFallback>
                            {t.createdBy.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={`
                            text-muted-foreground truncate text-[11px]
                          `}
                        >
                          {t.createdBy.name}
                        </span>
                        {t.assignee && (
                          <>
                            <span className="text-muted-foreground">→</span>
                            <Avatar className="size-5">
                              <AvatarImage
                                src={t.assignee.avatarUrl ?? undefined}
                              />
                              <AvatarFallback>
                                {t.assignee.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span
                              className={`
                                text-muted-foreground truncate text-[11px]
                              `}
                            >
                              {t.assignee.name}
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
