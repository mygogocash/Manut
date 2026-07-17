"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { FileText, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  CATEGORY_LABELS,
  createModule,
  type LearningModule,
  MODULE_CATEGORIES,
  updateModule,
} from "@/services/learning.service";
import { uploadFile } from "@/services/upload.service";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(2000).optional().or(z.literal("")),
  category: z.string().min(1, "Category is required"),
  duration: z.string().optional().or(z.literal("")),
  url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  // File asset is uploaded ahead of submit; the resulting URL + name
  // ride along the create / update payload.
  fileUrl: z.string().url().optional().or(z.literal("")),
  fileName: z.string().max(300).optional().or(z.literal("")),
  isMandatory: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface ModuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module?: LearningModule | null;
  onSaved: () => void;
}

export function ModuleFormDialog({
  open,
  onOpenChange,
  module,
  onSaved,
}: ModuleFormDialogProps) {
  const isEditing = !!module;
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      duration: "",
      url: "",
      fileUrl: "",
      fileName: "",
      isMandatory: false,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (module) {
      form.reset({
        title: module.title,
        description: module.description ?? "",
        category: module.category,
        duration: module.duration ? String(module.duration) : "",
        url: module.url ?? "",
        fileUrl: module.fileUrl ?? "",
        fileName: module.fileName ?? "",
        isMandatory: module.isMandatory,
      });
    } else {
      form.reset({
        title: "",
        description: "",
        category: "",
        duration: "",
        url: "",
        fileUrl: "",
        fileName: "",
        isMandatory: false,
      });
    }
  }, [open, module, form]);

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const uploaded = await uploadFile(file, {
        bucket: "documents",
        purpose: "training-module",
      });
      form.setValue("fileUrl", uploaded.url, { shouldDirty: true });
      form.setValue("fileName", uploaded.originalName, { shouldDirty: true });
      toast.success(`${uploaded.originalName} uploaded`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast.error(message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function clearFile() {
    form.setValue("fileUrl", "", { shouldDirty: true });
    form.setValue("fileName", "", { shouldDirty: true });
  }

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const payload = {
        title: values.title,
        description: values.description || undefined,
        category: values.category,
        duration: values.duration ? Number(values.duration) : undefined,
        url: values.url || undefined,
        fileUrl: values.fileUrl || undefined,
        fileName: values.fileName || undefined,
        isMandatory: values.isMandatory,
      };

      if (isEditing) {
        await updateModule(module.id, payload);
        toast.success("Module updated");
      } else {
        await createModule(payload);
        toast.success("Module created");
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
          sm:max-w-lg
        `}
      >
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit module" : "New training module"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update details for "${module.title}".`
              : "Add a new training module to the library."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="module-form"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Security Awareness" {...field} />
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
                      placeholder="Brief description of the module…"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MODULE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {CATEGORY_LABELS[c]}
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
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (min)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="e.g. 60"
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
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>External URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://example.com/course"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Attachment</FormLabel>
              {form.watch("fileUrl") ? (
                <div
                  className={`
                    border-border bg-muted/30 flex items-center justify-between
                    gap-2 rounded-md border p-2
                  `}
                >
                  <a
                    href={form.watch("fileUrl") || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className={`
                      text-foreground flex min-w-0 items-center gap-2 text-xs
                      hover:underline
                    `}
                  >
                    <FileText className="size-4 shrink-0" />
                    <span className="truncate">
                      {form.watch("fileName") || "Attached file"}
                    </span>
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={clearFile}
                    disabled={uploading || submitting}
                    title="Remove attachment"
                  >
                    <Trash2 className="text-destructive size-3.5" />
                  </Button>
                </div>
              ) : (
                <label
                  htmlFor="module-attachment"
                  className={`
                    border-border text-muted-foreground flex cursor-pointer
                    flex-col items-center justify-center gap-1 rounded-md border
                    border-dashed p-4 text-center text-xs
                    hover:border-foreground/30
                    ${uploading ? "opacity-60" : ""}
                  `}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      <span>Uploading…</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="size-5" />
                      <span className="text-foreground font-medium">
                        Click to upload a file
                      </span>
                      <span>PDF, slides, video — up to 50 MB</span>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    id="module-attachment"
                    type="file"
                    className="hidden"
                    disabled={uploading}
                    onChange={handleFilePick}
                  />
                </label>
              )}
              <p className="text-muted-foreground text-[11px]">
                Trainees see a download link on the module card. Pair with an
                external URL when the upload is supplementary (e.g. slides for a
                recorded session).
              </p>
            </FormItem>

            <FormField
              control={form.control}
              name="isMandatory"
              render={({ field }) => (
                <FormItem
                  className={`
                    flex items-center justify-between rounded-md border px-3
                    py-2.5
                  `}
                >
                  <FormLabel className="mb-0 cursor-pointer">
                    Mandatory training
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
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
            form="module-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEditing ? "Save changes" : "Create module"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
