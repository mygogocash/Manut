"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Check, Loader2, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { getInitials } from "@/components/messages/message-utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Channel, MessageableUser } from "@/services/message.service";
import * as messageService from "@/services/message.service";

const createChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Channel name is required")
    .max(100, "Name must be at most 100 characters"),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional(),
  isPrivate: z.boolean(),
});

type CreateChannelFormValues = z.infer<typeof createChannelSchema>;

const defaultValues: CreateChannelFormValues = {
  name: "",
  description: "",
  isPrivate: false,
};

export function CreateChannelDialog({
  peers,
  onCreated,
}: {
  peers: MessageableUser[];
  onCreated: (channel: Channel) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set(),
  );

  const form = useForm<CreateChannelFormValues>({
    resolver: standardSchemaResolver(createChannelSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
      setSelectedMembers(new Set());
      setMemberQuery("");
    }
  }, [open, form]);

  const filteredPeers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return peers;
    return peers.filter((p) => p.name.toLowerCase().includes(q));
  }, [peers, memberQuery]);

  function toggleMember(id: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit(values: CreateChannelFormValues) {
    setLoading(true);
    try {
      const res = await messageService.createChannel({
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        isPrivate: values.isPrivate,
        members:
          selectedMembers.size > 0 ? Array.from(selectedMembers) : undefined,
      });
      onCreated(res.data);
      setOpen(false);
      form.reset(defaultValues);
      setSelectedMembers(new Set());
      toast.success("Channel created");
    } catch {
      toast.error("Failed to create channel");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 shrink-0">
          <Plus size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent
        className={`
          flex max-h-[min(90vh,680px)] flex-col gap-0 overflow-hidden
          sm:max-w-md
        `}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>Create Channel</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div
              className={`
                flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-2
              `}
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Channel Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. general, engineering, random"
                        maxLength={100}
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
                    <FormLabel className="text-xs">
                      Description
                      <span
                        className={`text-muted-foreground/60 ml-1 font-normal`}
                      >
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What's this channel about?"
                        maxLength={500}
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isPrivate"
                render={({ field }) => (
                  <FormItem
                    className={`
                      flex flex-row items-center justify-between rounded-lg
                      border p-3
                    `}
                  >
                    <FormLabel
                      htmlFor="channel-private"
                      className="cursor-pointer text-xs font-medium"
                    >
                      Private channel
                    </FormLabel>
                    <FormControl>
                      <Switch
                        id="channel-private"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel className="text-xs">
                  Members
                  <span className="text-muted-foreground/60 ml-1 font-normal">
                    ({selectedMembers.size} selected)
                  </span>
                </FormLabel>
                <div className="relative">
                  <Search
                    size={14}
                    className={`
                      text-muted-foreground absolute top-1/2 left-2.5
                      -translate-y-1/2
                    `}
                  />
                  <Input
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    placeholder="Search people..."
                    className="h-9 pl-8 text-sm"
                  />
                </div>
                <ScrollArea className="h-48 rounded-md border">
                  <div className="flex flex-col">
                    {filteredPeers.length === 0 ? (
                      <p
                        className={`
                          text-muted-foreground px-3 py-6 text-center text-xs
                        `}
                      >
                        {peers.length === 0
                          ? "No people available."
                          : `No matches for "${memberQuery}"`}
                      </p>
                    ) : (
                      filteredPeers.map((user) => {
                        const isSelected = selectedMembers.has(user.id);
                        return (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => toggleMember(user.id)}
                            disabled={loading}
                            className={cn(
                              `
                                hover:bg-accent
                                flex items-center gap-3 px-3 py-2 text-left
                                transition
                                disabled:opacity-50
                              `,
                              isSelected && "bg-accent",
                            )}
                          >
                            <Avatar className="size-7">
                              {user.avatarUrl ? (
                                <AvatarImage src={user.avatarUrl} alt="" />
                              ) : null}
                              <AvatarFallback className="text-[10px]">
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="flex-1 truncate text-sm">
                              {user.name}
                            </span>
                            {isSelected ? (
                              <Check size={14} className="text-primary" />
                            ) : null}
                          </button>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </FormItem>
            </div>

            <DialogFooter className="shrink-0 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 size={14} className="mr-1 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
