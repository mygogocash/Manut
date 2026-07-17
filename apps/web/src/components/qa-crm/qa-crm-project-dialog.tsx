"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
  createQaProject,
  type CreateQaProjectInput,
  type QaProject,
  updateQaProject,
} from "@/services/qa-crm.service";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: AssignableUser[];
  project: QaProject | null;
  onSaved: (project: QaProject) => void;
}

export function QaCrmProjectDialog({
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
  const [status, setStatus] = useState("active");
  const [ownerId, setOwnerId] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!open) return;
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setStatus(project.status);
      setOwnerId(project.ownerId);
      setComment(project.comment ?? "");
    } else {
      setName("");
      setDescription("");
      setStatus("active");
      setOwnerId("");
      setComment("");
    }
  }, [open, project]);

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      const payload: CreateQaProjectInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        ownerId: ownerId || undefined,
        comment: comment.trim() || null,
      };
      const res = project
        ? await updateQaProject(project.id, payload)
        : await createQaProject(payload);
      toast.success(project ? "QA project updated" : "QA project created");
      onSaved(res.data);
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save QA project";
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
            {isEdit ? "Edit QA Project" : "New QA Project"}
          </DialogTitle>
          <DialogDescription>
            A QA project groups related QA issues — e.g. one release, one
            product area, one regression sweep.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qa-name">Name *</Label>
            <Input
              id="qa-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="App v2 regression, Mobile QA sweep..."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qa-description">Description</Label>
            <Textarea
              id="qa-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief context"
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qa-comment">Comment</Label>
            <Textarea
              id="qa-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Notes for the team..."
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
            {isEdit ? "Save Changes" : "Create QA Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
