"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Table2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CampaignFormDialog } from "@/app/(dashboard)/marketing-analytics/campaigns/campaign-form-dialog";
import { LeversManageDialog } from "@/app/(dashboard)/marketing-analytics/campaigns/levers-manage-dialog";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs } from "@/components/shared/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { useTabParam } from "@/hooks/use-tab-param";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import {
  archiveCampaign,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUSES,
  type CampaignListItem,
  deleteCampaign,
  listCampaigns,
  unarchiveCampaign,
} from "@/services/marketing-campaigns.service";

type ViewMode = "table" | "calendar";
type CalendarScale = "month" | "week" | "day";

export default function CampaignsPage() {
  const { hasPermission, hasAnyPermission } = useAuth();
  const canView = hasAnyPermission(
    "marketing:campaign:view",
    "marketing:campaign:create",
    "marketing:campaign:update",
    "marketing:campaign:delete",
  );
  const canCreate = hasPermission("marketing:campaign:create");
  const canUpdate = hasPermission("marketing:campaign:update");
  const canDelete = hasPermission("marketing:campaign:delete");

  const [view, setView] = useState<ViewMode>("table");

  if (!canView) {
    return (
      <div className="px-6 py-6">
        <PageHeader title="Campaigns" />
        <p className="text-muted-foreground text-sm">
          You don&apos;t have access to Campaign CRM.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Campaign CRM"
        subtitle="Plan, schedule, and track marketing campaigns"
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/marketing-analytics">
            <ArrowLeft className="mr-1 size-3.5" />
            Marketing Analytics
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setView(view === "table" ? "calendar" : "table")}
        >
          {view === "table" ? (
            <CalendarDays className="mr-1 size-3.5" />
          ) : (
            <Table2 className="mr-1 size-3.5" />
          )}
          {view === "table" ? "Calendar" : "Table"}
        </Button>
        {canUpdate && <LeversManageDialog />}
      </PageHeader>

      {view === "table" ? (
        <CampaignTable
          canCreate={canCreate}
          canUpdate={canUpdate}
          canDelete={canDelete}
        />
      ) : (
        <CampaignCalendar />
      )}
    </div>
  );
}

// ─────────────────────────── Table view ───────────────────────────

