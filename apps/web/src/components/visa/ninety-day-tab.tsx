"use client";

import { differenceInDays, format } from "date-fns";
import {
  AlertTriangle,
  Edit,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteNinetyDayDialog } from "@/components/visa/delete-ninety-day-dialog";
import { NinetyDayBulkImportDialog } from "@/components/visa/ninety-day-bulk-import-dialog";
import { NinetyDayDetailSheet } from "@/components/visa/ninety-day-detail-sheet";
import { NinetyDayFormDialog } from "@/components/visa/ninety-day-form-dialog";
import { NinetyDayNotificationConfigCard } from "@/components/visa/ninety-day-notification-config-card";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { type Entity, listEntities } from "@/services/entity.service";
import {
  listNinetyDayNotifications,
  NINETY_DAY_STATUS_LABELS,
  type NinetyDayNotification,
  type NinetyDayStatus,
} from "@/services/ninety-day.service";
import {
  bucketForDaysLeft,
  VISA_EXPIRY_BUCKETS,
  type VisaExpiryBucketId,
} from "@/services/visa.service";

const ALL_VALUE = "__all__";

// HR request (May 2026): keep the filter list in this explicit order
// so the toolbar reads the same way as their daily checklist.
const STATUS_FILTER_ORDER: NinetyDayStatus[] = [
  "pending",
  "to_be_notifying",
  "no_required",
  "approved",
];

// Status pill tone — green for approved (settled), grey for
// no_required (out-of-scope), blue for to_be_notifying (queued for
// outreach), amber for pending (action expected).
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

function fmt(dateStr: string): string {
  return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy");
}

interface DueEntry {
  record: NinetyDayNotification;
  daysLeft: number;
  bucket: VisaExpiryBucketId;
}

