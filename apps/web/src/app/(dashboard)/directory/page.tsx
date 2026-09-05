"use client";

import {
  Grid3X3,
  Info,
  LayoutList,
  Loader2,
  Network,
  Search,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DepartmentSummary } from "@/components/directory/department-summary";
import { EmployeeCard } from "@/components/directory/employee-card";
import { EmployeeDetailSheet } from "@/components/directory/employee-detail-sheet";
import { OrgChartView } from "@/components/directory/org-chart";
import { Avatar } from "@/components/shared/avatar";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { useTabParam } from "@/hooks/use-tab-param";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  type Department,
  type DirectoryEmployee,
  getDirectoryDepartments,
  getDirectoryOrgChart,
  listDirectory,
  type OrgChartNode,
} from "@/services/directory.service";

const ALL_DEPTS = "__all__";

type ViewMode = "grid" | "list";

export default function DirectoryPage() {
  const { hasPermission } = useAuth();
  const canViewSensitive = hasPermission("directory:view-sensitive");
  const showLimitedDirectoryBanner =
    hasPermission("directory:read") && !canViewSensitive;

  const [employees, setEmployees] = useState<DirectoryEmployee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [orgNodes, setOrgNodes] = useState<OrgChartNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const pagination = usePagination({ initialPageSize: 24 });
  const { page, pageSize, setTotalCount } = pagination;

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useTabParam("directory");
  const [metaLoaded, setMetaLoaded] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listDirectory({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        department: deptFilter || undefined,
      });
      setEmployees(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load directory",
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, deptFilter, setTotalCount]);

  const fetchMeta = useCallback(async () => {
    try {
      const [deptRes, orgRes] = await Promise.all([
        getDirectoryDepartments(),
        getDirectoryOrgChart(),
      ]);
      setDepartments(deptRes.data);
      setOrgNodes(orgRes.data);
    } catch {
      // non-critical
    } finally {
      setMetaLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  function openDetail(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
  }

  const listColumns = [
    {
      key: "name",
      header: "Name",
      render: (e: DirectoryEmployee) => (
        <Button
          variant="ghost"
          className="flex h-auto items-center gap-2 px-1 py-0.5"
          onClick={() => openDetail(e.id)}
        >
          <Avatar name={e.name} src={e.avatarUrl} />
          <span className="text-foreground font-medium">{e.name}</span>
        </Button>
      ),
    },
    {
      key: "jobTitle",
      header: "Title",
      render: (e: DirectoryEmployee) => e.jobTitle ?? "—",
    },
    {
      key: "department",
      header: "Department",
      render: (e: DirectoryEmployee) => e.department ?? "—",
    },
    {
      key: "entity",
      header: "Entity",
      render: (e: DirectoryEmployee) => e.entity?.name ?? "—",
    },
    {
      key: "email",
      header: "Email",
      render: (e: DirectoryEmployee) => (
        <span className="text-muted-foreground text-[11px]">{e.email}</span>
      ),
    },
    {
      key: "location",
      header: "Location",
      render: (e: DirectoryEmployee) => e.location ?? "—",
    },
    {
      key: "type",
      header: "Type",
      render: (e: DirectoryEmployee) => (
        <Badge status={e.employmentType}>
          {e.employmentType.replace("_", " ")}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Employee Directory"
        subtitle="Browse and search the company directory"
      />

      {showLimitedDirectoryBanner && (
        <Alert className="mb-5">
          <Info className="size-4" />
          <AlertTitle>Standard directory view</AlertTitle>
          <AlertDescription>
            Phone numbers and compensation fields are hidden. HR colleagues with
            expanded directory access see the full profile.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="directory" className="gap-1.5">
            <Users className="size-3.5" />
            Directory
          </TabsTrigger>
          <TabsTrigger value="org-chart" className="gap-1.5">
            <Network className="size-3.5" />
            Org Chart
          </TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="mt-4">
          {departments.length > 0 && (
            <DepartmentSummary
              departments={departments}
              onSelect={(dept) => {
                setDeptFilter(dept);
                pagination.setPage(1);
              }}
            />
          )}

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-xs">
              <Search
                className={`
                  text-muted-foreground pointer-events-none absolute top-1/2
                  left-3 size-3.5 -translate-y-1/2
                `}
              />
              <Input
                placeholder="Search by name, email, or department…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  pagination.setPage(1);
                }}
                className="h-9 pl-9 text-[13px]"
              />
              {search && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setSearch("")}
                  className="absolute top-1/2 right-1.5 -translate-y-1/2"
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>

            <Select
              value={deptFilter || ALL_DEPTS}
              onValueChange={(v) => {
                setDeptFilter(v === ALL_DEPTS ? "" : v);
                pagination.setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-48 text-[13px]">
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DEPTS}>All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.name} value={d.name}>
                    {d.name} ({d.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="border-border ml-auto flex rounded-lg border">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setViewMode("grid")}
                className="rounded-r-none"
              >
                <Grid3X3 className="size-3.5" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setViewMode("list")}
                className="rounded-l-none"
              >
                <LayoutList className="size-3.5" />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
            </div>
          ) : viewMode === "grid" ? (
            <>
              {employees.length > 0 ? (
                <div
                  className={`
                    grid grid-cols-1 gap-3
                    sm:grid-cols-2
                    lg:grid-cols-3
                    xl:grid-cols-4
                  `}
                >
                  {employees.map((emp) => (
                    <EmployeeCard
                      key={emp.id}
                      employee={emp}
                      onClick={() => openDetail(emp.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground py-16 text-center text-sm">
                  No employees found
                </p>
              )}
              <div className="mt-4">
                <DataPagination
                  page={pagination.page}
                  pageSize={pagination.pageSize}
                  totalCount={pagination.totalCount}
                  totalPages={pagination.totalPages}
                  onPageChange={pagination.setPage}
                  onPageSizeChange={pagination.setPageSize}
                />
              </div>
            </>
          ) : (
            <DataTable
              columns={listColumns}
              data={employees}
              loading={loading}
              emptyMessage="No employees found"
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
          )}
        </TabsContent>

        <TabsContent value="org-chart" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle
                className={`flex items-center gap-2 text-sm font-semibold`}
              >
                <Network className="size-4" />
                Organization Chart
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orgNodes.length > 0 ? (
                <OrgChartView nodes={orgNodes} />
              ) : metaLoaded ? (
                <p className="text-muted-foreground py-16 text-center text-sm">
                  No organization chart data available
                </p>
              ) : (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="text-muted-foreground size-5 animate-spin" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EmployeeDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        employeeId={selectedId}
        onSelectEmployee={setSelectedId}
      />
    </div>
  );
}
