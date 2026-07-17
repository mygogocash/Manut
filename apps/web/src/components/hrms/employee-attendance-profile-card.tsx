"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { formatDualTime } from "@/components/hrms/attendance-time-display";
import { ApiError } from "@/lib/api-client";
import { getEmployeeAttendanceProfile } from "@/services/attendance-phase3.service";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function EmployeeAttendanceProfileCard({
  employeeId,
}: {
  employeeId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<
    Awaited<ReturnType<typeof getEmployeeAttendanceProfile>>["data"] | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getEmployeeAttendanceProfile(employeeId, {
          month: currentMonth(),
        });
        if (!cancelled) setProfile(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Attendance unavailable",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="text-muted-foreground size-4 animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <p className="text-muted-foreground py-2 text-[11px]">
        {error ?? "No attendance data"}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between py-1">
        <span className="text-muted-foreground text-[11px] font-medium">
          Attendance %
        </span>
        <span className="text-foreground text-[12px] font-semibold tabular-nums">
          {profile.attendancePercentage}%
        </span>
      </div>
      <div className="flex items-start justify-between py-1">
        <span className="text-muted-foreground text-[11px] font-medium">
          Late %
        </span>
        <span className="text-foreground text-[12px] tabular-nums">
          {profile.latePercentage}%
        </span>
      </div>
      <div className="flex items-start justify-between py-1">
        <span className="text-muted-foreground text-[11px] font-medium">
          Current Shift
        </span>
        <span className="text-foreground text-right text-[12px]">
          {profile.currentShift
            ? `${profile.currentShift.shiftName} (${profile.currentShift.startTime}–${profile.currentShift.endTime})`
            : "—"}
        </span>
      </div>
      <div className="flex items-start justify-between py-1">
        <span className="text-muted-foreground text-[11px] font-medium">
          Last Check-In
        </span>
        <span className="text-foreground max-w-[55%] text-right text-[11px]">
          {formatDualTime(profile.lastCheckInDisplay, profile.lastCheckIn)}
        </span>
      </div>
      <div className="flex items-start justify-between py-1">
        <span className="text-muted-foreground text-[11px] font-medium">
          Last Check-Out
        </span>
        <span className="text-foreground max-w-[55%] text-right text-[11px]">
          {formatDualTime(profile.lastCheckOutDisplay, profile.lastCheckOut)}
        </span>
      </div>
      <div className="border-border mt-2 rounded-md border px-2 py-2">
        <p
          className={`
            text-muted-foreground mb-1 text-[10px] font-bold tracking-widest
            uppercase
          `}
        >
          {profile.monthlySummary.month} Summary
        </p>
        <p className="text-foreground text-[11px]">
          Present {profile.monthlySummary.daysPresent} /{" "}
          {profile.monthlySummary.totalWorkingDays} working days · Late{" "}
          {profile.monthlySummary.lateArrivals} · Remote{" "}
          {profile.monthlySummary.remoteDays}
        </p>
      </div>
    </div>
  );
}
