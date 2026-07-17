"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AttendanceTab } from "@/components/hrms/attendance-tab";
import { TABS_LIST } from "@/components/hrms/hrms-constants";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent } from "@/components/shared/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { type Entity, listEntities } from "@/services/entity.service";
import {
  deleteAllEquitySalaries,
  type EquityMonthlySalary,
  listEquitySalaries,
} from "@/services/equity-salary.service";
import {
  type AgreementType,
  bulkDeleteEsopGrants,
  deleteAgreement,
  deleteAllEsopGrants,
  deleteOffboardingRun,
  deleteOnboardingRun,
  type EmployeeAgreement,
  type EsopGrant,
  type EsopPool,
  type EsopSortField,
  getEsopGrants,
  getEsopPool,
  getOffboardingRuns,
  getOnboardingRuns,
  type OffboardingRun,
  type OffboardingTaskInput,
  type OnboardingRun,
  type OnboardingTaskInput,
  replaceOffboardingTasks,
  replaceOnboardingTasks,
  restoreOffboardingRun,
  restoreOnboardingRun,
  signOffboarding,
  updateOffboardingTask,
  updateOnboardingTask,
} from "@/services/hrms.service";

const ALL_FILTER = "__all__";

function DeferredPanelFallback() {
  return <div className="bg-muted/30 min-h-[300px] animate-pulse rounded-lg" />;
}

const EsopPoolCards = dynamic(
  () =>
    import("@/components/hrms/esop-pool-cards").then(
      (module) => module.EsopPoolCards,
    ),
  { loading: DeferredPanelFallback },
);
const EsopTab = dynamic(
  () => import("@/components/hrms/esop-tab").then((module) => module.EsopTab),
  { loading: DeferredPanelFallback },
);
const EquityMonthlySalaryTab = dynamic(
  () =>
    import("@/components/hrms/equity-monthly-salary-tab").then(
      (module) => module.EquityMonthlySalaryTab,
    ),
  { loading: DeferredPanelFallback },
);
const PayslipManagementTab = dynamic(
  () =>
    import("@/components/hrms/payslip-management-tab").then(
      (module) => module.PayslipManagementTab,
    ),
  { loading: DeferredPanelFallback },
);
const OnboardingTab = dynamic(
  () =>
    import("@/components/hrms/onboarding-tab").then(
      (module) => module.OnboardingTab,
    ),
  { loading: DeferredPanelFallback },
);
const OffboardingTab = dynamic(
  () =>
    import("@/components/hrms/offboarding-tab").then(
      (module) => module.OffboardingTab,
    ),
  { loading: DeferredPanelFallback },
);
const AgreementsTab = dynamic(
  () =>
    import("@/components/hrms/agreements-tab").then(
      (module) => module.AgreementsTab,
    ),
  { loading: DeferredPanelFallback },
);
const EsopGrantDialog = dynamic(() =>
  import("@/components/hrms/esop-grant-dialog").then(
    (module) => module.EsopGrantDialog,
  ),
);
const EsopBulkImportDialog = dynamic(() =>
  import("@/components/hrms/esop-bulk-import-dialog").then(
    (module) => module.EsopBulkImportDialog,
  ),
);
const DeleteGrantDialog = dynamic(() =>
  import("@/components/hrms/delete-grant-dialog").then(
    (module) => module.DeleteGrantDialog,
  ),
);
const OnboardingDialog = dynamic(() =>
  import("@/components/hrms/onboarding-dialog").then(
    (module) => module.OnboardingDialog,
  ),
);
const OffboardingDialog = dynamic(() =>
  import("@/components/hrms/offboarding-dialog").then(
    (module) => module.OffboardingDialog,
  ),
);
const AgreementUploadDialog = dynamic(() =>
  import("@/components/hrms/agreement-upload-dialog").then(
    (module) => module.AgreementUploadDialog,
  ),
);
const EquitySalaryImportDialog = dynamic(() =>
  import("@/components/hrms/equity-salary-import-dialog").then(
    (module) => module.EquitySalaryImportDialog,
  ),
);

