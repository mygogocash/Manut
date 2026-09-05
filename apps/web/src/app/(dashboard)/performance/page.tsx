"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ClipboardList,
  Pencil,
  Play,
  Plus,
  Search,
  Square,
  Star,
  Target,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { FormDatePicker } from "@/components/shared/form-date-picker";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent } from "@/components/shared/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { useTabParam } from "@/hooks/use-tab-param";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  type Appraisal,
  type AppraisalCycle,
  type AppraisalQueryParams,
  createCycle,
  createGoal,
  listAppraisals,
  listCycles,
  submitManagerReview,
  submitSelfReview,
  updateCycle,
} from "@/services/performance.service";

const ALL = "__all__";
const RATING_LABELS = ["Poor", "Below Average", "Average", "Good", "Excellent"];
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

function RatingVal({ val }: { val: number | null }) {
  if (val === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1 font-medium">
      <Star className="size-3 fill-current text-amber-500" />
      {val.toFixed(1)}
    </span>
  );
}

const CYCLE_STATUS: Record<
  string,
  { label: string; variant: "secondary" | "default" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  active: { label: "Active", variant: "default" },
  closed: { label: "Closed", variant: "outline" },
};

const APPRAISAL_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-secondary text-secondary-foreground" },
  self_review: {
    label: "Self Review",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  manager_review: {
    label: "Manager Review",
    cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  completed: {
    label: "Completed",
    cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
};

function StatusPill({ status }: { status: string }) {
  const s = APPRAISAL_STATUS[status] ?? APPRAISAL_STATUS.pending;
  return (
    <span
      className={`
        inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium
        ${s.cls}
      `}
    >
      {s.label}
    </span>
  );
}

function RatingSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <FormControl>
        <SelectTrigger>
          <SelectValue placeholder={label ?? "Select rating"} />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        {[1, 2, 3, 4, 5].map((n) => (
          <SelectItem key={n} value={String(n)}>
            {n} — {RATING_LABELS[n - 1]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Schemas ─────────────────────────────────────────────
const cycleSchema = z.object({
  name: z.string().min(1, "Required"),
  description: z.string().optional(),
  startDate: z.string().min(1, "Required"),
  endDate: z.string().min(1, "Required"),
});
type CycleForm = z.infer<typeof cycleSchema>;
const selfSchema = z.object({
  selfRating: z.coerce.number().min(1).max(5),
  selfComment: z.string().optional(),
});
type SelfForm = z.infer<typeof selfSchema>;
const mgrSchema = z.object({
  managerRating: z.coerce.number().min(1).max(5),
  managerComment: z.string().optional(),
  finalRating: z.coerce.number().min(1).max(5).optional(),
});
type MgrForm = z.infer<typeof mgrSchema>;
const goalSchema = z.object({
  title: z.string().min(1, "Required"),
  description: z.string().optional(),
  weight: z.coerce.number().min(0).max(100).optional(),
});
type GoalForm = z.infer<typeof goalSchema>;

// ─── Columns ─────────────────────────────────────────────
function cycleColumns(
  onEdit: (c: AppraisalCycle) => void,
  onToggle: (c: AppraisalCycle) => void,
) {
  return [
    {
      key: "name",
      header: "Name",
      render: (c: AppraisalCycle) => (
        <span className="font-medium">{c.name}</span>
      ),
    },
    {
      key: "period",
      header: "Period",
      render: (c: AppraisalCycle) => (
        <span className="text-xs">
          {fmtDate(c.startDate)} – {fmtDate(c.endDate)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (c: AppraisalCycle) => {
        const s = CYCLE_STATUS[c.status] ?? CYCLE_STATUS.draft;
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
    {
      key: "count",
      header: "Appraisals",
      render: (c: AppraisalCycle) => c._count.appraisals,
    },
    {
      key: "actions",
      mobileRole: "actions" as const,
      header: "Actions",
      className: "text-right",
      render: (c: AppraisalCycle) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onEdit(c)}
          >
            <Pencil className="mr-1 size-3" />
            Edit
          </Button>
          {c.status === "draft" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onToggle(c)}
            >
              <Play className="mr-1 size-3" />
              Activate
            </Button>
          )}
          {c.status === "active" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onToggle(c)}
            >
              <Square className="mr-1 size-3" />
              Close
            </Button>
          )}
        </div>
      ),
    },
  ];
}

function appraisalColumns(
  canSelf: boolean,
  canMgr: boolean,
  onSelf: (a: Appraisal) => void,
  onMgr: (a: Appraisal) => void,
) {
  return [
    {
      key: "employee",
      header: "Employee",
      render: (a: Appraisal) => (
        <div>
          <div className="font-medium">{a.employee.name}</div>
          <div className="text-muted-foreground text-[11px]">
            {a.employee.department ?? "—"}
          </div>
        </div>
      ),
    },
    { key: "cycle", header: "Cycle", render: (a: Appraisal) => a.cycle.name },
    {
      key: "status",
      header: "Status",
      render: (a: Appraisal) => <StatusPill status={a.status} />,
    },
    {
      key: "selfRating",
      header: "Self",
      render: (a: Appraisal) => <RatingVal val={a.selfRating} />,
    },
    {
      key: "mgrRating",
      header: "Manager",
      render: (a: Appraisal) => <RatingVal val={a.managerRating} />,
    },
    {
      key: "final",
      header: "Final",
      render: (a: Appraisal) => <RatingVal val={a.finalRating} />,
    },
    {
      key: "actions",
      mobileRole: "actions" as const,
      header: "Actions",
      className: "text-right",
      render: (a: Appraisal) => (
        <div className="flex items-center justify-end gap-1">
          {canSelf && a.status === "self_review" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onSelf(a)}
            >
              Self Review
            </Button>
          )}
          {canMgr && a.status === "manager_review" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onMgr(a)}
            >
              Manager Review
            </Button>
          )}
        </div>
      ),
    },
  ];
}

