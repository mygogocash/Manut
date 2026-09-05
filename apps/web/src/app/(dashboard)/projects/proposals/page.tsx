"use client";

import {
  ArrowLeft,
  MessageCircleQuestion,
  Plus,
  Search,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ChainEditorDialog } from "@/components/projects/approval-chains/chain-editor-dialog";
import { ProposalFormDialog } from "@/components/projects/proposals/proposal-form-dialog";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  getProposalQueue,
  PROPOSAL_STATUS_TONE,
  PROPOSAL_TYPE_LABELS,
  PROPOSAL_TYPE_OPTIONS,
  type ProposalQueue,
  type ProposalRow,
  type ProposalType,
  type ProposalView,
} from "@/services/proposal.service";

// Proposals queue: one route, six views.
//
// The counts come back with every load, so a tab badge never costs its own
// request. Search and the type filter are applied server-side, because the API
// caps rows and filtering the page you happen to hold would give a different
// answer than filtering the set.

const TABS: Array<{ key: ProposalView; label: string }> = [
  { key: "pending", label: "Awaiting My Decision" },
  { key: "answering", label: "Questions For Me" },
  { key: "mine", label: "My Proposals" },
  { key: "list", label: "All" },
  { key: "approved", label: "Approved" },
  { key: "declined", label: "Declined" },
];

const ALL_TYPES = "all";

/**
 * Matches the API's `take`. Surfaced rather than silently truncated: the tab
 * badge counts the whole set, so a capped table would otherwise disagree with it
 * for no visible reason.
 */
const ROW_CAP = 200;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB");
}

function emptyMessage(view: ProposalView): string {
  switch (view) {
    case "pending":
      return "Nothing is waiting on your decision";
    case "answering":
      return "Nobody has asked you for information";
    case "mine":
      return "You have not raised a proposal yet";
    default:
      return "No proposals here yet";
  }
}

