"use client";

import { Loader2, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { ApiError } from "@/lib/api-client";
import { listDirectory } from "@/services/directory.service";
import {
  grantWikiPagePermission,
  listWikiPagePermissions,
  revokeWikiPagePermission,
  type WikiPagePermission,
  type WikiPagePermissionLevel,
} from "@/services/docs.service";

interface PermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string | null;
  pageTitle: string;
  isRestricted: boolean;
}

interface CandidateUser {
  id: string;
  name: string;
  email: string;
}

export function PermissionsDialog({
  open,
  onOpenChange,
  pageId,
  pageTitle,
  isRestricted,
}: PermissionsDialogProps) {
  const [loading, setLoading] = useState(true);
  const [perms, setPerms] = useState<WikiPagePermission[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [candidates, setCandidates] = useState<CandidateUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickedLevel, setPickedLevel] =
    useState<WikiPagePermissionLevel>("read");
  const [grantingId, setGrantingId] = useState<string | null>(null);

  const grantedIds = useMemo(
    () => new Set(perms.map((p) => p.userId)),
    [perms],
  );

  useEffect(() => {
    if (!open || !pageId) return;
    let cancelled = false;
    setLoading(true);
    listWikiPagePermissions(pageId)
      .then((res) => {
        if (!cancelled) setPerms(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError ? err.message : "Failed to load permissions";
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, pageId]);

  useEffect(() => {
    if (!open) return;
    if (!debouncedSearch) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    listDirectory({ search: debouncedSearch, limit: 10 })
      .then((res) => {
        if (cancelled) return;
        setCandidates(
          res.data
            .filter((u) => u.isActive)
            .map((u) => ({ id: u.id, name: u.name, email: u.email })),
        );
      })
      .catch(() => {
        if (!cancelled) setCandidates([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, debouncedSearch]);

  async function handleGrant(user: CandidateUser) {
    if (!pageId) return;
    try {
      setGrantingId(user.id);
      const res = await grantWikiPagePermission(pageId, user.id, pickedLevel);
      // Replace the existing entry if upserted, otherwise append.
      setPerms((prev) => {
        const filtered = prev.filter((p) => p.userId !== user.id);
        return [...filtered, res.data];
      });
      toast.success(`${user.name} can now ${pickedLevel}`);
      setSearch("");
      setCandidates([]);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to grant access";
      toast.error(message);
    } finally {
      setGrantingId(null);
    }
  }

  async function handleRevoke(perm: WikiPagePermission) {
    if (!pageId) return;
    try {
      await revokeWikiPagePermission(pageId, perm.id);
      setPerms((prev) => prev.filter((p) => p.id !== perm.id));
      toast.success(`Removed ${perm.user.name}`);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to revoke access";
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4" /> Page access
          </DialogTitle>
          <DialogDescription>
            {isRestricted
              ? `Only listed users (plus admins and the creator) can see "${pageTitle}".`
              : `"${pageTitle}" is open to anyone with docs:read. Toggle "Restricted access" on the page to enforce this list.`}
          </DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium" htmlFor="docs-perm-search">
              Add user
            </label>
            <div className="flex gap-2">
              <Input
                id="docs-perm-search"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 text-sm"
              />
              <Select
                value={pickedLevel}
                onValueChange={(v) =>
                  setPickedLevel(v as WikiPagePermissionLevel)
                }
              >
                <SelectTrigger className="h-9 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="edit">Edit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {debouncedSearch ? (
              <div
                className={`
                  border-border max-h-44 overflow-y-auto rounded-md border
                `}
              >
                {searching ? (
                  <div className="flex justify-center py-3">
                    <Loader2
                      className={`text-muted-foreground size-4 animate-spin`}
                    />
                  </div>
                ) : candidates.length === 0 ? (
                  <p
                    className={`text-muted-foreground py-3 text-center text-xs`}
                  >
                    No users matched.
                  </p>
                ) : (
                  candidates.map((u) => {
                    const already = grantedIds.has(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        disabled={already || grantingId === u.id}
                        onClick={() => void handleGrant(u)}
                        className={`
                          flex w-full items-center justify-between gap-3 px-3
                          py-2 text-left text-xs
                          ${
                            already
                              ? "text-muted-foreground"
                              : `hover:bg-muted/40`
                          }
                        `}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{u.name}</p>
                          <p
                            className={`
                              text-muted-foreground truncate text-[11px]
                            `}
                          >
                            {u.email}
                          </p>
                        </div>
                        {already ? (
                          <span className="text-[10px] uppercase">Added</span>
                        ) : grantingId === u.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="size-3.5" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium">Granted</p>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="text-muted-foreground size-4 animate-spin" />
              </div>
            ) : perms.length === 0 ? (
              <p className={`text-muted-foreground py-4 text-center text-xs`}>
                No explicit grants yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {perms.map((p) => (
                  <li
                    key={p.id}
                    className={`
                      border-border flex items-center justify-between gap-2
                      rounded-md border px-3 py-1.5 text-xs
                    `}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.user.name}</p>
                      <p className="text-muted-foreground truncate text-[11px]">
                        {p.user.email}
                      </p>
                    </div>
                    <span
                      className={`
                        bg-muted rounded px-1.5 py-0.5 text-[10px] uppercase
                      `}
                    >
                      {p.level}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void handleRevoke(p)}
                      title="Remove access"
                    >
                      <Trash2 className="text-destructive size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