// HR-team feedback (2026-05-26): mirror the Visa Tracker's
// "Expiring soon" banner on the 90-Day tab. Same bucket sizing
// (1w / 2w / 1m / 2m / 3m) so the two tabs read consistently.
// Skip rows that are already resolved (`approved` / `no_required`).
function buildDueEntries(records: NinetyDayNotification[]): DueEntry[] {
  const out: DueEntry[] = [];
  const now = new Date();
  for (const r of records) {
    if (r.status === "approved" || r.status === "no_required") continue;
    const days = differenceInDays(new Date(r.dueDate), now);
    const bucket = bucketForDaysLeft(days);
    if (!bucket) continue;
    out.push({ record: r, daysLeft: days, bucket });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

function DueAlert({ entries }: { entries: DueEntry[] }) {
  if (entries.length === 0) return null;

  const grouped = new Map<VisaExpiryBucketId, DueEntry[]>();
  for (const e of entries) {
    const list = grouped.get(e.bucket) ?? [];
    list.push(e);
    grouped.set(e.bucket, list);
  }

  return (
    <div className="bg-warning/5 border-warning/20 mb-6 rounded-lg border p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="text-warning size-4" />
        <h3 className="text-foreground text-sm font-semibold">
          Due soon ({entries.length})
        </h3>
      </div>
      <div className="flex flex-col gap-3">
        {VISA_EXPIRY_BUCKETS.map((b) => {
          const items = grouped.get(b.id);
          if (!items || items.length === 0) return null;
          return (
            <div key={b.id} className="flex flex-col gap-1">
              <div
                className={`
                  text-muted-foreground text-[10px] font-semibold tracking-wide
                  uppercase
                `}
              >
                {b.label} · {items.length}
              </div>
              {items.map((e) => {
                const r = e.record;
                const isDependent =
                  r.holderType === "dependent" && r.holderName;
                const applicantName = isDependent
                  ? r.holderName
                  : (r.employee?.name ?? "—");
                return (
                  <div
                    key={r.id}
                    className={`
                      text-foreground-secondary flex items-center
                      justify-between text-[12.5px]
                    `}
                  >
                    <span>
                      <span className="text-foreground font-medium">
                        {applicantName}
                      </span>
                      {isDependent ? (
                        <span className="text-muted-foreground ml-1 text-[11px]">
                          ({r.holderRelationship || "dependent"} of{" "}
                          {r.employee?.name})
                        </span>
                      ) : null}
                      {r.entity ? (
                        <span className="text-muted-foreground">
                          {" "}
                          — {r.entity.name}
                        </span>
                      ) : null}
                    </span>
                    <Badge variant={b.tone}>
                      {e.daysLeft} day{e.daysLeft === 1 ? "" : "s"} left
                    </Badge>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface NinetyDayTabProps {
  /** Lets the page render this tab's action buttons in the page header. */
  onHeaderActions?: (node: ReactNode) => void;
}

export function NinetyDayTab({ onHeaderActions }: NinetyDayTabProps = {}) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("visa:manage");

  const [records, setRecords] = useState<NinetyDayNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | NinetyDayStatus>("");
  const [entityFilter, setEntityFilter] = useState("");
  const [entities, setEntities] = useState<Entity[]>([]);
  const debouncedSearch = useDebounce(search, 300);
  const pagination = usePagination();
  const { page, pageSize, setPage, setTotalCount, totalPages } = pagination;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages, setPage]);

  useEffect(() => {
    let cancelled = false;
    listEntities()
      .then((res) => {
        if (!cancelled) setEntities(res.data);
      })
      .catch(() => {
        // Optional dropdown — degrade silently for non-admin roles.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<NinetyDayNotification | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<NinetyDayNotification | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] =
    useState<NinetyDayNotification | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listNinetyDayNotifications({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        entityId: entityFilter || undefined,
      });
      setRecords(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to load 90-day notifications";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    debouncedSearch,
    statusFilter,
    entityFilter,
    setTotalCount,
  ]);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  const dueEntries = useMemo(() => buildDueEntries(records), [records]);

  // Action buttons surfaced in the page header (Leave-style). Stable state
  // setters → node identity only changes with `canManage`.
  const headerActions = useMemo<ReactNode>(() => {
    if (!canManage) return null;
    return (
      <>
        <Button
          variant="outline"
          onClick={() => setSettingsOpen(true)}
          title="90-day reminder settings"
        >
          <Settings className="mr-1.5 size-3.5" />
          Reminder settings
        </Button>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <UploadCloud className="mr-1.5 size-3.5" />
          Import
        </Button>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1.5 size-3.5" />
          New notification
        </Button>
      </>
    );
  }, [canManage]);

  useEffect(() => {
    onHeaderActions?.(headerActions);
    return () => onHeaderActions?.(null);
  }, [onHeaderActions, headerActions]);

  const handleSaved = useCallback(
    (saved: NinetyDayNotification) => {
      if (editing) {
        setRecords((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      } else {
        setTotalCount((c) => c + 1);
        if (page === 1) {
          setRecords((prev) => {
            const next = [saved, ...prev];
            return next.length > pageSize ? next.slice(0, pageSize) : next;
          });
        }
      }
    },
    [editing, page, pageSize, setTotalCount],
  );

  const handleDeleted = useCallback(
    (deleted: NinetyDayNotification) => {
      setRecords((prev) => prev.filter((r) => r.id !== deleted.id));
      setTotalCount((c) => Math.max(0, c - 1));
      setDeleting(null);
    },
    [setTotalCount],
  );

  function openEdit(r: NinetyDayNotification) {
    setEditing(r);
    setFormOpen(true);
  }

  function openDelete(r: NinetyDayNotification) {
    setDeleting(r);
    setDeleteOpen(true);
  }

  const columns = [
    {
      key: "applicant",
      header: "Name of Applicant",
      render: (r: NinetyDayNotification) => {
        const isDependent = r.holderType === "dependent" && r.holderName;
        return (
          <span className="text-foreground font-medium">
            {isDependent ? r.holderName : (r.employee?.name ?? r.employeeId)}
            {isDependent ? (
              <span
                className={`text-muted-foreground ml-1 text-[11px] font-normal`}
              >
                ({r.holderRelationship || "dependent"} of {r.employee?.name})
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: "entity",
      header: "Entity",
      render: (r: NinetyDayNotification) =>
        r.entity ? (
          <span className="text-foreground text-[12.5px]">{r.entity.name}</span>
        ) : (
          <span className="text-muted-foreground text-[12.5px]">—</span>
        ),
    },
    {
      key: "lastArrival",
      header: "Last Arrival Date",
      render: (r: NinetyDayNotification) => fmt(r.lastArrivalDate),
    },
    {
      key: "due",
      header: "90 Days Due Date",
      render: (r: NinetyDayNotification) => fmt(r.dueDate),
    },
    {
      key: "notify21",
      header: "21 Days Notification",
      render: (r: NinetyDayNotification) => fmt(r.notification21Date),
    },
    {
      key: "notify15",
      header: "15 Days Advance",
      render: (r: NinetyDayNotification) => fmt(r.notification15Date),
    },
    {
      key: "finalReport",
      header: "Last 7 Days Submission",
      render: (r: NinetyDayNotification) => fmt(r.finalReportDate),
    },
    {
      key: "status",
      header: "Status",
      render: (r: NinetyDayNotification) => (
        <Badge variant={statusTone(r.status)}>
          {NINETY_DAY_STATUS_LABELS[r.status]}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-10",
      render: (r: NinetyDayNotification) =>
        canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => openEdit(r)}>
                <Edit className="mr-2 size-3.5" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onSelect={() => openDelete(r)}
              >
                <Trash2 className="mr-2 size-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ];

  return (
    <div>
      <DueAlert entries={dueEntries} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            className={`
              text-muted-foreground pointer-events-none absolute top-1/2 left-3
              size-3.5 -translate-y-1/2
            `}
          />
          <Input
            placeholder="Search applicants…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              pagination.setPage(1);
            }}
            className="h-9 pl-9 text-[13px]"
          />
        </div>
        <Select
          value={statusFilter || ALL_VALUE}
          onValueChange={(v) => {
            setStatusFilter(v === ALL_VALUE ? "" : (v as NinetyDayStatus));
            pagination.setPage(1);
          }}
        >
          <SelectTrigger className="h-10 w-44 text-[13px]">
            <SelectValue placeholder="Sort by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
            {STATUS_FILTER_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {NINETY_DAY_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {entities.length > 0 && (
          <Select
            value={entityFilter || ALL_VALUE}
            onValueChange={(v) => {
              setEntityFilter(v === ALL_VALUE ? "" : v);
              pagination.setPage(1);
            }}
          >
            <SelectTrigger className="h-10 w-40 text-[13px]">
              <SelectValue placeholder="All entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All entities</SelectItem>
              {entities.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} ({e.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        emptyMessage="No 90-day notifications yet"
        onRowClick={(r) => {
          setDetailRecord(r);
          setDetailOpen(true);
        }}
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

      <NinetyDayFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        record={editing}
        onSaved={handleSaved}
      />

      <DeleteNinetyDayDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        record={deleting}
        onDeleted={handleDeleted}
      />

      <NinetyDayBulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          setImportOpen(false);
          void fetchRecords();
        }}
      />

      <NinetyDayDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        record={detailRecord}
        canManage={canManage}
        onEdit={(r) => {
          setEditing(r);
          setFormOpen(true);
        }}
      />

      {canManage && (
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent
            className={`
              max-h-[92vh] overflow-y-auto
              sm:max-w-2xl
            `}
          >
            <DialogHeader>
              <DialogTitle>90-day reminder recipients</DialogTitle>
              <DialogDescription>
                Manage the CC list that receives every TM.47 reminder email.
              </DialogDescription>
            </DialogHeader>
            <NinetyDayNotificationConfigCard />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
