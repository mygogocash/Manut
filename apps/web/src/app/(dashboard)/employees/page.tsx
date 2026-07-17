"use client";

import { FileUp, MailPlus, Search, Settings2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AssignRolesDialog } from "@/components/employees/assign-roles-dialog";
import { BulkImportDialog } from "@/components/employees/bulk-import-dialog";
import { DeleteEmployeeDialog } from "@/components/employees/delete-employee-dialog";
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import { EmployeeStatsCards } from "@/components/employees/employee-stats-cards";
import { EmployeeTable } from "@/components/employees/employee-table";
import { ResetPasswordDialog } from "@/components/employees/reset-password-dialog";
import { UnactivatedUsersDialog } from "@/components/employees/unactivated-users-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionButton } from "@/components/shared/permission-button";
import { Button } from "@/components/ui/button";
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
import { useAuth } from "@/providers/auth-provider";
import {
  type Department,
  getDirectoryDepartments,
} from "@/services/directory.service";
import type { Entity } from "@/services/entity.service";
import type { RoleListItem } from "@/services/role.service";
import {
  EMPLOYMENT_TYPE_LABELS,
  EMPLOYMENT_TYPES,
  getUserFormLookups,
  getUserStats,
  listUsers,
  updateUser,
  type UserDetail,
  type UserListItem,
  type UserListParams,
  type UserStats,
} from "@/services/user.service";

type SortKey = NonNullable<UserListParams["sortBy"]>;
type SortOrder = NonNullable<UserListParams["sortOrder"]>;

const ALL_FILTER = "__all__";

