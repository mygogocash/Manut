"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Briefcase,
  Building2,
  Calendar,
  CalendarDays,
  CalendarPlus,
  KeyRound,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plane,
  PlusCircle,
  RotateCcw,
  Shield,
  Star,
  Target,
  Trash2,
  User,
} from "lucide-react";
import { useRouter } from "nextjs-toploader/app";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { LeaveRequestDialog } from "@/components/leave/leave-request-dialog";
import { UpdateProfileDialog } from "@/components/my-portal/update-profile-dialog";
import { MyPayslipsTab } from "@/components/payroll/my-payslips-tab";
import { Avatar } from "@/components/shared/avatar";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent } from "@/components/shared/tabs";
import { TravelRequestDialog } from "@/components/travel/travel-request-dialog";
import { Badge as ShadcnBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePagination } from "@/hooks/use-pagination";
import { useTabParam } from "@/hooks/use-tab-param";
import { ApiError } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import type { Entity } from "@/services/entity.service";
import { listExpenseFormEntities } from "@/services/entity.service";
import { type Expense, listExpenses } from "@/services/expense.service";
import {
  cancelLeaveRequest,
  getLeaveBalances,
  getLeaveRequests,
  getLeaveTypes,
  LEAVE_CATEGORY_LABEL,
  LEAVE_CATEGORY_ORDER,
  type LeaveBalance,
  type LeaveCategory,
  type LeaveRequest,
  type LeaveType,
  normalizeLeaveCategory,
} from "@/services/leave.service";
import { getMyProfile, type MyProfile } from "@/services/my-portal.service";
import { type Appraisal, listAppraisals } from "@/services/performance.service";
import {
  cancelTravelRequest,
  listTravelRequests,
  type TravelRequest,
} from "@/services/travel.service";

const ALL_FILTER = "__all__";

const ALL_TABS: { id: string; label: string; permission: string | null }[] = [
  { id: "leave", label: "My Leave", permission: "leave:read" },
  { id: "travel", label: "My Travel", permission: "travel:read" },
  { id: "expense", label: "My Expenses", permission: "expense:read" },
  // Open to anyone authenticated — the API scopes the list to the
  // caller's own employee id, so no additional perm gate is needed.
  { id: "payslip", label: "My Payslip", permission: null },
  {
    id: "performance",
    label: "My Performance",
    permission: "performance:read",
  },
  { id: "profile", label: "My Profile", permission: null },
];

const TAB_TOOLBAR =
  "border-border/80 bg-card/85 mb-4 flex flex-col gap-3 rounded-xl border p-4 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between";

const TABLE_SURFACE =
  "overflow-hidden rounded-xl border border-border/60 bg-muted/15 shadow-sm";

