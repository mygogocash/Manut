"use client";

import { Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { type AssignableUser } from "@/services/directory.service";
import {
  type PartnerMember,
  setPartnerMembers,
} from "@/services/partner-workspace.service";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: string;
  users: AssignableUser[];
  currentMembers: PartnerMember[];
  onSaved: (members: PartnerMember[]) => void;
}

export function PartnerMembersDialog({
  open,
  onOpenChange,
  partnerId,
  users,
  currentMembers,
  onSaved,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(currentMembers.map((m) => m.userId)));
    setSearch("");
  }, [open, currentMembers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, search]);

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await setPartnerMembers(partnerId, {
        userIds: Array.from(selected),
      });
      toast.success(`Members updated — ${res.data.length} on this partner`);
      onSaved(res.data);
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to update members";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Members</DialogTitle>
          <DialogDescription>
            Pick the teammates who should see this partner workspace.{" "}
            {selected.size} selected.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search
            className={`
              text-muted-foreground pointer-events-none absolute top-1/2
              left-2.5 size-3.5 -translate-y-1/2
            `}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="h-9 pl-8 text-xs"
          />
        </div>
        <div
          className={`
            scrollbar-thin scrollbar-thumb-border max-h-[260px] overflow-y-auto
            rounded-lg border
          `}
        >
          <div className="flex flex-col py-1">
            {filtered.map((u) => {
              const checked = selected.has(u.id);
              return (
                <label
                  key={u.id}
                  className={`
                    flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs
                    transition-colors
                    ${checked ? "bg-primary/5" : "hover:bg-muted/60"}
                  `}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(u.id)}
                  />
                  <Avatar className="size-6">
                    <AvatarFallback className="text-[9px] font-semibold">
                      {getInitials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{u.name}</span>
                    <span className="text-muted-foreground truncate text-[10px]">
                      {u.email}
                    </span>
                  </div>
                </label>
              );
            })}
            {filtered.length === 0 && (
              <p className={`text-muted-foreground py-6 text-center text-xs`}>
                {search.trim() ? "No matches" : "No users available"}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