export default function EmployeesPage() {
  const { hasPermission, hasRole, user: authUser } = useAuth();
  const isActorAdmin = hasRole("Admin");
  const canEditProfile = hasPermission("user:update");
  const canAssignRoles = hasPermission("user:assign-role");
  const canResetPassword = hasPermission("user:update");
  const canDeleteUser = hasPermission("user:delete");
  const canToggleActive = hasPermission("user:update");

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [departmentFilter, setDepartmentFilter] = useState<string>(ALL_FILTER);
  const [entityFilter, setEntityFilter] = useState<string>(ALL_FILTER);
  const [employmentFilter, setEmploymentFilter] = useState<string>(ALL_FILTER);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_FILTER);
  const [roleFilter, setRoleFilter] = useState<string>(ALL_FILTER);
  const [sortBy, setSortBy] = useState<SortKey>("employeeId");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const pagination = usePagination();
  const {
    page,
    pageSize,
    setPage,
    setPageSize,
    setTotalCount,
    totalPages,
    totalCount,
  } = pagination;

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [unactivatedOpen, setUnactivatedOpen] = useState(false);
  const [resetUser, setResetUser] = useState<UserListItem | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [rolesUser, setRolesUser] = useState<UserListItem | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<UserListItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const result = await getUserStats();
      setStats(result.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load stats";
      toast.error(message);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const result = await listUsers({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        department:
          departmentFilter === ALL_FILTER ? undefined : departmentFilter,
        entityId: entityFilter === ALL_FILTER ? undefined : entityFilter,
        employmentType:
          employmentFilter === ALL_FILTER ? undefined : employmentFilter,
        isActive:
          statusFilter === ALL_FILTER ? undefined : statusFilter === "active",
        roleId: roleFilter === ALL_FILTER ? undefined : roleFilter,
        sortBy,
        sortOrder,
      });
      setUsers(result.data);
      setTotalCount(result.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load employees";
      toast.error(message);
    } finally {
      setLoadingUsers(false);
    }
  }, [
    page,
    pageSize,
    debouncedSearch,
    departmentFilter,
    entityFilter,
    employmentFilter,
    statusFilter,
    roleFilter,
    sortBy,
    sortOrder,
    setTotalCount,
  ]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  /** After local totalCount changes (e.g. delete), stay on a valid page. */
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages, setPage]);

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    departmentFilter,
    entityFilter,
    statusFilter,
    employmentFilter,
    roleFilter,
    setPage,
  ]);

  useEffect(() => {
    Promise.all([getUserFormLookups(), getDirectoryDepartments()])
      .then(([lookups, deptRes]) => {
        setEntities(lookups.data.entities);
        setRoles(lookups.data.roles);
        setDepartments(deptRes.data);
      })
      .catch((err) => {
        const message =
          err instanceof ApiError ? err.message : "Failed to load lookups";
        toast.error(message);
      });
  }, []);

  const userDetailToListItem = useCallback((d: UserDetail): UserListItem => {
    return {
      id: d.id,
      email: d.email,
      name: d.name,
      avatarUrl: d.avatarUrl,
      phone: d.phone,
      department: d.department,
      jobTitle: d.jobTitle,
      employeeId: d.employeeId,
      employmentType: d.employmentType,
      startDate: d.startDate,
      location: d.location,
      country: d.country,
      isActive: d.isActive,
      entity: d.entity,
      manager: d.manager,
      roles: d.roles,
      createdAt: d.createdAt,
    };
  }, []);

  const handleEmployeeSaved = useCallback(
    (detail: UserDetail) => {
      const row = userDetailToListItem(detail);
      if (editingUser) {
        setUsers((prev) => prev.map((u) => (u.id === row.id ? row : u)));
        setStats((prev) => {
          if (!prev) return prev;
          if (editingUser.employmentType === detail.employmentType) {
            return prev;
          }
          const nextBy = { ...prev.byEmploymentType };
          const oldT = editingUser.employmentType;
          if (typeof nextBy[oldT] === "number") {
            nextBy[oldT] = Math.max(0, nextBy[oldT] - 1);
          }
          const newT = detail.employmentType;
          if (typeof nextBy[newT] === "number") {
            nextBy[newT] = nextBy[newT] + 1;
          } else {
            nextBy[newT] = 1;
          }
          return { ...prev, byEmploymentType: nextBy };
        });
      } else {
        setTotalCount((c) => c + 1);
        if (page === 1) {
          setUsers((prev) => {
            const next = [row, ...prev];
            return next.length > pageSize ? next.slice(0, pageSize) : next;
          });
        }
        setStats((prev) => {
          if (!prev) return prev;
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);
          const isNewThisMonth = new Date(detail.createdAt) >= startOfMonth;
          const empType = detail.employmentType;
          const nextBy = { ...prev.byEmploymentType };
          if (typeof nextBy[empType] === "number") {
            nextBy[empType] = nextBy[empType] + 1;
          } else {
            nextBy[empType] = 1;
          }
          return {
            total: prev.total + 1,
            active: detail.isActive ? prev.active + 1 : prev.active,
            inactive: !detail.isActive ? prev.inactive + 1 : prev.inactive,
            newThisMonth: isNewThisMonth
              ? prev.newThisMonth + 1
              : prev.newThisMonth,
            byEmploymentType: nextBy,
          };
        });
      }
    },
    [editingUser, page, pageSize, setTotalCount, userDetailToListItem],
  );

  const handleRolesSaved = useCallback(
    (payload: {
      userId: string;
      roles: Array<{ id: string; name: string }>;
    }) => {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === payload.userId ? { ...u, roles: payload.roles } : u,
        ),
      );
    },
    [],
  );

  const handleUserDeleted = useCallback(
    (deleted: UserListItem) => {
      setUsers((prev) => prev.filter((u) => u.id !== deleted.id));
      setTotalCount((c) => Math.max(0, c - 1));
      setDeleteUser(null);
      setStats((prev) => {
        if (!prev) return prev;
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const wasNewThisMonth = new Date(deleted.createdAt) >= startOfMonth;
        const empType = deleted.employmentType;
        const nextBy = { ...prev.byEmploymentType };
        if (typeof nextBy[empType] === "number") {
          nextBy[empType] = Math.max(0, nextBy[empType] - 1);
        }
        return {
          total: Math.max(0, prev.total - 1),
          active: deleted.isActive ? Math.max(0, prev.active - 1) : prev.active,
          inactive: !deleted.isActive
            ? Math.max(0, prev.inactive - 1)
            : prev.inactive,
          newThisMonth: wasNewThisMonth
            ? Math.max(0, prev.newThisMonth - 1)
            : prev.newThisMonth,
          byEmploymentType: nextBy,
        };
      });
    },
    [setTotalCount],
  );

  const handleEdit = useCallback((user: UserListItem) => {
    setEditingUser(user);
    setFormOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditingUser(null);
    setFormOpen(true);
  }, []);

  const handleResetPassword = useCallback((user: UserListItem) => {
    setResetUser(user);
    setResetOpen(true);
  }, []);

  const handleAssignRoles = useCallback((user: UserListItem) => {
    setRolesUser(user);
    setRolesOpen(true);
  }, []);

  const handleDelete = useCallback((user: UserListItem) => {
    setDeleteUser(user);
    setDeleteOpen(true);
  }, []);

  const handleSortChange = useCallback(
    (key: string) => {
      const next = key as SortKey;
      setSortBy((prevKey) => {
        if (prevKey === next) {
          setSortOrder((prevOrder) => (prevOrder === "asc" ? "desc" : "asc"));
          return prevKey;
        }
        setSortOrder("asc");
        return next;
      });
      setPage(1);
    },
    [setPage],
  );

  const handleToggleActive = useCallback(
    async (user: UserListItem) => {
      try {
        const res = await updateUser(user.id, {
          isActive: !user.isActive,
        });
        const updated = userDetailToListItem(res.data);
        toast.success(
          `${user.name} ${user.isActive ? "deactivated" : "activated"}`,
        );
        setUsers((prev) =>
          prev.map((u) => (u.id === updated.id ? updated : u)),
        );
        setStats((prev) => {
          if (!prev) return prev;
          if (user.isActive === updated.isActive) return prev;
          return {
            ...prev,
            active: updated.isActive
              ? prev.active + 1
              : Math.max(0, prev.active - 1),
            inactive: !updated.isActive
              ? prev.inactive + 1
              : Math.max(0, prev.inactive - 1),
          };
        });
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to update employee";
        toast.error(message);
      }
    },
    [userDetailToListItem],
  );

  const filtersDirty = useMemo(
    () =>
      Boolean(
        debouncedSearch ||
        departmentFilter !== ALL_FILTER ||
        entityFilter !== ALL_FILTER ||
        statusFilter !== ALL_FILTER ||
        employmentFilter !== ALL_FILTER ||
        roleFilter !== ALL_FILTER,
      ),
    [
      debouncedSearch,
      departmentFilter,
      entityFilter,
      statusFilter,
      employmentFilter,
      roleFilter,
    ],
  );

  function clearFilters() {
    setSearch("");
    setDepartmentFilter(ALL_FILTER);
    setEntityFilter(ALL_FILTER);
    setStatusFilter(ALL_FILTER);
    setEmploymentFilter(ALL_FILTER);
    setRoleFilter(ALL_FILTER);
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Manage employee profiles, accounts and access"
      >
        <PermissionButton variant="outline" permission="admin:manage" asChild>
          <Link href="/admin/form-config">
            <Settings2 className="size-3.5" />
            Form configuration
          </Link>
        </PermissionButton>
        <PermissionButton
          variant="outline"
          permission="user:update"
          onClick={() => setUnactivatedOpen(true)}
        >
          <MailPlus className="size-3.5" />
          Send activation emails
        </PermissionButton>
        <PermissionButton
          variant="outline"
          permission="user:create"
          onClick={() => setBulkImportOpen(true)}
        >
          <FileUp className="size-3.5" />
          Bulk import
        </PermissionButton>
        <PermissionButton
          variant="accent"
          permission="user:create"
          onClick={handleCreate}
        >
          <UserPlus className="size-3.5" />
          Add employee
        </PermissionButton>
      </PageHeader>

      <div className="flex flex-col gap-4">
        <EmployeeStatsCards stats={stats} loading={loadingStats} />

        <div
          className={`
            border-border bg-surface flex flex-col gap-2 rounded-lg border p-3
            shadow-sm
            md:flex-row md:items-center
          `}
        >
          <div className="relative flex-1">
            <Search
              className={`
                text-muted-foreground absolute top-1/2 left-2.5 size-3.5
                -translate-y-1/2
              `}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or employee ID…"
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div
            className={`
              grid grid-cols-2 gap-2
              md:flex md:items-center
            `}
          >
            <Select
              value={departmentFilter}
              onValueChange={setDepartmentFilter}
            >
              <SelectTrigger className="h-10 min-w-[140px] text-xs">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.name} value={d.name}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="h-10 min-w-[140px] text-xs">
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All entities</SelectItem>
                {entities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={employmentFilter}
              onValueChange={setEmploymentFilter}
            >
              <SelectTrigger className="h-10 min-w-[120px] text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All types</SelectItem>
                {EMPLOYMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {EMPLOYMENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-10 min-w-[140px] text-xs">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All roles</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 min-w-[110px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtersDirty && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={clearFilters}
              className="text-xs"
            >
              Clear
            </Button>
          )}
        </div>

        <EmployeeTable
          data={users}
          loading={loadingUsers}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          currentUserId={authUser?.id}
          isActorAdmin={isActorAdmin}
          canEditProfile={canEditProfile}
          canAssignRoles={canAssignRoles}
          canResetPassword={canResetPassword}
          canDeleteUser={canDeleteUser}
          canToggleActive={canToggleActive}
          onEdit={handleEdit}
          onResetPassword={handleResetPassword}
          onAssignRoles={handleAssignRoles}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
        />
      </div>

      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editingUser}
        entities={entities}
        roles={roles}
        onSaved={handleEmployeeSaved}
      />

      <ResetPasswordDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        user={resetUser}
      />

      <AssignRolesDialog
        open={rolesOpen}
        onOpenChange={setRolesOpen}
        user={rolesUser}
        roles={roles}
        onSaved={handleRolesSaved}
      />

      <DeleteEmployeeDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        user={deleteUser}
        onDeleted={handleUserDeleted}
      />

      <BulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onImported={() => {
          // Refresh list + stats; admin may want to assign roles to the
          // freshly-imported users next.
          void fetchUsers();
          void fetchStats();
        }}
      />

      <UnactivatedUsersDialog
        open={unactivatedOpen}
        onOpenChange={setUnactivatedOpen}
        onSent={() => {
          void fetchStats();
        }}
      />
    </div>
  );
}
