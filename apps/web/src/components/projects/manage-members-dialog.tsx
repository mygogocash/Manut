"use client";

import { Loader2, Search, Users, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import type { ProjectMember } from "@/services/project.service";
import { setProjectMembers } from "@/services/project.service";
import { listUsers, type UserListItem } from "@/services/user.service";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ManageMembersDialog({
  open,
  onOpenChange,
  projectId,
  currentMembers,
  ownerId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  currentMembers: ProjectMember[];
  ownerId: string;
  onSuccess: () => void;
}) {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [search, setSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchUsers = useCallback(
    (query: string) => {
      setLoadingUsers(true);
      listUsers({ limit: 100, search: query || undefined })
        .then((res) =>
          setUsers(
            ownerId ? res.data.filter((u) => u.id !== ownerId) : res.data,
          ),
        )
        .catch(() => toast.error("Failed to load users"))
        .finally(() => setLoadingUsers(false));
    },
    [ownerId],
  );

  useEffect(() => {
    if (!open) return;
    setSelectedIds(
      currentMembers.filter((m) => m.user.id !== ownerId).map((m) => m.user.id),
    );
    setSearch("");
    fetchUsers("");
  }, [open, currentMembers, ownerId, fetchUsers]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchUsers(search), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, open, fetchUsers]);

  async function handleSave() {
    setSaving(true);
    try {
      await setProjectMembers(projectId, selectedIds);
      toast.success("Members updated");
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("Failed to update members");
    } finally {
      setSaving(false);
    }
  }

  function toggleUser(userId: string) {
    setSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  }

  const selectedCount = selectedIds.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`
          flex max-h-[85vh] flex-col gap-0 p-0
          sm:max-w-md
        `}
      >
        <DialogHeader className="px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4" />
            Manage Members
          </DialogTitle>
          <DialogDescription>
            Add or remove team members from this project.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-5">
          <div className="relative">
            <Search
              className={`
                text-muted-foreground pointer-events-none absolute top-1/2
                left-2.5 size-3.5 -translate-y-1/2
              `}
            />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pr-8 pl-8 text-xs"
            />
            {search && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSearch("")}
                className={`absolute top-1/2 right-1.5 size-6 -translate-y-1/2`}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>

          {selectedCount > 0 && (
            <p className="text-muted-foreground mt-2 text-[11px] tabular-nums">
              {selectedCount} member{selectedCount !== 1 ? "s" : ""} selected
            </p>
          )}

          <div
            className={`
              scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border
              mt-2 max-h-[320px] overflow-y-auto rounded-lg border
              hover:scrollbar-thumb-muted-foreground/30
            `}
          >
            {loadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground size-4 animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-xs">
                {search ? "No users found" : "No users available"}
              </p>
            ) : (
              <div className="flex flex-col py-1">
                {users.map((u) => {
                  const checked = selectedIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`
                        flex cursor-pointer items-center gap-2.5 px-3 py-2
                        transition-colors
                        ${checked ? "bg-primary/5" : "hover:bg-muted/60"}
                      `}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleUser(u.id)}
                      />
                      <Avatar className="size-6">
                        <AvatarFallback className="text-[9px] font-semibold">
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span
                          className={`
                            truncate text-xs leading-tight font-medium
                          `}
                        >
                          {u.name}
                        </span>
                        <span
                          className={`
                            text-muted-foreground truncate text-[10px]
                            leading-tight
                          `}
                        >
                          {u.email}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t px-5 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="min-w-24">
            {saving && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
