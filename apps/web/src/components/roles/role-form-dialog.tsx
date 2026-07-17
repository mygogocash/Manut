"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { PermissionPicker } from "@/components/roles/permission-picker";
import {
  ALL_MODULES,
  type RoleFormValues,
  roleSchema,
} from "@/components/roles/role-form-schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  createRole,
  listPermissions,
  type PermissionDef,
  type RoleDetail,
  type RoleListItem,
  updateRole,
} from "@/services/role.service";

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleListItem | null;
  onSaved: (saved: RoleDetail) => void;
}

export function RoleFormDialog({
  open,
  onOpenChange,
  role,
  onSaved,
}: RoleFormDialogProps) {
  const { roles: authRoles, refreshUser } = useAuth();
  const isEditMode = Boolean(role?.id);
  /** FE-only draft from an existing role; always submitted as `createRole`. */
  const isDuplicateDraft = Boolean(role && !role.id);
  const isBlankCreate = !role;
  const [permsByModule, setPermsByModule] = useState<
    Record<string, PermissionDef[]>
  >({});
  const [loadingPerms, setLoadingPerms] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<RoleFormValues>({
    resolver: standardSchemaResolver(roleSchema),
    defaultValues: {
      name: "",
      description: "",
      permissions: [],
    },
  });

  useEffect(() => {
    if (!open) return;
    if (Object.keys(permsByModule).length > 0) {
      return;
    }

    setLoadingPerms(true);
    listPermissions()
      .then((res) => {
        setPermsByModule(res.byModule);
      })
      .catch((err) => {
        const message =
          err instanceof ApiError ? err.message : "Failed to load permissions";
        toast.error(message);
      })
      .finally(() => setLoadingPerms(false));
  }, [open, permsByModule]);

  useEffect(() => {
    if (!open) return;

    if (role) {
      const permissions = role.permissions ?? [];
      form.reset({
        name: role.name ?? "",
        description: role.description ?? "",
        permissions,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        permissions: [],
      });
    }
  }, [open, role, form]);

  const selectedPerms = new Set(
    useWatch({ control: form.control, name: "permissions" }),
  );

  const togglePerm = (code: string) => {
    const current = form.getValues("permissions");
    form.setValue(
      "permissions",
      current.includes(code)
        ? current.filter((c) => c !== code)
        : [...current, code],
      { shouldValidate: true },
    );
  };

  const toggleModule = (moduleName: string) => {
    const modulePerms = permsByModule[moduleName] ?? [];
    const codes = modulePerms.map((p) => p.code);
    const allSelected = codes.every((c) => selectedPerms.has(c));

    const current = form.getValues("permissions");
    const next = new Set(current);
    codes.forEach((c) => {
      if (allSelected) next.delete(c);
      else next.add(c);
    });
    form.setValue("permissions", Array.from(next), { shouldValidate: true });
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState(ALL_MODULES);

  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setModuleFilter(ALL_MODULES);
    }
  }, [open]);

  async function onSubmit(values: RoleFormValues) {
    try {
      setSubmitting(true);
      const body = {
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        permissions: values.permissions,
      };

      let saved: RoleDetail;
      if (isEditMode) {
        const res = await updateRole(role!.id, body);
        saved = res.data;
        toast.success("Role updated");
      } else {
        const res = await createRole(body);
        saved = res.data;
        toast.success("Role created");
      }
      onSaved(saved);
      // If admin edited a role they themselves hold, the permission set
      // resolved into their session may have changed — pull /me so the
      // sidebar / route guards reflect the new state without a reload.
      if (isEditMode && authRoles.some((r) => r.id === saved.id)) {
        await refreshUser();
      }
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save role";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent
        className={`
          flex max-h-[min(90vh,900px)] flex-col gap-0 overflow-hidden p-0
          sm:max-w-4xl
        `}
      >
        <div className="border-border shrink-0 border-b px-4 pt-4 pb-3">
          <DialogHeader className="space-y-2">
            <DialogTitle>
              {isEditMode
                ? "Edit Role"
                : isDuplicateDraft
                  ? "Duplicate role"
                  : "Create Role"}
            </DialogTitle>
            <DialogDescription>
              {isBlankCreate
                ? "Create a new custom role with specific permissions."
                : isDuplicateDraft
                  ? "Prefilled from the copied role. You can change the name, description, and permissions before saving."
                  : `Configure "${role?.name}".${role?.isSystem && role?.name === "Admin" ? " Admin role name is locked." : ""}`}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-5"
              id="role-form"
            >
              <div
                className={`
                  grid gap-4
                  sm:grid-cols-2
                `}
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role Name *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g. HR Manager"
                          maxLength={50}
                          disabled={
                            isEditMode &&
                            Boolean(role?.isSystem) &&
                            role?.name === "Admin"
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Optional description"
                          maxLength={500}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="permissions"
                render={() => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Permissions *</FormLabel>
                      <span
                        className={`text-muted-foreground text-xs tabular-nums`}
                      >
                        {selectedPerms.size} selected
                      </span>
                    </div>

                    <PermissionPicker
                      permsByModule={permsByModule}
                      loadingPerms={loadingPerms}
                      selectedPerms={selectedPerms}
                      onTogglePerm={togglePerm}
                      onToggleModule={toggleModule}
                      searchQuery={searchQuery}
                      onSearchQueryChange={setSearchQuery}
                      moduleFilter={moduleFilter}
                      onModuleFilterChange={setModuleFilter}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        <DialogFooter
          className={`
            mx-0 mb-0 shrink-0 border-t px-4 py-3
            sm:justify-end
          `}
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="role-form"
            disabled={submitting || loadingPerms}
            className="min-w-28"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEditMode ? "Update Role" : "Create Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
