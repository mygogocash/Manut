"use client";

import { Loader2, Pencil, Users } from "lucide-react";

import type { LeaveBalanceEditTarget } from "@/components/leave/leave-balance-edit-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ProgressBar } from "@/components/shared/progress-bar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TeamBalanceRow } from "@/services/leave.service";

interface Props {
  rows: TeamBalanceRow[];
  loading: boolean;
  /** When provided, an edit pencil renders next to each balance. */
  onEdit?: (target: LeaveBalanceEditTarget) => void;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s.charAt(0).toUpperCase())
    .join("");
}

export function LeaveTeamBalances({ rows, loading, onEdit }: Props) {
  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Loader2 className="size-3.5 animate-spin" />
        Loading team balances…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Users />}
        title="No direct reports"
        description="No active direct reports to show balances for."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => (
        <Card key={row.employee.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                {row.employee.avatarUrl && (
                  <AvatarImage
                    src={row.employee.avatarUrl}
                    alt={row.employee.name}
                  />
                )}
                <AvatarFallback>{initials(row.employee.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <CardTitle className="text-sm">{row.employee.name}</CardTitle>
                <CardDescription className="text-xs">
                  {[row.employee.jobTitle, row.employee.department]
                    .filter(Boolean)
                    .join(" · ") || row.employee.email}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {row.balances.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                {row.employee.entity
                  ? `No leave types configured for ${row.employee.entity.name}. Ask HR to set up entitlements.`
                  : `No leave entitlements configured for ${row.year}. Ask HR to assign this employee to an entity with leave types.`}
              </p>
            ) : (
              <div
                className={`
                  grid gap-3
                  sm:grid-cols-2
                  lg:grid-cols-3
                  xl:grid-cols-4
                `}
              >
                {row.balances.map((b) => {
                  const pct = b.entitled > 0 ? (b.used / b.entitled) * 100 : 0;
                  const canEdit = !!onEdit;
                  return (
                    <div
                      key={b.id}
                      className="bg-card/40 rounded-md border p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`
                            text-muted-foreground text-[11px] font-semibold
                            tracking-wide uppercase
                          `}
                        >
                          {b.leaveType.name}
                        </p>
                        {canEdit && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${b.leaveType.name} balance for ${row.employee.name}`}
                            className="size-6 shrink-0"
                            onClick={() =>
                              onEdit?.({
                                id: b.synthesized ? null : b.id,
                                employeeId: row.employee.id,
                                leaveTypeId: b.leaveType.id,
                                employeeName: row.employee.name,
                                leaveTypeName: b.leaveType.name,
                                year: row.year,
                                entitled: b.entitled,
                                used: b.used,
                                carried: b.carried,
                                carriedUsed: b.carriedUsed,
                                carriedExpiry: b.carriedExpiry,
                                adjustment: b.adjustment,
                              })
                            }
                          >
                            <Pencil className="size-3" />
                          </Button>
                        )}
                      </div>
                      <p className="mt-1 text-base font-semibold tabular-nums">
                        {b.remaining}
                        <span
                          className={`
                            text-muted-foreground ml-1 text-xs font-normal
                          `}
                        >
                          / {b.entitled} days
                        </span>
                      </p>
                      <ProgressBar value={pct} className="mt-2 h-1.5" />
                      <p className="text-muted-foreground mt-1 text-[11px]">
                        {b.used} used
                        {b.carried > 0 && (
                          <>
                            {" · "}
                            {b.carriedRemaining} of {b.carried} carried
                            {b.carriedExpiry && (
                              <span
                                className={
                                  b.carriedExpired
                                    ? "text-destructive"
                                    : undefined
                                }
                              >
                                {` (${
                                  b.carriedExpired
                                    ? "expired"
                                    : "expires " +
                                      b.carriedExpiry
                                        .split("-")
                                        .reverse()
                                        .join("/")
                                })`}
                              </span>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
