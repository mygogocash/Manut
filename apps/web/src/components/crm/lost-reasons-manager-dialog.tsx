"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Power, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/shared/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { invalidateLostReasonCache } from "@/hooks/use-lost-reasons";
import { ApiError } from "@/lib/api-client";
import {
  createLostReason,
  deleteLostReason,
  listLostReasons,
  type LostReason,
  updateLostReason,
} from "@/services/crm-lost-reason.service";

const formSchema = z.object({
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(50, "Code must be 50 characters or fewer")
    .regex(
      /^[a-z][a-z0-9-]*$/,
      "Lowercase letters / digits / hyphens only; must start with a letter",
    ),
  label: z.string().min(1, "Label is required").max(100),
  sortOrder: z.coerce
    .number()
    .int()
    .min(0)
    .max(9999, "Sort order must be 0-9999"),
});

type FormValues = z.infer<typeof formSchema>;

interface LostReasonsManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Workspace-admin screen for the crm_lost_reasons lookup (PRD §11.7).
// Mirrors LeadSourcesManagerDialog. System rows are protected — they
// can be reordered or deactivated, never deleted or relabeled.
export function LostReasonsManagerDialog({
  open,
  onOpenChange,
}: LostReasonsManagerDialogProps) {
  const [reasons, setReasons] = useState<LostReason[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LostReason | null>(null);
  const [deleting, setDeleting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { code: "", label: "", sortOrder: 100 },
  });

  const sortedReasons = useMemo(
    () =>
      [...reasons].sort(
        (a, b) =>
          Number(!a.isActive) - Number(!b.isActive) ||
          a.sortOrder - b.sortOrder ||
          a.label.localeCompare(b.label),
      ),
    [reasons],
  );

  const fetchReasons = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listLostReasons({ includeInactive: true });
      setReasons(res.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load lost reasons";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void fetchReasons();
  }, [open, fetchReasons]);

  useEffect(() => {
    if (!open) {
      form.reset({ code: "", label: "", sortOrder: 100 });
      setDeleteTarget(null);
    }
  }, [open, form]);

  async function onCreate(values: FormValues) {
    try {
      setSubmitting(true);
      const res = await createLostReason({
        code: values.code,
        label: values.label,
        sortOrder: values.sortOrder,
      });
      setReasons((prev) => [...prev, res.data]);
      invalidateLostReasonCache();
      form.reset({ code: "", label: "", sortOrder: 100 });
      toast.success(`Reason "${res.data.label}" created`);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to create reason";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(reason: LostReason) {
    try {
      setSavingId(reason.id);
      const res = await updateLostReason(reason.id, {
        isActive: !reason.isActive,
      });
      setReasons((prev) =>
        prev.map((r) => (r.id === reason.id ? res.data : r)),
      );
      invalidateLostReasonCache();
      toast.success(
        res.data.isActive
          ? `"${res.data.label}" reactivated`
          : `"${res.data.label}" deactivated`,
      );
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update reason";
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  }

  async function saveSortOrder(reason: LostReason, nextSortOrder: number) {
    if (nextSortOrder === reason.sortOrder) return;
    try {
      setSavingId(reason.id);
      const res = await updateLostReason(reason.id, {
        sortOrder: nextSortOrder,
      });
      setReasons((prev) =>
        prev.map((r) => (r.id === reason.id ? res.data : r)),
      );
      invalidateLostReasonCache();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update sort order";
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  }

  async function saveLabel(reason: LostReason, nextLabel: string) {
    if (nextLabel === reason.label || !nextLabel.trim()) return;
    try {
      setSavingId(reason.id);
      const res = await updateLostReason(reason.id, { label: nextLabel });
      setReasons((prev) =>
        prev.map((r) => (r.id === reason.id ? res.data : r)),
      );
      invalidateLostReasonCache();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update label";
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteLostReason(deleteTarget.id);
      setReasons((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      invalidateLostReasonCache();
      toast.success(`"${deleteTarget.label}" deleted`);
      setDeleteTarget(null);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete reason";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={`
            max-h-[92vh] overflow-y-auto
            sm:max-w-2xl
          `}
        >
          <DialogHeader>
            <DialogTitle>Manage lost reasons</DialogTitle>
            <DialogDescription>
              Workspace-admin only. Add custom reasons reps can pick when
              closing an opportunity as lost. System reasons (no-budget,
              no-decision-maker, lost-to-competitor, no-response, bad-fit,
              timing, other) can be reordered or deactivated but not deleted or
              relabeled.
            </DialogDescription>
          </DialogHeader>

          <section className="flex flex-col gap-3">
            <p
              className={`
                text-muted-foreground text-[10px] font-bold tracking-widest
                uppercase
              `}
            >
              Add new reason
            </p>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onCreate)}
                className={`
                  grid grid-cols-1 gap-3
                  sm:grid-cols-[140px_1fr_100px_auto]
                `}
              >
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="price-too-high"
                          className="font-mono text-xs"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Label</FormLabel>
                      <FormControl>
                        <Input placeholder="Price too high" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Order</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={9999}
                          className="text-xs tabular-nums"
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-end">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full"
                  >
                    {submitting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
                    Add
                  </Button>
                </div>
              </form>
              <FormDescription className="text-[11px]">
                Code is the stable identifier persisted on the Opportunity row
                when reps mark a deal lost. Label is what reps see in the
                picker.
              </FormDescription>
            </Form>
          </section>

          <section className="flex flex-col gap-2">
            <p
              className={`
                text-muted-foreground text-[10px] font-bold tracking-widest
                uppercase
              `}
            >
              Existing reasons
            </p>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground size-5 animate-spin" />
              </div>
            ) : sortedReasons.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No reasons defined.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {sortedReasons.map((reason) => {
                  const saving = savingId === reason.id;
                  const canDelete = !reason.isSystem;
                  const canRelabel = !reason.isSystem;
                  return (
                    <li
                      key={reason.id}
                      className={`
                        border-border bg-background grid grid-cols-1
                        items-center gap-2 rounded-md border p-2
                        sm:grid-cols-[160px_1fr_80px_auto]
                        ${reason.isActive ? "" : "opacity-60"}
                      `}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px]">
                          {reason.code}
                        </span>
                        {reason.isSystem ? (
                          <Badge variant="grey">System</Badge>
                        ) : null}
                      </div>
                      {canRelabel ? (
                        <Input
                          defaultValue={reason.label}
                          className="h-8 text-xs"
                          disabled={saving}
                          onBlur={(e) => saveLabel(reason, e.target.value)}
                        />
                      ) : (
                        <span className="text-foreground text-sm">
                          {reason.label}
                        </span>
                      )}
                      <Input
                        type="number"
                        defaultValue={reason.sortOrder}
                        min={0}
                        max={9999}
                        disabled={saving}
                        className={`h-8 text-xs tabular-nums`}
                        onBlur={(e) =>
                          saveSortOrder(reason, Number(e.target.value))
                        }
                      />
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title={reason.isActive ? "Deactivate" : "Reactivate"}
                          disabled={saving}
                          onClick={() => toggleActive(reason)}
                        >
                          <Power
                            className={`
                              size-3.5
                              ${
                                reason.isActive
                                  ? "text-foreground"
                                  : `text-muted-foreground`
                              }
                            `}
                          />
                        </Button>
                        {canDelete ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Delete"
                            disabled={saving}
                            onClick={() => setDeleteTarget(reason)}
                          >
                            <Trash2 className="text-destructive size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(next) => {
          if (!deleting && !next) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this reason?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.label}" (${deleteTarget.code}) will be permanently removed. Opportunity rows that already reference the code keep their stored value — they just render the raw code on the detail sheet.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
