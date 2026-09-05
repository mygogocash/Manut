"use client";

import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { CampaignFormDialog } from "@/components/partners/campaign-form-dialog";
import { MarketingCrmTabs } from "@/components/partners/marketing-crm-tabs";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
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
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";
import {
  CAMPAIGN_STATUSES,
  deleteMarketingCampaign,
  getCampaignPredictionUrl,
  listMarketingCampaigns,
  type MarketingCampaign,
} from "@/services/marketing.service";

const ALL = "__all__";

export default function CampaignsPage() {
  const { hasPermission } = useAuth();
  const canManage =
    hasPermission("partners:create") || hasPermission("partners:update");
  const canDelete = hasPermission("partners:delete");

  const [rows, setRows] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingCampaign | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MarketingCampaign | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const {
    page,
    pageSize,
    totalCount,
    totalPages,
    setPage,
    setPageSize,
    setTotalCount,
  } = usePagination();

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listMarketingCampaigns({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        status: statusFilter === ALL ? undefined : statusFilter,
      });
      setRows(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load campaigns"));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter, setTotalCount]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, setPage]);

  async function handleDownloadPrediction(id: string) {
    try {
      const res = await getCampaignPredictionUrl(id);
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't open the prediction file"));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteMarketingCampaign(deleteTarget.id);
      toast.success("Campaign deleted");
      setDeleteTarget(null);
      void fetchRows();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete campaign"));
    } finally {
      setDeleting(false);
    }
  }

  const statusLabel = (v: string) =>
    CAMPAIGN_STATUSES.find((s) => s.value === v)?.label ?? v;

  const columns = [
    {
      key: "title",
      header: "Campaign",
      render: (c: MarketingCampaign) => (
        <span className="text-foreground text-xs font-medium">{c.title}</span>
      ),
    },
    {
      key: "campaignDate",
      mobileRole: "field" as const,
      header: "Date",
      render: (c: MarketingCampaign) => (
        <span className="tabular-nums">
          {new Date(c.campaignDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "hours",
      mobileRole: "field" as const,
      header: "Hours",
      render: (c: MarketingCampaign) => (
        <span className="tabular-nums">{c.hours ?? "—"}</span>
      ),
    },
    {
      key: "status",
      mobileRole: "badge" as const,
      header: "Status",
      render: (c: MarketingCampaign) => (
        <Badge status={c.status}>{statusLabel(c.status)}</Badge>
      ),
    },
    {
      key: "prediction",
      mobileRole: "detail" as const,
      header: "Prediction",
      render: (c: MarketingCampaign) =>
        c.predictionFileUrl ? (
          <Button
            size="sm"
            variant="ghost"
            type="button"
            className="h-7 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              void handleDownloadPrediction(c.id);
            }}
          >
            <Download className="mr-1 size-3.5" />
            Sheet
          </Button>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "creator",
      mobileRole: "subtitle" as const,
      header: "Added by",
      render: (c: MarketingCampaign) => (
        <span className="text-muted-foreground text-xs">
          {c.creator?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "actions",
      mobileRole: "actions" as const,
      header: "",
      className: "w-[80px]",
      render: (c: MarketingCampaign) =>
        canManage ? (
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              type="button"
              aria-label="Edit campaign"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(c);
                setDialogOpen(true);
              }}
            >
              <Pencil className="size-3.5" />
            </Button>
            {canDelete && (
              <Button
                size="icon-sm"
                variant="ghost"
                type="button"
                className="text-destructive"
                aria-label="Delete campaign"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(c);
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Marketing CRM"
        subtitle="Manage marketing campaigns and partner relationships"
      />

      <MarketingCrmTabs />

      <div
        className={`
          border-border bg-surface flex items-center gap-2 rounded-lg border p-3
          shadow-sm
        `}
      >
        <Input
          placeholder="Search campaigns…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 max-w-xs text-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 w-[150px] text-xs">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {CAMPAIGN_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {canManage && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            Add campaign
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        onRowClick={
          canManage
            ? (c) => {
                setEditing(c);
                setDialogOpen(true);
              }
            : undefined
        }
        emptyMessage="No campaigns yet"
        pagination={
          <DataPagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        }
      />

      <CampaignFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        campaign={editing}
        onSaved={fetchRows}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  &ldquo;{deleteTarget.title}&rdquo; will be permanently
                  removed.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className={`
                bg-destructive
                hover:bg-destructive/90
              `}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
