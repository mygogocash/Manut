"use client";

import { Briefcase, Download, PlusCircle, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ApplicationsManagement } from "@/components/applications/applications-management";
import { JobCard } from "@/components/careers/job-card";
import { JobFormDialog } from "@/components/careers/job-form-dialog";
import { DataPagination } from "@/components/shared/data-pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent } from "@/components/shared/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  deleteJob,
  downloadJobsExport,
  getJobTitles,
  type Job,
  type JobTitle,
  listJobs,
} from "@/services/career.service";

function CardGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div
      className={`
        grid grid-cols-1 gap-4
        md:grid-cols-2
        xl:grid-cols-3
        2xl:grid-cols-4
      `}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="ring-foreground/10 space-y-3 rounded-xl p-4 ring-1"
        >
          <div className="flex items-start justify-between">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
          <Skeleton className="h-3 w-1/3" />
          <div className="flex flex-col gap-1.5 pt-1">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="flex justify-between pt-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="flex justify-between border-t pt-3">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CareersPage() {
  const { hasPermission } = useAuth();

  const canCreate = hasPermission("career:create");
  const canEdit = hasPermission("career:update");
  const canDelete = hasPermission("career:delete");
  const canExport = hasPermission("career:export");
  const canViewApps = hasPermission("application:read");

  const [activeTab, setActiveTab] = useState("jobs");
  const [jobDialogOpen, setJobDialogOpen] = useState(false);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const jobsPagination = usePagination({ initialPageSize: 12 });
  const {
    page: jobsPage,
    pageSize: jobsPageSize,
    setPage: setJobsPage,
    setTotalCount: setJobsTotalCount,
  } = jobsPagination;
  const [jobSearch, setJobSearch] = useState("");
  const debouncedJobSearch = useDebounce(jobSearch, 350);

  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);

  const fetchJobs = useCallback(async () => {
    try {
      setLoadingJobs(true);
      const result = await listJobs({
        page: jobsPage,
        limit: jobsPageSize,
        search: debouncedJobSearch || undefined,
      });
      setJobs(result.data);
      setJobsTotalCount(result.meta.total);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to load jobs";
      toast.error(msg);
    } finally {
      setLoadingJobs(false);
    }
  }, [jobsPage, jobsPageSize, debouncedJobSearch, setJobsTotalCount]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    setJobsPage(1);
  }, [debouncedJobSearch, setJobsPage]);

  useEffect(() => {
    async function loadTitles() {
      try {
        const res = await getJobTitles();
        setJobTitles(res.data);
      } catch {
        /* silent */
      }
    }
    void loadTitles();
  }, []);

  const handleJobCreated = useCallback(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const handleJobUpdated = useCallback((updatedJob: Job) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === updatedJob.id ? updatedJob : j)),
    );
  }, []);

  async function handleDeleteJob(id: string) {
    try {
      await deleteJob(id);
      toast.success("Job deleted");
      void fetchJobs();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to delete job";
      toast.error(msg);
    }
  }

  const handleExportJobs = async () => {
    try {
      await downloadJobsExport();
    } catch {
      toast.error("Export failed");
    }
  };

  const tabsList = useMemo(() => {
    const tabs = [{ id: "jobs", label: "Jobs" }];
    if (canViewApps) tabs.push({ id: "applications", label: "Applications" });
    return tabs;
  }, [canViewApps]);

  return (
    <div>
      <PageHeader
        title="Careers"
        subtitle="Manage job postings and applications"
      >
        {canCreate && (
          <Button onClick={() => setJobDialogOpen(true)}>
            <PlusCircle className="size-3.5" />
            Create Job
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-col gap-4">
        <Tabs tabs={tabsList} active={activeTab} onChange={setActiveTab}>
          <TabsContent value="jobs">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="relative max-w-sm">
                <Search
                  className={`
                    text-muted-foreground absolute top-1/2 left-2.5 size-3.5
                    -translate-y-1/2
                  `}
                />
                <Input
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  placeholder="Search jobs..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              {canExport && (
                <Button
                  variant="outline"
                  onClick={() => void handleExportJobs()}
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

            {loadingJobs ? (
              <CardGridSkeleton count={jobsPagination.pageSize} />
            ) : jobs.length === 0 ? (
              <EmptyState
                icon={<Briefcase />}
                title="No jobs found"
                description="Once roles are posted, they'll show up here. Try adjusting filters or check back soon."
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
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onDeleteJob={handleDeleteJob}
                    onJobUpdated={handleJobUpdated}
                  />
                ))}
              </div>
            )}

            <div className="mt-4">
              <DataPagination
                page={jobsPagination.page}
                pageSize={jobsPagination.pageSize}
                totalCount={jobsPagination.totalCount}
                totalPages={jobsPagination.totalPages}
                onPageChange={jobsPagination.setPage}
                onPageSizeChange={jobsPagination.setPageSize}
              />
            </div>
          </TabsContent>

          {canViewApps && (
            <TabsContent value="applications">
              <ApplicationsManagement jobTitles={jobTitles} showJobFilter />
            </TabsContent>
          )}
        </Tabs>
      </div>

      <JobFormDialog
        open={jobDialogOpen}
        onOpenChange={setJobDialogOpen}
        onCreated={handleJobCreated}
      />
    </div>
  );
}