function CampaignTable({
  canCreate,
  canUpdate,
  canDelete,
}: {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const [rows, setRows] = useState<CampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  // Active | Archived view. Archive is orthogonal to the status filter — the
  // Archived tab shows archived campaigns regardless of their status.
  // Persisted in the URL (?tab=) so a hard reload stays on the same view.
  const [archiveTab, setArchiveTab] = useTabParam("active");
  const archived = archiveTab === "archived";
  const debounced = useDebounce(search, 350);
  const pagination = usePagination();
  const { setTotalCount, setPage } = pagination;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listCampaigns({
        page: pagination.page,
        limit: pagination.pageSize,
        search: debounced || undefined,
        status:
          status !== "all" ? (status as CampaignListItem["status"]) : undefined,
        archived: archived || undefined,
      });
      setRows(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.pageSize,
    debounced,
    status,
    archived,
    setTotalCount,
  ]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this campaign and its assets?")) return;
    try {
      await deleteCampaign(id);
      toast.success("Deleted");
      void fetchRows();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete");
    }
  }

  // Archive / restore. The current view (active vs archived) is the opposite of
  // the row's new state, so the row leaves the list either way — drop it
  // optimistically and adjust the total.
  async function handleArchive(id: string) {
    try {
      await archiveCampaign(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setTotalCount((c) => Math.max(0, c - 1));
      toast.success("Campaign archived");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to archive");
    }
  }

  async function handleUnarchive(id: string) {
    try {
      await unarchiveCampaign(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setTotalCount((c) => Math.max(0, c - 1));
      toast.success("Campaign restored");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to restore");
    }
  }

  return (
    <div>
      <Tabs
        tabs={[
          { id: "active", label: "Active" },
          { id: "archived", label: "Archived" },
        ]}
        active={archiveTab}
        onChange={(v) => {
          setArchiveTab(v);
          setPage(1);
        }}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search campaigns…"
          className="h-9 max-w-xs"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {CAMPAIGN_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {CAMPAIGN_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        {canCreate && (
          <Button
            size="sm"
            onClick={() => {
              setEditingId(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1 size-4" />
            New Campaign
          </Button>
        )}
      </div>

      <DataTable
        loading={loading}
        data={rows}
        emptyMessage="No campaigns"
        columns={[
          {
            key: "name",
            header: "Campaign",
            render: (r) => (
              <Link
                href={`/marketing-analytics/campaigns/${r.id}`}
                className={`
                  hover:text-primary hover:underline
                  font-medium
                `}
              >
                {r.name}
              </Link>
            ),
          },
          {
            key: "campaignDate",
            mobileRole: "field" as const,
            header: "Date",
            render: (r) => new Date(r.campaignDate).toLocaleDateString("en-GB"),
          },
          {
            key: "channel",
            mobileRole: "field" as const,
            header: "Channel",
            render: (r) => r.channel ?? "—",
          },
          {
            key: "owner",
            mobileRole: "subtitle" as const,
            header: "Owner",
            render: (r) => r.owner?.name ?? "—",
          },
          {
            key: "levers",
            mobileRole: "detail" as const,
            header: "Levers",
            render: (r) =>
              r.levers.length ? (
                <div className="flex flex-wrap gap-1">
                  {r.levers.slice(0, 3).map((l) => (
                    <Badge key={l.id} variant="grey">
                      {l.name}
                    </Badge>
                  ))}
                  {r.levers.length > 3 && (
                    <span className="text-muted-foreground text-xs">
                      +{r.levers.length - 3}
                    </span>
                  )}
                </div>
              ) : (
                "—"
              ),
          },
          {
            key: "status",
            mobileRole: "badge" as const,
            header: "Status",
            render: (r) => (
              <Badge status={r.status}>
                {CAMPAIGN_STATUS_LABELS[r.status]}
              </Badge>
            ),
          },
          {
            key: "actions",
            mobileRole: "actions" as const,
            header: "",
            className: "w-[120px] text-right",
            render: (r) => (
              <div className="flex justify-end gap-1">
                {canUpdate && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setEditingId(r.id);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                )}
                {canUpdate &&
                  (archived ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Restore"
                      onClick={() => void handleUnarchive(r.id)}
                    >
                      <ArchiveRestore className="size-3.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Archive"
                      onClick={() => void handleArchive(r.id)}
                    >
                      <Archive className="size-3.5" />
                    </Button>
                  ))}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    onClick={() => handleDelete(r.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            ),
          },
        ]}
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

      {dialogOpen && (
        <CampaignFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          campaignId={editingId}
          onSaved={() => {
            setDialogOpen(false);
            void fetchRows();
          }}
        />
      )}
    </div>
  );
}

// ───────────────────────── Calendar view ─────────────────────────

function CampaignCalendar() {
  const [anchor, setAnchor] = useState(new Date());
  const [scale, setScale] = useState<CalendarScale>("month");
  const [rows, setRows] = useState<CampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    if (scale === "day") return { start: anchor, end: anchor };
    if (scale === "week") {
      return {
        start: startOfWeek(anchor, { weekStartsOn: 1 }),
        end: endOfWeek(anchor, { weekStartsOn: 1 }),
      };
    }
    return {
      start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
    };
  }, [anchor, scale]);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listCampaigns({
        limit: 200,
        from: format(range.start, "yyyy-MM-dd"),
        to: format(range.end, "yyyy-MM-dd"),
      });
      setRows(res.data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const days = eachDayOfInterval({ start: range.start, end: range.end });
  const byDay = useMemo(() => {
    const map = new Map<string, CampaignListItem[]>();
    for (const c of rows) {
      const key = format(parseISO(c.campaignDate), "yyyy-MM-dd");
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return map;
  }, [rows]);

  function shift(dir: -1 | 1) {
    if (scale === "month") setAnchor((a) => addMonths(a, dir));
    else if (scale === "week") {
      setAnchor((a) => new Date(a.getTime() + dir * 7 * 86400000));
    } else setAnchor((a) => new Date(a.getTime() + dir * 86400000));
  }

  const heading =
    scale === "day"
      ? format(anchor, "EEEE, d MMM yyyy")
      : scale === "week"
        ? `${format(range.start, "d MMM")} – ${format(range.end, "d MMM yyyy")}`
        : format(anchor, "MMMM yyyy");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={() => shift(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => shift(1)}>
          <ChevronRight className="size-4" />
        </Button>
        <span className="text-sm font-medium">{heading}</span>
        <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>
          Today
        </Button>
        <div className="flex-1" />
        <Select
          value={scale}
          onValueChange={(v) => setScale(v as CalendarScale)}
        >
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Monthly</SelectItem>
            <SelectItem value="week">Weekly</SelectItem>
            <SelectItem value="day">Daily</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
        </div>
      ) : scale === "day" ? (
        <DayList
          day={anchor}
          items={byDay.get(format(anchor, "yyyy-MM-dd")) ?? []}
        />
      ) : (
        <div
          className={`grid grid-cols-7 gap-px overflow-hidden rounded-lg border`}
        >
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div
              key={d}
              className={`
                bg-muted/50 text-muted-foreground p-2 text-center text-xs
                font-medium
              `}
            >
              {d}
            </div>
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const items = byDay.get(key) ?? [];
            const muted = scale === "month" && !isSameMonth(day, anchor);
            return (
              <div
                key={key}
                className={cn(
                  "bg-card min-h-[92px] p-1.5",
                  muted && "bg-muted/20 text-muted-foreground",
                  isSameDay(day, new Date()) &&
                    "ring-primary/40 ring-1 ring-inset",
                )}
              >
                <div className="mb-1 text-xs font-medium">
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {items.slice(0, 4).map((c) => (
                    <Link
                      key={c.id}
                      href={`/marketing-analytics/campaigns/${c.id}`}
                      className={`
                        bg-primary/10 text-primary block truncate rounded px-1
                        py-0.5 text-[11px]
                        hover:underline
                      `}
                      title={c.name}
                    >
                      {c.name}
                    </Link>
                  ))}
                  {items.length > 4 && (
                    <span className="text-muted-foreground text-[10px]">
                      +{items.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DayList({ day, items }: { day: Date; items: CampaignListItem[] }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="mb-3 text-sm font-medium">
          {format(day, "EEEE, d MMMM")}
        </p>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No campaigns on this day.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((c) => (
              <Link
                key={c.id}
                href={`/marketing-analytics/campaigns/${c.id}`}
                className={`
                  border-border flex items-center justify-between rounded-lg
                  border p-2.5 text-sm
                  hover:bg-muted/40
                `}
              >
                <span className="font-medium">{c.name}</span>
                <Badge status={c.status}>
                  {CAMPAIGN_STATUS_LABELS[c.status]}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
