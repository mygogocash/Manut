"use client";

import { format } from "date-fns";
import {
  Edit,
  FileEdit,
  MailCheck,
  MoreHorizontal,
  Newspaper,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DeleteUpdateDialog } from "@/components/investor-updates/delete-update-dialog";
import { SendUpdateDialog } from "@/components/investor-updates/send-update-dialog";
import { UpdateFormDialog } from "@/components/investor-updates/update-form-dialog";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionButton } from "@/components/shared/permission-button";
import { PermissionDropdownMenuItem } from "@/components/shared/permission-dropdown-menu-item";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import {
  type InvestorUpdate,
  listUpdates,
  STATUS_LABELS,
  UPDATE_STATUSES,
} from "@/services/investor-update.service";

const ALL_STATUS_VALUE = "__all__";

export default function InvestorUpdatesPage() {
  const [updates, setUpdates] = useState<InvestorUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const pagination = usePagination();
  const { page, pageSize, setTotalCount } = pagination;

  const [totalSent, setTotalSent] = useState(0);
  const [totalDrafts, setTotalDrafts] = useState(0);
  const [totalAll, setTotalAll] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<InvestorUpdate | null>(
    null,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingUpdate, setDeletingUpdate] = useState<InvestorUpdate | null>(
    null,
  );
  const [sendOpen, setSendOpen] = useState(false);
  const [sendingUpdate, setSendingUpdate] = useState<InvestorUpdate | null>(
    null,
  );

  const fetchUpdates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listUpdates({
        page,
        limit: pageSize,
        status: statusFilter || undefined,
      });
      setUpdates(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load updates";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, setTotalCount]);

  const fetchStats = useCallback(async () => {
    try {
      const [allRes, sentRes, draftRes] = await Promise.all([
        listUpdates({ page: 1, limit: 1 }),
        listUpdates({ page: 1, limit: 1, status: "sent" }),
        listUpdates({ page: 1, limit: 1, status: "draft" }),
      ]);
      setTotalAll(allRes.meta.total);
      setTotalSent(sentRes.meta.total);
      setTotalDrafts(draftRes.meta.total);
    } catch {
      toast.error("Failed to load statistics");
    }
  }, []);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  function handleSaved() {
    fetchUpdates();
    fetchStats();
  }

  function openCreate() {
    setEditingUpdate(null);
    setFormOpen(true);
  }

  function openEdit(u: InvestorUpdate) {
    setEditingUpdate(u);
    setFormOpen(true);
  }

  function openDelete(u: InvestorUpdate) {
    setDeletingUpdate(u);
    setDeleteOpen(true);
  }

  function openSend(u: InvestorUpdate) {
    setSendingUpdate(u);
    setSendOpen(true);
  }

  const columns = [
    {
      key: "title",
      header: "Title",
      render: (u: InvestorUpdate) => (
        <span className="text-foreground font-medium">{u.title}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (u: InvestorUpdate) => (
        <Badge status={u.status}>{STATUS_LABELS[u.status] ?? u.status}</Badge>
      ),
    },
    {
      key: "sentAt",
      header: "Sent date",
      render: (u: InvestorUpdate) =>
        u.sentAt ? format(new Date(u.sentAt), "MMM d, yyyy") : "—",
    },
    {
      key: "period",
      header: "Period",
      render: (u: InvestorUpdate) => (
        <span className="text-foreground">{u.period}</span>
      ),
    },
    {
      key: "sender",
      header: "Sent by",
      render: (u: InvestorUpdate) => u.sender?.name ?? "—",
    },
    {
      key: "createdAt",
      header: "Created",
      render: (u: InvestorUpdate) =>
        format(new Date(u.createdAt), "MMM d, yyyy"),
    },
    {
      key: "actions",
      mobileRole: "actions" as const,
      header: "",
      className: "w-10",
      render: (u: InvestorUpdate) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {u.status === "draft" && (
              <>
                <PermissionDropdownMenuItem
                  permission="investor-updates:create"
                  onClick={() => openEdit(u)}
                >
                  <Edit className="mr-2 size-3.5" />
                  Edit
                </PermissionDropdownMenuItem>
                <PermissionDropdownMenuItem
                  permission="investor-updates:send"
                  onClick={() => openSend(u)}
                >
                  <Send className="mr-2 size-3.5" />
                  Send
                </PermissionDropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <PermissionDropdownMenuItem
              permission="investor-updates:create"
              className="text-destructive"
              onClick={() => openDelete(u)}
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
      <PageHeader
        title="Investor Updates"
        subtitle="Draft and send updates to investors"
      >
        <PermissionButton
          permission="investor-updates:create"
          onClick={openCreate}
        >
          <Plus className="mr-1.5 size-3.5" />
          New update
        </PermissionButton>
      </PageHeader>

      <div
        className={`
          mb-6 grid grid-cols-1 gap-3
          sm:grid-cols-3
        `}
      >
        <div
          className={`
            bg-surface border-border flex flex-col rounded-lg border p-4
            shadow-sm
          `}
        >
          <div
            className={`
              bg-primary/10 text-primary mb-3 flex size-8 items-center
              justify-center rounded-lg
            `}
          >
            <Newspaper className="size-4" />
          </div>
          <p
            className={`
              text-muted-foreground text-[9.5px] font-bold tracking-widest
              uppercase
            `}
          >
            Total updates
          </p>
          <p className="text-foreground mt-1 text-lg font-semibold tabular-nums">
            {totalAll}
          </p>
        </div>
        <div
          className={`
            bg-surface border-border flex flex-col rounded-lg border p-4
            shadow-sm
          `}
        >
          <div
            className={`
              bg-success/10 text-success mb-3 flex size-8 items-center
              justify-center rounded-lg
            `}
          >
            <MailCheck className="size-4" />
          </div>
          <p
            className={`
              text-muted-foreground text-[9.5px] font-bold tracking-widest
              uppercase
            `}
          >
            Sent
          </p>
          <p className="text-foreground mt-1 text-lg font-semibold tabular-nums">
            {totalSent}
          </p>
        </div>
        <div
          className={`
            bg-surface border-border flex flex-col rounded-lg border p-4
            shadow-sm
          `}
        >
          <div
            className={`
              bg-warning/10 text-warning mb-3 flex size-8 items-center
              justify-center rounded-lg
            `}
          >
            <FileEdit className="size-4" />
          </div>
          <p
            className={`
              text-muted-foreground text-[9.5px] font-bold tracking-widest
              uppercase
            `}
          >
            Drafts
          </p>
          <p className="text-foreground mt-1 text-lg font-semibold tabular-nums">
            {totalDrafts}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={statusFilter || ALL_STATUS_VALUE}
          onValueChange={(v) => {
            setStatusFilter(v === ALL_STATUS_VALUE ? "" : v);
            pagination.setPage(1);
          }}
        >
          <SelectTrigger className="h-10 w-40 text-[13px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUS_VALUE}>All statuses</SelectItem>
            {UPDATE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={updates}
        loading={loading}
        emptyMessage="No investor updates found"
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

      <UpdateFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        investorUpdate={editingUpdate}
        onSaved={handleSaved}
      />

      <DeleteUpdateDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        investorUpdate={deletingUpdate}
        onDeleted={handleSaved}
      />

      <SendUpdateDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        investorUpdate={sendingUpdate}
        onSent={handleSaved}
      />
    </div>
  );
}
