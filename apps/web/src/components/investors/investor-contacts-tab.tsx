"use client";

import {
  Archive,
  ArchiveRestore,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPagination } from "@/components/shared/data-pagination";
import { PermissionButton } from "@/components/shared/permission-button";
import { Tabs } from "@/components/shared/tabs";
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
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { useFundraisingEntity } from "@/providers/fundraising-entity-provider";
import { listInvestorAccounts } from "@/services/investor-account.service";
import {
  archiveInvestorContact,
  createInvestorContact,
  deleteInvestorContact,
  type InvestorContact,
  listInvestorContacts,
  unarchiveInvestorContact,
  updateInvestorContact,
} from "@/services/investor-contact.service";

interface AccountOption {
  id: string;
  name: string;
}

function fullName(c: InvestorContact): string {
  return [c.firstName, c.lastName].filter(Boolean).join(" ");
}

export function InvestorContactsTab() {
  const { hasPermission } = useAuth();
  const { entityKey } = useFundraisingEntity();
  const canCreate = hasPermission("investors:create");
  const canUpdate = hasPermission("investors:update");
  const canDelete = hasPermission("investors:delete");

  const [contacts, setContacts] = useState<InvestorContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Active (default) vs Archived view. Archived rows are hidden from the
  // default list; the switch flips the server-side archivedAt filter.
  const [archived, setArchived] = useState(false);
  const [accountOptions, setAccountOptions] = useState<AccountOption[]>([]);
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
  const [editing, setEditing] = useState<InvestorContact | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listInvestorContacts({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        archived: archived || undefined,
        fundraisingEntity: entityKey,
      });
      setContacts(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load contacts";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, archived, entityKey, setTotalCount]);

  useEffect(() => {
    void fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, archived, entityKey, setPage]);

  useEffect(() => {
    listInvestorAccounts({ limit: 200, fundraisingEntity: entityKey })
      .then((r) =>
        setAccountOptions(r.data.map((a) => ({ id: a.id, name: a.name }))),
      )
      .catch(() => undefined);
  }, [entityKey]);

  async function remove(c: InvestorContact) {
    if (!canDelete || !window.confirm(`Delete contact "${fullName(c)}"?`)) {
      return;
    }
    const previous = contacts;
    setContacts((prev) => prev.filter((x) => x.id !== c.id));
    try {
      await deleteInvestorContact(c.id);
      toast.success("Contact deleted");
    } catch (err) {
      setContacts(previous);
      const msg =
        err instanceof ApiError ? err.message : "Failed to delete contact";
      toast.error(msg);
    }
  }

  // Archive / restore. The row's new state is the opposite of the current
  // view, so it leaves the visible list either way — drop it optimistically
  // and decrement the total, restoring on failure.
  async function archiveRow(c: InvestorContact) {
    if (!canUpdate) return;
    const previous = contacts;
    const previousTotal = totalCount;
    setContacts((prev) => prev.filter((x) => x.id !== c.id));
    setTotalCount(Math.max(0, previousTotal - 1));
    try {
      await archiveInvestorContact(c.id);
      toast.success("Contact archived");
    } catch (err) {
      setContacts(previous);
      setTotalCount(previousTotal);
      const msg =
        err instanceof ApiError ? err.message : "Failed to archive contact";
      toast.error(msg);
    }
  }

  async function unarchiveRow(c: InvestorContact) {
    if (!canUpdate) return;
    const previous = contacts;
    const previousTotal = totalCount;
    setContacts((prev) => prev.filter((x) => x.id !== c.id));
    setTotalCount(Math.max(0, previousTotal - 1));
    try {
      await unarchiveInvestorContact(c.id);
      toast.success("Contact restored");
    } catch (err) {
      setContacts(previous);
      setTotalCount(previousTotal);
      const msg =
        err instanceof ApiError ? err.message : "Failed to restore contact";
      toast.error(msg);
    }
  }

  const skeleton = Array.from({ length: Math.min(pageSize, 6) });

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        tabs={[
          { id: "active", label: "Active" },
          { id: "archived", label: "Archived" },
        ]}
        active={archived ? "archived" : "active"}
        onChange={(v) => setArchived(v === "archived")}
      />

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
            placeholder="Search contacts…"
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
          New contact
        </PermissionButton>
      </div>

      <Table containerClassName="max-h-[60svh] md:max-h-[calc(100vh-340px)] overflow-auto rounded-lg border">
        <TableHeader className="bg-background sticky top-0 z-10">
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Account</TableHead>
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
          ) : contacts.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-muted-foreground py-10 text-center text-xs"
              >
                No contacts yet
              </TableCell>
            </TableRow>
          ) : (
            contacts.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="text-sm font-medium">
                  {fullName(c)}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {c.title ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {c.email ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {c.phone ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {c.account?.name ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {c.owner?.name ?? "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {canUpdate ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(c);
                          setFormOpen(true);
                        }}
                        aria-label="Edit contact"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    ) : null}
                    {canUpdate ? (
                      archived ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void unarchiveRow(c)}
                          aria-label="Restore contact"
                        >
                          <ArchiveRestore className="size-3.5" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void archiveRow(c)}
                          aria-label="Archive contact"
                        >
                          <Archive className="size-3.5" />
                        </Button>
                      )
                    ) : null}
                    {canDelete ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void remove(c)}
                        aria-label="Delete contact"
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

      <ContactFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editing}
        accountOptions={accountOptions}
        canSubmit={editing ? canUpdate : canCreate}
        onSaved={() => {
          setFormOpen(false);
          void fetchContacts();
        }}
      />
    </div>
  );
}

