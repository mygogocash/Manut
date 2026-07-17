import { FileText, Filter, Search, UserRoundX } from "lucide-react";
import type { ReactNode } from "react";

import { auditActionVariant } from "@/components/admin/audit-action-variant";
import { formatAuditDetails } from "@/components/admin/audit-details-format";
import { Avatar } from "@/components/shared/avatar";
import { Badge } from "@/components/shared/badge";
import { DataTable } from "@/components/shared/data-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AuditLogEntry } from "@/services/admin.service";

const AUDIT_ACTIONS = [
  "create",
  "update",
  "delete",
  "login",
  "logout",
  "approve",
  "reject",
] as const;

const auditColumns = [
  {
    key: "action",
    header: "Action",
    render: (e: AuditLogEntry) => (
      <Badge variant={auditActionVariant(e.action)}>{e.action}</Badge>
    ),
  },
  {
    key: "resource",
    header: "Resource",
    render: (e: AuditLogEntry) => (
      <span className="font-mono text-sm tracking-tight">{e.resource}</span>
    ),
  },
  {
    key: "user",
    header: "Actor",
    render: (e: AuditLogEntry) =>
      e.user ? (
        <div className="flex items-center gap-2.5">
          <Avatar name={e.user.name} size="sm" />
          <div className="leading-tight">
            <p className="text-foreground text-sm font-medium">{e.user.name}</p>
            <p className="text-muted-foreground max-w-48 truncate text-xs">
              {e.user.email}
            </p>
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground flex items-center gap-2.5">
          <div
            className={`
              border-muted-foreground/35 bg-muted/40 flex size-7 shrink-0
              items-center justify-center rounded-full border border-dashed
            `}
          >
            <UserRoundX className="size-3.5" aria-hidden />
          </div>
          <span className="text-xs italic">Unknown actor</span>
        </div>
      ),
  },
  {
    key: "details",
    header: "Details",
    render: (e: AuditLogEntry) => {
      const text = formatAuditDetails(e);
      const raw = e.details ? JSON.stringify(e.details, null, 2) : undefined;
      return (
        <span
          className="text-muted-foreground block max-w-72 truncate text-xs"
          title={raw}
        >
          {text}
        </span>
      );
    },
  },
  {
    key: "createdAt",
    header: "Timestamp",
    className: "whitespace-nowrap",
    render: (e: AuditLogEntry) => (
      <span className="text-muted-foreground text-xs tabular-nums">
        {new Date(e.createdAt).toLocaleString()}
      </span>
    ),
  },
];

interface AdminAuditTabProps {
  canViewAudit: boolean;
  auditLogs: AuditLogEntry[];
  loadingAudit: boolean;
  filterResource: string;
  filterAction: string;
  onFilterResourceChange: (value: string) => void;
  onFilterActionChange: (value: string) => void;
  pagination: ReactNode;
}

export function AdminAuditTab({
  canViewAudit,
  auditLogs,
  loadingAudit,
  filterResource,
  filterAction,
  onFilterActionChange,
  onFilterResourceChange,
  pagination,
}: AdminAuditTabProps) {
  if (!canViewAudit) {
    return (
      <div
        className={`
          border-border bg-muted/20 flex flex-col items-center justify-center
          rounded-xl border border-dashed py-16
        `}
      >
        <div
          className={`
            bg-muted text-muted-foreground mb-4 flex size-14 items-center
            justify-center rounded-2xl
          `}
        >
          <FileText className="size-7 opacity-60" />
        </div>
        <p className="text-foreground text-sm font-medium">
          Audit log restricted
        </p>
        <p
          className={`
            text-muted-foreground mt-1 max-w-sm px-4 text-center text-xs
            leading-relaxed
          `}
        >
          Your role does not include permission to view system audit logs.
          Contact an administrator if you need access.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <div
        className={`
          border-border/80 bg-card/80 flex flex-col gap-3 rounded-xl border p-4
          shadow-sm backdrop-blur-sm
          sm:flex-row sm:items-center
        `}
      >
        <div
          className={`
            text-muted-foreground flex shrink-0 items-center gap-2 text-xs
            font-semibold tracking-wide uppercase
          `}
        >
          <Filter className="size-3.5" aria-hidden />
          Filters
        </div>
        <div
          className={`
            flex min-w-0 flex-1 flex-col gap-3
            sm:flex-row sm:items-center
          `}
        >
          <div className="relative min-w-0 flex-1">
            <Search
              className={`
                text-muted-foreground pointer-events-none absolute top-1/2
                left-3 size-4 -translate-y-1/2
              `}
            />
            <Input
              placeholder="Search by resource…"
              value={filterResource}
              onChange={(e) => onFilterResourceChange(e.target.value)}
              className="h-10 pl-9"
            />
          </div>
          <Select
            value={filterAction}
            onValueChange={(val) =>
              onFilterActionChange(val === "all" ? "" : val)
            }
          >
            <SelectTrigger
              className={`
                h-10 w-full
                sm:w-[200px]
              `}
            >
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {AUDIT_ACTIONS.map((action) => (
                <SelectItem key={action} value={action}>
                  {action.charAt(0).toUpperCase() + action.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DataTable
        columns={auditColumns}
        data={auditLogs}
        loading={loadingAudit}
        emptyMessage="No audit logs match your filters"
        pagination={pagination}
      />
    </div>
  );
}
