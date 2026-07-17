"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import {
  ATTENDANCE_WORK_MODE_LABELS,
  ATTENDANCE_WORK_MODES,
} from "@/services/attendance.service";
import {
  type AttendancePolicy,
  getAttendancePolicy,
  updateAttendancePolicy,
} from "@/services/attendance-phase2.service";

export function AttendancePolicyPanel() {
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPolicy = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAttendancePolicy();
      setPolicy(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load policy",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPolicy();
  }, [fetchPolicy]);

  async function handleSave() {
    if (!policy) return;
    try {
      setSaving(true);
      const res = await updateAttendancePolicy({
        shiftStartTime: policy.shiftStartTime,
        shiftEndTime: policy.shiftEndTime,
        graceMinutes: policy.graceMinutes,
        halfDayThresholdHours: policy.halfDayThresholdHours,
        minimumWorkingHours: policy.minimumWorkingHours,
        allowedWorkModes: policy.allowedWorkModes,
        weekendDays: policy.weekendDays,
        attendanceThresholdPct: policy.attendanceThresholdPct,
        defaultTimezone: policy.defaultTimezone,
        missedCheckInAfterMinutes: policy.missedCheckInAfterMinutes,
        missedCheckOutAfterMinutes: policy.missedCheckOutAfterMinutes,
        consecutiveAbsenceAlertDays: policy.consecutiveAbsenceAlertDays,
        entityId: policy.entityId,
      });
      setPolicy(res.data);
      toast.success("Attendance policy saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !policy) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-center">
          Loading policy…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance Policy & Settings</CardTitle>
        <CardDescription>
          Configure shift times, grace period, work modes, and thresholds
        </CardDescription>
      </CardHeader>
      <CardContent
        className={`
          grid gap-4
          sm:grid-cols-2
        `}
      >
        <div className="space-y-2">
          <Label>Shift Start</Label>
          <Input
            type="time"
            value={policy.shiftStartTime}
            onChange={(e) =>
              setPolicy({ ...policy, shiftStartTime: e.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Shift End</Label>
          <Input
            type="time"
            value={policy.shiftEndTime}
            onChange={(e) =>
              setPolicy({ ...policy, shiftEndTime: e.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Grace Minutes</Label>
          <Input
            type="number"
            min={0}
            value={policy.graceMinutes}
            onChange={(e) =>
              setPolicy({ ...policy, graceMinutes: Number(e.target.value) })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Half-Day Threshold (hours)</Label>
          <Input
            type="number"
            min={0}
            step={0.5}
            value={policy.halfDayThresholdHours}
            onChange={(e) =>
              setPolicy({
                ...policy,
                halfDayThresholdHours: Number(e.target.value),
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Minimum Working Hours</Label>
          <Input
            type="number"
            min={0}
            step={0.5}
            value={policy.minimumWorkingHours}
            onChange={(e) =>
              setPolicy({
                ...policy,
                minimumWorkingHours: Number(e.target.value),
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Attendance Threshold (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={policy.attendanceThresholdPct}
            onChange={(e) =>
              setPolicy({
                ...policy,
                attendanceThresholdPct: Number(e.target.value),
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Company Default Timezone</Label>
          <Input
            value={policy.defaultTimezone ?? "Asia/Bangkok"}
            onChange={(e) =>
              setPolicy({ ...policy, defaultTimezone: e.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Missed Check-In After (min)</Label>
          <Input
            type="number"
            min={30}
            value={policy.missedCheckInAfterMinutes ?? 120}
            onChange={(e) =>
              setPolicy({
                ...policy,
                missedCheckInAfterMinutes: Number(e.target.value),
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Missed Check-Out After (min)</Label>
          <Input
            type="number"
            min={30}
            value={policy.missedCheckOutAfterMinutes ?? 60}
            onChange={(e) =>
              setPolicy({
                ...policy,
                missedCheckOutAfterMinutes: Number(e.target.value),
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Consecutive Absence Alert (days)</Label>
          <Input
            type="number"
            min={2}
            value={policy.consecutiveAbsenceAlertDays ?? 3}
            onChange={(e) =>
              setPolicy({
                ...policy,
                consecutiveAbsenceAlertDays: Number(e.target.value),
              })
            }
          />
        </div>
        <div
          className={`
            space-y-2
            sm:col-span-2
          `}
        >
          <Label>Allowed Work Modes</Label>
          <div className="flex flex-wrap gap-2">
            {ATTENDANCE_WORK_MODES.map((mode) => {
              const active = policy.allowedWorkModes.includes(mode);
              return (
                <Button
                  key={mode}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => {
                    const next = active
                      ? policy.allowedWorkModes.filter((m) => m !== mode)
                      : [...policy.allowedWorkModes, mode];
                    if (next.length) {
                      setPolicy({ ...policy, allowedWorkModes: next });
                    }
                  }}
                >
                  {ATTENDANCE_WORK_MODE_LABELS[mode]}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="sm:col-span-2">
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Policy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
