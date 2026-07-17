"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { format, parseISO } from "date-fns";
import { ImagePlus, Plus, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { DatePicker } from "@/components/shared/date-picker";
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
import { ApiError } from "@/lib/api-client";
import { type Article, createArticle } from "@/services/article.service";
import { uploadFile } from "@/services/upload.service";

const prSchema = z.object({
  title: z
    .string()
    .min(2, "Title must be at least 2 characters")
    .max(500, "Title must be at most 500 characters"),
  link: z.string().url("Please enter a valid URL"),
  date: z.string().min(1, "Date is required"),
  img: z.instanceof(File, { message: "Image is required" }),
});

interface CreatePRDialogProps {
  onPRCreated?: (article: Article) => void;
}

export function CreatePRDialog({ onPRCreated }: CreatePRDialogProps) {
  const [open, setOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    resolver: standardSchemaResolver(prSchema),
    defaultValues: {
      title: "",
      link: "",
      date: new Date().toISOString().split("T")[0],
    },
  });

  async function onSubmit(values: z.infer<typeof prSchema>) {
    try {
      setLoading(true);
      const uploaded = await uploadFile(values.img, {
        bucket: "article",
        purpose: "article-image",
      });

      const res = await createArticle({
        title: values.title.trim(),
        link: values.link.trim(),
        date: values.date,
        img: uploaded.url,
      });

      onPRCreated?.(res.data);
      toast.success("PR article created successfully!");
      form.reset({
        title: "",
        link: "",
        date: new Date().toISOString().split("T")[0],
      });
      setImagePreview(null);
      setOpen(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to create article";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue("img", file, { shouldValidate: true });
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    form.resetField("img");
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDialogChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      form.reset({
        title: "",
        link: "",
        date: new Date().toISOString().split("T")[0],
      });
      setImagePreview(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>
        <Button variant="accent" className="min-w-36">
          <Plus className="size-4" />
          Create PR
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New PR Article</DialogTitle>
          <DialogDescription>
            Add a new PR article to the list.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter article title..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://example.com/article"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <DatePicker
                      value={
                        field.value
                          ? parseISO(`${field.value}T12:00:00`)
                          : undefined
                      }
                      onChange={(d) =>
                        field.onChange(d ? format(d, "yyyy-MM-dd") : "")
                      }
                      placeholder="Select date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="img"
              render={() => (
                <FormItem>
                  <FormLabel>Image</FormLabel>
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
                            alt="Preview"
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
                            Click to upload image
                          </p>
                        </Button>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
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
                Create
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
