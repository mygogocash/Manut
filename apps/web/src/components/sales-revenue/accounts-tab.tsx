"use client";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import {
  Download,
  Edit,
  GripVertical,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AccountDetailSheet } from "@/components/sales-revenue/account-detail-sheet";
import { AccountFormDialog } from "@/components/sales-revenue/account-form-dialog";
import { CrmImportDialog } from "@/components/shared/crm-import-dialog";
import { DataPagination } from "@/components/shared/data-pagination";
import { PermissionButton } from "@/components/shared/permission-button";
import { PermissionDropdownMenuItem } from "@/components/shared/permission-dropdown-menu-item";
import { SortableColumnHead } from "@/components/shared/sortable-column-head";
import { useColumnOrder } from "@/components/shared/use-column-order";
import { useColumnWidths } from "@/components/shared/use-column-widths";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CRM_ACCOUNT_REGIONS, CRM_ALL_COUNTRIES } from "@/constants/crm-geo";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { type ExportFormat, exportRows } from "@/lib/crm-export";
import { useAuth } from "@/providers/auth-provider";
import {
  type Account,
  type CreateAccountInput,
  deleteAccount,
  importAccounts,
  listAccounts,
  reorderAccounts,
} from "@/services/revenue-account.service";
import {
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGES,
  type OpportunityStage,
} from "@/services/revenue-opportunity.service";
import { listUsers, type UserListItem } from "@/services/user.service";

function formatTcv(value: string, currency: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}

function formatDateOrDash(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : format(d, "MMM d, yyyy");
}

// Imported xlsx ships dates in several human formats — try them in
// order. Mirrors `parseLegalDate` (#697). Empty / unparseable cells
// fall through to undefined so the backend keeps the column nullable.
function parseImportDate(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  const s = String(raw).trim();
  if (!s || /^tbd$/i.test(s)) return undefined;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }
  const fallback = new Date(s);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toISOString().slice(0, 10);
  }
  return undefined;
}

// Shape the import dialog hands the submit handler — one entry per
// importable Account field. Opportunity-derived columns (stage / TCV /
// launch dates) are excluded; reps wire those up on the Pipeline tab
// after import so the deal sync runs through its own validation.
interface AccountImportRow {
  name?: string;
  domain?: string;
  industry?: string;
  size?: string;
  country?: string;
  region?: string;
  website?: string;
  notes?: string;
  totalUsers?: number;
  appUsers?: number;
  picName?: string;
  designation?: string;
  department?: string;
  lastFollowUpDate?: string;
  agreementSignedDate?: string;
  engagementType?: string;
  uatStartDate?: string;
  uatEndDate?: string;
  blocker?: string;
  remarks?: string;
}

// Reorderable column registry. Drag handle + action kebab stay fixed at
// the edges; everything between is user-rearrangeable and persisted to
// localStorage. Bump the storage key's version suffix if the default
// set changes in a way that should reset saved orders.
type AccColKey =
  | "name"
  | "country"
  | "region"
  | "industry"
  | "picName"
  | "designation"
  | "department"
  | "totalUsers"
  | "appUsers"
  | "owner"
  | "createdAt"
  | "stage"
  | "probability"
  | "tcv"
  | "lastFollowUpDate"
  | "agreementSignedDate"
  | "engagementType"
  | "uatStartDate"
  | "uatEndDate"
  | "launchDate"
  | "revenueLaunchDate"
  | "blocker"
  | "remarks";

const ACC_COL_ORDER_KEY = "sales-accounts-col-order-v1";
const ACC_COL_WIDTH_KEY = "sales-accounts-col-width-v1";

const ACC_COL_DEFAULT_ORDER: readonly AccColKey[] = [
  "name",
  "country",
  "region",
  "industry",
  "picName",
  "designation",
  "department",
  "totalUsers",
  "appUsers",
  "owner",
  "createdAt",
  "stage",
  "probability",
  "tcv",
  "lastFollowUpDate",
  "agreementSignedDate",
  "engagementType",
  "uatStartDate",
  "uatEndDate",
  "launchDate",
  "revenueLaunchDate",
  "blocker",
  "remarks",
];