const TABLE_ROW_HEIGHT = "h-12";
const TABLE_CELL_BASE = "py-2.5 align-middle";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MyPortalPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();

  const visibleTabs = useMemo(
    () =>
      ALL_TABS.filter(
        (t) => t.permission === null || hasPermission(t.permission),
      ),
    [hasPermission],
  );

  const [activeTab, setActiveTab] = useTabParam(
    visibleTabs[0]?.id ?? "profile",
  );

  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [travelDialogOpen, setTravelDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [expenseEntities, setExpenseEntities] = useState<Entity[]>([]);

  // Profile
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Leave
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(true);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState(ALL_FILTER);
  const leavePagination = usePagination({ initialPageSize: 10 });
  const {
    page: leavePage,
    pageSize: leavePageSize,
    setTotalCount: setLeaveTotalCount,
  } = leavePagination;

  // Travel
  const [travelRequests, setTravelRequests] = useState<TravelRequest[]>([]);
  const [travelLoading, setTravelLoading] = useState(true);
  const [travelStatusFilter, setTravelStatusFilter] = useState(ALL_FILTER);
  const travelPagination = usePagination({ initialPageSize: 10 });
  const {
    page: travelPage,
    pageSize: travelPageSize,
    setTotalCount: setTravelTotalCount,
  } = travelPagination;

  // Expense
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseLoading, setExpenseLoading] = useState(true);
  const [expenseStatusFilter, setExpenseStatusFilter] = useState(ALL_FILTER);
  const expensePagination = usePagination({ initialPageSize: 10 });
  const {
    page: expensePage,
    pageSize: expensePageSize,
    setTotalCount: setExpenseTotalCount,
  } = expensePagination;

  // Performance
  const [myAppraisals, setMyAppraisals] = useState<Appraisal[]>([]);
  const [perfLoading, setPerfLoading] = useState(true);

  // Profile dialog
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  // Cancel confirm
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await getMyProfile();
      setProfile(res.data.profile);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load profile";
      toast.error(msg);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const fetchBalances = useCallback(async () => {
    try {
      setBalancesLoading(true);
      const res = await getLeaveBalances();
      setLeaveBalances(res.data);
    } catch {
      /* silent */
    } finally {
      setBalancesLoading(false);
    }
  }, []);

  const fetchLeaveRequests = useCallback(async () => {
    if (!user?.id) return;
    setLeaveLoading(true);
    try {
      // Always scope to the signed-in user. The backend's `getRequests`
      // skips its self-scope when the caller has `leave:hr-read`, which
      // would otherwise spill every employee's request into My Portal.
      const res = await getLeaveRequests({
        page: leavePage,
        limit: leavePageSize,
        employeeId: user.id,
        ...(leaveStatusFilter !== ALL_FILTER && { status: leaveStatusFilter }),
      });
      setLeaveRequests(res.data);
      setLeaveTotalCount(res.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load leave requests";
      toast.error(msg);
    } finally {
      setLeaveLoading(false);
    }
  }, [
    user?.id,
    leavePage,
    leavePageSize,
    leaveStatusFilter,
    setLeaveTotalCount,
  ]);

  const fetchTravelRequests = useCallback(async () => {
    if (!user?.id) return;
    setTravelLoading(true);
    try {
      const res = await listTravelRequests({
        page: travelPage,
        limit: travelPageSize,
        employeeId: user.id,
        ...(travelStatusFilter !== ALL_FILTER && {
          status: travelStatusFilter,
        }),
      });
      setTravelRequests(res.data);
      setTravelTotalCount(res.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to load travel requests";
      toast.error(msg);
    } finally {
      setTravelLoading(false);
    }
  }, [
    user?.id,
    travelPage,
    travelPageSize,
    travelStatusFilter,
    setTravelTotalCount,
  ]);

  const fetchExpenses = useCallback(async () => {
    if (!user?.id) return;
    setExpenseLoading(true);
    try {
      const res = await listExpenses({
        page: expensePage,
        limit: expensePageSize,
        employeeId: user.id,
        ...(expenseStatusFilter !== ALL_FILTER && {
          status: expenseStatusFilter,
        }),
      });
      setExpenses(res.data);
      setExpenseTotalCount(res.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load expenses";
      toast.error(msg);
    } finally {
      setExpenseLoading(false);
    }
  }, [
    user?.id,
    expensePage,
    expensePageSize,
    expenseStatusFilter,
    setExpenseTotalCount,
  ]);

  const fetchMyAppraisals = useCallback(async () => {
    if (!user?.id) return;
    try {
      setPerfLoading(true);
      const res = await listAppraisals({ employeeId: user.id, limit: 20 });
      setMyAppraisals(res.data);
    } catch {
      /* silent – non-critical */
    } finally {
      setPerfLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!leaveDialogOpen) return;
    void (async () => {
      try {
        const res = await getLeaveTypes();
        setLeaveTypes(res.data);
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to load leave types";
        toast.error(msg);
      }
    })();
  }, [leaveDialogOpen]);

  useEffect(() => {
    if (!expenseDialogOpen) return;
    void listExpenseFormEntities()
      .then((res) => setExpenseEntities(res.data))
      .catch((err) => {
        const msg =
          err instanceof ApiError ? err.message : "Failed to load entities";
        toast.error(msg);
      });
  }, [expenseDialogOpen]);
  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);
  useEffect(() => {
    fetchLeaveRequests();
  }, [fetchLeaveRequests]);
  useEffect(() => {
    fetchTravelRequests();
  }, [fetchTravelRequests]);
  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);
  useEffect(() => {
    fetchMyAppraisals();
  }, [fetchMyAppraisals]);
  useEffect(() => {
    leavePagination.setPage(1);
  }, [leaveStatusFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    travelPagination.setPage(1);
  }, [travelStatusFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    expensePagination.setPage(1);
  }, [expenseStatusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCancelLeave(id: string) {
    const req = leaveRequests.find((r) => r.id === id);
    if (req?.status === "approved") {
      if (
        !window.confirm(
          "Recall this approved leave? Your line manager has to approve the cancellation before the balance is refunded.",
        )
      ) {
        return;
      }
    }
    try {
      setCancellingId(id);
      await cancelLeaveRequest(id);
      toast.success(
        req?.status === "approved"
          ? "Recall sent — awaiting manager approval"
          : "Leave request cancelled",
      );
      fetchLeaveRequests();
      fetchBalances();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to cancel";
      toast.error(msg);
    } finally {
      setCancellingId(null);
    }
  }

  async function handleCancelTravel(id: string) {
    try {
      setCancellingId(id);
      await cancelTravelRequest(id);
      toast.success("Travel request cancelled");
      fetchTravelRequests();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to cancel";
      toast.error(msg);
    } finally {
      setCancellingId(null);
    }
  }

  // Resilient against legacy rows that stored the currency symbol
  // instead of the ISO code — see apps/web/src/lib/format-currency.ts.
  function formatAmount(amount: string, currency: string) {
    return formatCurrency(amount, currency);
  }

  function formatBudget(amount: string | null, currency: string) {
    if (!amount) return "—";
    return formatCurrency(amount, currency, { minimumFractionDigits: 0 });
  }

  return (
    <div className="w-full space-y-8 pb-10">
      <PageHeader
        title="My Portal"
        subtitle="Leave balances, requests, travel, expenses, and your employee profile in one place"
      />

      <Card
        className={`
          border-border/80 from-card via-card to-muted/25 ring-border/60
          relative overflow-hidden bg-linear-to-br shadow-md ring-1
        `}
      >
        <div
          className={`
            from-primary/[0.07] pointer-events-none absolute inset-x-0 top-0
            h-24 bg-linear-to-b to-transparent
          `}
          aria-hidden
        />
        <CardContent
          className={`
            relative p-6
            sm:p-8
          `}
        >
          {profileLoading ? (
            <div
              className={`
                flex flex-col gap-6
                sm:flex-row sm:items-center
              `}
            >
              <Skeleton
                className={`
                  mx-auto size-24 shrink-0 rounded-2xl
                  sm:mx-0
                `}
              />
              <div className="flex-1 space-y-3">
                <Skeleton
                  className={`
                    mx-auto h-7 w-48
                    sm:mx-0
                  `}
                />
                <Skeleton className="h-4 w-full max-w-md" />
                <Skeleton className="h-4 w-full max-w-sm" />
              </div>
            </div>
          ) : (
            <div
              className={`
                flex flex-col gap-6
                lg:flex-row lg:items-center lg:justify-between
              `}
            >
              <div
                className={`
                  flex flex-col items-center gap-5
                  sm:flex-row sm:items-start
                `}
              >
                <Avatar
                  name={profile?.name ?? user?.name ?? "User"}
                  src={profile?.avatarUrl}
                  size="lg"
                  className={`
                    ring-background size-24 shrink-0 rounded-2xl shadow-md
                    ring-4
                  `}
                />
                <div
                  className={`
                    min-w-0 flex-1 space-y-3 text-center
                    sm:text-left
                  `}
                >
                  <div>
                    <p
                      className={`
                        text-muted-foreground text-xs font-semibold
                        tracking-wide uppercase
                      `}
                    >
                      Signed in as
                    </p>
                    <h2
                      className={`
                        text-foreground mt-1 truncate text-2xl font-semibold
                        tracking-tight
                      `}
                    >
                      {profile?.name ?? user?.name ?? "—"}
                    </h2>
                  </div>
                  <div
                    className={`
                      flex flex-wrap justify-center gap-2
                      sm:justify-start
                    `}
                  >
                    <MetaChip icon={Mail}>
                      {profile?.email ?? user?.email}
                    </MetaChip>
                    {profile?.department ? (
                      <MetaChip icon={Building2}>{profile.department}</MetaChip>
                    ) : null}
                    {profile?.jobTitle ? (
                      <MetaChip icon={Briefcase}>{profile.jobTitle}</MetaChip>
                    ) : null}
                    {profile?.phone ? (
                      <MetaChip icon={Phone}>{profile.phone}</MetaChip>
                    ) : null}
                    {profile?.location ? (
                      <MetaChip icon={MapPin}>{profile.location}</MetaChip>
                    ) : null}
                    {profile?.startDate ? (
                      <MetaChip icon={Calendar}>
                        Joined {formatDate(profile.startDate)}
                      </MetaChip>
                    ) : null}
                  </div>
                  {profile?.roles && profile.roles.length > 0 ? (
                    <div
                      className={`
                        flex flex-wrap justify-center gap-1.5
                        sm:justify-start
                      `}
                    >
                      {profile.roles.map((r) => (
                        <ShadcnBadge
                          key={r.id}
                          variant="secondary"
                          className="font-medium"
                        >
                          {r.name}
                        </ShadcnBadge>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div
                className={`
                  flex shrink-0 flex-col items-center gap-2
                  sm:flex-row sm:justify-end
                  lg:flex-col lg:items-end
                `}
              >
                {profile?.employeeId ? (
                  <ShadcnBadge className="px-3 py-1 font-mono text-xs">
                    ID {profile.employeeId}
                  </ShadcnBadge>
                ) : null}
                <Button
                  variant="default"
                  className="gap-2 shadow-sm"
                  onClick={() => setProfileDialogOpen(true)}
                >
                  <Pencil className="size-4" />
                  Update profile
                  <ArrowUpRight className="size-3.5 opacity-70" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {hasPermission("leave:read") && balancesLoading ? (
        <div
          className={`
            grid grid-cols-2 gap-3
            lg:grid-cols-4
          `}
          aria-busy
          aria-label="Loading leave balances"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-xl" />
          ))}
        </div>
      ) : hasPermission("leave:read") && leaveBalances.length > 0 ? (
        <section aria-label="Leave balances" className="flex flex-col gap-5">
          <h3
            className={`
              text-muted-foreground text-xs font-semibold tracking-wide
              uppercase
            `}
          >
            Leave balances
          </h3>
          {(() => {
            const grouped = new Map<LeaveCategory, typeof leaveBalances>();
            for (const b of leaveBalances) {
              const cat = normalizeLeaveCategory(b.leaveType.category);
              const arr = grouped.get(cat) ?? [];
              arr.push(b);
              grouped.set(cat, arr);
            }
            return LEAVE_CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map(
              (cat) => (
                <div key={cat} className="flex flex-col gap-2">
                  <p
                    className={`
                      text-muted-foreground/80 text-[11px] font-semibold
                      tracking-[0.08em] uppercase
                    `}
                  >
                    {LEAVE_CATEGORY_LABEL[cat]}
                  </p>
                  <div
                    className={`
                      grid grid-cols-2 gap-3
                      lg:grid-cols-4
                    `}
                  >
                    {grouped.get(cat)!.map((b) => (
                      <Card
                        key={b.id}
                        className={`
                          border-border/80 gap-0 overflow-hidden shadow-sm
                          transition-shadow
                          hover:shadow-md
                        `}
                      >
                        <CardContent className="flex flex-col gap-3 p-4">
                          <div
                            className={`flex items-start justify-between gap-2`}
                          >
                            <p
                              className={`
                                text-muted-foreground line-clamp-2 text-xs
                                leading-snug font-semibold
                              `}
                            >
                              {b.leaveType.name}
                            </p>
                            <div
                              className={`
                                bg-primary/12 text-primary flex size-9 shrink-0
                                items-center justify-center rounded-lg
                              `}
                            >
                              <CalendarDays className="size-4" />
                            </div>
                          </div>
                          <div>
                            <p
                              className={`
                                text-foreground text-3xl font-semibold
                                tracking-tight tabular-nums
                              `}
                            >
                              {b.remaining}
                            </p>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              days left of{" "}
                              <span
                                className={`
                                  text-foreground/80 font-medium tabular-nums
                                `}
                              >
                                {b.entitled}
                              </span>{" "}
                              entitled
                            </p>
                            {b.carried > 0 && (
                              <p
                                className={`
                                  mt-0.5 text-[11px]
                                  ${
                                    b.carriedExpired
                                      ? "text-destructive"
                                      : `text-muted-foreground`
                                  }
                                `}
                              >
                                {b.carriedRemaining} of {b.carried} carried
                                {b.carriedExpiry &&
                                  ` · ${b.carriedExpired ? "expired" : "expires " + b.carriedExpiry.split("-").reverse().join("/")}`}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ),
            );
          })()}
        </section>
      ) : null}

      {/* Tabs */}
      <Tabs
        tabs={visibleTabs}
        active={activeTab}
        onChange={setActiveTab}
        className="w-full"
      >
        {/* Leave Tab */}
        <TabsContent value="leave">
          <div className={TAB_TOOLBAR}>
            <div>
              <h3
                className={`
                  text-foreground text-lg font-semibold tracking-tight
                `}
              >
                Leave requests
              </h3>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Submit time off and track approvals
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {hasPermission("leave:request") && (
                <Button
                  className="gap-2 shadow-sm"
                  onClick={() => setLeaveDialogOpen(true)}
                >
                  <CalendarPlus className="size-4" />
                  Request leave
                </Button>
              )}
              <Select
                value={leaveStatusFilter}
                onValueChange={setLeaveStatusFilter}
              >
                <SelectTrigger className="h-10 w-[148px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className={TABLE_SURFACE}>
            <Table>
              <TableHeader className="bg-muted/45">
                <TableRow
                  className={`
                    border-border/60
                    hover:bg-transparent
                  `}
                >
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className={TABLE_ROW_HEIGHT}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <TableCell key={j} className={TABLE_CELL_BASE}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : leaveRequests.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-muted-foreground py-8 text-center"
                    >
                      No leave requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  leaveRequests.map((req, idx) => (
                    <TableRow
                      key={req.id}
                      className={cn(
                        TABLE_ROW_HEIGHT,
                        `
                          border-border/40
                          hover:bg-muted/25
                        `,
                      )}
                    >
                      <TableCell
                        className={cn(
                          TABLE_CELL_BASE,
                          "text-muted-foreground w-12 text-center text-sm",
                        )}
                      >
                        {(leavePagination.page - 1) * leavePagination.pageSize +
                          idx +
                          1}
                      </TableCell>
                      <TableCell className={cn(TABLE_CELL_BASE, "font-medium")}>
                        {req.leaveType.name}
                      </TableCell>
                      <TableCell className={TABLE_CELL_BASE}>
                        {formatDate(req.startDate)}
                      </TableCell>
                      <TableCell className={TABLE_CELL_BASE}>
                        {formatDate(req.endDate)}
                      </TableCell>
                      <TableCell className={TABLE_CELL_BASE}>
                        {req.days}
                      </TableCell>
                      <TableCell className={TABLE_CELL_BASE}>
                        <Badge status={req.status}>{req.status}</Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          TABLE_CELL_BASE,
                          "text-muted-foreground text-sm",
                        )}
                      >
                        {formatDate(req.createdAt)}
                      </TableCell>
                      <TableCell className={cn(TABLE_CELL_BASE, "w-20")}>
                        {req.status === "pending" ? (
                          <Button
                            variant="outline"
                            size="icon"
                            className={`
                              text-destructive h-8 w-8
                              hover:text-destructive
                            `}
                            title="Cancel request"
                            disabled={cancellingId === req.id}
                            onClick={() => handleCancelLeave(req.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : req.status === "approved" ? (
                          <Button
                            variant="outline"
                            size="icon"
                            className={`
                              text-warning h-8 w-8
                              hover:text-warning
                            `}
                            title="Recall — sends cancellation back to your line manager"
                            disabled={cancellingId === req.id}
                            onClick={() => handleCancelLeave(req.id)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <div className="h-8 w-8" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            page={leavePagination.page}
            pageSize={leavePagination.pageSize}
            totalCount={leavePagination.totalCount}
            totalPages={leavePagination.totalPages}
            pageSizeOptions={[10, 20, 50]}
            onPageChange={leavePagination.setPage}
            onPageSizeChange={leavePagination.setPageSize}
          />
        </TabsContent>

        {/* Travel Tab */}
        <TabsContent value="travel">
          <div className={TAB_TOOLBAR}>
            <div>
              <h3
                className={`
                  text-foreground text-lg font-semibold tracking-tight
                `}
              >
                Travel requests
              </h3>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Trips, budgets, and approval status
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {hasPermission("travel:request") && (
                <Button
                  className="gap-2 shadow-sm"
                  onClick={() => setTravelDialogOpen(true)}
                >
                  <Plane className="size-4" />
                  New travel request
                </Button>
              )}
              <Select
                value={travelStatusFilter}
                onValueChange={setTravelStatusFilter}
              >
                <SelectTrigger className="h-10 w-[148px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className={TABLE_SURFACE}>
            <Table>
              <TableHeader className="bg-muted/45">
                <TableRow
                  className={`
                    border-border/60
                    hover:bg-transparent
                  `}
                >
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Return</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {travelLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className={TABLE_ROW_HEIGHT}>
                      {Array.from({ length: 9 }).map((__, j) => (
                        <TableCell key={j} className={TABLE_CELL_BASE}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : travelRequests.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-muted-foreground py-8 text-center"
                    >
                      No travel requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  travelRequests.map((req, idx) => (
                    <TableRow
                      key={req.id}
                      className={cn(
                        TABLE_ROW_HEIGHT,
                        `
                          border-border/40
                          hover:bg-muted/25
                        `,
                      )}
                    >
                      <TableCell
                        className={cn(
                          TABLE_CELL_BASE,
                          "text-muted-foreground w-12 text-center text-sm",
                        )}
                      >
                        {(travelPagination.page - 1) *
                          travelPagination.pageSize +
                          idx +
                          1}
                      </TableCell>
                      <TableCell
                        className={cn(TABLE_CELL_BASE, "font-mono text-xs")}
                      >
                        {req.requestCode}
                      </TableCell>
                      <TableCell
                        className={cn(
                          TABLE_CELL_BASE,
                          "max-w-40 truncate font-medium",
                        )}
                      >
                        {req.origin
                          ? `${req.origin} → ${req.destination}`
                          : req.destination}
                      </TableCell>
                      <TableCell className={TABLE_CELL_BASE}>
                        {formatDate(req.departureDate)}
                      </TableCell>
                      <TableCell className={TABLE_CELL_BASE}>
                        {formatDate(req.returnDate)}
                      </TableCell>
                      <TableCell
                        className={cn(TABLE_CELL_BASE, "tabular-nums")}
                      >
                        {formatBudget(req.estimatedBudget, req.currency)}
                      </TableCell>
                      <TableCell className={TABLE_CELL_BASE}>
                        <Badge
                          status={
                            req.status === "approved"
                              ? "approved"
                              : req.status === "rejected" ||
                                  req.status === "cancelled"
                                ? "rejected"
                                : "pending"
                          }
                        >
                          {req.status}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          TABLE_CELL_BASE,
                          "text-muted-foreground text-sm",
                        )}
                      >
                        {formatDate(req.createdAt)}
                      </TableCell>
                      <TableCell className={cn(TABLE_CELL_BASE, "w-20")}>
                        {req.status === "pending" || req.status === "draft" ? (
                          <Button
                            variant="outline"
                            size="icon"
                            className={`
                              text-destructive h-8 w-8
                              hover:text-destructive
                            `}
                            title="Cancel request"
                            disabled={cancellingId === req.id}
                            onClick={() => handleCancelTravel(req.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <div className="h-8 w-8" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            page={travelPagination.page}
            pageSize={travelPagination.pageSize}
            totalCount={travelPagination.totalCount}
            totalPages={travelPagination.totalPages}
            pageSizeOptions={[10, 20, 50]}
            onPageChange={travelPagination.setPage}
            onPageSizeChange={travelPagination.setPageSize}
          />
        </TabsContent>

        {/* Expense Tab */}
        <TabsContent value="expense">
          <div className={TAB_TOOLBAR}>
            <div>
              <h3
                className={`
                  text-foreground text-lg font-semibold tracking-tight
                `}
              >
                Expense reports
              </h3>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Claims you submitted and their status
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {hasPermission("expense:create") && (
                <Button
                  className="gap-2 shadow-sm"
                  onClick={() => setExpenseDialogOpen(true)}
                >
                  <PlusCircle className="size-4" />
                  New expense
                </Button>
              )}
              <Select
                value={expenseStatusFilter}
                onValueChange={setExpenseStatusFilter}
              >
                <SelectTrigger className="h-10 w-[148px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className={TABLE_SURFACE}>
            <Table>
              <TableHeader className="bg-muted/45">
                <TableRow
                  className={`
                    border-border/60
                    hover:bg-transparent
                  `}
                >
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className={TABLE_ROW_HEIGHT}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j} className={TABLE_CELL_BASE}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : expenses.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-muted-foreground py-8 text-center"
                    >
                      No expense reports found
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map((exp, idx) => (
                    <TableRow
                      key={exp.id}
                      className={cn(
                        TABLE_ROW_HEIGHT,
                        `
                          border-border/40
                          hover:bg-muted/25
                        `,
                      )}
                    >
                      <TableCell
                        className={cn(
                          TABLE_CELL_BASE,
                          "text-muted-foreground w-12 text-center text-sm",
                        )}
                      >
                        {(expensePagination.page - 1) *
                          expensePagination.pageSize +
                          idx +
                          1}
                      </TableCell>
                      <TableCell
                        className={cn(
                          TABLE_CELL_BASE,
                          "max-w-48 truncate font-medium",
                        )}
                      >
                        {exp.description}
                      </TableCell>
                      <TableCell
                        className={cn(
                          TABLE_CELL_BASE,
                          "font-medium tabular-nums",
                        )}
                      >
                        {formatAmount(exp.amount, exp.currency)}
                      </TableCell>
                      <TableCell className={TABLE_CELL_BASE}>
                        {exp.entity?.name ?? "—"}
                      </TableCell>
                      <TableCell className={TABLE_CELL_BASE}>
                        {formatDate(exp.date)}
                      </TableCell>
                      <TableCell className={TABLE_CELL_BASE}>
                        <Badge status={exp.status}>{exp.status}</Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          TABLE_CELL_BASE,
                          "text-muted-foreground text-sm",
                        )}
                      >
                        {formatDate(exp.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            page={expensePagination.page}
            pageSize={expensePagination.pageSize}
            totalCount={expensePagination.totalCount}
            totalPages={expensePagination.totalPages}
            pageSizeOptions={[10, 20, 50]}
            onPageChange={expensePagination.setPage}
            onPageSizeChange={expensePagination.setPageSize}
          />
        </TabsContent>

        {/* Payslip Tab — read-only list of the caller's own payslips
            with HR-uploaded PDF download. */}
        <TabsContent value="payslip" className="space-y-4">
          <MyPayslipsTab />
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          {perfLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full rounded-xl" />
              ))}
            </div>
          ) : myAppraisals.length === 0 ? (
            <EmptyState
              icon={<Star />}
              title="No appraisals assigned"
              description="Performance reviews and appraisals from your manager will appear here."
            />
          ) : (
            <div
              className={`
                grid gap-4
                md:grid-cols-2
              `}
            >
              {myAppraisals.map((a) => (
                <Card
                  key={a.id}
                  className="border-border/80 bg-card/90 shadow-sm"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm font-semibold">
                          {a.cycle.name}
                        </CardTitle>
                        <CardDescription className="mt-0.5 text-xs">
                          {a.manager
                            ? `Manager: ${a.manager.name}`
                            : "No manager assigned"}
                        </CardDescription>
                      </div>
                      <ShadcnBadge
                        variant={
                          a.status === "completed" ? "default" : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {a.status.replace(/_/g, " ")}
                      </ShadcnBadge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      {(
                        [
                          ["Self", a.selfRating],
                          ["Manager", a.managerRating],
                          ["Final", a.finalRating],
                        ] as const
                      ).map(([label, val]) => (
                        <div key={label} className="text-center">
                          <p
                            className={`
                              text-muted-foreground mb-1 text-[10px]
                              font-semibold tracking-wider uppercase
                            `}
                          >
                            {label}
                          </p>
                          <div className="text-lg font-medium">
                            {val !== null && val !== undefined ? (
                              <span className="inline-flex items-center gap-1">
                                <Star
                                  className={`
                                    size-3 fill-amber-500 text-amber-500
                                  `}
                                />
                                {Number(val).toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {a.goals.length > 0 && (
                      <div>
                        <p
                          className={`
                            text-muted-foreground mb-2 text-[10px] font-semibold
                            tracking-wider uppercase
                          `}
                        >
                          Goals
                        </p>
                        <div className="space-y-1.5">
                          {a.goals.map((g) => (
                            <div
                              key={g.id}
                              className={`
                                bg-muted/50 flex items-center justify-between
                                rounded px-2.5 py-1.5 text-xs
                              `}
                            >
                              <div className="flex items-center gap-2">
                                <Target className="text-muted-foreground size-3" />
                                <span>{g.title}</span>
                              </div>
                              <span className="text-muted-foreground">
                                {g.weight}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => router.push("/performance")}
                    >
                      <ArrowUpRight className="mr-1 size-3" />
                      View Details
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-5">
          <Card
            className={`
              border-border/80 bg-card/90 overflow-hidden shadow-sm
              backdrop-blur-sm
            `}
          >
            <CardHeader className="border-border/60 border-b pb-4">
              <div className="flex items-start gap-3">
                <div
                  className={`
                    bg-info/15 text-info flex size-11 shrink-0 items-center
                    justify-center rounded-xl
                  `}
                >
                  <User className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    Personal information
                  </CardTitle>
                  <CardDescription className="mt-1 text-sm leading-relaxed">
                    Details from HR — update contact info from the hero card
                    when allowed.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              {profileLoading ? (
                <div
                  className={`
                    grid gap-3
                    sm:grid-cols-2
                  `}
                >
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-[72px] rounded-xl" />
                  ))}
                </div>
              ) : !profile ? (
                <EmptyState
                  compact
                  icon={<User />}
                  title="No profile data"
                  description="Profile details aren't available. Contact your administrator to set them up."
                />
              ) : (
                <div
                  className={`
                    grid grid-cols-1 gap-3
                    sm:grid-cols-2
                  `}
                >
                  <InfoRow label="Full Name" value={profile.name} />
                  <InfoRow label="Email" value={profile.email} />
                  <InfoRow label="Phone" value={profile.phone ?? "—"} />
                  <InfoRow
                    label="Department"
                    value={profile.department ?? "—"}
                  />
                  <InfoRow label="Job Title" value={profile.jobTitle ?? "—"} />
                  <InfoRow
                    label="Employment Type"
                    value={profile.employmentType?.replace(/_/g, " ") ?? "—"}
                  />
                  <InfoRow
                    label="Employee ID"
                    value={profile.employeeId ?? "—"}
                  />
                  <InfoRow
                    label="Start Date"
                    value={
                      profile.startDate ? formatDate(profile.startDate) : "—"
                    }
                  />
                  <InfoRow label="Location" value={profile.location ?? "—"} />
                  <InfoRow label="Country" value={profile.country ?? "—"} />
                  <InfoRow label="Timezone" value={profile.timezone ?? "—"} />
                  {profile.entity ? (
                    <InfoRow label="Entity" value={profile.entity.name} />
                  ) : null}
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
              <div className="flex items-start gap-3">
                <div
                  className={`
                    bg-primary/12 text-primary flex size-11 shrink-0
                    items-center justify-center rounded-xl
                  `}
                >
                  <KeyRound className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Account security</CardTitle>
                  <CardDescription className="mt-1 text-sm">
                    Password and sign-in
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => router.push("/change-password")}
              >
                <KeyRound className="size-4" />
                Change password
                <ArrowUpRight className="size-3.5 opacity-60" />
              </Button>
            </CardContent>
          </Card>

          {profile?.roles && profile.roles.length > 0 ? (
            <Card
              className={`
                border-border/80 bg-card/90 overflow-hidden shadow-sm
                backdrop-blur-sm
              `}
            >
              <CardHeader className="border-border/60 border-b pb-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`
                      bg-foreground/8 text-foreground flex size-11 shrink-0
                      items-center justify-center rounded-xl
                    `}
                  >
                    <Shield className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Assigned roles</CardTitle>
                    <CardDescription className="mt-1 text-sm leading-relaxed">
                      These roles control what you can see and do in Manut.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                <div className="flex flex-wrap gap-2">
                  {profile.roles.map((r) => (
                    <ShadcnBadge
                      key={r.id}
                      variant="secondary"
                      className="px-3 py-1 text-xs font-medium"
                    >
                      {r.name}
                    </ShadcnBadge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>

      <UpdateProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        profile={profile}
        onSaved={() => {
          fetchProfile();
        }}
      />

      <LeaveRequestDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        leaveTypes={leaveTypes}
        balances={leaveBalances}
        onCreated={() => {
          fetchLeaveRequests();
          fetchBalances();
        }}
      />

      <TravelRequestDialog
        open={travelDialogOpen}
        onOpenChange={setTravelDialogOpen}
        onCreated={() => {
          fetchTravelRequests();
        }}
      />

      <ExpenseFormDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        entities={expenseEntities}
        onCreated={() => {
          fetchExpenses();
        }}
      />
    </div>
  );
}

function MetaChip({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span
      className={`
        text-muted-foreground border-border/70 bg-background/90 inline-flex
        max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs
        shadow-sm
      `}
    >
      <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className={cn(
        "border-border/60 bg-muted/20 rounded-xl border px-4 py-3",
        `
          hover:bg-muted/35
          transition-colors
        `,
      )}
    >
      <p
        className={`
          text-muted-foreground text-[11px] font-semibold tracking-wide
          uppercase
        `}
      >
        {label}
      </p>
      <p className="text-foreground mt-1.5 text-sm leading-snug font-medium">
        {value}
      </p>
    </div>
  );
}
