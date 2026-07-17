"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { CATEGORIES } from "@/components/benefits/benefits-utils";
import { Modal, ModalActions } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  type BenefitDetail,
  createBenefit,
  type CreateBenefitInput,
  updateBenefit,
} from "@/services/benefit.service";
import { type Entity } from "@/services/entity.service";

const categoryTuple = CATEGORIES.map((c) => c.value) as [string, ...string[]];

const benefitFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  category: z.enum(categoryTuple, { message: "Category is required" }),
  description: z.string().optional(),
  provider: z.string().optional(),
  cost: z.coerce
    .number<number | string>({ error: "Enter a valid cost" })
    .min(0, "Cost cannot be negative")
    .refine((n) => Number.isFinite(n), "Enter a valid cost"),
  currency: z
    .string()
    .trim()
    .min(1, "Currency is required")
    .max(3, "Use a 3-letter code"),
  entityId: z.string().optional(),
  isActive: z.boolean(),
});

type BenefitFormInput = z.input<typeof benefitFormSchema>;
type BenefitFormValues = z.output<typeof benefitFormSchema>;

const defaultValues: BenefitFormValues = {
  name: "",
  category: "health",
  description: "",
  provider: "",
  cost: 0,
  currency: "THB",
  entityId: "",
  isActive: true,
};

interface BenefitFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  benefit?: BenefitDetail | null;
  entities: Entity[];
}

function toPayload(values: BenefitFormValues): CreateBenefitInput {
  return {
    name: values.name.trim(),
    category: values.category,
    description: values.description?.trim() || undefined,
    provider: values.provider?.trim() || undefined,
    cost: values.cost,
    currency: values.currency.trim().toUpperCase(),
    // Send `null` rather than `undefined` so updates can explicitly
    // clear the entity. Backend `update` treats null as disconnect and
    // undefined as "no change".
    entityId: values.entityId?.trim() || null,
    isActive: values.isActive,
  };
}

export function BenefitFormDialog({
  open,
  onClose,
  onSaved,
  benefit,
  entities,
}: BenefitFormDialogProps) {
  const isEdit = !!benefit;
  const [saving, setSaving] = useState(false);

  const form = useForm<BenefitFormInput, unknown, BenefitFormValues>({
    resolver: standardSchemaResolver(benefitFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!open) return;
    if (benefit) {
      const cat = categoryTuple.includes(benefit.category)
        ? benefit.category
        : categoryTuple[0];
      form.reset({
        name: benefit.name,
        category: cat as BenefitFormValues["category"],
        description: benefit.description ?? "",
        provider: benefit.provider ?? "",
        cost: Number(benefit.cost),
        currency: benefit.currency,
        entityId: benefit.entityId ?? "",
        isActive: benefit.isActive,
      });
    } else {
      form.reset(defaultValues);
    }
  }, [benefit, open, form]);

  async function onSubmit(values: BenefitFormValues) {
    const payload = toPayload(values);
    try {
      setSaving(true);
      if (isEdit) {
        await updateBenefit(benefit.id, payload);
        toast.success("Benefit updated");
      } else {
        await createBenefit(payload);
        toast.success("Benefit created");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save benefit",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Benefit" : "Create Benefit"}
      subtitle="Fill in the benefit details"
      size="lg"
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. Health Insurance Premium"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
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
            name="provider"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Provider</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. AIA Thailand" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Annual Cost</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={field.value}
                    onChange={(e) => {
                      const v = e.target.value;
                      field.onChange(v === "" ? 0 : Number(v));
                    }}
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
                <FormLabel>Currency</FormLabel>
                <FormControl>
                  <Input maxLength={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {entities.length > 0 && (
            <FormField
              control={form.control}
              name="entityId"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Entity</FormLabel>
                  <Select
                    onValueChange={(v) =>
                      field.onChange(v === "__none__" ? "" : v)
                    }
                    value={field.value?.trim() ? field.value : "__none__"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select entity (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
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
          )}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe the benefit..."
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem
                className={`
                  col-span-2 flex flex-row items-center justify-between
                  rounded-lg border p-3
                `}
              >
                <div className="space-y-0.5">
                  <FormLabel>Active</FormLabel>
                  <p className="text-muted-foreground text-[11px]">
                    Inactive benefits are hidden from new enrollments
                  </p>
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
          <ModalActions>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-1.5 size-3 animate-spin" />}
              {isEdit ? "Update" : "Create"}
            </Button>
          </ModalActions>
        </form>
      </Form>
    </Modal>
  );
}
