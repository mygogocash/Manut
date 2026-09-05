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
  type CreateQaProjectTaskInput,
  createQaTask,
  type QaPriority,
  type QaProjectTask,
  type QaTaskStatus,
  updateQaTask,
} from "@/services/qa-crm.service";

const PRIORITY_OPTIONS: { value: QaPriority; label: string }[] = [
  { value: "P0", label: "P0-High" },
  { value: "P1", label: "P1-Medium" },
  { value: "P2", label: "P2-Low" },
];

const STATUS_OPTIONS: { value: QaTaskStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "clarified", label: "Clarified" },
  { value: "exception", label: "Exception" },
  { value: "closed", label: "Closed" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  users: AssignableUser[];
  task: QaProjectTask | null;
  onSaved: (task: QaProjectTask) => void;
}

export function QaCrmTaskDialog({
  open,
  onOpenChange,
  projectId,
  users,
  task,
  onSaved,
}: Props) {
  const isEdit = !!task;
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [partner, setPartner] = useState("");
  const [product, setProduct] = useState("");
  const [issueType, setIssueType] = useState("");
  const [observation, setObservation] = useState("");
  const [expectation, setExpectation] = useState("");
  const [priority, setPriority] = useState<QaPriority>("P1");
  const [status, setStatus] = useState<QaTaskStatus>("open");
  const [eta, setEta] = useState("");
  const [qaComment, setQaComment] = useState("");
  const [ownerId, setOwnerId] = useState("");

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setIssueDate(task.issueDate?.slice(0, 10) ?? "");
      setPartner(task.partner ?? "");
      setProduct(task.product ?? "");
      setIssueType(task.issueType ?? "");
      setObservation(task.observation ?? "");
      setExpectation(task.expectation ?? "");
      setPriority(task.priority);
      setStatus(task.status);
      setEta(task.eta ?? "");
      setQaComment(task.qaComment ?? "");
      setOwnerId(task.ownerId ?? "");
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setTitle("");
      setIssueDate(today);
      setPartner("");
      setProduct("");
      setIssueType("");
      setObservation("");
      setExpectation("");
      setPriority("P1");
      setStatus("open");
      setEta("");
      setQaComment("");
      setOwnerId("");
    }
  }, [open, task]);

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSubmitting(true);
    try {
      const payload: CreateQaProjectTaskInput = {
        title: title.trim(),
        priority,
        status,
        ownerId: ownerId || undefined,
        issueDate: issueDate || null,
        partner: partner.trim() || null,
        product: product.trim() || null,
        issueType: issueType.trim() || null,
        observation: observation.trim() || null,
        expectation: expectation.trim() || null,
        eta: eta.trim() || null,
        qaComment: qaComment.trim() || null,
      };
      const res = task
        ? await updateQaTask(projectId, task.id, payload)
        : await createQaTask(projectId, payload);
      toast.success(task ? "Issue updated" : "Issue created");
      onSaved(res.data);
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save issue";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit QA Issue" : "New QA Issue"}</DialogTitle>
          <DialogDescription>
            Fields mirror the QA team&apos;s Excel template — date, product,
            issue type, observation, expectation, priority, status, ETA,
            comment.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qa-title">Title *</Label>
            <Input
              id="qa-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="One-line summary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qa-date">Date</Label>
              <FormDatePicker value={issueDate} onChange={setIssueDate} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qa-partner">Partner</Label>
              <Input
                id="qa-partner"
                value={partner}
                onChange={(e) => setPartner(e.target.value)}
                placeholder="Counterparty, vendor, partner..."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qa-product">Product</Label>
              <Input
                id="qa-product"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="Mobile, Web, API..."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qa-issue-type">Issue type</Label>
              <Input
                id="qa-issue-type"
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                placeholder="Bug, UX, Perf..."
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qa-observation">Observation</Label>
            <Textarea
              id="qa-observation"
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="What's happening (long-form)"
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qa-expectation">Expectation</Label>
            <Textarea
              id="qa-expectation"
              value={expectation}
              onChange={(e) => setExpectation(e.target.value)}
              placeholder="What should be happening"
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as QaPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as QaTaskStatus)}
              >
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
              <Label htmlFor="qa-eta">ETA</Label>
              <Input
                id="qa-eta"
                value={eta}
                onChange={(e) => setEta(e.target.value)}
                placeholder="EOD, next sprint, 2026-06-01..."
              />
            </div>
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qa-comment">Comment</Label>
            <Textarea
              id="qa-comment"
              value={qaComment}
              onChange={(e) => setQaComment(e.target.value)}
              placeholder="Long-form context, links, repro steps..."
              rows={3}
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
            {isEdit ? "Save Changes" : "Create Issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
