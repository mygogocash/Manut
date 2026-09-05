"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ALL_FILTER,
  formatCurrency,
  formatDate,
} from "@/components/accounting/accounting-utils";
import { QuoteDialog } from "@/components/accounting/quote-dialog";
import { Badge } from "@/components/shared/badge";
import { DataTable } from "@/components/shared/data-table";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  convertQuote,
  deleteQuote,
  listQuotes,
  type Quote,
  QUOTE_STATUSES,
  type QuoteStatus,
  sendQuote,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

interface QuotesTabProps {
  entities: Entity[];
  canCreate: boolean;
  canAdmin: boolean;
}

export function QuotesTab({ entities, canCreate, canAdmin }: QuotesTabProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState(ALL_FILTER);
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER);
  const [actingId, setActingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Quote | null>(null);

  const fetchQuotes = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listQuotes({
        entityId: entityFilter === ALL_FILTER ? undefined : entityFilter,
        status:
          statusFilter === ALL_FILTER
            ? undefined
            : (statusFilter as QuoteStatus),
      });
      setQuotes(result.data);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to load quotes";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [entityFilter, statusFilter]);

  useEffect(() => {
    void fetchQuotes();
  }, [fetchQuotes]);

  const handleSend = useCallback(
    async (q: Quote) => {
      try {
        setActingId(q.id);
        await sendQuote(q.id);
        toast.success(`Quote ${q.quoteNo} sent`);
        await fetchQuotes();
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to send quote";
        toast.error(msg);
      } finally {
        setActingId(null);
      }
    },
    [fetchQuotes],
  );

  const handleConvert = useCallback(
    async (q: Quote) => {
      try {
        setActingId(q.id);
        await convertQuote(q.id);
        toast.success(`Quote ${q.quoteNo} converted to a draft invoice`);
        await fetchQuotes();
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to convert quote";
        toast.error(msg);
      } finally {
        setActingId(null);
      }
    },
    [fetchQuotes],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const q = deleteTarget;
    try {
      setActingId(q.id);
      await deleteQuote(q.id);
      toast.success(`Quote ${q.quoteNo} deleted`);
      setDeleteTarget(null);
      await fetchQuotes();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to delete quote";
      toast.error(msg);
    } finally {
      setActingId(null);
    }
  }, [deleteTarget, fetchQuotes]);

  const columns = useMemo(
    () => [
      {
        key: "quoteNo",
        mobileRole: "title" as const,
        header: "Number",
        render: (q: Quote) => (
          <span className="font-medium tabular-nums">{q.quoteNo}</span>
        ),
      },
      {
        key: "vendor",
        mobileRole: "subtitle" as const,
        header: "Customer",
        render: (q: Quote) => q.vendor?.name ?? "—",
      },
      {
        key: "issueDate",
        mobileRole: "detail" as const,
        header: "Issue Date",
        render: (q: Quote) => formatDate(q.issueDate),
      },
      {
        key: "expiryDate",
        mobileRole: "field" as const,
        header: "Expiry",
        render: (q: Quote) => (q.expiryDate ? formatDate(q.expiryDate) : "—"),
      },
      {
        key: "grandTotal",
        mobileRole: "field" as const,
        header: "Total",
        className: "text-right",
        render: (q: Quote) => (
          <span className="tabular-nums">{formatCurrency(q.grandTotal)}</span>
        ),
      },
      {
        key: "status",
        mobileRole: "badge" as const,
        header: "Status",
        render: (q: Quote) => <Badge status={q.status}>{q.status}</Badge>,
      },
      {
        key: "actions",
        mobileRole: "actions" as const,
        header: "",
        className: "text-right",
        render: (q: Quote) => {
          const busy = actingId === q.id;
          const canSend = canCreate && q.status === "draft";
          const canEdit = canCreate && q.status === "draft";
          const canConvert =
            canCreate &&
            ["sent", "accepted"].includes(q.status) &&
            !q.convertedInvoiceId &&
            Boolean(q.vendorId);
          const canDelete = canAdmin && q.status !== "converted";
          if (!canSend && !canEdit && !canConvert && !canDelete) return null;
          return (
            <div className="flex items-center justify-end gap-1.5">
              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={busy}
                  onClick={() => setEditing(q)}
                >
                  Edit
                </Button>
              ) : null}
              {canSend ? (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={busy}
                  onClick={() => handleSend(q)}
                >
                  {busy ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                  Send
                </Button>
              ) : null}
              {canConvert ? (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={busy}
                  onClick={() => handleConvert(q)}
                >
                  {busy ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                  Convert
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="text-destructive"
                  disabled={busy}
                  onClick={() => setDeleteTarget(q)}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [actingId, canCreate, canAdmin, handleSend, handleConvert],
  );

  const filtersDirty =
    entityFilter !== ALL_FILTER || statusFilter !== ALL_FILTER;

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`
          border-border bg-surface flex flex-col gap-2 rounded-lg border p-3
          shadow-sm
          md:flex-row md:items-center
        `}
      >
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="h-10 min-w-[140px] text-xs">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All entities</SelectItem>
            {entities.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 min-w-[130px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
            {QUOTE_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filtersDirty ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              setEntityFilter(ALL_FILTER);
              setStatusFilter(ALL_FILTER);
            }}
            className="text-xs"
          >
            Clear
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={quotes}
        loading={loading}
        emptyMessage="No quotes yet"
      />

      <QuoteDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        entities={entities}
        quote={editing ?? undefined}
        onSaved={fetchQuotes}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quote?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Quote ${deleteTarget.quoteNo} will be removed.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actingId !== null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={actingId !== null}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
