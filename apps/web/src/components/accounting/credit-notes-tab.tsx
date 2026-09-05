"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ALL_FILTER,
  formatCurrency,
  formatDate,
} from "@/components/accounting/accounting-utils";
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
  CREDIT_NOTE_KINDS,
  CREDIT_NOTE_STATUSES,
  type CreditNote,
  type CreditNoteKind,
  type CreditNoteStatus,
  issueCreditNote,
  listCreditNotes,
  voidCreditNote,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

interface CreditNotesTabProps {
  entities: Entity[];
  canPost: boolean;
  canAdmin: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  receivable: "AR",
  payable: "AP",
};

const KIND_LABEL: Record<string, string> = {
  credit: "Credit",
  debit: "Debit",
};

export function CreditNotesTab({
  entities,
  canPost,
  canAdmin,
}: CreditNotesTabProps) {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState(ALL_FILTER);
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER);
  const [kindFilter, setKindFilter] = useState(ALL_FILTER);
  const [actingId, setActingId] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<CreditNote | null>(null);

  const fetchCreditNotes = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listCreditNotes({
        entityId: entityFilter === ALL_FILTER ? undefined : entityFilter,
        status:
          statusFilter === ALL_FILTER
            ? undefined
            : (statusFilter as CreditNoteStatus),
        noteKind:
          kindFilter === ALL_FILTER
            ? undefined
            : (kindFilter as CreditNoteKind),
      });
      setCreditNotes(result.data);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load credit notes";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [entityFilter, statusFilter, kindFilter]);

  useEffect(() => {
    void fetchCreditNotes();
  }, [fetchCreditNotes]);

  const handleIssue = useCallback(
    async (cn: CreditNote) => {
      try {
        setActingId(cn.id);
        await issueCreditNote(cn.id);
        toast.success(`${KIND_LABEL[cn.noteKind] ?? "Credit"} note ${cn.creditNoteNo} issued`);
        await fetchCreditNotes();
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to issue credit note";
        toast.error(msg);
      } finally {
        setActingId(null);
      }
    },
    [fetchCreditNotes],
  );

  const handleVoid = useCallback(async () => {
    if (!voidTarget) return;
    const cn = voidTarget;
    try {
      setActingId(cn.id);
      await voidCreditNote(cn.id);
      toast.success(`${KIND_LABEL[cn.noteKind] ?? "Credit"} note ${cn.creditNoteNo} voided`);
      setVoidTarget(null);
      await fetchCreditNotes();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to void credit note";
      toast.error(msg);
    } finally {
      setActingId(null);
    }
  }, [voidTarget, fetchCreditNotes]);

  const columns = useMemo(
    () => [
      {
        key: "creditNoteNo",
        mobileRole: "title" as const,
        header: "Number",
        render: (cn: CreditNote) => (
          <span className="font-medium tabular-nums">{cn.creditNoteNo}</span>
        ),
      },
      {
        key: "entity",
        mobileRole: "subtitle" as const,
        header: "Entity",
        render: (cn: CreditNote) => cn.entity?.name ?? "—",
      },
      {
        key: "type",
        mobileRole: "detail" as const,
        header: "Side",
        render: (cn: CreditNote) => (
          <Badge variant={cn.type === "payable" ? "amber" : "blue"}>
            {TYPE_LABEL[cn.type] ?? cn.type}
          </Badge>
        ),
      },
      {
        key: "noteKind",
        mobileRole: "detail" as const,
        header: "Kind",
        render: (cn: CreditNote) => (
          <Badge variant={cn.noteKind === "debit" ? "amber" : "green"}>
            {KIND_LABEL[cn.noteKind] ?? cn.noteKind}
          </Badge>
        ),
      },
      {
        key: "issueDate",
        mobileRole: "field" as const,
        header: "Issue Date",
        render: (cn: CreditNote) => formatDate(cn.issueDate),
      },
      {
        key: "reason",
        mobileRole: "detail" as const,
        header: "Reason",
        render: (cn: CreditNote) => (
          <span className="text-muted-foreground line-clamp-1 max-w-[220px]">
            {cn.reason || "—"}
          </span>
        ),
      },
      {
        key: "grandTotal",
        mobileRole: "field" as const,
        header: "Total",
        className: "text-right",
        render: (cn: CreditNote) => (
          <span className="tabular-nums">{formatCurrency(cn.grandTotal)}</span>
        ),
      },
      {
        key: "status",
        mobileRole: "badge" as const,
        header: "Status",
        render: (cn: CreditNote) => <Badge status={cn.status}>{cn.status}</Badge>,
      },
      {
        key: "actions",
        mobileRole: "actions" as const,
        header: "",
        className: "text-right",
        render: (cn: CreditNote) => {
          const busy = actingId === cn.id;
          const canIssue = canPost && cn.status === "draft";
          const canVoid = canAdmin && cn.status !== "cancelled";
          if (!canIssue && !canVoid) return null;
          return (
            <div className="flex items-center justify-end gap-2">
              {canIssue ? (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={busy}
                  onClick={() => handleIssue(cn)}
                >
                  {busy ? (
                    <Loader2 className="mr-1 size-3 animate-spin" />
                  ) : null}
                  Issue
                </Button>
              ) : null}
              {canVoid ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="text-destructive"
                  disabled={busy}
                  onClick={() => setVoidTarget(cn)}
                >
                  Void
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [actingId, canPost, canAdmin, handleIssue],
  );

  const filtersDirty =
    entityFilter !== ALL_FILTER ||
    statusFilter !== ALL_FILTER ||
    kindFilter !== ALL_FILTER;

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

        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="h-10 min-w-[120px] text-xs">
            <SelectValue placeholder="Kind" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All kinds</SelectItem>
            {CREDIT_NOTE_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {KIND_LABEL[k]}
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
            {CREDIT_NOTE_STATUSES.map((s) => (
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
              setKindFilter(ALL_FILTER);
            }}
            className="text-xs"
          >
            Clear
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={creditNotes}
        loading={loading}
        emptyMessage="No credit notes yet"
      />

      <AlertDialog
        open={voidTarget !== null}
        onOpenChange={(open) => {
          if (!open) setVoidTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this note?</AlertDialogTitle>
            <AlertDialogDescription>
              {voidTarget
                ? `${KIND_LABEL[voidTarget.noteKind] ?? "Credit"} note ${voidTarget.creditNoteNo} will be cancelled. If it was already issued and posted, a reversing journal entry is created — nothing is deleted.`
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
                void handleVoid();
              }}
              disabled={actingId !== null}
            >
              Void
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
