"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Plus, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
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
  DialogTrigger,
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
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api-client";
import { type Blog, createBlog } from "@/services/blog.service";
import { uploadFile } from "@/services/upload.service";

const blogSchema = z.object({
  title: z
    .string()
    .min(2, "Title must be at least 2 characters")
    .max(250, "Title must be at most 250 characters"),
  slug: z.string().optional(),
  coverImage: z.instanceof(File, { message: "Cover image is required" }),
  content: z.string().min(2, "Content must be at least 2 characters"),
  status: z.boolean(),
});

interface CreateBlogDialogProps {
  onBlogCreated?: (blog: Blog) => void;
}

export function CreateBlogDialog({ onBlogCreated }: CreateBlogDialogProps) {
  const [open, setOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    resolver: zodResolver(blogSchema),
    defaultValues: {
      title: "",
      slug: "",
      content: "",
      status: true,
    },
  });

  async function onSubmit(values: z.infer<typeof blogSchema>) {
    try {
      setLoading(true);
      const uploaded = await uploadFile(values.coverImage, {
        bucket: "blog",
        purpose: "blog-cover",
      });

      const res = await createBlog({
        title: values.title.trim(),
        content: values.content.trim(),
        coverImage: uploaded.url,
        slug: values.slug?.trim() || undefined,
        active: values.status,
      });

      onBlogCreated?.(res.data);
      toast.success("Blog created successfully!");
      form.reset({ title: "", slug: "", content: "", status: true });
      form.resetField("coverImage");
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setOpen(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to create blog";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue("coverImage", file, { shouldValidate: true });
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    form.resetField("coverImage");
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDialogChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      form.reset({ title: "", slug: "", content: "", status: true });
      form.resetField("coverImage");
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>
        <Button variant="accent">
          <Plus className="size-4" />
          Add New Blog
        </Button>
      </DialogTrigger>

      <DialogContent
        className={`
          top-[5vh] max-h-[90vh] translate-y-0 overflow-y-auto
          sm:max-w-4xl
        `}
      >
        <DialogHeader>
          <DialogTitle>Create New Blog</DialogTitle>
          <DialogDescription>
            Fill in the details below to create a new blog post.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Blog Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter blog title..."
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

            <FormField
              control={form.control}
              name="coverImage"
              render={() => (
                <FormItem>
                  <FormLabel>Cover Image</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />

                      {imagePreview ? (
                        <div className="relative h-56 w-full">
                          <Image
                            src={imagePreview}
                            alt="Cover preview"
                            fill
                            className="rounded-lg border object-cover"
                            sizes="100vw"
                            unoptimized
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 size-8"
                            onClick={handleRemoveImage}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className={`
                            border-muted-foreground/25 flex h-48 w-full flex-col
                            items-center justify-center gap-2 rounded-lg
                            border-2 border-dashed
                            hover:border-muted-foreground/50
                          `}
                        >
                          <ImagePlus className="text-muted-foreground size-10" />
                          <p className="text-muted-foreground text-sm">
                            Click to upload cover image
                          </p>
                        </Button>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Blog Content</FormLabel>
                  <FormControl>
                    <div className="[&_.ql-editor]:min-h-[280px]">
                      <RichTextEditor
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Write your blog content here..."
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
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
                        ? "Blog will be visible to users"
                        : "Blog will be saved as draft"}
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
                Create Blog
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
