"use client";

import { Check, Loader2, MessageSquarePlus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Channel, MessageableUser } from "@/services/message.service";
import * as messageService from "@/services/message.service";

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function NewDmDialog({
  peers,
  onCreated,
}: {
  peers: MessageableUser[];
  onCreated: (channel: Channel) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelected(new Set());
      setSubmitting(false);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return peers;
    return peers.filter((p) => p.name.toLowerCase().includes(q));
  }, [peers, query]);

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      const res = await messageService.createDirectMessage(
        Array.from(selected),
      );
      onCreated(res.data);
      setOpen(false);
    } catch {
      toast.error("Failed to start direct message");
    } finally {
      setSubmitting(false);
    }
  }

  const summary =
    selected.size === 0 ? "Select people" : `${selected.size} selected`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label="New direct message"
        >
          <MessageSquarePlus size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent
        className={`
          flex max-h-[min(90vh,680px)] flex-col gap-0 overflow-hidden
          sm:max-w-md
        `}
      >
        <DialogHeader className="mb-2 shrink-0">
          <DialogTitle>New Direct Message</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="relative shrink-0">
            <Search
              size={14}
              className={`
                text-muted-foreground absolute top-1/2 left-2.5 -translate-y-1/2
              `}
            />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people..."
              className="h-9 pl-8 text-sm"
            />
          </div>
          <ScrollArea
            className={`scrollbar-thin h-48 min-h-0 flex-1 overflow-y-auto`}
          >
            <div className="flex flex-col">
              {filtered.length === 0 ? (
                <p
                  className={`
                    text-muted-foreground px-3 py-6 text-center text-xs
                  `}
                >
                  {peers.length === 0
                    ? "No people available."
                    : `No matches for "${query}"`}
                </p>
              ) : (
                filtered.map((user) => {
                  const isSelected = selected.has(user.id);
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggle(user.id)}
                      disabled={submitting}
                      className={cn(
                        `
                          hover:bg-accent
                          flex items-center gap-3 px-3 py-2 text-left
                        `,
                        `
                          transition
                          disabled:opacity-50
                        `,
                        isSelected && "bg-accent",
                      )}
                    >
                      <Avatar className="size-8">
                        {user.avatarUrl ? (
                          <AvatarImage src={user.avatarUrl} alt="" />
                        ) : null}
                        <AvatarFallback className="text-xs">
                          {initialsOf(user.name)}
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
        </div>
        <DialogFooter className="shrink-0 border-t pt-3">
          <span className="text-muted-foreground mr-auto self-center text-xs">
            {summary}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={submitting || selected.size === 0}
          >
            {submitting && <Loader2 size={14} className="mr-1 animate-spin" />}
            Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
