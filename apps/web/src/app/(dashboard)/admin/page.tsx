"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminAuditTab } from "@/components/admin/admin-audit-tab";
import { AdminOverviewTab } from "@/components/admin/admin-overview-tab";
import {
  AdminUsageTab,
  type UsageView,
} from "@/components/admin/usage/admin-usage-tab";
import { DataPagination } from "@/components/shared/data-pagination";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs } from "@/components/shared/tabs";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { type AuditLogEntry, listAuditLogs } from "@/services/admin.service";
import {
  type ActivitySource,
  type BucketHealth,
  getBucketHealth,
  getUsageTotals,
  listUserActivity,
  listUserStorage,
  type PerUserActivity,
  type PerUserStorage,
  type WorkspaceUsageTotals,
} from "@/services/admin-usage.service";
import { listRoles, type RoleListItem } from "@/services/role.service";
import {
  getUserStats,
  listUsers,
  type UserListItem,
  type UserStats,
} from "@/services/user.service";

export default function AdminPage() {
  const { hasPermission } = useAuth();
  const canViewAudit = hasPermission("admin:audit-log");
  const canViewUsage = hasPermission("admin:usage-report");

  const tabsList = useMemo(() => {
    const tabs = [{ id: "overview", label: "Overview" }];
    if (canViewUsage) tabs.push({ id: "usage", label: "Workspace Usage" });
    if (canViewAudit) tabs.push({ id: "audit", label: "Audit Log" });
    return tabs;
  }, [canViewAudit, canViewUsage]);

  const [tab, setTab] = useState("overview");

  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<UserListItem[]>([]);
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewLoaded, setOverviewLoaded] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const auditPagination = usePagination();
  const [auditLastPage, setAuditLastPage] = useState<string>("");

  const [filterResource, setFilterResource] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const debouncedResource = useDebounce(filterResource, 400);

  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const [usageTotals, setUsageTotals] = useState<WorkspaceUsageTotals | null>(
    null,
  );
  const [loadingUsageTotals, setLoadingUsageTotals] = useState(false);
  const [usageView, setUsageView] = useState<UsageView>("storage");

  const [usageRows, setUsageRows] = useState<PerUserStorage[]>([]);
  const [loadingUsageRows, setLoadingUsageRows] = useState(false);
  const [usageSearch, setUsageSearch] = useState("");
  const debouncedUsageSearch = useDebounce(usageSearch, 400);
  const usagePagination = usePagination();
  const [usageLastKey, setUsageLastKey] = useState("");

  const [activityRows, setActivityRows] = useState<PerUserActivity[]>([]);
  const [activitySource, setActivitySource] =
    useState<ActivitySource>("audit_log");
  const [loadingActivityRows, setLoadingActivityRows] = useState(false);
  const [activitySearch, setActivitySearch] = useState("");
  const debouncedActivitySearch = useDebounce(activitySearch, 400);
  const activityPagination = usePagination();
  const [activityLastKey, setActivityLastKey] = useState("");

  const [bucketHealth, setBucketHealth] = useState<BucketHealth | null>(null);
  const [loadingBuckets, setLoadingBuckets] = useState(false);

  const fetchOverview = useCallback(async () => {
    try {
      setLoadingOverview(true);
      const [statsRes, usersRes, rolesRes] = await Promise.all([
        getUserStats(),
        listUsers({ limit: 5, sortBy: "createdAt", sortOrder: "desc" }),
        listRoles(),
      ]);
      setUserStats(statsRes.data);
      setRecentUsers(usersRes.data);
      setRoles(rolesRes.data);
      setOverviewLoaded(true);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load overview";
      toast.error(message);
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoadingAudit(true);
      const res = await listAuditLogs({
        page: auditPagination.page,
        limit: auditPagination.pageSize,
        resource: debouncedResource || undefined,
        action: filterAction || undefined,
      });
      setAuditLogs(res.data);
      auditPagination.setTotalCount(res.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load audit logs";
      toast.error(message);
    } finally {
      setLoadingAudit(false);
    }
  }, [auditPagination, debouncedResource, filterAction]);

  useEffect(() => {
    if (tab === "overview" && !overviewLoaded) {
      void fetchOverview();
    }
  }, [tab, overviewLoaded, fetchOverview]);

  const auditPageKey = `${auditPagination.page}-${auditPagination.pageSize}-${debouncedResource}-${filterAction}`;
  useEffect(() => {
    if (tab !== "audit" || !canViewAudit) return;
    if (auditLastPage === auditPageKey && auditLogs.length > 0) return;
    setAuditLastPage(auditPageKey);
    void fetchAuditLogs();
  }, [
    tab,
    canViewAudit,
    auditPageKey,
    auditLastPage,
    auditLogs.length,
    fetchAuditLogs,
  ]);

  useEffect(() => {
    auditPagination.setPage(1);
    setAuditLastPage("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedResource, filterAction]);

  const fetchUsageTotals = useCallback(async () => {
    try {
      setLoadingUsageTotals(true);
      const res = await getUsageTotals();
      setUsageTotals(res.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load usage totals";
      toast.error(message);
    } finally {
      setLoadingUsageTotals(false);
    }
  }, []);

  const fetchUsageRows = useCallback(async () => {
    try {
      setLoadingUsageRows(true);
      const res = await listUserStorage({
        page: usagePagination.page,
        limit: usagePagination.pageSize,
        search: debouncedUsageSearch || undefined,
      });
      setUsageRows(res.data);
      usagePagination.setTotalCount(res.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load storage rows";
      toast.error(message);
    } finally {
      setLoadingUsageRows(false);
    }
  }, [usagePagination, debouncedUsageSearch]);

  const usageKey = `${usagePagination.page}-${usagePagination.pageSize}-${debouncedUsageSearch}`;
  useEffect(() => {
    if (tab !== "usage" || !canViewUsage) return;
    if (usageView !== "storage") return;
    if (usageLastKey === usageKey && usageRows.length > 0) return;
    setUsageLastKey(usageKey);
    void fetchUsageRows();
  }, [
    tab,
    canViewUsage,
    usageView,
    usageKey,
    usageLastKey,
    usageRows.length,
    fetchUsageRows,
  ]);

  useEffect(() => {
    if (tab !== "usage" || !canViewUsage) return;
    if (usageTotals !== null) return;
    void fetchUsageTotals();
  }, [tab, canViewUsage, usageTotals, fetchUsageTotals]);

  const fetchBucketHealth = useCallback(async () => {
    try {
      setLoadingBuckets(true);
      const res = await getBucketHealth();
      setBucketHealth(res.data);
    } catch {
      // Silent — bucket snapshot is optional for the storage view to render.
    } finally {
      setLoadingBuckets(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== "usage" || !canViewUsage) return;
    if (usageView !== "storage") return;
    if (bucketHealth !== null) return;
    void fetchBucketHealth();
  }, [tab, canViewUsage, usageView, bucketHealth, fetchBucketHealth]);

  useEffect(() => {
    usagePagination.setPage(1);
    setUsageLastKey("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedUsageSearch]);

  const fetchActivityRows = useCallback(async () => {
    try {
      setLoadingActivityRows(true);
      const res = await listUserActivity({
        page: activityPagination.page,
        limit: activityPagination.pageSize,
        search: debouncedActivitySearch || undefined,
      });
      setActivityRows(res.data);
      setActivitySource(res.meta.source);
      activityPagination.setTotalCount(res.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load activity rows";
      toast.error(message);
    } finally {
      setLoadingActivityRows(false);
    }
  }, [activityPagination, debouncedActivitySearch]);

  const activityKey = `${activityPagination.page}-${activityPagination.pageSize}-${debouncedActivitySearch}`;
  useEffect(() => {
    if (tab !== "usage" || !canViewUsage) return;
    if (usageView !== "activity") return;
    if (activityLastKey === activityKey && activityRows.length > 0) return;
    setActivityLastKey(activityKey);
    void fetchActivityRows();
  }, [
    tab,
    canViewUsage,
    usageView,
    activityKey,
    activityLastKey,
    activityRows.length,
    fetchActivityRows,
  ]);

  useEffect(() => {
    activityPagination.setPage(1);
    setActivityLastKey("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedActivitySearch]);

  const fetchRecentActivity = useCallback(async () => {
    try {
      setLoadingActivity(true);
      const res = await listAuditLogs({ page: 1, limit: 5 });
      setRecentActivity(res.data);
    } catch {
      // silent — this is a preview, not critical
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "overview" && canViewAudit && recentActivity.length === 0) {
      void fetchRecentActivity();
    }
  }, [tab, canViewAudit, recentActivity.length, fetchRecentActivity]);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Administration"
        subtitle="Workspace overview, access control, and compliance audit trail"
      />

      <Tabs tabs={tabsList} active={tab} onChange={setTab} className="w-full" />

      {tab === "overview" && (
        <AdminOverviewTab
          loadingOverview={loadingOverview}
          userStats={userStats}
          recentUsers={recentUsers}
          roles={roles}
          canViewAudit={canViewAudit}
          loadingActivity={loadingActivity}
          recentActivity={recentActivity}
          onViewAllAudit={() => setTab("audit")}
        />
      )}

      {tab === "usage" && canViewUsage && (
        <AdminUsageTab
          totals={usageTotals}
          loadingTotals={loadingUsageTotals}
          view={usageView}
          onViewChange={setUsageView}
          storageRows={usageRows}
          loadingStorage={loadingUsageRows}
          storageSearch={usageSearch}
          onStorageSearchChange={setUsageSearch}
          storagePagination={
            <DataPagination
              page={usagePagination.page}
              pageSize={usagePagination.pageSize}
              totalCount={usagePagination.totalCount}
              totalPages={usagePagination.totalPages}
              onPageChange={usagePagination.setPage}
              onPageSizeChange={usagePagination.setPageSize}
            />
          }
          activityRows={activityRows}
          activitySource={activitySource}
          loadingActivity={loadingActivityRows}
          activitySearch={activitySearch}
          onActivitySearchChange={setActivitySearch}
          activityPagination={
            <DataPagination
              page={activityPagination.page}
              pageSize={activityPagination.pageSize}
              totalCount={activityPagination.totalCount}
              totalPages={activityPagination.totalPages}
              onPageChange={activityPagination.setPage}
              onPageSizeChange={activityPagination.setPageSize}
            />
          }
          bucketHealth={bucketHealth}
          loadingBuckets={loadingBuckets}
        />
      )}

      {tab === "audit" && (
        <AdminAuditTab
          canViewAudit={canViewAudit}
          auditLogs={auditLogs}
          loadingAudit={loadingAudit}
          filterResource={filterResource}
          filterAction={filterAction}
          onFilterResourceChange={setFilterResource}
          onFilterActionChange={setFilterAction}
          pagination={
            <DataPagination
              page={auditPagination.page}
              pageSize={auditPagination.pageSize}
              totalCount={auditPagination.totalCount}
              totalPages={auditPagination.totalPages}
              onPageChange={auditPagination.setPage}
              onPageSizeChange={auditPagination.setPageSize}
            />
          }
        />
      )}
    </div>
  );
}
