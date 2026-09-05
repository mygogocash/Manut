"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  type CompanyPolicy,
  createPolicy,
  POLICY_CATEGORIES,
  POLICY_CATEGORY_LABELS,
  type PolicyCategory,
  updatePolicy,
} from "@/services/policy.service";
import { uploadFile } from "@/services/upload.service";

const ENTITY_GLOBAL = "__global__";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
  .or(z.literal(""));

const schema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  category: z.enum(POLICY_CATEGORIES),
  description: z.string().max(4000).optional().or(z.literal("")),
  version: z.string().max(40).optional().or(z.literal("")),
  effectiveDate: dateString.optional(),
  entityId: z.string().optional(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface EntityOption {
  id: string;
  name: string;
}

interface PolicyUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy?: CompanyPolicy | null;
  entities: EntityOption[];
  onSaved: () => void;
}

const DEFAULTS: FormValues = {
  title: "",
  category: "handbook",
  description: "",
  version: "",
  effectiveDate: "",
  entityId: ENTITY_GLOBAL,
  isActive: true,
};

export function PolicyUploadDialog({
  open,
  onOpenChange,
  policy,
  entities,
  onSaved,
}: PolicyUploadDialogProps) {
  const isEditing = Boolean(policy);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (!open) return;
    setFile(null);
    if (policy) {
      form.reset({
        title: policy.title,
        category: policy.category,
        description: policy.description ?? "",
        version: policy.version ?? "",
        effectiveDate: policy.effectiveDate?.slice(0, 10) ?? "",
        entityId: policy.entityId ?? ENTITY_GLOBAL,
        isActive: policy.isActive,
      });
    } else {
      form.reset(DEFAULTS);
    }
  }, [open, policy, form]);

  const category = form.watch("category") as PolicyCategory;
  // Auto-fill title with category label on blank create.
  useEffect(() => {
    if (isEditing) return;
    const current = form.getValues("title");
    if (!current) form.setValue("title", POLICY_CATEGORY_LABELS[category]);
  }, [category, form, isEditing]);

  async function onSubmit(values: FormValues) {
    if (!isEditing && !file) {
      toast.error("Pick a file to upload");
      return;
    }
    try {
      setSubmitting(true);

      let uploaded: {
        url: string;
        filename: string;
        mimeType: string;
        size: number;
      } | null = null;
      if (file) {
        const res = await uploadFile(file, {
          bucket: "documents",
          purpose: "company-policy",
        });
        uploaded = {
          url: res.url,
          filename: res.originalName,
          mimeType: res.mimeType,
          size: res.size,
        };
      }

      const entityId =
        values.entityId && values.entityId !== ENTITY_GLOBAL
          ? values.entityId
          : null;

      if (isEditing && policy) {
        await updatePolicy(policy.id, {
          title: values.title,
          category: values.category,
          description: values.description?.trim() || undefined,
          version: values.version?.trim() || undefined,
          effectiveDate: values.effectiveDate || undefined,
          entityId,
          isActive: values.isActive,
          ...(uploaded && {
            fileUrl: uploaded.url,
            fileName: uploaded.filename,
            mimeType: uploaded.mimeType,
            fileSize: uploaded.size,
          }),
        });
        toast.success("Policy updated");
      } else {
        await createPolicy({
          title: values.title,
          category: values.category,
          description: values.description?.trim() || undefined,
          version: values.version?.trim() || undefined,
          effectiveDate: values.effectiveDate || undefined,
          entityId,
          isActive: values.isActive,
          fileUrl: uploaded!.url,
          fileName: uploaded!.filename,
          mimeType: uploaded!.mimeType,
          fileSize: uploaded!.size,
        });
        toast.success("Policy uploaded");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[policy upload] failed:", err);
      if (err instanceof ApiError) {
        const details = err.details ?? [];
        if (details.length > 0) {
          const firstField = details[0]?.field;
          const firstMessage = details[0]?.message;
          toast.error(
            firstField
              ? `${err.message}: ${firstField} — ${firstMessage}`
              : `${err.message}: ${firstMessage}`,
          );
        } else {
          toast.error(`${err.message} [${err.status} ${err.code}]`);
        }
      } else {
        toast.error(
          err instanceof Error ? err.message : "Failed to save policy",
        );
      }
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
          sm:max-w-xl
        `}
      >
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit policy" : "Upload policy"}
          </DialogTitle>
          <DialogDescription>
            Company-wide policies and handbooks. Anyone in the workspace can
            view and download. Replacing the file is optional when editing.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="policy-upload-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {POLICY_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {POLICY_CATEGORY_LABELS[c]}
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
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Employee Handbook 2026"
                      {...field}
                    />
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
                      rows={3}
                      placeholder="What this document covers."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div
              className={`
                grid grid-cols-1 gap-4
                sm:grid-cols-2
              `}
            >
              <FormField
                control={form.control}
                name="version"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Version</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. v1.0" {...field} />
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
                    <FormLabel>Effective date</FormLabel>
                    <FormControl>
                      <FormDatePicker
                        value={field.value ?? ""}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="entityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entity scope</FormLabel>
                  <Select
                    value={field.value ?? ENTITY_GLOBAL}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={ENTITY_GLOBAL}>
                        Global (all entities)
                      </SelectItem>
                      {entities.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Global = visible to every employee. Pick an entity to limit
                    visibility (e.g. India-only handbook).
                  </FormDescription>
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
                    flex items-center justify-between rounded-md border p-3
                  `}
                >
                  <div>
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Inactive policies are hidden from employees but kept in
                      the admin table for archive.
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

            <div className="flex flex-col gap-2">
              <Label htmlFor="policy-file">
                {isEditing ? "Replace file (optional)" : "File *"}
              </Label>
              <Input
                id="policy-file"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {policy && (
                <p className="text-muted-foreground text-xs">
                  Current: {policy.fileName}
                </p>
              )}
            </div>
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
          <Button type="submit" form="policy-upload-form" disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {isEditing ? "Save changes" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
