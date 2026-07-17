"use client";

import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { priorityBadgeVariant } from "@/components/helpdesk/ticket-detail-sheet";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import {
  type HelpdeskTicket,
  listTickets,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from "@/services/helpdesk.service";

interface TicketListProps {
  scope: "mine" | "all";
  refreshKey?: number;
  onSelect: (ticketId: string) => void;
}

export function TicketList({ scope, refreshKey, onSelect }: TicketListProps) {
  const [rows, setRows] = useState<HelpdeskTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listTickets({ scope, limit: 100, page: 1 });
      setRows(res.data);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load tickets";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows, refreshKey]);

  if (loading) {
    return (
      <div
        className={`
          text-muted-foreground flex items-center gap-2 px-2 py-4 text-sm
        `}
      >
        <Loader2 className="size-4 animate-spin" />
        Loading tickets...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-md border px-4 py-12 text-center">
        <p className="text-muted-foreground text-sm">
          No tickets yet. Click <strong>Submit ticket</strong> to open one.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Ticket</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="w-40">Category</TableHead>
            <TableHead className="w-32">Priority</TableHead>
            <TableHead className="w-32">Status</TableHead>
            <TableHead className="w-40">Assignee</TableHead>
            <TableHead className="w-40 text-right">Opened</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t) => (
            <TableRow
              key={t.id}
              className="cursor-pointer"
              onClick={() => onSelect(t.id)}
            >
              <TableCell className="font-mono text-xs">
                IT-{t.ticketNumber}
              </TableCell>
              <TableCell className="font-medium">{t.title}</TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {TICKET_CATEGORY_LABELS[t.category]}
              </TableCell>
              <TableCell>
                <Badge variant={priorityBadgeVariant(t.priority)}>
                  {TICKET_PRIORITY_LABELS[t.priority]}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {TICKET_STATUS_LABELS[t.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {t.assignee?.name ?? "Unassigned"}
              </TableCell>
              <TableCell className="text-muted-foreground text-right text-xs">
                {formatDistanceToNow(new Date(t.createdAt), {
                  addSuffix: true,
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
