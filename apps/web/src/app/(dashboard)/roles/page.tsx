"use client";

import { Copy, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DeleteRoleDialog } from "@/components/roles/delete-role-dialog";
import { RoleFormDialog } from "@/components/roles/role-form-dialog";
import { RoleMembersDialog } from "@/components/roles/role-members-dialog";
import { Badge } from "@/components/shared/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge as ShadcnBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  cloneRole,
  listRoles,
  type RoleDetail,
  type RoleListItem,
} from "@/services/role.service";

const MAX_VISIBLE_PERMS = 6;

export default function RolesPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("role:create");
  const canUpdate = hasPermission("role:update");
  const canDelete = hasPermission("role:delete");

  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RoleListItem | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<RoleListItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [membersTarget, setMembersTarget] = useState<RoleListItem | null>(null);

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listRoles();
      setRoles(res.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load roles";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRoles();
  }, [fetchRoles]);

  const handleCreate = useCallback(() => {
    setEditTarget(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((role: RoleListItem) => {
    setEditTarget(role);
    setFormOpen(true);
  }, []);

  const handleClone = useCallback(async (role: RoleListItem) => {
    try {
      const res = await cloneRole(role.id, {
        name: `${role.name} (Copy)`,
      });
      setRoles((prev) => [
        ...prev,
        {
          id: res.data.id,
          name: res.data.name,
          description: res.data.description,
          isSystem: res.data.isSystem,
          permissionCount: res.data.permissions.length,
          permissions: res.data.permissions,
          userCount: 0,
          createdAt: res.data.createdAt,
        },
      ]);
      toast.success(`Role "${res.data.name}" created`);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to clone role";
      toast.error(message);
    }
  }, []);

  const handleDelete = useCallback((role: RoleListItem) => {
    setDeleteTarget(role);
    setDeleteOpen(true);
  }, []);

  const handleSaved = useCallback(
    (saved: RoleDetail) => {
      if (editTarget?.id) {
        setRoles((prev) =>
          prev.map((r) =>
            r.id === saved.id
              ? {
                  ...r,
                  name: saved.name,
                  description: saved.description,
                  permissionCount: saved.permissions.length,
                  permissions: saved.permissions,
                }
              : r,
          ),
        );
      } else {
        setRoles((prev) => [
          ...prev,
          {
            id: saved.id,
            name: saved.name,
            description: saved.description,
            isSystem: saved.isSystem,
            permissionCount: saved.permissions.length,
            permissions: saved.permissions,
            userCount: 0,
            createdAt: saved.createdAt,
          },
        ]);
      }
    },
    [editTarget],
  );

  const handleDeleted = useCallback(() => {
    if (deleteTarget) {
      setRoles((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    }
  }, [deleteTarget]);

  return (
    <div>
      <PageHeader
        title="Role Management"
        subtitle="Create and manage custom roles with fine-grained permissions"
      >
        {canCreate && (
          <Button variant="accent" onClick={handleCreate}>
            <Plus className="size-3.5" />
            Create Role
          </Button>
        )}
      </PageHeader>

      {loading ? (
        <div
          className={`
            grid gap-4
            sm:grid-cols-2
            lg:grid-cols-3
          `}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[200px] rounded-lg" />
          ))}
        </div>
      ) : roles.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck />}
          title="No roles defined yet"
          description="Roles bundle permissions for groups of users. Create your first to start assigning access."
        >
          {canCreate && (
            <Button variant="accent" onClick={handleCreate}>
              <Plus className="size-3.5" />
              Create your first role
            </Button>
          )}
        </EmptyState>
      ) : (
        <div
          className={`
            grid gap-4
            sm:grid-cols-2
            lg:grid-cols-3
          `}
        >
          {roles.map((role) => {
            // Only the Admin role is fully locked (always full permissions).
            // Other system roles (Employee, HR Manager, etc.) are editable.
            const isLocked = role.isSystem && role.name === "Admin";
            const visiblePerms = role.permissions.slice(0, MAX_VISIBLE_PERMS);
            const extraCount = role.permissions.length - MAX_VISIBLE_PERMS;

            return (
              <Card key={role.id} className="relative flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <span className="truncate">{role.name}</span>
                        {role.isSystem && (
                          <Badge variant="grey" className="shrink-0">
                            System
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1 line-clamp-2 text-xs">
                        {role.description ?? "No description"}
                      </CardDescription>
                    </div>
                    {!isLocked && (
                      <div className="flex shrink-0 gap-0.5">
                        {canCreate && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Clone role"
                            onClick={() => handleClone(role)}
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        )}
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Edit role"
                            onClick={() => handleEdit(role)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Delete role"
                            onClick={() => handleDelete(role)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <div
                    className={`
                      text-muted-foreground flex items-center gap-4 text-[11px]
                    `}
                  >
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="size-3" />
                      {role.permissionCount} permissions
                    </span>
                    <button
                      type="button"
                      onClick={() => setMembersTarget(role)}
                      className={`
                        hover:text-foreground
                        focus-visible:ring-ring focus-visible:ring-1
                        focus-visible:outline-none
                        inline-flex items-center gap-1 rounded-sm
                        transition-colors
                      `}
                      title="View members"
                    >
                      <Users className="size-3" />
                      <span
                        className={`
                          underline-offset-2
                          hover:underline
                        `}
                      >
                        {role.userCount} users
                      </span>
                    </button>
                  </div>

                  {role.permissions.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {visiblePerms.map((code) => (
                        <ShadcnBadge
                          key={code}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {code}
                        </ShadcnBadge>
                      ))}
                      {extraCount > 0 && (
                        <ShadcnBadge variant="outline" className="text-[10px]">
                          +{extraCount} more
                        </ShadcnBadge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <RoleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        role={editTarget}
        onSaved={handleSaved}
      />

      <DeleteRoleDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        role={deleteTarget}
        onDeleted={handleDeleted}
      />

      <RoleMembersDialog
        open={membersTarget !== null}
        onOpenChange={(o) => {
          if (!o) setMembersTarget(null);
        }}
        roleId={membersTarget?.id ?? null}
        roleName={membersTarget?.name ?? ""}
      />
    </div>
  );
}
