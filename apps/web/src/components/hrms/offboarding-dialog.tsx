"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { RemoteUserPicker } from "@/components/crm/remote-user-picker";
import { FALLBACK_OFFBOARDING_TEMPLATE } from "@/components/hrms/hrms-constants";
import {
  cleanParts,
  type EditablePart,
  PartsEditor,
} from "@/components/hrms/parts-editor";
import { FormDatePicker } from "@/components/shared/form-date-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { getErrorMessage } from "@/lib/error-message";
import type { Entity } from "@/services/entity.service";
import {
  createOffboardingRun,
  getOffboardingTemplate,
} from "@/services/hrms.service";
import { DEPARTMENTS, getUser } from "@/services/user.service";

const NONE_VALUE = "__none__";

/** Slug a label to a stable task key. */
function slugKey(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return slug || `item_${Math.random().toString(36).slice(2, 7)}`;
}

interface OffboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: Entity[];
  onSaved: () => void;
}

export function OffboardingDialog({
  open,
  onOpenChange,
  entities,
  onSaved,
}: OffboardingDialogProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [entityId, setEntityId] = useState("");
  const [parts, setParts] = useState<EditablePart[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // On open: reset the form + seed parts from the admin template
  // (fallback keeps the dialog usable if the fetch fails).
  useEffect(() => {
    if (!open) return;
    setEmployeeId("");
    setEmployeeName("");
    setPosition("");
    setDepartment("");
    setLastWorkingDay("");
    setEntityId("");
    setParts(FALLBACK_OFFBOARDING_TEMPLATE.parts.map((p) => ({ ...p })));
    let cancelled = false;
    void getOffboardingTemplate()
      .then((res) => {
        if (!cancelled && res.data?.parts?.length) {
          setParts(
            res.data.parts.map((p) => ({ name: p.name, tasks: [...p.tasks] })),
          );
        }
      })
      .catch(() => {
        // Keep the fallback already set above.
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Hydrate name / position / department / entity when linking an
  // existing employee (the picker only emits the id).
  useEffect(() => {
    if (!open || !employeeId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await getUser(employeeId);
        if (cancelled) return;
        const u = res.data;
        setEmployeeName(u.name);
        if (u.jobTitle) setPosition(u.jobTitle);
        if (u.department) setDepartment(u.department);
        if (u.entity) setEntityId(u.entity.id);
      } catch {
        // Silent — HR can fill the rest manually.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, employeeId]);

  async function handleSubmit() {
    if (!employeeName.trim()) {
      toast.error("Employee name is required");
      return;
    }
    if (!department) {
      toast.error("Select a department");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lastWorkingDay)) {
      toast.error("Pick the last working day");
      return;
    }
    const cleaned = cleanParts(parts);
    const tasks = cleaned.flatMap((p) =>
      p.tasks.map((label) => ({
        key: slugKey(label),
        label,
        part: p.name,
      })),
    );
    if (tasks.length === 0) {
      toast.error("Add at least one task in a part");
      return;
    }
    setSubmitting(true);
    try {
      await createOffboardingRun({
        employeeId: employeeId || undefined,
        employeeName: employeeName.trim(),
        position: position || undefined,
        department,
        lastWorkingDay,
        entityId: entityId || undefined,
        tasks,
      });
      toast.success("Offboarding run created");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        getErrorMessage(err, "We couldn't create the offboarding run."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent
        className={`
          max-h-[92vh] overflow-y-auto
          sm:max-w-lg
        `}
      >
        <DialogHeader>
          <DialogTitle>Create offboarding run</DialogTitle>
          <DialogDescription>
            Set up an exit checklist for a departing employee. Parts &amp; tasks
            are seeded from the template — tweak them for this run if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Employee (existing)</Label>
            <RemoteUserPicker
              value={employeeId}
              onValueChange={setEmployeeId}
              placeholder="Search to link an existing employee…"
            />
            <p className="text-muted-foreground text-[11px]">
              Optional — leave empty to offboard someone not linked in
              Employees.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="off-name">Employee name *</Label>
              <Input
                id="off-name"
                placeholder="e.g. Jane Doe"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="off-position">Position</Label>
              <Input
                id="off-position"
                placeholder="e.g. Senior Engineer"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Department *</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Last working day *</Label>
              <FormDatePicker
                value={lastWorkingDay}
                onChange={setLastWorkingDay}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Entity</Label>
            <Select
              value={entityId || NONE_VALUE}
              onValueChange={(v) => setEntityId(v === NONE_VALUE ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>None</SelectItem>
                {entities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-[10px] tracking-widest uppercase">
              Checklist parts &amp; tasks
            </Label>
            <PartsEditor parts={parts} onChange={setParts} />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            Create offboarding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
