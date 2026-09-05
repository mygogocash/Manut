"use client";

import { Clock, Download, LogIn, LogOut, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AttendanceAnalyticsPanel } from "@/components/hrms/attendance-analytics-panel";
import { AttendanceCalendarPanel } from "@/components/hrms/attendance-calendar-panel";
import {
  ATTENDANCE_SUB_TABS,
  type AttendanceSubTabId,
  LIVE_REFRESH_MS,
} from "@/components/hrms/attendance-constants";
import { AttendanceCorrectionsPanel } from "@/components/hrms/attendance-corrections-panel";
import { AttendanceDashboardCards } from "@/components/hrms/attendance-dashboard-cards";
import { AttendanceExecutivePanel } from "@/components/hrms/attendance-executive-panel";
import { AttendanceManagerPanel } from "@/components/hrms/attendance-manager-panel";
import { AttendanceSettingsPanel } from "@/components/hrms/attendance-settings-panel";
import { AttendanceShiftAssignmentPanel } from "@/components/hrms/attendance-shift-assignment-panel";
import { formatDualTime } from "@/components/hrms/attendance-time-display";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { Tabs, TabsContent } from "@/components/shared/tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import {
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_WORK_MODE_LABELS,
  ATTENDANCE_WORK_MODES,
  type AttendanceDashboardSummary,
  type AttendanceRecord,
  type AttendanceWorkMode,
  checkInAttendance,
  checkOutAttendance,
  type DepartmentAttendanceSummary,
  getAttendanceDashboard,
  getDepartmentAttendanceReport,
  getLiveAttendance,
  getMonthlyAttendanceReport,
  getMyAttendance,
  getTodayAttendance,
  type MonthlyAttendanceReport,
} from "@/services/attendance.service";
import {
  exportDailyAttendance,
  exportDepartmentAttendance,
  exportMonthlyAttendance,
} from "@/services/attendance-phase2.service";

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function currentMonthYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function AttendanceTab({
  canViewReports,
  canCheckIn,
  canApproveCorrections,
  canManagePolicy,
  canExportReports,
}: {
  canViewReports: boolean;
  canCheckIn: boolean;
  canApproveCorrections: boolean;
  canManagePolicy: boolean;
  canExportReports: boolean;
}) {
  const visibleSubTabs = useMemo(
    () =>
      ATTENDANCE_SUB_TABS.filter((t) => {
        if (t.id === "my-attendance") return canCheckIn;
        if (t.id === "calendar") return canCheckIn || canViewReports;
        if (t.id === "corrections") return canCheckIn;
        if (t.id === "monthly-reports") return canViewReports;
        if (t.id === "dashboard" || t.id === "live") return canViewReports;
        if (t.id === "team") return canCheckIn;
        if (t.id === "analytics") return canViewReports;
        if (t.id === "executive") return canViewReports;
        if (t.id === "shift-assignment") return canManagePolicy;
        if (t.id === "settings") return canManagePolicy;
        return false;
      }),
    [canViewReports, canCheckIn, canManagePolicy],
  );

  const [subTab, setSubTab] = useState<AttendanceSubTabId>(
    canViewReports ? "dashboard" : "my-attendance",
  );

  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [loadingToday, setLoadingToday] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [workMode, setWorkMode] = useState<AttendanceWorkMode>("office");
  const [exporting, setExporting] = useState(false);

  const [dashboard, setDashboard] = useState<AttendanceDashboardSummary | null>(
    null,
  );
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  const [liveRows, setLiveRows] = useState<AttendanceRecord[]>([]);
  const [loadingLive, setLoadingLive] = useState(false);

  const [myRows, setMyRows] = useState<AttendanceRecord[]>([]);
  const [loadingMy, setLoadingMy] = useState(false);
  const myPag = usePagination();

  const [monthlyReport, setMonthlyReport] =
    useState<MonthlyAttendanceReport | null>(null);
  const [deptReport, setDeptReport] = useState<DepartmentAttendanceSummary[]>(
    [],
  );
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportMonth, setReportMonth] = useState(currentMonthYmd());

  const fetchToday = useCallback(async () => {
    if (!canCheckIn) return;
    try {
      setLoadingToday(true);
      const res = await getTodayAttendance();
      setTodayRecord(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to load today's attendance",
      );
    } finally {
      setLoadingToday(false);
    }
  }, [canCheckIn]);

  const fetchDashboard = useCallback(async () => {
    if (!canViewReports) return;
    try {
      setLoadingDashboard(true);
      const res = await getAttendanceDashboard();
      setDashboard(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load dashboard",
      );
    } finally {
      setLoadingDashboard(false);
    }
  }, [canViewReports]);

  const fetchLive = useCallback(async () => {
    if (!canViewReports) return;
    try {
      setLoadingLive(true);
      const res = await getLiveAttendance();
      setLiveRows(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to load live attendance",
      );
    } finally {
      setLoadingLive(false);
    }
  }, [canViewReports]);

  const fetchMy = useCallback(async () => {
    try {
      setLoadingMy(true);
      const res = await getMyAttendance({
        page: myPag.page,
        limit: myPag.pageSize,
      });
      setMyRows(res.data);
      myPag.setTotalCount(res.meta.total);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to load attendance history",
      );
    } finally {
      setLoadingMy(false);
    }
  }, [myPag.page, myPag.pageSize, myPag.setTotalCount]);

  const fetchReports = useCallback(async () => {
    try {
      setLoadingReports(true);
      const [monthlyRes, deptRes] = await Promise.all([
        getMonthlyAttendanceReport({ month: reportMonth }),
        canViewReports
          ? getDepartmentAttendanceReport({ month: reportMonth })
          : Promise.resolve({ data: [] as DepartmentAttendanceSummary[] }),
      ]);
      setMonthlyReport(monthlyRes.data);
      setDeptReport(deptRes.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load reports",
      );
    } finally {
      setLoadingReports(false);
    }
  }, [reportMonth, canViewReports]);

  useEffect(() => {
    if (canCheckIn) void fetchToday();
  }, [canCheckIn, fetchToday]);

  useEffect(() => {
    if (subTab === "dashboard") void fetchDashboard();
  }, [subTab, fetchDashboard]);

  useEffect(() => {
    if (subTab === "live") void fetchLive();
  }, [subTab, fetchLive]);

  useEffect(() => {
    if (subTab !== "live" || !canViewReports) return;
    const id = window.setInterval(() => void fetchLive(), LIVE_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [subTab, canViewReports, fetchLive]);

  useEffect(() => {
    if (subTab === "my-attendance") void fetchMy();
  }, [subTab, fetchMy]);

  useEffect(() => {
    if (subTab === "monthly-reports") void fetchReports();
  }, [subTab, fetchReports]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const res = await checkInAttendance({ workMode });
      setTodayRecord(res.data);
      toast.success("Checked in successfully");
      if (subTab === "dashboard") void fetchDashboard();
      if (subTab === "live") void fetchLive();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Check-in failed");
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckingOut(true);
    try {
      const res = await checkOutAttendance();
      setTodayRecord(res.data);
      toast.success("Checked out successfully");
      if (subTab === "dashboard") void fetchDashboard();
      if (subTab === "live") void fetchLive();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Check-out failed");
    } finally {
      setCheckingOut(false);
    }
  };

  const liveColumns = useMemo(
    () => [
      {
        key: "employee",
        header: "Employee",
        render: (r: AttendanceRecord) => (
          <span className="text-foreground text-xs font-medium">
            {r.employee?.name ?? "—"}
          </span>
        ),
      },
      {
        key: "department",
        mobileRole: "subtitle" as const,
        header: "Department",
        render: (r: AttendanceRecord) => r.employee?.department ?? "—",
      },
      {
        key: "checkIn",
        mobileRole: "field" as const,
        header: "Check In",
        render: (r: AttendanceRecord) => (
          <span className="text-xs tabular-nums">
            {formatDualTime(r.checkInDisplay, r.checkIn)}
          </span>
        ),
      },
      {
        key: "checkOut",
        mobileRole: "detail" as const,
        header: "Check Out",
        render: (r: AttendanceRecord) => (
          <span className="text-xs tabular-nums">
            {formatDualTime(r.checkOutDisplay, r.checkOut)}
          </span>
        ),
      },
      {
        key: "workMode",
        mobileRole: "detail" as const,
        header: "Work Mode",
        render: (r: AttendanceRecord) =>
          ATTENDANCE_WORK_MODE_LABELS[r.workMode],
      },
      {
        key: "status",
        mobileRole: "badge" as const,
        header: "Status",
        render: (r: AttendanceRecord) => (
          <Badge status={r.status}>{ATTENDANCE_STATUS_LABELS[r.status]}</Badge>
        ),
      },
      {
        key: "totalHours",
        mobileRole: "field" as const,
        header: "Total Hours",
        render: (r: AttendanceRecord) => (
          <span className="tabular-nums">
            {r.totalHours !== null ? r.totalHours.toFixed(2) : "—"}
          </span>
        ),
      },
    ],
    [],
  );

  const myColumns = useMemo(
    () => [
      {
        key: "date",
        header: "Date",
        render: (r: AttendanceRecord) => (
          <span className="tabular-nums">
            {new Date(r.attendanceDate).toLocaleDateString()}
          </span>
        ),
      },
      {
        key: "checkIn",
        mobileRole: "field" as const,
        header: "Check In",
        render: (r: AttendanceRecord) => (
          <span className="text-xs">
            {formatDualTime(r.checkInDisplay, r.checkIn)}
          </span>
        ),
      },
      {
        key: "checkOut",
        mobileRole: "detail" as const,
        header: "Check Out",
        render: (r: AttendanceRecord) => (
          <span className="text-xs">
            {formatDualTime(r.checkOutDisplay, r.checkOut)}
          </span>
        ),
      },
      {
        key: "workMode",
        mobileRole: "subtitle" as const,
        header: "Work Mode",
        render: (r: AttendanceRecord) =>
          ATTENDANCE_WORK_MODE_LABELS[r.workMode],
      },
      {
        key: "status",
        mobileRole: "badge" as const,
        header: "Status",
        render: (r: AttendanceRecord) => (
          <Badge status={r.status}>{ATTENDANCE_STATUS_LABELS[r.status]}</Badge>
        ),
      },
      {
        key: "late",
        mobileRole: "field" as const,
        header: "Late (min)",
        render: (r: AttendanceRecord) => (
          <span className="tabular-nums">{r.lateMinutes}</span>
        ),
      },
      {
        key: "hours",
        mobileRole: "field" as const,
        header: "Hours",
        render: (r: AttendanceRecord) => (
          <span className="tabular-nums">
            {r.totalHours !== null ? r.totalHours.toFixed(2) : "—"}
          </span>
        ),
      },
    ],
    [],
  );

  const deptColumns = useMemo(
    () => [
      { key: "department", header: "Department" },
      {
        key: "headcount",
        header: "Headcount",
        render: (r: DepartmentAttendanceSummary) => (
          <span className="tabular-nums">{r.headcount}</span>
        ),
      },
      {
        key: "attendancePercentage",
        header: "Attendance %",
        render: (r: DepartmentAttendanceSummary) => (
          <span className="tabular-nums">{r.attendancePercentage}%</span>
        ),
      },
      {
        key: "presentCount",
        header: "Present",
        render: (r: DepartmentAttendanceSummary) => (
          <span className="tabular-nums">{r.presentCount}</span>
        ),
      },
      {
        key: "lateCount",
        header: "Late",
        render: (r: DepartmentAttendanceSummary) => (
          <span className="tabular-nums">{r.lateCount}</span>
        ),
      },
      {
        key: "absentCount",
        header: "Absent",
        render: (r: DepartmentAttendanceSummary) => (
          <span className="tabular-nums">{r.absentCount}</span>
        ),
      },
      {
        key: "remoteCount",
        header: "Remote",
        render: (r: DepartmentAttendanceSummary) => (
          <span className="tabular-nums">{r.remoteCount}</span>
        ),
      },
    ],
    [],
  );

  const checkInOutCard = canCheckIn ? (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="size-4" />
          Today&apos;s Attendance
        </CardTitle>
        <CardDescription>
          {loadingToday
            ? "Loading…"
            : todayRecord?.checkIn
              ? `Checked in at ${formatTime(todayRecord.checkIn)}`
              : "Not checked in yet"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Select
          value={workMode}
          onValueChange={(v) => setWorkMode(v as AttendanceWorkMode)}
          disabled={Boolean(todayRecord?.checkIn)}
        >
          <SelectTrigger className="w-[200px]" aria-label="Filter by work mode">
            <SelectValue placeholder="Work mode" />
          </SelectTrigger>
          <SelectContent>
            {ATTENDANCE_WORK_MODES.map((m) => (
              <SelectItem key={m} value={m}>
                {ATTENDANCE_WORK_MODE_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={() => void handleCheckIn()}
          disabled={checkingIn || loadingToday || Boolean(todayRecord?.checkIn)}
        >
          <LogIn className="mr-1.5 size-3.5" />
          Check In
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleCheckOut()}
          disabled={
            checkingOut ||
            loadingToday ||
            !todayRecord?.checkIn ||
            Boolean(todayRecord?.checkOut)
          }
        >
          <LogOut className="mr-1.5 size-3.5" />
          Check Out
        </Button>
        {todayRecord ? (
          <Badge status={todayRecord.status}>
            {ATTENDANCE_STATUS_LABELS[todayRecord.status]}
          </Badge>
        ) : null}
      </CardContent>
    </Card>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      {checkInOutCard}

      <Tabs
        tabs={visibleSubTabs.map((t) => ({ id: t.id, label: t.label }))}
        active={subTab}
        onChange={(id) => setSubTab(id as AttendanceSubTabId)}
      >
        <TabsContent value="dashboard" className="flex flex-col gap-4">
          <AttendanceDashboardCards
            summary={dashboard}
            loading={loadingDashboard}
          />
        </TabsContent>

        <TabsContent value="my-attendance" className="flex flex-col gap-4">
          <DataTable
            columns={myColumns}
            data={myRows}
            loading={loadingMy}
            emptyMessage="No attendance records yet"
          />
          <DataPagination
            page={myPag.page}
            pageSize={myPag.pageSize}
            totalCount={myPag.totalCount}
            totalPages={myPag.totalPages}
            onPageChange={myPag.setPage}
            onPageSizeChange={myPag.setPageSize}
          />
        </TabsContent>

        <TabsContent value="monthly-reports" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="month"
              className={`
                border-input bg-background h-9 rounded-md border px-3 text-sm
              `}
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void fetchReports()}
              disabled={loadingReports}
            >
              <RefreshCw
                className={`
                  mr-1.5 size-3.5
                  ${loadingReports ? "animate-spin" : ""}
                `}
              />
              Refresh
            </Button>
            {canExportReports ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exporting}
                  onClick={() => {
                    void (async () => {
                      try {
                        setExporting(true);
                        await exportMonthlyAttendance({
                          format: "csv",
                          month: reportMonth,
                        });
                      } catch {
                        toast.error("Monthly export failed");
                      } finally {
                        setExporting(false);
                      }
                    })();
                  }}
                >
                  <Download className="mr-1.5 size-3.5" />
                  CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exporting}
                  onClick={() => {
                    void (async () => {
                      try {
                        setExporting(true);
                        await exportMonthlyAttendance({
                          format: "xlsx",
                          month: reportMonth,
                        });
                      } catch {
                        toast.error("Monthly export failed");
                      } finally {
                        setExporting(false);
                      }
                    })();
                  }}
                >
                  <Download className="mr-1.5 size-3.5" />
                  Excel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exporting}
                  onClick={() => {
                    void (async () => {
                      try {
                        setExporting(true);
                        await exportDepartmentAttendance({
                          format: "xlsx",
                          month: reportMonth,
                        });
                      } catch {
                        toast.error("Department export failed");
                      } finally {
                        setExporting(false);
                      }
                    })();
                  }}
                >
                  <Download className="mr-1.5 size-3.5" />
                  Dept Excel
                </Button>
              </>
            ) : null}
          </div>

          {monthlyReport ? (
            <div
              className={`
                grid gap-4
                md:grid-cols-2
                lg:grid-cols-4
              `}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Attendance %</CardDescription>
                  <CardTitle className="text-xl tabular-nums">
                    {loadingReports
                      ? "..."
                      : `${monthlyReport.attendancePercentage}%`}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Late Arrivals</CardDescription>
                  <CardTitle className="text-warning text-xl tabular-nums">
                    {loadingReports ? "..." : monthlyReport.lateArrivals}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Absentee Count</CardDescription>
                  <CardTitle className="text-destructive text-xl tabular-nums">
                    {loadingReports ? "..." : monthlyReport.absenteeCount}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Remote vs Office</CardDescription>
                  <CardTitle className="text-xl tabular-nums">
                    {loadingReports
                      ? "..."
                      : `${monthlyReport.remoteVsOfficeRatio}% remote`}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
          ) : null}

          {canViewReports && deptReport.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-foreground text-sm font-medium">
                Department Summary
              </h3>
              <DataTable
                columns={deptColumns}
                data={deptReport}
                loading={loadingReports}
                emptyMessage="No department data"
              />
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="corrections" className="flex flex-col gap-4">
          <AttendanceCorrectionsPanel
            canRequest={canCheckIn}
            canApprove={canApproveCorrections}
          />
        </TabsContent>

        <TabsContent value="team" className="flex flex-col gap-4">
          <AttendanceManagerPanel />
        </TabsContent>

        <TabsContent value="analytics" className="flex flex-col gap-4">
          <AttendanceAnalyticsPanel month={reportMonth} />
        </TabsContent>

        <TabsContent value="executive" className="flex flex-col gap-4">
          <AttendanceExecutivePanel month={reportMonth} />
        </TabsContent>

        <TabsContent value="calendar" className="flex flex-col gap-4">
          <AttendanceCalendarPanel
            canViewTeam={canCheckIn}
            canViewDepartment={canViewReports}
          />
        </TabsContent>

        <TabsContent value="shift-assignment" className="flex flex-col gap-4">
          <AttendanceShiftAssignmentPanel />
        </TabsContent>

        <TabsContent value="settings" className="flex flex-col gap-4">
          <AttendanceSettingsPanel canManagePolicy={canManagePolicy} />
        </TabsContent>

        <TabsContent value="live" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">
              Auto-refreshes every 30 seconds
            </p>
            <div className="flex items-center gap-2">
              {canExportReports ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exporting}
                  onClick={() => {
                    void (async () => {
                      try {
                        setExporting(true);
                        await exportDailyAttendance({ format: "xlsx" });
                      } catch {
                        toast.error("Daily export failed");
                      } finally {
                        setExporting(false);
                      }
                    })();
                  }}
                >
                  <Download className="mr-1.5 size-3.5" />
                  Export
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() => void fetchLive()}
                disabled={loadingLive}
              >
                <RefreshCw
                  className={`
                    mr-1.5 size-3.5
                    ${loadingLive ? "animate-spin" : ""}
                  `}
                />
                Refresh
              </Button>
            </div>
          </div>
          <DataTable
            columns={liveColumns}
            data={liveRows}
            loading={loadingLive}
            emptyMessage="No employees found"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
