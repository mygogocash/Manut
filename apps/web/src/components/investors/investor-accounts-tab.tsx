"use client";

import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPagination } from "@/components/shared/data-pagination";
import { PermissionButton } from "@/components/shared/permission-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  createInvestorAccount,
  deleteInvestorAccount,
  type InvestorAccount,
  listInvestorAccounts,
  updateInvestorAccount,
} from "@/services/investor-account.service";

export function InvestorAccountsTab() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("investors:create");
  const canUpdate = hasPermission("investors:update");
  const canDelete = hasPermission("investors:delete");

  const [accounts, setAccounts] = useState<InvestorAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const {
    page,
    pageSize,
    setPage,
    setPageSize,
    setTotalCount,
    totalPages,
    totalCount,
  } = usePagination();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InvestorAccount | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listInvestorAccounts({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
      });
      setAccounts(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load accounts";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, setTotalCount]);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  async function remove(a: InvestorAccount) {
    if (!canDelete || !window.confirm(`Delete account "${a.name}"?`)) return;
    const previous = accounts;
    setAccounts((prev) => prev.filter((x) => x.id !== a.id));
    try {
      await deleteInvestorAccount(a.id);
      toast.success("Account deleted");
    } catch (err) {
      setAccounts(previous);
      const msg =
        err instanceof ApiError ? err.message : "Failed to delete account";
      toast.error(msg);
    }
  }

  const skeleton = Array.from({ length: Math.min(pageSize, 6) });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative">
          <Search
            className={`
              text-muted-foreground absolute top-1/2 left-2.5 size-3.5
              -translate-y-1/2
            `}
          />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search accounts…"
            className="h-8 w-56 pl-8 text-xs"
          />
        </div>
        <PermissionButton
          permission="investors:create"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1.5 size-3.5" />
          New account
        </PermissionButton>
      </div>

      <Table containerClassName="max-h-[calc(100vh-340px)] overflow-auto rounded-lg border">
        <TableHeader className="bg-background sticky top-0 z-10">
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Region</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Contacts</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            skeleton.map((_, i) => (
              <TableRow key={`s-${i}`}>
                <TableCell colSpan={7}>
                  <div className="bg-muted h-5 w-full animate-pulse rounded" />
                </TableCell>
              </TableRow>
            ))
          ) : accounts.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-muted-foreground py-10 text-center text-xs"
              >
                No accounts yet
              </TableCell>
            </TableRow>
          ) : (
            accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-sm font-medium">{a.name}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {a.type ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {a.region ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {a.location ?? "—"}
                </TableCell>
                <TableCell
                  className={`text-muted-foreground text-xs tabular-nums`}
                >
                  {a._count?.contacts ?? 0}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {a.owner?.name ?? "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {canUpdate ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(a);
                          setFormOpen(true);
                        }}
                        aria-label="Edit account"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void remove(a)}
                        aria-label="Delete account"
                      >
                        <Trash2 className="text-destructive size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <DataPagination
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <AccountFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        account={editing}
        canSubmit={editing ? canUpdate : canCreate}
        onSaved={() => {
          setFormOpen(false);
          void fetchAccounts();
        }}
      />
    </div>
  );
}

function AccountFormDialog({
  open,
  onOpenChange,
  account,
  canSubmit,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  account: InvestorAccount | null;
  canSubmit: boolean;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [region, setRegion] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? "");
    setType(account?.type ?? "");
    setWebsite(account?.website ?? "");
    setLocation(account?.location ?? "");
    setRegion(account?.region ?? "");
    setNotes(account?.notes ?? "");
  }, [open, account]);

  async function submit() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    const payload = {
      name: name.trim(),
      type: type.trim() || undefined,
      website: website.trim() || undefined,
      location: location.trim() || undefined,
      region: region.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    try {
      setSaving(true);
      if (account) {
        await updateInvestorAccount(account.id, payload);
        toast.success("Account updated");
      } else {
        await createInvestorAccount(payload);
        toast.success("Account created");
      }
      onSaved();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to save account";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{account ? "Edit account" : "New account"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acct-name">Name</Label>
            <Input
              id="acct-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acct-type">Type</Label>
              <Input
                id="acct-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="VC, Family Office…"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acct-region">Region</Label>
              <Input
                id="acct-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acct-location">Location</Label>
              <Input
                id="acct-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acct-website">Website</Label>
              <Input
                id="acct-website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acct-notes">Notes</Label>
            <Textarea
              id="acct-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving || !canSubmit}>
            {saving ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : null}
            {account ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
