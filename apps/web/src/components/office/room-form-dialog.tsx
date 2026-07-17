"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api-client";
import {
  type AdminRoom,
  createRoom,
  type Office,
  updateRoom,
} from "@/services/office.service";
import { uploadFile } from "@/services/upload.service";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  officeId: z.string().min(1, "Office is required"),
  capacity: z.coerce.number<number | string>().int().nonnegative(),
  amenitiesInput: z.string().max(500).optional().or(z.literal("")),
  imageUrl: z.string().max(1000).optional().or(z.literal("")),
  isActive: z.boolean(),
});

type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

function parseAmenities(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

interface RoomFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room?: AdminRoom | null;
  offices: Office[];
  onSaved: () => void;
}

export function RoomFormDialog({
  open,
  onOpenChange,
  room,
  offices,
  onSaved,
}: RoomFormDialogProps) {
  const isEditing = !!room;
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: {
      name: "",
      officeId: "",
      capacity: 0,
      amenitiesInput: "",
      imageUrl: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (room) {
      form.reset({
        name: room.name,
        officeId: room.officeId,
        capacity: room.capacity,
        amenitiesInput: room.amenities.join(", "),
        imageUrl: room.imageUrl ?? "",
        isActive: room.isActive,
      });
    } else {
      form.reset({
        name: "",
        officeId: offices[0]?.id ?? "",
        capacity: 0,
        amenitiesInput: "",
        imageUrl: "",
        isActive: true,
      });
    }
  }, [open, room, offices, form]);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    try {
      setUploadingImage(true);
      const uploaded = await uploadFile(file, {
        bucket: "uploads",
        purpose: "meeting-room-image",
      });
      form.setValue("imageUrl", uploaded.url, { shouldDirty: true });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Image upload failed";
      toast.error(message);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleRemoveImage() {
    form.setValue("imageUrl", "", { shouldDirty: true });
  }

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const payload = {
        officeId: values.officeId,
        name: values.name,
        capacity: values.capacity,
        amenities: parseAmenities(values.amenitiesInput),
        imageUrl: values.imageUrl || null,
        isActive: values.isActive,
      };
      if (isEditing) {
        await updateRoom(room.id, payload);
        toast.success("Room updated");
      } else {
        await createRoom(payload);
        toast.success("Room created");
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit room" : "New room"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update details for "${room.name}".`
              : "Add a meeting room that employees can book."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="room-form"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Atlas" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="officeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Office *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select office" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {offices.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                          {o.city ? ` · ${o.city}` : ""}
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
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacity</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amenitiesInput"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amenities</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="TV, Whiteboard, Conf phone"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Comma-separated. Each entry shows as a tag in the booking
                    view.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room picture</FormLabel>
                  <div className="flex items-start gap-3">
                    {field.value ? (
                      <div
                        role="img"
                        aria-label="Room preview"
                        style={{ backgroundImage: `url(${field.value})` }}
                        className={`
                          border-border size-20 shrink-0 rounded-md border
                          bg-cover bg-center
                        `}
                      />
                    ) : (
                      <div
                        className={`
                          border-border bg-muted/40 text-muted-foreground flex
                          size-20 shrink-0 items-center justify-center
                          rounded-md border border-dashed
                        `}
                      >
                        <ImageIcon className="size-5" />
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageSelect}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={uploadingImage}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {uploadingImage ? (
                            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                          ) : (
                            <Upload className="mr-1.5 size-3.5" />
                          )}
                          {field.value ? "Replace" : "Upload"}
                        </Button>
                        {field.value && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={handleRemoveImage}
                          >
                            <X className="mr-1 size-3.5" />
                            Remove
                          </Button>
                        )}
                      </div>
                      <FormDescription>
                        Shown on the booking grid so staff can recognise the
                        room.
                      </FormDescription>
                    </div>
                  </div>
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
                    border-border flex items-center justify-between rounded-md
                    border px-3 py-2
                  `}
                >
                  <div>
                    <FormLabel className="text-sm">Active</FormLabel>
                    <p className="text-muted-foreground text-[11px]">
                      Inactive rooms are hidden from the booking grid.
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
            form="room-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEditing ? "Save changes" : "Create room"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
