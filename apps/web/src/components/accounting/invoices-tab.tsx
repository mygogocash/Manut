"use client";

import {
  Building2,
  FileSpreadsheet,
  FileText,
  MoreHorizontal,
  Pencil,
  Printer,
  Trash2,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ALL_FILTER,
  formatCurrency,
  formatDate,
  INVOICE_STATUSES,
  INVOICE_TYPES,
} from "@/components/accounting/accounting-utils";
import { InvoiceCompanyDialog } from "@/components/accounting/invoice-company-dialog";
import { InvoiceDialog } from "@/components/accounting/invoice-dialog";
import { PaymentDialog } from "@/components/accounting/payment-dialog";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  deleteInvoice,
  downloadInvoiceDocx,
  downloadInvoicePdf,
  downloadInvoiceXlsx,
  type Invoice,
  invoicePrintPath,
  type InvoiceSortField,
  listInvoices,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

/** List label: draft series until send, then statutory no + retained draft. */
function documentNos(invoice: Invoice): {
  primary: string;
  secondary?: string;
} {
  const draft = invoice.draftNo?.trim() || undefined;
  const no = invoice.invoiceNo;
  if (no.startsWith("DRAFT-") || invoice.status === "draft") {
    return { primary: draft ?? no };
  }
  if (draft && draft !== no) {
    return { primary: no, secondary: draft };
  }
  return { primary: no };
}

interface InvoicesTabProps {
  entities: Entity[];
  /** When set, the table is locked to that invoice type (AR invoices or AP bills). */
  lockedType?: "receivable" | "payable";
}

