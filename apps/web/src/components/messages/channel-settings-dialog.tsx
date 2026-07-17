"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2, Settings, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import type { Channel } from "@/services/message.service";
import * as messageService from "@/services/message.service";

const settingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Channel name is required")
    .max(100, "Name must be at most 100 characters"),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export function ChannelSettingsDialog({
  channel,
  canManage,
  onUpdated,
  onDeleted,
}: {
  channel: Channel;
  canManage: boolean;
  onUpdated: (channel: Channel) => void;
  onDeleted: (channelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const form = useForm<SettingsFormValues>({
    resolver: standardSchemaResolver(settingsSchema),
    defaultValues: { name: channel.name },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: channel.name });
    }
  }, [open, channel.name, form]);

  async function onSubmit(values: SettingsFormValues) {
    if (!canManage) return;
    setSaving(true);
    try {
      const res = await messageService.updateChannel(channel.id, {
        name: values.name.trim(),
      });
      onUpdated(res.data);
      toast.success("Channel updated");
      setOpen(false);
    } catch {
      toast.error("Failed to update channel");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!canManage) return;
    setDeleting(true);
    try {
      await messageService.deleteChannel(channel.id);
      onDeleted(channel.id);
      toast.success("Channel deleted");
      setDeleteOpen(false);
      setOpen(false);
    } catch {
      toast.error("Failed to delete channel");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-7"
            aria-label="Channel settings"
          >
            <Settings size={14} />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Channel Settings</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-3 py-2"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Channel Name</FormLabel>
                    <FormControl>
                      <Input
                        maxLength={100}
                        disabled={!canManage || saving}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!canManage && (
                <p className="text-muted-foreground text-xs">
                  You do not have permission to manage this channel.
                </p>
              )}

              <DialogFooter
                className={`
                  flex-col-reverse gap-2
                  sm:flex-row sm:justify-between
                `}
              >
                {canManage ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                    disabled={saving || deleting}
                  >
                    <Trash2 size={14} className="mr-1" />
                    Delete channel
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!canManage || saving}>
                    {saving && (
                      <Loader2 size={14} className="mr-1 animate-spin" />
                    )}
                    Save
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this channel?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes #{channel.name} and all its messages for
              everyone. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
            >
              {deleting && <Loader2 size={14} className="mr-1 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
