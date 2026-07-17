"use client";

import {
  Heart,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { BenefitBulkImportDialog } from "@/components/benefits/benefit-bulk-import-dialog";
import { BenefitDeleteDialog } from "@/components/benefits/benefit-delete-dialog";
import { BenefitDetailDialog } from "@/components/benefits/benefit-detail-dialog";
import { BenefitFormDialog } from "@/components/benefits/benefit-form-dialog";
import {
  ALL_FILTER,
  CATEGORIES,
  formatCurrency,
  formatDate,
} from "@/components/benefits/benefits-utils";
import { EnrollDialog } from "@/components/benefits/enroll-dialog";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { Input, Select, SelectItem } from "@/components/shared/input-group";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent } from "@/components/shared/tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  type Benefit,
  type BenefitDetail,
  type BenefitEnrollment,
  deleteBenefit,
  getBenefitById,
  getBenefits,
  getMyEnrollments,
  unenrollFromBenefit,
} from "@/services/benefit.service";
import { type Entity, listEntities } from "@/services/entity.service";

export default function BenefitsPage() {
  const { hasPermission } = useAuth();
  const canRead = hasPermission("benefits:read");
  const canManage = hasPermission("benefits:manage");
  const canEnroll = hasPermission("benefits:enroll");
  const canBrowseCatalog = canRead || canManage || canEnroll;
  const canViewMyEnrollments = canRead || canManage || canEnroll;

  const [activeTab, setActiveTab] = useState(() =>
    canEnroll && !canRead && !canManage ? "my-enrollments" : "benefits",
  );
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(() => canBrowseCatalog);
  const pagination = usePagination();

  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_FILTER);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);

  const [formOpen, setFormOpen] = useState(false);
  const [editBenefit, setEditBenefit] = useState<BenefitDetail | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Benefit | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [detailBenefit, setDetailBenefit] = useState<BenefitDetail | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = useState(false);

  const [enrollOpen, setEnrollOpen] = useState(false);

  const [myEnrollments, setMyEnrollments] = useState<BenefitEnrollment[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(true);
  const [entities, setEntities] = useState<Entity[]>([]);

  const { page, pageSize, setTotalCount, setPage, totalCount } = pagination;

  const fetchBenefits = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getBenefits({
        page,
        limit: pageSize,
        category: categoryFilter === ALL_FILTER ? undefined : categoryFilter,
      });
      setBenefits(result.data);
      setTotalCount(result.meta.total);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load benefits",
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, categoryFilter, setTotalCount]);

  const fetchMyEnrollments = useCallback(async () => {
    try {
      setLoadingEnrollments(true);
      const result = await getMyEnrollments();
      setMyEnrollments(result.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load enrollments",
      );
    } finally {
      setLoadingEnrollments(false);
    }
  }, []);

  useEffect(() => {
    if (canBrowseCatalog) {
      void fetchBenefits();
    }
  }, [fetchBenefits, canBrowseCatalog]);

  useEffect(() => {
    if (activeTab === "my-enrollments" && canViewMyEnrollments) {
      void fetchMyEnrollments();
    }
  }, [activeTab, fetchMyEnrollments, canViewMyEnrollments]);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, setPage]);

  useEffect(() => {
    listEntities()
      .then((res) => setEntities(res.data))
      .catch(() => {});
  }, []);

  const filteredBenefits = useMemo(() => {
    if (!debouncedSearch) return benefits;
    const q = debouncedSearch.toLowerCase();
    return benefits.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        b.provider?.toLowerCase().includes(q),
    );
  }, [benefits, debouncedSearch]);

  const handleOpenEdit = async (id: string) => {
    try {
      const { data } = await getBenefitById(id);
      setEditBenefit(data);
      setFormOpen(true);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load benefit",
      );
    }
  };

  const handleOpenDetail = async (id: string) => {
    try {
      const { data } = await getBenefitById(id);
      setDetailBenefit(data);
      setDetailOpen(true);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load benefit",
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteBenefit(deleteTarget.id);
      toast.success("Benefit deleted");
      setDeleteTarget(null);
      void fetchBenefits();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete benefit",
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleUnenroll = async (enrollmentId: string) => {
    try {
      await unenrollFromBenefit(enrollmentId);
      toast.success("Employee unenrolled");
      if (detailBenefit) {
        const { data } = await getBenefitById(detailBenefit.id);
        setDetailBenefit(data);
      }
      void fetchBenefits();
      void fetchMyEnrollments();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to unenroll");
    }
  };

  const handleSaved = () => {
    // After create / edit, jump back to page 1 so a brand-new plan is
    // surfaced immediately (the list is sorted createdAt-desc on the
    // server). Without this, a plan created while the user was on
    // page 2+ stayed invisible until they navigated home.
    setPage(1);
    void fetchBenefits();
    setEditBenefit(null);
  };

  const handleEnrolled = () => {
    void fetchBenefits();
    void fetchMyEnrollments();
  };

  const kpiCards = useMemo(() => {
    const active = benefits.filter((b) => b.isActive).length;
    const totalEnrolled = benefits.reduce(
      (sum, b) => sum + b._count.enrollments,
      0,
    );
    return [
      { label: "Total Benefits", value: totalCount },
      { label: "Active (this page)", value: active },
      { label: "Enrollments (this page)", value: totalEnrolled },
    ];
  }, [benefits, totalCount]);

  const showKpis = canRead || canManage;

  const tabsList = useMemo(() => {
    const tabs = [{ id: "my-enrollments", label: "My Enrollments" }];
    if (canBrowseCatalog) {
      tabs.unshift({ id: "benefits", label: "All Benefits" });
    }
    return tabs;
  }, [canBrowseCatalog]);

  const benefitColumns = [
    {
      key: "name",
      header: "Benefit",
      render: (b: Benefit) => (
        <Button
          variant="link"
          className="h-auto p-0 text-left font-medium"
          onClick={() => handleOpenDetail(b.id)}
        >
          {b.name}
        </Button>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (b: Benefit) => <Badge variant="blue">{b.category}</Badge>,
    },
    {
      key: "provider",
      header: "Provider",
      render: (b: Benefit) => (
        <span className="text-muted-foreground">{b.provider ?? "—"}</span>
      ),
    },
    {
      key: "cost",
      header: "Annual Cost",
      render: (b: Benefit) => (
        <span className="tabular-nums">
          {formatCurrency(b.cost, b.currency)}
        </span>
      ),
    },
    {
      key: "enrollments",
      header: "Enrolled",
      render: (b: Benefit) => (
        <span className="tabular-nums">{b._count.enrollments}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (b: Benefit) => (
        <Badge status={b.isActive ? "active" : "inactive"}>
          {b.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-[100px] text-right",
      render: (b: Benefit) =>
        canManage ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="xs"
              className="text-xs"
              onClick={() => handleOpenEdit(b.id)}
            >
              <Pencil className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              className="text-destructive text-xs"
              onClick={() => setDeleteTarget(b)}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        ) : null,
    },
  ];

  const enrollmentColumns = [
    {
      key: "benefit",
      header: "Benefit",
      render: (e: BenefitEnrollment) => (
        <span className="font-medium">{e.benefit?.name ?? "—"}</span>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (e: BenefitEnrollment) => (
        <Badge variant="blue">{e.benefit?.category ?? "—"}</Badge>
      ),
    },
    {
      key: "provider",
      header: "Provider",
      render: (e: BenefitEnrollment) => (
        <span className="text-muted-foreground">
          {e.benefit?.provider ?? "—"}
        </span>
      ),
    },
    {
      key: "cost",
      header: "Annual Cost",
      render: (e: BenefitEnrollment) =>
        e.benefit ? (
          <span className="tabular-nums">
            {formatCurrency(e.benefit.cost, e.benefit.currency)}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "startDate",
      header: "Start Date",
      render: (e: BenefitEnrollment) => formatDate(e.startDate),
    },
    {
      key: "status",
      header: "Status",
      render: (e: BenefitEnrollment) => (
        <Badge status={e.status}>{e.status}</Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Benefits"
        subtitle="Manage company benefits and employee enrollments"
      >
        <div className="flex items-center gap-2">
          {canEnroll && (
            <Button variant="outline" onClick={() => setEnrollOpen(true)}>
              <UserPlus className="size-3.5" />
              Enroll
            </Button>
          )}
          {canManage && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-3.5" />
              Import
            </Button>
          )}
          {canManage && (
            <Button
              onClick={() => {
                setEditBenefit(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-3.5" />
              Add Benefit
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="flex flex-col gap-4">
        {showKpis && (
          <div
            className={`
              mb-2 grid gap-4
              md:grid-cols-3
            `}
          >
            {kpiCards.map((card) => (
              <Card key={card.label}>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Heart className="size-3 text-rose-400" />
                    {card.label}
                  </CardDescription>
                  <CardTitle className="text-xl tabular-nums">
                    {card.value}
                  </CardTitle>
                </CardHeader>
                <CardContent />
              </Card>
            ))}
          </div>
        )}

        <Tabs tabs={tabsList} active={activeTab} onChange={setActiveTab}>
          <TabsContent value="benefits">
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
                  placeholder="Search benefits..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <Select
                value={categoryFilter}
                onValueChange={setCategoryFilter}
                className="h-8 min-w-[140px] text-xs"
              >
                <SelectItem value={ALL_FILTER}>All categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <DataTable
              columns={benefitColumns}
              data={filteredBenefits}
              loading={loading}
              emptyMessage="No benefits found"
              pagination={
                <DataPagination
                  page={pagination.page}
                  pageSize={pagination.pageSize}
                  totalCount={pagination.totalCount}
                  totalPages={pagination.totalPages}
                  onPageChange={pagination.setPage}
                  onPageSizeChange={pagination.setPageSize}
                />
              }
            />
          </TabsContent>

          <TabsContent value="my-enrollments">
            <DataTable
              columns={enrollmentColumns}
              data={myEnrollments}
              loading={loadingEnrollments}
              emptyMessage="You are not enrolled in any benefits"
            />
          </TabsContent>
        </Tabs>
      </div>

      <BenefitFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditBenefit(null);
        }}
        onSaved={handleSaved}
        benefit={editBenefit}
        entities={entities}
      />

      <BenefitBulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleSaved}
        entities={entities}
      />

      <EnrollDialog
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        onEnrolled={handleEnrolled}
        benefits={benefits}
      />

      <BenefitDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        benefitName={deleteTarget?.name ?? ""}
        loading={deleting}
      />

      <BenefitDetailDialog
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailBenefit(null);
        }}
        benefit={detailBenefit}
        canManage={canManage}
        onUnenroll={handleUnenroll}
      />
    </div>
  );
}
