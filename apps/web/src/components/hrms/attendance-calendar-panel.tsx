"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { MonthYearPicker } from "@/components/shared/month-year-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  type AttendanceCalendarCode,
  type AttendanceCalendarView,
  getAttendanceCalendar,
} from "@/services/attendance-phase3.service";
import { getDirectoryDepartments } from "@/services/directory.service";

// Radix Select forbids an empty-string item value; use a sentinel for the
// "all departments" option (matches the codebase __all__ convention).
const ALL_DEPARTMENTS = "__all__";

const CODE_LABELS: Record<AttendanceCalendarCode, string> = {
  P: "Present",
  A: "Absent",
  L: "Leave",
  R: "Remote",
  H: "Holiday",
  E: "Exception",
  "-": "Weekend",
};

const CODE_COLORS: Record<AttendanceCalendarCode, string> = {
  P: "bg-emerald-500/80 text-white",
  A: "bg-red-500/80 text-white",
  L: "bg-blue-500/80 text-white",
  R: "bg-violet-500/80 text-white",
  H: "bg-amber-500/80 text-white",
  E: "bg-orange-500/80 text-white",
  "-": "bg-muted text-muted-foreground",
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function AttendanceCalendarPanel({
  canViewTeam,
  canViewDepartment,
}: {
  canViewTeam: boolean;
  canViewDepartment: boolean;
}) {
  const [month, setMonth] = useState(currentMonth);
  const [scope, setScope] = useState<"employee" | "team" | "department">(
    "employee",
  );
  const [department, setDepartment] = useState<string>(ALL_DEPARTMENTS);
  const [departments, setDepartments] = useState<string[]>([]);
  const [data, setData] = useState<AttendanceCalendarView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canViewDepartment) return;
    void getDirectoryDepartments()
      .then((res) => setDepartments(res.data.map((d) => d.name)))
      .catch(() => {});
  }, [canViewDepartment]);

  const fetchCalendar = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAttendanceCalendar({
        month,
        scope,
        department:
          scope === "department" && department !== ALL_DEPARTMENTS
            ? department
            : undefined,
      });
      setData(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load calendar",
      );
    } finally {
      setLoading(false);
    }
  }, [month, scope, department]);

  useEffect(() => {
    void fetchCalendar();
  }, [fetchCalendar]);

  const dayHeaders = useMemo(() => data?.days ?? [], [data?.days]);

  return (
    <Card>
      <CardHeader
        className={`
          flex flex-col gap-3
          sm:flex-row sm:items-center sm:justify-between
        `}
      >
        <div>
          <CardTitle>Attendance Calendar</CardTitle>
          <p className="text-muted-foreground text-sm">
            P Present · A Absent · L Leave · R Remote · H Holiday · E Exception
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthYearPicker value={month} onChange={setMonth} />
          <Select
            value={scope}
            onValueChange={(v) =>
              setScope(v as "employee" | "team" | "department")
            }
          >
            <SelectTrigger className="w-[140px]" aria-label="Calendar view">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="employee">My View</SelectItem>
              {canViewTeam ? (
                <SelectItem value="team">Team View</SelectItem>
              ) : null}
              {canViewDepartment ? (
                <SelectItem value="department">Department</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
          {scope === "department" && canViewDepartment ? (
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="w-[160px]" aria-label="Filter by department">
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DEPARTMENTS}>All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {loading && !data ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Loading calendar…
          </p>
        ) : data && data.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className={`bg-background sticky left-0 z-10 min-w-[140px]`}
                  >
                    Employee
                  </TableHead>
                  {dayHeaders.map((d) => (
                    <TableHead
                      key={d}
                      className="w-8 px-1 text-center text-[10px]"
                    >
                      {d.slice(8)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.employeeId}>
                    <TableCell className="bg-background sticky left-0 z-10">
                      <p className="text-xs font-medium">{row.name}</p>
                      {row.department ? (
                        <p className="text-muted-foreground text-[10px]">
                          {row.department}
                        </p>
                      ) : null}
                    </TableCell>
                    {dayHeaders.map((d) => {
                      const code = row.cells[d] ?? "-";
                      return (
                        <TableCell key={d} className="p-0.5 text-center">
                          <span
                            title={CODE_LABELS[code]}
                            className={cn(
                              `
                                inline-flex size-6 items-center justify-center
                                rounded text-[10px] font-semibold
                              `,
                              CODE_COLORS[code],
                            )}
                          >
                            {code}
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No attendance data for this period
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(CODE_LABELS) as AttendanceCalendarCode[]).map(
            (code) => (
              <Badge key={code} variant="grey" className="text-[10px]">
                <span
                  className={cn(
                    `
                      mr-1 inline-flex size-4 items-center justify-center
                      rounded text-[9px] font-bold
                    `,
                    CODE_COLORS[code],
                  )}
                >
                  {code}
                </span>
                {CODE_LABELS[code]}
              </Badge>
            ),
          )}
        </div>
      </CardContent>
    </Card>
  );
}
