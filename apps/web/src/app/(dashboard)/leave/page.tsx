"use client";

import { CalendarDays, CalendarPlus, Search, Settings2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { LeaveActionDialog } from "@/components/leave/leave-action-dialog";
import { LeaveBalanceCards } from "@/components/leave/leave-balance-cards";
import { LeaveBalanceDriftCard } from "@/components/leave/leave-balance-drift-card";
import {
  LeaveBalanceEditDialog,
  type LeaveBalanceEditTarget,
} from "@/components/leave/leave-balance-edit-dialog";
import { LeaveCalendarCard } from "@/components/leave/leave-calendar-card";
import { formatLeaveDateRange } from "@/components/leave/leave-duration";
import { LeaveRequestDialog } from "@/components/leave/leave-request-dialog";
import { LeaveTeamBalances } from "@/components/leave/leave-team-balances";
import {
  ALL_FILTER,
  getAllColumns,
  getMyColumns,
  STATUS_OPTIONS,
} from "@/components/leave/leave-utils";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent } from "@/components/shared/tabs";
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
import { useTabParam } from "@/hooks/use-tab-param";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  cancelLeaveRequest,
  getLeaveBalances,
  getLeaveRequests,
  getLeaveTypes,
  getTeamBalances,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
  type TeamBalanceRow,
} from "@/services/leave.service";
import { listUsers, type UserListItem } from "@/services/user.service";

