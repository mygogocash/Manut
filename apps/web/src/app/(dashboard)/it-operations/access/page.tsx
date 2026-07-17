"use client";

import {
  ArrowLeft,
  Check,
  Loader2,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  ACCESS_REQUEST_TYPE_LABELS,
  ACCESS_REQUEST_TYPES,
  ACCESS_STATUS_LABELS,
  type AccessAssignment,
  type AccessAuditEntry,
  type AccessRequest,
  type AccessRequestType,
  approveAccessRequest,
  createAccessRequest,
  createSystem,
  deleteAccessRequest,
  deleteSystem,
  grantAccessRequest,
  type ItSystem,
  listAccessAudit,
  listAccessRequests,
  listAssignments,
  listSystems,
  rejectAccessRequest,
  revokeAssignment,
  submitAccessRequest,
} from "@/services/it-operations.service";

export default function AccessManagementPage() {
  const { hasPermission, hasAnyPermission } = useAuth();
  const canViewAll = hasAnyPermission(
    "it:access:view",
    "it:access:approve",
    "it:access:manage",
  );
  const canManage = hasPermission("it:access:manage");

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Access Management"
        subtitle="Request, approve, grant, and audit system access"
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/it-operations">
            <ArrowLeft className="mr-1 size-3.5" />
            IT Operations
          </Link>
        </Button>
      </PageHeader>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          {canViewAll && (
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
          )}
          {canManage && <TabsTrigger value="systems">Systems</TabsTrigger>}
          {canViewAll && <TabsTrigger value="audit">Audit Trail</TabsTrigger>}
        </TabsList>

        <TabsContent value="requests" className="mt-4">
          <RequestsTab canViewAll={canViewAll} canManage={canManage} />
        </TabsContent>
        {canViewAll && (
          <TabsContent value="assignments" className="mt-4">
            <AssignmentsTab canManage={canManage} />
          </TabsContent>
        )}
        {canManage && (
          <TabsContent value="systems" className="mt-4">
            <SystemsTab />
          </TabsContent>
        )}
        {canViewAll && (
          <TabsContent value="audit" className="mt-4">
            <AuditTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ───────────────────────────── Requests ─────────────────────────────

function RequestsTab({
  canViewAll,
  canManage,
}: {
  canViewAll: boolean;
  canManage: boolean;
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"mine" | "all">(
    canViewAll ? "all" : "mine",
  );
  const pagination = usePagination();
  const { setTotalCount } = pagination;

  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<AccessRequest | null>(null);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listAccessRequests({
        page: pagination.page,
        limit: pagination.pageSize,
        scope,
      });
      setRows(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, scope, setTotalCount]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {canViewAll && (
          <Select
            value={scope}
            onValueChange={(v) => setScope(v as "mine" | "all")}
          >
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All requests</SelectItem>
              <SelectItem value="mine">My requests</SelectItem>
            </SelectContent>
          </Select>
        )}
        <div className="flex-1" />
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 size-4" />
          New Request
        </Button>
      </div>

      <DataTable
        loading={loading}
        data={rows}
        emptyMessage="No access requests"
        onRowClick={(r) => setDetail(r)}
        columns={[
          {
            key: "requestNumber",
            header: "#",
            render: (r) => (
              <span className="font-mono text-xs">#{r.requestNumber}</span>
            ),
          },
          ...(scope === "all"
            ? [
                {
                  key: "employee",
                  header: "Employee",
                  render: (r: AccessRequest) => r.employee.name,
                },
              ]
            : []),
          { key: "system", header: "System", render: (r) => r.system.name },
          {
            key: "requestType",
            header: "Type",
            render: (r) => ACCESS_REQUEST_TYPE_LABELS[r.requestType],
          },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <Badge status={r.status}>{ACCESS_STATUS_LABELS[r.status]}</Badge>
            ),
          },
        ]}
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

      {createOpen && (
        <CreateRequestDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSaved={() => {
            setCreateOpen(false);
            void fetchRows();
          }}
        />
      )}
      {detail && (
        <RequestDetailDialog
          request={detail}
          currentUserId={user?.id ?? ""}
          canManage={canManage}
          onClose={() => setDetail(null)}
          onChanged={(updated) => {
            setDetail(updated);
            void fetchRows();
          }}
        />
      )}
    </div>
  );
}

function CreateRequestDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [systems, setSystems] = useState<ItSystem[]>([]);
  const [form, setForm] = useState({
    systemId: "",
    requestType: "new" as AccessRequestType,
    requestedAccessLevel: "",
    businessJustification: "",
    startDate: "",
    endDate: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void listSystems(true)
      .then((r) => {
        setSystems(r.data);
        setForm((f) => ({ ...f, systemId: r.data[0]?.id ?? "" }));
      })
      .catch(() => {});
  }, []);

  const needsEnd =
    form.requestType === "temporary" || form.requestType === "emergency";

  async function save(submit: boolean) {
    if (
      !form.systemId ||
      !form.requestedAccessLevel.trim() ||
      !form.businessJustification.trim()
    ) {
      toast.error("System, access level, and justification are required");
      return;
    }
    if (needsEnd && !form.endDate) {
      toast.error("End date is required for temporary / emergency access");
      return;
    }
    try {
      setSaving(true);
      const res = await createAccessRequest({
        systemId: form.systemId,
        requestType: form.requestType,
        requestedAccessLevel: form.requestedAccessLevel,
        businessJustification: form.businessJustification,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      });
      if (submit) await submitAccessRequest(res.data.id);
      toast.success(submit ? "Submitted" : "Saved as draft");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Access Request</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>System</Label>
              <Select
                value={form.systemId}
                onValueChange={(v) => setForm((f) => ({ ...f, systemId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {systems.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select
                value={form.requestType}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    requestType: v as AccessRequestType,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCESS_REQUEST_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ACCESS_REQUEST_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Requested access level</Label>
            <Input
              value={form.requestedAccessLevel}
              placeholder="e.g. Admin, Write, Read-only"
              onChange={(e) =>
                setForm((f) => ({ ...f, requestedAccessLevel: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Business justification</Label>
            <Textarea
              value={form.businessJustification}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  businessJustification: e.target.value,
                }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Start date</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>
                End date{" "}
                {needsEnd && <span className="text-destructive">*</span>}
              </Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endDate: e.target.value }))
                }
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => save(false)}
            disabled={saving}
          >
            Save draft
          </Button>
          <Button onClick={() => save(true)} disabled={saving}>
            {saving && <Loader2 className="mr-1 size-3.5 animate-spin" />}
            <Send className="mr-1 size-3.5" />
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestDetailDialog({
  request,
  currentUserId,
  canManage,
  onClose,
  onChanged,
}: {
  request: AccessRequest;
  currentUserId: string;
  canManage: boolean;
  onClose: () => void;
  onChanged: (r: AccessRequest) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const isOwner = request.employeeId === currentUserId;
  const pending =
    request.status === "pending-manager" || request.status === "pending-it";

  async function act(fn: () => Promise<{ data: AccessRequest }>) {
    try {
      setBusy(true);
      const res = await fn();
      toast.success("Done");
      onChanged(res.data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Request #{request.requestNumber} - {request.system.name}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Badge status={request.status}>
              {ACCESS_STATUS_LABELS[request.status]}
            </Badge>
            <span className="text-muted-foreground">
              {ACCESS_REQUEST_TYPE_LABELS[request.requestType]}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Employee:</span>{" "}
            {request.employee.name}
          </div>
          <div>
            <span className="text-muted-foreground">Access level:</span>{" "}
            {request.requestedAccessLevel}
          </div>
          <div>
            <span className="text-muted-foreground">Justification:</span>{" "}
            {request.businessJustification}
          </div>

          {/* Approval chain */}
          <div className="border-border mt-1 rounded-lg border p-3">
            <p className="mb-2 text-xs font-medium">Approval chain</p>
            <div className="space-y-1.5">
              {request.approvalChain.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  Not submitted yet.
                </p>
              ) : (
                request.approvalChain.map((d) => (
                  <div
                    key={d.order}
                    className="flex items-center justify-between text-xs"
                  >
                    <span>
                      {d.order}. {d.name}
                    </span>
                    <Badge status={d.status}>{d.status}</Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          {pending && (
            <Textarea
              placeholder="Comment (optional for approve, required for reject)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {isOwner && request.status === "draft" && (
            <>
              <Button
                variant="outline"
                className="text-destructive"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await deleteAccessRequest(request.id);
                    onClose();
                    return { data: request };
                  })
                }
              >
                <Trash2 className="mr-1 size-3.5" />
                Delete
              </Button>
              <Button
                disabled={busy}
                onClick={() => act(() => submitAccessRequest(request.id))}
              >
                <Send className="mr-1 size-3.5" />
                Submit
              </Button>
            </>
          )}
          {pending && (
            <>
              <Button
                variant="outline"
                className="text-destructive"
                disabled={busy}
                onClick={() => {
                  if (!note.trim()) {
                    toast.error("A reason is required to reject");
                    return;
                  }
                  void act(() => rejectAccessRequest(request.id, note));
                }}
              >
                <X className="mr-1 size-3.5" />
                Reject
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  act(() => approveAccessRequest(request.id, note))
                }
              >
                <Check className="mr-1 size-3.5" />
                Approve
              </Button>
            </>
          )}
          {canManage && request.status === "approved" && (
            <Button
              disabled={busy}
              onClick={() =>
                act(() => grantAccessRequest(request.id, { notes: note }))
              }
            >
              <ShieldCheck className="mr-1 size-3.5" />
              Grant Access
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────── Assignments ────────────────────────────

function AssignmentsTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<AccessAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"active" | "revoked">("active");

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listAssignments({ status });
      setRows(res.data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  async function handleRevoke(a: AccessAssignment) {
    const reason = window.prompt("Reason for revoking access?");
    if (!reason) return;
    try {
      await revokeAssignment(a.id, reason);
      toast.success("Revoked");
      void fetchRows();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Revoke failed");
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as "active" | "revoked")}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable
        loading={loading}
        data={rows}
        emptyMessage="No assignments"
        columns={[
          {
            key: "employee",
            header: "Employee",
            render: (r) => r.employee.name,
          },
          { key: "system", header: "System", render: (r) => r.system.name },
          { key: "accessLevel", header: "Access level" },
          {
            key: "status",
            header: "Status",
            render: (r) => <Badge status={r.status}>{r.status}</Badge>,
          },
          {
            key: "grantedAt",
            header: "Granted",
            render: (r) => new Date(r.grantedAt).toLocaleDateString("en-GB"),
          },
          {
            key: "actions",
            header: "",
            className: "w-[100px] text-right",
            render: (r) =>
              canManage && r.status === "active" ? (
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-destructive"
                  onClick={() => handleRevoke(r)}
                >
                  Revoke
                </Button>
              ) : null,
          },
        ]}
      />
    </div>
  );
}

// ───────────────────────────── Systems ─────────────────────────────

function SystemsTab() {
  const [rows, setRows] = useState<ItSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listSystems(false);
      setRows(res.data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  async function add() {
    if (!name.trim()) return;
    try {
      setSaving(true);
      await createSystem({ name, category: category || null });
      setName("");
      setCategory("");
      toast.success("Added");
      void fetchRows();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this system?")) return;
    try {
      await deleteSystem(id);
      toast.success("Deleted");
      void fetchRows();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <Label className="text-xs">System name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Figma"
            className="h-9 w-48"
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Category</Label>
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="optional"
            className="h-9 w-40"
          />
        </div>
        <Button size="sm" onClick={add} disabled={saving}>
          <Plus className="mr-1 size-4" />
          Add
        </Button>
      </div>
      <DataTable
        loading={loading}
        data={rows}
        emptyMessage="No systems"
        columns={[
          { key: "name", header: "System" },
          {
            key: "category",
            header: "Category",
            render: (r) => r.category ?? "-",
          },
          {
            key: "isActive",
            header: "Active",
            render: (r) => (
              <Badge status={r.isActive ? "active" : "inactive"}>
                {r.isActive ? "Active" : "Inactive"}
              </Badge>
            ),
          },
          {
            key: "actions",
            header: "",
            className: "w-[80px] text-right",
            render: (r) => (
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-destructive"
                onClick={() => remove(r.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            ),
          },
        ]}
      />
    </div>
  );
}

// ─────────────────────────── Audit trail ───────────────────────────

function AuditTab() {
  const [rows, setRows] = useState<AccessAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await listAccessAudit({});
        setRows(res.data);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DataTable
      loading={loading}
      data={rows}
      emptyMessage="No audit entries"
      columns={[
        {
          key: "createdAt",
          header: "When",
          render: (r) => new Date(r.createdAt).toLocaleString("en-GB"),
        },
        { key: "action", header: "Action", render: (r) => r.action },
        {
          key: "user",
          header: "By",
          render: (r) => r.user?.name ?? "System",
        },
        {
          key: "targetUser",
          header: "Target",
          render: (r) => r.targetUser?.name ?? "-",
        },
        {
          key: "comments",
          header: "Comments",
          render: (r) => r.comments ?? "-",
        },
      ]}
    />
  );
}
