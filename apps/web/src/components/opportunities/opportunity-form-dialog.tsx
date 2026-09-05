"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import {
  BusinessUnitStageTable,
  rollUpStage,
  type UnitStageRow,
} from "@/components/crm/business-unit-stage-table";
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
import { useBusinessUnits } from "@/hooks/use-business-units";
import { ApiError } from "@/lib/api-client";
import { getAccount, updateAccount } from "@/services/crm-account.service";
import {
  createOpportunity,
  listDealBusinessUnits,
  listOpportunityStageConfigs,
  moveBusinessUnitCard,
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
  // Multi-select: which business unit(s) are taking care of this deal.
  businessUnits: z.array(z.string()),
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
  // BD-feedback — inline "+ New account" affordance so reps don't have
  // to leave this dialog to create a fresh account.
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
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
      businessUnits: [],
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
        businessUnits: opportunity.businessUnits ?? [],
        // Notes mirror the linked Account (Vivek BD-feedback,
        // 2026-05-25 — edits in Pipeline + Accounts must stay in
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
        businessUnits: [],
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
      // opportunity bound to the same account (Vivek BD-feedback,
      // 2026-05-25). The opportunity.notes column is still updated
      // for backward compat with reports that read the legacy field.
      const notesValue = values.notes?.trim() ?? "";

      // Tags come from the table now — it is the only place units are added
      // or removed, so deriving them here keeps one source of truth.
      const unitCodes = unitRows.map((r) => r.businessUnit);
      // With units present the deal's stage is DERIVED, so send the roll-up
      // rather than the (read-only) form field. The server recomputes it
      // anyway; sending the stale field would just lose a race with itself.
      const dealStage = (rolledUpStage ?? values.stage) as OpportunityStage;

      // Only units whose stage actually changed. Moving every unit would
      // reset sortOrderWithinStage on rows nobody touched and reshuffle the
      // board under the rep.
      const baseline = new Map(
        loadedRows.map((r) => [r.businessUnit, r.stage]),
      );
      const movedUnits = unitRows.filter(
        (r) =>
          baseline.has(r.businessUnit) &&
          baseline.get(r.businessUnit) !== r.stage,
      );

      async function applyUnitStages(opportunityId: string) {
        for (const row of movedUnits) {
          try {
            await moveBusinessUnitCard(opportunityId, row.businessUnit, {
              stage: row.stage as OpportunityStage,
            });
          } catch (err) {
            // The deal itself already saved; surface the unit that did not so
            // the rep knows which one to retry rather than assuming all of it
            // failed.
            const message =
              err instanceof ApiError
                ? err.message
                : `Could not move ${row.businessUnit}`;
            toast.warning(message);
          }
        }
      }

      if (isEditing && opportunity) {
        await updateOpportunity(opportunity.id, {
          name: values.name,
          stage: dealStage,
          value: Number(values.value),
          currency: values.currency.toUpperCase(),
          probability: probabilityNum,
          closeDate: values.closeDate || undefined,
          launchDate: values.launchDate || undefined,
          revenueLaunchDate: values.revenueLaunchDate || undefined,
          type: values.type || undefined,
          notes: notesValue || undefined,
          businessUnits: unitCodes,
        });
        // AFTER the deal write: a unit added in this same save has no row
        // until the deal's tags land, and the server seeds it then.
        await applyUnitStages(opportunity.id);
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
          stage: dealStage,
          value: Number(values.value),
          currency: values.currency.toUpperCase(),
          probability: probabilityNum,
          closeDate: values.closeDate || undefined,
          launchDate: values.launchDate || undefined,
          revenueLaunchDate: values.revenueLaunchDate || undefined,
          type: values.type || undefined,
          notes: notesValue || undefined,
          businessUnits: unitCodes,
        });
        // A new deal is seeded from itself, so every unit starts at
        // `dealStage`; move the ones the rep set higher.
        for (const row of unitRows) {
          if (row.stage === dealStage) continue;
          try {
            await moveBusinessUnitCard(created.data.id, row.businessUnit, {
              stage: row.stage as OpportunityStage,
            });
          } catch {
            toast.warning(
              `Created — but ${row.businessUnit} kept its default stage`,
            );
          }
        }
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

  // Only ACTIVE units are offered; a record already tagged with a
  // deactivated unit keeps it until someone edits the selection.
  const { units: businessUnitRows } = useBusinessUnits();
  const businessUnitOptions = businessUnitRows.map((u) => ({
    code: u.code,
    label: u.label,
  }));

  // Stage per business unit. `unitRows` is what the rep edits; `loadedRows`
  // is the baseline so submit can move only the units that actually changed —
  // moving every unit would rewrite sortOrderWithinStage on rows nobody
  // touched, reshuffling the board.
  const [unitRows, setUnitRows] = useState<UnitStageRow[]>([]);
  const [loadedRows, setLoadedRows] = useState<UnitStageRow[]>([]);

  useEffect(() => {
    if (!open) return;
    if (!opportunity) {
      setUnitRows([]);
      setLoadedRows([]);
      return;
    }
    let cancelled = false;
    // Seed from the deal's tags first so the table renders immediately, then
    // fill in each unit's real stage. The API routes this through getById, so
    // a deal untouched since the per-unit migration still returns one row per
    // tag rather than an empty list.
    const fallback = (opportunity.businessUnits ?? []).map((code) => ({
      businessUnit: code,
      stage: opportunity.stage,
    }));
    setUnitRows(fallback);
    setLoadedRows(fallback);
    listDealBusinessUnits(opportunity.id)
      .then((res) => {
        if (cancelled) return;
        const rows = res.data.map((r) => ({
          businessUnit: r.businessUnit,
          stage: r.stage as string,
        }));
        setUnitRows(rows);
        setLoadedRows(rows);
      })
      .catch(() => {
        // Best-effort — the tag-derived fallback above stays on screen.
      });
    return () => {
      cancelled = true;
    };
  }, [open, opportunity]);

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
  // Catalog sort order, so the read-only roll-up this dialog shows is the one
  // computeOpportunityRollup will store. Falls back to the canonical order
  // when the config fetch has not landed.
  function stageSortOrder(s: string): number {
    const configured = stageConfigs.find((c) => c.key === s)?.sortOrder;
    if (typeof configured === "number") return configured;
    const idx = OPPORTUNITY_STAGES.indexOf(s as OpportunityStage);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx * 10;
  }

  const rolledUpStage = rollUpStage(unitRows, stageSortOrder);
  const firstStage =
    [...OPPORTUNITY_STAGES].sort(
      (a, b) => stageSortOrder(a) - stageSortOrder(b),
    )[0] ?? "qualified";

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
                    {rolledUpStage ? (
                      // Derived, not typed. The deal still HAS a stage — the
                      // list, exports and reports read it — but with units
                      // present it is the least-advanced unit's, so an
                      // editable field here would be a second source of truth
                      // that silently disagrees with the board.
                      <div
                        className={`
                          border-border bg-muted/40 text-muted-foreground flex
                          h-9 items-center rounded-md border border-dashed px-3
                          text-sm
                        `}
                      >
                        {stageLabel(rolledUpStage as OpportunityStage)}
                      </div>
                    ) : (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
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
                    )}
                    <FormDescription>
                      {rolledUpStage
                        ? "Rolls up from the business units below — the least advanced one."
                        : "This deal has no business units, so it carries a single stage."}
                    </FormDescription>
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

            <FormItem>
              <BusinessUnitStageTable
                options={businessUnitOptions}
                rows={unitRows}
                onChange={setUnitRows}
                stages={OPPORTUNITY_STAGES}
                stageLabel={(s) => stageLabel(s as OpportunityStage)}
                stageProbability={(s) =>
                  stageProbability(s as OpportunityStage)
                }
                firstStage={firstStage}
                disabled={submitting}
              />
              <FormDescription>
                Who is taking care of this deal, and how far along each one is.
                Leave it empty and the deal shows under
                &ldquo;Unassigned&rdquo;.
              </FormDescription>
            </FormItem>

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
