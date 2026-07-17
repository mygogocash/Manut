"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
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
import { invalidateLeadSourceCache } from "@/hooks/use-revenue-lead-sources";
import { ApiError } from "@/lib/api-client";
import {
  createLeadSource,
  deleteLeadSource,
  type LeadSource,
  listLeadSources,
  updateLeadSource,
} from "@/services/revenue-lead-source.service";

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
    .number<number | string>()
    .int()
    .min(0)
    .max(9999, "Sort order must be 0-9999"),
});

type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

interface LeadSourcesManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Workspace-admin screen for managing the crm_lead_sources lookup
// Lists every source including deactivated rows so
// admins can re-enable; system rows are protected — they can be
// reordered or deactivated, never deleted or relabeled.
export function LeadSourcesManagerDialog({
  open,
  onOpenChange,
}: LeadSourcesManagerDialogProps) {
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadSource | null>(null);
  const [deleting, setDeleting] = useState(false);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: { code: "", label: "", sortOrder: 100 },
  });

  const sortedSources = useMemo(
    () =>
      [...sources].sort(
        (a, b) =>
          Number(!a.isActive) - Number(!b.isActive) ||
          a.sortOrder - b.sortOrder ||
          a.label.localeCompare(b.label),
      ),
    [sources],
  );

  const fetchSources = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listLeadSources({ includeInactive: true });
      setSources(res.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load lead sources";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void fetchSources();
  }, [open, fetchSources]);

  useEffect(() => {
    if (!open) {
      form.reset({ code: "", label: "", sortOrder: 100 });
      setDeleteTarget(null);
    }
  }, [open, form]);

  async function onCreate(values: FormValues) {
    try {
      setSubmitting(true);
      const res = await createLeadSource({
        code: values.code,
        label: values.label,
        sortOrder: values.sortOrder,
      });
      setSources((prev) => [...prev, res.data]);
      invalidateLeadSourceCache();
      form.reset({ code: "", label: "", sortOrder: 100 });
      toast.success(`Source "${res.data.label}" created`);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to create source";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(source: LeadSource) {
    try {
      setSavingId(source.id);
      const res = await updateLeadSource(source.id, {
        isActive: !source.isActive,
      });
      setSources((prev) =>
        prev.map((s) => (s.id === source.id ? res.data : s)),
      );
      invalidateLeadSourceCache();
      toast.success(
        res.data.isActive
          ? `"${res.data.label}" reactivated`
          : `"${res.data.label}" deactivated`,
      );
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update source";
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  }

  async function saveSortOrder(source: LeadSource, nextSortOrder: number) {
    if (nextSortOrder === source.sortOrder) return;
    try {
      setSavingId(source.id);
      const res = await updateLeadSource(source.id, {
        sortOrder: nextSortOrder,
      });
      setSources((prev) =>
        prev.map((s) => (s.id === source.id ? res.data : s)),
      );
      invalidateLeadSourceCache();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update sort order";
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  }

  async function saveLabel(source: LeadSource, nextLabel: string) {
    if (nextLabel === source.label || !nextLabel.trim()) return;
    try {
      setSavingId(source.id);
      const res = await updateLeadSource(source.id, { label: nextLabel });
      setSources((prev) =>
        prev.map((s) => (s.id === source.id ? res.data : s)),
      );
      invalidateLeadSourceCache();
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
      await deleteLeadSource(deleteTarget.id);
      setSources((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      invalidateLeadSourceCache();
      toast.success(`"${deleteTarget.label}" deleted`);
      setDeleteTarget(null);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete source";
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
            <DialogTitle>Manage lead sources</DialogTitle>
            <DialogDescription>
              Workspace-admin only. Add custom sources, reorder them, or
              deactivate rows you no longer want reps to pick. System sources
              (web, referral, conference, partner, cold, other) can be reordered
              or deactivated but not deleted or relabeled.
            </DialogDescription>
          </DialogHeader>

          <section className="flex flex-col gap-3">
            <p
              className={`
                text-muted-foreground text-[10px] font-bold tracking-widest
                uppercase
              `}
            >
              Add new source
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
                          placeholder="webinar"
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
                        <Input placeholder="Webinar attendee" {...field} />
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
                Code is the stable identifier stored on every Lead row — keep it
                lowercase and short. Label is what reps see in the picker.
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
              Existing sources
            </p>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground size-5 animate-spin" />
              </div>
            ) : sortedSources.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No sources defined.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {sortedSources.map((source) => {
                  const saving = savingId === source.id;
                  const canDelete = !source.isSystem;
                  const canRelabel = !source.isSystem;
                  return (
                    <li
                      key={source.id}
                      className={`
                        border-border bg-background grid grid-cols-1
                        items-center gap-2 rounded-md border p-2
                        sm:grid-cols-[140px_1fr_80px_auto]
                        ${source.isActive ? "" : "opacity-60"}
                      `}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px]">
                          {source.code}
                        </span>
                        {source.isSystem ? (
                          <Badge variant="grey">System</Badge>
                        ) : null}
                      </div>
                      {canRelabel ? (
                        <Input
                          defaultValue={source.label}
                          className="h-8 text-xs"
                          disabled={saving}
                          onBlur={(e) => saveLabel(source, e.target.value)}
                        />
                      ) : (
                        <span className="text-foreground text-sm">
                          {source.label}
                        </span>
                      )}
                      <Input
                        type="number"
                        defaultValue={source.sortOrder}
                        min={0}
                        max={9999}
                        disabled={saving}
                        className={`h-8 text-xs tabular-nums`}
                        onBlur={(e) =>
                          saveSortOrder(source, Number(e.target.value))
                        }
                      />
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title={source.isActive ? "Deactivate" : "Reactivate"}
                          disabled={saving}
                          onClick={() => toggleActive(source)}
                        >
                          <Power
                            className={`
                              size-3.5
                              ${
                                source.isActive
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
                            onClick={() => setDeleteTarget(source)}
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
            <AlertDialogTitle>Delete this source?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.label}" (${deleteTarget.code}) will be permanently removed. This is blocked when any lead still references the code — deactivate instead to keep historical attribution intact.`
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
