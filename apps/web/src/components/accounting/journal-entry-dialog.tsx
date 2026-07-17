"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { ApiError } from "@/lib/api-client";
import {
  type ChartOfAccount,
  createJournal,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

const lineSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  debit: z.coerce.number<number | string>().min(0),
  credit: z.coerce.number<number | string>().min(0),
  memo: z.string().max(500).optional(),
});

const schema = z
  .object({
    entityId: z.string().min(1, "Entity is required"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
    description: z.string().max(500).optional(),
    reference: z.string().max(100).optional(),
    lines: z.array(lineSchema).min(2, "At least 2 lines required"),
  })
  .refine(
    (data) => {
      const totalDebit = data.lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = data.lines.reduce((s, l) => s + l.credit, 0);
      return Math.abs(totalDebit - totalCredit) < 0.01;
    },
    { message: "Total debits must equal total credits", path: ["lines"] },
  )
  .refine((data) => data.lines.every((l) => l.debit > 0 || l.credit > 0), {
    message: "Each line must have either a debit or credit amount",
    path: ["lines"],
  });

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface JournalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: Entity[];
  accounts: ChartOfAccount[];
  onSaved: () => void;
}

export function JournalEntryDialog({
  open,
  onOpenChange,
  entities,
  accounts,
  onSaved,
}: JournalEntryDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      entityId: "",
      date: todayISO(),
      description: "",
      reference: "",
      lines: [
        { accountId: "", debit: 0, credit: 0, memo: "" },
        { accountId: "", debit: 0, credit: 0, memo: "" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const watchedLines = form.watch("lines");
  const totalDebit = watchedLines.reduce(
    (s, l) => s + (Number(l.debit) || 0),
    0,
  );
  const totalCredit = watchedLines.reduce(
    (s, l) => s + (Number(l.credit) || 0),
    0,
  );
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  useEffect(() => {
    if (open) {
      form.reset({
        entityId: "",
        date: todayISO(),
        description: "",
        reference: "",
        lines: [
          { accountId: "", debit: 0, credit: 0, memo: "" },
          { accountId: "", debit: 0, credit: 0, memo: "" },
        ],
      });
    }
  }, [open, form]);

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      await createJournal({
        entityId: values.entityId,
        date: values.date,
        description: values.description || "",
        reference: values.reference || "",
        lines: values.lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          memo: l.memo || undefined,
        })),
      });
      toast.success("Journal entry created");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to create journal entry";
      toast.error(message);
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
          max-h-[92vh] overflow-y-auto
          sm:max-w-3xl
        `}
      >
        <DialogHeader>
          <DialogTitle>New Journal Entry</DialogTitle>
          <DialogDescription>
            Create a double-entry journal entry. Debits must equal credits.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="journal-entry-form"
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="entityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entity *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select entity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {entities.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name} ({e.code})
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
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <FormDatePicker {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. JE-2026-001" {...field} />
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
                      <Input
                        placeholder="Description of the entry"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p
                  className={`
                    text-muted-foreground text-[10px] font-bold tracking-widest
                    uppercase
                  `}
                >
                  Lines
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    append({ accountId: "", debit: 0, credit: 0, memo: "" })
                  }
                >
                  <Plus className="mr-1 size-3" />
                  Add Line
                </Button>
              </div>

              <div
                className={`
                  border-border divide-border divide-y rounded-lg border
                `}
              >
                <div
                  className={`
                    bg-surface-secondary text-muted-foreground grid
                    grid-cols-[1fr_100px_100px_1fr_32px] gap-2 px-3 py-2
                    text-[9px] font-bold tracking-widest uppercase
                  `}
                >
                  <span>Account</span>
                  <span>Debit</span>
                  <span>Credit</span>
                  <span>Memo</span>
                  <span />
                </div>

                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className={`
                      grid grid-cols-[1fr_100px_100px_1fr_32px] items-start
                      gap-2 px-3 py-2
                    `}
                  >
                    <FormField
                      control={form.control}
                      name={`lines.${index}.accountId`}
                      render={({ field: f }) => (
                        <FormItem>
                          <Select value={f.value} onValueChange={f.onChange}>
                            <FormControl>
                              <SelectTrigger className="h-10 w-full text-xs">
                                <SelectValue placeholder="Account" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {accounts.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.code} - {a.name}
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
                      name={`lines.${index}.debit`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="h-8 text-xs"
                              {...f}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`lines.${index}.credit`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="h-8 text-xs"
                              {...f}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`lines.${index}.memo`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              placeholder="Memo"
                              className="h-8 text-xs"
                              {...f}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={fields.length <= 2}
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}

                <div
                  className={`
                    bg-surface-secondary grid
                    grid-cols-[1fr_100px_100px_1fr_32px] gap-2 px-3 py-2 text-xs
                    font-medium
                  `}
                >
                  <span className="text-right">Totals</span>
                  <span className="tabular-nums">
                    {totalDebit.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <span className="tabular-nums">
                    {totalCredit.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <span
                    className={isBalanced ? "text-success" : "text-destructive"}
                  >
                    {isBalanced ? "Balanced" : "Unbalanced"}
                  </span>
                  <span />
                </div>
              </div>

              {form.formState.errors.lines?.root && (
                <p className="text-destructive text-xs">
                  {form.formState.errors.lines.root.message}
                </p>
              )}
            </div>
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
            form="journal-entry-form"
            disabled={submitting || !isBalanced}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            Create Entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
