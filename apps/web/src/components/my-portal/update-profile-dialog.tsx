"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Loader2, Save, User } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
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
import { Label } from "@/components/ui/label";
import { useDragImage } from "@/hooks/use-drag-image";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { type MyProfile, updateMyProfile } from "@/services/my-portal.service";
import { uploadFile } from "@/services/upload.service";

const formSchema = z.object({
  phone: z.string().max(20).optional(),
  location: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  timezone: z.string().max(100).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface UpdateProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: MyProfile | null;
  onSaved: () => void;
}

export function UpdateProfileDialog({
  open,
  onOpenChange,
  profile,
  onSaved,
}: UpdateProfileDialogProps) {
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();

  const {
    avatarFile,
    fileInputRef,
    handleFileChange,
    isDragging: isImageDragging,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop,
    reset: resetDragImage,
  } = useDragImage();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phone: "",
      location: "",
      country: "",
      timezone: "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        phone: profile.phone ?? "",
        location: profile.location ?? "",
        country: profile.country ?? "",
        timezone: profile.timezone ?? "",
      });
    }
  }, [profile, form]);

  async function onSubmit(values: FormValues) {
    try {
      setLoading(true);

      let avatarUrl: string | undefined;
      if (avatarFile) {
        const uploaded = await uploadFile(avatarFile, {
          bucket: "avatars",
          purpose: "my-portal-avatar",
        });
        avatarUrl = uploaded.url;
      }

      await updateMyProfile({
        phone: values.phone || undefined,
        location: values.location || undefined,
        country: values.country || undefined,
        timezone: values.timezone || undefined,
        ...(avatarUrl && { avatarUrl }),
      });

      // Refresh AuthProvider so sidebar / topbar / settings re-render
      // with the new avatar immediately. Wrapped in its own try/catch
      // — a network blip on /auth/me shouldn't roll back the
      // already-persisted profile update or surface a false-negative
      // "Failed to update profile" toast.
      try {
        await refreshUser();
      } catch {
        // AuthProvider's own refresh ticker (4-min) will eventually
        // pick up the new values; surface a soft hint instead of an
        // error.
      }

      onSaved();
      toast.success("Profile updated successfully");
      handleClose();
    } catch (err) {
      // Surface the underlying message regardless of error class.
      // `uploadFile` throws plain `Error`, `updateMyProfile` throws
      // `ApiError`. Only fall back to the generic string when neither
      // carries a usable message.
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error && err.message
            ? err.message
            : "Failed to update profile";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    form.reset();
    resetDragImage();
    onOpenChange(false);
  }

  const avatarPreview = avatarFile
    ? URL.createObjectURL(avatarFile)
    : profile?.avatarUrl;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Profile</DialogTitle>
          <DialogDescription>
            Update your avatar, contact information, and location details.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center gap-2">
              <Label
                htmlFor="portal-avatar-input"
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={cn(
                  `
                    relative flex h-28 w-28 cursor-pointer items-center
                    justify-center overflow-hidden rounded-full border-2
                    border-dashed transition-colors
                  `,
                  isImageDragging
                    ? "border-primary/70 bg-primary/5"
                    : "border-muted-foreground/30 bg-card",
                )}
              >
                <input
                  ref={fileInputRef}
                  id="portal-avatar-input"
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleFileChange}
                />
                {avatarPreview ? (
                  <Image
                    src={avatarPreview}
                    alt="Avatar"
                    sizes="112px"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <User className="text-muted-foreground h-10 w-10" />
                )}
                <div
                  className={cn(
                    `
                      absolute inset-0 flex items-center justify-center
                      rounded-full bg-black/40 opacity-0 transition-opacity
                    `,
                    "hover:opacity-100",
                    isImageDragging && "opacity-100",
                  )}
                >
                  <Camera className="h-6 w-6 text-white" />
                </div>
              </Label>
              <p className="text-muted-foreground text-xs">
                {avatarFile
                  ? avatarFile.name
                  : "Click or drag to upload avatar"}
              </p>
            </div>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+84 xxx xxx xxx" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Ho Chi Minh City" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Vietnam" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Asia/Ho_Chi_Minh" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
