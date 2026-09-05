"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/shared/badge";
import { DataTable } from "@/components/shared/data-table";
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
  createTaxCode,
  deleteTaxCode,
  listAccounts,
  listTaxCodes,
  TAX_CODE_KINDS,
  type TaxCode,
  type TaxCodeKind,
  updateTaxCode,
} from "@/services/accounting.service";

const KIND_LABEL: Record<string, string> = {
  "vat-output": "Output VAT",
  "vat-input": "Input VAT",
  wht: "Withholding Tax",
};

const NONE_ACCOUNT = "__none__";

const schema = z.object({
  code: z.string().min(1, "Code is required").max(50),
  name: z.string().min(1, "Name is required").max(200),
  kind: z.enum(TAX_CODE_KINDS, { required_error: "Kind is required" }),
  ratePercent: z.coerce
    .number()
    .min(0, "Rate must be 0 or more")
    .max(100, "Rate must be 100 or less"),
  glAccountId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface TaxCodesManagerProps {
  entityId: string;
  canAdmin: boolean;
}

export function TaxCodesManager({ entityId, canAdmin }: TaxCodesManagerProps) {
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaxCode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TaxCode | null>(null);
  const [deleting, setDeleting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: "",
      name: "",
      kind: "vat-output",
      ratePercent: 0,
      glAccountId: "",
    },
  });

  const load = useCallback(async () => {
    if (!entityId) return;
    try {
      setLoading(true);
      const [codes, accs] = await Promise.all([
        listTaxCodes({ entityId, includeInactive: true }),
        listAccounts({ entityId }),
      ]);
      setTaxCodes(codes.data);
      setAccounts(accs.data.filter((a) => a.isActive));
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load tax codes";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = useCallback(() => {
    setEditing(null);
    form.reset({
      code: "",
      name: "",
      kind: "vat-output",
      ratePercent: 0,
      glAccountId: "",
    });
    setDialogOpen(true);
  }, [form]);

  const openEdit = useCallback(
    (tc: TaxCode) => {
      setEditing(tc);
      form.reset({
        code: tc.code,
        name: tc.name,
        kind: (tc.kind as TaxCodeKind) ?? "vat-output",
        ratePercent: Number(tc.rate) * 100,
        glAccountId: tc.glAccountId ?? "",
      });
      setDialogOpen(true);
    },
    [form],
  );

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const glAccountId = values.glAccountId?.trim() || null;
      const rate = values.ratePercent / 100;
      if (editing) {
        await updateTaxCode(editing.id, {
          code: values.code,
          name: values.name,
          kind: values.kind,
          rate,
          glAccountId,
        });
        toast.success("Tax code updated");
      } else {
        await createTaxCode({
          entityId,
          code: values.code,
          name: values.name,
          kind: values.kind,
          rate,
          glAccountId,
        });
        toast.success("Tax code created");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to save tax code";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteTaxCode(deleteTarget.id);
      toast.success("Tax code deleted");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to delete tax code";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  const columns = [
    {
      key: "code",
      header: "Code",
      render: (tc: TaxCode) => (
        <span className="font-medium">{tc.code}</span>
      ),
    },
    { key: "name", header: "Name", render: (tc: TaxCode) => tc.name },
    {
      key: "kind",
      header: "Kind",
      render: (tc: TaxCode) => (
        <Badge variant="grey">{KIND_LABEL[tc.kind] ?? tc.kind}</Badge>
      ),
    },
    {
      key: "rate",
      header: "Rate",
      className: "text-right",
      render: (tc: TaxCode) => (
        <span className="tabular-nums">
          {(Number(tc.rate) * 100).toFixed(2)}%
        </span>
      ),
    },
    {
      key: "isActive",
      header: "Active",
      render: (tc: TaxCode) => (
        <Badge status={tc.isActive ? "active" : "inactive"}>
          {tc.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      mobileRole: "actions" as const,
      header: "",
      className: "text-right",
      render: (tc: TaxCode) =>
        canAdmin ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => openEdit(tc)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              onClick={() => setDeleteTarget(tc)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {canAdmin ? (
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="xs" onClick={openCreate}>
            <Plus className="mr-1 size-3" />
            Add Tax Code
          </Button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={taxCodes}
        loading={loading}
        emptyMessage="No tax codes configured"
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => {
          if (!submitting) setDialogOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Tax Code" : "Add Tax Code"}
            </DialogTitle>
            <DialogDescription>
              Configure a VAT or withholding-tax code used on document lines.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
              id="tax-code-form"
            >
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. VAT7" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ratePercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate (%) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. VAT 7%" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kind *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TAX_CODE_KINDS.map((k) => (
                          <SelectItem key={k} value={k}>
                            {KIND_LABEL[k]}
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
                name="glAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GL Account</FormLabel>
                    <Select
                      value={field.value || NONE_ACCOUNT}
                      onValueChange={(v) =>
                        field.onChange(v === NONE_ACCOUNT ? "" : v)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_ACCOUNT}>None</SelectItem>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="tax-code-form"
              disabled={submitting}
              className="min-w-28"
            >
              {submitting ? (
                <Loader2 className="mr-2 size-3.5 animate-spin" />
              ) : null}
              {editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this tax code?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Tax code ${deleteTarget.code} (${deleteTarget.name}) will be removed.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void onDelete();
              }}
              disabled={deleting}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
