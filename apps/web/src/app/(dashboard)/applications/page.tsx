"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ApplicationsManagement } from "@/components/applications/applications-management";
import { PageHeader } from "@/components/shared/page-header";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { getJobTitles, type JobTitle } from "@/services/career.service";

export default function ApplicationsPage() {
  const { hasPermission } = useAuth();
  const canReadCareers = hasPermission("career:read");

  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);

  const fetchJobTitles = useCallback(async () => {
    if (!canReadCareers) {
      setJobTitles([]);
      return;
    }
    try {
      const result = await getJobTitles();
      setJobTitles(result.data);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load job list";
      toast.error(msg);
    }
  }, [canReadCareers]);

  useEffect(() => {
    void fetchJobTitles();
  }, [fetchJobTitles]);

  return (
    <div>
      <PageHeader
        title="Applications"
        subtitle="Review candidates and resumes by position"
      />
      <ApplicationsManagement
        jobTitles={jobTitles}
        showJobFilter={canReadCareers}
      />
    </div>
  );
}
