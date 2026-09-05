"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AttendancePolicyPanel } from "@/components/hrms/attendance-policy-panel";
import { Badge } from "@/components/shared/badge";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  ATTENDANCE_EXCEPTION_TYPES,
  type AttendanceException,
  type AttendanceShift,
  createAttendanceException,
  createAttendanceShift,
  listAttendanceExceptions,
  listAttendanceShifts,
} from "@/services/attendance-phase2.service";

const exceptionSchema = z.object({
  type: z.enum(ATTENDANCE_EXCEPTION_TYPES),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().min(1).max(500),
});

const shiftSchema = z.object({
  shiftName: z.string().min(1).max(100),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  graceMinutes: z.coerce.number().min(0).max(120),
});

function AttendanceShiftsCard({ canManage }: { canManage: boolean }) {
  const [shifts, setShifts] = useState<AttendanceShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<z.infer<typeof shiftSchema>>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      shiftName: "",
      startTime: "09:00",
      endTime: "18:00",
      graceMinutes: 15,
    },
  });

  const fetchShifts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listAttendanceShifts();
      setShifts(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load shifts",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchShifts();
  }, [fetchShifts]);

  async function onSubmit(values: z.infer<typeof shiftSchema>) {
    try {
      setSaving(true);
      await createAttendanceShift({
        ...values,
        entityId: null,
        active: true,
      });
      toast.success("Shift created");
      setDialogOpen(false);
      form.reset();
      void fetchShifts();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Shift Management</CardTitle>
          <CardDescription>
            Morning, evening, night, and custom shifts
          </CardDescription>
        </div>
        {canManage ? (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1.5 size-3.5" />
            Add Shift
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <DataTable
          loading={loading}
          emptyMessage="No shifts configured"
          data={shifts}
          columns={[
            { key: "name", header: "Shift", render: (r) => r.shiftName },
            { key: "start", header: "Start", render: (r) => r.startTime },
            { key: "end", header: "End", render: (r) => r.endTime },
            {
              key: "grace",
              mobileRole: "field" as const,
              header: "Grace (min)",
              render: (r) => String(r.graceMinutes),
            },
            {
              key: "active",
              mobileRole: "badge" as const,
              header: "Status",
              render: (r) => (
                <Badge variant={r.active ? "green" : "grey"}>
                  {r.active ? "Active" : "Inactive"}
                </Badge>
              ),
            },
          ]}
        />
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Shift</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              className="flex flex-col gap-4"
              onSubmit={form.handleSubmit((v) => void onSubmit(v))}
            >
              <FormField
                control={form.control}
                name="shiftName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shift Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Morning Shift" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="graceMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grace Minutes</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AttendanceExceptionsCard() {
  const [rows, setRows] = useState<AttendanceException[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<z.infer<typeof exceptionSchema>>({
    resolver: zodResolver(exceptionSchema),
    defaultValues: {
      type: "business_travel",
      startDate: "",
      endDate: "",
      reason: "",
    },
  });

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listAttendanceExceptions({ page: 1, limit: 50 });
      setRows(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load exceptions",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  async function onSubmit(values: z.infer<typeof exceptionSchema>) {
    try {
      setSaving(true);
      await createAttendanceException(values);
      toast.success("Exception submitted");
      setDialogOpen(false);
      form.reset();
      void fetchRows();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Submit failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Attendance Exceptions</CardTitle>
          <CardDescription>
            Business travel, training, field work, and official duty
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 size-3.5" />
          Request Exception
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable
          loading={loading}
          emptyMessage="No exceptions"
          data={rows}
          columns={[
            {
              key: "type",
              header: "Type",
              render: (r) => r.type.replace(/_/g, " "),
            },
            { key: "start", header: "Start", render: (r) => r.startDate },
            { key: "end", header: "End", render: (r) => r.endDate },
            { key: "reason", mobileRole: "field" as const, header: "Reason", render: (r) => r.reason },
            {
              key: "status",
              mobileRole: "badge" as const,
              header: "Status",
              render: (r) => (
                <Badge variant={r.status === "approved" ? "green" : "amber"}>
                  {r.status}
                </Badge>
              ),
            },
          ]}
        />
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Exception</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              className="flex flex-col gap-4"
              onSubmit={form.handleSubmit((v) => void onSubmit(v))}
            >
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ATTENDANCE_EXCEPTION_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Submit
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function AttendanceSettingsPanel({
  canManagePolicy,
}: {
  canManagePolicy: boolean;
}) {
  if (!canManagePolicy) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-center">
          HR Admin access required to manage attendance settings.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AttendancePolicyPanel />
      <AttendanceShiftsCard canManage={canManagePolicy} />
      <AttendanceExceptionsCard />
    </div>
  );
}
