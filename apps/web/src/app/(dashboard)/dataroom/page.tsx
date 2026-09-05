"use client";

import { format } from "date-fns";
import {
  Edit,
  ExternalLink,
  FileText,
  FolderOpen,
  HardDrive,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DeleteDocumentDialog } from "@/components/dataroom/delete-document-dialog";
import { DocumentFormDialog } from "@/components/dataroom/document-form-dialog";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionButton } from "@/components/shared/permission-button";
import { PermissionDropdownMenuItem } from "@/components/shared/permission-dropdown-menu-item";
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
import { trackDocumentDownloaded } from "@/lib/events";
import {
  CATEGORY_LABELS,
  type CategorySummary,
  type DataRoomDocument,
  DOCUMENT_CATEGORIES,
  formatFileSize,
  getCategorySummary,
  listDocuments,
} from "@/services/dataroom.service";

const ALL_CATEGORIES_VALUE = "__all__";

const CATEGORY_BADGE_VARIANTS: Record<
  string,
  "blue" | "green" | "amber" | "gold" | "grey"
> = {
  legal: "blue",
  financial: "green",
  technical: "amber",
  pitch: "gold",
  other: "grey",
};

function SummaryCards({ summary }: { summary: CategorySummary[] }) {
  const totalDocs = summary.reduce((sum, s) => sum + s.count, 0);
  const totalSize = summary.reduce((sum, s) => sum + s.totalSize, 0);

  return (
    <div
      className={`
        mb-6 grid grid-cols-2 gap-3
        lg:grid-cols-4
        xl:grid-cols-7
      `}
    >
      <div
        className={`
          bg-surface border-border col-span-2 flex flex-col rounded-lg border
          p-4 shadow-sm
          lg:col-span-1
        `}
      >
        <div
          className={`
            bg-primary/10 text-primary mb-3 flex size-8 items-center
            justify-center rounded-lg
          `}
        >
          <HardDrive className="size-4" />
        </div>
        <p
          className={`
            text-muted-foreground text-[9.5px] font-bold tracking-widest
            uppercase
          `}
        >
          All documents
        </p>
        <p className="text-foreground mt-1 text-lg font-semibold tabular-nums">
          {totalDocs}
        </p>
        <p className="text-muted-foreground text-[11px]">
          {formatFileSize(totalSize)} total
        </p>
      </div>
      {DOCUMENT_CATEGORIES.map((cat) => {
        const data = summary.find((s) => s.category === cat);
        const count = data?.count ?? 0;
        const size = data?.totalSize ?? 0;
        return (
          <div
            key={cat}
            className={`
              bg-surface border-border flex flex-col rounded-lg border p-4
              shadow-sm
            `}
          >
            <div className="mb-3 flex items-center gap-2">
              <FolderOpen className="text-muted-foreground size-3.5" />
              <Badge variant={CATEGORY_BADGE_VARIANTS[cat] ?? "grey"}>
                {CATEGORY_LABELS[cat]}
              </Badge>
            </div>
            <p className="text-foreground text-lg font-semibold tabular-nums">
              {count}
            </p>
            <p className="text-muted-foreground text-[11px]">
              {formatFileSize(size)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function DataRoomPage() {
  const [documents, setDocuments] = useState<DataRoomDocument[]>([]);
  const [summary, setSummary] = useState<CategorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const pagination = usePagination();
  const { page, pageSize, setTotalCount } = pagination;
  const [formOpen, setFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DataRoomDocument | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<DataRoomDocument | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listDocuments({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        category: categoryFilter || undefined,
      });
      setDocuments(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load documents";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, categoryFilter, setTotalCount]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await getCategorySummary();
      setSummary(res.data);
    } catch {
      toast.error("Failed to load summary");
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  function handleSaved() {
    fetchDocuments();
    fetchSummary();
  }

  function openUpload() {
    setEditingDoc(null);
    setFormOpen(true);
  }

  function openEdit(doc: DataRoomDocument) {
    setEditingDoc(doc);
    setFormOpen(true);
  }

  function openDelete(doc: DataRoomDocument) {
    setDeletingDoc(doc);
    setDeleteOpen(true);
  }

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (d: DataRoomDocument) => (
        <div className="flex items-center gap-2">
          <FileText className="text-muted-foreground size-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-foreground truncate font-medium">{d.name}</p>
            {d.description && (
              <p className="text-muted-foreground truncate text-[11px]">
                {d.description}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (d: DataRoomDocument) => (
        <Badge variant={CATEGORY_BADGE_VARIANTS[d.category] ?? "grey"}>
          {CATEGORY_LABELS[d.category] ?? d.category}
        </Badge>
      ),
    },
    {
      key: "fileSize",
      header: "Size",
      render: (d: DataRoomDocument) => (
        <span className="tabular-nums">{formatFileSize(d.fileSize)}</span>
      ),
    },
    {
      key: "uploader",
      header: "Uploaded by",
      render: (d: DataRoomDocument) => d.uploader?.name ?? "—",
    },
    {
      key: "uploadedAt",
      header: "Date",
      render: (d: DataRoomDocument) =>
        format(new Date(d.uploadedAt), "MMM d, yyyy"),
    },
    {
      key: "actions",
      mobileRole: "actions" as const,
      header: "",
      className: "w-10",
      render: (d: DataRoomDocument) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a
                href={d.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackDocumentDownloaded({
                    document_id: d.id,
                    document_kind: "dataroom",
                  })
                }
              >
                <ExternalLink className="mr-2 size-3.5" />
                Open file
              </a>
            </DropdownMenuItem>
            <PermissionDropdownMenuItem
              permission="dataroom:manage"
              onClick={() => openEdit(d)}
            >
              <Edit className="mr-2 size-3.5" />
              Edit
            </PermissionDropdownMenuItem>
            <DropdownMenuSeparator />
            <PermissionDropdownMenuItem
              permission="dataroom:manage"
              className="text-destructive"
              onClick={() => openDelete(d)}
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
      <PageHeader
        title="Data Room"
        subtitle="Manage documents shared with investors"
      >
        <PermissionButton permission="dataroom:upload" onClick={openUpload}>
          <Plus className="mr-1.5 size-3.5" />
          Upload document
        </PermissionButton>
      </PageHeader>

      <SummaryCards summary={summary} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            className={`
              text-muted-foreground pointer-events-none absolute top-1/2 left-3
              size-3.5 -translate-y-1/2
            `}
          />
          <Input
            placeholder="Search documents…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              pagination.setPage(1);
            }}
            className="h-9 pl-9 text-[13px]"
          />
        </div>
        <Select
          value={categoryFilter || ALL_CATEGORIES_VALUE}
          onValueChange={(v) => {
            setCategoryFilter(v === ALL_CATEGORIES_VALUE ? "" : v);
            pagination.setPage(1);
          }}
        >
          <SelectTrigger className="h-10 w-40 text-[13px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES_VALUE}>All categories</SelectItem>
            {DOCUMENT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={documents}
        loading={loading}
        emptyMessage="No documents found"
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

      <DocumentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        document={editingDoc}
        onSaved={handleSaved}
      />

      <DeleteDocumentDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        document={deletingDoc}
        onDeleted={handleSaved}
      />
    </div>
  );
}
