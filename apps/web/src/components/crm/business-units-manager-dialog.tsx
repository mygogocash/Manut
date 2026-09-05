"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Loader2, Plus, Power, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge, type BadgeVariant } from "@/components/shared/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { invalidateBusinessUnitCache } from "@/hooks/use-business-units";
import { ApiError } from "@/lib/api-client";
import {
  type BusinessUnit,
  createBusinessUnit,
  deleteBusinessUnit,
  listBusinessUnits,
  reorderBusinessUnits,
  updateBusinessUnit,
} from "@/services/crm-business-unit.service";

// Chip palette — the shared Badge variant names, not Tailwind classes, so
// every colour resolves through Badge's literal VARIANT_STYLES map and
// survives Tailwind's static scan (CLAUDE.md).
// A const tuple, not BadgeVariant[] — z.enum needs the literal members, and
// `satisfies` still holds us to real Badge variants.
const COLORS = [
  "blue",
  "teal",
  "violet",
  "purple",
  "green",
  "amber",
  "gold",
  "red",
  "grey",
] as const satisfies readonly BadgeVariant[];

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
  color: z.enum(COLORS),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY_FORM: FormValues = { code: "", label: "", color: "blue" };

interface BusinessUnitsManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired after any mutation so the caller can refetch its board. */
  onSaved?: () => void;
}

/**
 * Workspace-admin screen for `crm_business_units` — the Onewave / Onewave
 * Revenue / ARIA tag list. One list serves BOTH Sales CRMs, so edits here
 * show up on `/sales` and `/sales-revenue` alike.
 *
 * Mirrors LostReasonsManagerDialog, with two differences: a colour picker
 * (the tag renders as a chip on every card) and arrow-button reordering
 * instead of a sort-order number box, since the order is what the sidebar's
 * per-unit views are listed in.
 */
