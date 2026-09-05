"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { getProjects, type Project } from "@/services/project.service";
import {
  createProposal,
  PROPOSAL_PRIORITIES,
  PROPOSAL_PRIORITY_LABELS,
  PROPOSAL_TYPE_OPTIONS,
  type ProposalDetail,
  type ProposalType,
  updateProposal,
} from "@/services/proposal.service";

// Raise or correct a proposal.
//
// Creating one submits it: there is no draft state, so the dialog says where it
// is going. Editing is the same form, and the API allows it only while the
// proposal is still with the first reviewer.

// Bounds mirror the API schema, so a rejection is shown inline rather than
// arriving as a 400.
const proposalFormSchema = z.object({
  title: z.string().trim().min(1, "A title is required").max(300),
  description: z
    .string()
    .trim()
    .min(5, "Describe what you are proposing")
    .max(10000),
  type: z.enum(["idea", "change_request", "other"]),
  // "" means "no project" and "none" is the picker's placeholder value; both are
  // sent as null.
  projectId: z.string().optional(),
  priority: z.string().optional(),
});

type ProposalFormValues = z.input<typeof proposalFormSchema>;

const NO_PROJECT = "none";

export interface ProposalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing. Absent means raise a new one. */
  proposal?: ProposalDetail["proposal"] | null;
  onSaved: (id: string) => void;
}

export function ProposalFormDialog({
  open,
  onOpenChange,
  proposal = null,
  onSaved,
}: ProposalFormDialogProps) {
  const editing = proposal !== null;
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  const defaults = useMemo<ProposalFormValues>(
    () => ({
      title: proposal?.title ?? "",
      description: proposal?.description ?? "",
      type: (proposal?.type as ProposalType | undefined) ?? "idea",
      projectId: proposal?.projectId ?? NO_PROJECT,
      priority: proposal?.priority ?? "normal",
    }),
    [proposal],
  );

  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: defaults,
  });

  // Reopening with a different proposal must not show the previous one's values.
  useEffect(() => {
    if (open) form.reset(defaults);
  }, [open, defaults, form]);

  // The project link is optional, so a failure here narrows the form rather than
  // breaking it.
  useEffect(() => {
    if (!open || projects.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await getProjects({ limit: 200 });
        if (!cancelled) setProjects(res.data);
      } catch {
        if (!cancelled) setProjects([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projects.length]);

  async function onSubmit(values: ProposalFormValues) {
    const parsed = proposalFormSchema.parse(values);
    const payload = {
      title: parsed.title,
      description: parsed.description,
      type: parsed.type,
      projectId:
        parsed.projectId && parsed.projectId !== NO_PROJECT
          ? parsed.projectId
          : null,
      priority: parsed.priority || null,
    };

    try {
      setSaving(true);
      if (editing && proposal) {
        await updateProposal(proposal.id, payload);
        toast.success("Proposal updated");
        onSaved(proposal.id);
      } else {
        const res = await createProposal(payload);
        toast.success("Proposal submitted for review");
        onSaved(res.data.id);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit proposal" : "Raise a proposal"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "You can correct this while it is still awaiting first review."
              : "Submitting sends this straight to the reviewer. You can still edit it until they act."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="What is this about, in one line?"
                      disabled={saving}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div
              className={`
                grid gap-4
                sm:grid-cols-2
              `}
            >
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={saving}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROPOSAL_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select
                      value={field.value || "normal"}
                      onValueChange={field.onChange}
                      disabled={saving}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROPOSAL_PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {PROPOSAL_PRIORITY_LABELS[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Related project (optional)</FormLabel>
                  <Select
                    value={field.value || NO_PROJECT}
                    onValueChange={field.onChange}
                    disabled={saving}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Not tied to a project" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_PROJECT}>
                        Not tied to a project
                      </SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Details</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={8}
                      disabled={saving}
                      placeholder={
                        "What are you proposing, why now, and what changes if it happens?"
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-1 size-3.5 animate-spin" />}
                {editing ? "Save changes" : "Submit for review"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
