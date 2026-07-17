"use client";

import { format } from "date-fns";
import { Edit, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ContactDetailSheet } from "@/components/sales-revenue/contact-detail-sheet";
import { ContactFormDialog } from "@/components/sales-revenue/contact-form-dialog";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { PermissionButton } from "@/components/shared/permission-button";
import { PermissionDropdownMenuItem } from "@/components/shared/permission-dropdown-menu-item";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { type Account, listAccounts } from "@/services/revenue-account.service";
import {
  type Contact,
  deleteContact,
  listContacts,
} from "@/services/revenue-contact.service";

const ALL = "__all__";

export function ContactsTab() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const debouncedSearch = useDebounce(search, 300);
  const pagination = usePagination();
  const { page, pageSize, setTotalCount } = pagination;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<Contact | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContactId, setDetailContactId] = useState<string | null>(null);

  function openDetail(c: Contact) {
    setDetailContactId(c.id);
    setDetailOpen(true);
  }

  // Account filter list — same 100-row cap as the form picker. Paginated
  // combobox is a follow-up.
  useEffect(() => {
    let cancelled = false;
    listAccounts({ page: 1, limit: 100 })
      .then((res) => {
        if (!cancelled) setAccounts(res.data);
      })
      .catch(() => {
        // Silent — account filter just stays empty rather than disrupting
        // the contacts table itself.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listContacts({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        accountId: accountFilter || undefined,
      });
      setContacts(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load contacts";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, accountFilter, setTotalCount]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(contact: Contact) {
    setEditing(contact);
    setFormOpen(true);
  }

  function openDelete(contact: Contact) {
    setDeleting(contact);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      setDeleteSubmitting(true);
      await deleteContact(deleting.id);
      toast.success("Contact deleted");
      setDeleteOpen(false);
      setDeleting(null);
      fetchContacts();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete contact";
      toast.error(message);
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (c: Contact) => (
        <button
          type="button"
          onClick={() => openDetail(c)}
          className={`
            text-foreground font-medium
            hover:text-primary hover:underline
          `}
        >
          {c.firstName} {c.lastName}
          {c.isPrimary ? (
            <Badge status="primary" className="ml-2 align-middle">
              Primary
            </Badge>
          ) : null}
        </button>
      ),
    },
    {
      key: "account",
      header: "Account",
      render: (c: Contact) => c.account?.name ?? "—",
    },
    {
      key: "title",
      header: "Title",
      render: (c: Contact) => c.title || "—",
    },
    {
      key: "email",
      header: "Email",
      render: (c: Contact) => c.email || "—",
    },
    {
      key: "phone",
      header: "Phone",
      render: (c: Contact) => c.phone || "—",
    },
    {
      key: "createdAt",
      header: "Created",
      render: (c: Contact) => format(new Date(c.createdAt), "MMM d, yyyy"),
    },
    {
      key: "actions",
      header: "",
      className: "w-10",
      render: (c: Contact) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <PermissionDropdownMenuItem
              permissions={["sales-revenue:update"]}
              onClick={() => openEdit(c)}
            >
              <Edit className="mr-2 size-3.5" />
              Edit
            </PermissionDropdownMenuItem>
            <DropdownMenuSeparator />
            <PermissionDropdownMenuItem
              permissions={["sales-revenue:delete"]}
              className="text-destructive"
              onClick={() => openDelete(c)}
            >
              <Trash2 className="mr-2 size-3.5" />
              Delete
            </PermissionDropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search
              className={`
                text-muted-foreground pointer-events-none absolute top-1/2
                left-3 size-3.5 -translate-y-1/2
              `}
            />
            <Input
              placeholder="Search contacts…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                pagination.setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={accountFilter || ALL}
            onValueChange={(v) => {
              setAccountFilter(v === ALL ? "" : v);
              pagination.setPage(1);
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All accounts</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <PermissionButton
          permission="sales-revenue:create"
          onClick={openCreate}
        >
          <Plus className="mr-1.5 size-3.5" />
          New contact
        </PermissionButton>
      </div>

      <DataTable
        columns={columns}
        data={contacts}
        loading={loading}
        emptyMessage="No contacts yet. Create one or convert a lead to start a conversation."
        pagination={
          <DataPagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        }
      />

      <ContactFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editing}
        onSaved={fetchContacts}
      />

      <ContactDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        contactId={detailContactId}
        onEdit={(c) => {
          setDetailOpen(false);
          openEdit(c);
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `${deleting.firstName} ${deleting.lastName} will be permanently removed. Activities tied to this contact cascade-delete.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteSubmitting}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
