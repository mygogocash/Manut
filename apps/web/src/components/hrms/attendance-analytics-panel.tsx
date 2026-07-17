"use client";

import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

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
  type AttendanceAnalyticsSummary,
  getAttendanceAnalytics,
} from "@/services/attendance-phase2.service";

const trendConfig = {
  attendancePercentage: {
    label: "Attendance %",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function AttendanceAnalyticsPanel({ month }: { month?: string }) {
  const [data, setData] = useState<AttendanceAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAttendanceAnalytics({ month });
      setData(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load analytics",
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
          Loading analytics…
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
          lg:grid-cols-5
        `}
      >
        <StatTile
          label="Attendance %"
          value={`${data.attendancePercentage}%`}
        />
        <StatTile label="Late %" value={`${data.latePercentage}%`} />
        <StatTile label="Avg Hours" value={String(data.averageWorkingHours)} />
        <StatTile label="Remote %" value={`${data.remotePercentage}%`} />
        <StatTile label="Hybrid %" value={`${data.hybridPercentage}%`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Trend</CardTitle>
          <CardDescription>Attendance percentage over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={trendConfig} className="h-[280px] w-full">
            <BarChart data={data.monthlyTrend}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="attendancePercentage"
                fill="var(--color-attendancePercentage)"
                radius={4}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Department Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="pr-4 pb-2">Department</th>
                <th className="pr-4 pb-2">Attendance %</th>
                <th className="pr-4 pb-2">Late %</th>
                <th className="pb-2">Absent %</th>
              </tr>
            </thead>
            <tbody>
              {data.departmentBreakdown.map((d) => (
                <tr key={d.department} className="border-b">
                  <td className="py-2 pr-4">{d.department}</td>
                  <td className="py-2 pr-4">{d.attendancePercentage}%</td>
                  <td className="py-2 pr-4">{d.latePercentage}%</td>
                  <td className="py-2">{d.absentPercentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
