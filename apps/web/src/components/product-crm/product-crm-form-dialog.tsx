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
  createProductProject,
  type CreateProductProjectInput,
  type ProductProject,
  updateProductProject,
} from "@/services/product-crm.service";

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
  project: ProductProject | null;
  onSaved: (project: ProductProject) => void;
}

export function ProductCrmFormDialog({
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
  const [productionLiveDate, setProductionLiveDate] = useState("");
  const [dependency, setDependency] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!open) return;
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setStatus(project.status);
      setOwnerId(project.ownerId);
      setGoLiveDate(project.goLiveDate?.slice(0, 10) ?? "");
      setRevisedGoLiveDate(project.revisedGoLiveDate?.slice(0, 10) ?? "");
      setProductionLiveDate(project.productionLiveDate?.slice(0, 10) ?? "");
      setDependency(project.dependency ?? "");
      setComment(project.comment ?? "");
    } else {
      setName("");
      setDescription("");
      setStatus("not_yet_started");
      setOwnerId("");
      setGoLiveDate("");
      setRevisedGoLiveDate("");
      setProductionLiveDate("");
      setDependency("");
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
      const payload: CreateProductProjectInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        ownerId: ownerId || undefined,
        goLiveDate: goLiveDate || null,
        revisedGoLiveDate: revisedGoLiveDate || null,
        productionLiveDate: productionLiveDate || null,
        dependency: dependency.trim() || null,
        comment: comment.trim() || null,
      };
      const res = project
        ? await updateProductProject(project.id, payload)
        : await createProductProject(payload);
      toast.success(
        project ? "Product project updated" : "Product project created",
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
            {isEdit ? "Edit IT Project" : "New IT Project"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update project details."
              : "Create a new Product project."}
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
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="it-go">GoLive Date</Label>
              <FormDatePicker value={goLiveDate} onChange={setGoLiveDate} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="it-rev">Rev. GoLive</Label>
              <FormDatePicker
                value={revisedGoLiveDate}
                onChange={setRevisedGoLiveDate}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="it-prod">Production Live</Label>
              <FormDatePicker
                value={productionLiveDate}
                onChange={setProductionLiveDate}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="it-dep">Dependency</Label>
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
