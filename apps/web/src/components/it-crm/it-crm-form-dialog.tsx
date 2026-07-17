"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { type AssignableUser } from "@/services/directory.service";
import {
  createItProject,
  type CreateItProjectInput,
  type ItProject,
  updateItProject,
} from "@/services/it-crm.service";

const STATUS_OPTIONS = [
  { value: "not_yet_started", label: "Not Yet Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "uat", label: "UAT" },
  { value: "staging_integrated", label: "Staging Integrated" },
  { value: "prod_integrated", label: "Prod. Integrated" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: AssignableUser[];
  project: ItProject | null;
  onSaved: (project: ItProject) => void;
}

export function ItCrmFormDialog({
  open,
  onOpenChange,
  users,
  project,
  onSaved,
}: Props) {
  const isEdit = !!project;
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("not_yet_started");
  const [ownerId, setOwnerId] = useState("");
  const [goLiveDate, setGoLiveDate] = useState("");
  const [revisedGoLiveDate, setRevisedGoLiveDate] = useState("");
  const [dependency, setDependency] = useState("");
  const [comment, setComment] = useState("");
  const [defaultAssigneeMode, setDefaultAssigneeMode] = useState<
    "none" | "creator" | "owner" | "user"
  >("none");
  const [defaultAssigneeId, setDefaultAssigneeId] = useState("");

  useEffect(() => {
    if (!open) return;
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setStatus(project.status);
      setOwnerId(project.ownerId);
      setGoLiveDate(project.goLiveDate?.slice(0, 10) ?? "");
      setRevisedGoLiveDate(project.revisedGoLiveDate?.slice(0, 10) ?? "");
      setDependency(project.dependency ?? "");
      setComment(project.comment ?? "");
      setDefaultAssigneeMode(project.defaultAssigneeMode);
      setDefaultAssigneeId(project.defaultAssigneeId ?? "");
    } else {
      setName("");
      setDescription("");
      setStatus("not_yet_started");
      setOwnerId("");
      setGoLiveDate("");
      setRevisedGoLiveDate("");
      setDependency("");
      setComment("");
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
      toast.error("Pick a default assignee, or choose a different mode");
      return;
    }
    setSubmitting(true);
    try {
      const payload: CreateItProjectInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        ownerId: ownerId || undefined,
        goLiveDate: goLiveDate || null,
        revisedGoLiveDate: revisedGoLiveDate || null,
        dependency: dependency.trim() || null,
        comment: comment.trim() || null,
        defaultAssigneeMode,
        defaultAssigneeId:
          defaultAssigneeMode === "user" ? defaultAssigneeId || null : null,
      };
      const res = project
        ? await updateItProject(project.id, payload)
        : await createItProject(payload);
      toast.success(project ? "IT project updated" : "IT project created");
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
            {isEdit ? "Edit Project" : "New IT Project"}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? "Update project details." : "Create a new IT project."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="it-name">Name *</Label>
            <Input
              id="it-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="it-description">Description</Label>
            <Textarea
              id="it-description"
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
                  <SelectItem value="creator">Whoever creates it</SelectItem>
                  <SelectItem value="owner">Project owner</SelectItem>
                  <SelectItem value="user">A specific person…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {defaultAssigneeMode === "user" ? (
              <div className="flex flex-col gap-1.5">
                <Label>Default assignee</Label>
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
                    <SelectItem value="__none__">— None —</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>GoLive Date</Label>
              <FormDatePicker
                value={goLiveDate}
                onChange={setGoLiveDate}
                placeholder="Pick a date"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Deadline</Label>
              <FormDatePicker
                value={revisedGoLiveDate}
                onChange={setRevisedGoLiveDate}
                placeholder="Pick a date"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="it-dep">Blocker</Label>
            <Input
              id="it-dep"
              value={dependency}
              onChange={(e) => setDependency(e.target.value)}
              placeholder="Upstream blocker, vendor, team..."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="it-comment">Comment</Label>
            <Textarea
              id="it-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Status note for the team..."
              rows={2}
              className="resize-none"
            />
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
