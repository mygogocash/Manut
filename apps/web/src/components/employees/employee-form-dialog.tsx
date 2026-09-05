"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  EMPLOYEE_FORM_DEFAULTS,
  employeeFormSchema,
  type EmployeeFormValues,
} from "@/components/employees/employee-form-schema";
import {
  AccountSection,
  EmploymentSection,
  IdentitySection,
  ImmigrationSection,
  PersonalInfoSection,
  RolesSection,
} from "@/components/employees/employee-form-sections";
import {
  mergeManagerCandidates,
  seedManagerCandidates,
} from "@/components/employees/manager-candidates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { useDragImage } from "@/hooks/use-drag-image";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import type { Entity } from "@/services/entity.service";
import type { RoleListItem } from "@/services/role.service";
import { uploadFile } from "@/services/upload.service";
import {
  assignUserRoles,
  createUser,
  getUser,
  listUsers,
  updateUser,
  type UserDetail,
  type UserListItem,
} from "@/services/user.service";

function isUserDetail(emp: UserListItem | UserDetail): emp is UserDetail {
  return "reportingTo" in emp;
}

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: UserListItem | UserDetail | null;
  entities: Entity[];
  roles: RoleListItem[];
  onSaved: (user: UserDetail) => void;
}

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  entities,
  roles,
  onSaved,
}: EmployeeFormDialogProps) {
  const { user: authUser, refreshUser } = useAuth();
  const isEditing = !!employee;
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [managerCandidates, setManagerCandidates] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [managersLoading, setManagersLoading] = useState(false);
  // Detail-only fields (passportNumber, thaiId, taxId, work permit, etc.)
  // are NOT on UserListItem. The parent passes UserListItem from the
  // employees table, so on open we fetch the full UserDetail by id —
  // otherwise the form would reset those fields to empty after save +
  // reopen.
  const [detail, setDetail] = useState<UserDetail | null>(
    employee && isUserDetail(employee) ? employee : null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const initialRoleIdsRef = useRef<string[]>([]);

  const {
    avatarFile,
    fileInputRef,
    handleFileChange,
    isDragging: isImageDragging,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop,
    reset: resetDragImage,
  } = useDragImage();

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: EMPLOYEE_FORM_DEFAULTS,
  });

  const employeeRole = useMemo(
    () => roles.find((r) => r.name.toLowerCase() === "employee"),
    [roles],
  );

  // Fetch the full UserDetail when the dialog opens for editing — the
  // parent passes a UserListItem (from the employees table) which lacks
  // identity / immigration fields. Without this, the form would reset
  // those fields to empty after the user saves + reopens.
  useEffect(() => {
    if (!open) {
      setDetail(null);
      return;
    }
    if (!employee?.id) return;

    if (isUserDetail(employee)) {
      setDetail(employee);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await getUser(employee.id);
        if (!cancelled) setDetail(res.data);
      } catch {
        if (!cancelled) setDetail(null);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, employee?.id, employee]);

  // Reset form whenever the data source becomes ready. For edit, that's
  // when the fetched `detail` arrives (or the parent already passed a
  // UserDetail). For create, we reset immediately on open.
  const resetSourceId = isEditing ? (detail?.id ?? null) : "new";
  const resetKey = useMemo(
    () => `${open}-${resetSourceId}-${employeeRole?.id ?? ""}`,
    [open, resetSourceId, employeeRole?.id],
  );

  useEffect(() => {
    if (!open) return;

    const defaultEmployeeRoleIds = employeeRole?.id ? [employeeRole.id] : [];

    if (isEditing && detail) {
      const existingRoleIds = detail.roles?.map((r) => r.id) ?? [];
      const roleIds = employeeRole?.id
        ? [...new Set([...existingRoleIds, employeeRole.id])]
        : existingRoleIds;
      initialRoleIdsRef.current = roleIds;

      form.reset({
        name: detail.name ?? "",
        email: detail.email ?? "",
        phone: detail.phone ?? "",
        entityId: detail.entity?.id ?? "",
        department: detail.department ?? "",
        jobTitle: detail.jobTitle ?? "",
        employeeId: detail.employeeId ?? "",
        employmentType:
          (detail.employmentType as EmployeeFormValues["employmentType"]) ??
          "full_time",
        startDate: detail.startDate
          ? String(detail.startDate).slice(0, 10)
          : "",
        dateOfBirth: detail.dateOfBirth
          ? String(detail.dateOfBirth).slice(0, 10)
          : "",
        location: detail.location ?? "",
        country: detail.country ?? "",
        passportNumber: detail.passportNumber ?? "",
        thaiId: detail.thaiId ?? "",
        taxId: detail.taxId ?? "",
        aadhaarNumber: detail.aadhaarNumber ?? "",
        panCardNumber: detail.panCardNumber ?? "",
        workPermitType: detail.workPermitType ?? "",
        visaType: detail.visaType ?? "",
        permitNumber: detail.permitNumber ?? "",
        reportingTo: detail.reportingTo ?? "",
        roleIds,
        password: "",
      });
    } else if (!isEditing) {
      initialRoleIdsRef.current = defaultEmployeeRoleIds;
      form.reset({
        ...EMPLOYEE_FORM_DEFAULTS,
        passportNumber: "",
        thaiId: "",
        taxId: "",
        aadhaarNumber: "",
        panCardNumber: "",
        workPermitType: "",
        visaType: "",
        permitNumber: "",
        reportingTo: "",
        roleIds: defaultEmployeeRoleIds,
      });
    }

    setShowPassword(false);
    resetDragImage();
    // resetKey changes on `open` toggle + detail load + role switch;
    // listing the live deps would loop the reset on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    if (!open) {
      setManagerCandidates([]);
      return;
    }

    const selfId = employee?.id;
    // The bound manager is read from `employee.manager` (UserListItem)
    // or `detail.manager` (UserDetail) — whichever is available.
    const boundManager = employee?.manager ?? detail?.manager ?? null;

    // Seed the dropdown with the bound manager BEFORE fetching the
    // candidate list. The #574 merge (inactive / past-the-cap managers)
    // only ran on the fetch success path — a transient listUsers failure
    // silently left an empty list, so the Select showed the "Select
    // manager" placeholder even though `reportingTo` was set, and HR
    // kept "re-fixing" a manager that was never lost. Seeding first
    // guarantees the current manager renders no matter how the fetch
    // ends. See manager-candidates.ts for the full history.
    setManagerCandidates(seedManagerCandidates(boundManager, selfId));

    let cancelled = false;
    setManagersLoading(true);

    void (async () => {
      try {
        const res = await listUsers({
          limit: 500,
          isActive: true,
          sortBy: "name",
          sortOrder: "asc",
        });
        if (cancelled) return;
        setManagerCandidates(
          mergeManagerCandidates(res.data, boundManager, selfId),
        );
      } catch {
        // Keep the seeded bound manager and say what happened — the old
        // silent `setManagerCandidates([])` rendered a state identical
        // to "no manager assigned".
        if (!cancelled) {
          toast.error(
            "Couldn't load the manager list. Close and reopen the form to retry.",
          );
        }
      } finally {
        if (!cancelled) setManagersLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, employee, detail]);

  const onSubmit = useCallback(
    async (values: EmployeeFormValues) => {
      try {
        setSubmitting(true);

        let avatarUrl: string | undefined;
        if (avatarFile) {
          const uploaded = await uploadFile(avatarFile, {
            bucket: "avatars",
            purpose: "employee-avatar",
          });
          avatarUrl = uploaded.url;
        }

        if (!isEditing) {
          if (!values.password || values.password.length < 8) {
            form.setError("password", {
              type: "manual",
              message: "Password must be at least 8 characters",
            });
            return;
          }

          const created = await createUser({
            email: values.email,
            name: values.name,
            password: values.password,
            phone: values.phone,
            ...(avatarUrl && { avatarUrl }),
            ...(values.entityId && { entityId: values.entityId }),
            ...(values.department && { department: values.department }),
            ...(values.jobTitle && { jobTitle: values.jobTitle }),
            ...(values.employeeId && { employeeId: values.employeeId }),
            employmentType: values.employmentType,
            ...(values.startDate && { startDate: values.startDate }),
            ...(values.dateOfBirth && { dateOfBirth: values.dateOfBirth }),
            ...(values.location && { location: values.location }),
            ...(values.country && { country: values.country }),
            ...(values.passportNumber && {
              passportNumber: values.passportNumber,
            }),
            ...(values.thaiId && { thaiId: values.thaiId }),
            ...(values.taxId && { taxId: values.taxId }),
            ...(values.aadhaarNumber && {
              aadhaarNumber: values.aadhaarNumber,
            }),
            ...(values.panCardNumber && {
              panCardNumber: values.panCardNumber,
            }),
            ...(values.workPermitType && {
              workPermitType: values.workPermitType,
            }),
            ...(values.visaType && { visaType: values.visaType }),
            ...(values.permitNumber && { permitNumber: values.permitNumber }),
            ...(values.reportingTo && { reportingTo: values.reportingTo }),
            roleIds: values.roleIds,
          });

          toast.success("Employee created and account provisioned");
          onSaved(created.data);
        } else {
          const updated = await updateUser(employee!.id, {
            name: values.name,
            phone: values.phone || null,
            ...(avatarUrl && { avatarUrl }),
            entityId: values.entityId || null,
            department: values.department || null,
            jobTitle: values.jobTitle || null,
            employeeId: values.employeeId || null,
            employmentType: values.employmentType,
            startDate: values.startDate || null,
            dateOfBirth: values.dateOfBirth || null,
            location: values.location || null,
            country: values.country || null,
            passportNumber: values.passportNumber || null,
            thaiId: values.thaiId || null,
            taxId: values.taxId || null,
            aadhaarNumber: values.aadhaarNumber || null,
            panCardNumber: values.panCardNumber || null,
            workPermitType: values.workPermitType || null,
            visaType: values.visaType || null,
            permitNumber: values.permitNumber || null,
            reportingTo: values.reportingTo || null,
          });

          // updateUser doesn't accept roleIds — roles flow through the
          // separate /admin/users/:id/roles endpoint. Only fire when the
          // selection actually changed so HR users without
          // user:assign-role aren't blocked by a 403 on every save.
          let mergedRoles = updated.data.roles;
          const initialRoleIds = initialRoleIdsRef.current;
          const nextRoleIds = values.roleIds ?? [];
          const roleSetChanged =
            initialRoleIds.length !== nextRoleIds.length ||
            initialRoleIds.some((id) => !nextRoleIds.includes(id)) ||
            nextRoleIds.some((id) => !initialRoleIds.includes(id));
          if (roleSetChanged && nextRoleIds.length > 0) {
            try {
              const rolesRes = await assignUserRoles(employee!.id, nextRoleIds);
              mergedRoles = rolesRes.data.roles;
              // If admin edited their own roles, reload /me so the
              // sidebar / route guards see the new permissions without
              // a full page reload. For other users, the periodic
              // refresh in auth-provider picks them up on visibility
              // return or interval tick.
              if (authUser?.id === employee!.id) {
                await refreshUser();
              }
            } catch (err) {
              const message =
                err instanceof ApiError
                  ? err.message
                  : "Failed to update roles";
              toast.error(message);
            }
          }

          toast.success("Employee updated");
          onSaved({ ...updated.data, roles: mergedRoles });
        }
        onOpenChange(false);
      } catch (err) {
        if (err instanceof ApiError) {
          // Surface server-side zod field errors directly on the
          // matching form fields so HR sees exactly what's wrong
          // instead of just a generic "Validation failed" toast.
          if (err.details && err.details.length > 0) {
            for (const detail of err.details) {
              if (detail.field) {
                form.setError(detail.field as keyof EmployeeFormValues, {
                  type: "server",
                  message: detail.message,
                });
              }
            }
            const firstFieldMsg = err.details[0]?.message ?? err.message;
            toast.error(`${err.message}: ${firstFieldMsg}`);
          } else {
            toast.error(err.message);
          }
        } else {
          const message =
            err instanceof Error ? err.message : "Something went wrong";
          toast.error(message);
        }
      } finally {
        setSubmitting(false);
      }
    },

    [
      isEditing,
      employee,
      form,
      onSaved,
      onOpenChange,
      avatarFile,
      authUser?.id,
      refreshUser,
    ],
  );

  const avatarPreview = avatarFile
    ? URL.createObjectURL(avatarFile)
    : (detail?.avatarUrl ?? employee?.avatarUrl ?? null);

  // Block save while we're still loading the user's detail row — the
  // form is partially populated and submitting now would clobber the
  // identity / immigration fields with empty strings.
  const editingDetailMissing = isEditing && !detail;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent
        className={`
          max-h-[92vh] overflow-y-auto
          sm:max-w-2xl
        `}
      >
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit employee" : "Create employee"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update profile and employment details for ${employee.name}.`
              : "Add a new employee. A login account will be provisioned automatically."}
          </DialogDescription>
        </DialogHeader>

        {editingDetailMissing && detailLoading ? (
          <div
            className={`
              text-muted-foreground flex items-center justify-center gap-2 py-12
              text-xs
            `}
          >
            <Loader2 className="size-3.5 animate-spin" />
            Loading employee details…
          </div>
        ) : null}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className={cn(
              "flex flex-col gap-5",
              editingDetailMissing && detailLoading && "hidden",
            )}
            id="employee-form"
          >
            {/* Avatar Upload */}
            <div className="flex flex-col items-center gap-2">
              <Label
                htmlFor="emp-avatar-input"
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={cn(
                  `
                    relative flex h-28 w-28 cursor-pointer items-center
                    justify-center overflow-hidden rounded-full border-2
                    border-dashed transition-colors
                  `,
                  isImageDragging
                    ? "border-primary/70 bg-primary/5"
                    : "border-muted-foreground/30 bg-card",
                )}
              >
                <input
                  ref={fileInputRef}
                  id="emp-avatar-input"
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleFileChange}
                />
                {avatarPreview ? (
                  <Image
                    src={avatarPreview}
                    alt="Avatar"
                    sizes="112px"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <span className="text-muted-foreground text-xs">Photo</span>
                )}
              </Label>
              <p className="text-muted-foreground text-xs">
                {avatarFile ? avatarFile.name : "Click or drag to upload"}
              </p>
            </div>

            <PersonalInfoSection form={form} isEditing={isEditing} />
            <EmploymentSection form={form} entities={entities} />
            <IdentitySection form={form} />
            <ImmigrationSection
              form={form}
              employees={managerCandidates}
              managersLoading={managersLoading}
            />

            {!isEditing && (
              <AccountSection
                form={form}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
              />
            )}

            <RolesSection
              form={form}
              roles={roles}
              employeeRole={employeeRole}
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
            form="employee-form"
            disabled={submitting || editingDetailMissing}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEditing ? "Save changes" : "Create employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
