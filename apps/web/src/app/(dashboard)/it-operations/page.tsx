"use client";

import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  KeyRound,
  Link2,
  Loader2,
  PackageX,
  PiggyBank,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { StatCard } from "@/components/dashboard/stat-card";
import { ItWorkspaceTabs } from "@/components/it/it-workspace-tabs";
import { Badge } from "@/components/shared/badge";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  ACCESS_STATUS_LABELS,
  type AccessRequestStatus,
  getItOpsDashboard,
  type ItOpsDashboard,
} from "@/services/it-operations.service";

function formatMoney(byCurrency: Record<string, number>): string {
  const entries = Object.entries(byCurrency);
  if (entries.length === 0) return "-";
  return entries
    .map(([cur, amt]) => `${cur} ${Math.round(amt).toLocaleString()}`)
    .join(" / ");
}

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-GB") : "-";
}

export default function ItOperationsDashboardPage() {
  const { hasAnyPermission } = useAuth();
  const canBilling = hasAnyPermission("it:billing:view", "it:billing:manage");
  const canAccess = hasAnyPermission(
    "it:access:view",
    "it:access:request",
    "it:access:manage",
  );

  const [snap, setSnap] = useState<ItOpsDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getItOpsDashboard();
      setSnap(res.data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (
    !hasAnyPermission(
      "it:dashboard:view",
      "it:billing:view",
      "it:access:view",
      "it:access:manage",
    )
  ) {
    return (
      <div>
        <PageHeader title="IT CRM" />
        {/*
          The strip stays on the dead-end branch on purpose: an access
          REQUESTER clears the route gate but not this page's guard, and
          without it they land somewhere with no way onward. Requesters get no
          Operations tab, so what they see here is the Access tab they can
          actually use.
        */}
        <ItWorkspaceTabs />
        <p className="text-muted-foreground text-sm">
          You don&apos;t have access to the IT Operations dashboard.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="IT CRM"
        subtitle="Billing, access, and network health at a glance"
      >
        {/*
          Billing and Access used to be buttons here. The workspace strip
          below carries both, and two controls for one destination is worse
          than either alone.
        */}
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
        >
          <RefreshCw className="mr-1 size-3.5" />
          Refresh
        </Button>
      </PageHeader>

      <ItWorkspaceTabs />

      {/* KPI band */}
      <div
        className={`
          mb-5 grid gap-4
          md:grid-cols-2
          lg:grid-cols-4
        `}
      >
        {loading || !snap ? (
          Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[110px] rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              label="Monthly IT Spend"
              value={formatMoney(snap.cards.monthlySpendByCurrency)}
              change="Recurring run-rate"
              changeType="neutral"
              icon={Wallet}
              accent="primary"
              href={canBilling ? "/it-operations/billing" : undefined}
            />
            <StatCard
              label="Renewals (next 7 days)"
              value={String(snap.cards.upcomingRenewals7)}
              change="Action may be required"
              changeType={snap.cards.upcomingRenewals7 > 0 ? "down" : "neutral"}
              icon={CalendarClock}
              accent="warning"
            />
            <StatCard
              label="Active Subscriptions"
              value={String(snap.cards.activeSubscriptions)}
              change="Across all vendors"
              changeType="neutral"
              icon={Link2}
              accent="info"
            />
            <StatCard
              label="Pending Access Requests"
              value={String(snap.cards.pendingAccessRequests)}
              change="Awaiting approval"
              changeType={
                snap.cards.pendingAccessRequests > 0 ? "down" : "neutral"
              }
              icon={KeyRound}
              accent="success"
              href={canAccess ? "/it-operations/access" : undefined}
            />
          </>
        )}
      </div>

      {/* License utilization KPI band ("paid for but not used") */}
      {snap &&
        (snap.cards.totalLicenses > 0 || snap.cards.unusedLicenses > 0) && (
          <div
            className={`
              mb-5 grid gap-4
              md:grid-cols-2
              lg:grid-cols-4
            `}
          >
            <StatCard
              label="Total Licenses"
              value={snap.cards.totalLicenses.toLocaleString()}
              change="Across seat-based subscriptions"
              changeType="neutral"
              icon={Boxes}
              accent="info"
              href={canBilling ? "/it-operations/billing" : undefined}
            />
            <StatCard
              label="Assigned Licenses"
              value={snap.cards.assignedLicenses.toLocaleString()}
              change="Allocated to people"
              changeType="neutral"
              icon={UserCheck}
              accent="primary"
            />
            <StatCard
              label="Unused Licenses"
              value={snap.cards.unusedLicenses.toLocaleString()}
              change="Paid for, not assigned"
              changeType={snap.cards.unusedLicenses > 0 ? "down" : "up"}
              icon={PackageX}
              accent="warning"
            />
            <StatCard
              label="Potential Savings / mo"
              value={formatMoney(snap.cards.potentialMonthlySavingsByCurrency)}
              change="If unused seats dropped"
              changeType={
                Object.keys(snap.cards.potentialMonthlySavingsByCurrency).length
                  ? "up"
                  : "neutral"
              }
              icon={PiggyBank}
              accent="success"
              href={canBilling ? "/it-operations/billing" : undefined}
            />
          </div>
        )}

      {/* Charts */}
      {snap && (
        <div
          className={`
            mb-5 grid gap-4
            lg:grid-cols-2
          `}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Monthly Spend Trend ({snap.charts.spendTrendCurrency})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={snap.charts.spendTrend}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  {/* `label` is the human month; `month` stays YYYY-MM on the
                      row for any future drill-down. */}
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Vendor Spend Breakdown (monthly)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={snap.charts.vendorBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="vendorName" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="monthlySpend" fill="var(--color-info)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tables */}
      {snap && (
        <div
          className={`
            mb-5 grid gap-4
            lg:grid-cols-2
          `}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Upcoming Renewals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={[
                  { key: "productName", header: "Product" },
                  {
                    key: "vendorName",
                    mobileRole: "subtitle" as const,
                    header: "Vendor",
                    render: (r) => (
                      <span className="text-muted-foreground">
                        {r.vendorName}
                      </span>
                    ),
                  },
                  {
                    key: "renewalDate",
                    mobileRole: "field" as const,
                    header: "Renews",
                    render: (r) => (
                      <span>
                        {formatDate(r.renewalDate)}
                        {r.renewalInDays !== null && (
                          <span className="text-muted-foreground ml-1 text-xs">
                            ({r.renewalInDays}d)
                          </span>
                        )}
                      </span>
                    ),
                  },
                  {
                    key: "amount",
                    mobileRole: "field" as const,
                    header: "Amount",
                    className: "text-right",
                    render: (r) =>
                      `${r.currency} ${r.invoiceAmount.toLocaleString()}`,
                  },
                ]}
                data={snap.tables.upcomingRenewals}
                emptyMessage="No renewals in the next 30 days"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Pending Access Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={[
                  {
                    key: "requestNumber",
                    header: "#",
                    render: (r) => (
                      <span className="font-mono text-xs">
                        #{r.requestNumber}
                      </span>
                    ),
                  },
                  {
                    key: "employee",
                    mobileRole: "subtitle" as const,
                    header: "Employee",
                    render: (r) => r.employee.name,
                  },
                  {
                    key: "system",
                    mobileRole: "field" as const,
                    header: "System",
                    render: (r) => r.system.name,
                  },
                  {
                    key: "status",
                    mobileRole: "badge" as const,
                    header: "Status",
                    render: (r) => (
                      <Badge status={r.status}>
                        {ACCESS_STATUS_LABELS[
                          r.status as AccessRequestStatus
                        ] ?? r.status}
                      </Badge>
                    ),
                  },
                ]}
                data={snap.tables.pendingAccessRequests}
                emptyMessage="No pending requests"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent grants / revokes */}
      {snap && canAccess && (
        <div
          className={`
            mb-5 grid gap-4
            lg:grid-cols-2
          `}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="text-success size-4" /> Recently Granted
                Access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {snap.recentGrantedAccess.length === 0 ? (
                <p className="text-muted-foreground text-xs">Nothing recent.</p>
              ) : (
                snap.recentGrantedAccess.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>
                      <strong>{a.employee.name}</strong> &rarr; {a.system.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(a.grantedAt)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="text-warning size-4" /> Recently
                Revoked Access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {snap.recentRevokedAccess.length === 0 ? (
                <p className="text-muted-foreground text-xs">Nothing recent.</p>
              ) : (
                snap.recentRevokedAccess.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>
                      <strong>{a.employee.name}</strong> &rarr; {a.system.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(a.revokedAt)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Office Network Checkup - informational only */}
      {snap && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Office Network Checkup
            </CardTitle>
            <p className="text-muted-foreground text-xs">
              Informational only - live monitoring is handled by the network
              vendor&apos;s software.
            </p>
          </CardHeader>
          <CardContent>
            <div
              className={`
                grid gap-3
                sm:grid-cols-2
                lg:grid-cols-4
              `}
            >
              {snap.networkCheckup.map((n) => (
                <div
                  key={n.key}
                  className="border-border bg-muted/30 rounded-lg border p-3"
                >
                  <p className="text-muted-foreground text-xs">{n.label}</p>
                  <p className="mt-1 text-sm font-medium">{n.value}</p>
                  <p
                    className={`
                      text-muted-foreground mt-1 text-[11px] leading-snug
                    `}
                  >
                    {n.hint}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loading && !snap && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
        </div>
      )}
    </div>
  );
}
