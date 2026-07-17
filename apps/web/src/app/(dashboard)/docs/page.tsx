"use client";

import { format } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  Edit,
  FileText,
  History,
  Lock,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageFormDialog } from "@/components/docs/page-form-dialog";
import { PermissionsDialog } from "@/components/docs/permissions-dialog";
import { VersionHistoryDialog } from "@/components/docs/version-history-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionButton } from "@/components/shared/permission-button";
import { RichTextViewer } from "@/components/shared/rich-text-editor";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  deleteWikiPage,
  getWikiPage,
  getWikiTree,
  type WikiPage,
  type WikiPageListItem,
} from "@/services/docs.service";

interface TreeNode {
  page: WikiPageListItem;
  children: TreeNode[];
}

function buildTree(pages: WikiPageListItem[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const p of pages) {
    map.set(p.id, { page: p, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const p of pages) {
    const node = map.get(p.id)!;
    if (p.parentId && map.has(p.parentId)) {
      map.get(p.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.page.position !== b.page.position) {
        return a.page.position - b.page.position;
      }
      return a.page.title.localeCompare(b.page.title);
    });
    for (const n of nodes) sortNodes(n.children);
  };
  sortNodes(roots);
  return roots;
}

function filterTreeBySearch(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query) return nodes;
  const lower = query.toLowerCase();
  const out: TreeNode[] = [];
  for (const n of nodes) {
    const childMatches = filterTreeBySearch(n.children, lower);
    const selfMatches = n.page.title.toLowerCase().includes(lower);
    if (selfMatches || childMatches.length > 0) {
      out.push({ page: n.page, children: childMatches });
    }
  }
  return out;
}

