"use client";

import { Ban, CheckCircle, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ALL_FILTER,
  formatCurrency,
  formatDate,
  JOURNAL_STATUSES,
} from "@/components/accounting/accounting-utils";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { FormDatePicker } from "@/components/shared/form-date-picker";
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
import { Textarea } from "@/components/ui/textarea";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  approveJournal,
  bulkDeleteJournals,
  cancelJournal,
  deleteAllJournals,
  type JournalEntry,
  type JournalSortField,
  listJournals,
  postJournal,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

interface JournalsTabProps {
  entities: Entity[];
  canApprove: boolean;
  canPost: boolean;
  canAdmin: boolean;
  onDataChanged: () => void;
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Description column toggle. `auto` prefers Thai when available so the
 *  page mirrors HR's existing GL output, then falls back to English. */
type DescriptionLang = "auto" | "en" | "th";

function pickDescription(
  j: JournalEntry,
  pref: DescriptionLang,
): string | null {
  if (pref === "en") return j.description ?? j.descriptionTh ?? null;
  if (pref === "th") return j.descriptionTh ?? j.description ?? null;
  return j.descriptionTh ?? j.description ?? null;
}

export function JournalsTab({
  entities,
  canApprove,
  canPost,
  canAdmin,
  onDataChanged,
}: JournalsTabProps) {
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState(ALL_FILTER);
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [descLang, setDescLang] = useState<DescriptionLang>("auto");
  const [sortBy, setSortBy] = useState<JournalSortField | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const pagination = usePagination();

  const handleSortChange = useCallback(
    (key: string) => {
      // Cycle unsorted → desc → asc → unsorted.
      setSortBy((prev) => {
        if (prev !== key) {
          setSortOrder("desc");
          return key as JournalSortField;
        }
        if (sortOrder === "desc") {
          setSortOrder("asc");
          return key as JournalSortField;
        }
        setSortOrder("desc");
        return undefined;
      });
    },
    [sortOrder],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<JournalEntry | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setBulkDeleteOpen(false);
      return;
    }
    try {
      setBulkDeleting(true);
      const res = await bulkDeleteJournals(ids);
      toast.success(
        `Deleted ${res.data.deletedCount} journal entr${res.data.deletedCount === 1 ? "y" : "ies"}`,
      );
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      void fetchJournals();
      onDataChanged();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete journals";
      toast.error(msg);
    } finally {
      setBulkDeleting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, onDataChanged]);

