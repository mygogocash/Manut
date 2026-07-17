"use client";

import { Download, FileText, Inbox, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { PageHeader } from "@/components/shared/page-header";
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
import {
  getSharedLegalDownloadUrl,
  LEGAL_KIND_LABELS,
  LEGAL_KINDS,
  LEGAL_STATUS_LABELS,
  type LegalDocument,
  listSharedLegalDocuments,
} from "@/services/legal.service";

const ALL = "__all__";

const STATUS_VARIANT: Record<
  string,
  "green" | "red" | "grey" | "blue" | "gold"
> = {
  active: "green",
  expired: "red",
  archived: "grey",
  draft: "blue",
};

export default function SharedLegalDocumentsPage() {
  const { hasPermission } = useAuth();
  const canViewShared = hasPermission("legal:view-shared");

  const [docs, setDocs] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [kindFilter, setKindFilter] = useState<string>(ALL);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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

  const fetchDocs = useCallback(async () => {
    if (!canViewShared) return;
    try {
      setLoading(true);
      const res = await listSharedLegalDocuments({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        kind: kindFilter === ALL ? undefined : kindFilter,
      });
      setDocs(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to load shared documents";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [
    canViewShared,
    page,
    pageSize,
    debouncedSearch,
    kindFilter,
    setTotalCount,
  ]);

  useEffect(() => {
    void fetchDocs();
  }, [fetchDocs]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, kindFilter, setPage]);

  const handleDownload = useCallback(async (doc: LegalDocument) => {
    if (!doc.fileUrl) {
      toast.error("This document has no attached file");
      return;
    }
    try {
      setDownloadingId(doc.id);
      const res = await getSharedLegalDownloadUrl(doc.id);
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to open file";
      toast.error(message);
    } finally {
      setDownloadingId(null);
    }
  }, []);

  if (!canViewShared) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        You don&apos;t have permission to view shared legal documents.
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Shared documents"
        subtitle="Legal documents shared with you — directly, via your department, or via a group."
      />

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
            placeholder="Search by title…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="h-10 min-w-[140px] text-xs">
            <SelectValue placeholder="Kind" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All kinds</SelectItem>
            {LEGAL_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {LEGAL_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-muted-foreground py-12 text-center text-xs">
            Loading…
          </p>
        ) : docs.length === 0 ? (
          <div
            className={`
              border-border rounded-lg border border-dashed py-12 text-center
            `}
          >
            <Inbox className="text-muted-foreground mx-auto size-6" />
            <p className="text-muted-foreground mt-2 text-xs">
              Nothing shared with you yet.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {docs.map((d) => {
              const status = d.effectiveStatus ?? d.status;
              return (
                <li
                  key={d.id}
                  className={`
                    border-border bg-surface flex items-start justify-between
                    gap-3 rounded-lg border p-4 shadow-sm
                  `}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText className="text-bronze size-4 shrink-0" />
                      <p
                        className={`
                          text-foreground truncate text-sm font-semibold
                        `}
                      >
                        {d.title}
                      </p>
                      <Badge variant="grey">{LEGAL_KIND_LABELS[d.kind]}</Badge>
                      <Badge variant={STATUS_VARIANT[status] ?? "grey"}>
                        {LEGAL_STATUS_LABELS[status] ?? status}
                      </Badge>
                      {d.entity ? (
                        <Badge variant="blue">{d.entity.name}</Badge>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground mt-1 text-[11px]">
                      {d.reference ? `${d.reference} · ` : ""}
                      {d.effectiveExpiry
                        ? `expires ${d.effectiveExpiry}`
                        : "no expiry"}
                      {d.owner ? ` · ${d.owner.name}` : ""}
                    </p>
                  </div>
                  {d.fileUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={downloadingId === d.id}
                      onClick={() => void handleDownload(d)}
                    >
                      <Download className="size-3.5" />
                      Open
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <DataPagination
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}
