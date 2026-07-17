"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2, X } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  CASH_ADVANCE_PAYOUT_LABELS,
  CASH_ADVANCE_PAYOUT_MODES,
  type CashAdvanceApprovalStep,
  type CashAdvancePayoutMode,
  createCashAdvanceStep,
  updateCashAdvanceStep,
} from "@/services/cash-advance.service";
import type { UserListItem } from "@/services/user.service";

const stepSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100),
    description: z.string().max(500).optional(),
    approverType: z.enum(["manager", "user"]),
    approverUserId: z.string().uuid().optional().nullable(),
    skipWhenSubmitterIds: z.array(z.string().uuid()),
    onlyWhenSubmitterIds: z.array(z.string().uuid()),
    payoutModeFilter: z.array(z.enum(CASH_ADVANCE_PAYOUT_MODES)),
    amountMin: z.string(),
    amountMax: z.string(),
    isActive: z.boolean(),
  })
  .refine((v) => v.approverType !== "user" || !!v.approverUserId, {
    message: "Pick an approver",
    path: ["approverUserId"],
  })
  .refine(
    (v) =>
      !v.amountMin ||
      !v.amountMax ||
      Number(v.amountMin) <= Number(v.amountMax),
    { message: "Min must be ≤ max", path: ["amountMax"] },
  );

type StepFormValues = z.infer<typeof stepSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: CashAdvanceApprovalStep | null;
  users: UserListItem[];
  onSaved: () => void;
}

