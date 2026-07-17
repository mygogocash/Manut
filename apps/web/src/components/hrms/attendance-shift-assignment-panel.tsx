"use client";

import { Loader2, Plus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  type AttendanceShift,
  listAttendanceShifts,
} from "@/services/attendance-phase2.service";
import {
  type AttendanceShiftAssignment,
  bulkAssignShift,
  changeShiftAssignment,
  listShiftAssignments,
} from "@/services/attendance-phase3.service";
import { listAssignableUsers } from "@/services/directory.service";

export function AttendanceShiftAssignmentPanel() {
  const [assignments, setAssignments] = useState<AttendanceShiftAssignment[]>(
    [],
  );
  const [shifts, setShifts] = useState<AttendanceShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedAssignment, setSelectedAssignment] =
    useState<AttendanceShiftAssignment | null>(null);

  const [bulkShiftId, setBulkShiftId] = useState("");
  const [bulkFrom, setBulkFrom] = useState("");
  const [bulkTo, setBulkTo] = useState("");
  const [bulkEmployeeIds, setBulkEmployeeIds] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeOptions, setEmployeeOptions] = useState<
    Array<{ id: string; name: string; department: string | null }>
  >([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [assignRes, shiftRes] = await Promise.all([
        listShiftAssignments(),
        listAttendanceShifts(),
      ]);
      setAssignments(assignRes.data);
      setShifts(shiftRes.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load assignments",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!bulkOpen) return;
    void listAssignableUsers({ search: employeeSearch, limit: 50 })
      .then((res) =>
        setEmployeeOptions(
          res.data.map((u) => ({
            id: u.id,
            name: u.name,
            department: null,
          })),
        ),
      )
      .catch(() => {});
  }, [bulkOpen, employeeSearch]);

  async function handleBulkAssign() {
    if (!bulkShiftId || !bulkFrom || bulkEmployeeIds.length === 0) {
      toast.error("Select shift, effective date, and at least one employee");
      return;
    }
    try {
      setSaving(true);
      await bulkAssignShift({
        employeeIds: bulkEmployeeIds,
        shiftId: bulkShiftId,
        effectiveFrom: bulkFrom,
        effectiveTo: bulkTo || undefined,
      });
      toast.success(`Assigned shift to ${bulkEmployeeIds.length} employee(s)`);
      setBulkOpen(false);
      setBulkEmployeeIds([]);
      setBulkShiftId("");
      setBulkFrom("");
      setBulkTo("");
      void fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Bulk assign failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeShift() {
    if (!selectedAssignment) return;
    try {
      setSaving(true);
      await changeShiftAssignment(selectedAssignment.id, {
        shiftId: bulkShiftId || undefined,
        effectiveFrom: bulkFrom || undefined,
        effectiveTo: bulkTo || null,
      });
      toast.success("Shift assignment updated");
      setChangeOpen(false);
      setSelectedAssignment(null);
      void fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    {
      key: "employee",
      header: "Employee",
      render: (r: AttendanceShiftAssignment) =>
        r.employee?.name ?? r.employeeId,
    },
    {
      key: "department",
      header: "Department",
      render: (r: AttendanceShiftAssignment) => r.employee?.department ?? "—",
    },
    {
      key: "shift",
      header: "Shift",
      render: (r: AttendanceShiftAssignment) => (
        <span>
          {r.shiftName}{" "}
          <span className="text-muted-foreground text-xs">
            ({r.startTime}–{r.endTime})
          </span>
        </span>
      ),
    },
    {
      key: "effective",
      header: "Effective",
      render: (r: AttendanceShiftAssignment) => (
        <span className="text-xs tabular-nums">
          {r.effectiveFrom}
          {r.effectiveTo ? ` → ${r.effectiveTo}` : " → ongoing"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r: AttendanceShiftAssignment) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setSelectedAssignment(r);
            setBulkShiftId(r.shiftId);
            setBulkFrom(r.effectiveFrom);
            setBulkTo(r.effectiveTo ?? "");
            setChangeOpen(true);
          }}
        >
          Change
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Shift Assignment</CardTitle>
            <CardDescription>
              Assign, change, or bulk-assign employee shifts
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              // Clear the shared draft so values from the Change dialog don't
              // bleed into Bulk Assign.
              setBulkShiftId("");
              setBulkFrom("");
              setBulkTo("");
              setBulkEmployeeIds([]);
              setBulkOpen(true);
            }}
          >
            <Plus className="mr-1.5 size-3.5" />
            Bulk Assign
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={assignments}
            loading={loading}
            emptyMessage="No shift assignments yet"
          />
        </CardContent>
      </Card>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Assign Shift</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Shift</Label>
              <Select value={bulkShiftId} onValueChange={setBulkShiftId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  {shifts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.shiftName} ({s.startTime}–{s.endTime})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Effective From</Label>
                <Input
                  type="date"
                  value={bulkFrom}
                  onChange={(e) => setBulkFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Effective To (optional)</Label>
                <Input
                  type="date"
                  value={bulkTo}
                  onChange={(e) => setBulkTo(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Search employees</Label>
              <Input
                placeholder="Search by name…"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
              />
            </div>
            <div
              className={`max-h-40 space-y-1 overflow-y-auto rounded border p-2`}
            >
              {employeeOptions.map((emp) => {
                const selected = bulkEmployeeIds.includes(emp.id);
                return (
                  <button
                    key={emp.id}
                    type="button"
                    className={`
                      flex w-full items-center gap-2 rounded px-2 py-1 text-left
                      text-xs
                      ${selected ? "bg-primary/10" : "hover:bg-muted"}
                    `}
                    onClick={() =>
                      setBulkEmployeeIds((prev) =>
                        selected
                          ? prev.filter((id) => id !== emp.id)
                          : [...prev, emp.id],
                      )
                    }
                  >
                    <Users className="size-3 shrink-0" />
                    {emp.name}
                  </button>
                );
              })}
            </div>
            {bulkEmployeeIds.length > 0 ? (
              <p className="text-muted-foreground text-xs">
                {bulkEmployeeIds.length} employee(s) selected
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleBulkAssign()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Shift Assignment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Shift</Label>
              <Select value={bulkShiftId} onValueChange={setBulkShiftId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {shifts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.shiftName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Effective From</Label>
                <Input
                  type="date"
                  value={bulkFrom}
                  onChange={(e) => setBulkFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Effective To</Label>
                <Input
                  type="date"
                  value={bulkTo}
                  onChange={(e) => setBulkTo(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleChangeShift()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
