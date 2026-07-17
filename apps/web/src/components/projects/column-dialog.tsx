"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { ProjectColumn } from "@/services/project.service";
import { createColumn, updateColumn } from "@/services/project.service";

const COLUMN_COLORS = [
  { value: "bg-zinc-500", label: "Gray" },
  { value: "bg-blue-500", label: "Blue" },
  { value: "bg-amber-500", label: "Amber" },
  { value: "bg-purple-500", label: "Purple" },
  { value: "bg-emerald-500", label: "Green" },
  { value: "bg-red-500", label: "Red" },
  { value: "bg-pink-500", label: "Pink" },
  { value: "bg-cyan-500", label: "Cyan" },
  { value: "bg-orange-500", label: "Orange" },
  { value: "bg-indigo-500", label: "Indigo" },
];

const columnFormSchema = z.object({
  label: z.string().min(1, "Label is required").max(100),
  key: z.string().max(100).optional().or(z.literal("")),
  color: z.string().min(1),
});

type ColumnFormValues = z.infer<typeof columnFormSchema>;

export function ColumnDialog({
  open,
  onOpenChange,
  column,
  projectId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column?: ProjectColumn | null;
  projectId: string;
  onSuccess: () => void;
}) {
  const isEdit = !!column;
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ColumnFormValues>({
    resolver: standardSchemaResolver(columnFormSchema),
    defaultValues: {
      label: "",
      key: "",
      color: "bg-zinc-500",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (column) {
      form.reset({
        label: column.label,
        key: column.key,
        color: column.color,
      });
    } else {
      form.reset({
        label: "",
        key: "",
        color: "bg-zinc-500",
      });
    }
  }, [column, open, form]);

  async function onSubmit(values: ColumnFormValues) {
    setSubmitting(true);
    try {
      if (isEdit) {
        await updateColumn(projectId, column!.id, {
          label: values.label.trim(),
          color: values.color,
        });
      } else {
        const generatedKey =
          values.key?.trim() ||
          values.label
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/g, "");
        await createColumn(projectId, {
          key: generatedKey,
          label: values.label.trim(),
          color: values.color,
          sortOrder: 99,
        });
      }
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to save column";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Column" : "New Column"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update column settings." : "Add a new status column."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="column-form"
          >
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. QA Testing" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEdit && (
              <FormField
                control={form.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Key</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Auto-generated from label"
                      />
                    </FormControl>
                    <p className="text-muted-foreground text-[10px]">
                      Lowercase, alphanumeric. Leave blank to auto-generate.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {COLUMN_COLORS.map((c) => (
                        <Tooltip key={c.value}>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className={cn(
                                "size-6 rounded-full",
                                c.value,
                                "hover:opacity-80",
                                field.value === c.value &&
                                  "ring-primary ring-2 ring-offset-2",
                              )}
                              onClick={() => field.onChange(c.value)}
                            >
                              <span className="sr-only">{c.label}</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{c.label}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
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
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="column-form"
            disabled={submitting}
            className="min-w-24"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEdit ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
