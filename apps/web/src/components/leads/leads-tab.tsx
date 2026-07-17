"use client";

import { differenceInCalendarDays, format } from "date-fns";
import {
  AlarmClock,
  Edit,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { LeadSourcesManagerDialog } from "@/components/crm/lead-sources-manager-dialog";
import { ConvertLeadDialog } from "@/components/leads/convert-lead-dialog";
import { DisqualifyLeadDialog } from "@/components/leads/disqualify-lead-dialog";
import { LeadDetailSheet } from "@/components/leads/lead-detail-sheet";
import { LeadFormDialog } from "@/components/leads/lead-form-dialog";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { PermissionButton } from "@/components/shared/permission-button";
import { PermissionDropdownMenuItem } from "@/components/shared/permission-dropdown-menu-item";
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
  DropdownMenu,
  DropdownMenuContent,
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
import { Toggle } from "@/components/ui/toggle";
import { useDebounce } from "@/hooks/use-debounce";
import { useLeadSources } from "@/hooks/use-lead-sources";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import {
  deleteLead,
  type Lead,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  listLeads,
  listStaleLeads,
} from "@/services/crm-lead.service";

const ALL = "__all__";

export function LeadsTab() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  // Stale view: when active, hides status/source filters and
  // hits /leads/stale instead of the default list endpoint. Threshold
  // (server-defined) lands in `staleThreshold` so the banner stays in sync.
  const [staleOnly, setStaleOnly] = useState(false);
  const [staleThreshold, setStaleThreshold] = useState<number | null>(null);
  // Labels + select options come from the lead_sources table.
  const { sources } = useLeadSources();
  const sourceLabels = Object.fromEntries(
    sources.map((s) => [s.code, s.label]),
  );
  const debouncedSearch = useDebounce(search, 300);
  const pagination = usePagination();
  const { page, pageSize, setTotalCount } = pagination;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<Lead | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [disqualifyOpen, setDisqualifyOpen] = useState(false);
  const [disqualifying, setDisqualifying] = useState<Lead | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [converting, setConverting] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [sourcesManagerOpen, setSourcesManagerOpen] = useState(false);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      if (staleOnly) {
        const res = await listStaleLeads({
          page,
          limit: pageSize,
          search: debouncedSearch || undefined,
        });
        setLeads(res.data);
        setTotalCount(res.meta.total);
        setStaleThreshold(res.thresholdDays);
      } else {
        const res = await listLeads({
          page,
          limit: pageSize,
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
          source: sourceFilter || undefined,
        });
        setLeads(res.data);
        setTotalCount(res.meta.total);
        setStaleThreshold(null);
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load leads";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    debouncedSearch,
    statusFilter,
    sourceFilter,
    staleOnly,
    setTotalCount,
  ]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(lead: Lead) {
    if (lead.status === "converted" || lead.status === "disqualified") {
      toast.error(
        `Cannot edit a ${lead.status} lead. Use the convert/disqualify history instead.`,
      );
      return;
    }
    setEditing(lead);
    setFormOpen(true);
  }

  function openDelete(lead: Lead) {
    setDeleting(lead);
    setDeleteOpen(true);
  }

  function openDisqualify(lead: Lead) {
    if (lead.status === "converted" || lead.status === "disqualified") {
      toast.error(
        lead.status === "converted"
          ? "Cannot disqualify a converted lead."
          : "Lead is already disqualified.",
      );
      return;
    }
    setDisqualifying(lead);
    setDisqualifyOpen(true);
  }

  function openConvert(lead: Lead) {
    if (lead.status === "converted") {
      toast.error("Lead has already been converted.");
      return;
    }
    if (lead.status === "disqualified") {
      toast.error("Cannot convert a disqualified lead.");
      return;
    }
    setConverting(lead);
    setConvertOpen(true);
  }

  function openDetail(lead: Lead) {
    setDetailLeadId(lead.id);
    setDetailOpen(true);
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      setDeleteSubmitting(true);
      await deleteLead(deleting.id);
      toast.success("Lead deleted");
      setDeleteOpen(false);
      setDeleting(null);
      fetchLeads();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete lead";
      toast.error(message);
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const baseColumns = [
    {
      key: "company",
      header: "Company",
      render: (l: Lead) => (
        <button
          type="button"
          onClick={() => openDetail(l)}
          className={`
            text-foreground font-medium
            hover:text-primary hover:underline
          `}
        >
          {l.company}
        </button>
      ),
    },
    {
      key: "name",
      header: "Contact",
      render: (l: Lead) => `${l.firstName} ${l.lastName}`,
    },
    {
      key: "email",
      header: "Email",
      render: (l: Lead) => l.email || "—",
    },
    {
      key: "source",
      header: "Source",
      render: (l: Lead) => sourceLabels[l.source] ?? l.source,
    },
    {
      key: "status",
      header: "Status",
      render: (l: Lead) => (
        <Badge status={l.status}>
          {LEAD_STATUS_LABELS[l.status] ?? l.status}
        </Badge>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      render: (l: Lead) => l.owner?.name ?? "—",
    },
    {
      key: "createdAt",
      header: "Created",
      render: (l: Lead) => format(new Date(l.createdAt), "MMM d, yyyy"),
    },
  ];

  // Stale view swaps the trailing Created column for an Age column so the
  // rep can triage at a glance.
  const ageColumn = {
    key: "age",
    header: "Age",
    render: (l: Lead) => {
      const days = differenceInCalendarDays(new Date(), new Date(l.createdAt));
      return (
        <span className="text-destructive font-medium tabular-nums">
          {days}d
        </span>
      );
    },
  };

  const columns = [
    ...(staleOnly
      ? baseColumns.filter((c) => c.key !== "createdAt").concat(ageColumn)
      : baseColumns),
    {
      key: "actions",
      header: "",
      className: "w-10",
      render: (l: Lead) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <PermissionDropdownMenuItem
              permissions={["crm:update"]}
              onClick={() => openEdit(l)}
              disabled={l.status === "converted" || l.status === "disqualified"}
            >
              <Edit className="mr-2 size-3.5" />
              Edit
            </PermissionDropdownMenuItem>
            <PermissionDropdownMenuItem
              permissions={["crm:update"]}
              onClick={() => openConvert(l)}
              disabled={l.status === "converted" || l.status === "disqualified"}
            >
              <Sparkles className="mr-2 size-3.5" />
              Convert
            </PermissionDropdownMenuItem>
            <PermissionDropdownMenuItem
              permissions={["crm:update"]}
              onClick={() => openDisqualify(l)}
              disabled={l.status === "converted" || l.status === "disqualified"}
            >
              <XCircle className="mr-2 size-3.5" />
              Disqualify
            </PermissionDropdownMenuItem>
            <DropdownMenuSeparator />
            <PermissionDropdownMenuItem
              permissions={["crm:delete"]}
              className="text-destructive"
              onClick={() => openDelete(l)}
            >
              <Trash2 className="mr-2 size-3.5" />
              Delete
            </PermissionDropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search
              className={`
                text-muted-foreground pointer-events-none absolute top-1/2
                left-3 size-3.5 -translate-y-1/2
              `}
            />
            <Input
              placeholder="Search leads…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                pagination.setPage(1);
              }}
              className="pl-9"
            />
          </div>
          {staleOnly ? null : (
            <>
              <Select
                value={statusFilter || ALL}
                onValueChange={(v) => {
                  setStatusFilter(v === ALL ? "" : v);
                  pagination.setPage(1);
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {LEAD_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {LEAD_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={sourceFilter || ALL}
                onValueChange={(v) => {
                  setSourceFilter(v === ALL ? "" : v);
                  pagination.setPage(1);
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All sources</SelectItem>
                  {sources.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <Toggle
            variant="outline"
            size="default"
            pressed={staleOnly}
            onPressedChange={(v) => {
              setStaleOnly(v);
              pagination.setPage(1);
            }}
          >
            <AlarmClock className="mr-1.5 size-3.5" />
            Stale only
          </Toggle>
        </div>
        <div className="flex items-center gap-2">
          <PermissionButton
            permission="crm:admin"
            variant="outline"
            onClick={() => setSourcesManagerOpen(true)}
          >
            <Settings2 className="mr-1.5 size-3.5" />
            Manage sources
          </PermissionButton>
          <PermissionButton permission="crm:create" onClick={openCreate}>
            <Plus className="mr-1.5 size-3.5" />
            New lead
          </PermissionButton>
        </div>
      </div>

      {staleOnly ? (
        <div
          className={`
            border-destructive/40 bg-destructive/5 text-destructive mb-3
            rounded-md border px-3 py-2 text-xs
          `}
        >
          Showing leads in <span className="font-semibold">new</span> /{" "}
          <span className="font-semibold">contacted</span> with no activity in
          the last {staleThreshold ?? 14} days.{" "}
          <span className="font-semibold">{pagination.totalCount}</span>{" "}
          {pagination.totalCount === 1 ? "lead needs" : "leads need"} follow-up.
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={leads}
        loading={loading}
        emptyMessage={
          staleOnly
            ? "No stale leads. Pipeline is healthy."
            : "No leads yet. Capture an inquiry to start working it."
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

      <LeadFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        lead={editing}
        onSaved={fetchLeads}
      />

      <DisqualifyLeadDialog
        open={disqualifyOpen}
        onOpenChange={setDisqualifyOpen}
        lead={disqualifying}
        onDone={fetchLeads}
      />

      <ConvertLeadDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        lead={converting}
        onDone={fetchLeads}
      />

      <LeadDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        leadId={detailLeadId}
        onEdit={(l) => {
          setDetailOpen(false);
          openEdit(l);
        }}
        onConvert={(l) => {
          setDetailOpen(false);
          openConvert(l);
        }}
        onDisqualify={(l) => {
          setDetailOpen(false);
          openDisqualify(l);
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `${deleting.firstName} ${deleting.lastName} at ${deleting.company} will be permanently removed. Activities tied to this lead are removed too.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteSubmitting}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LeadSourcesManagerDialog
        open={sourcesManagerOpen}
        onOpenChange={(next) => {
          setSourcesManagerOpen(next);
          if (!next) {
            // Reflect any source edits in the leads-tab filter dropdown
            // immediately. The cache is invalidated inside the dialog;
            // re-fetch here to repopulate the local copy.
            fetchLeads();
          }
        }}
      />
    </div>
  );
}