  const handleDeleteAll = useCallback(async () => {
    try {
      setBulkDeleting(true);
      const res = await deleteAllJournals();
      toast.success(
        `Deleted ${res.data.deletedCount} journal entr${res.data.deletedCount === 1 ? "y" : "ies"}`,
      );
      setSelectedIds(new Set());
      setDeleteAllOpen(false);
      void fetchJournals();
      onDataChanged();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete all journals";
      toast.error(msg);
    } finally {
      setBulkDeleting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDataChanged]);

  const fetchJournals = useCallback(async () => {
    if (
      startDate &&
      endDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
      /^\d{4}-\d{2}-\d{2}$/.test(endDate) &&
      endDate < startDate
    ) {
      toast.error("End date must not be before start date");
      setJournals([]);
      pagination.setTotalCount(0);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const result = await listJournals({
        page: pagination.page,
        limit: pagination.pageSize,
        entityId: entityFilter === ALL_FILTER ? undefined : entityFilter,
        status: statusFilter === ALL_FILTER ? undefined : statusFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        // "auto" shows every row — only EN/TH filter on the server.
        descriptionLang:
          descLang === "en" || descLang === "th" ? descLang : undefined,
        sortBy,
        sortOrder,
      });
      setJournals(result.data);
      pagination.setTotalCount(result.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to load journal entries";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pagination.page,
    pagination.pageSize,
    entityFilter,
    statusFilter,
    startDate,
    endDate,
    descLang,
    sortBy,
    sortOrder,
    pagination.setTotalCount,
  ]);

  useEffect(() => {
    void fetchJournals();
  }, [fetchJournals]);

  useEffect(() => {
    pagination.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    entityFilter,
    statusFilter,
    startDate,
    endDate,
    descLang,
    sortBy,
    sortOrder,
    pagination.setPage,
  ]);

  const handleApproveJournal = useCallback(
    async (je: JournalEntry) => {
      if (busyId) return;
      try {
        setBusyId(je.id);
        await approveJournal(je.id);
        toast.success("Journal entry approved and posted");
        void fetchJournals();
        onDataChanged();
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to approve entry";
        toast.error(msg);
      } finally {
        setBusyId(null);
      }
    },
    [busyId, fetchJournals, onDataChanged],
  );

  const handlePostJournal = useCallback(
    async (je: JournalEntry) => {
      try {
        await postJournal(je.id);
        toast.success("Journal entry posted");
        void fetchJournals();
        onDataChanged();
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to post entry";
        toast.error(msg);
      }
    },
    [fetchJournals, onDataChanged],
  );

  const handleCancelJournal = useCallback(async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    try {
      setCancelling(true);
      const res = await cancelJournal(cancelTarget.id, {
        reason: cancelReason.trim(),
      });
      toast.success(`Cancelled ${cancelTarget.entryNo}`);
      // A reversal into a later month can move tax out of a filed return, or
      // restate retained earnings. Shown after the fact because the
      // cancellation has already gone through — these are consequences to act
      // on, not a confirmation prompt. Long duration: the credit-note advice is
      // the actionable half and is easy to miss.
      for (const warning of res.data.warnings ?? []) {
        toast.warning(warning.message, { duration: 12000 });
      }
      setCancelTarget(null);
      setCancelReason("");
      void fetchJournals();
      onDataChanged();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to cancel entry";
      toast.error(msg);
    } finally {
      setCancelling(false);
    }
  }, [cancelTarget, cancelReason, fetchJournals, onDataChanged]);

  const columns = useMemo(
    () => [
      {
        key: "entryNo",
        header: "Number",
        sortable: true,
        render: (j: JournalEntry) => (
          <span className="font-medium tabular-nums">{j.entryNo}</span>
        ),
      },
      {
        key: "reference",
        mobileRole: "title" as const,
        header: "Reference",
        sortable: true,
        render: (j: JournalEntry) => (
          <span className="font-medium">{j.reference || "—"}</span>
        ),
      },
      {
        key: "date",
        mobileRole: "field" as const,
        header: "Date",
        sortable: true,
        render: (j: JournalEntry) => (
          <span className="tabular-nums">{formatDate(j.date)}</span>
        ),
      },
      {
        key: "entity",
        mobileRole: "detail" as const,
        header: "Entity",
        sortable: true,
        render: (j: JournalEntry) => j.entity.name,
      },
      {
        key: "description",
        mobileRole: "subtitle" as const,
        header: "Description",
        sortable: true,
        render: (j: JournalEntry) => {
          const text = pickDescription(j, descLang);
          // When the user picked a specific language but the row only
          // has the other variant, tag the cell so they aren't fooled
          // into thinking the toggle was respected.
          const fellBack =
            (descLang === "en" && !j.description && !!j.descriptionTh) ||
            (descLang === "th" && !j.descriptionTh && !!j.description);
          return (
            <span className="flex max-w-[280px] items-center gap-1.5">
              <span
                className="truncate"
                lang={descLang === "th" ? "th" : undefined}
              >
                {text || "—"}
              </span>
              {fellBack && (
                <Badge variant="grey" className="shrink-0 text-[10px]">
                  {descLang === "th" ? "EN" : "TH"}
                </Badge>
              )}
            </span>
          );
        },
      },
      {
        key: "totalDebit",
        mobileRole: "field" as const,
        header: "Debit",
        sortable: true,
        render: (j: JournalEntry) => (
          <span className="tabular-nums">{formatCurrency(j.totalDebit)}</span>
        ),
        className: "text-right",
      },
      {
        key: "totalCredit",
        mobileRole: "detail" as const,
        header: "Credit",
        sortable: true,
        render: (j: JournalEntry) => (
          <span className="tabular-nums">{formatCurrency(j.totalCredit)}</span>
        ),
        className: "text-right",
      },
      {
        key: "status",
        mobileRole: "badge" as const,
        header: "Status",
        sortable: true,
        render: (j: JournalEntry) => (
          <Badge status={j.status}>{j.status}</Badge>
        ),
      },
      {
        key: "actions",
        mobileRole: "actions" as const,
        header: "",
        render: (j: JournalEntry) => (
          <div className="flex items-center justify-end gap-1">
            {canApprove && j.status === "draft" && (
              <Button
                size="xs"
                variant="outline"
                disabled={busyId === j.id}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleApproveJournal(j);
                }}
              >
                <CheckCircle className="mr-1 size-3" />
                Approve
              </Button>
            )}
            {canPost && j.status === "approved" && (
              <Button
                size="xs"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  void handlePostJournal(j);
                }}
              >
                <Send className="mr-1 size-3" />
                Post
              </Button>
            )}
            {canPost &&
              (j.status === "posted" || j.status === "approved") &&
              !j.reversesEntryId &&
              (!j.sourceType || j.sourceType === "manual") &&
              (j.sourceType === "manual" || !!j.draftNo) && (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCancelReason("");
                    setCancelTarget(j);
                  }}
                >
                  <Ban className="mr-1 size-3" />
                  Cancel
                </Button>
              )}
          </div>
        ),
        className: "text-right",
      },
    ],
    [
      busyId,
      canApprove,
      canPost,
      handleApproveJournal,
      handlePostJournal,
      descLang,
    ],
  );

  const filtersDirty = useMemo(
    () =>
      entityFilter !== ALL_FILTER ||
      statusFilter !== ALL_FILTER ||
      !!startDate ||
      !!endDate ||
      descLang !== "auto",
    [entityFilter, statusFilter, startDate, endDate, descLang],
  );

  const journalDateRangeInvalid = useMemo(
    () =>
      Boolean(
        startDate &&
        endDate &&
        YMD_RE.test(startDate) &&
        YMD_RE.test(endDate) &&
        endDate < startDate,
      ),
    [startDate, endDate],
  );

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
          <SelectTrigger className="h-10 min-w-[120px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
            {JOURNAL_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <FormDatePicker
          value={startDate}
          onChange={(v) => setStartDate(v)}
          placeholder="Start date"
          className="h-8 w-auto text-xs"
          maxDate={YMD_RE.test(endDate) ? endDate : undefined}
        />
        <FormDatePicker
          value={endDate}
          onChange={(v) => setEndDate(v)}
          placeholder="End date"
          className="h-8 w-auto text-xs"
          minDate={YMD_RE.test(startDate) ? startDate : undefined}
        />

        <Select
          value={descLang}
          onValueChange={(v) => setDescLang(v as DescriptionLang)}
        >
          <SelectTrigger
            className="h-10 min-w-[140px] text-xs"
            aria-label="Description language"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Description: Auto</SelectItem>
            <SelectItem value="en">Description: EN</SelectItem>
            <SelectItem value="th">Description: TH</SelectItem>
          </SelectContent>
        </Select>

        {filtersDirty && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              setEntityFilter(ALL_FILTER);
              setStatusFilter(ALL_FILTER);
              setStartDate("");
              setEndDate("");
              setDescLang("auto");
            }}
            className="text-xs"
          >
            Clear
          </Button>
        )}

        <div className="md:ml-auto">
          {canAdmin && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteAllOpen(true)}
              disabled={pagination.totalCount === 0 && journals.length === 0}
              className={cn(`
                text-destructive
                hover:bg-destructive/10 hover:text-destructive
              `)}
            >
              <Trash2 className="size-3.5" />
              Delete all
            </Button>
          )}
        </div>
      </div>
      {journalDateRangeInvalid && (
        <p className="text-destructive px-1 text-xs" role="alert">
          End date must not be before start date. Adjust the range or clear
          filters.
        </p>
      )}

      <DataTable
        columns={columns}
        data={journals}
        loading={loading}
        emptyMessage="No journal entries found"
        enableRowSelection={canAdmin}
        selectedRowIds={selectedIds}
        onSelectedRowIdsChange={setSelectedIds}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        selectionActions={
          canAdmin ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
              className={`
                text-destructive h-7 px-2 text-xs
                hover:bg-destructive/10 hover:text-destructive
              `}
            >
              <Trash2 className="mr-1 size-3.5" />
              Delete selected
            </Button>
          ) : undefined
        }
        pagination={
          <DataPagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        }
      />

      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={(o) => !o && !bulkDeleting && setBulkDeleteOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete selected journal entries?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size} selected. Only drafts and rejected entries are
              removed. Issued numbers stay reserved — cancel those instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className={`
                bg-destructive
                hover:bg-destructive/90
              `}
            >
              Delete {selectedIds.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteAllOpen}
        onOpenChange={(o) => !o && !bulkDeleting && setDeleteAllOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete every journal entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes every draft and rejected journal. Posted, cancelled,
              and reversed entries keep their numbers and stay on the ledger.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={bulkDeleting}
              className={`
                bg-destructive
                hover:bg-destructive/90
              `}
            >
              Delete drafts
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={cancelTarget !== null}
        onOpenChange={(o) => {
          if (!o && !cancelling) {
            setCancelTarget(null);
            setCancelReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cancel {cancelTarget?.entryNo ?? "journal"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The number stays reserved. If this period is open, balances
              reverse immediately. If it is closed, a reversing journal is
              created in the current open period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Cancellation reason (required)"
            rows={3}
            disabled={cancelling}
            aria-label="Cancellation reason"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleCancelJournal();
              }}
              disabled={cancelling || !cancelReason.trim()}
              className={`
                bg-destructive
                hover:bg-destructive/90
              `}
            >
              Cancel entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
