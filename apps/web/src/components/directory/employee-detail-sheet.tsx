"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmployeeAttendanceProfileCard } from "@/components/hrms/employee-attendance-profile-card";
import { Avatar } from "@/components/shared/avatar";
import { Badge } from "@/components/shared/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  type DirectoryEmployeeDetail,
  getDirectoryEmployee,
} from "@/services/directory.service";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between py-1.5">
      <span className="text-muted-foreground text-[11px] font-medium">
        {label}
      </span>
      <span className="text-foreground text-right text-[12px]">{value}</span>
    </div>
  );
}

export function EmployeeDetailSheet({
  open,
  onOpenChange,
  employeeId,
  onSelectEmployee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string | null;
  onSelectEmployee?: (id: string) => void;
}) {
  const [detail, setDetail] = useState<DirectoryEmployeeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const { user, hasPermission } = useAuth();
  // Match the backend hrms:attendance gate so we don't advertise a section
  // that usually can't be populated (and avoid a per-open 403). Security is
  // still enforced server-side.
  const canViewAttendance =
    hasPermission("hrms:attendance-read") ||
    hasPermission("hrms:attendance-manage") ||
    detail?.id === user?.id;

  useEffect(() => {
    if (!employeeId || !open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getDirectoryEmployee(employeeId);
        if (!cancelled) setDetail(res.data);
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof ApiError
              ? err.message
              : "Failed to load employee details",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeId, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={`
          overflow-y-auto
          sm:max-w-md
        `}
      >
        <SheetHeader>
          <SheetTitle>Employee Profile</SheetTitle>
          <SheetDescription>Detailed employee information</SheetDescription>
        </SheetHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : detail ? (
          <div className="flex flex-col gap-6 px-1 pt-2">
            <div className="flex items-center gap-3">
              <Avatar name={detail.name} src={detail.avatarUrl} size="lg" />
              <div>
                <p className="text-foreground text-sm font-semibold">
                  {detail.name}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  {detail.jobTitle ?? "No title"}
                </p>
              </div>
            </div>

            <div
              className={`
                border-border divide-border divide-y rounded-lg border
              `}
            >
              <div className="px-3 py-2">
                <p
                  className={`
                    text-muted-foreground mb-1 text-[10px] font-bold
                    tracking-widest uppercase
                  `}
                >
                  Contact
                </p>
                <DetailRow label="Email" value={detail.email} />
                <DetailRow label="Phone" value={detail.phone} />
                <DetailRow label="Location" value={detail.location} />
                <DetailRow label="Country" value={detail.country} />
                <DetailRow label="Timezone" value={detail.timezone} />
              </div>
              <div className="px-3 py-2">
                <p
                  className={`
                    text-muted-foreground mb-1 text-[10px] font-bold
                    tracking-widest uppercase
                  `}
                >
                  Organization
                </p>
                <DetailRow label="Department" value={detail.department} />
                <DetailRow label="Entity" value={detail.entity?.name} />
                <DetailRow label="Employee ID" value={detail.employeeId} />
                <DetailRow
                  label="Employment"
                  value={
                    <Badge status={detail.employmentType}>
                      {detail.employmentType.replace("_", " ")}
                    </Badge>
                  }
                />
                <DetailRow label="Manager" value={detail.manager?.name} />
                <DetailRow
                  label="Start Date"
                  value={
                    detail.startDate
                      ? new Date(detail.startDate).toLocaleDateString()
                      : null
                  }
                />
              </div>
              {detail.userRoles.length > 0 && (
                <div className="px-3 py-2">
                  <p
                    className={`
                      text-muted-foreground mb-1 text-[10px] font-bold
                      tracking-widest uppercase
                    `}
                  >
                    Roles
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {detail.userRoles.map((ur) => (
                      <Badge key={ur.role.id} variant="blue">
                        {ur.role.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {canViewAttendance && (
                <div className="px-3 py-2">
                  <p
                    className={`
                      text-muted-foreground mb-1 text-[10px] font-bold
                      tracking-widest uppercase
                    `}
                  >
                    Attendance
                  </p>
                  <EmployeeAttendanceProfileCard employeeId={detail.id} />
                </div>
              )}
              {detail.directReports.length > 0 && (
                <div className="px-3 py-2">
                  <p
                    className={`
                      text-muted-foreground mb-1 text-[10px] font-bold
                      tracking-widest uppercase
                    `}
                  >
                    Direct Reports ({detail.directReports.length})
                  </p>
                  <div className="flex flex-col gap-2">
                    {detail.directReports.map((dr) => {
                      const isClickable = Boolean(onSelectEmployee);
                      const Wrapper = isClickable ? "button" : "div";
                      return (
                        <Wrapper
                          key={dr.id}
                          type={isClickable ? "button" : undefined}
                          onClick={
                            isClickable
                              ? () => onSelectEmployee?.(dr.id)
                              : undefined
                          }
                          className={
                            isClickable
                              ? `
                                hover:bg-muted/60
                                -mx-1 flex w-[calc(100%+0.5rem)] items-center
                                gap-2 rounded-md px-1 py-1 text-left
                                transition-colors
                              `
                              : "flex items-center gap-2"
                          }
                        >
                          <Avatar name={dr.name} src={dr.avatarUrl} />
                          <div>
                            <p
                              className={`
                                text-foreground text-[11px] font-medium
                              `}
                            >
                              {dr.name}
                            </p>
                            <p className="text-muted-foreground text-[10px]">
                              {dr.jobTitle ?? dr.department ?? "—"}
                            </p>
                          </div>
                        </Wrapper>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground py-12 text-center text-sm">
            No employee selected
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
