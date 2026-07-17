"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
  getLeaveCalendar,
  type LeaveCalendarRow,
} from "@/services/leave.service";

const LEAVE_TYPE_COLORS: Record<string, string> = {
  AL: "bg-blue-400/80",
  SL: "bg-red-400/80",
  PL: "bg-purple-400/80",
  ML: "bg-pink-400/80",
  CL: "bg-amber-400/80",
  UL: "bg-gray-400/80",
  WFH: "bg-green-400/80",
};

function getLeaveColor(code: string): string {
  return LEAVE_TYPE_COLORS[code] ?? "bg-indigo-400/80";
}

function monthRange(value: string): { from: string; to: string } {
  const [ys, ms] = value.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(y, m, 0).getDate();
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
}

function getDaysInMonth(ym: string): Date[] {
  const [ys, ms] = ym.split("-");
  const y = Number(ys);
  const m = Number(ms) - 1;
  const days: Date[] = [];
  const last = new Date(y, m + 1, 0).getDate();
  for (let d = 1; d <= last; d++) days.push(new Date(y, m, d));
  return days;
}

// `Date#toISOString` converts to UTC, which shifts the day forward or
// backward across the dateline for every browser not at UTC+0. Each
// cell in the team calendar is keyed off the *local* civil date (the
// number the user actually sees in the column header), so we format
// using the local components instead. Singapore is UTC+8 — without
// this, Monday's leave was rendering in Tuesday's column because
// `new Date(2026, 4, 18).toISOString()` returns
// `"2026-05-17T16:00:00.000Z"` and `slice(0, 10)` gave `"2026-05-17"`.
function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function isInRange(day: Date, start: string, end: string): boolean {
  const ds = ymdLocal(day);
  return ds >= start.slice(0, 10) && ds <= end.slice(0, 10);
}

interface EmployeeRow {
  id: string;
  name: string;
  department: string | null;
  leaves: Array<{
    id: string;
    startDate: string;
    endDate: string;
    status: string;
    leaveType: { code: string; name: string };
  }>;
}

export function LeaveCalendarCard() {
  const defaultYm = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const [ym, setYm] = useState(defaultYm);
  const [rows, setRows] = useState<LeaveCalendarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState<string>("all");

  const fetchCal = useCallback(async () => {
    const { from, to } = monthRange(ym);
    try {
      setLoading(true);
      const res = await getLeaveCalendar({
        from,
        to,
        department: department === "all" ? undefined : department,
      });
      setRows(res.data);
    } catch (e) {
      toast.error(
        e instanceof ApiError ? e.message : "Failed to load calendar",
      );
    } finally {
      setLoading(false);
    }
  }, [ym, department]);

  useEffect(() => {
    void fetchCal();
  }, [fetchCal]);

  const departments = useMemo(() => {
    const depts = new Set<string>();
    rows.forEach((r) => {
      if (r.employee.department) depts.add(r.employee.department);
    });
    return Array.from(depts).sort();
  }, [rows]);

  const employees = useMemo<EmployeeRow[]>(() => {
    const map = new Map<string, EmployeeRow>();
    for (const r of rows) {
      let emp = map.get(r.employee.id);
      if (!emp) {
        emp = {
          id: r.employee.id,
          name: r.employee.name,
          department: r.employee.department,
          leaves: [],
        };
        map.set(r.employee.id, emp);
      }
      emp.leaves.push({
        id: r.id,
        startDate: r.startDate,
        endDate: r.endDate,
        status: r.status,
        leaveType: r.leaveType,
      });
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [rows]);

  const days = useMemo(() => getDaysInMonth(ym), [ym]);
  // Local civil date — must match the per-cell `ymdLocal()` keys below.
  const today = ymdLocal(new Date());

  return (
    <Card>
      <CardHeader
        className={`
          flex flex-row flex-wrap items-center justify-between gap-2 pb-2
        `}
      >
        <CardTitle className="text-sm font-medium">
          Team leave calendar
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <MonthYearPicker
            value={ym}
            onChange={(v) => setYm(v)}
            className="h-8 w-auto text-xs"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="text-muted-foreground p-4 text-xs">Loading…</p>
        ) : employees.length === 0 ? (
          <p className="text-muted-foreground p-4 text-xs">
            No approved or pending leave in this range.
          </p>
        ) : (
          <div>
            <Table
              className={`
                [&_tr]:border-border/60
                w-full border-collapse text-[10px]
              `}
            >
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    className={`
                      bg-muted/50 sticky left-0 z-10 h-auto min-w-[120px]
                      border-r py-1.5 pr-2 pl-2 text-left align-middle
                      text-[10px]
                    `}
                  >
                    Employee
                  </TableHead>
                  {days.map((d) => {
                    const ds = ymdLocal(d);
                    const we = isWeekend(d);
                    return (
                      <TableHead
                        key={ds}
                        className={cn(
                          `
                            h-auto min-w-[24px] px-0.5 py-1.5 text-center
                            align-middle text-[10px] font-normal
                          `,
                          we && "bg-muted/40 text-muted-foreground",
                          ds === today && "bg-primary/10 font-semibold",
                        )}
                      >
                        <div>{d.getDate()}</div>
                        <div className="text-muted-foreground text-[8px]">
                          {d.toLocaleDateString("en", { weekday: "narrow" })}
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-muted/20">
                    <TableCell
                      className={`
                        bg-background sticky left-0 z-10 border-r py-1 pr-2 pl-2
                        align-middle font-medium whitespace-normal
                      `}
                    >
                      <div>{emp.name}</div>
                      {emp.department && (
                        <div className="text-muted-foreground text-[8px]">
                          {emp.department}
                        </div>
                      )}
                    </TableCell>
                    {days.map((d) => {
                      const ds = ymdLocal(d);
                      const we = isWeekend(d);
                      const leave = emp.leaves.find((l) =>
                        isInRange(d, l.startDate, l.endDate),
                      );
                      return (
                        <TableCell
                          key={ds}
                          className={cn(
                            `
                              px-0 py-0.5 text-center align-middle
                              whitespace-nowrap
                            `,
                            we && !leave && "bg-muted/20",
                          )}
                          title={
                            leave
                              ? `${leave.leaveType.name} (${leave.status})`
                              : undefined
                          }
                        >
                          {leave && (
                            <div
                              className={cn(
                                "mx-auto h-4 w-4 rounded-sm",
                                getLeaveColor(leave.leaveType.code),
                                leave.status === "pending" && "opacity-50",
                              )}
                            />
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {/* Legend */}
            <div className="border-t px-3 py-2">
              <div className="flex flex-wrap gap-3 text-[10px]">
                {Object.entries(LEAVE_TYPE_COLORS).map(([code, color]) => (
                  <div key={code} className="flex items-center gap-1">
                    <div className={cn("h-3 w-3 rounded-sm", color)} />
                    <span>{code}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-sm bg-indigo-400/80" />
                  <span>Other</span>
                </div>
                <div className="text-muted-foreground ml-2">
                  (faded = pending)
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
