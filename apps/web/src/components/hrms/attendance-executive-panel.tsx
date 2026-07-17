"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ApiError } from "@/lib/api-client";
import {
  type ExecutiveAttendanceAnalytics,
  getExecutiveAttendanceAnalytics,
} from "@/services/attendance-phase3.service";

const trendConfig = {
  attendancePercentage: {
    label: "Attendance %",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const remoteConfig = {
  remotePercentage: { label: "Remote %", color: "hsl(var(--chart-2))" },
  officePercentage: { label: "Office %", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function AttendanceExecutivePanel({ month }: { month?: string }) {
  const [data, setData] = useState<ExecutiveAttendanceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getExecutiveAttendanceAnalytics({ month });
      setData(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to load executive analytics",
      );
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-center">
          Loading executive analytics…
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`
          grid gap-4
          sm:grid-cols-2
          lg:grid-cols-3
        `}
      >
        <StatTile
          label="Average Working Hours"
          value={`${data.averageWorkingHours}h`}
        />
      </div>

      <div
        className={`
          grid gap-4
          lg:grid-cols-2
        `}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance Trend</CardTitle>
            <CardDescription>Last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={trendConfig} className="h-[220px] w-full">
              <LineChart data={data.attendanceTrend}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} domain={[0, 100]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="attendancePercentage"
                  stroke="var(--color-attendancePercentage)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Remote vs Office</CardTitle>
            <CardDescription>Monthly split</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={remoteConfig} className="h-[220px] w-full">
              <BarChart data={data.remoteVsOfficeTrend}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} domain={[0, 100]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="remotePercentage"
                  fill="var(--color-remotePercentage)"
                  radius={2}
                />
                <Bar
                  dataKey="officePercentage"
                  fill="var(--color-officePercentage)"
                  radius={2}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div
        className={`
          grid gap-4
          lg:grid-cols-2
        `}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most Punctual Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: "name", header: "Name" },
                {
                  key: "late",
                  header: "Late %",
                  render: (r) => `${r.latePercentage}%`,
                },
                {
                  key: "att",
                  header: "Attendance %",
                  render: (r) => `${r.attendancePercentage}%`,
                },
              ]}
              data={data.mostPunctualEmployees}
              emptyMessage="No data"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Highest Attendance %</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: "name", header: "Name" },
                {
                  key: "att",
                  header: "Attendance %",
                  render: (r) => `${r.attendancePercentage}%`,
                },
              ]}
              data={data.highestAttendanceEmployees}
              emptyMessage="No data"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Highest Absentee Departments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: "department", header: "Department" },
              {
                key: "headcount",
                header: "Headcount",
                render: (r) => String(r.headcount),
              },
              {
                key: "absent",
                header: "Absent %",
                render: (r) => `${r.absentPercentage}%`,
              },
            ]}
            data={data.highestAbsenteeDepartments}
            emptyMessage="No data"
          />
        </CardContent>
      </Card>
    </div>
  );
}
