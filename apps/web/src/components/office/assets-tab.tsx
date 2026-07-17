"use client";

import {
  Edit,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AssetBulkImportDialog } from "@/components/office/asset-bulk-import-dialog";
import { AssetFormDialog } from "@/components/office/asset-form-dialog";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
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
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import {
  type Asset,
  ASSET_CATEGORIES,
  ASSET_CATEGORY_LABELS,
  ASSET_STATUS_LABELS,
  ASSET_STATUSES,
  deleteAsset,
  listAssets,
} from "@/services/office.service";

const ALL_VALUE = "__all__";

const CATEGORY_PILLS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "All" },
  ...ASSET_CATEGORIES.map((c) => ({
    value: c,
    label: ASSET_CATEGORY_LABELS[c] ?? c,
  })),
];

function formatCurrency(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function AssetsTab({ canManage = true }: { canManage?: boolean }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const pagination = usePagination();
  const { page, pageSize, setTotalCount } = pagination;

  const [formOpen, setFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listAssets({
        page,
        limit: pageSize,
        status: statusFilter || undefined,
        type: categoryFilter || undefined,
        search: debouncedSearch || undefined,
      });
      setAssets(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load assets";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    statusFilter,
    categoryFilter,
    debouncedSearch,
    setTotalCount,
  ]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  function openCreate() {
    setEditingAsset(null);
    setFormOpen(true);
  }

  function openEdit(asset: Asset) {
    setEditingAsset(asset);
    setFormOpen(true);
  }

  async function handleDeleteConfirm(e: React.MouseEvent<HTMLButtonElement>) {
    if (!deleteTarget) return;
    e.preventDefault();
    try {
      setDeleting(true);
      await deleteAsset(deleteTarget.id);
      toast.success("Asset deleted");
      setDeleteTarget(null);
      fetchAssets();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete asset";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  type AssetCol = {
    key: string;
    header: string;
    render: (a: Asset) => ReactNode;
    className?: string;
  };
  const nameCol: AssetCol = {
    key: "name",
    header: "Name",
    render: (a: Asset) => (
      <div className="flex flex-col">
        <span className="text-foreground font-medium">{a.name}</span>
        {a.model && (
          <span className="text-muted-foreground text-[11px]">{a.model}</span>
        )}
      </div>
    ),
  };

  const categoryCol: AssetCol = {
    key: "type",
    header: "Category",
    render: (a: Asset) => (
      <Badge variant="blue">{ASSET_CATEGORY_LABELS[a.type] ?? a.type}</Badge>
    ),
  };

  const serialCol: AssetCol = {
    key: "serialNo",
    header: "Serial No.",
    render: (a: Asset) => (
      <span className="font-mono text-xs">{a.serialNo ?? "—"}</span>
    ),
  };

  const officeCol: AssetCol = {
    key: "office",
    header: "Office",
    render: (a: Asset) => a.office?.name ?? "—",
  };

  const statusCol: AssetCol = {
    key: "status",
    header: "Status",
    render: (a: Asset) => (
      <Badge status={a.status}>
        {ASSET_STATUS_LABELS[a.status] ?? a.status}
      </Badge>
    ),
  };

  const assigneeCol: AssetCol = {
    key: "assignee",
    header: "Assigned to",
    render: (a: Asset) => a.assignee?.name ?? "—",
  };

  const manufacturerCol: AssetCol = {
    key: "manufacturer",
    header: "Manufacturer",
    render: (a: Asset) => a.manufacturer ?? "—",
  };

  const colourCol: AssetCol = {
    key: "colour",
    header: "Colour",
    render: (a: Asset) => a.colour ?? "—",
  };

  const osCol: AssetCol = {
    key: "os",
    header: "OS",
    render: (a: Asset) => a.operatingSystem ?? "—",
  };

  const versionCol: AssetCol = {
    key: "version",
    header: "Version",
    render: (a: Asset) => a.version ?? "—",
  };

  const subTypeCol: AssetCol = {
    key: "subType",
    header: "Sub-type",
    render: (a: Asset) => a.subType ?? "—",
  };

  const departmentCol: AssetCol = {
    key: "department",
    header: "Department",
    render: (a: Asset) => a.department ?? a.assignee?.name ?? "—",
  };

  const bookValueCol: AssetCol = {
    key: "bookValue",
    header: "Book Value",
    render: (a: Asset) => formatCurrency(a.bookValue),
    className: "text-right",
  };

  // Column set varies with the selected category so the most relevant
  // metadata leads. "All" stays generic; furniture / other reuses it.
  const columnsByCategory: Record<string, AssetCol[]> = {
    "": [
      nameCol,
      categoryCol,
      manufacturerCol,
      serialCol,
      officeCol,
      statusCol,
      assigneeCol,
    ],
    laptop: [
      nameCol,
      manufacturerCol,
      osCol,
      serialCol,
      statusCol,
      assigneeCol,
      departmentCol,
    ],
    mobile: [
      nameCol,
      manufacturerCol,
      colourCol,
      serialCol,
      statusCol,
      assigneeCol,
    ],
    monitor: [
      nameCol,
      manufacturerCol,
      serialCol,
      officeCol,
      statusCol,
      departmentCol,
    ],
    peripheral: [
      nameCol,
      manufacturerCol,
      colourCol,
      serialCol,
      statusCol,
      assigneeCol,
    ],
    usb_accessory: [
      nameCol,
      manufacturerCol,
      subTypeCol,
      colourCol,
      serialCol,
      statusCol,
    ],
    software: [nameCol, manufacturerCol, versionCol, assigneeCol, statusCol],
    furniture: [nameCol, officeCol, statusCol, departmentCol, bookValueCol],
    other: [nameCol, categoryCol, serialCol, officeCol, statusCol],
  };

  const columns = [
    ...(columnsByCategory[categoryFilter] ?? columnsByCategory[""]!),
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            className: "w-10",
            render: (a: Asset) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(a)}>
                    <Edit className="mr-2 size-3.5" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className={`
                      text-destructive
                      focus:text-destructive
                    `}
                    onClick={() => setDeleteTarget(a)}
                  >
                    <Trash2 className="mr-2 size-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {CATEGORY_PILLS.map((p) => {
          const active = categoryFilter === p.value;
          return (
            <Button
              key={p.value || "all"}
              type="button"
              size="xs"
              variant={active ? "default" : "outline"}
              onClick={() => {
                setCategoryFilter(p.value);
                pagination.setPage(1);
              }}
            >
              {p.label}
            </Button>
          );
        })}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            className={`
              text-muted-foreground pointer-events-none absolute top-1/2 left-3
              size-3.5 -translate-y-1/2
            `}
          />
          <Input
            placeholder="Search assets…"
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
            {ASSET_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ASSET_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canManage ? (
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1.5 size-3.5" />
              Import
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 size-3.5" />
              New asset
            </Button>
          </div>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={assets}
        loading={loading}
        emptyMessage={
          debouncedSearch ? "No matching assets" : "No assets found"
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

      <AssetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        asset={editingAsset}
        onSaved={fetchAssets}
      />

      <AssetBulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={fetchAssets}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(next) => {
          if (!deleting && !next) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete asset</AlertDialogTitle>
            <AlertDialogDescription>
              Delete asset &ldquo;
              <span className="text-foreground font-medium">
                {deleteTarget?.name ?? "this asset"}
              </span>
              &rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
