"use client";

import { format } from "date-fns";
import {
  CheckCircle2,
  Edit,
  ExternalLink,
  MoreHorizontal,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ModuleFormDialog } from "@/components/learning/module-form-dialog";
import { Badge } from "@/components/shared/badge";
import { CrmImportDialog } from "@/components/shared/crm-import-dialog";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent } from "@/components/shared/tabs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { trackCourseStarted } from "@/lib/events";
import { useAuth } from "@/providers/auth-provider";
import {
  CATEGORY_LABELS,
  type CreateModuleInput,
  importModules,
  type LearningCompletion,
  type LearningModule,
  listCompletions,
  listModules,
  markComplete,
  MODULE_CATEGORIES,
} from "@/services/learning.service";

const ALL_VALUE = "__all__";

// Shape the import dialog hands the submit handler. Mirrors the
// Learning-program import columns (Institution /
// Country of Institution / Major / Subject / Free/Pay Course /
// Cost/Person / Searcher / Source / Remarks).
interface ModuleImportRow {
  title?: string;
  category?: string;
  institution?: string;
  country?: string;
  cost?: string;
  searcher?: string;
  url?: string;
  remarks?: string;
  duration?: number;
}

// Map the xlsx's free-text "Major" cell to the server's canonical
// category enum. Unknown majors fall back to "other" so the row still
// imports — the L&D team can re-categorise via the form later.
function normaliseCategory(raw: string | undefined): string {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "other";
  if (
    s.includes("information and communication") ||
    s.includes("ict") ||
    s.includes("technology") ||
    s === "ai" ||
    s === "engineering" ||
    s.includes("data") ||
    s.includes("cyber")
  ) {
    return "technical";
  }
  if (s.includes("leadership") || s.includes("management")) {
    return "leadership";
  }
  if (s.includes("soft skill") || s.includes("communication")) {
    return "soft_skills";
  }
  if (s.includes("compliance") || s.includes("ethics")) return "compliance";
  if (s.includes("product")) return "product";
  if (s.includes("marketing")) return "marketing";
  if (s.includes("sales")) return "sales";
  if (s.includes("onboard")) return "onboarding";
  return "other";
}

// Compose the description from the auxiliary columns the xlsx
// carries but the schema doesn't pin down (Institution, Country,
// Cost, Searcher, Remarks). Keeps the cells round-trippable without
// adding new DB columns for free-text metadata.
function composeDescription(row: ModuleImportRow): string | undefined {
  const parts: string[] = [];
  const institution = [row.institution, row.country]
    .filter(Boolean)
    .join(" · ");
  if (institution) parts.push(institution);
  if (row.cost) parts.push(`Cost: ${row.cost}`);
  if (row.searcher) parts.push(`Searcher: ${row.searcher}`);
  if (row.remarks) parts.push(row.remarks);
  const joined = parts.join("\n");
  return joined.trim() ? joined : undefined;
}