// ─── Page ────────────────────────────────────────────────
export default function PerformancePage() {
  const { user, hasPermission } = useAuth();
  const canHr = hasPermission("performance:hr-manage");
  const canSelf = hasPermission("performance:self-review");
  const canMgr = hasPermission("performance:manager-review");
  const canGoals = hasPermission("performance:goals");

  const [activeTab, setActiveTab] = useTabParam(
    canSelf ? "my-review" : "appraisals",
  );

  // Cycles
  const [cycles, setCycles] = useState<AppraisalCycle[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const cPag = usePagination();
  const {
    page: cPage,
    pageSize: cPageSize,
    setTotalCount: setCTotalCount,
  } = cPag;
  const [kpiAppraisals, setKpiAppraisals] = useState(0);

  // Appraisals
  const [appraisals, setAppraisals] = useState<Appraisal[]>([]);
  const [loadingAppraisals, setLoadingAppraisals] = useState(true);
  const aPag = usePagination();
  const {
    page: aPage,
    pageSize: aPageSize,
    setPage: setAPage,
    setTotalCount: setATotalCount,
  } = aPag;
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [cycleFilter, setCycleFilter] = useState(ALL);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);

  // My reviews
  const [myAppraisals, setMyAppraisals] = useState<Appraisal[]>([]);
  const [loadingMy, setLoadingMy] = useState(true);

  // Dialogs
  const [cycleDialogOpen, setCycleDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<AppraisalCycle | null>(null);
  const [selfDialogOpen, setSelfDialogOpen] = useState(false);
  const [mgrDialogOpen, setMgrDialogOpen] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [selAppraisal, setSelAppraisal] = useState<Appraisal | null>(null);

  // ── Fetchers ──────────────────────────────────────────
  const fetchCycles = useCallback(async () => {
    if (!canHr) return;
    try {
      setLoadingCycles(true);
      const res = await listCycles({ page: cPage, limit: cPageSize });
      setCycles(res.data);
      setCTotalCount(res.meta.total);
      setKpiAppraisals(res.data.reduce((s, c) => s + c._count.appraisals, 0));
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load cycles",
      );
    } finally {
      setLoadingCycles(false);
    }
  }, [canHr, cPage, cPageSize, setCTotalCount]);

  const fetchAppraisals = useCallback(async () => {
    try {
      setLoadingAppraisals(true);
      const p: AppraisalQueryParams = { page: aPage, limit: aPageSize };
      if (statusFilter !== ALL) p.status = statusFilter;
      if (cycleFilter !== ALL) p.cycleId = cycleFilter;
      // The box has always been here; the term just never left the component, so
      // typing a name reset the page and showed the same rows.
      const term = debouncedSearch.trim();
      if (term) p.search = term;
      const res = await listAppraisals(p);
      setAppraisals(res.data);
      setATotalCount(res.meta.total);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load appraisals",
      );
    } finally {
      setLoadingAppraisals(false);
    }
  }, [
    aPage,
    aPageSize,
    setATotalCount,
    statusFilter,
    cycleFilter,
    debouncedSearch,
  ]);

  const fetchMy = useCallback(async () => {
    if (!canSelf || !user?.id) return;
    try {
      setLoadingMy(true);
      const res = await listAppraisals({ employeeId: user.id, limit: 50 });
      setMyAppraisals(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load your reviews",
      );
    } finally {
      setLoadingMy(false);
    }
  }, [canSelf, user?.id]);

  useEffect(() => {
    void fetchCycles();
  }, [fetchCycles]);
  useEffect(() => {
    if (activeTab === "appraisals") void fetchAppraisals();
  }, [activeTab, fetchAppraisals]);
  useEffect(() => {
    if (activeTab === "my-review") void fetchMy();
  }, [activeTab, fetchMy]);
  useEffect(() => {
    setAPage(1);
  }, [statusFilter, cycleFilter, debouncedSearch, setAPage]);

  const refreshAll = useCallback(() => {
    void fetchCycles();
    void fetchAppraisals();
    void fetchMy();
  }, [fetchCycles, fetchAppraisals, fetchMy]);

  // ── Actions ───────────────────────────────────────────
  const openCreate = () => {
    setEditingCycle(null);
    setCycleDialogOpen(true);
  };
  const openEdit = (c: AppraisalCycle) => {
    setEditingCycle(c);
    setCycleDialogOpen(true);
  };
  const toggleCycle = async (c: AppraisalCycle) => {
    const next = c.status === "draft" ? "active" : "closed";
    try {
      await updateCycle(c.id, { status: next as "active" | "closed" });
      toast.success(`Cycle ${next === "active" ? "activated" : "closed"}`);
      refreshAll();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to update cycle",
      );
    }
  };
  const openSelf = (a: Appraisal) => {
    setSelAppraisal(a);
    setSelfDialogOpen(true);
  };
  const openMgr = (a: Appraisal) => {
    setSelAppraisal(a);
    setMgrDialogOpen(true);
  };
  const openGoal = (a: Appraisal) => {
    setSelAppraisal(a);
    setGoalDialogOpen(true);
  };

  // ── Column memos ──────────────────────────────────────
  // openEdit/toggleCycle close over latest state; column factory only
  // needs the reference once, so the empty dep array is intentional.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cCols = useMemo(() => cycleColumns(openEdit, toggleCycle), []);
  const aCols = useMemo(
    () => appraisalColumns(canSelf, canMgr, openSelf, openMgr),
    [canSelf, canMgr],
  );
  const activeCycleCount = useMemo(
    () => cycles.filter((c) => c.status === "active").length,
    [cycles],
  );

  const tabsList = useMemo(() => {
    const t: { id: string; label: string }[] = [];
    if (canHr) t.push({ id: "cycles", label: "Cycles" });
    t.push({ id: "appraisals", label: "Appraisals" });
    if (canSelf) t.push({ id: "my-review", label: "My Review" });
    return t;
  }, [canHr, canSelf]);

  return (
    <div>
      <PageHeader
        title="Performance Review"
        subtitle="Manage appraisal cycles, reviews, and goals"
      >
        {canHr && activeTab === "cycles" && (
          <Button onClick={openCreate}>
            <Plus className="size-3.5" /> Create Cycle
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-col gap-4">
        <Tabs tabs={tabsList} active={activeTab} onChange={setActiveTab}>
          {canHr && (
            <TabsContent value="cycles">
              <div
                className={`
                  mb-4 grid grid-cols-1 gap-3
                  sm:grid-cols-3
                `}
              >
                <KpiCard label="Total Cycles" value={cPag.totalCount} accent />
                <KpiCard label="Active Cycles" value={activeCycleCount} />
                <KpiCard label="Total Appraisals" value={kpiAppraisals} />
              </div>
              <DataTable
                columns={cCols}
                data={cycles}
                loading={loadingCycles}
                emptyMessage="No appraisal cycles found"
                pagination={
                  <DataPagination
                    page={cPag.page}
                    pageSize={cPag.pageSize}
                    totalCount={cPag.totalCount}
                    totalPages={cPag.totalPages}
                    onPageChange={cPag.setPage}
                    onPageSizeChange={cPag.setPageSize}
                  />
                }
              />
            </TabsContent>
          )}

          <TabsContent value="appraisals">
            <div
              className={`
                mb-3 flex flex-col gap-2
                sm:flex-row sm:items-center
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
                  placeholder="Search by employee..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 min-w-[140px] text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {Object.entries(APPRAISAL_STATUS).map(([v, { label }]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cycles.length > 0 && (
                <Select value={cycleFilter} onValueChange={setCycleFilter}>
                  <SelectTrigger className="h-10 min-w-[140px] text-xs">
                    <SelectValue placeholder="Cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All cycles</SelectItem>
                    {cycles.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <DataTable
              columns={aCols}
              data={appraisals}
              loading={loadingAppraisals}
              emptyMessage="No appraisals found"
              pagination={
                <DataPagination
                  page={aPag.page}
                  pageSize={aPag.pageSize}
                  totalCount={aPag.totalCount}
                  totalPages={aPag.totalPages}
                  onPageChange={aPag.setPage}
                  onPageSizeChange={aPag.setPageSize}
                />
              }
            />
          </TabsContent>

          {canSelf && (
            <TabsContent value="my-review">
              {loadingMy ? (
                <div className="text-muted-foreground py-12 text-center text-sm">
                  Loading your reviews…
                </div>
              ) : myAppraisals.length === 0 ? (
                <div className="text-muted-foreground py-12 text-center text-sm">
                  No appraisals assigned to you yet
                </div>
              ) : (
                <div
                  className={`
                    grid gap-4
                    md:grid-cols-2
                  `}
                >
                  {myAppraisals.map((a) => (
                    <Card key={a.id} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-sm font-semibold">
                              {a.cycle.name}
                            </CardTitle>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              {a.manager
                                ? `Manager: ${a.manager.name}`
                                : "No manager assigned"}
                            </p>
                          </div>
                          <StatusPill status={a.status} />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                          {(
                            [
                              "selfRating",
                              "managerRating",
                              "finalRating",
                            ] as const
                          ).map((k) => (
                            <div key={k} className="text-center">
                              <p
                                className={`
                                  text-muted-foreground mb-1 text-[10px]
                                  font-semibold tracking-wider uppercase
                                `}
                              >
                                {k === "selfRating"
                                  ? "Self"
                                  : k === "managerRating"
                                    ? "Manager"
                                    : "Final"}
                              </p>
                              <div className="text-lg">
                                <RatingVal val={a[k]} />
                              </div>
                            </div>
                          ))}
                        </div>
                        {a.goals.length > 0 && (
                          <div>
                            <p
                              className={`
                                text-muted-foreground mb-2 text-[10px]
                                font-semibold tracking-wider uppercase
                              `}
                            >
                              Goals
                            </p>
                            <div className="space-y-1.5">
                              {a.goals.map((g) => (
                                <div
                                  key={g.id}
                                  className={`
                                    bg-muted/50 flex items-center
                                    justify-between rounded px-2.5 py-1.5
                                    text-xs
                                  `}
                                >
                                  <div className="flex items-center gap-2">
                                    <Target
                                      className={`text-muted-foreground size-3`}
                                    />
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
                        <div className="flex flex-wrap gap-2 pt-1">
                          {a.status === "self_review" && (
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => openSelf(a)}
                            >
                              <ClipboardList className="mr-1 size-3" />
                              Self Review
                            </Button>
                          )}
                          {canGoals && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => openGoal(a)}
                            >
                              <Target className="mr-1 size-3" />
                              Add Goal
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>

      <CycleDialog
        open={cycleDialogOpen}
        onOpenChange={setCycleDialogOpen}
        cycle={editingCycle}
        onSuccess={refreshAll}
      />
      <SelfReviewDialog
        open={selfDialogOpen}
        onOpenChange={setSelfDialogOpen}
        appraisal={selAppraisal}
        onSuccess={refreshAll}
      />
      <ManagerReviewDialog
        open={mgrDialogOpen}
        onOpenChange={setMgrDialogOpen}
        appraisal={selAppraisal}
        onSuccess={refreshAll}
      />
      <GoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        appraisal={selAppraisal}
        onSuccess={refreshAll}
      />
    </div>
  );
}

// ─── Dialogs ─────────────────────────────────────────────

interface DialogProps<T = unknown> {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  appraisal?: Appraisal | null;
  cycle?: T;
}

function CycleDialog({
  open,
  onOpenChange,
  cycle,
  onSuccess,
}: DialogProps<AppraisalCycle | null> & { cycle: AppraisalCycle | null }) {
  const isEdit = !!cycle;
  const form = useForm<CycleForm>({
    resolver: zodResolver(cycleSchema),
    defaultValues: { name: "", description: "", startDate: "", endDate: "" },
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      form.reset(
        cycle
          ? {
              name: cycle.name,
              description: cycle.description ?? "",
              startDate: cycle.startDate.slice(0, 10),
              endDate: cycle.endDate.slice(0, 10),
            }
          : { name: "", description: "", startDate: "", endDate: "" },
      );
    }
  }, [open, cycle, form]);

  const onSubmit = async (v: CycleForm) => {
    try {
      setBusy(true);
      if (isEdit) {
        await updateCycle(cycle!.id, v);
        toast.success("Cycle updated");
      } else {
        await createCycle(v);
        toast.success("Cycle created");
      }
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save cycle",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Cycle" : "Create Cycle"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update appraisal cycle details."
              : "Create a new appraisal cycle."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Q1 2026 Review" />
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
                    <Textarea
                      {...field}
                      rows={2}
                      placeholder="Optional description..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <FormDatePicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Start date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <FormDatePicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="End date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : isEdit ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SelfReviewDialog({
  open,
  onOpenChange,
  appraisal,
  onSuccess,
}: DialogProps) {
  const form = useForm<SelfForm>({
    resolver: zodResolver(selfSchema),
    defaultValues: { selfRating: 3, selfComment: "" },
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      form.reset({
        selfRating: appraisal?.selfRating ?? 3,
        selfComment: appraisal?.selfComment ?? "",
      });
    }
  }, [open, appraisal, form]);

  const onSubmit = async (v: SelfForm) => {
    if (!appraisal) return;
    try {
      setBusy(true);
      await submitSelfReview(appraisal.id, v);
      toast.success("Self review submitted");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to submit self review",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Self Review</DialogTitle>
          <DialogDescription>
            Rate your performance and add comments.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="selfRating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rating (1–5)</FormLabel>
                  <RatingSelect
                    value={String(field.value)}
                    onChange={(v) => field.onChange(Number(v))}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="selfComment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comment</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="Describe your achievements and areas for improvement..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Submitting…" : "Submit Review"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ManagerReviewDialog({
  open,
  onOpenChange,
  appraisal,
  onSuccess,
}: DialogProps) {
  const form = useForm<MgrForm>({
    resolver: zodResolver(mgrSchema),
    defaultValues: {
      managerRating: 3,
      managerComment: "",
      finalRating: undefined,
    },
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      form.reset({
        managerRating: appraisal?.managerRating ?? 3,
        managerComment: appraisal?.managerComment ?? "",
        finalRating: appraisal?.finalRating ?? undefined,
      });
    }
  }, [open, appraisal, form]);

  const onSubmit = async (v: MgrForm) => {
    if (!appraisal) return;
    try {
      setBusy(true);
      await submitManagerReview(appraisal.id, v);
      toast.success("Manager review submitted");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to submit manager review",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manager Review</DialogTitle>
          <DialogDescription>
            Review for {appraisal?.employee.name ?? "employee"}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="managerRating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Manager Rating (1–5)</FormLabel>
                  <RatingSelect
                    value={String(field.value)}
                    onChange={(v) => field.onChange(Number(v))}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="managerComment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comment</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="Provide your assessment..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="finalRating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Final Rating (optional)</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) =>
                      field.onChange(v ? Number(v) : undefined)
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select final rating" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} — {RATING_LABELS[n - 1]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Submitting…" : "Submit Review"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function GoalDialog({ open, onOpenChange, appraisal, onSuccess }: DialogProps) {
  const form = useForm<GoalForm>({
    resolver: zodResolver(goalSchema),
    defaultValues: { title: "", description: "", weight: 20 },
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) form.reset({ title: "", description: "", weight: 20 });
  }, [open, form]);

  const onSubmit = async (v: GoalForm) => {
    if (!appraisal) return;
    try {
      setBusy(true);
      await createGoal({ ...v, appraisalId: appraisal.id });
      toast.success("Goal added");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add goal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Goal</DialogTitle>
          <DialogDescription>
            Add a new goal for this appraisal.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g. Complete project deliverables"
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
                    <Textarea
                      {...field}
                      rows={2}
                      placeholder="Optional details..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="weight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Weight (0–100%)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={100} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Adding…" : "Add Goal"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
