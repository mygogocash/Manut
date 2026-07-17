"use client";

import { Download, Newspaper } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CreatePRDialog } from "@/components/articles/create-pr-dialog";
import { PRCard } from "@/components/articles/pr-card";
import { CardGridSkeleton } from "@/components/shared/card-grid-skeleton";
import { DataPagination } from "@/components/shared/data-pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  type Article,
  deleteArticle,
  downloadArticlesExport,
  listArticles,
} from "@/services/article.service";

const PAGE_SIZE_OPTIONS = [12, 24, 48];

export default function PRManagementPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("pr:create");
  const canUpdate = hasPermission("pr:update");
  const canDelete = hasPermission("pr:delete");
  const canExport = hasPermission("pr:read");

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);

  const pagination = usePagination({
    initialPage: 1,
    initialPageSize: 12,
    initialTotal: 0,
  });

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await listArticles({
          search: debouncedSearch.trim() || undefined,
          page: pagination.page,
          limit: pagination.pageSize,
        });
        setArticles(res.data);
        pagination.setTotalCount(res.meta.total);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to load articles";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.pageSize, debouncedSearch]);

  useEffect(() => {
    pagination.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const handlePRCreated = (article: Article) => {
    setArticles((prev) => [article, ...prev]);
    pagination.setTotalCount(pagination.totalCount + 1);
  };

  const handlePRUpdated = (updated: Article) => {
    setArticles((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const handleDeletePR = async (id: string) => {
    try {
      await deleteArticle(id);
      setArticles((prev) => prev.filter((a) => a.id !== id));
      pagination.setTotalCount(Math.max(0, pagination.totalCount - 1));
      toast.success("PR article deleted successfully!");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete article";
      toast.error(message);
    }
  };

  const handleExportCsv = async () => {
    try {
      await downloadArticlesExport();
    } catch {
      toast.error("Failed to export PR articles.");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="PR Management"
        subtitle="Manage press release articles and media coverage"
      />

      <div
        className={`
          flex flex-col gap-2
          sm:flex-row sm:items-center sm:justify-between
        `}
      >
        <div
          className={`
            w-full
            sm:w-auto
          `}
        >
          <Input
            className={`
              w-full
              sm:min-w-[20rem]
            `}
            placeholder="Search by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          {canExport && (
            <Button variant="outline" onClick={() => void handleExportCsv()}>
              <Download
                className={`
                  size-4
                  sm:mr-2
                `}
              />
              <span
                className={`
                  hidden
                  sm:inline
                `}
              >
                Export CSV
              </span>
            </Button>
          )}
          {canCreate && <CreatePRDialog onPRCreated={handlePRCreated} />}
        </div>
      </div>

      {loading ? (
        <CardGridSkeleton count={pagination.pageSize} />
      ) : articles.length === 0 ? (
        <EmptyState
          icon={<Newspaper />}
          title="No articles found"
          description="Press releases and external articles will appear here. Create one to share with stakeholders."
        />
      ) : (
        <div
          className={`
            grid grid-cols-1 gap-4
            md:grid-cols-2
            xl:grid-cols-3
            2xl:grid-cols-4
          `}
        >
          {articles.map((article) => (
            <PRCard
              key={article.id}
              article={article}
              canEdit={canUpdate}
              canDelete={canDelete}
              onDeletePR={handleDeletePR}
              onPRUpdated={handlePRUpdated}
            />
          ))}
        </div>
      )}

      <DataPagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        totalCount={pagination.totalCount}
        pageSize={pagination.pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </div>
  );
}
