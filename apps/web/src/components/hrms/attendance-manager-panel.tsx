"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AttendanceDashboardCards } from "@/components/hrms/attendance-dashboard-cards";
import { Badge } from "@/components/shared/badge";
import { DataTable } from "@/components/shared/data-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiError } from "@/lib/api-client";
import { ATTENDANCE_STATUS_LABELS } from "@/services/attendance.service";
import {
  getManagerAttendanceDashboard,
  type ManagerTeamDashboard,
} from "@/services/attendance-phase2.service";

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AttendanceManagerPanel() {
  const [data, setData] = useState<ManagerTeamDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getManagerAttendanceDashboard();
      setData(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load team dashboard",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-center">
          Loading team attendance…
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const summary = {
    presentToday: data.presentToday,
    absentToday: data.absentToday,
    lateToday: data.lateToday,
    remoteToday: 0,
    hybridToday: 0,
    onLeaveToday: data.onLeaveToday,
    totalActiveEmployees: data.teamSize,
    date: data.date,
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Team Attendance</CardTitle>
          <CardDescription>
            Direct reports only · {data.attendancePercentage}% attendance today
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AttendanceDashboardCards summary={summary} loading={loading} />
        </CardContent>
      </Card>

      <DataTable
        loading={loading}
        emptyMessage="No team members"
        columns={[
          { key: "name", header: "Employee", render: (r) => r.name },
          {
            key: "department",
            header: "Department",
            render: (r) => r.department ?? "—",
          },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <Badge variant="grey">
                {ATTENDANCE_STATUS_LABELS[
                  r.status as keyof typeof ATTENDANCE_STATUS_LABELS
                ] ?? r.status}
              </Badge>
            ),
          },
          {
            key: "checkIn",
            // Rendered in the viewer's local timezone (the manager payload
            // doesn't carry the employee-tz display fields), so the header is
            // explicit to avoid mistaking it for the employee's local time.
            header: "Check In (your time)",
            render: (r) => formatTime(r.checkIn),
          },
          {
            key: "late",
            header: "Late (min)",
            render: (r) => (r.lateMinutes > 0 ? String(r.lateMinutes) : "—"),
          },
        ]}
        data={data.members}
        getRowId={(r) => r.employeeId}
      />
    </div>
  );
}
