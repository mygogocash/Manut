"use client";

import { Loader2, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ApiError } from "@/lib/api-client";
import { listRoleMembers, type RoleMember } from "@/services/role.service";

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

interface RoleMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleId: string | null;
  roleName: string;
}

export function RoleMembersDialog({
  open,
  onOpenChange,
  roleId,
  roleName,
}: RoleMembersDialogProps) {
  const [members, setMembers] = useState<RoleMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || !roleId) {
      setMembers([]);
      setSearch("");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const res = await listRoleMembers(roleId);
        if (!cancelled) setMembers(res.data);
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Failed to load role members";
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, roleId]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? members.filter((m) => {
        return (
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.jobTitle?.toLowerCase().includes(q) ?? false) ||
          (m.department?.toLowerCase().includes(q) ?? false) ||
          (m.entity?.name.toLowerCase().includes(q) ?? false)
        );
      })
    : members;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Members of {roleName}</DialogTitle>
          <DialogDescription>
            {loading
              ? "Loading members…"
              : `${members.length} active ${members.length === 1 ? "person holds" : "people hold"} this role.`}
          </DialogDescription>
        </DialogHeader>

        {!loading && members.length > 0 && (
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, job, department…"
            className="h-9 text-xs"
          />
        )}

        <ScrollArea className="max-h-[60vh]">
          <div className="flex flex-col">
            {loading ? (
              <div
                className={`
                  text-muted-foreground flex items-center justify-center gap-2
                  py-10 text-xs
                `}
              >
                <Loader2 className="size-3.5 animate-spin" />
                Loading…
              </div>
            ) : members.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center text-sm">
                No active members hold this role.
              </p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center text-xs">
                No matches for &quot;{search}&quot;.
              </p>
            ) : (
              filtered.map((m) => (
                <div
                  key={m.id}
                  className={`
                    hover:bg-accent
                    flex items-center gap-3 rounded-md px-2 py-2 text-sm
                  `}
                >
                  <Avatar className="size-9">
                    {m.avatarUrl ? (
                      <AvatarImage src={m.avatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback className="text-xs">
                      {initialsOf(m.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{m.name}</span>
                      {m.entity && (
                        <Badge variant="outline" className="text-[10px]">
                          {m.entity.code}
                        </Badge>
                      )}
                    </div>
                    <div
                      className={`
                        text-muted-foreground flex flex-wrap items-center
                        gap-x-2 gap-y-0.5 text-[11px]
                      `}
                    >
                      <span className="inline-flex items-center gap-1 truncate">
                        <Mail className="size-3" />
                        {m.email}
                      </span>
                      {m.jobTitle && (
                        <span className="truncate">· {m.jobTitle}</span>
                      )}
                      {m.department && (
                        <span className="truncate">· {m.department}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
