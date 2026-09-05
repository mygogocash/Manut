"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  CATEGORY_LABELS,
  type DataRoomDocument,
  DOCUMENT_CATEGORIES,
  updateDocument,
  uploadDocument,
} from "@/services/dataroom.service";

const uploadSchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  description: z.string().max(2000).optional().or(z.literal("")),
  category: z.string().min(1, "Category is required"),
  fileUrl: z.string().url("Must be a valid URL"),
  fileSize: z.string().optional().or(z.literal("")),
  mimeType: z.string().optional().or(z.literal("")),
});

const editSchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  description: z.string().max(2000).optional().or(z.literal("")),
  category: z.string().min(1, "Category is required"),
});

type UploadValues = z.infer<typeof uploadSchema>;
type EditValues = z.infer<typeof editSchema>;

interface DocumentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document?: DataRoomDocument | null;
  onSaved: () => void;
}

export function DocumentFormDialog({
  open,
  onOpenChange,
  document,
  onSaved,
}: DocumentFormDialogProps) {
  const isEditing = !!document;
  const [submitting, setSubmitting] = useState(false);

  const uploadForm = useForm<UploadValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "other",
      fileUrl: "",
      fileSize: "",
      mimeType: "",
    },
  });

  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "other",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (document) {
      editForm.reset({
        name: document.name,
        description: document.description ?? "",
        category: document.category,
      });
    } else {
      uploadForm.reset({
        name: "",
        description: "",
        category: "other",
        fileUrl: "",
        fileSize: "",
        mimeType: "",
      });
    }
  }, [open, document, editForm, uploadForm]);

  async function onSubmitUpload(values: UploadValues) {
    try {
      setSubmitting(true);
      await uploadDocument({
        name: values.name,
        description: values.description || undefined,
        category: values.category,
        fileUrl: values.fileUrl,
        fileSize: values.fileSize ? Number(values.fileSize) : undefined,
        mimeType: values.mimeType || undefined,
      });
      toast.success("Document uploaded");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to upload";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitEdit(values: EditValues) {
    if (!document) return;
    try {
      setSubmitting(true);
      await updateDocument(document.id, {
        name: values.name,
        description: values.description || null,
        category: values.category,
      });
      toast.success("Document updated");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update";
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
            {isEditing ? "Edit document" : "Upload document"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update details for "${document.name}".`
              : "Add a new document to the data room."}
          </DialogDescription>
        </DialogHeader>

        {isEditing ? (
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onSubmitEdit)}
              className="flex flex-col gap-4"
              id="doc-form"
            >
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Document name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
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
                        {DOCUMENT_CATEGORIES.map((c) => (
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
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional description…"
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
        ) : (
          <Form {...uploadForm}>
            <form
              onSubmit={uploadForm.handleSubmit(onSubmitUpload)}
              className="flex flex-col gap-4"
              id="doc-form"
            >
              <FormField
                control={uploadForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Document name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={uploadForm.control}
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
                        {DOCUMENT_CATEGORIES.map((c) => (
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
                control={uploadForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional description…"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={uploadForm.control}
                name="fileUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>File URL *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://storage.example.com/doc.pdf"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={uploadForm.control}
                  name="fileSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Size (bytes)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          placeholder="1024"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={uploadForm.control}
                  name="mimeType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MIME type</FormLabel>
                      <FormControl>
                        <Input placeholder="application/pdf" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        )}

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
            form="doc-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEditing ? "Save changes" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