const ACC_COL_META: Record<
  AccColKey,
  { label: string; headClassName?: string }
> = {
  name: { label: "Name" },
  country: { label: "Country" },
  region: { label: "Region" },
  industry: { label: "Industry" },
  picName: { label: "PIC Name" },
  designation: { label: "Designation" },
  department: { label: "Department" },
  totalUsers: { label: "Total users", headClassName: "text-right" },
  appUsers: { label: "App users", headClassName: "text-right" },
  owner: { label: "Owner" },
  createdAt: { label: "Created" },
  stage: { label: "Stage" },
  probability: { label: "Probability", headClassName: "text-right" },
  tcv: { label: "TCV", headClassName: "text-right" },
  lastFollowUpDate: { label: "Last follow-up" },
  agreementSignedDate: { label: "Agreement signed" },
  engagementType: { label: "Type" },
  uatStartDate: { label: "UAT start" },
  uatEndDate: { label: "UAT end" },
  launchDate: { label: "Launch date" },
  revenueLaunchDate: { label: "Revenue launch date" },
  blocker: { label: "Blocker" },
  remarks: { label: "Remarks" },
};

const ACC_COL_DEFAULT_WIDTHS: Record<AccColKey, number> = {
  name: 200,
  country: 120,
  region: 120,
  industry: 140,
  picName: 140,
  designation: 160,
  department: 160,
  totalUsers: 110,
  appUsers: 110,
  owner: 160,
  createdAt: 130,
  stage: 140,
  probability: 110,
  tcv: 130,
  lastFollowUpDate: 140,
  agreementSignedDate: 150,
  engagementType: 120,
  uatStartDate: 130,
  uatEndDate: 130,
  launchDate: 130,
  revenueLaunchDate: 160,
  blocker: 200,
  remarks: 200,
};

interface AccountsTabProps {
  /** Called when an account save may have changed pipeline data. */
  onPipelineMutate?: () => void;
  /**
   * Bump after a pipeline-side mutation so the Accounts list re-runs
   * its query and the joined-opportunity columns (stage, value,
   * probability, launch date) show the rep's latest edit. The reverse
   * of `onPipelineMutate` — keeps the two surfaces consistent without
   * a manual tab switch.
   */
  refreshKey?: number;
}

