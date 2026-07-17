"use client";

import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import type { BadgeVariant } from "@/components/shared/badge";
import { Badge } from "@/components/shared/badge";
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
  createInvestorLead,
  deleteInvestorLead,
  INVESTOR_LEAD_STATUS_LABELS,
  INVESTOR_LEAD_STATUSES,
  type InvestorLead,
  type InvestorLeadStatus,
  listInvestorLeads,
  updateInvestorLead,
} from "@/services/investor-lead.service";

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  new: "blue",
  qualified: "amber",
  converted: "green",
  disqualified: "grey",
};

export function InvestorLeadsTab() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("investors:create");
  const canUpdate = hasPermission("investors:update");
  const canDelete = hasPermission("investors:delete");

  const [leads, setLeads] = useState<InvestorLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
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
  const [editing, setEditing] = useState<InvestorLead | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listInvestorLeads({
        page,
        limit: pageSize,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
      });
      setLeads(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load leads";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, debouncedSearch, setTotalCount]);

  useEffect(() => {
    void fetchLeads();
  }, [fetchLeads]);

  async function remove(l: InvestorLead) {
    if (!canDelete || !window.confirm(`Delete lead "${l.name}"?`)) return;
    const previous = leads;
    setLeads((prev) => prev.filter((x) => x.id !== l.id));
    try {
      await deleteInvestorLead(l.id);
      toast.success("Lead deleted");
    } catch (err) {
      setLeads(previous);
      const msg =
        err instanceof ApiError ? err.message : "Failed to delete lead";
      toast.error(msg);
    }
  }

  const skeleton = Array.from({ length: Math.min(pageSize, 6) });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
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
              placeholder="Search leads…"
              className="h-8 w-56 pl-8 text-xs"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className={`
              border-border bg-background h-8 rounded-md border px-2 text-xs
            `}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {INVESTOR_LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {INVESTOR_LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <PermissionButton
          permission="investors:create"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1.5 size-3.5" />
          New lead
        </PermissionButton>
      </div>

      <Table containerClassName="max-h-[calc(100vh-340px)] overflow-auto rounded-lg border">
        <TableHeader className="bg-background sticky top-0 z-10">
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
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
          ) : leads.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-muted-foreground py-10 text-center text-xs"
              >
                No leads yet
              </TableCell>
            </TableRow>
          ) : (
            leads.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-sm font-medium">{l.name}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {l.company ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {l.email ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {l.source ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[l.status] ?? "grey"}>
                    {INVESTOR_LEAD_STATUS_LABELS[l.status] ?? l.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {l.owner?.name ?? "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {canUpdate ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(l);
                          setFormOpen(true);
                        }}
                        aria-label="Edit lead"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void remove(l)}
                        aria-label="Delete lead"
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

      <LeadFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        lead={editing}
        canSubmit={editing ? canUpdate : canCreate}
        onSaved={() => {
          setFormOpen(false);
          void fetchLeads();
        }}
      />
    </div>
  );
}

function LeadFormDialog({
  open,
  onOpenChange,
  lead,
  canSubmit,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: InvestorLead | null;
  canSubmit: boolean;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState<InvestorLeadStatus>("new");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(lead?.name ?? "");
    setCompany(lead?.company ?? "");
    setEmail(lead?.email ?? "");
    setPhone(lead?.phone ?? "");
    setSource(lead?.source ?? "");
    setStatus((lead?.status as InvestorLeadStatus) ?? "new");
    setNotes(lead?.notes ?? "");
  }, [open, lead]);

  async function submit() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    const payload = {
      name: name.trim(),
      company: company.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      source: source.trim() || undefined,
      status,
      notes: notes.trim() || undefined,
    };
    try {
      setSaving(true);
      if (lead) {
        await updateInvestorLead(lead.id, payload);
        toast.success("Lead updated");
      } else {
        await createInvestorLead(payload);
        toast.success("Lead created");
      }
      onSaved();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to save lead";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{lead ? "Edit lead" : "New lead"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lead-name">Name</Label>
            <Input
              id="lead-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lead-company">Company</Label>
              <Input
                id="lead-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lead-source">Source</Label>
              <Input
                id="lead-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Referral, inbound…"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input
                id="lead-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lead-status">Status</Label>
            <select
              id="lead-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as InvestorLeadStatus)}
              className={`
                border-border bg-background h-9 rounded-md border px-2 text-sm
              `}
            >
              {INVESTOR_LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {INVESTOR_LEAD_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lead-notes">Notes</Label>
            <Textarea
              id="lead-notes"
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
            {lead ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
