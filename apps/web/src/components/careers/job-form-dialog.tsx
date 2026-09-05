"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import slugify from "slugify";
import { toast } from "sonner";
import { z } from "zod";

import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
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
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api-client";
import { createJob, type Job } from "@/services/career.service";

const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Internship"] as const;

const schema = z.object({
  title: z
    .string()
    .min(2, "Title must be at least 2 characters")
    .max(250, "Title must be at most 250 characters"),
  slug: z.string().optional(),
  type: z.string().min(1, "Job type is required"),
  location: z.string().min(1, "Location is required"),
  department: z.string().min(1, "Department is required"),
  description: z.string().min(2, "Description must be at least 2 characters"),
  active: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface JobFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (job: Job) => void;
}

export function JobFormDialog({
  open,
  onOpenChange,
  onCreated,
}: JobFormDialogProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      slug: "",
      type: "Full-time",
      location: "",
      department: "",
      description: "",
      active: true,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: "",
        slug: "",
        type: "Full-time",
        location: "",
        department: "",
        description: "",
        active: true,
      });
    }
  }, [open, form]);

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const slugTrim = values.slug?.trim();
      const res = await createJob({
        title: values.title,
        slug: slugTrim && slugTrim.length > 0 ? slugTrim : undefined,
        type: values.type,
        location: values.location,
        department: values.department,
        description: values.description,
        active: values.active,
      });
      toast.success("Job created successfully!");
      onOpenChange(false);
      onCreated(res.data);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to create job posting";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`
          top-[5vh] max-h-[90vh] translate-y-0 overflow-y-auto
          sm:max-w-4xl
        `}
      >
        <DialogHeader>
          <DialogTitle>Create New Job</DialogTitle>
          <DialogDescription>
            Fill in the details below to create a new job posting.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter job title..."
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value;
                        form.setValue(
                          "slug",
                          slugify(value, { lower: true, strict: true }),
                        );
                        field.onChange(e);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="auto-generated-slug"
                      {...field}
                      disabled
                      readOnly
                      className="bg-muted/50 text-muted-foreground"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Engineering" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {JOB_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Remote, Bangkok" {...field} />
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
                  <FormLabel>Job Description</FormLabel>
                  <FormControl>
                    <div className="[&_.ql-editor]:min-h-[280px]">
                      <RichTextEditor
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Write the job description here..."
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem
                  className={`
                    flex flex-row items-center justify-between rounded-lg border
                    p-4
                  `}
                >
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Publish Status</FormLabel>
                    <p className="text-muted-foreground text-sm">
                      {field.value
                        ? "Job will be visible to applicants"
                        : "Job will be saved as draft"}
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

            <div className="flex items-center justify-end gap-4 pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="min-w-24">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" className="min-w-32" disabled={loading}>
                {loading ? <Spinner /> : <Plus className="size-4" />}
                Create Job
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
