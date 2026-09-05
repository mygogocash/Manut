"use client";

import {
  KeyRound,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  Trash2,
  UserCog,
} from "lucide-react";
import { useCallback, useMemo } from "react";

import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable, type SortOrder } from "@/components/shared/data-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EMPLOYMENT_TYPE_LABELS,
  type EmploymentType,
  type UserListItem,
} from "@/services/user.service";

interface EmployeeTableProps {
  data: UserListItem[];
  loading: boolean;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  currentUserId?: string;
  isActorAdmin: boolean;
  canEditProfile: boolean;
  canAssignRoles: boolean;
  canResetPassword: boolean;
  canDeleteUser: boolean;
  canToggleActive: boolean;
  onEdit: (user: UserListItem) => void;
  onResetPassword: (user: UserListItem) => void;
  onAssignRoles: (user: UserListItem) => void;
  onDelete: (user: UserListItem) => void;
  onToggleActive: (user: UserListItem) => void;
  sortBy?: string;
  sortOrder?: SortOrder;
  onSortChange?: (key: string) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const EMPLOYMENT_BADGE_VARIANT: Record<
  EmploymentType,
  "blue" | "gold" | "green" | "amber" | "grey"
> = {
  full_time: "blue",
  part_time: "amber",
  contract: "gold",
  intern: "green",
  consultant: "grey",
};

function userIsAdmin(u: UserListItem): boolean {
  return u.roles.some((r) => r.name === "Admin");
}

export function EmployeeTable({
  data,
  loading,
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange,
  currentUserId,
  isActorAdmin,
  canEditProfile,
  canAssignRoles,
  canResetPassword,
  canDeleteUser,
  canToggleActive,
  onEdit,
  onResetPassword,
  onAssignRoles,
  onDelete,
  onToggleActive,
  sortBy,
  sortOrder,
  onSortChange,
}: EmployeeTableProps) {
  const columns = useMemo(
    () => [
      {
        key: "rowNo",
        mobileRole: "hidden" as const,
        header: "#",
        className: "w-12 tabular-nums",
        render: (_u: UserListItem, index: number) => (
          <span className="text-muted-foreground text-xs">
            {(page - 1) * pageSize + index + 1}
          </span>
        ),
      },
      {
        key: "employeeId",
        mobileRole: "subtitle" as const,
        header: "Employee ID",
        className: "w-[7.5rem] min-w-[7rem]",
        sortable: true,
        render: (u: UserListItem) =>
          u.employeeId ? (
            <span className="text-foreground font-mono text-xs">
              {u.employeeId}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "employee",
        mobileRole: "title" as const,
        header: "Employee",
        render: (u: UserListItem) => (
          <div className="flex items-center gap-2.5">
            <Avatar>
              {u.avatarUrl ? (
                <AvatarImage src={u.avatarUrl} alt={u.name} />
              ) : null}
              <AvatarFallback
                className={`
                  text-sidebar-primary-foreground text-[10px] font-semibold
                  tracking-wide
                `}
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-light)))",
                }}
              >
                {getInitials(u.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 leading-tight">
              <p className="text-foreground truncate text-xs font-medium">
                {u.name}
              </p>
              <p className="text-muted-foreground truncate text-[11px]">
                {u.email}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "department",
        mobileRole: "field" as const,
        header: "Dept / Title",
        render: (u: UserListItem) => (
          <div className="leading-tight">
            <p className="text-foreground text-xs">{u.department ?? "—"}</p>
            <p className="text-muted-foreground truncate text-[11px]">
              {u.jobTitle ?? "—"}
            </p>
          </div>
        ),
      },
      {
        key: "entity",
        mobileRole: "detail" as const,
        header: "Entity",
        render: (u: UserListItem) =>
          u.entity ? (
            <span className="text-foreground text-xs">{u.entity.name}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "employmentType",
        mobileRole: "detail" as const,
        header: "Type",
        render: (u: UserListItem) => {
          const type = u.employmentType as EmploymentType;
          const variant = EMPLOYMENT_BADGE_VARIANT[type] ?? "grey";
          return (
            <Badge variant={variant}>
              {EMPLOYMENT_TYPE_LABELS[type] ?? type}
            </Badge>
          );
        },
      },
      {
        key: "roles",
        mobileRole: "detail" as const,
        header: "Roles",
        render: (u: UserListItem) => (
          <div className="flex max-w-[180px] flex-wrap gap-1">
            {u.roles.length === 0 ? (
              <span className="text-muted-foreground text-[11px]">
                No roles
              </span>
            ) : (
              u.roles.map((role) => (
                <Badge key={role.id} variant="blue">
                  {role.name}
                </Badge>
              ))
            )}
          </div>
        ),
      },
      {
        key: "status",
        mobileRole: "badge" as const,
        header: "Status",
        render: (u: UserListItem) => (
          <Badge variant={u.isActive ? "green" : "grey"}>
            {u.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        key: "actions",
        mobileRole: "actions" as const,
        header: "",
        className: "w-10 text-right",
        render: (u: UserListItem) => {
          const targetAdmin = userIsAdmin(u);
          const adminLocked = targetAdmin && !isActorAdmin;
          const isSelf = u.id === currentUserId;

          const showEdit = canEditProfile && !adminLocked;
          const showRoles = canAssignRoles && !adminLocked;
          const showReset = canResetPassword && !adminLocked;
          const showToggle = canToggleActive && !adminLocked;
          const showDelete = canDeleteUser && !adminLocked && !isSelf;

          const anyAction =
            showEdit || showRoles || showReset || showToggle || showDelete;

          if (!anyAction) {
            return <span className="text-muted-foreground text-[11px]">—</span>;
          }

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${u.name}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Manage</DropdownMenuLabel>
                {showEdit && (
                  <DropdownMenuItem
                    onSelect={() => {
                      onEdit(u);
                    }}
                  >
                    <Pencil className="size-3.5" />
                    Edit profile
                  </DropdownMenuItem>
                )}
                {showRoles && (
                  <DropdownMenuItem
                    onSelect={() => {
                      onAssignRoles(u);
                    }}
                  >
                    <ShieldCheck className="size-3.5" />
                    Manage roles
                  </DropdownMenuItem>
                )}
                {showReset && (
                  <DropdownMenuItem
                    onSelect={() => {
                      onResetPassword(u);
                    }}
                  >
                    <KeyRound className="size-3.5" />
                    Reset password
                  </DropdownMenuItem>
                )}
                {(showToggle || showDelete) && <DropdownMenuSeparator />}
                {showToggle && (
                  <DropdownMenuItem
                    onSelect={() => {
                      onToggleActive(u);
                    }}
                  >
                    <UserCog className="size-3.5" />
                    {u.isActive ? "Deactivate" : "Activate"}
                  </DropdownMenuItem>
                )}
                {showDelete && (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      onDelete(u);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    Delete employee
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [
      canAssignRoles,
      canDeleteUser,
      canEditProfile,
      canResetPassword,
      canToggleActive,
      currentUserId,
      isActorAdmin,
      onAssignRoles,
      onDelete,
      onEdit,
      onResetPassword,
      onToggleActive,
      page,
      pageSize,
    ],
  );

  // Click anywhere on the row to open the profile dialog. Editors land
  // in edit mode; viewers see the same fields and use the dialog as a
  // read-only inspector (the API rejects save for callers without
  // `user:update`). Admin-locked rows still suppress the click so
  // non-admins can't peek at admin profiles.
  const handleRowClick = useCallback(
    (u: UserListItem) => {
      const targetAdmin = userIsAdmin(u);
      const adminLocked = targetAdmin && !isActorAdmin;
      if (adminLocked) return;
      onEdit(u);
    },
    [isActorAdmin, onEdit],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={loading}
      emptyMessage="No employees found"
      onRowClick={handleRowClick}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSortChange={onSortChange}
      pagination={
        <DataPagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      }
    />
  );
}
