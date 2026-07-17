"use client";

import {
  BookOpen,
  Download,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PolicyUploadDialog } from "@/components/policies/policy-upload-dialog";
import { PageHeader } from "@/components/shared/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { type Entity, listEntities } from "@/services/entity.service";
import {
  type CompanyPolicy,
  deletePolicy,
  getPolicyDownloadUrl,
  listPolicies,
  POLICY_CATEGORIES,
  POLICY_CATEGORY_LABELS,
  type PolicyCategory,
} from "@/services/policy.service";

const ALL = "__all__";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PoliciesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("policy:manage");

  const [policies, setPolicies] = useState<CompanyPolicy[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyPolicy | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CompanyPolicy | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listPolicies({
        category: category !== ALL ? (category as PolicyCategory) : undefined,
        q: debouncedSearch.trim() || undefined,
        includeInactive: canManage ? true : undefined,
      });
      setPolicies(res.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load policies";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [category, debouncedSearch, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canManage) return;
    listEntities()
      .then((res) => setEntities(res.data))
      .catch(() => {
        /* non-blocking */
      });
  }, [canManage]);

  async function handleDownload(p: CompanyPolicy) {
    try {
      setDownloadingId(p.id);
      const res = await getPolicyDownloadUrl(p.id);
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to open file";
      toast.error(message);
    } finally {
      setDownloadingId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      setDeleting(true);
      await deletePolicy(pendingDelete.id);
      toast.success(`"${pendingDelete.title}" deleted`);
      setPendingDelete(null);
      await load();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<PolicyCategory, CompanyPolicy[]>();
    for (const p of policies) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return Array.from(map.entries()).sort((a, b) =>
      POLICY_CATEGORY_LABELS[a[0]].localeCompare(POLICY_CATEGORY_LABELS[b[0]]),
    );
  }, [policies]);

  return (
    <div className="flex flex-col gap-4 px-6 py-6">
      <PageHeader
        title="Policy & Handbook"
        subtitle="Company policies and reference documents — view or download."
      >
        {canManage && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1 size-3.5" />
            Upload policy
          </Button>
        )}
      </PageHeader>

      <div
        className={`
          flex flex-col gap-2
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
            placeholder="Search policies…"
            className="pl-8"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {POLICY_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {POLICY_CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      ) : policies.length === 0 ? (
        <div
          className={`
            bg-card flex flex-col items-center gap-2 rounded-md border p-12
            text-center
          `}
        >
          <BookOpen className="text-muted-foreground size-8" />
          <p className="text-sm font-medium">No policies yet</p>
          <p className="text-muted-foreground text-xs">
            {canManage
              ? "Upload your first policy to get started."
              : "Check back later — HR will publish documents here."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(([cat, items]) => (
            <section key={cat} className="flex flex-col gap-2">
              <h2
                className={`
                  text-muted-foreground text-[11px] font-semibold
                  tracking-[0.08em] uppercase
                `}
              >
                {POLICY_CATEGORY_LABELS[cat]} · {items.length}
              </h2>
              <div
                className={`
                  grid grid-cols-1 gap-3
                  md:grid-cols-2
                  xl:grid-cols-3
                `}
              >
                {items.map((p) => (
                  <article
                    key={p.id}
                    className={`
                      bg-card flex flex-col gap-3 rounded-md border p-4
                      transition-colors
                      hover:border-primary/40
                    `}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div
                          className={`
                            bg-primary/10 text-primary flex size-9 shrink-0
                            items-center justify-center rounded-md
                          `}
                        >
                          <FileText className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm leading-snug font-medium">
                            {p.title}
                          </h3>
                          <p
                            className={`
                              text-muted-foreground mt-0.5 truncate text-[11px]
                            `}
                          >
                            {p.fileName}
                            {p.fileSize ? ` · ${formatSize(p.fileSize)}` : ""}
                          </p>
                        </div>
                      </div>
                      {!p.isActive && (
                        <Badge variant="outline" className="shrink-0">
                          Inactive
                        </Badge>
                      )}
                    </div>

                    {p.description && (
                      <p className="text-muted-foreground line-clamp-2 text-xs">
                        {p.description}
                      </p>
                    )}

                    <dl
                      className={`
                        text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1
                        text-[11px]
                      `}
                    >
                      {p.version && (
                        <>
                          <dt>Version</dt>
                          <dd className="text-foreground">{p.version}</dd>
                        </>
                      )}
                      <dt>Effective</dt>
                      <dd className="text-foreground">
                        {formatDate(p.effectiveDate)}
                      </dd>
                      <dt>Scope</dt>
                      <dd className="text-foreground">
                        {p.entity ? p.entity.name : "Global"}
                      </dd>
                      <dt>Updated</dt>
                      <dd className="text-foreground">
                        {formatDate(p.updatedAt)}
                      </dd>
                    </dl>

                    <div className="flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(p)}
                        disabled={downloadingId === p.id}
                      >
                        {downloadingId === p.id ? (
                          <Loader2 className="mr-1 size-3.5 animate-spin" />
                        ) : (
                          <Download className="mr-1 size-3.5" />
                        )}
                        View
                      </Button>
                      {canManage && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Edit ${p.title}`}
                            onClick={() => {
                              setEditing(p);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Delete ${p.title}`}
                            onClick={() => setPendingDelete(p)}
                          >
                            <Trash2 className="text-destructive size-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <PolicyUploadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        policy={editing}
        entities={entities}
        onSaved={load}
      />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete policy?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete &&
                `"${pendingDelete.title}" will be removed. The file itself stays in storage and can be retrieved by an admin if needed.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
