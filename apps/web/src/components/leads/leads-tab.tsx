"use client";

import { differenceInCalendarDays, format } from "date-fns";
import {
  AlarmClock,
  Archive,
  ArchiveRestore,
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

import { BulkBusinessUnitsDialog } from "@/components/crm/bulk-business-units-dialog";
import {
  BulkFieldDialog,
  type BulkFieldMode,
} from "@/components/crm/bulk-field-dialog";
import { BusinessUnitChips } from "@/components/crm/business-unit-chips";
import { LeadSourcesManagerDialog } from "@/components/crm/lead-sources-manager-dialog";
import { ConvertLeadDialog } from "@/components/leads/convert-lead-dialog";
import { DisqualifyLeadDialog } from "@/components/leads/disqualify-lead-dialog";
import { LeadDetailSheet } from "@/components/leads/lead-detail-sheet";
import { LeadFormDialog } from "@/components/leads/lead-form-dialog";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { type Column, DataTable } from "@/components/shared/data-table";
import { PermissionButton } from "@/components/shared/permission-button";
import { PermissionDropdownMenuItem } from "@/components/shared/permission-dropdown-menu-item";
import { Tabs } from "@/components/shared/tabs";
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
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { useBusinessUnits } from "@/hooks/use-business-units";
import { useDebounce } from "@/hooks/use-debounce";
import { useLeadSources } from "@/hooks/use-lead-sources";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { BUSINESS_UNIT_UNASSIGNED } from "@/services/crm-business-unit.service";
import {
  archiveLead,
  deleteLead,
  type Lead,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  listLeads,
  listStaleLeads,
  unarchiveLead,
} from "@/services/crm-lead.service";
import {
  bulkAssignLeadsBusinessUnits,
  bulkUpdateLeadsFields,
} from "@/services/crm-lead.service";

const ALL = "__all__";

export function LeadsTab() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  // "Who is taking care of this lead" tag filter.
  const [businessUnitFilter, setBusinessUnitFilter] = useState("");
  // PRD §11.3 stale view — when active, hides status/source filters and
  // hits /leads/stale instead of the default list endpoint. Threshold
  // (server-defined) lands in `staleThreshold` so the banner stays in sync.
  const [staleOnly, setStaleOnly] = useState(false);
  const [staleThreshold, setStaleThreshold] = useState<number | null>(null);
  // Active (default) vs Archived view. Orthogonal to status/source filters and
  // to the stale sub-view — archived rows are excluded from the stale surface,
  // so the Stale toggle is hidden while the Archived tab is active.
  const [archived, setArchived] = useState(false);
  // PRD §11.7 — labels + select options come from the lead_sources table.
  const { sources } = useLeadSources();
  const { units: businessUnits } = useBusinessUnits();
  const sourceLabels = Object.fromEntries(
    sources.map((s) => [s.code, s.label]),
  );
  const debouncedSearch = useDebounce(search, 300);
  const pagination = usePagination();
  const { page, pageSize, setTotalCount } = pagination;

  // Bulk select-and-act. The total comes from the server (`pagination`), never
  // from `leads.length` — the table holds one page.
  const selection = useBulkSelection(pagination.totalCount);
  const [bulkUnitsOpen, setBulkUnitsOpen] = useState(false);
  const [bulkFieldMode, setBulkFieldMode] = useState<BulkFieldMode | null>(
    null,
  );

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
      // Stale is an Active-view sub-surface; it never applies to Archived.
      if (staleOnly && !archived) {
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
          businessUnit: businessUnitFilter || undefined,
          archived: archived || undefined,
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
    businessUnitFilter,
    staleOnly,
    archived,
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

  // Archive / restore. The current view is the opposite of the row's new
  // state, so the row leaves the current list either way — drop it
  // optimistically and adjust the total.
  async function handleArchive(lead: Lead) {
    try {
      await archiveLead(lead.id);
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      setTotalCount((c) => Math.max(0, c - 1));
      toast.success("Lead archived");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to archive lead";
      toast.error(message);
    }
  }

  async function handleUnarchive(lead: Lead) {
    try {
      await unarchiveLead(lead.id);
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      setTotalCount((c) => Math.max(0, c - 1));
      toast.success("Lead restored");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to restore lead";
      toast.error(message);
    }
  }

  const baseColumns: Column<Lead>[] = [
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
      mobileRole: "subtitle" as const,
      header: "Contact",
      render: (l: Lead) => `${l.firstName} ${l.lastName}`,
    },
    {
      key: "email",
      mobileRole: "detail" as const,
      header: "Email",
      render: (l: Lead) => l.email || "—",
    },
    {
      key: "source",
      mobileRole: "detail" as const,
      header: "Source",
      render: (l: Lead) => sourceLabels[l.source] ?? l.source,
    },
    {
      key: "businessUnits",
      header: "Business units",
      render: (l: Lead) =>
        l.businessUnits?.length ? (
          <BusinessUnitChips codes={l.businessUnits} />
        ) : (
          "—"
        ),
    },
    {
      key: "status",
      mobileRole: "badge" as const,
      header: "Status",
      render: (l: Lead) => (
        <Badge status={l.status}>
          {LEAD_STATUS_LABELS[l.status] ?? l.status}
        </Badge>
      ),
    },
    {
      key: "owner",
      mobileRole: "field" as const,
      header: "Owner",
      render: (l: Lead) => l.owner?.name ?? "—",
    },
    {
      key: "createdAt",
      mobileRole: "detail" as const,
      header: "Created",
      render: (l: Lead) => format(new Date(l.createdAt), "MMM d, yyyy"),
    },
  ];

  // Stale view swaps the trailing Created column for an Age column so the
  // rep can triage at a glance.
  const ageColumn: Column<Lead> = {
    key: "age",
    mobileRole: "field" as const,
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
      mobileRole: "actions" as const,
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
            {archived ? (
              <PermissionDropdownMenuItem
                permissions={["crm:update"]}
                onClick={() => void handleUnarchive(l)}
              >
                <ArchiveRestore className="mr-2 size-3.5" />
                Restore
              </PermissionDropdownMenuItem>
            ) : (
              <PermissionDropdownMenuItem
                permissions={["crm:update"]}
                onClick={() => void handleArchive(l)}
              >
                <Archive className="mr-2 size-3.5" />
                Archive
              </PermissionDropdownMenuItem>
            )}
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
      <Tabs
        tabs={[
          { id: "active", label: "Active" },
          { id: "archived", label: "Archived" },
        ]}
        active={archived ? "archived" : "active"}
        onChange={(v) => {
          const next = v === "archived";
          setArchived(next);
          // Stale is Active-only; drop it when entering the Archived tab.
          if (next) setStaleOnly(false);
          pagination.setPage(1);
        }}
      />

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
              <Select
                value={businessUnitFilter || ALL}
                onValueChange={(v) => {
                  setBusinessUnitFilter(v === ALL ? "" : v);
                  pagination.setPage(1);
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All business units" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All business units</SelectItem>
                  {businessUnits.map((u) => (
                    <SelectItem key={u.code} value={u.code}>
                      {u.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={BUSINESS_UNIT_UNASSIGNED}>
                    Unassigned
                  </SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
          {archived ? null : (
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
          )}
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
        enableRowSelection
        getRowId={(lead) => lead.id}
        selectedRowIds={new Set(selection.ids)}
        onSelectedRowIdsChange={(ids) => selection.replaceIds([...ids])}
        selectionActions={
          <div className="flex items-center gap-2">
            {!selection.allMatching &&
              pagination.totalCount > selection.ids.length && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={selection.selectAllMatching}
                >
                  Select all {pagination.totalCount} matching
                </Button>
              )}
            <Button size="sm" onClick={() => setBulkUnitsOpen(true)}>
              Business units
            </Button>
            {/*
              No Owner action here: a lead's owner is fixed at creation and can
              only move during convert, so `bulkLeadFieldSetSchema` omits the
              field rather than accepting and dropping it.
            */}
            <Button size="sm" onClick={() => setBulkFieldMode("lifecycle")}>
              Status
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setBulkFieldMode(archived ? "unarchive" : "archive")
              }
            >
              {archived ? "Restore" : "Archive"}
            </Button>
          </div>
        }
        emptyMessage={
          staleOnly
            ? "No stale leads. Pipeline is healthy."
            : archived
              ? "No archived leads."
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

      <BulkFieldDialog
        mode={bulkFieldMode}
        onClose={() => setBulkFieldMode(null)}
        count={selection.count}
        recordLabel={selection.count === 1 ? "lead" : "leads"}
        selection={{
          ...(selection.allMatching
            ? {
                allMatching: true,
                filter: {
                  search: search || undefined,
                  status: statusFilter || undefined,
                  source: sourceFilter || undefined,
                  businessUnit: businessUnitFilter || undefined,
                  archived: archived || undefined,
                },
              }
            : { ids: selection.ids }),
        }}
        lifecycle={{
          field: "status",
          label: "Set status",
          // Rep-settable statuses only. `converted` and `disqualified` are
          // terminal and have dedicated flows — convert creates an
          // opportunity, disqualify captures a reason.
          options: (["new", "contacted", "qualified"] as const).map(
            (value) => ({
              value,
              label: LEAD_STATUS_LABELS[value],
            }),
          ),
        }}
        submit={bulkUpdateLeadsFields}
        onDone={() => {
          selection.clear();
          void fetchLeads();
        }}
      />

      <BulkBusinessUnitsDialog
        open={bulkUnitsOpen}
        onOpenChange={setBulkUnitsOpen}
        count={selection.count}
        recordLabel={selection.count === 1 ? "lead" : "leads"}
        selection={{
          ...(selection.allMatching
            ? {
                allMatching: true,
                // The filter MUST mirror what the list is showing, or
                // "select all matching" acts on rows the user never saw.
                filter: {
                  search: search || undefined,
                  status: statusFilter || undefined,
                  source: sourceFilter || undefined,
                  businessUnit: businessUnitFilter || undefined,
                  archived: archived || undefined,
                },
              }
            : { ids: selection.ids }),
        }}
        submit={bulkAssignLeadsBusinessUnits}
        onDone={() => {
          selection.clear();
          void fetchLeads();
        }}
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
