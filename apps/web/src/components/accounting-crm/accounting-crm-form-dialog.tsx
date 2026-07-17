"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  ACCOUNTING_PRIORITY_OPTIONS,
  normalizeAccountingPriority,
} from "@/components/accounting-crm/accounting-priority";
import {
  normalizeAccountingStatus,
  STATUS_OPTIONS,
} from "@/components/accounting-crm/accounting-status";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  type AccountingProject,
  createAccountingProject,
  type CreateAccountingProjectInput,
  updateAccountingProject,
} from "@/services/accounting-crm.service";
import { type AssignableUser } from "@/services/directory.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: AssignableUser[];
  project: AccountingProject | null;
  onSaved: (project: AccountingProject) => void;
}

export function AccountingCrmFormDialog({
  open,
  onOpenChange,
  users,
  project,
  onSaved,
}: Props) {
  const isEdit = !!project;
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [workstream, setWorkstream] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("backlog");
  const [priority, setPriority] = useState("medium");
  const [ownerId, setOwnerId] = useState("");
  const [goLiveDate, setGoLiveDate] = useState("");
  const [dependency, setDependency] = useState("");
  const [defaultAssigneeMode, setDefaultAssigneeMode] = useState<
    "none" | "creator" | "owner" | "user"
  >("none");
  const [defaultAssigneeId, setDefaultAssigneeId] = useState("");

  useEffect(() => {
    if (!open) return;
    if (project) {
      setName(project.name);
      setWorkstream(project.workstream ?? "");
      setDescription(project.description ?? "");
      // Normalise so a legacy row (stored `completed` / `pending_dept_info`)
      // shows its five-state equivalent in the dropdown instead of a blank
      // trigger. Saving then persists the new key — a gradual, user-driven
      // migration with no bulk DB change.
      setStatus(normalizeAccountingStatus(project.status));
      setPriority(normalizeAccountingPriority(project.priority));
      setOwnerId(project.ownerId);
      setGoLiveDate(project.goLiveDate?.slice(0, 10) ?? "");
      setDependency(project.dependency ?? "");
      setDefaultAssigneeMode(
        (project.defaultAssigneeMode as
          "none" | "creator" | "owner" | "user") ?? "none",
      );
      setDefaultAssigneeId(project.defaultAssigneeId ?? "");
    } else {
      setName("");
      setWorkstream("");
      setDescription("");
      setStatus("backlog");
      setPriority("medium");
      setOwnerId("");
      setGoLiveDate("");
      setDependency("");
      setDefaultAssigneeMode("none");
      setDefaultAssigneeId("");
    }
  }, [open, project]);

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (defaultAssigneeMode === "user" && !defaultAssigneeId) {
      toast.error("Pick a person for the auto-assign default");
      return;
    }
    setSubmitting(true);
    try {
      const payload: CreateAccountingProjectInput = {
        name: name.trim(),
        workstream: workstream.trim() || null,
        description: description.trim() || undefined,
        status,
        priority,
        ownerId: ownerId || undefined,
        goLiveDate: goLiveDate || null,
        dependency: dependency.trim() || null,
        defaultAssigneeMode,
        defaultAssigneeId:
          defaultAssigneeMode === "user" ? defaultAssigneeId || null : null,
      };
      const res = project
        ? await updateAccountingProject(project.id, payload)
        : await createAccountingProject(payload);
      toast.success(
        project ? "Accounting Task updated" : "Accounting Task created",
      );
      onSaved(res.data);
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save project";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Project" : "New Accounting Task"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update project details."
              : "Create a new Accounting Task."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accounting-workstream">Workstream</Label>
            <Input
              id="accounting-workstream"
              value={workstream}
              onChange={(e) => setWorkstream(e.target.value)}
              placeholder="e.g. Atlas T&C, Dubai Sponsorship VISA"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accounting-name">Accounting Task *</Label>
            <Input
              id="accounting-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Corporate, Agreement"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accounting-description">Description</Label>
            <Textarea
              id="accounting-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              rows={2}
              className="resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNTING_PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Owner</Label>
              <Select
                value={ownerId || "__none__"}
                onValueChange={(v) => setOwnerId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Default to self" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Self —</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Date</Label>
              <FormDatePicker
                value={goLiveDate}
                onChange={setGoLiveDate}
                placeholder="Pick a date"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accounting-dep">Dependency</Label>
            <Input
              id="accounting-dep"
              value={dependency}
              onChange={(e) => setDependency(e.target.value)}
              placeholder="Upstream blocker, vendor, team..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Auto-assign new tasks to</Label>
              <Select
                value={defaultAssigneeMode}
                onValueChange={(v) =>
                  setDefaultAssigneeMode(
                    v as "none" | "creator" | "owner" | "user",
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default</SelectItem>
                  <SelectItem value="creator">Task creator</SelectItem>
                  <SelectItem value="owner">Project owner</SelectItem>
                  <SelectItem value="user">Specific person</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {defaultAssigneeMode === "user" && (
              <div className="flex flex-col gap-1.5">
                <Label>Default person</Label>
                <Select
                  value={defaultAssigneeId || "__none__"}
                  onValueChange={(v) =>
                    setDefaultAssigneeId(v === "__none__" ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a person" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Pick a person —</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {isEdit ? "Save Changes" : "Create Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
