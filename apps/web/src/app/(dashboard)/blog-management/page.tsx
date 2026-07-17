"use client";

import { Download, PenTool } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BlogCard } from "@/components/blogs/blog-card";
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
  type Blog,
  deleteBlog,
  downloadBlogsExport,
  listBlogs,
} from "@/services/blog.service";

const CreateBlogDialog = dynamic(
  () =>
    import("@/components/blogs/create-blog-dialog").then((m) => ({
      default: m.CreateBlogDialog,
    })),
  { ssr: false },
);

const PAGE_SIZE_OPTIONS = [12, 24, 48];

export default function BlogManagementPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("blog:create");
  const canUpdate = hasPermission("blog:update");
  const canDelete = hasPermission("blog:delete");
  const canExport = hasPermission("blog:read");

  const [blogs, setBlogs] = useState<Blog[]>([]);
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
        const res = await listBlogs({
          search: debouncedSearch.trim() || undefined,
          page: pagination.page,
          limit: pagination.pageSize,
        });
        setBlogs(res.data);
        pagination.setTotalCount(res.meta.total);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to load blogs";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination methods stable; avoid loop on setTotalCount
  }, [pagination.page, pagination.pageSize, debouncedSearch]);

  useEffect(() => {
    pagination.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const handleBlogCreated = (newBlog: Blog) => {
    setBlogs((prev) => [newBlog, ...prev]);
    pagination.setTotalCount(pagination.totalCount + 1);
  };

  const handleBlogUpdated = (updated: Blog) => {
    setBlogs((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const handleDeleteBlog = async (blogId: string) => {
    try {
      await deleteBlog(blogId);
      setBlogs((prev) => prev.filter((b) => b.id !== blogId));
      pagination.setTotalCount(Math.max(0, pagination.totalCount - 1));
      toast.success("Blog deleted successfully!");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete blog";
      toast.error(message);
    }
  };

  const handleExportCsv = async () => {
    try {
      await downloadBlogsExport();
    } catch {
      toast.error("Export failed");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Blog Management"
        subtitle="Create and manage blog posts for the company website"
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
            placeholder="Enter title..."
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
          {canCreate && <CreateBlogDialog onBlogCreated={handleBlogCreated} />}
        </div>
      </div>

      {loading ? (
        <CardGridSkeleton count={pagination.pageSize} />
      ) : blogs.length === 0 ? (
        <EmptyState
          icon={<PenTool />}
          title="No blogs found"
          description="Drafted posts and published articles will appear here. Create one to get started."
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
          {blogs.map((blog) => (
            <BlogCard
              key={blog.id}
              blog={blog}
              canEdit={canUpdate}
              canDelete={canDelete}
              onDeleteBlog={handleDeleteBlog}
              onBlogUpdated={handleBlogUpdated}
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
