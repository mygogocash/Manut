"use client";

import { Loader2, MailPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import {
  listUnactivatedUsers,
  resendInvites,
  type UnactivatedUser,
} from "@/services/user.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

export function UnactivatedUsersDialog({ open, onOpenChange, onSent }: Props) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [rows, setRows] = useState<UnactivatedUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUnactivatedUsers();
      setRows(res.data);
      // Pre-select all by default so admin can hit Send straight away.
      setSelectedIds(new Set(res.data.map((u) => u.id)));
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to load unactivated users";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const allSelected = useMemo(
    () => rows.length > 0 && selectedIds.size === rows.length,
    [rows.length, selectedIds.size],
  );
  const someSelected = selectedIds.size > 0 && selectedIds.size < rows.length;

  function toggleAll(next: boolean) {
    setSelectedIds(next ? new Set(rows.map((u) => u.id)) : new Set());
  }

  function toggleOne(id: string, next: boolean) {
    setSelectedIds((prev) => {
      const out = new Set(prev);
      if (next) out.add(id);
      else out.delete(id);
      return out;
    });
  }

  async function handleSend() {
    if (selectedIds.size === 0) return;
    setSending(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await resendInvites(ids);
      const { sent, failed } = res.data;
      if (sent > 0) {
        toast.success(`Sent ${sent} activation email${sent === 1 ? "" : "s"}`);
      }
      if (failed.length > 0) {
        toast.error(
          `${failed.length} failed: ${failed
            .slice(0, 3)
            .map((f) => f.reason)
            .join(", ")}${failed.length > 3 ? "…" : ""}`,
        );
      }
      onSent?.();
      // Refresh the list — the ones we just sent should now have an
      // auth account; they still won't be "activated" until they sign
      // in, so they'll likely re-appear with hasAuthAccount=true.
      await load();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to send invites";
      toast.error(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`
          max-h-[90vh] overflow-hidden
          sm:max-w-3xl
        `}
      >
        <DialogHeader>
          <DialogTitle>Send activation emails</DialogTitle>
          <DialogDescription>
            Employees below have an active profile but have never signed in.
            Review the list, deselect anyone you want to skip, then send each
            selected person a fresh welcome email with a new temporary password.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto">
          {loading ? (
            <div
              className={`
                text-muted-foreground flex items-center justify-center gap-2
                py-12 text-sm
              `}
            >
              <Loader2 className="size-4 animate-spin" />
              Checking who hasn&apos;t activated yet…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center text-sm">
              Everyone has signed in at least once. Nothing to send.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      data-state={someSelected ? "indeterminate" : undefined}
                      onCheckedChange={(v) => toggleAll(v === true)}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Dept / Title</TableHead>
                  <TableHead className="w-32">Auth account</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => {
                  const checked = selectedIds.has(u.id);
                  return (
                    <TableRow
                      key={u.id}
                      className="cursor-pointer"
                      onClick={() => toggleOne(u.id, !checked)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleOne(u.id, v === true)}
                          aria-label={`Select ${u.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-7">
                            <AvatarImage src={u.avatarUrl ?? undefined} />
                            <AvatarFallback className="text-[10px]">
                              {initials(u.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="leading-tight">
                            <div className="text-sm font-medium">{u.name}</div>
                            <div className="text-muted-foreground text-[11px]">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-foreground text-xs">
                          {u.department ?? "—"}
                        </div>
                        <div className="text-muted-foreground text-[11px]">
                          {u.jobTitle ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.hasAuthAccount ? (
                          <Badge variant="grey" className="text-[10px]">
                            Never signed in
                          </Badge>
                        ) : (
                          <Badge variant="red" className="text-[10px]">
                            No auth account
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter className="border-border border-t pt-3">
          <div className="text-muted-foreground mr-auto text-xs">
            {selectedIds.size} of {rows.length} selected
          </div>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || selectedIds.size === 0 || loading}
          >
            {sending ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <MailPlus className="mr-1 size-3.5" />
            )}
            Send {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