export default function DocsPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("docs:create");
  const canUpdate = hasPermission("docs:update");
  const canDelete = hasPermission("docs:delete");

  const [tree, setTree] = useState<WikiPageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<WikiPage | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [permsOpen, setPermsOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<WikiPageListItem | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const fetchTree = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getWikiTree(canUpdate);
      setTree(res.data);
      if (res.data.length > 0 && !selectedId) {
        setSelectedId(res.data[0]!.id);
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load pages";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [canUpdate, selectedId]);

  useEffect(() => {
    void fetchTree();
  }, [fetchTree]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedPage(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    getWikiPage(selectedId)
      .then((res) => {
        if (cancelled) return;
        setSelectedPage(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError ? err.message : "Failed to load page";
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const rootNodes = useMemo(() => buildTree(tree), [tree]);
  const filteredNodes = useMemo(
    () => filterTreeBySearch(rootNodes, debouncedSearch),
    [rootNodes, debouncedSearch],
  );

  function toggleNode(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openCreate(parentId?: string | null) {
    setEditingPage(null);
    setDefaultParentId(parentId ?? null);
    setFormOpen(true);
  }

  function openEdit(page: WikiPage) {
    setEditingPage(page);
    setDefaultParentId(null);
    setFormOpen(true);
  }

  function handleSaved(saved: WikiPage) {
    setSelectedId(saved.id);
    setSelectedPage(saved);
    void fetchTree();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteWikiPage(deleteTarget.id);
      toast.success("Page deleted");
      if (selectedId === deleteTarget.id) {
        setSelectedId(null);
        setSelectedPage(null);
      }
      setDeleteTarget(null);
      void fetchTree();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete page";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Repository"
        subtitle="Workspace wiki — important documents, playbooks, and references"
      >
        <PermissionButton
          variant="accent"
          permission="docs:create"
          onClick={() => openCreate(null)}
        >
          <Plus className="size-3.5" />
          New page
        </PermissionButton>
      </PageHeader>

      <div
        className={`
          border-border bg-surface grid min-h-[600px] grid-cols-1 gap-0
          rounded-lg border shadow-sm
          md:grid-cols-[280px_1fr]
        `}
      >
        {/* ── Sidebar / tree ─────────────────────────────── */}
        <aside
          className={`
            border-border flex flex-col gap-2 border-b p-3
            md:border-r
          `}
        >
          <div className="relative">
            <Search
              className={`
                text-muted-foreground pointer-events-none absolute top-1/2
                left-2.5 size-3.5 -translate-y-1/2
              `}
            />
            <Input
              placeholder="Search pages…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div
            className={`
              flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto pr-1 text-sm
            `}
          >
            {loading ? (
              <div className="text-muted-foreground py-6 text-center text-xs">
                Loading…
              </div>
            ) : filteredNodes.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs">
                {debouncedSearch
                  ? "No pages match your search."
                  : "No pages yet."}
              </p>
            ) : (
              filteredNodes.map((node) => (
                <TreeNodeView
                  key={node.page.id}
                  node={node}
                  depth={0}
                  selectedId={selectedId}
                  collapsed={collapsed}
                  onToggle={toggleNode}
                  onSelect={setSelectedId}
                  canCreate={canCreate}
                  onAddChild={openCreate}
                />
              ))
            )}
          </div>
        </aside>

        {/* ── Detail ──────────────────────────────────────── */}
        <main className="flex flex-col">
          {detailLoading ? (
            <div className="text-muted-foreground py-12 text-center text-xs">
              Loading page…
            </div>
          ) : selectedPage ? (
            <article className="flex flex-1 flex-col gap-4 p-6">
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1
                      className={`
                        font-heading text-foreground truncate text-2xl
                        font-semibold
                      `}
                    >
                      {selectedPage.title}
                    </h1>
                    {selectedPage.isRestricted ? (
                      <span
                        className={`
                          inline-flex items-center gap-1 rounded bg-amber-100
                          px-1.5 py-0.5 text-[10px] text-amber-900 uppercase
                          dark:bg-amber-900/30 dark:text-amber-200
                        `}
                      >
                        <Lock className="size-3" /> Restricted
                      </span>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Updated{" "}
                    {format(new Date(selectedPage.updatedAt), "MMM d, yyyy")} by{" "}
                    {selectedPage.updatedBy.name}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Version history"
                    onClick={() => setHistoryOpen(true)}
                  >
                    <History className="size-3.5" />
                  </Button>
                  {canUpdate ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Manage access"
                        onClick={() => setPermsOpen(true)}
                      >
                        <ShieldCheck className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Edit page"
                        onClick={() => openEdit(selectedPage)}
                      >
                        <Edit className="size-3.5" />
                      </Button>
                    </>
                  ) : null}
                  {canDelete ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Delete page"
                      onClick={() =>
                        setDeleteTarget({
                          id: selectedPage.id,
                          title: selectedPage.title,
                          parentId: selectedPage.parentId,
                          position: selectedPage.position,
                          folder: selectedPage.folder,
                          slug: selectedPage.slug,
                          isPublished: selectedPage.isPublished,
                          isRestricted: selectedPage.isRestricted,
                          createdById: selectedPage.createdById,
                          createdAt: selectedPage.createdAt,
                          updatedAt: selectedPage.updatedAt,
                          createdBy: selectedPage.createdBy,
                          updatedBy: selectedPage.updatedBy,
                        })
                      }
                    >
                      <Trash2 className="text-destructive size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </header>
              <div className="text-foreground text-sm leading-relaxed">
                <RichTextViewer html={selectedPage.body} />
              </div>
              {selectedPage.attachments &&
                selectedPage.attachments.length > 0 && (
                  <section className="mt-6 flex flex-col gap-2">
                    <h3
                      className={`
                        text-foreground text-xs font-semibold tracking-wide
                        uppercase
                      `}
                    >
                      Attachments
                    </h3>
                    <ul className="flex flex-col gap-1.5">
                      {selectedPage.attachments.map((a, idx) => (
                        <li
                          key={`${a.url}-${idx}`}
                          className={`
                            border-border bg-card flex items-center
                            justify-between gap-2 rounded-md border px-3 py-2
                            text-[12px]
                          `}
                        >
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`
                              text-primary inline-flex min-w-0 items-center
                              gap-2 truncate
                              hover:underline
                            `}
                          >
                            <Paperclip className="size-3.5 shrink-0" />
                            <span className="truncate">{a.name}</span>
                          </a>
                          <span
                            className={`
                              text-muted-foreground text-[11px] tabular-nums
                            `}
                          >
                            {formatBytesDisplay(a.size)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
            </article>
          ) : (
            <div
              className={`
                flex flex-1 flex-col items-center justify-center gap-2 p-8
                text-center
              `}
            >
              <FileText className="text-muted-foreground size-8" />
              <p className="text-muted-foreground text-sm">
                {tree.length === 0
                  ? "Create the first page to get started."
                  : "Pick a page from the sidebar."}
              </p>
            </div>
          )}
        </main>
      </div>

      <PageFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        page={editingPage}
        candidates={tree}
        defaultParentId={defaultParentId}
        onSaved={handleSaved}
      />

      <VersionHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        pageId={selectedPage?.id ?? null}
        pageTitle={selectedPage?.title ?? ""}
        canRestore={canUpdate}
        onRestored={(p) => {
          setSelectedPage(p);
          void fetchTree();
        }}
      />

      <PermissionsDialog
        open={permsOpen}
        onOpenChange={setPermsOpen}
        pageId={selectedPage?.id ?? null}
        pageTitle={selectedPage?.title ?? ""}
        isRestricted={selectedPage?.isRestricted ?? false}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(next) => {
          if (!deleting && !next) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this page?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.title}" and all of its children will be permanently removed. External links pointing to this page will 404 — consider unpublishing instead.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface TreeNodeViewProps {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  canCreate: boolean;
  onAddChild: (parentId: string) => void;
}

function TreeNodeView({
  node,
  depth,
  selectedId,
  collapsed,
  onToggle,
  onSelect,
  canCreate,
  onAddChild,
}: TreeNodeViewProps) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.page.id);
  const isSelected = selectedId === node.page.id;
  return (
    <div className="flex flex-col">
      <div
        className={`
          group flex items-center gap-1 rounded-md pr-1
          ${
            isSelected
              ? "bg-accent text-accent-foreground"
              : `hover:bg-muted/40`
          }
        `}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.page.id)}
            className={`
              text-muted-foreground p-1
              hover:text-foreground
            `}
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? (
              <ChevronRight className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node.page.id)}
          className={`
            flex flex-1 items-center gap-1.5 truncate py-1.5 text-left
            text-[13px]
          `}
        >
          <FileText className="text-muted-foreground size-3.5 shrink-0" />
          <span className="truncate">{node.page.title}</span>
          {node.page.isRestricted ? (
            <Lock className="text-muted-foreground size-3 shrink-0" />
          ) : null}
          {!node.page.isPublished ? (
            <span
              className={`text-muted-foreground ml-auto text-[10px] uppercase`}
            >
              Draft
            </span>
          ) : null}
        </button>
        {canCreate ? (
          <button
            type="button"
            onClick={() => onAddChild(node.page.id)}
            className={`
              text-muted-foreground p-1 opacity-0 transition-opacity
              hover:text-foreground
              group-hover:opacity-100
            `}
            title="Add child page"
          >
            <Plus className="size-3" />
          </button>
        ) : null}
      </div>
      {hasChildren && !isCollapsed
        ? node.children.map((child) => (
            <TreeNodeView
              key={child.page.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              collapsed={collapsed}
              onToggle={onToggle}
              onSelect={onSelect}
              canCreate={canCreate}
              onAddChild={onAddChild}
            />
          ))
        : null}
    </div>
  );
}

function formatBytesDisplay(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
