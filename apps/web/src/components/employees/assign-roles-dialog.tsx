"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import type { RoleListItem } from "@/services/role.service";
import { assignUserRoles, type UserListItem } from "@/services/user.service";

const assignRolesSchema = z.object({
  roleIds: z.array(z.string()).min(1, "Select at least one role"),
});

type AssignRolesValues = z.infer<typeof assignRolesSchema>;

interface AssignRolesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserListItem | null;
  roles: RoleListItem[];
  onSaved: (payload: {
    userId: string;
    roles: Array<{ id: string; name: string }>;
  }) => void;
}

export function AssignRolesDialog({
  open,
  onOpenChange,
  user,
  roles,
  onSaved,
}: AssignRolesDialogProps) {
  const { user: authUser, refreshUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<AssignRolesValues>({
    resolver: standardSchemaResolver(assignRolesSchema),
    defaultValues: { roleIds: [] },
  });

  useEffect(() => {
    if (open && user) {
      form.reset({ roleIds: user.roles.map((r) => r.id) });
    }
  }, [open, user, form]);

  async function onSubmit(values: AssignRolesValues) {
    if (!user) return;
    try {
      setSubmitting(true);
      const res = await assignUserRoles(user.id, values.roleIds);
      toast.success(`Roles updated for ${user.name}`);
      onSaved(res.data);
      // If admin reassigned their own roles, reload /me so the sidebar
      // and route guards reflect the new permissions immediately.
      if (authUser?.id === user.id) {
        await refreshUser();
      }
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to update roles";
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
          max-h-[80vh] overflow-y-auto
          sm:max-w-md
        `}
      >
        <DialogHeader>
          <DialogTitle>Manage roles</DialogTitle>
          <DialogDescription>
            Assign roles to{" "}
            <span className="text-foreground font-medium">
              {user?.name ?? "user"}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="assign-roles-form"
          >
            <FormField
              control={form.control}
              name="roleIds"
              render={() => (
                <FormItem>
                  <div className="flex flex-col gap-2">
                    {roles.map((role) => (
                      <FormField
                        key={role.id}
                        control={form.control}
                        name="roleIds"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel
                              className={`
                                border-border bg-surface flex cursor-pointer
                                items-start gap-3 rounded-md border p-3
                                font-normal transition-colors
                                hover:bg-muted/40
                              `}
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(role.id)}
                                  onCheckedChange={(checked) => {
                                    const current = field.value ?? [];
                                    field.onChange(
                                      checked
                                        ? [...current, role.id]
                                        : current.filter(
                                            (id) => id !== role.id,
                                          ),
                                    );
                                  }}
                                  className="mt-0.5"
                                />
                              </FormControl>
                              <div className="min-w-0 flex-1 leading-tight">
                                <p
                                  className={`
                                    text-foreground text-xs font-medium
                                  `}
                                >
                                  {role.name}
                                </p>
                                {role.description && (
                                  <p
                                    className={`
                                      text-muted-foreground mt-0.5 text-[11px]
                                    `}
                                  >
                                    {role.description}
                                  </p>
                                )}
                                <p
                                  className={`
                                    text-muted-foreground mt-1 text-[10px]
                                  `}
                                >
                                  {role.permissionCount} permissions •{" "}
                                  {role.userCount} users
                                </p>
                              </div>
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                    {roles.length === 0 && (
                      <p className="text-muted-foreground text-xs">
                        No roles available.
                      </p>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
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
            form="assign-roles-form"
            disabled={submitting}
            className="min-w-28"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            Save roles
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
