"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  createFixedAsset,
  type FixedAsset,
  type FixedAssetCategory,
  listFixedAssetCategories,
  updateFixedAsset,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

const schema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  categoryCode: z.string().min(1, "Category is required"),
  assetNo: z.string().max(60),
  name: z.string().min(1, "Name is required").max(200),
  nameTh: z.string().max(200),
  supplier: z.string().max(200),
  location: z.string().max(200),
  assignedUser: z.string().max(200),
  serialNo: z.string().max(120),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  startDate: z.string(),
  usefulLifeMonths: z.string(),
  quantity: z.string().min(1),
  purchasePrice: z.string().min(1, "Purchase price is required"),
  openingBookValue: z.string(),
  openingAsOfDate: z.string(),
  notes: z.string().max(2000),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  entityId: "",
  categoryCode: "",
  assetNo: "",
  name: "",
  nameTh: "",
  supplier: "",
  location: "",
  assignedUser: "",
  serialNo: "",
  purchaseDate: "",
  startDate: "",
  usefulLifeMonths: "",
  quantity: "1",
  purchasePrice: "",
  openingBookValue: "",
  openingAsOfDate: "",
  notes: "",
};

interface FixedAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: FixedAsset | null;
  entities: Entity[];
  defaultEntityId?: string;
  onSaved: () => void;
}

export function FixedAssetDialog({
  open,
  onOpenChange,
  asset,
  entities,
  defaultEntityId,
  onSaved,
}: FixedAssetDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<FixedAssetCategory[]>([]);
  const editing = Boolean(asset);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      asset
        ? {
            entityId: asset.entityId,
            categoryCode: asset.categoryCode,
            assetNo: asset.assetNo,
            name: asset.name,
            nameTh: asset.nameTh ?? "",
            supplier: asset.supplier ?? "",
            location: asset.location ?? "",
            assignedUser: asset.assignedUser ?? "",
            serialNo: asset.serialNo ?? "",
            purchaseDate: asset.purchaseDate.slice(0, 10),
            startDate: asset.startDate.slice(0, 10),
            usefulLifeMonths: String(asset.usefulLifeMonths),
            quantity: String(asset.quantity),
            purchasePrice: asset.purchasePrice,
            openingBookValue: asset.openingBookValue ?? "",
            openingAsOfDate: asset.openingAsOfDate?.slice(0, 10) ?? "",
            notes: asset.notes ?? "",
          }
        : { ...EMPTY, entityId: defaultEntityId ?? entities[0]?.id ?? "" },
    );
  }, [open, asset, defaultEntityId, entities, form]);

  const entityId = form.watch("entityId");

  // Load the category list for the selected entity (drives the picker + the
  // useful-life default). Refetched whenever the entity changes.
  useEffect(() => {
    if (!open || !entityId) {
      setCategories([]);
      return;
    }
    listFixedAssetCategories({ entityId })
      .then((res) => setCategories(res.data))
      .catch(() => setCategories([]));
  }, [open, entityId]);

  // When a category is picked on a NEW asset, seed the useful-life default.
  const applyCategoryDefault = useCallback(
    (code: string) => {
      form.setValue("categoryCode", code);
      const cat = categories.find((c) => c.code === code);
      if (cat && !editing && !form.getValues("usefulLifeMonths")) {
        form.setValue("usefulLifeMonths", String(cat.usefulLifeMonths));
      }
    },
    [categories, editing, form],
  );

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const payload = {
        categoryCode: values.categoryCode,
        assetNo: values.assetNo.trim() || undefined,
        name: values.name.trim(),
        nameTh: values.nameTh.trim() || null,
        supplier: values.supplier.trim() || null,
        location: values.location.trim() || null,
        assignedUser: values.assignedUser.trim() || null,
        serialNo: values.serialNo.trim() || null,
        purchaseDate: values.purchaseDate,
        startDate: values.startDate || undefined,
        usefulLifeMonths: values.usefulLifeMonths
          ? Number(values.usefulLifeMonths)
          : undefined,
        quantity: Number(values.quantity),
        purchasePrice: Number(values.purchasePrice),
        openingBookValue: values.openingBookValue
          ? Number(values.openingBookValue)
          : null,
        openingAsOfDate: values.openingAsOfDate || null,
        notes: values.notes.trim() || null,
      };
      if (asset) {
        await updateFixedAsset(asset.id, payload);
        toast.success(`Asset "${asset.assetNo}" updated`);
      } else {
        await createFixedAsset({ entityId: values.entityId, ...payload });
        toast.success("Fixed asset created");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save fixed asset",
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
          sm:max-w-2xl
        `}
      >
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit fixed asset" : "Add fixed asset"}
          </DialogTitle>
          <DialogDescription>
            Amounts exclude VAT. Leave the code blank to auto-generate FA-
            {"{class}"}-{"{year}"}-NNN. Set an opening book value only when
            loading a pre-cut-over asset.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="fixed-asset-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className={`
              -mr-2 grid flex-1 grid-cols-1 gap-4 overflow-y-auto pr-2
              sm:grid-cols-2
            `}
          >
            <FormField
              control={form.control}
              name="entityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entity</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={editing}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select entity" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {entities.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
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
              name="categoryCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={applyCategoryDefault}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.code}>
                          {c.code} — {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {categories.length === 0
                      ? "No categories yet — add them on the Setup tab."
                      : "Sets the code prefix and default useful life."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asset name</FormLabel>
                  <FormControl>
                    <Input placeholder="MacBook Pro 14" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nameTh"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asset name (Thai)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assetNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asset code</FormLabel>
                  <FormControl>
                    <Input placeholder="Auto-generate if blank" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" step="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purchaseDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Depreciation start</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription>Defaults to purchase date.</FormDescription>
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
                  <FormDescription>Defaults from the category.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purchasePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase price (excl. VAT)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormDescription>
                    Negative for a credit-note contra line.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="supplier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="serialNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serial no.</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assignedUser"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="openingBookValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opening book value</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormDescription>Pre-cut-over load only.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="openingAsOfDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opening book value as at</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription>
                    Required with opening value.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
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
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" form="fixed-asset-form" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Add asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
