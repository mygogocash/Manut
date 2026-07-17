"use client";

import { FileUp, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { VendorBulkImportDialog } from "@/components/accounting/vendor-bulk-import-dialog";
import { VendorFormDialog } from "@/components/accounting/vendor-form-dialog";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable, type SortOrder } from "@/components/shared/data-table";
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
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { type Entity, listEntities } from "@/services/entity.service";
import {
  listVendors,
  type Vendor,
  type VendorSortField,
} from "@/services/vendor.service";

const ALL = "__all__";

export function VendorsTab() {
  const { hasPermission } = useAuth();
  const canImport = hasPermission("accounting:create");
  const canCreate = hasPermission("accounting:create");

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityFilter, setEntityFilter] = useState<string>(ALL);
  const [contactTypeFilter, setContactTypeFilter] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [sortBy, setSortBy] = useState<VendorSortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const pagination = usePagination();
  const {
    page,
    pageSize,
    setPage,
    setPageSize,
    totalPages,
    totalCount,
    setTotalCount,
  } = pagination;

  useEffect(() => {
    listEntities()
      .then((res) => setEntities(res.data))
      .catch(() => setEntities([]));
  }, []);

  const fetchVendors = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listVendors({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        entityId: entityFilter === ALL ? undefined : entityFilter,
        contactType: contactTypeFilter === ALL ? undefined : contactTypeFilter,
        sortBy,
        sortOrder,
      });
      setVendors(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load vendors";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    debouncedSearch,
    entityFilter,
    contactTypeFilter,
    sortBy,
    sortOrder,
    setTotalCount,
  ]);

  useEffect(() => {
    void fetchVendors();
  }, [fetchVendors]);

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    entityFilter,
    contactTypeFilter,
    sortBy,
    sortOrder,
    setPage,
  ]);

  // Click a column header → toggle direction on the same key, or switch
  // to the new key in ascending order. Matches the pattern used by the
  // other DataTable headers across the app.
  const handleSortChange = useCallback((key: string) => {
    setSortBy((prev) => {
      if (prev === key) {
        setSortOrder((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortOrder("asc");
      return key as VendorSortField;
    });
  }, []);

  function openCreate() {
    setEditingVendor(null);
    setFormOpen(true);
  }

  function openEdit(v: Vendor) {
    setEditingVendor(v);
    setFormOpen(true);
  }

  // Distinct contact types from the loaded page — gives HR a filter
  // without us hardcoding a list. Imports may mix localized
  // labels ("Supplier", "Client", "Cash Sale / ขายเงินสด", …) so
  // pulling them from data is safer than a static enum.
  const contactTypes = useMemo(() => {
    const set = new Set<string>();
    for (const v of vendors) {
      if (v.contactType) set.add(v.contactType);
    }
    return Array.from(set).sort();
  }, [vendors]);

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Business / Full Name",
        sortable: true,
        render: (v: Vendor) => (
          <div className="leading-tight">
            <p className="text-foreground text-xs font-medium">{v.name}</p>
            {v.contactId ? (
              <p className="text-muted-foreground text-[11px]">{v.contactId}</p>
            ) : null}
          </div>
        ),
        className: "min-w-[220px]",
      },
      {
        key: "contactType",
        header: "Type",
        sortable: true,
        render: (v: Vendor) =>
          v.contactType ? (
            <Badge variant="grey">{v.contactType}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "businessType",
        header: "Business",
        sortable: true,
        render: (v: Vendor) =>
          v.businessType ? (
            <span className="text-xs">{v.businessType}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "businessLocation",
        header: "Location",
        sortable: true,
        render: (v: Vendor) =>
          v.businessLocation ? (
            <span className="text-xs">{v.businessLocation}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "taxId",
        header: "Tax ID",
        sortable: true,
        render: (v: Vendor) =>
          v.taxId ? (
            <span className="font-mono text-[11px]">{v.taxId}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "branch",
        header: "Branch",
        sortable: true,
        render: (v: Vendor) => {
          const parts = [v.branchCode, v.branch].filter(Boolean);
          return parts.length > 0 ? (
            <span className="text-xs">{parts.join(" · ")}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        key: "contactName",
        header: "Contact",
        sortable: true,
        render: (v: Vendor) =>
          v.contactName ? (
            <div className="leading-tight">
              <p className="text-foreground text-xs">{v.contactName}</p>
              {v.email ? (
                <p className="text-muted-foreground text-[11px]">{v.email}</p>
              ) : null}
            </div>
          ) : v.email ? (
            <p className="text-muted-foreground text-[11px]">{v.email}</p>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "phone",
        header: "Phone / Mobile",
        sortable: true,
        render: (v: Vendor) => {
          const parts = [v.phone, v.mobile].filter(Boolean);
          return parts.length > 0 ? (
            <span className="text-xs">{parts.join(" · ")}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        key: "creditDays",
        header: "Credit",
        sortable: true,
        render: (v: Vendor) =>
          v.creditDays != null ? (
            <span className="text-xs tabular-nums">{v.creditDays}d</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        className: "text-right",
      },
      {
        key: "entity",
        header: "Entity",
        sortable: true,
        render: (v: Vendor) => <Badge variant="blue">{v.entity.code}</Badge>,
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`
          border-border bg-surface flex flex-col gap-2 rounded-lg border p-3
          shadow-sm
          sm:flex-row sm:items-center
        `}
      >
        <div className="relative flex-1">
          <Search
            className={`
              text-muted-foreground absolute top-1/2 left-2.5 size-3.5
              -translate-y-1/2
            `}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, contact ID, tax ID, email…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="h-10 min-w-[140px] text-xs">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All entities</SelectItem>
            {entities.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={contactTypeFilter} onValueChange={setContactTypeFilter}>
          <SelectTrigger className="h-10 min-w-[160px] text-xs">
            <SelectValue placeholder="Contact type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {contactTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="size-3.5" />
            Add vendor
          </Button>
        )}
        {canImport && (
          <Button onClick={() => setImportOpen(true)} variant="outline">
            <FileUp className="size-3.5" />
            Import xlsx
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={vendors}
        loading={loading}
        emptyMessage="No vendors yet — click Add vendor or Import xlsx to seed from the accounting export."
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        onRowClick={canCreate ? openEdit : undefined}
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

      <VendorBulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        defaultEntityId={entityFilter === ALL ? undefined : entityFilter}
        onImported={() => void fetchVendors()}
      />

      <VendorFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        vendor={editingVendor}
        entities={entities}
        defaultEntityId={entityFilter === ALL ? undefined : entityFilter}
        onSaved={() => void fetchVendors()}
      />
    </div>
  );
}