export default function ProposalsPage() {
  const { hasAnyPermission, isSystemAdmin } = useAuth();
  const canView = hasAnyPermission("proposals:read", "projects:manage");
  // `projects:manage` is the API's super-grant, so mirror it here rather than
  // hiding a button the server would have allowed.
  const canCreate = hasAnyPermission("proposals:create", "projects:manage");
  // Only the system Admin role may change a chain, matching the API's guard. Not
  // a permission code: a super admin holds every code, so no code can be
  // exclusive to them.
  const canConfigure = isSystemAdmin;

  const [view, setView] = useState<ProposalView>("pending");
  const [data, setData] = useState<ProposalQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState<string>(ALL_TYPES);
  const [formOpen, setFormOpen] = useState(false);
  const [approversOpen, setApproversOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pagination = usePagination();
  const { setTotalCount, setPage } = pagination;

  // Typing should not fire a request per keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await getProposalQueue(view, {
        search: debouncedSearch || undefined,
        type: type === ALL_TYPES ? undefined : type,
      });
      setData(res.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Could not load proposals";
      // Recorded in state as well as toasted. A toast disappears, and without
      // this the table falls back to its empty message, so a failed request
      // reads as "nothing is waiting on you" — the opposite of the truth.
      setError(message);
      setData(null);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [canView, debouncedSearch, type, view]);

  useEffect(() => {
    void load();
  }, [load]);

  // Memoised so the empty-array fallback does not create a new reference on
  // every render and re-run the paging memo below.
  const rows = useMemo(() => data?.rows ?? [], [data]);

  useEffect(() => {
    setTotalCount(rows.length);
  }, [rows.length, setTotalCount]);

  // Deciding on the last row of a page shrinks the set under the current page
  // number. `setPage` clamps what it is given but nothing re-clamps the page it
  // is already on, so without this the table renders its empty message while
  // rows exist on an earlier page.
  useEffect(() => {
    if (pagination.page > pagination.totalPages) {
      setPage(pagination.totalPages);
    }
  }, [pagination.page, pagination.totalPages, setPage]);

  const paged = useMemo(() => {
    const start = (pagination.page - 1) * pagination.pageSize;
    return rows.slice(start, start + pagination.pageSize);
  }, [rows, pagination.page, pagination.pageSize]);

  if (!canView) {
    return (
      <div className="px-6 py-6">
        <PageHeader title="Proposals" />
        <p className="text-muted-foreground text-sm">
          You don&apos;t have access to proposals.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <div className="mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects">
            <ArrowLeft className="mr-1 size-3.5" />
            Projects
          </Link>
        </Button>
      </div>

      <div
        className={`
          mb-4 flex flex-col gap-3
          sm:flex-row sm:items-start sm:justify-between
        `}
      >
        <PageHeader
          title="Proposals"
          subtitle="Ideas, change requests and anything else needing a decision"
        />
        <div className="flex shrink-0 items-center gap-2">
          {canConfigure && (
            <Button variant="outline" onClick={() => setApproversOpen(true)}>
              <Settings2 className="mr-1 size-3.5" />
              Approval chain
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="mr-1 size-3.5" />
              Raise a proposal
            </Button>
          )}
        </div>
      </div>

      {/* Views */}
      <div
        className={`
          border-border mb-4 flex flex-wrap gap-1 overflow-x-auto border-b pb-px
        `}
      >
        {TABS.map((t) => {
          const active = view === t.key;
          const count = data?.counts?.[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setView(t.key);
                setPage(1);
              }}
              className={`
                -mb-px shrink-0 rounded-t-md border-b-2 px-3 py-2 text-sm
                transition-colors
                ${
                  active
                    ? "border-primary text-foreground font-medium"
                    : `
                      text-muted-foreground border-transparent
                      hover:text-foreground
                    `
                }
              `}
            >
              {t.label}
              {typeof count === "number" && (
                <span
                  className={`
                    bg-muted text-muted-foreground ml-2 rounded-full px-1.5
                    py-0.5 text-[10px] tabular-nums
                  `}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search
            className={`
              text-muted-foreground absolute top-1/2 left-2.5 size-3.5
              -translate-y-1/2
            `}
          />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search title or details…"
            className="h-9 pl-8"
          />
        </div>
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TYPES}>All types</SelectItem>
            {PROPOSAL_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Couldn&apos;t load proposals</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {rows.length >= ROW_CAP && (
        <p className="text-muted-foreground mb-2 text-xs">
          Showing the {ROW_CAP} most recently updated. Narrow with search or the
          type filter to see the rest.
        </p>
      )}

      <DataTable
        loading={loading}
        data={paged}
        emptyMessage={error ? "" : emptyMessage(view)}
        columns={[
          {
            key: "title",
            header: "Proposal",
            render: (r: ProposalRow) => (
              <div className="min-w-0">
                <Link
                  href={`/projects/proposals/${r.id}`}
                  className={`
                    font-medium
                    hover:underline
                  `}
                >
                  {r.title}
                </Link>
                {r.openQuestionCount > 0 && (
                  <span
                    className={`
                      text-muted-foreground mt-0.5 flex items-center gap-1
                      text-xs
                    `}
                  >
                    <MessageCircleQuestion className="size-3" />
                    Waiting on {r.openQuestionCount}{" "}
                    {r.openQuestionCount === 1 ? "answer" : "answers"}
                  </span>
                )}
              </div>
            ),
          },
          {
            key: "type",
            mobileRole: "field" as const,
            header: "Type",
            render: (r: ProposalRow) =>
              PROPOSAL_TYPE_LABELS[r.type as ProposalType] ?? r.type,
          },
          { key: "raisedBy", mobileRole: "subtitle" as const, header: "Raised by" },
          {
            key: "status",
            mobileRole: "badge" as const,
            header: "Status",
            render: (r: ProposalRow) => (
              <span
                className={`
                  inline-flex rounded-full px-2 py-0.5 text-xs font-medium
                  ${PROPOSAL_STATUS_TONE[r.status] ?? ""}
                `}
              >
                {r.label}
              </span>
            ),
          },
          {
            key: "createdAt",
            mobileRole: "detail" as const,
            header: "Raised",
            render: (r: ProposalRow) => fmtDate(r.createdAt),
          },
          {
            key: "statusChangedAt",
            mobileRole: "field" as const,
            header: "Last moved",
            render: (r: ProposalRow) => fmtDate(r.statusChangedAt),
          },
        ]}
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

      <ProposalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={() => void load()}
      />

      <ChainEditorDialog
        open={approversOpen}
        onOpenChange={setApproversOpen}
        scope="proposal"
        canEdit={canConfigure}
        onSaved={() => void load()}
      />
    </div>
  );
}