function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  accountOptions,
  canSubmit,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contact: InvestorContact | null;
  accountOptions: AccountOption[];
  canSubmit: boolean;
  onSaved: () => void;
}) {
  const { entities, entityKey, entityLabel } = useFundraisingEntity();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [accountId, setAccountId] = useState("");
  const [entity, setEntity] = useState(entityKey);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFirstName(contact?.firstName ?? "");
    setLastName(contact?.lastName ?? "");
    setEmail(contact?.email ?? "");
    setPhone(contact?.phone ?? "");
    setTitle(contact?.title ?? "");
    setAccountId(contact?.accountId ?? "");
    setEntity(contact?.fundraisingEntity ?? entityKey);
  }, [open, contact, entityKey]);

  async function submit() {
    if (!firstName.trim()) {
      toast.error("First name is required");
      return;
    }
    try {
      setSaving(true);
      if (contact) {
        const moved = entity !== contact.fundraisingEntity;
        await updateInvestorContact(contact.id, {
          firstName: firstName.trim(),
          lastName: lastName.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          title: title.trim() || null,
          accountId: accountId || null,
          fundraisingEntity: entity,
        });
        // A move drops the row out of the active tab — name the
        // destination so the disappearance reads as intentional.
        toast.success(
          moved ? `Moved to ${entityLabel(entity)}` : "Contact updated",
        );
      } else {
        await createInvestorContact({
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          title: title.trim() || undefined,
          accountId: accountId || undefined,
          fundraisingEntity: entity,
        });
        toast.success("Contact created");
      }
      onSaved();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to save contact";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "New contact"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-first">First name</Label>
              <Input
                id="contact-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-last">Last name</Label>
              <Input
                id="contact-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-title">Title</Label>
            <Input
              id="contact-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Partner, Analyst…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input
                id="contact-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-entity">Entity</Label>
            <select
              id="contact-entity"
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              className={`
                border-border bg-background h-9 rounded-md border px-2 text-sm
              `}
            >
              {entities.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-account">Account (optional)</Label>
            <select
              id="contact-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={`
                border-border bg-background h-9 rounded-md border px-2 text-sm
              `}
            >
              <option value="">No account</option>
              {accountOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
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
            {contact ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
