"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { RemoteAccountPicker } from "@/components/crm/remote-account-picker";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { getAccount, updateAccount } from "@/services/crm-account.service";
import {
  createOpportunity,
  listOpportunityStageConfigs,
  type Opportunity,
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGES,
  type OpportunityStage,
  type OpportunityStageConfig,
  STAGE_PROBABILITY_DEFAULTS,
  updateOpportunity,
} from "@/services/crm-opportunity.service";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  accountId: z.string().min(1, "Account is required"),
  stage: z.enum(OPPORTUNITY_STAGES),
  value: z.string().min(1, "Value is required"),
  currency: z.string().length(3, "Use a 3-letter currency code"),
  probability: z.string().optional().or(z.literal("")),
  closeDate: z.string().optional().or(z.literal("")),
  launchDate: z.string().optional().or(z.literal("")),
  revenueLaunchDate: z.string().optional().or(z.literal("")),
  type: z.string().max(100).optional().or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

interface OpportunityFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity?: Opportunity | null;
  presetAccountId?: string;
  onSaved: () => void;
}

export function OpportunityFormDialog({
  open,
  onOpenChange,
  opportunity,
  presetAccountId,
  onSaved,
}: OpportunityFormDialogProps) {
  const isEditing = !!opportunity;
  const [submitting, setSubmitting] = useState(false);
  // Inline "+ New account" affordance so reps don't have
  // to leave this dialog to create a fresh account.
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: {
      name: "",
      accountId: "",
      stage: "qualified",
      value: "",
      currency: "USD",
      probability: "",
      closeDate: "",
      launchDate: "",
      revenueLaunchDate: "",
      type: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (opportunity) {
      form.reset({
        name: opportunity.name,
        accountId: opportunity.accountId,
        stage: opportunity.stage as OpportunityStage,
        value: String(opportunity.value),
        currency: opportunity.currency,
        // Show the actual probability in the input. probabilityCustom is
        // tracked server-side; the rep doesn't see the flag directly.
        probability: String(opportunity.probability),
        closeDate: opportunity.closeDate
          ? String(opportunity.closeDate).slice(0, 10)
          : "",
        launchDate: opportunity.launchDate
          ? String(opportunity.launchDate).slice(0, 10)
          : "",
        revenueLaunchDate: opportunity.revenueLaunchDate
          ? String(opportunity.revenueLaunchDate).slice(0, 10)
          : "",
        type: opportunity.type ?? "",
        // Notes mirror the linked Account so edits in Pipeline + Accounts stay in
        // sync). Fall back to opportunity.notes only if the account
        // fetch fails so legacy rows whose notes were authored on the
        // opportunity row don't appear blank.
        notes: opportunity.notes ?? "",
      });
      // Hydrate notes from the linked account asynchronously. Pulls
      // the latest text so reps see the same body the Account tab
      // shows.
      void getAccount(opportunity.accountId)
        .then((res) => {
          form.setValue("notes", res.data.notes ?? "");
        })
        .catch(() => {
          // Non-fatal — leave the opportunity.notes fallback in place.
        });
    } else {
      form.reset({
        name: "",
        accountId: presetAccountId ?? "",
        stage: "qualified",
        value: "",
        currency: "USD",
        probability: "",
        closeDate: "",
        launchDate: "",
        revenueLaunchDate: "",
        type: "",
        notes: "",
      });
      // Pre-fill notes from the preset account on create so reps
      // immediately see the existing account-level context.
      if (presetAccountId) {
        void getAccount(presetAccountId)
          .then((res) => {
            form.setValue("notes", res.data.notes ?? "");
          })
          .catch(() => {
            // Non-fatal — empty notes are acceptable for create flow.
          });
      }
    }
  }, [open, opportunity, presetAccountId, form]);

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const probabilityNum = values.probability
        ? Number(values.probability)
        : undefined;

      // Notes are sourced from + persisted to the linked Account so
      // changes here propagate to the Accounts tab and every other
      // opportunity bound to the same account. The opportunity.notes column is still updated
      // for backward compat with reports that read the legacy field.
      const notesValue = values.notes?.trim() ?? "";

      if (isEditing && opportunity) {
        await updateOpportunity(opportunity.id, {
          name: values.name,
          stage: values.stage,
          value: Number(values.value),
          currency: values.currency.toUpperCase(),
          probability: probabilityNum,
          closeDate: values.closeDate || undefined,
          launchDate: values.launchDate || undefined,
          revenueLaunchDate: values.revenueLaunchDate || undefined,
          type: values.type || undefined,
          notes: notesValue || undefined,
        });
        try {
          await updateAccount(opportunity.accountId, {
            notes: notesValue,
          });
        } catch (err) {
          // Account write failure shouldn't roll back the opportunity
          // save, but surface it so the rep knows their notes only
          // landed on this opportunity.
          const message =
            err instanceof ApiError
              ? err.message
              : "Failed to sync notes to the linked account";
          toast.warning(message);
        }
        toast.success("Opportunity updated");
      } else {
        const created = await createOpportunity({
          name: values.name,
          accountId: values.accountId,
          stage: values.stage,
          value: Number(values.value),
          currency: values.currency.toUpperCase(),
          probability: probabilityNum,
          closeDate: values.closeDate || undefined,
          launchDate: values.launchDate || undefined,
          revenueLaunchDate: values.revenueLaunchDate || undefined,
          type: values.type || undefined,
          notes: notesValue || undefined,
        });
        // Mirror notes onto the linked account for symmetry with the
        // edit path above.
        try {
          await updateAccount(created.data.accountId, {
            notes: notesValue,
          });
        } catch (err) {
          const message =
            err instanceof ApiError
              ? err.message
              : "Opportunity created — but notes did not sync to the account";
          toast.warning(message);
        }
        toast.success("Opportunity created");
      }

      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const currentStage = form.watch("stage");

  // Live stage config — admin-editable label + probability per stage.
  // Falls back to the hardcoded constants when the fetch hasn't landed
  // yet, so the form stays usable on cold open.
  const [stageConfigs, setStageConfigs] = useState<OpportunityStageConfig[]>(
    [],
  );
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listOpportunityStageConfigs()
      .then((res) => {
        if (!cancelled) setStageConfigs(res.data);
      })
      .catch(() => {
        // Best-effort — fall through to hardcoded defaults.
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function stageLabel(s: OpportunityStage): string {
    return (
      stageConfigs.find((c) => c.key === s)?.label ??
      OPPORTUNITY_STAGE_LABELS[s]
    );
  }
  function stageProbability(s: OpportunityStage): number {
    return (
      stageConfigs.find((c) => c.key === s)?.probability ??
      STAGE_PROBABILITY_DEFAULTS[s]
    );
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
          max-h-[92vh] overflow-y-auto
          sm:max-w-2xl
        `}
      >
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit opportunity" : "New opportunity"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update details for ${opportunity?.name}.`
              : "Create an opportunity under an existing account. Probability snaps to the stage default unless you set it manually."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            id="opportunity-form"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Acme — Platform Q3" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEditing ? (
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-end justify-between gap-2">
                      <FormLabel>Account *</FormLabel>
                      {!presetAccountId && (
                        <Button
                          type="button"
                          variant="link"
                          size="xs"
                          className="h-auto p-0 text-xs"
                          onClick={() => setAccountDialogOpen(true)}
                          disabled={submitting}
                        >
                          + New account
                        </Button>
                      )}
                    </div>
                    <FormControl>
                      <RemoteAccountPicker
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!!presetAccountId}
                        placeholder="Search accounts…"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <div className="text-muted-foreground text-sm">
                Account: {opportunity?.account.name}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="stage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stage *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select stage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {OPPORTUNITY_STAGES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {stageLabel(s)}
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
                name="probability"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Probability (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        placeholder={String(stageProbability(currentStage))}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {isEditing
                        ? "Leave blank to keep the current value. Editing locks the auto-default for future stage moves."
                        : "Leave blank to snap to the stage default."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Value *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency *</FormLabel>
                    <FormControl>
                      <Input
                        maxLength={3}
                        placeholder="USD"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="closeDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected close date</FormLabel>
                    <FormControl>
                      <FormDatePicker {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="launchDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Launch date</FormLabel>
                    <FormControl>
                      <FormDatePicker {...field} />
                    </FormControl>
                    <FormDescription>
                      When the partner actually goes live (often after the
                      contract closes).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="revenueLaunchDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Revenue launch date</FormLabel>
                    <FormControl>
                      <FormDatePicker {...field} />
                    </FormControl>
                    <FormDescription>
                      When the deal starts producing booked revenue (often weeks
                      after the soft launch).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. SaaS, Services" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Internal notes about this opportunity…"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="opportunity-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEditing ? "Save changes" : "Create opportunity"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AccountFormDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
        onSaved={(account) => {
          // Auto-select the freshly created account inside the opportunity
          // form so the rep can keep typing without re-searching.
          if (account?.id) {
            form.setValue("accountId", account.id, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }
        }}
      />
    </Dialog>
  );
}
