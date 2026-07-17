import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AttendanceDashboardSummary } from "@/services/attendance.service";

export function AttendanceDashboardCards({
  summary,
  loading,
}: {
  summary: AttendanceDashboardSummary | null;
  loading: boolean;
}) {
  const cards = [
    {
      label: "Present Today",
      value: summary?.presentToday,
      tone: "text-success",
    },
    {
      label: "Absent Today",
      value: summary?.absentToday,
      tone: "text-destructive",
    },
    { label: "Late Today", value: summary?.lateToday, tone: "text-warning" },
    { label: "Remote Today", value: summary?.remoteToday, tone: "" },
    { label: "Hybrid Today", value: summary?.hybridToday, tone: "" },
    { label: "On Leave Today", value: summary?.onLeaveToday, tone: "" },
  ];

  return (
    <div
      className={`
        grid gap-4
        sm:grid-cols-2
        lg:grid-cols-3
        xl:grid-cols-6
      `}
    >
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="pb-2">
            <CardDescription>{c.label}</CardDescription>
            <CardTitle
              className={`
                text-xl tabular-nums
                ${c.tone}
              `}
            >
              {loading ? "..." : (c.value ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
