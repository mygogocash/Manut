"use client";

import {
  CheckCircle2,
  Megaphone,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AnnouncementFormDialog } from "@/components/legal-announcements/announcement-form-dialog";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { useAuth } from "@/providers/auth-provider";
import {
  ANNOUNCEMENT_KIND_LABELS,
  ANNOUNCEMENT_KINDS,
  ANNOUNCEMENT_STATUS_LABELS,
  ANNOUNCEMENT_STATUSES,
  deleteAnnouncement,
  type LegalAnnouncement,
  listAnnouncements,
} from "@/services/legal-announcements.service";

const ALL = "__all__";

const STATUS_VARIANT: Record<
  string,
  "green" | "red" | "grey" | "blue" | "gold"
> = {
  draft: "grey",
  published: "green",
  archived: "grey",
};

export default function LegalAnnouncementsPage() {
  const { hasPermission } = useAuth();
  const canRead = hasPermission("legal:announcement-read");
  const canManage = hasPermission("legal:announcement-manage");

  const [items, setItems] = useState<LegalAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"all" | "mine">(
    canManage ? "all" : "mine",
  );
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [kindFilter, setKindFilter] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const [formOpen, setFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<LegalAnnouncement | null>(null);

  const pagination = usePagination();
  const {
    page,
    pageSize,
    setPage,
    setPageSize,
    totalPages,
    totalCount,
    setTotalCount,
  } = pagination;

  const fetchAnnouncements = useCallback(async () => {
    if (!canRead) return;
    try {
      setLoading(true);
      const res = await listAnnouncements({
        page,
        limit: pageSize,
        scope,
        status:
          statusFilter === ALL
            ? undefined
            : (statusFilter as "draft" | "published" | "archived"),
        kind:
          kindFilter === ALL
            ? undefined
            : (kindFilter as
                | "policy"
                | "authorized-persons"
                | "handbook"
                | "compliance"
                | "other"),
        search: debouncedSearch || undefined,
      });
      setItems(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load announcements";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [
    canRead,
    page,
    pageSize,
    scope,
    statusFilter,
    kindFilter,
    debouncedSearch,
    setTotalCount,
  ]);

  useEffect(() => {
    void fetchAnnouncements();
  }, [fetchAnnouncements]);

  useEffect(() => {
    setPage(1);
  }, [scope, statusFilter, kindFilter, debouncedSearch, setPage]);

  const handleSaved = useCallback((next: LegalAnnouncement) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === next.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = next;
        return copy;
      }
      return [next, ...prev];
    });
  }, []);

  const handleDelete = useCallback(
    async (item: LegalAnnouncement) => {
      if (!confirm(`Delete "${item.title}"?`)) return;
      try {
        await deleteAnnouncement(item.id);
        toast.success("Deleted");
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setTotalCount((c) => Math.max(0, c - 1));
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to delete";
        toast.error(message);
      }
    },
    [setTotalCount],
  );

  const showScopeToggle = canManage;

  const filteredItems = useMemo(() => items, [items]);

  if (!canRead) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        You don&apos;t have permission to view legal announcements.
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Legal announcements"
        subtitle="Official internal notices from Legal — policies, handbook updates, authorised-persons changes."
      >
        {canManage && (
          <Button
            variant="accent"
            onClick={() => {
              setEditingDoc(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            New announcement
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-col gap-4">
        <div
          className={`
            border-border bg-surface flex flex-col gap-2 rounded-lg border p-3
            shadow-sm
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
              placeholder="Search by title or body…"
              className="h-8 pl-8 text-xs"
            />
          </div>
          {showScopeToggle && (
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as "all" | "mine")}
            >
              <SelectTrigger className="h-10 min-w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All (manage view)</SelectItem>
                <SelectItem value="mine">Employee view</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 min-w-[120px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {ANNOUNCEMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {ANNOUNCEMENT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="h-10 min-w-[140px] text-xs">
              <SelectValue placeholder="Kind" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All kinds</SelectItem>
              {ANNOUNCEMENT_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {ANNOUNCEMENT_KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-muted-foreground py-12 text-center text-xs">
            Loading…
          </p>
        ) : filteredItems.length === 0 ? (
          <div
            className={`
              border-border rounded-lg border border-dashed py-12 text-center
            `}
          >
            <Megaphone className="text-muted-foreground mx-auto size-6" />
            <p className="text-muted-foreground mt-2 text-xs">
              No announcements yet.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filteredItems.map((item) => (
              <li
                key={item.id}
                className={`
                  border-border bg-surface rounded-lg border p-4 shadow-sm
                `}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.pinned ? (
                        <Pin className="text-bronze size-3.5" />
                      ) : null}
                      <Link
                        href={`/legal/announcements/${item.id}`}
                        className={`
                          text-foreground text-sm font-semibold
                          hover:underline
                        `}
                      >
                        {item.title}
                      </Link>
                      <Badge variant={STATUS_VARIANT[item.status] ?? "grey"}>
                        {ANNOUNCEMENT_STATUS_LABELS[item.status]}
                      </Badge>
                      <Badge variant="grey">
                        {ANNOUNCEMENT_KIND_LABELS[item.kind]}
                      </Badge>
                      {item.entity ? (
                        <Badge variant="blue">{item.entity.code}</Badge>
                      ) : null}
                      {item.requiresAck ? (
                        <Badge variant="gold">Ack required</Badge>
                      ) : null}
                      {item.myAckedAt ? (
                        <span
                          className={`
                            text-success inline-flex items-center gap-1
                            text-[11px]
                          `}
                        >
                          <CheckCircle2 className="size-3" /> acknowledged
                        </span>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground mt-1 text-[11px]">
                      Published{" "}
                      {item.publishedAt ? item.publishedAt.slice(0, 10) : "—"}
                      {item.expiresAt
                        ? ` · expires ${item.expiresAt.slice(0, 10)}`
                        : ""}
                      {item.author ? ` · by ${item.author.name}` : ""}
                      {item.requiresAck ? ` · ${item.ackCount} acked` : ""}
                    </p>
                  </div>
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Manage ${item.title}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuLabel>Manage</DropdownMenuLabel>
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditingDoc(item);
                            setFormOpen(true);
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => void handleDelete(item)}
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <DataPagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      <AnnouncementFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        announcement={editingDoc}
        onSaved={handleSaved}
      />
    </div>
  );
}