export function BusinessUnitsManagerDialog({
  open,
  onOpenChange,
  onSaved,
}: BusinessUnitsManagerDialogProps) {
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BusinessUnit | null>(null);
  const [deleting, setDeleting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_FORM,
  });

  // Inactive rows sink to the bottom; everything else follows the saved
  // order, which is also the order the sidebar lists the per-unit views in.
  const sortedUnits = useMemo(
    () =>
      [...units].sort(
        (a, b) =>
          Number(!a.isActive) - Number(!b.isActive) ||
          a.sortOrder - b.sortOrder ||
          a.label.localeCompare(b.label),
      ),
    [units],
  );

  const fetchUnits = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listBusinessUnits({ includeInactive: true });
      setUnits(res.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load business units";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void fetchUnits();
  }, [open, fetchUnits]);

  useEffect(() => {
    if (!open) {
      form.reset(EMPTY_FORM);
      setDeleteTarget(null);
    }
  }, [open, form]);

  // Every mutation drops the module cache so chips, filters and the sidebar
  // pick the change up without a reload, then tells the caller to refetch.
  function afterMutation() {
    invalidateBusinessUnitCache();
    onSaved?.();
  }

  async function onCreate(values: FormValues) {
    try {
      setSubmitting(true);
      const res = await createBusinessUnit({
        code: values.code,
        label: values.label,
        color: values.color,
      });
      setUnits((prev) => [...prev, res.data]);
      afterMutation();
      form.reset(EMPTY_FORM);
      toast.success(`Business unit "${res.data.label}" created`);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to create business unit";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function patchUnit(
    unit: BusinessUnit,
    input: Parameters<typeof updateBusinessUnit>[1],
    successMessage?: string,
  ) {
    try {
      setSavingId(unit.id);
      const res = await updateBusinessUnit(unit.id, input);
      setUnits((prev) => prev.map((u) => (u.id === unit.id ? res.data : u)));
      afterMutation();
      if (successMessage) toast.success(successMessage);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to update business unit";
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  }

  /**
   * Move one row up or down. Sends the WHOLE visible order so the server
   * renumbers 0..N — sending only the swapped pair would leave the rest of
   * the list carrying its old, now-inconsistent numbers.
   */
  async function move(unit: BusinessUnit, direction: -1 | 1) {
    const ids = sortedUnits.map((u) => u.id);
    const from = ids.indexOf(unit.id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    const next = [...ids];
    [next[from], next[to]] = [next[to] as string, next[from] as string];

    // Optimistic: renumber locally so the row visibly moves at once.
    const previous = units;
    setUnits((prev) =>
      prev.map((u) => {
        const idx = next.indexOf(u.id);
        return idx >= 0 ? { ...u, sortOrder: idx } : u;
      }),
    );
    try {
      setReordering(true);
      await reorderBusinessUnits({ orderedIds: next });
      afterMutation();
    } catch (err) {
      setUnits(previous);
      const message =
        err instanceof ApiError ? err.message : "Failed to reorder";
      toast.error(message);
    } finally {
      setReordering(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteBusinessUnit(deleteTarget.id);
      setUnits((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      afterMutation();
      toast.success(`"${deleteTarget.label}" deleted`);
      setDeleteTarget(null);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to delete business unit";
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
            <DialogTitle>Manage business units</DialogTitle>
            <DialogDescription>
              Workspace-admin only. Business units are the &ldquo;who is taking
              care of this&rdquo; tag on leads, accounts and opportunities —
              Onewave, Onewave Revenue and ARIA to start with. One list serves
              both Sales CRM and ARIA, and the order here is the order the
              sidebar lists the per-unit views in.
            </DialogDescription>
          </DialogHeader>

          <section className="flex flex-col gap-3">
            <p
              className={`
                text-muted-foreground text-[10px] font-bold tracking-widest
                uppercase
              `}
            >
              Add new unit
            </p>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onCreate)}
                className={`
                  grid grid-cols-1 gap-3
                  sm:grid-cols-[160px_1fr_120px_auto]
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
                          placeholder="new-unit"
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
                        <Input placeholder="New Unit" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Chip colour</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COLORS.map((c) => (
                            <SelectItem key={c} value={c}>
                              <Badge variant={c}>{c}</Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                Code is the stable identifier stored on each record and used in
                the <span className="font-mono">?bu=</span> filter link. Label
                is what everyone reads. New units land at the end of the list.
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
              Existing units
            </p>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground size-5 animate-spin" />
              </div>
            ) : sortedUnits.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No business units defined. Cards stay untagged until you add
                one.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {sortedUnits.map((unit, idx) => {
                  const saving = savingId === unit.id || reordering;
                  return (
                    <li
                      key={unit.id}
                      className={`
                        border-border bg-background grid grid-cols-1
                        items-center gap-2 rounded-md border p-2
                        sm:grid-cols-[150px_1fr_120px_auto]
                        ${unit.isActive ? "" : "opacity-60"}
                      `}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px]">
                          {unit.code}
                        </span>
                        {unit.isSystem ? (
                          <Badge variant="grey">System</Badge>
                        ) : null}
                      </div>
                      {unit.isSystem ? (
                        <span className="text-foreground text-sm">
                          {unit.label}
                        </span>
                      ) : (
                        <Input
                          defaultValue={unit.label}
                          className="h-8 text-xs"
                          disabled={saving}
                          onBlur={(e) => {
                            const next = e.target.value.trim();
                            if (!next || next === unit.label) return;
                            void patchUnit(unit, { label: next });
                          }}
                        />
                      )}
                      <Select
                        value={unit.color}
                        disabled={saving}
                        onValueChange={(next) => {
                          if (next === unit.color) return;
                          void patchUnit(unit, { color: next });
                        }}
                      >
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COLORS.map((c) => (
                            <SelectItem key={c} value={c}>
                              <Badge variant={c}>{c}</Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Move up"
                          disabled={saving || idx === 0}
                          onClick={() => void move(unit, -1)}
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Move down"
                          disabled={saving || idx === sortedUnits.length - 1}
                          onClick={() => void move(unit, 1)}
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title={
                            unit.isActive
                              ? "Deactivate (hides it from the pickers; records keep the tag)"
                              : "Reactivate"
                          }
                          disabled={saving}
                          onClick={() =>
                            void patchUnit(
                              unit,
                              { isActive: !unit.isActive },
                              unit.isActive
                                ? `"${unit.label}" deactivated`
                                : `"${unit.label}" reactivated`,
                            )
                          }
                        >
                          <Power
                            className={`
                              size-3.5
                              ${
                                unit.isActive
                                  ? "text-foreground"
                                  : `text-muted-foreground`
                              }
                            `}
                          />
                        </Button>
                        {unit.isSystem ? null : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Delete"
                            disabled={saving}
                            onClick={() => setDeleteTarget(unit)}
                          >
                            <Trash2 className="text-destructive size-3.5" />
                          </Button>
                        )}
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
            <AlertDialogTitle>Delete this business unit?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.label}" (${deleteTarget.code}) will be permanently removed, AND the tag will be stripped from every lead, account and opportunity in both Sales CRMs that currently carries it. This cannot be undone. To keep the history and only hide the unit from the pickers, use the deactivate toggle instead.`
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