export default function HrmsPage() {
  const { hasPermission, user: authUser } = useAuth();
  const canRead = hasPermission("hrms:read");
  const canManageEsop = hasPermission("hrms:esop-manage");
  // Payslip Management tab — HR uses payroll perms (same source of
  // truth as the main /payroll page) rather than the hrms perms.
  const canManagePayslips = hasPermission("payroll:create");
  const canManageOnboarding = hasPermission("hrms:onboarding-manage");
  const canManageOffboarding = hasPermission("hrms:offboarding-manage");
  const canManageAgreements = hasPermission("hrms:agreements-manage");
  const canViewAttendance =
    hasPermission("hrms:attendance-read") ||
    hasPermission("hrms:attendance-manage");
  const canAccessAttendance = canRead || canViewAttendance;
  const canApproveCorrections =
    hasPermission("hrms:attendance-correction-approve") ||
    hasPermission("hrms:attendance-manage");
  const canManageAttendancePolicy = hasPermission(
    "hrms:attendance-policy-manage",
  );
  const canExportAttendanceReports =
    hasPermission("hrms:attendance-report-export") ||
    hasPermission("hrms:attendance-manage");
  const canAccessEsop = canRead || canManageEsop;
  const canAccessOnboarding = canRead || canManageOnboarding;
  const canAccessOffboarding = canRead || canManageOffboarding;

  const [activeTab, setActiveTab] = useState("attendance");

  const [pool, setPool] = useState<EsopPool | null>(null);
  const [grants, setGrants] = useState<EsopGrant[]>([]);
  const [loadingPool, setLoadingPool] = useState(true);
  const [loadingGrants, setLoadingGrants] = useState(true);
  const [esopStatusFilter, setEsopStatusFilter] = useState<string>(ALL_FILTER);
  const [esopSortBy, setEsopSortBy] = useState<EsopSortField | undefined>(
    undefined,
  );
  const [esopSortOrder, setEsopSortOrder] = useState<"asc" | "desc">("asc");

  const esopPag = usePagination();
  const {
    page: esopPage,
    pageSize: esopPageSize,
    totalCount: esopTotalCount,
    totalPages: esopTotalPages,
    setPage: setEsopPage,
    setPageSize: setEsopPageSize,
    setTotalCount: setEsopTotalCount,
  } = esopPag;

  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [editingGrant, setEditingGrant] = useState<EsopGrant | null>(null);
  const [deleteGrant, setDeleteGrant] = useState<EsopGrant | null>(null);
  const [deleteGrantOpen, setDeleteGrantOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedGrantIds, setSelectedGrantIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [runs, setRuns] = useState<OnboardingRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [onbStatusFilter, setOnbStatusFilter] = useState<string>(ALL_FILTER);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [updatingTasks, setUpdatingTasks] = useState<Set<string>>(new Set());

  const onbPag = usePagination();
  const {
    page: onbPage,
    pageSize: onbPageSize,
    totalCount: onbTotalCount,
    totalPages: onbTotalPages,
    setPage: setOnbPage,
    setPageSize: setOnbPageSize,
    setTotalCount: setOnbTotalCount,
  } = onbPag;

  const [onboardingDialogOpen, setOnboardingDialogOpen] = useState(false);

  const [offRuns, setOffRuns] = useState<OffboardingRun[]>([]);
  const [loadingOffRuns, setLoadingOffRuns] = useState(true);
  const [offStatusFilter, setOffStatusFilter] = useState<string>(ALL_FILTER);
  const [offExpandedRunId, setOffExpandedRunId] = useState<string | null>(null);
  const [offUpdatingTasks, setOffUpdatingTasks] = useState<Set<string>>(
    new Set(),
  );
  const offPag = usePagination();
  const {
    page: offPage,
    pageSize: offPageSize,
    totalCount: offTotalCount,
    totalPages: offTotalPages,
    setPage: setOffPage,
    setPageSize: setOffPageSize,
    setTotalCount: setOffTotalCount,
  } = offPag;
  const [offboardingDialogOpen, setOffboardingDialogOpen] = useState(false);

  const [entities, setEntities] = useState<Entity[]>([]);

  const [equitySalaries, setEquitySalaries] = useState<EquityMonthlySalary[]>(
    [],
  );
  const [loadingEquitySalaries, setLoadingEquitySalaries] = useState(true);
  const [equitySalaryImportOpen, setEquitySalaryImportOpen] = useState(false);
  const [equitySalaryDeleteAllOpen, setEquitySalaryDeleteAllOpen] =
    useState(false);
  const [equitySalaryDeleting, setEquitySalaryDeleting] = useState(false);

  const [agreementDialogOpen, setAgreementDialogOpen] = useState(false);
  const [editingAgreement, setEditingAgreement] =
    useState<EmployeeAgreement | null>(null);
  const [agreementDefaultEmployeeId, setAgreementDefaultEmployeeId] = useState<
    string | undefined
  >(undefined);
  const [agreementDefaultType, setAgreementDefaultType] = useState<
    AgreementType | undefined
  >(undefined);
  const [pendingDeleteAgreement, setPendingDeleteAgreement] =
    useState<EmployeeAgreement | null>(null);
  const [deletingAgreement, setDeletingAgreement] = useState(false);
  const [agreementsRefreshKey, setAgreementsRefreshKey] = useState(0);

  // Onboarding/offboarding soft-delete (duplicate cleanup) — a "Deleted" view
  // toggle + a pending row for the delete-confirm dialog.
  const [showDeletedOnb, setShowDeletedOnb] = useState(false);
  const [showDeletedOff, setShowDeletedOff] = useState(false);
  const [pendingDeleteOnbRun, setPendingDeleteOnbRun] =
    useState<OnboardingRun | null>(null);
  const [pendingDeleteOffRun, setPendingDeleteOffRun] =
    useState<OffboardingRun | null>(null);
  const [deletingRun, setDeletingRun] = useState(false);

  const fetchPool = useCallback(async () => {
    try {
      setLoadingPool(true);
      const res = await getEsopPool();
      setPool(res.data);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load ESOP pool";
      toast.error(msg);
    } finally {
      setLoadingPool(false);
    }
  }, []);

  const fetchGrants = useCallback(async () => {
    try {
      setLoadingGrants(true);
      const res = await getEsopGrants({
        page: esopPage,
        limit: esopPageSize,
        status: esopStatusFilter === ALL_FILTER ? undefined : esopStatusFilter,
        sortBy: esopSortBy,
        sortOrder: esopSortOrder,
      });
      setGrants(res.data);
      setEsopTotalCount(res.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load grants";
      toast.error(msg);
    } finally {
      setLoadingGrants(false);
    }
  }, [
    esopPage,
    esopPageSize,
    esopStatusFilter,
    esopSortBy,
    esopSortOrder,
    setEsopTotalCount,
  ]);

  const fetchRuns = useCallback(async () => {
    try {
      setLoadingRuns(true);
      const res = await getOnboardingRuns({
        page: onbPage,
        limit: onbPageSize,
        status: onbStatusFilter === ALL_FILTER ? undefined : onbStatusFilter,
        deleted: showDeletedOnb || undefined,
      });
      // If a delete emptied a trailing page, step back — the effect refetches.
      if (res.data.length === 0 && onbPage > 1) {
        setOnbPage(onbPage - 1);
        return;
      }
      setRuns(res.data);
      setOnbTotalCount(res.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load onboarding";
      toast.error(msg);
    } finally {
      setLoadingRuns(false);
    }
  }, [
    onbPage,
    onbPageSize,
    onbStatusFilter,
    showDeletedOnb,
    setOnbPage,
    setOnbTotalCount,
  ]);

  useEffect(() => {
    // Pool summary aggregates company-wide ESOP allocation — only
    // `hrms:esop-manage` holders can fetch it. Plain `hrms:read`
    // employees still see their own grants below.
    if (canManageEsop) {
      void fetchPool();
    }
    if (canAccessEsop) {
      void fetchGrants();
    }
  }, [canAccessEsop, canManageEsop, fetchPool, fetchGrants]);

  useEffect(() => {
    if (canAccessOnboarding && activeTab === "onboarding") {
      void fetchRuns();
    }
  }, [canAccessOnboarding, activeTab, fetchRuns]);

  const fetchOffRuns = useCallback(async () => {
    try {
      setLoadingOffRuns(true);
      const res = await getOffboardingRuns({
        page: offPage,
        limit: offPageSize,
        status: offStatusFilter === ALL_FILTER ? undefined : offStatusFilter,
        deleted: showDeletedOff || undefined,
      });
      if (res.data.length === 0 && offPage > 1) {
        setOffPage(offPage - 1);
        return;
      }
      setOffRuns(res.data);
      setOffTotalCount(res.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load offboarding";
      toast.error(msg);
    } finally {
      setLoadingOffRuns(false);
    }
  }, [
    offPage,
    offPageSize,
    offStatusFilter,
    showDeletedOff,
    setOffPage,
    setOffTotalCount,
  ]);

  useEffect(() => {
    if (canAccessOffboarding && activeTab === "offboarding") {
      void fetchOffRuns();
    }
  }, [canAccessOffboarding, activeTab, fetchOffRuns]);

  const fetchEquitySalaries = useCallback(async () => {
    try {
      setLoadingEquitySalaries(true);
      const res = await listEquitySalaries();
      setEquitySalaries(res.data);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to load equity monthly salary";
      toast.error(msg);
    } finally {
      setLoadingEquitySalaries(false);
    }
  }, []);

  useEffect(() => {
    if (canAccessEsop && activeTab === "equity-monthly-salary") {
      void fetchEquitySalaries();
    }
  }, [canAccessEsop, activeTab, fetchEquitySalaries]);

  const handleEquitySalaryImported = useCallback(() => {
    void fetchEquitySalaries();
  }, [fetchEquitySalaries]);

  const confirmDeleteAllEquitySalaries = useCallback(async () => {
    try {
      setEquitySalaryDeleting(true);
      const res = await deleteAllEquitySalaries();
      toast.success(
        `Deleted ${res.data.deletedCount} row${res.data.deletedCount === 1 ? "" : "s"}`,
      );
      setEquitySalaryDeleteAllOpen(false);
      void fetchEquitySalaries();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete";
      toast.error(msg);
    } finally {
      setEquitySalaryDeleting(false);
    }
  }, [fetchEquitySalaries]);

  useEffect(() => {
    setEsopPage(1);
  }, [esopStatusFilter, esopSortBy, esopSortOrder, setEsopPage]);

  const handleEsopSortChange = useCallback(
    (key: string) => {
      // Three-state toggle: unsorted → asc → desc → unsorted.
      // Falling back to "unsorted" restores the default Excel-style
      // grouping (employee name asc + grantDate desc).
      setEsopSortBy((prev) => {
        if (prev !== key) {
          setEsopSortOrder("asc");
          return key as EsopSortField;
        }
        // Same column clicked again — flip direction or clear.
        if (esopSortOrder === "asc") {
          setEsopSortOrder("desc");
          return key as EsopSortField;
        }
        setEsopSortOrder("asc");
        return undefined;
      });
    },
    [esopSortOrder],
  );

  useEffect(() => {
    setOnbPage(1);
  }, [onbStatusFilter, setOnbPage]);

  useEffect(() => {
    setOffPage(1);
  }, [offStatusFilter, setOffPage]);

  useEffect(() => {
    if (!canAccessEsop && canAccessOnboarding) {
      setActiveTab("onboarding");
    }
  }, [canAccessEsop, canAccessOnboarding]);

  useEffect(() => {
    listEntities()
      .then((res) => setEntities(res.data))
      .catch(() => {});
  }, []);

  const handleGrantSaved = useCallback(() => {
    void fetchGrants();
    if (canManageEsop) void fetchPool();
  }, [fetchGrants, fetchPool, canManageEsop]);

  const handleEditGrant = useCallback((grant: EsopGrant) => {
    setEditingGrant(grant);
    setGrantDialogOpen(true);
  }, []);

  const handleCreateGrant = useCallback(() => {
    setEditingGrant(null);
    setGrantDialogOpen(true);
  }, []);

  const handleDeleteGrant = useCallback((grant: EsopGrant) => {
    setDeleteGrant(grant);
    setDeleteGrantOpen(true);
  }, []);

  const handleBulkDeleteSelected = useCallback(() => {
    if (selectedGrantIds.size === 0) return;
    setBulkDeleteOpen(true);
  }, [selectedGrantIds]);

  const handleDeleteAllClick = useCallback(() => {
    setDeleteAllOpen(true);
  }, []);

  const confirmBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedGrantIds);
    if (ids.length === 0) {
      setBulkDeleteOpen(false);
      return;
    }
    try {
      setBulkDeleting(true);
      const res = await bulkDeleteEsopGrants(ids);
      toast.success(
        `Deleted ${res.data.deletedCount} grant${res.data.deletedCount === 1 ? "" : "s"}`,
      );
      setSelectedGrantIds(new Set());
      setBulkDeleteOpen(false);
      void fetchGrants();
      if (canManageEsop) void fetchPool();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete grants";
      toast.error(msg);
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedGrantIds, fetchGrants, fetchPool, canManageEsop]);

  const confirmDeleteAll = useCallback(async () => {
    try {
      setBulkDeleting(true);
      const res = await deleteAllEsopGrants();
      toast.success(
        `Deleted ${res.data.deletedCount} grant${res.data.deletedCount === 1 ? "" : "s"}`,
      );
      setSelectedGrantIds(new Set());
      setDeleteAllOpen(false);
      void fetchGrants();
      if (canManageEsop) void fetchPool();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete all grants";
      toast.error(msg);
    } finally {
      setBulkDeleting(false);
    }
  }, [fetchGrants, fetchPool, canManageEsop]);

  const handleOnboardingSaved = useCallback(() => {
    void fetchRuns();
  }, [fetchRuns]);

  const handleAgreementSaved = useCallback(() => {
    setAgreementsRefreshKey((k) => k + 1);
  }, []);

  const handleEditAgreement = useCallback((a: EmployeeAgreement) => {
    setEditingAgreement(a);
    setAgreementDefaultEmployeeId(undefined);
    setAgreementDefaultType(undefined);
    setAgreementDialogOpen(true);
  }, []);

  const handleUploadAgreement = useCallback(
    (employeeId?: string, type?: AgreementType) => {
      setEditingAgreement(null);
      setAgreementDefaultEmployeeId(employeeId);
      setAgreementDefaultType(type);
      setAgreementDialogOpen(true);
    },
    [],
  );

  const confirmDeleteAgreement = useCallback(async () => {
    if (!pendingDeleteAgreement) return;
    try {
      setDeletingAgreement(true);
      await deleteAgreement(pendingDeleteAgreement.id);
      toast.success("Agreement deleted");
      setPendingDeleteAgreement(null);
      setAgreementsRefreshKey((k) => k + 1);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete agreement";
      toast.error(msg);
    } finally {
      setDeletingAgreement(false);
    }
  }, [pendingDeleteAgreement]);

  // Confirm-delete a duplicate onboarding run (soft delete). Restore is
  // immediate (non-destructive) with a toast.
  const confirmDeleteOnbRun = useCallback(async () => {
    if (!pendingDeleteOnbRun) return;
    const id = pendingDeleteOnbRun.id;
    try {
      setDeletingRun(true);
      await deleteOnboardingRun(id);
      toast.success("Onboarding run deleted");
      setPendingDeleteOnbRun(null);
      if (expandedRunId === id) setExpandedRunId(null);
      // Refetch so pagination/totals reconcile (fetchRuns steps back a page
      // if this emptied a trailing page).
      void fetchRuns();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete run",
      );
    } finally {
      setDeletingRun(false);
    }
  }, [pendingDeleteOnbRun, expandedRunId, fetchRuns]);

  const handleRestoreOnbRun = useCallback(
    async (run: OnboardingRun) => {
      try {
        await restoreOnboardingRun(run.id);
        toast.success("Onboarding run restored");
        void fetchRuns();
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Failed to restore run",
        );
      }
    },
    [fetchRuns],
  );

  const confirmDeleteOffRun = useCallback(async () => {
    if (!pendingDeleteOffRun) return;
    const id = pendingDeleteOffRun.id;
    try {
      setDeletingRun(true);
      await deleteOffboardingRun(id);
      toast.success("Offboarding run deleted");
      setPendingDeleteOffRun(null);
      if (offExpandedRunId === id) setOffExpandedRunId(null);
      void fetchOffRuns();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete run",
      );
    } finally {
      setDeletingRun(false);
    }
  }, [pendingDeleteOffRun, offExpandedRunId, fetchOffRuns]);

  const handleRestoreOffRun = useCallback(
    async (run: OffboardingRun) => {
      try {
        await restoreOffboardingRun(run.id);
        toast.success("Offboarding run restored");
        void fetchOffRuns();
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Failed to restore run",
        );
      }
    },
    [fetchOffRuns],
  );

  const handleToggleTask = useCallback(
    async (runId: string, taskKey: string, done: boolean) => {
      const lockKey = `${runId}:${taskKey}`;
      setUpdatingTasks((prev) => new Set(prev).add(lockKey));
      try {
        const res = await updateOnboardingTask(runId, taskKey, done);
        setRuns((prev) => prev.map((r) => (r.id === runId ? res.data : r)));
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to update task";
        toast.error(msg);
      } finally {
        setUpdatingTasks((prev) => {
          const next = new Set(prev);
          next.delete(lockKey);
          return next;
        });
      }
    },
    [],
  );

  const handleSaveTasks = useCallback(
    async (runId: string, tasks: OnboardingTaskInput[]) => {
      try {
        const res = await replaceOnboardingTasks(runId, tasks);
        setRuns((prev) => prev.map((r) => (r.id === runId ? res.data : r)));
        toast.success("Tasks updated");
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to update tasks";
        toast.error(msg);
        // Re-throw so the dialog's local state can stop spinning on error.
        throw err;
      }
    },
    [],
  );

  const handleOffboardingSaved = useCallback(() => {
    void fetchOffRuns();
  }, [fetchOffRuns]);

  const handleToggleOffTask = useCallback(
    async (runId: string, taskKey: string, done: boolean) => {
      const lockKey = `${runId}:${taskKey}`;
      setOffUpdatingTasks((prev) => new Set(prev).add(lockKey));
      try {
        const res = await updateOffboardingTask(runId, taskKey, done);
        setOffRuns((prev) => prev.map((r) => (r.id === runId ? res.data : r)));
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to update item";
        toast.error(msg);
      } finally {
        setOffUpdatingTasks((prev) => {
          const next = new Set(prev);
          next.delete(lockKey);
          return next;
        });
      }
    },
    [],
  );

  const handleSaveOffTasks = useCallback(
    async (runId: string, tasks: OffboardingTaskInput[]) => {
      try {
        const res = await replaceOffboardingTasks(runId, tasks);
        setOffRuns((prev) => prev.map((r) => (r.id === runId ? res.data : r)));
        toast.success("Checklist updated");
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to update checklist";
        toast.error(msg);
        throw err;
      }
    },
    [],
  );

  const handleSignOff = useCallback(
    async (runId: string, party: "employee" | "hr", name: string) => {
      try {
        const res = await signOffboarding(runId, party, name);
        setOffRuns((prev) => prev.map((r) => (r.id === runId ? res.data : r)));
        toast.success("Sign-off recorded");
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to record sign-off";
        toast.error(msg);
        throw err;
      }
    },
    [],
  );

  return (
    <div>
      <PageHeader title="HRMS" subtitle="Human Resource Management System" />

      <Tabs tabs={TABS_LIST} active={activeTab} onChange={setActiveTab}>
        <TabsContent value="esop" className="flex flex-col gap-4">
          {activeTab === "esop" ? (
            <>
              {canManageEsop ? (
                <EsopPoolCards pool={pool} loading={loadingPool} />
              ) : null}
              <EsopTab
                grants={grants}
                loading={loadingGrants}
                statusFilter={esopStatusFilter}
                onStatusFilterChange={setEsopStatusFilter}
                page={esopPage}
                pageSize={esopPageSize}
                totalCount={esopTotalCount}
                totalPages={esopTotalPages}
                onPageChange={setEsopPage}
                onPageSizeChange={setEsopPageSize}
                canManage={canManageEsop}
                onCreateGrant={handleCreateGrant}
                onImportGrants={() => setImportDialogOpen(true)}
                onEditGrant={handleEditGrant}
                onDeleteGrant={handleDeleteGrant}
                selectedIds={selectedGrantIds}
                onSelectedIdsChange={setSelectedGrantIds}
                onBulkDeleteSelected={handleBulkDeleteSelected}
                onDeleteAll={handleDeleteAllClick}
                sortBy={esopSortBy}
                sortOrder={esopSortOrder}
                onSortChange={handleEsopSortChange}
              />
            </>
          ) : null}
        </TabsContent>

        <TabsContent
          value="equity-monthly-salary"
          className="flex flex-col gap-4"
        >
          {activeTab === "equity-monthly-salary" ? (
            <EquityMonthlySalaryTab
              rows={equitySalaries}
              loading={loadingEquitySalaries}
              canManage={canManageEsop}
              onImport={() => setEquitySalaryImportOpen(true)}
              onDeleteAll={() => setEquitySalaryDeleteAllOpen(true)}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="payslips" className="flex flex-col gap-4">
          {activeTab === "payslips" ? (
            <PayslipManagementTab canManage={canManagePayslips} />
          ) : null}
        </TabsContent>

        <TabsContent value="attendance" className="flex flex-col gap-4">
          {activeTab === "attendance" ? (
            <AttendanceTab
              canViewReports={canViewAttendance}
              canCheckIn={canAccessAttendance}
              canApproveCorrections={canApproveCorrections}
              canManagePolicy={canManageAttendancePolicy}
              canExportReports={canExportAttendanceReports}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="onboarding" className="flex flex-col gap-4">
          {activeTab === "onboarding" ? (
            <OnboardingTab
              runs={runs}
              loading={loadingRuns}
              statusFilter={onbStatusFilter}
              onStatusFilterChange={setOnbStatusFilter}
              page={onbPage}
              pageSize={onbPageSize}
              totalCount={onbTotalCount}
              totalPages={onbTotalPages}
              onPageChange={setOnbPage}
              onPageSizeChange={setOnbPageSize}
              canManage={canManageOnboarding}
              onCreateOnboarding={() => setOnboardingDialogOpen(true)}
              expandedRunId={expandedRunId}
              onExpandRun={setExpandedRunId}
              updatingTasks={updatingTasks}
              onToggleTask={handleToggleTask}
              onSaveTasks={canManageOnboarding ? handleSaveTasks : undefined}
              showDeleted={showDeletedOnb}
              onShowDeletedChange={(v) => {
                setShowDeletedOnb(v);
                setOnbPage(1);
                setExpandedRunId(null);
              }}
              onDeleteRun={setPendingDeleteOnbRun}
              onRestoreRun={handleRestoreOnbRun}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="offboarding" className="flex flex-col gap-4">
          {activeTab === "offboarding" ? (
            <OffboardingTab
              runs={offRuns}
              loading={loadingOffRuns}
              statusFilter={offStatusFilter}
              onStatusFilterChange={setOffStatusFilter}
              page={offPage}
              pageSize={offPageSize}
              totalCount={offTotalCount}
              totalPages={offTotalPages}
              onPageChange={setOffPage}
              onPageSizeChange={setOffPageSize}
              canManage={canManageOffboarding}
              currentUserName={authUser?.name ?? ""}
              onCreateOffboarding={() => setOffboardingDialogOpen(true)}
              expandedRunId={offExpandedRunId}
              onExpandRun={setOffExpandedRunId}
              updatingTasks={offUpdatingTasks}
              onToggleTask={handleToggleOffTask}
              onSaveTasks={
                canManageOffboarding ? handleSaveOffTasks : undefined
              }
              onSign={canManageOffboarding ? handleSignOff : undefined}
              showDeleted={showDeletedOff}
              onShowDeletedChange={(v) => {
                setShowDeletedOff(v);
                setOffPage(1);
                setOffExpandedRunId(null);
              }}
              onDeleteRun={setPendingDeleteOffRun}
              onRestoreRun={handleRestoreOffRun}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="agreements" className="flex flex-col gap-4">
          {activeTab === "agreements" ? (
            <AgreementsTab
              currentUserId={authUser?.id ?? ""}
              canManage={canManageAgreements}
              refreshKey={agreementsRefreshKey}
              onUpload={handleUploadAgreement}
              onEdit={handleEditAgreement}
              onDelete={setPendingDeleteAgreement}
            />
          ) : null}
        </TabsContent>
      </Tabs>

      {grantDialogOpen ? (
        <EsopGrantDialog
          open
          onOpenChange={setGrantDialogOpen}
          grant={editingGrant}
          onSaved={handleGrantSaved}
        />
      ) : null}

      {importDialogOpen ? (
        <EsopBulkImportDialog
          open
          onOpenChange={setImportDialogOpen}
          onImported={handleGrantSaved}
        />
      ) : null}

      {deleteGrantOpen ? (
        <DeleteGrantDialog
          open
          onOpenChange={setDeleteGrantOpen}
          grant={deleteGrant}
          onDeleted={handleGrantSaved}
        />
      ) : null}

      {onboardingDialogOpen ? (
        <OnboardingDialog
          open
          onOpenChange={setOnboardingDialogOpen}
          entities={entities}
          onSaved={handleOnboardingSaved}
        />
      ) : null}

      {offboardingDialogOpen ? (
        <OffboardingDialog
          open
          onOpenChange={setOffboardingDialogOpen}
          entities={entities}
          onSaved={handleOffboardingSaved}
        />
      ) : null}

      {agreementDialogOpen ? (
        <AgreementUploadDialog
          open
          onOpenChange={setAgreementDialogOpen}
          agreement={editingAgreement}
          defaultEmployeeId={agreementDefaultEmployeeId}
          defaultType={agreementDefaultType}
          onSaved={handleAgreementSaved}
        />
      ) : null}

      {equitySalaryImportOpen ? (
        <EquitySalaryImportDialog
          open
          onOpenChange={setEquitySalaryImportOpen}
          onImported={handleEquitySalaryImported}
        />
      ) : null}

      <AlertDialog
        open={equitySalaryDeleteAllOpen}
        onOpenChange={(o) =>
          !o && !equitySalaryDeleting && setEquitySalaryDeleteAllOpen(false)
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete every equity monthly salary row?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Wipes the entire equity monthly salary ledger across every year.
              Re-import the spreadsheet to rebuild it. Cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={equitySalaryDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAllEquitySalaries}
              disabled={equitySalaryDeleting}
              className={`
                bg-destructive
                hover:bg-destructive/90
              `}
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={(o) => !o && !bulkDeleting && setBulkDeleteOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected grants?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedGrantIds.size} grant
              {selectedGrantIds.size === 1 ? "" : "s"} will be permanently
              removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              disabled={bulkDeleting}
              className={`
                bg-destructive
                hover:bg-destructive/90
              `}
            >
              Delete {selectedGrantIds.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteAllOpen}
        onOpenChange={(o) => !o && !bulkDeleting && setDeleteAllOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete every ESOP grant?</AlertDialogTitle>
            <AlertDialogDescription>
              This wipes the entire ESOP grant ledger — every recorded grant
              across every employee. It cannot be undone. Re-import the Equity
              Summary spreadsheet to rebuild the data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAll}
              disabled={bulkDeleting}
              className={`
                bg-destructive
                hover:bg-destructive/90
              `}
            >
              Delete all data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingDeleteAgreement)}
        onOpenChange={(o) =>
          !o && !deletingAgreement && setPendingDeleteAgreement(null)
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete agreement?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteAgreement && (
                <>
                  &ldquo;{pendingDeleteAgreement.title}&rdquo; will be
                  permanently removed for {pendingDeleteAgreement.employee.name}
                  . The uploaded file also gets dropped from storage.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAgreement}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAgreement}
              disabled={deletingAgreement}
              className={`
                bg-destructive
                hover:bg-destructive/90
              `}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingDeleteOnbRun)}
        onOpenChange={(o) => !o && !deletingRun && setPendingDeleteOnbRun(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete onboarding run?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteOnbRun && (
                <>
                  The onboarding run for{" "}
                  {pendingDeleteOnbRun.employee?.name ??
                    pendingDeleteOnbRun.employeeName}{" "}
                  will be removed from the list. You can restore it from the
                  Deleted view.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingRun}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteOnbRun}
              disabled={deletingRun}
              className={`
                bg-destructive
                hover:bg-destructive/90
              `}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingDeleteOffRun)}
        onOpenChange={(o) => !o && !deletingRun && setPendingDeleteOffRun(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete offboarding run?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteOffRun && (
                <>
                  The offboarding run for{" "}
                  {pendingDeleteOffRun.employee?.name ??
                    pendingDeleteOffRun.employeeName}{" "}
                  will be removed from the list. You can restore it from the
                  Deleted view.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingRun}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteOffRun}
              disabled={deletingRun}
              className={`
                bg-destructive
                hover:bg-destructive/90
              `}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
