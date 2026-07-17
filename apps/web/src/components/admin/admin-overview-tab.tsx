import { formatDistanceToNow } from "date-fns";
import {
  ArrowUpRight,
  FileText,
  KeyRound,
  Shield,
  UserRoundX,
  Users,
} from "lucide-react";
import Link from "next/link";

import { auditActionVariant } from "@/components/admin/audit-action-variant";
import { EmployeeStatsCards } from "@/components/employees/employee-stats-cards";
import { Avatar } from "@/components/shared/avatar";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AuditLogEntry } from "@/services/admin.service";
import type { RoleListItem } from "@/services/role.service";
import type { UserListItem, UserStats } from "@/services/user.service";

interface AdminOverviewTabProps {
  loadingOverview: boolean;
  userStats: UserStats | null;
  recentUsers: UserListItem[];
  roles: RoleListItem[];
  canViewAudit: boolean;
  loadingActivity: boolean;
  recentActivity: AuditLogEntry[];
  onViewAllAudit: () => void;
}

export function AdminOverviewTab({
  loadingOverview,
  userStats,
  recentUsers,
  roles,
  canViewAudit,
  loadingActivity,
  recentActivity,
  onViewAllAudit,
}: AdminOverviewTabProps) {
  return (
    <div className="flex w-full flex-col gap-8">
      <section aria-label="Workspace user metrics">
        <EmployeeStatsCards
          stats={userStats}
          loading={loadingOverview}
          statLabels={{
            total: "Total users",
            active: "Active accounts",
            inactive: "Inactive",
            newThisMonth: "New this month",
          }}
        />
      </section>

      <section
        className={`
          grid gap-5
          lg:grid-cols-2
        `}
        aria-label="Quick admin links"
      >
        <Card
          className={`
            border-border/80 bg-card/90 overflow-hidden shadow-sm
            backdrop-blur-sm
          `}
        >
          <CardHeader className="border-border/60 border-b pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 gap-3">
                <div
                  className={`
                    bg-info/15 text-info flex size-11 shrink-0 items-center
                    justify-center rounded-xl
                  `}
                >
                  <Users className="size-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-lg">User management</CardTitle>
                  <CardDescription className="mt-1 text-sm leading-relaxed">
                    Directory, accounts, and workspace access
                  </CardDescription>
                </div>
              </div>
              <CardAction>
                <Button asChild size="sm" className="shrink-0 gap-1">
                  <Link href="/employees">
                    Manage
                    <ArrowUpRight className="size-3.5 opacity-70" />
                  </Link>
                </Button>
              </CardAction>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {loadingOverview ? (
              <div className="space-y-3 pt-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : recentUsers.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No users yet — add your first account from Employees.
              </p>
            ) : (
              <div className="divide-border/60 -mx-1 divide-y">
                <p
                  className={`
                    text-muted-foreground px-1 pb-2 text-xs font-semibold
                    tracking-wide uppercase
                  `}
                >
                  Recently added
                </p>
                {recentUsers.slice(0, 5).map((user) => (
                  <div
                    key={user.id}
                    className={`
                      hover:bg-muted/40
                      flex items-center gap-3 px-1 py-3 transition-colors
                      first:pt-1
                    `}
                  >
                    <Avatar
                      name={user.name}
                      src={user.avatarUrl}
                      size="lg"
                      className="ring-background ring-2"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`
                          text-foreground truncate text-sm font-medium
                        `}
                      >
                        {user.name}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {user.email}
                      </p>
                    </div>
                    <Badge variant={user.isActive ? "green" : "grey"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card
          className={`
            border-border/80 bg-card/90 overflow-hidden shadow-sm
            backdrop-blur-sm
          `}
        >
          <CardHeader className="border-border/60 border-b pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 gap-3">
                <div
                  className={`
                    bg-primary/12 text-primary flex size-11 shrink-0
                    items-center justify-center rounded-xl
                  `}
                >
                  <Shield className="size-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-lg">Roles & permissions</CardTitle>
                  <CardDescription className="mt-1 text-sm leading-relaxed">
                    RBAC templates and fine-grained access
                  </CardDescription>
                </div>
              </div>
              <CardAction>
                <Button asChild size="sm" className="shrink-0 gap-1">
                  <Link href="/roles">
                    Manage
                    <ArrowUpRight className="size-3.5 opacity-70" />
                  </Link>
                </Button>
              </CardAction>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {loadingOverview ? (
              <div className="space-y-3 pt-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : roles.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No roles configured yet.
              </p>
            ) : (
              <div className="divide-border/60 -mx-1 divide-y">
                <p
                  className={`
                    text-muted-foreground px-1 pb-2 text-xs font-semibold
                    tracking-wide uppercase
                  `}
                >
                  {roles.length} roles · top by usage
                </p>
                {roles.slice(0, 5).map((role) => (
                  <div
                    key={role.id}
                    className={`
                      hover:bg-muted/40
                      flex items-center gap-3 px-1 py-3 transition-colors
                      first:pt-1
                    `}
                  >
                    <div
                      className={`
                        bg-muted text-muted-foreground flex size-10 shrink-0
                        items-center justify-center rounded-lg
                      `}
                    >
                      <KeyRound className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`
                          text-foreground truncate text-sm font-medium
                        `}
                      >
                        {role.name}
                      </p>
                      <p className="text-muted-foreground line-clamp-1 text-xs">
                        {role.description ??
                          `${role.userCount} user${role.userCount === 1 ? "" : "s"} assigned`}
                      </p>
                    </div>
                    <span
                      className={`
                        text-muted-foreground shrink-0 text-xs tabular-nums
                      `}
                    >
                      {role.permissionCount} perms
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {canViewAudit && (
        <section aria-label="Recent audit activity">
          <Card
            className={`
              border-border/80 bg-card/90 overflow-hidden shadow-sm
              backdrop-blur-sm
            `}
          >
            <CardHeader className="border-border/60 border-b pb-4">
              <div
                className={`
                  flex flex-col gap-4
                  sm:flex-row sm:items-center sm:justify-between
                `}
              >
                <div className="flex min-w-0 gap-3">
                  <div
                    className={`
                      bg-foreground/8 text-foreground flex size-11 shrink-0
                      items-center justify-center rounded-xl
                    `}
                  >
                    <FileText className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Recent activity</CardTitle>
                    <CardDescription className="mt-1 text-sm leading-relaxed">
                      Latest audit events. Actor may be blank if the user was
                      removed or the action was system-scoped.
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className={`
                    shrink-0 gap-1 self-start
                    sm:self-center
                  `}
                  onClick={onViewAllAudit}
                >
                  Full audit log
                  <ArrowUpRight className="size-3.5 opacity-70" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {loadingActivity ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-xl" />
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No audit entries yet.
                </p>
              ) : (
                <ul
                  className={`
                    divide-border/60 border-border/50 bg-muted/20 divide-y
                    overflow-hidden rounded-xl border
                  `}
                >
                  {recentActivity.map((entry) => {
                    const tone = auditActionVariant(entry.action);
                    return (
                      <li key={entry.id}>
                        <div
                          className={`
                            hover:bg-muted/40
                            flex flex-col gap-3 p-3 transition-colors
                            sm:flex-row sm:items-center sm:justify-between
                            sm:px-4 sm:py-3.5
                          `}
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <span
                              className={cn(
                                "mt-0.5 h-9 w-1 shrink-0 rounded-full",
                                tone === "green" && "bg-success",
                                tone === "amber" && "bg-warning",
                                tone === "red" && "bg-destructive",
                                tone === "blue" && "bg-info",
                                tone === "grey" && "bg-muted-foreground/40",
                              )}
                              aria-hidden
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={tone}>{entry.action}</Badge>
                                {entry.resourceId ? (
                                  <span
                                    className={`
                                      text-muted-foreground text-[11px]
                                    `}
                                  >
                                    ID ·{" "}
                                    <code className="text-foreground/80">
                                      {entry.resourceId.slice(0, 8)}…
                                    </code>
                                  </span>
                                ) : null}
                              </div>
                              <p
                                className={`
                                  text-foreground mt-1 font-mono text-sm
                                  tracking-tight
                                `}
                              >
                                {entry.resource}
                              </p>
                            </div>
                          </div>
                          <div
                            className={`
                              border-border/50 flex shrink-0 items-center gap-3
                              pt-1 pl-4
                              sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5
                            `}
                          >
                            {entry.user ? (
                              <Avatar name={entry.user.name} size="md" />
                            ) : (
                              <div
                                className={`
                                  border-muted-foreground/35 bg-muted/40 flex
                                  size-8 shrink-0 items-center justify-center
                                  rounded-full border border-dashed
                                `}
                                title="Actor no longer linked to a user record"
                              >
                                <UserRoundX
                                  className="text-muted-foreground size-4"
                                  aria-hidden
                                />
                              </div>
                            )}
                            <div
                              className={`
                                min-w-0 text-left
                                sm:text-right
                              `}
                            >
                              <p className="text-foreground text-sm font-medium">
                                {entry.user?.name ?? "Unknown actor"}
                              </p>
                              <p
                                className={`
                                  text-muted-foreground text-xs tabular-nums
                                `}
                              >
                                {formatDistanceToNow(
                                  new Date(entry.createdAt),
                                  {
                                    addSuffix: true,
                                  },
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