export function InvoicesTab({ entities, lockedType }: InvoicesTabProps) {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("accounting:create");
  const canAdmin = hasPermission("accounting:admin");
  const canRead = hasPermission("accounting:read");
  const isBills = lockedType === "payable";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState(ALL_FILTER);
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER);
  const [typeFilter, setTypeFilter] = useState(lockedType ?? ALL_FILTER);
  const [sortBy, setSortBy] = useState<InvoiceSortField | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [companyOpen, setCompanyOpen] = useState(false);
  const pagination = usePagination();

  const handleSortChange = useCallback(
    (key: string) => {
      setSortBy((prev) => {
        if (prev !== key) {
          setSortOrder("desc");
          return key as InvoiceSortField;
        }
        if (sortOrder === "desc") {
          setSortOrder("asc");
          return key as InvoiceSortField;
        }
        setSortOrder("desc");
        return undefined;
      });
    },
    [sortOrder],
  );

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listInvoices({
        page: pagination.page,
        limit: pagination.pageSize,
        entityId: entityFilter === ALL_FILTER ? undefined : entityFilter,
        status: statusFilter === ALL_FILTER ? undefined : statusFilter,
        type:
          lockedType ?? (typeFilter === ALL_FILTER ? undefined : typeFilter),
        sortBy,
        sortOrder,
      });
      setInvoices(result.data);
      pagination.setTotalCount(result.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load invoices";
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
    typeFilter,
    lockedType,
    sortBy,
    sortOrder,
    pagination.setTotalCount,
  ]);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    pagination.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    entityFilter,
    statusFilter,
    typeFilter,
    sortBy,
    sortOrder,
    pagination.setPage,
  ]);

  const handleDownloadPdf = useCallback(async (id: string) => {
    try {
      await downloadInvoicePdf(id);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to download PDF";
      toast.error(msg);
    }
  }, []);

  const handleDownloadDocx = useCallback(async (id: string) => {
    try {
      await downloadInvoiceDocx(id);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to download Word file";
      toast.error(msg);
    }
  }, []);

  const handleDownloadXlsx = useCallback(async (id: string) => {
    try {
      await downloadInvoiceXlsx(id);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to download Excel file";
      toast.error(msg);
    }
  }, []);

  const handleDelete = useCallback(
    async (invoice: Invoice) => {
      const message = `Delete ${isBills ? "bill" : "invoice"} "${documentNos(invoice).primary}"? Cannot be undone.`;
      if (!window.confirm(message)) {
        return;
      }
      // Optimistic remove — restore by refetching if the request fails.
      setInvoices((prev) => prev.filter((row) => row.id !== invoice.id));
      try {
        await deleteInvoice(invoice.id);
        toast.success(isBills ? "Bill deleted" : "Invoice deleted");
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : `Failed to delete ${isBills ? "bill" : "invoice"}`;
        toast.error(msg);
      } finally {
        void fetchInvoices();
      }
    },
    [fetchInvoices, isBills],
  );

  const columns = useMemo(
    () => [
      {
        key: "invoiceNo",
        mobileRole: "title" as const,
        header: isBills ? "Bill No" : "Invoice No",
        sortable: true,
        render: (i: Invoice) => {
          const { primary, secondary } = documentNos(i);
          return (
            <div className="flex flex-col">
              <span className="font-medium">{primary}</span>
              {secondary ? (
                <span className="text-muted-foreground text-[10px] tabular-nums">
                  {secondary}
                </span>
              ) : null}
            </div>
          );
        },
      },
      ...(lockedType
        ? []
        : [
            {
              key: "type",
              mobileRole: "detail" as const,
              header: "Type",
              sortable: true,
              render: (i: Invoice) => (
                <Badge variant={i.type === "receivable" ? "blue" : "amber"}>
                  {i.type}
                </Badge>
              ),
            },
          ]),
      {
        key: "counterparty",
        mobileRole: "subtitle" as const,
        header: isBills ? "Vendor" : "Counterparty",
        sortable: true,
        render: (i: Invoice) => i.counterparty,
      },
      ...(isBills
        ? [
            {
              key: "vendorTaxInvoiceNo",
              header: "Vendor tax invoice",
              render: (i: Invoice) => i.vendorTaxInvoiceNo || "—",
            },
          ]
        : []),
      {
        key: "amount",
        mobileRole: "field" as const,
        header: "Amount",
        sortable: true,
        render: (i: Invoice) => (
          <span className="tabular-nums">
            {formatCurrency(i.amount)} {i.currency}
          </span>
        ),
        className: "text-right",
      },
      {
        key: "issueDate",
        mobileRole: "detail" as const,
        header: "Issue Date",
        sortable: true,
        render: (i: Invoice) => (
          <span className="tabular-nums">{formatDate(i.issueDate)}</span>
        ),
      },
      {
        key: "dueDate",
        mobileRole: "field" as const,
        header: "Due Date",
        sortable: true,
        render: (i: Invoice) => (
          <span className="tabular-nums">{formatDate(i.dueDate)}</span>
        ),
      },
      {
        key: "status",
        mobileRole: "badge" as const,
        header: "Status",
        sortable: true,
        render: (i: Invoice) => <Badge status={i.status}>{i.status}</Badge>,
      },
      {
        key: "actions",
        mobileRole: "actions" as const,
        header: "",
        className: "w-12 text-right",
        render: (i: Invoice) => (
          // Keep the actions menu from triggering the row-click detail view —
          // clicking "…" should open the menu, not the sheet.
          <div
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
                {canCreate && (
                  <DropdownMenuItem onClick={() => setEditing(i)}>
                    <Pencil className="mr-2 size-3.5" />
                    Edit
                  </DropdownMenuItem>
                )}
                {canCreate &&
                  ["sent", "partial", "overdue"].includes(i.status) && (
                    <DropdownMenuItem onClick={() => setPaying(i)}>
                      <Wallet className="mr-2 size-3.5" />
                      {i.type === "payable" ? "Pay bill" : "Record receipt"}
                    </DropdownMenuItem>
                  )}
                {canRead && (
                  <DropdownMenuItem
                    onClick={() => void handleDownloadPdf(i.id)}
                  >
                    <FileText className="mr-2 size-3.5" />
                    Download PDF
                  </DropdownMenuItem>
                )}
                {canRead && (
                  <DropdownMenuItem
                    onClick={() => void handleDownloadDocx(i.id)}
                  >
                    <FileText className="mr-2 size-3.5" />
                    Download Word
                  </DropdownMenuItem>
                )}
                {canRead && (
                  <DropdownMenuItem
                    onClick={() => void handleDownloadXlsx(i.id)}
                  >
                    <FileSpreadsheet className="mr-2 size-3.5" />
                    Download Excel
                  </DropdownMenuItem>
                )}
                {canRead && (
                  <DropdownMenuItem
                    onClick={() =>
                      window.open(invoicePrintPath(i.id), "_blank")
                    }
                  >
                    <Printer className="mr-2 size-3.5" />
                    Print view
                  </DropdownMenuItem>
                )}
                {canAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => void handleDelete(i)}
                    >
                      <Trash2 className="mr-2 size-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [
      isBills,
      lockedType,
      canCreate,
      canRead,
      canAdmin,
      handleDownloadPdf,
      handleDownloadDocx,
      handleDownloadXlsx,
      handleDelete,
    ],
  );

  const filtersDirty = useMemo(
    () =>
      entityFilter !== ALL_FILTER ||
      statusFilter !== ALL_FILTER ||
      (!lockedType && typeFilter !== ALL_FILTER),
    [entityFilter, statusFilter, typeFilter, lockedType],
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

        {lockedType ? null : (
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-10 min-w-[120px] text-xs">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All types</SelectItem>
              {INVOICE_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 min-w-[120px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
            {INVOICE_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
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
              if (!lockedType) setTypeFilter(ALL_FILTER);
            }}
            className="text-xs"
          >
            Clear
          </Button>
        )}

        {canAdmin && !isBills ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setCompanyOpen(true)}
            className="md:ml-auto"
          >
            <Building2 className="size-3.5" />
            Company details
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={invoices}
        loading={loading}
        emptyMessage={isBills ? "No bills found" : "No invoices found"}
        onRowClick={(i) => window.open(invoicePrintPath(i.id), "_blank")}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
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

      <InvoiceDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        entities={entities}
        invoice={editing ?? undefined}
        onSaved={() => {
          setEditing(null);
          void fetchInvoices();
        }}
      />

      <InvoiceCompanyDialog open={companyOpen} onOpenChange={setCompanyOpen} />

      <PaymentDialog
        open={!!paying}
        onOpenChange={(o) => !o && setPaying(null)}
        invoice={paying}
        onSaved={() => {
          setPaying(null);
          void fetchInvoices();
        }}
      />
    </div>
  );
}
