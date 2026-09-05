"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FIXED_ASSET_CLASSES } from "@/components/accounting/accounting-utils";
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
import { ApiError } from "@/lib/api-client";
import {
  createFixedAssetCategory,
  deleteFixedAssetCategory,
  type FixedAssetCategory,
  listFixedAssetCategories,
  updateFixedAssetCategory,
} from "@/services/accounting.service";

const CLASS_LABEL: Record<string, string> = {
  IT: "IT / Computer (3y default)",
  PFA: "Purchase Fixed Assets (5y default)",
  FF: "Furniture & Fixture (5y default)",
};

const schema = z.object({
  code: z.string().min(1, "Code is required").max(30),
  name: z.string().min(1, "Name is required").max(120),
  nameTh: z.string().max(120),
  assetClass: z.enum(FIXED_ASSET_CLASSES),
  usefulLifeMonths: z.string().min(1, "Useful life is required"),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  entityId: string;
  canAdmin: boolean;
}

export function FixedAssetCategoriesManager({ entityId, canAdmin }: Props) {
  const [categories, setCategories] = useState<FixedAssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FixedAssetCategory | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FixedAssetCategory | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: "",
      name: "",
      nameTh: "",
      assetClass: "PFA",
      usefulLifeMonths: "60",
      isActive: true,
    },
  });

  const load = useCallback(async () => {
    if (!entityId) return;
    try {
      setLoading(true);
      const res = await listFixedAssetCategories({
        entityId,
        includeInactive: true,
      });
      setCategories(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load categories",
      );
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    form.reset({
      code: "",
      name: "",
      nameTh: "",
      assetClass: "PFA",
      usefulLifeMonths: "60",
      isActive: true,
    });
    setDialogOpen(true);
  }

  function openEdit(c: FixedAssetCategory) {
    setEditing(c);
    form.reset({
      code: c.code,
      name: c.name,
      nameTh: c.nameTh ?? "",
      assetClass: c.assetClass as (typeof FIXED_ASSET_CLASSES)[number],
      usefulLifeMonths: String(c.usefulLifeMonths),
      isActive: c.isActive,
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const payload = {
        code: values.code.trim(),
        name: values.name.trim(),
        nameTh: values.nameTh.trim() || null,
        assetClass: values.assetClass,
        usefulLifeMonths: Number(values.usefulLifeMonths),
        isActive: values.isActive,
      };
      if (editing) {
        await updateFixedAssetCategory(editing.id, payload);
        toast.success(`Category "${payload.code}" updated`);
      } else {
        await createFixedAssetCategory({ entityId, ...payload });
        toast.success(`Category "${payload.code}" created`);
      }
      setDialogOpen(false);
      void load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save category",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteFixedAssetCategory(deleteTarget.id);
      toast.success(`Category "${deleteTarget.code}" deleted`);
      setDeleteTarget(null);
      void load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete category",
      );
    } finally {
      setDeleting(false);
    }
  }

  const columns = [
    {
      key: "code",
      header: "Code",
      render: (c: FixedAssetCategory) => (
        <span className="font-medium">{c.code}</span>
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (c: FixedAssetCategory) => c.name,
    },
    {
      key: "assetClass",
      header: "Class",
      render: (c: FixedAssetCategory) => (
        <span className="text-muted-foreground text-xs">{c.assetClass}</span>
      ),
    },
    {
      key: "usefulLifeMonths",
      header: "Life",
      render: (c: FixedAssetCategory) => (
        <span className="text-xs tabular-nums">{c.usefulLifeMonths} mo</span>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      render: (c: FixedAssetCategory) =>
        c.isActive ? (
          <Badge status="active">Active</Badge>
        ) : (
          <Badge status="cancelled">Inactive</Badge>
        ),
    },
    {
      key: "actions",
      mobileRole: "actions" as const,
      header: "",
      className: "w-20 text-right",
      render: (c: FixedAssetCategory) => {
        if (!canAdmin) return null;
        return (
          <div className="inline-flex gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => openEdit(c)}>
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setDeleteTarget(c)}
            >
              <Trash2 className="text-destructive size-3.5" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {canAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-3.5" />
            Add category
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={categories}
        loading={loading}
        emptyMessage="No asset categories yet"
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
              {editing ? "Edit category" : "Add category"}
            </DialogTitle>
            <DialogDescription>
              The class sets the generated asset-code prefix (FA-IT / FA-PFA /
              FA-FF) and the default useful life.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              id="fa-category-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input placeholder="IT" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Computer / IT equipment" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assetClass"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FIXED_ASSET_CLASSES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {CLASS_LABEL[c] ?? c}
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
                name="usefulLifeMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Useful life (months)</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" step="1" {...field} />
                    </FormControl>
                    <FormDescription>
                      36 = 3 years, 60 = 5 years.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" form="fa-category-form" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Delete "${deleteTarget.code} — ${deleteTarget.name}". A category still used by an asset can't be deleted — deactivate it instead.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
