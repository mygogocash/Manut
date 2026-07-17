"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { ImagePlus, Pencil, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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
import { type Blog, updateBlog } from "@/services/blog.service";
import { uploadFile } from "@/services/upload.service";

const updateBlogSchema = z.object({
  title: z
    .string()
    .min(2, "Title must be at least 2 characters")
    .max(250, "Title must be at most 250 characters"),
  slug: z.string().optional(),
  coverImage: z.instanceof(File).optional(),
  content: z.string().min(2, "Content must be at least 2 characters"),
  status: z.boolean(),
});

interface UpdateBlogDialogProps {
  blog: Blog;
  onBlogUpdated?: (blog: Blog) => void;
  trigger?: React.ReactNode;
}

export function UpdateBlogDialog({
  blog,
  onBlogUpdated,
  trigger,
}: UpdateBlogDialogProps) {
  const [open, setOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    resolver: standardSchemaResolver(updateBlogSchema),
    defaultValues: {
      title: blog.title || "",
      slug: blog.slug || "",
      content: blog.content || "",
      status: blog.active ?? true,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: blog.title || "",
        slug: blog.slug || "",
        content: blog.content || "",
        status: blog.active ?? true,
      });
      setImagePreview(blog.coverImage || null);
    }
  }, [blog, open, form]);

  async function onSubmit(values: z.infer<typeof updateBlogSchema>) {
    try {
      setLoading(true);

      let coverImageUrl = blog.coverImage;
      const newCoverFile = values.coverImage;
      if (newCoverFile) {
        const uploaded = await uploadFile(newCoverFile, {
          bucket: "blog",
          purpose: "blog-cover",
        });
        coverImageUrl = uploaded.url;
      }

      const res = await updateBlog(blog.id, {
        title: values.title.trim(),
        content: values.content.trim(),
        coverImage: coverImageUrl,
        slug: values.slug?.trim() || undefined,
        active: values.status,
      });

      onBlogUpdated?.(res.data);
      toast.success("Blog updated successfully!");
      setOpen(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update blog";
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
    setImagePreview(blog.coverImage || null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDialogChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      form.reset({
        title: blog.title || "",
        slug: blog.slug || "",
        content: blog.content || "",
        status: blog.active ?? true,
      });
      setImagePreview(blog.coverImage || null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            Edit
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        className={`
          top-[5vh] max-h-[90vh] translate-y-0 overflow-y-auto
          sm:max-w-4xl
        `}
      >
        <DialogHeader>
          <DialogTitle>Update Blog</DialogTitle>
          <DialogDescription>
            Edit the details below to update this blog post.
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
                        <div className="relative aspect-video w-full">
                          <Image
                            src={imagePreview}
                            alt="Cover preview"
                            fill
                            className="rounded-lg border object-cover"
                            sizes="100vw"
                            unoptimized
                          />
                          <div className="absolute top-2 right-2 flex gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              className="size-8"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            {form.getValues("coverImage") && (
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="size-8"
                                onClick={handleRemoveImage}
                              >
                                <X className="size-4" />
                              </Button>
                            )}
                          </div>
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
                {loading ? <Spinner /> : <Pencil className="size-4" />}
                Update Blog
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
