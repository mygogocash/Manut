"use client";

import { format } from "date-fns";
import { Edit, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ActivityFormDialog } from "@/components/crm-activities/activity-form-dialog";
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
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPES,
  type ActivityType,
  type CrmActivity,
  deleteCrmActivity,
  listCrmActivities,
} from "@/services/crm-activity.service";

const ALL = "__all__";

function activityAnchor(a: CrmActivity): string {
  if (a.opportunity) return `Opp · ${a.opportunity.name}`;
  if (a.lead) return `Lead · ${a.lead.company}`;
  if (a.contact) {
    return `Contact · ${a.contact.firstName} ${a.contact.lastName}`;
  }
  if (a.account) return `Account · ${a.account.name}`;
  return "—";
}

export function ActivitiesTab() {
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const pagination = usePagination();
  const { page, pageSize, setTotalCount } = pagination;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CrmActivity | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<CrmActivity | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listCrmActivities({
        page,
        limit: pageSize,
        type: (typeFilter || undefined) as ActivityType | undefined,
      });
      setActivities(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load activities";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeFilter, setTotalCount]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(a: CrmActivity) {
    setEditing(a);
    setFormOpen(true);
  }

  function openDelete(a: CrmActivity) {
    setDeleting(a);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      setDeleteSubmitting(true);
      await deleteCrmActivity(deleting.id);
      toast.success("Activity deleted");
      setDeleteOpen(false);
      setDeleting(null);
      fetchActivities();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete activity";
      toast.error(message);
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const columns = [
    {
      key: "type",
      header: "Type",
      render: (a: CrmActivity) => (
        <Badge status={a.type}>
          {ACTIVITY_TYPE_LABELS[a.type as ActivityType] ?? a.type}
        </Badge>
      ),
    },
    {
      key: "subject",
      header: "Subject",
      render: (a: CrmActivity) => (
        <span className="text-foreground font-medium">{a.subject}</span>
      ),
    },
    {
      key: "anchor",
      header: "Tied to",
      render: (a: CrmActivity) => activityAnchor(a),
    },
    {
      key: "occurredAt",
      header: "When",
      render: (a: CrmActivity) =>
        a.occurredAt
          ? format(new Date(a.occurredAt), "MMM d, yyyy · h:mm a")
          : "—",
    },
    {
      key: "duration",
      header: "Duration",
      render: (a: CrmActivity) =>
        a.durationMins !== null ? `${a.durationMins}m` : "—",
    },
    {
      key: "owner",
      header: "Logged by",
      render: (a: CrmActivity) => a.owner?.name ?? "—",
    },
    {
      key: "actions",
      header: "",
      className: "w-10",
      render: (a: CrmActivity) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <PermissionDropdownMenuItem
              permissions={["crm:update"]}
              onClick={() => openEdit(a)}
            >
              <Edit className="mr-2 size-3.5" />
              Edit
            </PermissionDropdownMenuItem>
            <DropdownMenuSeparator />
            <PermissionDropdownMenuItem
              permissions={["crm:delete"]}
              className="text-destructive"
              onClick={() => openDelete(a)}
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
        <Select
          value={typeFilter || ALL}
          onValueChange={(v) => {
            setTypeFilter(v === ALL ? "" : v);
            pagination.setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {ACTIVITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {ACTIVITY_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <PermissionButton permission="crm:create" onClick={openCreate}>
          <Plus className="mr-1.5 size-3.5" />
          Log activity
        </PermissionButton>
      </div>

      <DataTable
        columns={columns}
        data={activities}
        loading={loading}
        emptyMessage="No activities yet. Log a call, email, meeting, or note to start a record."
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

      <ActivityFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        activity={editing}
        onSaved={fetchActivities}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this activity?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `${deleting.subject} will be permanently removed from the audit trail.`
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
