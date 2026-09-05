"use client";

import dayjs from "dayjs";
import {
  Download,
  ExternalLink,
  Eye,
  Loader2,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ApplicationDetailDialog } from "@/components/applications/application-detail-dialog";
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
  type Application,
  deleteApplication,
  downloadApplicationsExport,
  listApplications,
} from "@/services/application.service";
import type { JobTitle } from "@/services/career.service";

const ALL_FILTER = "__all__";

interface ApplicationsManagementProps {
  jobTitles: JobTitle[];
  showJobFilter?: boolean;
}

export function ApplicationsManagement({
  jobTitles,
  showJobFilter = true,
}: ApplicationsManagementProps) {
  const { hasPermission } = useAuth();
  const canView = hasPermission("application:read");
  const canDelete = hasPermission("application:delete");
  const canExport = hasPermission("application:export");

  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const pagination = usePagination();
  const { page, pageSize, setPage, setTotalCount } = pagination;
  const [jobFilter, setJobFilter] = useState(ALL_FILTER);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchApps = useCallback(async () => {
    if (!canView) return;
    try {
      setLoading(true);
      const result = await listApplications({
        page,
        limit: pageSize,
        jobId: jobFilter === ALL_FILTER ? undefined : jobFilter,
        search: debouncedSearch || undefined,
      });
      setApps(result.data);
      setTotalCount(result.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load applications";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [canView, page, pageSize, jobFilter, debouncedSearch, setTotalCount]);

  useEffect(() => {
    void fetchApps();
  }, [fetchApps]);

  useEffect(() => {
    setPage(1);
  }, [jobFilter, debouncedSearch, setPage]);

  async function handleDeleteConfirm(e: React.MouseEvent<HTMLButtonElement>) {
    if (!deleteTarget) return;
    e.preventDefault();
    try {
      setDeleting(true);
      await deleteApplication(deleteTarget.id);
      toast.success("Application deleted");
      setDeleteTarget(null);
      void fetchApps();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to delete application";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  const handleExportApplications = async () => {
    try {
      await downloadApplicationsExport({
        jobId: jobFilter === ALL_FILTER ? undefined : jobFilter,
        search: debouncedSearch || undefined,
      });
    } catch {
      toast.error("Export failed");
    }
  };

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm">
        You do not have permission to view applications.
      </p>
    );
  }

  const columns = [
    {
      key: "applicant",
      header: "Applicant",
      render: (a: Application) => (
        <div className="flex items-center gap-2.5">
          <div
            className={`
              bg-primary/10 text-primary flex size-7 items-center justify-center
              rounded-full text-[10px] font-bold
            `}
          >
            {a.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)}
          </div>
          <div>
            <p className="text-foreground text-[12.5px] font-medium">
              {a.name}
            </p>
            <p className="text-muted-foreground text-[11px]">{a.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (a: Application) => a.mobile,
    },
    {
      key: "position",
      header: "Position",
      render: (a: Application) =>
        a.job ? (
          <div>
            <p className="text-foreground text-[12.5px] font-medium">
              {a.job.title}
            </p>
            <p className="text-muted-foreground text-[11px]">
              {a.job.department}
            </p>
          </div>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        ),
    },
    {
      key: "applied",
      header: "Applied",
      render: (a: Application) => (
        <div>
          <p className="text-[12.5px]">
            {dayjs(a.createdAt).format("MMM D, YYYY")}
          </p>
          <p className="text-muted-foreground text-[11px]">
            {dayjs(a.createdAt).format("h:mm A")}
          </p>
        </div>
      ),
    },
    {
      key: "actions",
      mobileRole: "actions" as const,
      header: "",
      className: "w-[140px] text-right",
      render: (a: Application) => (
        <div className="flex items-center justify-end gap-1">
          {a.attachment && (
            <Button size="xs" variant="outline" asChild className="text-xs">
              <a href={a.attachment} target="_blank" rel="noopener noreferrer">
                Resume
                <ExternalLink className="ml-1 size-3" />
              </a>
            </Button>
          )}

          <ApplicationDetailDialog
            application={a}
            trigger={
              <Button size="xs" variant="secondary" className="text-xs">
                <Eye className="size-3" />
                View
              </Button>
            }
          />

          {canDelete && (
            <Button
              variant="ghost"
              size="xs"
              className="text-destructive h-7 px-1.5"
              onClick={() => setDeleteTarget(a)}
            >
              <Trash2 className="size-3" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`
          flex flex-col gap-2
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
            placeholder="Search by name or email..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        {showJobFilter && jobTitles.length > 0 && (
          <Select value={jobFilter} onValueChange={setJobFilter}>
            <SelectTrigger className="h-8 min-w-[200px] text-xs">
              <SelectValue placeholder="Filter by job" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All positions</SelectItem>
              {jobTitles.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {canExport && (
          <Button
            variant="outline"
            onClick={() => void handleExportApplications()}
          >
            <Download className="size-3.5" />
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
      </div>

      <DataTable
        columns={columns}
        data={apps}
        loading={loading}
        emptyMessage="No applications found"
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
            <AlertDialogTitle>Delete application</AlertDialogTitle>
            <AlertDialogDescription>
              Delete the application from &ldquo;
              <span className="text-foreground font-medium">
                {deleteTarget?.name ?? "this applicant"}
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
    </div>
  );
}