export function CashAdvanceApprovalStepDialog({
  open,
  onOpenChange,
  step,
  users,
  onSaved,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const editing = Boolean(step);

  const form = useForm<StepFormValues>({
    resolver: standardSchemaResolver(stepSchema),
    defaultValues: {
      name: "",
      description: "",
      approverType: "manager",
      approverUserId: null,
      skipWhenSubmitterIds: [],
      onlyWhenSubmitterIds: [],
      payoutModeFilter: [],
      amountMin: "",
      amountMax: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      step
        ? {
            name: step.name,
            description: step.description ?? "",
            approverType: step.approverType,
            approverUserId: step.approverUserId,
            skipWhenSubmitterIds: step.skipWhenSubmitterIds ?? [],
            onlyWhenSubmitterIds: step.onlyWhenSubmitterIds ?? [],
            payoutModeFilter: step.payoutModeFilter ?? [],
            amountMin: step.amountMin != null ? String(step.amountMin) : "",
            amountMax: step.amountMax != null ? String(step.amountMax) : "",
            isActive: step.isActive,
          }
        : {
            name: "",
            description: "",
            approverType: "manager",
            approverUserId: null,
            skipWhenSubmitterIds: [],
            onlyWhenSubmitterIds: [],
            payoutModeFilter: [],
            amountMin: "",
            amountMax: "",
            isActive: true,
          },
    );
  }, [open, step, form]);

  const approverType = form.watch("approverType");

  async function onSubmit(values: StepFormValues) {
    try {
      setSubmitting(true);
      const payload = {
        name: values.name,
        description: values.description?.trim() || null,
        approverType: values.approverType,
        approverUserId:
          values.approverType === "user" ? values.approverUserId : null,
        skipWhenSubmitterIds: values.skipWhenSubmitterIds,
        onlyWhenSubmitterIds: values.onlyWhenSubmitterIds,
        payoutModeFilter: values.payoutModeFilter,
        amountMin: values.amountMin === "" ? null : Number(values.amountMin),
        amountMax: values.amountMax === "" ? null : Number(values.amountMax),
        isActive: values.isActive,
      };
      if (step) {
        await updateCashAdvanceStep(step.id, payload);
        toast.success(`Step "${payload.name}" updated`);
      } else {
        await createCashAdvanceStep(payload);
        toast.success(`Step "${payload.name}" created`);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save step",
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
          flex max-h-[90vh] flex-col overflow-hidden
          sm:max-w-lg
        `}
      >
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit approval step" : "Add approval step"}
          </DialogTitle>
          <DialogDescription>
            Manager steps route to the submitter&apos;s direct manager; user
            steps route to one specific person. Conditions decide when a step
            applies.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="ca-approval-step-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="-mr-2 flex-1 space-y-4 overflow-y-auto pr-2"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Manager approval" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="What this approver checks."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="approverType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Approver type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="manager">
                        Submitter&apos;s manager
                      </SelectItem>
                      <SelectItem value="user">Specific user</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {approverType === "user" && (
              <FormField
                control={form.control}
                name="approverUserId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Approver</FormLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => field.onChange(v || null)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name} — {u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="skipWhenSubmitterIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Skip when submitter is</FormLabel>
                  <FormDescription>
                    Submitters who should not trigger this step (e.g. don&apos;t
                    make a manager approve their own request).
                  </FormDescription>
                  <FormControl>
                    <UserMultiSelect
                      users={users}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Pick submitters to skip…"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="onlyWhenSubmitterIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Only when submitter is</FormLabel>
                  <FormDescription>
                    When set, this step only fires for these submitters. Empty =
                    applies to everyone.
                  </FormDescription>
                  <FormControl>
                    <UserMultiSelect
                      users={users}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Empty = applies to everyone"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payoutModeFilter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apply only to payout modes</FormLabel>
                  <FormDescription>
                    Limits this step to the chosen payout modes. Empty = any
                    payout mode.
                  </FormDescription>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {CASH_ADVANCE_PAYOUT_MODES.map((mode) => {
                        const checked = field.value.includes(mode);
                        return (
                          <button
                            type="button"
                            key={mode}
                            onClick={() => {
                              const next: CashAdvancePayoutMode[] = checked
                                ? field.value.filter((m) => m !== mode)
                                : [...field.value, mode];
                              field.onChange(next);
                            }}
                            className={
                              checked
                                ? `
                                  bg-primary text-primary-foreground rounded-md
                                  border px-2.5 py-1 text-xs
                                `
                                : `
                                  border-border bg-background rounded-md border
                                  px-2.5 py-1 text-xs
                                `
                            }
                          >
                            {CASH_ADVANCE_PAYOUT_LABELS[mode]}
                          </button>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div
              className={`
                grid grid-cols-1 gap-3
                sm:grid-cols-2
              `}
            >
              <FormField
                control={form.control}
                name="amountMin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="—"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Empty = no lower bound.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amountMax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="—"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Compared against the requested total in the request&apos;s
                      own currency.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem
                  className={`
                    flex items-center justify-between rounded-md border p-4
                  `}
                >
                  <div>
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Inactive steps stay configured but are skipped on new
                      submissions.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="ca-approval-step-form"
            disabled={submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Add step"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserMultiSelect({
  users,
  value,
  onChange,
  placeholder,
}: {
  users: UserListItem[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => !value.includes(u.id))
      .filter((u) =>
        q
          ? u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q)
          : true,
      )
      .slice(0, 50);
  }, [users, value, query]);

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((id) => {
            const u = userById.get(id);
            return (
              <span
                key={id}
                className={`
                  bg-primary/10 inline-flex items-center gap-1 rounded-md px-2
                  py-0.5 text-[11px]
                `}
              >
                {u?.name ?? id}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((v) => v !== id))}
                  className="hover:text-destructive"
                  aria-label={`Remove ${u?.name ?? id}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div className="relative">
        <Input
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        />
        {open && filtered.length > 0 && (
          <div
            className={`
              border-border bg-popover absolute top-full z-10 mt-1 max-h-56
              w-full overflow-y-auto rounded-md border shadow-md
            `}
          >
            {filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (!value.includes(u.id)) onChange([...value, u.id]);
                  setQuery("");
                }}
                className={`
                  hover:bg-accent
                  w-full px-2 py-1 text-left text-[12px]
                `}
              >
                <span className="font-medium">{u.name}</span>{" "}
                <span className="text-muted-foreground">{u.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