export function AccountsTab({
  onPipelineMutate,
  refreshKey = 0,
}: AccountsTabProps) {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("sales-revenue:update");
  const canDelete = hasPermission("sales-revenue:delete");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Country + region filters. Reps work on regional books
  // and need to slice the list without hunting via search.
  const [countryFilter, setCountryFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  // Stage + Owner filters. Stage
  // filters on the linked opportunity; Owner narrows to a rep's book.
  const [stageFilter, setStageFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [ownerOptions, setOwnerOptions] = useState<UserListItem[]>([]);
  const debouncedSearch = useDebounce(search, 300);
  const debouncedCountry = useDebounce(countryFilter, 300);
  const debouncedRegion = useDebounce(regionFilter, 300);
  const debouncedStage = useDebounce(stageFilter, 300);
  const debouncedOwner = useDebounce(ownerFilter, 300);
  const pagination = usePagination();
  const { page, pageSize, setTotalCount } = pagination;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAccountId, setDetailAccountId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { colOrder, isColumnId, reorderColumns } = useColumnOrder(
    ACC_COL_ORDER_KEY,
    ACC_COL_DEFAULT_ORDER,
  );
  const { widths, setWidth } = useColumnWidths(
    ACC_COL_WIDTH_KEY,
    ACC_COL_DEFAULT_WIDTHS,
  );

  // Row drag is disabled while any filter / search is active so a
  // partial view can't corrupt the global ordering. Mirrors the
  // legal-crm guard (#697).
  const reorderEnabled = useMemo(
    () =>
      !debouncedSearch.trim() &&
      !debouncedCountry &&
      !debouncedRegion &&
      !debouncedStage &&
      !debouncedOwner &&
      !loading,
    [
      debouncedSearch,
      debouncedCountry,
      debouncedRegion,
      debouncedStage,
      debouncedOwner,
      loading,
    ],
  );
  const prePersistOrder = useRef<Account[] | null>(null);

  function openDetail(a: Account) {
    setDetailAccountId(a.id);
    setDetailOpen(true);
  }

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listAccounts({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        country: debouncedCountry || undefined,
        region: debouncedRegion || undefined,
        stage: debouncedStage || undefined,
        ownerId: debouncedOwner || undefined,
      });
      setAccounts(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load accounts";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    debouncedSearch,
    debouncedCountry,
    debouncedRegion,
    debouncedStage,
    debouncedOwner,
    setTotalCount,
  ]);

  useEffect(() => {
    fetchAccounts();
    // `refreshKey` is listed so a parent bump (after a pipeline-side
    // mutation) re-runs the query. It's an opaque counter; the effect
    // doesn't read it directly, only depends on it changing.
  }, [fetchAccounts, refreshKey]);

  // Pull active users once on mount for the Owner filter dropdown.
  // 500 is the same limit projects-view uses; a real org won't hit it,
  // and the picker only needs id + name. Inactive users are excluded
  // since assigning to one is rarely the rep's intent here.
  useEffect(() => {
    let cancelled = false;
    void listUsers({ limit: 500, isActive: true })
      .then((res) => {
        if (cancelled) return;
        setOwnerOptions(res.data);
      })
      .catch(() => {
        if (!cancelled) setOwnerOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setFormOpen(true);
  }

  function openDelete(account: Account) {
    setDeleting(account);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      setDeleteSubmitting(true);
      await deleteAccount(deleting.id);
      toast.success("Account deleted");
      setDeleteOpen(false);
      setDeleting(null);
      fetchAccounts();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete account";
      toast.error(message);
    } finally {
      setDeleteSubmitting(false);
    }
  }

  // Pull every Account the active filters allow (capped at 1000, the
  // same ceiling the import dialog enforces) and emit a CSV / xlsx
  // matching the on-screen column set. Mirrors `handleExport` in
  // legal-crm (#697). Opportunity-derived columns are included as a
  // data dump — they're read-only on import.
  const handleExport = useCallback(
    async (formatType: ExportFormat) => {
      setExporting(true);
      try {
        const res = await listAccounts({
          page: 1,
          limit: 1000,
          search: debouncedSearch || undefined,
          country: debouncedCountry || undefined,
          region: debouncedRegion || undefined,
          stage: debouncedStage || undefined,
          ownerId: debouncedOwner || undefined,
        });
        if (res.data.length === 0) {
          toast.error("Nothing to export");
          return;
        }
        exportRows(
          "sales-crm-accounts",
          [
            { header: "Name", value: (a: Account) => a.name },
            { header: "Domain", value: (a: Account) => a.domain ?? "" },
            { header: "Industry", value: (a: Account) => a.industry ?? "" },
            { header: "Size", value: (a: Account) => a.size ?? "" },
            { header: "Country", value: (a: Account) => a.country ?? "" },
            { header: "Region", value: (a: Account) => a.region ?? "" },
            { header: "Website", value: (a: Account) => a.website ?? "" },
            { header: "Notes", value: (a: Account) => a.notes ?? "" },
            {
              header: "Total Users",
              value: (a: Account) => a.totalUsers ?? "",
            },
            { header: "App Users", value: (a: Account) => a.appUsers ?? "" },
            { header: "PIC Name", value: (a: Account) => a.picName ?? "" },
            {
              header: "Designation",
              value: (a: Account) => a.designation ?? "",
            },
            {
              header: "Department",
              value: (a: Account) => a.department ?? "",
            },
            {
              header: "Last Follow-up",
              value: (a: Account) => a.lastFollowUpDate ?? "",
            },
            {
              header: "Agreement Signed",
              value: (a: Account) => a.agreementSignedDate ?? "",
            },
            {
              header: "Engagement Type",
              value: (a: Account) => a.engagementType ?? "",
            },
            {
              header: "UAT Start",
              value: (a: Account) => a.uatStartDate ?? "",
            },
            {
              header: "UAT End",
              value: (a: Account) => a.uatEndDate ?? "",
            },
            { header: "Blocker", value: (a: Account) => a.blocker ?? "" },
            { header: "Remarks", value: (a: Account) => a.remarks ?? "" },
            {
              header: "Owner",
              value: (a: Account) => a.owner?.name ?? "",
            },
            {
              header: "Created",
              value: (a: Account) => a.createdAt,
            },
            {
              header: "Stage",
              value: (a: Account) => a.opportunities[0]?.stage ?? "",
            },
            {
              header: "Probability",
              value: (a: Account) =>
                a.opportunities[0] ? `${a.opportunities[0].probability}%` : "",
            },
            {
              header: "TCV",
              value: (a: Account) => a.opportunities[0]?.value ?? "",
            },
            {
              header: "Currency",
              value: (a: Account) => a.opportunities[0]?.currency ?? "",
            },
            {
              header: "Launch Date",
              value: (a: Account) => a.opportunities[0]?.launchDate ?? "",
            },
            {
              header: "Revenue Launch Date",
              value: (a: Account) =>
                a.opportunities[0]?.revenueLaunchDate ?? "",
            },
          ],
          res.data,
          formatType,
        );
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to export";
        toast.error(message);
      } finally {
        setExporting(false);
      }
    },
    [
      debouncedSearch,
      debouncedCountry,
      debouncedRegion,
      debouncedStage,
      debouncedOwner,
    ],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Header drag → column reorder. Column ids are short literals,
    // distinct from the account UUIDs used for row drag.
    if (isColumnId(active.id)) {
      if (isColumnId(over.id)) reorderColumns(active.id, over.id);
      return;
    }

    const oldIndex = accounts.findIndex((a) => a.id === active.id);
    const newIndex = accounts.findIndex((a) => a.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    prePersistOrder.current = accounts;
    const next = arrayMove(accounts, oldIndex, newIndex);
    setAccounts(next);

    try {
      await reorderAccounts(next.map((a) => a.id));
    } catch (err) {
      if (prePersistOrder.current) setAccounts(prePersistOrder.current);
      const message =
        err instanceof ApiError ? err.message : "Failed to reorder accounts";
      toast.error(message);
    } finally {
      prePersistOrder.current = null;
    }
  }

  const skeletonRows = useMemo(
    () => Array.from({ length: 6 }, (_, i) => i),
    [],
  );

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
              placeholder="Search accounts…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                pagination.setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={countryFilter || "__all__"}
            onValueChange={(v) => {
              setCountryFilter(v === "__all__" ? "" : v);
              pagination.setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-44 text-xs">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All countries</SelectItem>
              {countryFilter && !CRM_ALL_COUNTRIES.includes(countryFilter) ? (
                <SelectItem value={countryFilter}>{countryFilter}</SelectItem>
              ) : null}
              {CRM_ALL_COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={regionFilter || "__all__"}
            onValueChange={(v) => {
              setRegionFilter(v === "__all__" ? "" : v);
              pagination.setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-40 text-xs">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All regions</SelectItem>
              {regionFilter &&
              !CRM_ACCOUNT_REGIONS.includes(
                regionFilter as (typeof CRM_ACCOUNT_REGIONS)[number],
              ) ? (
                <SelectItem value={regionFilter}>{regionFilter}</SelectItem>
              ) : null}
              {CRM_ACCOUNT_REGIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={stageFilter || "__all__"}
            onValueChange={(v) => {
              setStageFilter(v === "__all__" ? "" : v);
              pagination.setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-40 text-xs">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All stages</SelectItem>
              {OPPORTUNITY_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {OPPORTUNITY_STAGE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={ownerFilter || "__all__"}
            onValueChange={(v) => {
              setOwnerFilter(v === "__all__" ? "" : v);
              pagination.setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-44 text-xs">
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All owners</SelectItem>
              {ownerOptions.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting}>
                <Download className="size-3.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void handleExport("csv")}>
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExport("xlsx")}>
                Excel (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <PermissionButton
            variant="outline"
            permission="sales-revenue:create"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="size-3.5" />
            Import
          </PermissionButton>
          <PermissionButton
            permission="sales-revenue:create"
            onClick={openCreate}
          >
            <Plus className="mr-1.5 size-3.5" />
            New account
          </PermissionButton>
        </div>
      </div>

      {!reorderEnabled && !loading ? (
        <p className="text-muted-foreground mb-2 text-[11px]">
          Drag-to-reorder rows is disabled while a filter or search is active.
          Column reorder still works.
        </p>
      ) : null}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <Table
          // table-fixed makes per-column widths authoritative for
          // drag-to-resize (Notion-style).
          className="table-fixed"
          containerClassName={`
            max-h-[calc(100vh-280px)] overflow-auto rounded-lg border
          `}
        >
          <TableHeader className="bg-background sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-[36px]" />
              <SortableContext
                items={colOrder}
                strategy={horizontalListSortingStrategy}
              >
                {colOrder.map((key) => (
                  <SortableColumnHead
                    key={key}
                    colKey={key}
                    label={ACC_COL_META[key].label}
                    className={ACC_COL_META[key].headClassName}
                    width={widths[key]}
                    onResize={(k, w) => setWidth(k as AccColKey, w)}
                  />
                ))}
              </SortableContext>
              {/* Auto-width spacer absorbs leftover table width. */}
              <TableHead />
              <TableHead className="w-[40px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              skeletonRows.map((i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell colSpan={colOrder.length + 3}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colOrder.length + 3}
                  className="text-muted-foreground py-10 text-center text-xs"
                >
                  No accounts yet. Create one or convert a lead to start your
                  pipeline.
                </TableCell>
              </TableRow>
            ) : (
              <SortableContext
                items={accounts.map((a) => a.id)}
                strategy={verticalListSortingStrategy}
              >
                {accounts.map((a) => (
                  <SortableAccountRow
                    key={a.id}
                    account={a}
                    colOrder={colOrder}
                    canDrag={reorderEnabled}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onRowClick={() => (canEdit ? openEdit(a) : openDetail(a))}
                    onEdit={() => openEdit(a)}
                    onDelete={() => openDelete(a)}
                  />
                ))}
              </SortableContext>
            )}
          </TableBody>
        </Table>
      </DndContext>

      <div className="mt-3">
        <DataPagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalCount={pagination.totalCount}
          totalPages={pagination.totalPages}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </div>

      <AccountFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        account={editing}
        onSaved={() => {
          fetchAccounts();
          onPipelineMutate?.();
        }}
      />

      <CrmImportDialog<AccountImportRow>
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          void fetchAccounts();
          onPipelineMutate?.();
        }}
        title="Import accounts"
        entityLabel="accounts"
        templateName="sales-crm-accounts-import-template"
        fields={[
          { key: "name", headers: ["Name"], type: "string", required: true },
          { key: "domain", headers: ["Domain"], type: "string" },
          { key: "industry", headers: ["Industry"], type: "string" },
          { key: "size", headers: ["Size"], type: "string" },
          { key: "country", headers: ["Country"], type: "string" },
          { key: "region", headers: ["Region"], type: "string" },
          { key: "website", headers: ["Website"], type: "string" },
          { key: "notes", headers: ["Notes"], type: "string" },
          { key: "totalUsers", headers: ["Total Users"], type: "number" },
          { key: "appUsers", headers: ["App Users"], type: "number" },
          { key: "picName", headers: ["PIC Name"], type: "string" },
          { key: "designation", headers: ["Designation"], type: "string" },
          { key: "department", headers: ["Department"], type: "string" },
          {
            key: "lastFollowUpDate",
            headers: ["Last Follow-up", "Last Follow Up"],
            type: "string",
          },
          {
            key: "agreementSignedDate",
            headers: ["Agreement Signed"],
            type: "string",
          },
          {
            key: "engagementType",
            headers: ["Engagement Type", "Type"],
            type: "string",
          },
          { key: "uatStartDate", headers: ["UAT Start"], type: "string" },
          { key: "uatEndDate", headers: ["UAT End"], type: "string" },
          { key: "blocker", headers: ["Blocker"], type: "string" },
          { key: "remarks", headers: ["Remarks"], type: "string" },
        ]}
        submit={async (rows) => {
          // Coerce free-text dates + drop empty-string optionals so the
          // server's zod schema accepts the payload. `name` is the only
          // required field; everything else falls through nullable.
          const payload: CreateAccountInput[] = rows.map((r) => ({
            name: (r.name ?? "").trim(),
            domain: r.domain?.trim() || undefined,
            industry: r.industry?.trim() || undefined,
            size: r.size?.trim() || undefined,
            country: r.country?.trim() || undefined,
            region: r.region?.trim() || undefined,
            website: r.website?.trim() || undefined,
            notes: r.notes?.trim() || undefined,
            totalUsers: r.totalUsers || undefined,
            appUsers: r.appUsers || undefined,
            picName: r.picName?.trim() || undefined,
            designation: r.designation?.trim() || undefined,
            department: r.department?.trim() || undefined,
            lastFollowUpDate: parseImportDate(r.lastFollowUpDate),
            agreementSignedDate: parseImportDate(r.agreementSignedDate),
            engagementType: r.engagementType?.trim() || undefined,
            uatStartDate: parseImportDate(r.uatStartDate),
            uatEndDate: parseImportDate(r.uatEndDate),
            blocker: r.blocker?.trim() || undefined,
            remarks: r.remarks?.trim() || undefined,
          }));
          const res = await importAccounts(payload);
          // CrmImportDialog surfaces a single "Imported N" toast; we
          // pipe the skipped count through here so reps see when a
          // domain-conflict row was dropped from the batch.
          if (res.data.skipped > 0) {
            toast.message(
              `${res.data.skipped} row${res.data.skipped === 1 ? "" : "s"} skipped (duplicate domain).`,
            );
          }
          return { created: res.data.created };
        }}
      />

      <AccountDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        accountId={detailAccountId}
        onEdit={(a) => {
          setDetailOpen(false);
          openEdit(a);
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `${deleting.name} will be permanently removed. Contacts on this account cascade-delete; opportunities and activities tied to it must be reassigned first.`
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
    </div>
  );
}

function SortableAccountRow({
  account,
  colOrder,
  canDrag,
  canEdit,
  canDelete,
  onRowClick,
  onEdit,
  onDelete,
}: {
  account: Account;
  colOrder: AccColKey[];
  canDrag: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onRowClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: account.id, disabled: !canDrag });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const opp = account.opportunities[0];

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={
        isDragging
          ? "bg-muted/40"
          : `
            hover:bg-muted/40
            cursor-pointer
          `
      }
      onClick={onRowClick}
    >
      <TableCell
        className="w-[36px]"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Drag to reorder"
          disabled={!canDrag}
          className={`
            text-muted-foreground inline-flex size-6 items-center justify-center
            rounded transition-colors
            hover:text-foreground
            disabled:cursor-not-allowed disabled:opacity-30
            ${
              canDrag
                ? `
                  cursor-grab
                  active:cursor-grabbing
                `
                : ""
            }
          `}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
      </TableCell>
      {colOrder.map((key) => {
        switch (key) {
          case "name":
            return (
              <TableCell key={key} className="overflow-hidden">
                <span
                  className="text-foreground block truncate text-xs font-medium"
                  title={account.name}
                >
                  {account.name}
                </span>
              </TableCell>
            );
          case "country":
            return (
              <TableCell key={key} className="truncate text-xs">
                {account.country || "—"}
              </TableCell>
            );
          case "region":
            return (
              <TableCell key={key} className="truncate text-xs">
                {account.region || "—"}
              </TableCell>
            );
          case "industry":
            return (
              <TableCell key={key} className="truncate text-xs">
                {account.industry || "—"}
              </TableCell>
            );
          case "picName":
            return (
              <TableCell key={key} className="truncate text-xs">
                {account.picName || "—"}
              </TableCell>
            );
          case "designation":
            return (
              <TableCell key={key} className="truncate text-xs">
                {account.designation || "—"}
              </TableCell>
            );
          case "department":
            return (
              <TableCell key={key} className="truncate text-xs">
                {account.department || "—"}
              </TableCell>
            );
          case "totalUsers":
            return (
              <TableCell
                key={key}
                className="truncate text-right text-xs tabular-nums"
              >
                {account.totalUsers !== null
                  ? account.totalUsers.toLocaleString()
                  : "—"}
              </TableCell>
            );
          case "appUsers":
            return (
              <TableCell
                key={key}
                className="truncate text-right text-xs tabular-nums"
              >
                {account.appUsers !== null
                  ? account.appUsers.toLocaleString()
                  : "—"}
              </TableCell>
            );
          case "owner":
            return (
              <TableCell key={key} className="truncate text-xs">
                {account.owner?.name ?? "—"}
              </TableCell>
            );
          case "createdAt":
            return (
              <TableCell key={key} className="truncate text-xs">
                {formatDateOrDash(account.createdAt)}
              </TableCell>
            );
          case "stage":
            return (
              <TableCell key={key} className="truncate text-xs">
                {opp
                  ? (OPPORTUNITY_STAGE_LABELS[opp.stage as OpportunityStage] ??
                    opp.stage)
                  : "—"}
              </TableCell>
            );
          case "probability":
            return (
              <TableCell
                key={key}
                className="truncate text-right text-xs tabular-nums"
              >
                {opp ? `${opp.probability}%` : "—"}
              </TableCell>
            );
          case "tcv":
            return (
              <TableCell
                key={key}
                className="truncate text-right text-xs tabular-nums"
              >
                {opp ? formatTcv(opp.value, opp.currency) : "—"}
              </TableCell>
            );
          case "lastFollowUpDate":
            return (
              <TableCell key={key} className="truncate text-xs">
                {formatDateOrDash(account.lastFollowUpDate)}
              </TableCell>
            );
          case "agreementSignedDate":
            return (
              <TableCell key={key} className="truncate text-xs">
                {formatDateOrDash(account.agreementSignedDate)}
              </TableCell>
            );
          case "engagementType":
            return (
              <TableCell key={key} className="truncate text-xs capitalize">
                {account.engagementType || "—"}
              </TableCell>
            );
          case "uatStartDate":
            return (
              <TableCell key={key} className="truncate text-xs">
                {formatDateOrDash(account.uatStartDate)}
              </TableCell>
            );
          case "uatEndDate":
            return (
              <TableCell key={key} className="truncate text-xs">
                {formatDateOrDash(account.uatEndDate)}
              </TableCell>
            );
          case "launchDate":
            return (
              <TableCell key={key} className="truncate text-xs">
                {formatDateOrDash(opp?.launchDate ?? null)}
              </TableCell>
            );
          case "revenueLaunchDate":
            return (
              <TableCell key={key} className="truncate text-xs">
                {formatDateOrDash(opp?.revenueLaunchDate ?? null)}
              </TableCell>
            );
          case "blocker":
            return (
              <TableCell key={key} className="overflow-hidden">
                {account.blocker ? (
                  <span
                    className="text-destructive line-clamp-2 text-[11px]"
                    title={account.blocker}
                  >
                    {account.blocker}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>
            );
          case "remarks":
            return (
              <TableCell key={key} className="overflow-hidden">
                {account.remarks ? (
                  <span
                    className="text-muted-foreground line-clamp-2 text-[11px]"
                    title={account.remarks}
                  >
                    {account.remarks}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>
            );
          default:
            return null;
        }
      })}
      <TableCell />
      <TableCell
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canEdit ? (
              <PermissionDropdownMenuItem
                permissions={["sales-revenue:update"]}
                onClick={onEdit}
              >
                <Edit className="mr-2 size-3.5" />
                Edit
              </PermissionDropdownMenuItem>
            ) : null}
            {canDelete ? (
              <>
                <DropdownMenuSeparator />
                <PermissionDropdownMenuItem
                  permissions={["sales-revenue:delete"]}
                  className="text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="mr-2 size-3.5" />
                  Delete
                </PermissionDropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