export default function LearningPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("learning:manage");
  const canComplete = hasPermission("learning:complete");
  const isHrView = hasPermission("learning:hr-read");

  const [tab, setTab] = useState("modules");

  // ── Modules state ──
  const [modules, setModules] = useState<LearningModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const modulesPagination = usePagination();
  const {
    page: modPage,
    pageSize: modPageSize,
    setTotalCount: setModTotalCount,
  } = modulesPagination;

  const [formOpen, setFormOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<LearningModule | null>(
    null,
  );
  const [importOpen, setImportOpen] = useState(false);

  // ── Completions state ──
  const [completions, setCompletions] = useState<LearningCompletion[]>([]);
  const [completionsLoading, setCompletionsLoading] = useState(true);
  const completionsPagination = usePagination();
  const {
    page: compPage,
    pageSize: compPageSize,
    setTotalCount: setCompTotalCount,
  } = completionsPagination;

  // ── Fetch modules ──
  const fetchModules = useCallback(async () => {
    try {
      setModulesLoading(true);
      const res = await listModules({
        page: modPage,
        limit: modPageSize,
        search: debouncedSearch || undefined,
        category: categoryFilter || undefined,
      });
      setModules(res.data);
      setModTotalCount(res.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load modules";
      toast.error(message);
    } finally {
      setModulesLoading(false);
    }
  }, [modPage, modPageSize, debouncedSearch, categoryFilter, setModTotalCount]);

  // ── Fetch completions ──
  const fetchCompletions = useCallback(async () => {
    try {
      setCompletionsLoading(true);
      const res = await listCompletions({
        page: compPage,
        limit: compPageSize,
      });
      setCompletions(res.data);
      setCompTotalCount(res.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load completions";
      toast.error(message);
    } finally {
      setCompletionsLoading(false);
    }
  }, [compPage, compPageSize, setCompTotalCount]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  useEffect(() => {
    if (tab === "completions") fetchCompletions();
  }, [tab, fetchCompletions]);

  async function handleMarkComplete(moduleId: string) {
    try {
      await markComplete(moduleId);
      toast.success("Module marked as complete");
      fetchCompletions();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to mark complete";
      toast.error(message);
    }
  }

  function openCreate() {
    setEditingModule(null);
    setFormOpen(true);
  }

  function openEdit(mod: LearningModule) {
    setEditingModule(mod);
    setFormOpen(true);
  }

  // ── Module columns ──
  const moduleColumns = [
    {
      key: "title",
      header: "Title",
      render: (m: LearningModule) => (
        <span className="text-foreground font-medium">{m.title}</span>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (m: LearningModule) => (
        <Badge variant="blue">
          {CATEGORY_LABELS[m.category] ?? m.category}
        </Badge>
      ),
    },
    {
      key: "duration",
      header: "Duration",
      render: (m: LearningModule) => (m.duration ? `${m.duration} min` : "—"),
    },
    {
      key: "url",
      header: "Resources",
      render: (m: LearningModule) => {
        const links: React.ReactNode[] = [];
        if (m.url) {
          links.push(
            <a
              key="url"
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackCourseStarted({ course_id: m.id })}
              className={`
                text-primary inline-flex items-center gap-1 text-[12px]
                hover:underline
              `}
            >
              Open <ExternalLink className="size-3" />
            </a>,
          );
        }
        if (m.fileUrl) {
          links.push(
            <a
              key="file"
              href={m.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`
                text-primary inline-flex max-w-[180px] items-center gap-1
                truncate text-[12px]
                hover:underline
              `}
              title={m.fileName ?? "Download file"}
            >
              {m.fileName ?? "File"}
            </a>,
          );
        }
        if (links.length === 0) return "—";
        return <span className="flex flex-wrap gap-2">{links}</span>;
      },
    },
    {
      key: "isMandatory",
      header: "Mandatory",
      render: (m: LearningModule) =>
        m.isMandatory ? (
          <Badge variant="red">Required</Badge>
        ) : (
          <Badge variant="grey">Optional</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "w-10",
      render: (m: LearningModule) => {
        if (!canManage && !canComplete) return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canManage && (
                <DropdownMenuItem onClick={() => openEdit(m)}>
                  <Edit className="mr-2 size-3.5" />
                  Edit
                </DropdownMenuItem>
              )}
              {canComplete && (
                <DropdownMenuItem onClick={() => handleMarkComplete(m.id)}>
                  <CheckCircle2 className="mr-2 size-3.5" />
                  Mark complete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  // ── Completion columns ──
  const completionColumns = [
    {
      key: "module",
      header: "Module",
      render: (c: LearningCompletion) => (
        <span className="text-foreground font-medium">
          {c.module?.title ?? c.moduleId}
        </span>
      ),
    },
    {
      key: "completedAt",
      header: "Completed",
      render: (c: LearningCompletion) =>
        c.completedAt ? format(new Date(c.completedAt), "MMM d, yyyy") : "—",
    },
    {
      key: "score",
      header: "Score",
      render: (c: LearningCompletion) =>
        c.score !== null ? `${c.score}%` : "—",
    },
  ];

  const TABS = [
    { id: "modules", label: "Training Modules" },
    {
      id: "completions",
      label: isHrView ? "All Completions" : "My Completions",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Learning"
        subtitle="Training and professional development"
      >
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1.5 size-3.5" />
              Import
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 size-3.5" />
              New module
            </Button>
          </div>
        )}
      </PageHeader>

      <Tabs tabs={TABS} active={tab} onChange={setTab}>
        <TabsContent value="modules">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-xs">
              <Search
                className={`
                  text-muted-foreground pointer-events-none absolute top-1/2
                  left-3 size-3.5 -translate-y-1/2
                `}
              />
              <Input
                placeholder="Search modules…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  modulesPagination.setPage(1);
                }}
                className="h-9 pl-9 text-[13px]"
              />
            </div>
            <Select
              value={categoryFilter || ALL_VALUE}
              onValueChange={(v) => {
                setCategoryFilter(v === ALL_VALUE ? "" : v);
                modulesPagination.setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-40 text-[13px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All categories</SelectItem>
                {MODULE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={moduleColumns}
            data={modules}
            loading={modulesLoading}
            emptyMessage="No training modules found"
            pagination={
              <DataPagination
                page={modulesPagination.page}
                pageSize={modulesPagination.pageSize}
                totalCount={modulesPagination.totalCount}
                totalPages={modulesPagination.totalPages}
                onPageChange={modulesPagination.setPage}
                onPageSizeChange={modulesPagination.setPageSize}
              />
            }
          />
        </TabsContent>

        <TabsContent value="completions">
          <DataTable
            columns={completionColumns}
            data={completions}
            loading={completionsLoading}
            emptyMessage="No completions yet"
            pagination={
              <DataPagination
                page={completionsPagination.page}
                pageSize={completionsPagination.pageSize}
                totalCount={completionsPagination.totalCount}
                totalPages={completionsPagination.totalPages}
                onPageChange={completionsPagination.setPage}
                onPageSizeChange={completionsPagination.setPageSize}
              />
            }
          />
        </TabsContent>
      </Tabs>

      <ModuleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        module={editingModule}
        onSaved={fetchModules}
      />

      <CrmImportDialog<ModuleImportRow>
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void fetchModules()}
        title="Import learning modules"
        entityLabel="modules"
        templateName="learning-modules-import-template"
        fields={[
          // Aligned with the learning-program import so the team can
          // export → edit → re-import without renaming columns.
          // First hit wins; older intranet-style headers stay as
          // aliases.
          {
            key: "title",
            headers: ["Subject", "Title", "Course", "Course Name"],
            type: "string",
            required: true,
          },
          {
            key: "category",
            headers: ["Major", "Category", "Track"],
            type: "string",
          },
          {
            key: "institution",
            headers: ["Institution", "Provider"],
            type: "string",
          },
          {
            key: "country",
            headers: ["Country of Institution", "Country"],
            type: "string",
          },
          {
            key: "cost",
            headers: ["Cost/Person", "Cost", "Free/Pay Course"],
            type: "string",
          },
          {
            key: "searcher",
            headers: ["Searcher", "Curator"],
            type: "string",
          },
          {
            key: "url",
            headers: ["Source", "URL", "Link"],
            type: "string",
          },
          {
            key: "remarks",
            headers: ["Remarks", "Description", "Notes"],
            type: "string",
          },
          {
            key: "duration",
            headers: ["Duration", "Minutes", "Duration (min)"],
            type: "number",
          },
        ]}
        submit={async (rows) => {
          const payload: CreateModuleInput[] = rows.map((r) => ({
            title: (r.title ?? "").trim(),
            category: normaliseCategory(r.category),
            duration:
              typeof r.duration === "number" && r.duration > 0
                ? r.duration
                : undefined,
            // URL field is optional on the server but, if present,
            // must be a valid URL. Skip the value when the cell is
            // non-empty but not URL-shaped — the import path's
            // try/catch will count those rows as `skipped` rather
            // than failing the batch.
            url: r.url?.trim() || undefined,
            description: composeDescription(r),
          }));
          const res = await importModules(payload);
          if (res.data.skipped > 0) {
            toast.message(
              `${res.data.skipped} row${res.data.skipped === 1 ? "" : "s"} skipped (invalid URL or duplicate).`,
            );
          }
          return { created: res.data.created };
        }}
      />
    </div>
  );
}
