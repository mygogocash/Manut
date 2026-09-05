"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormDatePicker } from "@/components/shared/form-date-picker";
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
import { ApiError } from "@/lib/api-client";
import {
  createExchangeRate,
  deleteExchangeRate,
  type ExchangeRate,
  listExchangeRates,
  syncExchangeRatesFromBot,
  updateExchangeRate,
} from "@/services/exchange-rate.service";

const isoCode = z
  .string()
  .length(3, "Use a 3-letter ISO code")
  .regex(/^[A-Za-z]{3}$/, "Letters only")
  .transform((v) => v.toUpperCase());

const formSchema = z
  .object({
    baseCurrency: isoCode,
    currency: isoCode,
    rate: z.coerce.number().positive("Rate must be greater than zero"),
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
    source: z.string().max(50).optional(),
  })
  .refine((d) => d.baseCurrency !== d.currency, {
    message: "Base currency cannot equal target",
    path: ["currency"],
  });

type FormValues = z.infer<typeof formSchema>;

interface ExchangeRatesManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Fired after a successful mutation so callers (e.g. forecast banner)
  // can refetch the rolled-up totals.
  onMutated?: () => void;
}

export function ExchangeRatesManagerDialog({
  open,
  onOpenChange,
  onMutated,
}: ExchangeRatesManagerDialogProps) {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExchangeRate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      baseCurrency: "USD",
      currency: "",
      rate: 0,
      effectiveDate: format(new Date(), "yyyy-MM-dd"),
      source: "manual",
    },
  });

  const sortedRates = useMemo(
    () =>
      [...rates].sort((a, b) => {
        if (a.baseCurrency !== b.baseCurrency) {
          return a.baseCurrency.localeCompare(b.baseCurrency);
        }
        if (a.currency !== b.currency) {
          return a.currency.localeCompare(b.currency);
        }
        return (
          new Date(b.effectiveDate).getTime() -
          new Date(a.effectiveDate).getTime()
        );
      }),
    [rates],
  );

  const fetchRates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listExchangeRates({ latestOnly: false });
      setRates(res.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load exchange rates";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSyncBot = useCallback(async () => {
    if (syncing) return;
    try {
      setSyncing(true);
      const res = await syncExchangeRatesFromBot();
      const r = res.data;
      if (!r.configured) {
        toast.error(
          "Bank of Thailand sync isn't configured yet (BOT_API_CLIENT_ID).",
        );
        return;
      }
      const parts = [`${r.synced.length} synced`];
      if (r.skipped.length) parts.push(`${r.skipped.length} skipped`);
      // Named explicitly: the sync now leaves hand-corrected rates alone, and
      // without this an admin sees "0 synced" with no idea it was deliberate.
      if (r.preserved?.length) {
        parts.push(`${r.preserved.length} kept (edited by hand)`);
      }
      if (r.errors.length) parts.push(`${r.errors.length} failed`);
      toast.success(`BOT sync: ${parts.join(", ")}`);
      void fetchRates();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to sync from BOT";
      toast.error(message);
    } finally {
      setSyncing(false);
    }
  }, [syncing, fetchRates]);

  useEffect(() => {
    if (!open) return;
    void fetchRates();
  }, [open, fetchRates]);

  useEffect(() => {
    if (!open) {
      form.reset({
        baseCurrency: "USD",
        currency: "",
        rate: 0,
        effectiveDate: format(new Date(), "yyyy-MM-dd"),
        source: "manual",
      });
      setDeleteTarget(null);
    }
  }, [open, form]);

  async function onCreate(values: FormValues) {
    try {
      setSubmitting(true);
      const res = await createExchangeRate({
        baseCurrency: values.baseCurrency,
        currency: values.currency,
        rate: values.rate,
        effectiveDate: values.effectiveDate,
        source: values.source || undefined,
      });
      setRates((prev) => [res.data, ...prev]);
      onMutated?.();
      form.reset({
        baseCurrency: values.baseCurrency,
        currency: "",
        rate: 0,
        effectiveDate: values.effectiveDate,
        source: values.source ?? "manual",
      });
      toast.success(
        `Rate ${res.data.baseCurrency} → ${res.data.currency} added`,
      );
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to create rate";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveRate(rate: ExchangeRate, nextValue: number) {
    if (Number.isNaN(nextValue) || nextValue <= 0) return;
    if (Number(rate.rate) === nextValue) return;
    try {
      setSavingId(rate.id);
      const res = await updateExchangeRate(rate.id, { rate: nextValue });
      setRates((prev) => prev.map((r) => (r.id === rate.id ? res.data : r)));
      onMutated?.();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update rate";
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteExchangeRate(deleteTarget.id);
      setRates((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      onMutated?.();
      toast.success(
        `Rate ${deleteTarget.baseCurrency} → ${deleteTarget.currency} deleted`,
      );
      setDeleteTarget(null);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete rate";
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
            sm:max-w-3xl
          `}
        >
          <DialogHeader>
            <DialogTitle>Manage exchange rates</DialogTitle>
            <DialogDescription>
              Workspace-admin only. Rates store{" "}
              <code className="font-mono">
                1 baseCurrency = rate × currency
              </code>
              . The Sales CRM forecast picks the freshest row per pair and also
              resolves inverse paths automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">
              Pull live rates (THB per foreign unit) from the Bank of Thailand,
              or add a rate manually below.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSyncBot}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Sync from BOT
            </Button>
          </div>

          <section className="flex flex-col gap-3">
            <p
              className={`
                text-muted-foreground text-[10px] font-bold tracking-widest
                uppercase
              `}
            >
              Add new rate
            </p>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onCreate)}
                className={`
                  grid grid-cols-1 gap-3
                  sm:grid-cols-[80px_80px_120px_140px_120px_auto]
                `}
              >
                <FormField
                  control={form.control}
                  name="baseCurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">From</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="USD"
                          className="font-mono text-xs uppercase"
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
                      <FormLabel className="text-xs">To</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="THB"
                          className="font-mono text-xs uppercase"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Rate</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.00000001"
                          min="0"
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
                <FormField
                  control={form.control}
                  name="effectiveDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Effective</FormLabel>
                      <FormControl>
                        <FormDatePicker
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          className="text-xs"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Source</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="manual"
                          className="text-xs"
                          {...field}
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
                Use ISO 4217 codes. Date controls which row resolves on a given
                lookup — the freshest row per pair wins. Source is free-text
                (e.g. <code>manual</code>, <code>oanda-2026-05-07</code>).
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
              Stored rates
            </p>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground size-5 animate-spin" />
              </div>
            ) : sortedRates.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No exchange rates seeded yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {sortedRates.map((rate) => {
                  const saving = savingId === rate.id;
                  return (
                    <li
                      key={rate.id}
                      className={`
                        border-border bg-background grid grid-cols-1
                        items-center gap-2 rounded-md border p-2
                        sm:grid-cols-[160px_140px_120px_100px_auto]
                      `}
                    >
                      <div
                        className={`
                          flex items-center gap-1.5 font-mono text-[11px]
                        `}
                      >
                        <span className="font-semibold">
                          {rate.baseCurrency}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-semibold">{rate.currency}</span>
                      </div>
                      <Input
                        type="number"
                        step="0.00000001"
                        min="0"
                        defaultValue={Number(rate.rate)}
                        disabled={saving}
                        className="h-8 text-xs tabular-nums"
                        onBlur={(e) => saveRate(rate, Number(e.target.value))}
                      />
                      <span
                        className={`
                          text-muted-foreground text-[11px] tabular-nums
                        `}
                      >
                        {format(
                          new Date(
                            String(rate.effectiveDate).slice(0, 10) +
                              "T00:00:00",
                          ),
                          "MMM d, yyyy",
                        )}
                      </span>
                      <span
                        className={`text-muted-foreground truncate text-[11px]`}
                      >
                        {rate.source ?? "—"}
                      </span>
                      <div className="flex items-center justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Delete"
                          disabled={saving}
                          onClick={() => setDeleteTarget(rate)}
                        >
                          <Trash2 className="text-destructive size-3.5" />
                        </Button>
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
            <AlertDialogTitle>Delete this rate?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${deleteTarget.baseCurrency} → ${deleteTarget.currency} on ${format(new Date(String(deleteTarget.effectiveDate).slice(0, 10) + "T00:00:00"), "MMM d, yyyy")} will be permanently removed. Forecast lookups fall back to the next-most-recent row for this pair, or flag a missing-FX warning if none exists.`
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
