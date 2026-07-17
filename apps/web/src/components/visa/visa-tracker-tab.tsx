"use client";

import { differenceInDays, format } from "date-fns";
import {
  AlertTriangle,
  BookOpen,
  Edit,
  ExternalLink,
  FileUp,
  ListChecks,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import Link from "next/link";
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
import { DeleteVisaDialog } from "@/components/visa/delete-visa-dialog";
import { VisaBulkImportDialog } from "@/components/visa/visa-bulk-import-dialog";
import { VisaDetailDialog } from "@/components/visa/visa-detail-dialog";
import { VisaFormDialog } from "@/components/visa/visa-form-dialog";
import { VisaNotificationConfigCard } from "@/components/visa/visa-notification-config-card";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { type Entity, listEntities } from "@/services/entity.service";
import {
  bucketForDaysLeft,
  listVisas,
  VISA_EXPIRY_BUCKETS,
  VISA_STATUS_LABELS,
  VISA_STATUSES,
  VISA_TYPE_LABELS,
  type VisaExpiryBucketId,
  type VisaRecord,
} from "@/services/visa.service";

const ALL_VALUE = "__all__";

interface ExpiryEntry {
  record: VisaRecord;
  source: "visa" | "work_permit";
  date: string;
  daysLeft: number;
  bucket: VisaExpiryBucketId;
}

// Walk both visa expiry and work-permit expiry. Each active record can
// contribute up to two entries — HR wants visibility on both.
function buildExpiryEntries(records: VisaRecord[]): ExpiryEntry[] {
  const out: ExpiryEntry[] = [];
  const now = new Date();
  for (const r of records) {
    if (r.status !== "active") continue;
    const candidates: Array<{
      source: ExpiryEntry["source"];
      date: string | null;
    }> = [
      { source: "visa", date: r.expiryDate },
      { source: "work_permit", date: r.workPermitExpiryDate },
    ];
    for (const c of candidates) {
      if (!c.date) continue;
      const days = differenceInDays(new Date(c.date), now);
      const bucket = bucketForDaysLeft(days);
      if (!bucket) continue;
      out.push({
        record: r,
        source: c.source,
        date: c.date,
        daysLeft: days,
        bucket,
      });
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

function ExpiringAlert({ entries }: { entries: ExpiryEntry[] }) {
  if (entries.length === 0) return null;

  const grouped = new Map<VisaExpiryBucketId, ExpiryEntry[]>();
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
          Expiring soon ({entries.length})
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
              {items.map((e, i) => (
                <div
                  key={`${e.record.id}-${e.source}-${i}`}
                  className={`
                    text-foreground-secondary flex items-center justify-between
                    text-[12.5px]
                  `}
                >
                  <span>
                    <span className="text-foreground font-medium">
                      {e.record.employee?.name}
                    </span>{" "}
                    —{" "}
                    {e.source === "work_permit"
                      ? `Work permit (${e.record.country})`
                      : `${VISA_TYPE_LABELS[e.record.visaType] ?? e.record.visaType} (${e.record.country})`}
                  </span>
                  <Badge variant={b.tone}>
                    {e.daysLeft} day{e.daysLeft === 1 ? "" : "s"} left
                  </Badge>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface VisaTrackerTabProps {
  /** Lets the page render this tab's action buttons in the page header. */
  onHeaderActions?: (node: ReactNode) => void;
}

export function VisaTrackerTab({ onHeaderActions }: VisaTrackerTabProps = {}) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("visa:manage");

  const [visas, setVisas] = useState<VisaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [entities, setEntities] = useState<Entity[]>([]);
  const debouncedSearch = useDebounce(search, 300);
  const pagination = usePagination();
  const { page, pageSize, setPage, setTotalCount, totalPages } = pagination;

  useEffect(() => {
    let cancelled = false;
    listEntities()
      .then((res) => {
        if (!cancelled) setEntities(res.data);
      })
      .catch(() => {
        // Entity picker is optional — silently degrade if the user lacks
        // admin:read / user:read (visa managers usually have one of
        // them, but custom roles may not).
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages, setPage]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingVisa, setEditingVisa] = useState<VisaRecord | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingVisa, setDeletingVisa] = useState<VisaRecord | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [viewingVisa, setViewingVisa] = useState<VisaRecord | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const fetchVisas = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listVisas({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        entityId: entityFilter || undefined,
      });
      setVisas(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load visa records";
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
    void fetchVisas();
  }, [fetchVisas]);

  const handleVisaSaved = useCallback(
    (saved: VisaRecord) => {
      if (editingVisa) {
        setVisas((prev) => prev.map((v) => (v.id === saved.id ? saved : v)));
      } else {
        setTotalCount((c) => c + 1);
        if (page === 1) {
          setVisas((prev) => {
            const next = [saved, ...prev];
            return next.length > pageSize ? next.slice(0, pageSize) : next;
          });
        }
      }
    },
    [editingVisa, page, pageSize, setTotalCount],
  );

  const handleVisaDeleted = useCallback(
    (deleted: VisaRecord) => {
      setVisas((prev) => prev.filter((v) => v.id !== deleted.id));
      setTotalCount((c) => Math.max(0, c - 1));
      setDeletingVisa(null);
    },
    [setTotalCount],
  );

  const expiryEntries = useMemo(() => buildExpiryEntries(visas), [visas]);

  // Action buttons surfaced in the page header (Leave-style). Built off
  // stable state setters so the node identity only changes with `canManage`.
  const headerActions = useMemo<ReactNode>(() => {
    if (!canManage) return null;
    return (
      <>
        <Button variant="outline" asChild>
          <Link href="/visa/knowledge-base">
            <BookOpen className="mr-1.5 size-3.5" />
            Knowledge base
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/visa/checklist-templates">
            <ListChecks className="mr-1.5 size-3.5" />
            Checklist templates
          </Link>
        </Button>
        <Button
          variant="outline"
          onClick={() => setSettingsOpen(true)}
          title="Expiry-reminder settings"
        >
          <Settings className="mr-1.5 size-3.5" />
          Reminder settings
        </Button>
        <Button variant="outline" onClick={() => setBulkImportOpen(true)}>
          <FileUp className="mr-1.5 size-3.5" />
          Bulk import
        </Button>
        <Button
          onClick={() => {
            setEditingVisa(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1.5 size-3.5" />
          New record
        </Button>
      </>
    );
  }, [canManage]);

  useEffect(() => {
    onHeaderActions?.(headerActions);
    return () => onHeaderActions?.(null);
  }, [onHeaderActions, headerActions]);

  function openEdit(visa: VisaRecord) {
    setEditingVisa(visa);
    setFormOpen(true);
  }

  function openDelete(visa: VisaRecord) {
    setDeletingVisa(visa);
    setDeleteOpen(true);
  }

  function openDetail(visa: VisaRecord) {
    setViewingVisa(visa);
    setDetailOpen(true);
  }

  const columns = [
    {
      key: "employee",
      header: "Holder",
      render: (v: VisaRecord) =>
        v.holderType === "dependent" ? (
          <div className="flex flex-col">
            <span className="text-foreground font-medium">
              {v.holderName ?? "Dependent"}
            </span>
            <span className="text-muted-foreground text-[11px]">
              {v.holderRelationship
                ? `${v.holderRelationship} of ${v.employee?.name ?? "—"}`
                : `Dependent of ${v.employee?.name ?? "—"}`}
            </span>
          </div>
        ) : (
          <span className="text-foreground font-medium">
            {v.employee?.name ?? v.employeeId}
          </span>
        ),
    },
    {
      key: "entity",
      header: "Entity",
      render: (v: VisaRecord) =>
        v.entity ? (
          <span className="text-foreground text-[12.5px]">{v.entity.name}</span>
        ) : (
          <span className="text-muted-foreground text-[12.5px]">—</span>
        ),
    },
    {
      key: "visaType",
      header: "Visa type",
      render: (v: VisaRecord) => VISA_TYPE_LABELS[v.visaType] ?? v.visaType,
    },
    {
      key: "country",
      header: "Country of Issue",
    },
    {
      key: "issueDate",
      header: "Issue date",
      render: (v: VisaRecord) =>
        v.issueDate
          ? format(
              new Date(String(v.issueDate).slice(0, 10) + "T00:00:00"),
              "MMM d, yyyy",
            )
          : "—",
    },
    {
      key: "expiryDate",
      header: "Expiry date",
      render: (v: VisaRecord) =>
        format(
          new Date(String(v.expiryDate).slice(0, 10) + "T00:00:00"),
          "MMM d, yyyy",
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (v: VisaRecord) => (
        <Badge status={v.status}>
          {VISA_STATUS_LABELS[v.status] ?? v.status}
        </Badge>
      ),
    },
    {
      key: "documentUrl",
      header: "Doc",
      className: "w-16",
      render: (v: VisaRecord) => {
        const docCount = Array.isArray(v.documents) ? v.documents.length : 0;
        if (docCount === 0 && !v.documentUrl) return "—";
        return (
          <span
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[12px]"
          >
            <ExternalLink className="text-muted-foreground size-3" />
            {docCount > 0
              ? `${docCount} file${docCount === 1 ? "" : "s"}`
              : "1 file"}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      className: "w-10",
      render: (v: VisaRecord) =>
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
              <DropdownMenuItem onSelect={() => openEdit(v)}>
                <Edit className="mr-2 size-3.5" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onSelect={() => openDelete(v)}
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
      <ExpiringAlert entries={expiryEntries} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            className={`
              text-muted-foreground pointer-events-none absolute top-1/2 left-3
              size-3.5 -translate-y-1/2
            `}
          />
          <Input
            placeholder="Search visas…"
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
            setStatusFilter(v === ALL_VALUE ? "" : v);
            pagination.setPage(1);
          }}
        >
          <SelectTrigger className="h-10 w-40 text-[13px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
            {VISA_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {VISA_STATUS_LABELS[s]}
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
        data={visas}
        loading={loading}
        emptyMessage="No visa records found"
        onRowClick={openDetail}
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

      {canManage && (
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent
            className={`
              max-h-[92vh] overflow-y-auto
              sm:max-w-2xl
            `}
          >
            <DialogHeader>
              <DialogTitle>Expiry-reminder settings</DialogTitle>
              <DialogDescription>
                Configure who receives visa / work-permit expiry reminders and
                when the cron fires.
              </DialogDescription>
            </DialogHeader>
            <VisaNotificationConfigCard />
          </DialogContent>
        </Dialog>
      )}

      <VisaFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        visa={editingVisa}
        onSaved={handleVisaSaved}
      />

      <DeleteVisaDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        visa={deletingVisa}
        onDeleted={handleVisaDeleted}
      />

      <VisaBulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onImported={() => void fetchVisas()}
      />

      <VisaDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        visa={viewingVisa}
      />
    </div>
  );
}