export default function LeavePage() {
  const { user, hasPermission, hasAnyPermission } = useAuth();

  const canCreateOnBehalf = hasPermission("leave:hr-on-behalf");
  const canApprove = hasPermission("leave:approve");
  const canViewAll = hasAnyPermission("leave:hr-read");
  const canRequestSelf = hasPermission("leave:request");
  const canManagePolicies = hasPermission("leave:hr-settings");
  const canManageApprovals = hasPermission("leave:assign-approver");
  const canSeeTeamBalances = canApprove || canViewAll;
  const showTeamTab = canApprove && !canViewAll;
  const showMineTab = canRequestSelf;

  // Default landing tab: HR-style users land on "All Requests", managers
  // on "Team", everyone else on their own "My requests" tab.
  const defaultTab = canViewAll
    ? "all"
    : showTeamTab
      ? "team"
      : showMineTab
        ? "mine"
        : "team";
  const [activeTab, setActiveTab] = useTabParam(defaultTab);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);

  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const allPagination = usePagination();
  const {
    page: allPage,
    pageSize: allPageSize,
    setTotalCount: setAllTotal,
    setPage: setAllPage,
  } = allPagination;

  const teamPagination = usePagination();
  const {
    page: teamPage,
    pageSize: teamPageSize,
    setTotalCount: setTeamTotal,
    setPage: setTeamPage,
  } = teamPagination;

  const [teamRequests, setTeamRequests] = useState<LeaveRequest[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);

  // Caller-scoped "My requests" tab — every employee with
  // `leave:request` gets it (the only audience that can't cancel a
  // request they own is one that lacks the perm to file in the first
  // place).
  const minePagination = usePagination();
  const {
    page: minePage,
    pageSize: minePageSize,
    setTotalCount: setMineTotal,
    setPage: setMinePage,
  } = minePagination;
  const [mineRequests, setMineRequests] = useState<LeaveRequest[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>(ALL_FILTER);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);

  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestDialogMode, setRequestDialogMode] = useState<
    "self" | "hr-on-behalf"
  >("self");
  const [requestPresetTypeId, setRequestPresetTypeId] = useState<
    string | undefined
  >(undefined);
  const [selfBalances, setSelfBalances] = useState<LeaveBalance[]>([]);
  const [selfBalancesLoading, setSelfBalancesLoading] = useState(true);
  const [teamBalances, setTeamBalances] = useState<TeamBalanceRow[]>([]);
  const [teamBalancesLoading, setTeamBalancesLoading] = useState(true);
  const [hrEmployeeOptions, setHrEmployeeOptions] = useState<
    { id: string; name: string; email: string }[]
  >([]);
  const [actionRequest, setActionRequest] = useState<LeaveRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [editBalanceTarget, setEditBalanceTarget] =
    useState<LeaveBalanceEditTarget | null>(null);
  const [editBalanceOpen, setEditBalanceOpen] = useState(false);

  const fetchLeaveTypes = useCallback(async () => {
    try {
      const result = await getLeaveTypes();
      setLeaveTypes(result.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load leave types";
      toast.error(message);
    }
  }, []);

  const fetchSelfBalances = useCallback(async () => {
    if (!canRequestSelf) {
      setSelfBalancesLoading(false);
      return;
    }
    try {
      setSelfBalancesLoading(true);
      const result = await getLeaveBalances();
      setSelfBalances(result.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load your balances";
      toast.error(message);
    } finally {
      setSelfBalancesLoading(false);
    }
  }, [canRequestSelf]);

  const fetchTeamBalances = useCallback(async () => {
    if (!canSeeTeamBalances) {
      setTeamBalancesLoading(false);
      return;
    }
    try {
      setTeamBalancesLoading(true);
      const result = await getTeamBalances();
      setTeamBalances(result.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load team balances";
      toast.error(message);
    } finally {
      setTeamBalancesLoading(false);
    }
  }, [canSeeTeamBalances]);

  const fetchAllRequests = useCallback(async () => {
    if (!canViewAll) return;
    try {
      setLoadingAll(true);
      const result = await getLeaveRequests({
        page: allPage,
        limit: allPageSize,
        status: statusFilter === ALL_FILTER ? undefined : statusFilter,
        search: debouncedSearch || undefined,
      });
      setAllRequests(result.data);
      setAllTotal(result.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load requests";
      toast.error(message);
    } finally {
      setLoadingAll(false);
    }
  }, [
    canViewAll,
    allPage,
    allPageSize,
    setAllTotal,
    statusFilter,
    debouncedSearch,
  ]);

  const fetchTeamRequests = useCallback(async () => {
    if (!showTeamTab) return;
    try {
      setLoadingTeam(true);
      const result = await getLeaveRequests({
        page: teamPage,
        limit: teamPageSize,
        status: statusFilter === ALL_FILTER ? undefined : statusFilter,
        search: debouncedSearch || undefined,
      });
      setTeamRequests(result.data);
      setTeamTotal(result.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load team requests";
      toast.error(message);
    } finally {
      setLoadingTeam(false);
    }
  }, [
    showTeamTab,
    teamPage,
    teamPageSize,
    setTeamTotal,
    statusFilter,
    debouncedSearch,
  ]);

  const fetchMyRequests = useCallback(async () => {
    if (!showMineTab || !user?.id) return;
    try {
      setLoadingMine(true);
      const result = await getLeaveRequests({
        page: minePage,
        limit: minePageSize,
        employeeId: user.id,
        status: statusFilter === ALL_FILTER ? undefined : statusFilter,
        search: debouncedSearch || undefined,
      });
      setMineRequests(result.data);
      setMineTotal(result.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load your requests";
      toast.error(message);
    } finally {
      setLoadingMine(false);
    }
  }, [
    showMineTab,
    user?.id,
    minePage,
    minePageSize,
    setMineTotal,
    statusFilter,
    debouncedSearch,
  ]);

  useEffect(() => {
    void fetchLeaveTypes();
  }, [fetchLeaveTypes]);

  useEffect(() => {
    void fetchSelfBalances();
  }, [fetchSelfBalances]);

  useEffect(() => {
    void fetchTeamBalances();
  }, [fetchTeamBalances]);

  useEffect(() => {
    if (!canCreateOnBehalf) {
      setHrEmployeeOptions([]);
      return;
    }
    void listUsers({ limit: 100, isActive: true })
      .then((res) => {
        const rows: UserListItem[] = res.data;
        setHrEmployeeOptions(
          rows.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
          })),
        );
      })
      .catch(() => {
        setHrEmployeeOptions([]);
      });
  }, [canCreateOnBehalf]);

  useEffect(() => {
    if (activeTab === "all") {
      void fetchAllRequests();
    }
  }, [activeTab, fetchAllRequests]);

  useEffect(() => {
    if (activeTab === "team") {
      void fetchTeamRequests();
    }
  }, [activeTab, fetchTeamRequests]);

  useEffect(() => {
    if (activeTab === "mine") {
      void fetchMyRequests();
    }
  }, [activeTab, fetchMyRequests]);

  useEffect(() => {
    setAllPage(1);
    setTeamPage(1);
    setMinePage(1);
  }, [statusFilter, debouncedSearch, setAllPage, setTeamPage, setMinePage]);

  const handleCancelMine = useCallback(
    async (r: LeaveRequest) => {
      if (cancellingId) return;
      // Native confirm matches the rest of the codebase's lightweight
      // destructive-confirm pattern (HR delete buttons, etc.) — no need
      // to drag in an AlertDialog for a single-action revert.
      if (
        !window.confirm(
          r.status === "approved"
            ? `Cancel your approved ${r.leaveType.name} on ${formatLeaveDateRange(r)}? The days will be returned to your balance.`
            : `Cancel your ${r.leaveType.name} on ${formatLeaveDateRange(r)}?`,
        )
      ) {
        return;
      }
      try {
        setCancellingId(r.id);
        await cancelLeaveRequest(r.id);
        toast.success("Leave request cancelled");
        void fetchMyRequests();
        void fetchSelfBalances();
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to cancel request";
        toast.error(message);
      } finally {
        setCancellingId(null);
      }
    },
    [cancellingId, fetchMyRequests, fetchSelfBalances],
  );

  const handleCreated = useCallback(() => {
    if (activeTab === "all") void fetchAllRequests();
    if (activeTab === "team") void fetchTeamRequests();
    if (activeTab === "mine") void fetchMyRequests();
    void fetchSelfBalances();
    void fetchTeamBalances();
  }, [
    fetchAllRequests,
    fetchTeamRequests,
    fetchMyRequests,
    fetchSelfBalances,
    fetchTeamBalances,
    activeTab,
  ]);

  const openSelfRequest = useCallback((leaveTypeId?: string) => {
    setRequestDialogMode("self");
    setRequestPresetTypeId(leaveTypeId);
    setRequestDialogOpen(true);
  }, []);

  const openOnBehalfRequest = useCallback(() => {
    setRequestDialogMode("hr-on-behalf");
    setRequestPresetTypeId(undefined);
    setRequestDialogOpen(true);
  }, []);

  const handleActionComplete = useCallback(() => {
    void fetchAllRequests();
    void fetchTeamRequests();
    void fetchMyRequests();
  }, [fetchAllRequests, fetchTeamRequests, fetchMyRequests]);

  function openAction(request: LeaveRequest, type: "approve" | "reject") {
    setActionRequest(request);
    setActionType(type);
    setActionDialogOpen(true);
  }

  const handleEditBalance = useCallback((target: LeaveBalanceEditTarget) => {
    setEditBalanceTarget(target);
    setEditBalanceOpen(true);
  }, []);

  const handleBalanceUpdated = useCallback(() => {
    void fetchTeamBalances();
    void fetchSelfBalances();
  }, [fetchTeamBalances, fetchSelfBalances]);

  const tabsList = useMemo(() => {
    const tabs: { id: string; label: string }[] = [];
    if (showMineTab) tabs.push({ id: "mine", label: "My requests" });
    if (showTeamTab) tabs.push({ id: "team", label: "Team" });
    if (canViewAll) tabs.push({ id: "all", label: "All Requests" });
    return tabs;
  }, [canViewAll, showTeamTab, showMineTab]);

  const allColumns = useMemo(
    () =>
      getAllColumns(
        canApprove,
        (r) => openAction(r, "approve"),
        (r) => openAction(r, "reject"),
      ),
    [canApprove],
  );

  const myColumns = useMemo(
    () => getMyColumns(handleCancelMine),
    [handleCancelMine],
  );

  if (!canViewAll && !showTeamTab && !canRequestSelf) {
    return (
      <div>
        <PageHeader
          title="Leave Management"
          subtitle="You don't have permission to view this page."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Leave Management"
        subtitle="Per-policy balances, team approvals, and on-behalf submissions."
      >
        <Button variant="outline" asChild>
          <Link href="/leave/holidays">
            <CalendarDays className="size-3.5" />
            Holidays
          </Link>
        </Button>
        {canManagePolicies && (
          <Button variant="outline" asChild>
            <Link href="/leave/policies">
              <Settings2 className="size-3.5" />
              Manage policies
            </Link>
          </Button>
        )}
        {canManageApprovals && (
          <Button variant="outline" asChild>
            <Link href="/leave/approval">
              <Settings2 className="size-3.5" />
              Approval chain
            </Link>
          </Button>
        )}
        {canRequestSelf && (
          <Button variant="accent" onClick={() => openSelfRequest()}>
            <CalendarPlus className="size-3.5" />
            Apply for Leave
          </Button>
        )}
        {canCreateOnBehalf && (
          <Button onClick={openOnBehalfRequest}>
            <CalendarPlus className="size-3.5" />
            Create leave for employee
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-col gap-4">
        {canRequestSelf && (
          <section
            aria-label="My leave balances"
            className="flex flex-col gap-2"
          >
            <h3
              className={`
                text-muted-foreground text-xs font-semibold tracking-wide
                uppercase
              `}
            >
              My balances
            </h3>
            <LeaveBalanceCards
              balances={selfBalances}
              loading={selfBalancesLoading}
              onApply={openSelfRequest}
            />
          </section>
        )}

        <LeaveCalendarCard />

        {tabsList.length === 0 ? null : tabsList.length > 1 ? (
          <Tabs tabs={tabsList} active={activeTab} onChange={setActiveTab}>
            {showMineTab && (
              <TabsContent value="mine">
                <div
                  className={`
                    mb-3 flex flex-col gap-2
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
                      placeholder="Search by leave type or reason..."
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10 min-w-[140px] text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-muted-foreground mb-2 text-[11px]">
                  Cancel a pending request to withdraw it. To modify a request,
                  cancel and submit a new one — the approval chain re-runs from
                  the start.
                </p>
                <DataTable
                  columns={myColumns}
                  data={mineRequests}
                  loading={loadingMine}
                  emptyMessage="You haven't filed any leave requests yet"
                  pagination={
                    <DataPagination
                      page={minePagination.page}
                      pageSize={minePagination.pageSize}
                      totalCount={minePagination.totalCount}
                      totalPages={minePagination.totalPages}
                      onPageChange={minePagination.setPage}
                      onPageSizeChange={minePagination.setPageSize}
                    />
                  }
                />
              </TabsContent>
            )}

            {showTeamTab && (
              <TabsContent value="team">
                <div
                  className={`
                    mb-3 flex flex-col gap-2
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
                      placeholder="Search by employee or leave type..."
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10 min-w-[140px] text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DataTable
                  columns={allColumns}
                  data={teamRequests}
                  loading={loadingTeam}
                  emptyMessage="No team leave requests found"
                  pagination={
                    <DataPagination
                      page={teamPagination.page}
                      pageSize={teamPagination.pageSize}
                      totalCount={teamPagination.totalCount}
                      totalPages={teamPagination.totalPages}
                      onPageChange={teamPagination.setPage}
                      onPageSizeChange={teamPagination.setPageSize}
                    />
                  }
                />
              </TabsContent>
            )}

            {canViewAll && (
              <TabsContent value="all">
                <div
                  className={`
                    mb-3 flex flex-col gap-2
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
                      placeholder="Search by employee or leave type..."
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10 min-w-[140px] text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DataTable
                  columns={allColumns}
                  data={allRequests}
                  loading={loadingAll}
                  emptyMessage="No leave requests found"
                  pagination={
                    <DataPagination
                      page={allPagination.page}
                      pageSize={allPagination.pageSize}
                      totalCount={allPagination.totalCount}
                      totalPages={allPagination.totalPages}
                      onPageChange={allPagination.setPage}
                      onPageSizeChange={allPagination.setPageSize}
                    />
                  }
                />
              </TabsContent>
            )}
          </Tabs>
        ) : (
          <div>
            <div
              className={`
                mb-3 flex flex-col gap-2
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
                  placeholder="Search by employee or leave type..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 min-w-[140px] text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tabsList[0]?.id === "mine" ? (
              <DataTable
                columns={myColumns}
                data={mineRequests}
                loading={loadingMine}
                emptyMessage="You haven't filed any leave requests yet"
                pagination={
                  <DataPagination
                    page={minePagination.page}
                    pageSize={minePagination.pageSize}
                    totalCount={minePagination.totalCount}
                    totalPages={minePagination.totalPages}
                    onPageChange={minePagination.setPage}
                    onPageSizeChange={minePagination.setPageSize}
                  />
                }
              />
            ) : (
              <DataTable
                columns={allColumns}
                data={canViewAll ? allRequests : teamRequests}
                loading={canViewAll ? loadingAll : loadingTeam}
                emptyMessage="No leave requests found"
                pagination={
                  <DataPagination
                    page={canViewAll ? allPagination.page : teamPagination.page}
                    pageSize={
                      canViewAll
                        ? allPagination.pageSize
                        : teamPagination.pageSize
                    }
                    totalCount={
                      canViewAll
                        ? allPagination.totalCount
                        : teamPagination.totalCount
                    }
                    totalPages={
                      canViewAll
                        ? allPagination.totalPages
                        : teamPagination.totalPages
                    }
                    onPageChange={
                      canViewAll
                        ? allPagination.setPage
                        : teamPagination.setPage
                    }
                    onPageSizeChange={
                      canViewAll
                        ? allPagination.setPageSize
                        : teamPagination.setPageSize
                    }
                  />
                }
              />
            )}
          </div>
        )}

        {canSeeTeamBalances && (
          <section aria-label="Team balances" className="flex flex-col gap-2">
            <h3
              className={`
                text-muted-foreground text-xs font-semibold tracking-wide
                uppercase
              `}
            >
              {canViewAll
                ? "All employees — leave balance"
                : "Direct reports — leave balance"}
            </h3>
            <LeaveTeamBalances
              rows={teamBalances}
              loading={teamBalancesLoading}
              onEdit={canManagePolicies ? handleEditBalance : undefined}
            />
          </section>
        )}

        {/* HR-only. `used` is a stored counter that can silently diverge
            from the request list, so surface the divergence here rather
            than waiting for an employee to report a wrong balance. */}
        {canViewAll && (
          <section aria-label="Balance drift" className="flex flex-col gap-2">
            <h3
              className={`
                text-muted-foreground text-xs font-semibold tracking-wide
                uppercase
              `}
            >
              Data health
            </h3>
            <LeaveBalanceDriftCard />
          </section>
        )}
      </div>

      <LeaveRequestDialog
        open={requestDialogOpen}
        onOpenChange={setRequestDialogOpen}
        leaveTypes={leaveTypes}
        onCreated={handleCreated}
        mode={requestDialogMode}
        defaultLeaveTypeId={requestPresetTypeId}
        employeeOptions={hrEmployeeOptions}
        balances={selfBalances}
      />

      <LeaveActionDialog
        open={actionDialogOpen}
        onOpenChange={setActionDialogOpen}
        request={actionRequest}
        action={actionType}
        onComplete={handleActionComplete}
      />

      <LeaveBalanceEditDialog
        open={editBalanceOpen}
        onOpenChange={setEditBalanceOpen}
        balance={editBalanceTarget}
        onSuccess={handleBalanceUpdated}
      />
    </div>
  );
}
